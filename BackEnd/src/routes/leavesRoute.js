const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDB } = require('../config/database'); // Use getDB like other routes
const { authenticate } = require('../middleware/authMiddleware'); // ← ADD THIS
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware'); // ← ADD ensureClientAccess
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { v4: uuidv4 } = require('uuid');

// =============================================
// VALIDATION HELPERS
// =============================================

const validateLeaveRequest = [
  body('leave_type_id').isUUID().withMessage('Valid leave type ID is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10-500 characters'),
  body('days_requested').isInt({ min: 1 }).withMessage('Days requested must be a positive integer'),
];

const validateDateRange = [
  query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date format'),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled']).withMessage('Invalid status'),
];

router.use(authenticate);        
router.use(ensureClientAccess);  

// =============================================
// LEAVE TYPES MANAGEMENT
// =============================================

// GET /api/leaves/types - Get all leave types for client
router.get('/types', 
  checkPermission('leaves.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    
    const [leaveTypes] = await db.execute(`
      SELECT 
        id,
        name,
        description,
        max_days_per_year,
        max_consecutive_days,
        is_paid,
        requires_approval,
        notice_period_days,
        is_active,
        created_at
      FROM leave_types 
      WHERE client_id = ? AND is_active = TRUE
      ORDER BY name ASC
    `, [clientId]);

    res.json({
      success: true,
      data: leaveTypes,
      count: leaveTypes.length
    });
  })
);


// POST /api/leaves/types - Create new leave type (Admin only)
router.post('/types',
  checkPermission('leaves.manage'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Leave type name is required (2-100 characters)'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
    body('max_days_per_year').isInt({ min: 0, max: 365 }).withMessage('Max days per year must be 0-365'),
    body('max_consecutive_days').optional().isInt({ min: 0 }).withMessage('Max consecutive days must be positive'),
    body('is_paid').isBoolean().withMessage('Is paid must be true or false'),
    body('requires_approval').isBoolean().withMessage('Requires approval must be true or false'),
    body('notice_period_days').optional().isInt({ min: 0 }).withMessage('Notice period must be positive'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      max_days_per_year,
      max_consecutive_days = 0,
      is_paid,
      requires_approval,
      notice_period_days = 0
    } = req.body;

    const clientId = req.user.client_id;
    const leaveTypeId = uuidv4();

    // Check if leave type name already exists for this client
    const [existing] = await db.execute(`
      SELECT id FROM leave_types 
      WHERE client_id = ? AND name = ? AND is_active = TRUE
    `, [clientId, name]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Leave type with this name already exists'
      });
    }

    await db.execute(`
      INSERT INTO leave_types (
        id, client_id, name, description, max_days_per_year, 
        max_consecutive_days, is_paid, requires_approval, notice_period_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      leaveTypeId, clientId, name, description, max_days_per_year,
      max_consecutive_days, is_paid, requires_approval, notice_period_days
    ]);

    res.status(201).json({
      success: true,
      message: 'Leave type created successfully',
      data: { id: leaveTypeId }
    });
  })
);

// =============================================
// LEAVE REQUESTS - EMPLOYEE ACTIONS
// =============================================

// GET /api/leaves/my-requests - Get current user's leave requests
router.get('/my-requests',
  checkPermission('leaves.view'),
  validateDateRange,
  asyncHandler(async (req, res) => {
    const employeeId = req.user.employee_id;
    const { start_date, end_date, status, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE lr.employee_id = ?';
    let params = [employeeId];

    if (start_date) {
      whereClause += ' AND lr.start_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND lr.end_date <= ?';
      params.push(end_date);
    }
    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }

    const [requests] = await db.execute(`
      SELECT 
        lr.id,
        lr.leave_type_id,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.applied_at,
        lr.reviewed_at,
        lr.reviewer_comments,
        lr.supporting_documents,
        CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN admin_users au ON lr.reviewed_by = au.id
      LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
      ${whereClause}
      ORDER BY lr.applied_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM leave_requests lr
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: requests,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  })
);

// POST /api/leaves/request - Submit new leave request
router.post('/request',
  checkPermission('leaves.request'),
  validateLeaveRequest,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      leave_type_id,
      start_date,
      end_date,
      reason,
      days_requested,
      supporting_documents = null
    } = req.body;

    const employeeId = req.user.employee_id;
    const clientId = req.user.client_id;

    // Validate date range
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const today = new Date();

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    if (startDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request leave for past dates'
      });
    }

    // Verify leave type belongs to client
    const [leaveType] = await db.execute(`
      SELECT * FROM leave_types 
      WHERE id = ? AND client_id = ? AND is_active = TRUE
    `, [leave_type_id, clientId]);

    if (leaveType.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave type'
      });
    }

    // Check for overlapping requests
    const [overlapping] = await db.execute(`
      SELECT id FROM leave_requests 
      WHERE employee_id = ? 
      AND status IN ('pending', 'approved')
      AND NOT (end_date < ? OR start_date > ?)
    `, [employeeId, start_date, end_date]);

    if (overlapping.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have overlapping leave requests for this period'
      });
    }

    // Check annual leave balance (if applicable)
    const currentYear = new Date().getFullYear();
    const [usedLeave] = await db.execute(`
      SELECT COALESCE(SUM(days_requested), 0) as used_days
      FROM leave_requests 
      WHERE employee_id = ? 
      AND leave_type_id = ?
      AND status = 'approved'
      AND YEAR(start_date) = ?
    `, [employeeId, leave_type_id, currentYear]);

    const usedDays = usedLeave[0].used_days || 0;
    const availableDays = leaveType[0].max_days_per_year - usedDays;

    if (days_requested > availableDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${days_requested} days`
      });
    }

    // Create leave request
    const requestId = uuidv4();
    await db.execute(`
      INSERT INTO leave_requests (
        id, employee_id, leave_type_id, start_date, end_date,
        days_requested, reason, supporting_documents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      requestId, employeeId, leave_type_id, start_date, end_date,
      days_requested, reason, supporting_documents
    ]);

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: { id: requestId }
    });
  })
);

// =============================================
// LEAVE REQUESTS - MANAGER/HR ACTIONS
// =============================================

// GET /api/leaves/requests - Get all leave requests (for managers/HR)
router.get('/requests',
  checkPermission('leaves.approve'),
  validateDateRange,
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.client_id;
    const { 
      start_date, 
      end_date, 
      status, 
      department_id, 
      employee_id,
      limit = 50, 
      offset = 0 
    } = req.query;

    let whereClause = 'WHERE e.client_id = ?';
    let params = [clientId];

    if (start_date) {
      whereClause += ' AND lr.start_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND lr.end_date <= ?';
      params.push(end_date);
    }
    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }
    if (department_id) {
      whereClause += ' AND e.department_id = ?';
      params.push(department_id);
    }
    if (employee_id) {
      whereClause += ' AND lr.employee_id = ?';
      params.push(employee_id);
    }

    const [requests] = await db.execute(`
      SELECT 
        lr.id,
        lr.employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_id as employee_code,
        d.name as department,
        des.title as designation,
        lr.leave_type_id,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.applied_at,
        lr.reviewed_at,
        lr.reviewer_comments,
        lr.supporting_documents,
        CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN admin_users au ON lr.reviewed_by = au.id
      LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
      ${whereClause}
      ORDER BY 
        CASE lr.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'rejected' THEN 3 
          WHEN 'cancelled' THEN 4 
        END,
        lr.applied_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: requests,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  })
);

// PUT /api/leaves/requests/:id/approve - Approve leave request
router.put('/requests/:id/approve',
  checkPermission('leaves.approve'),
  [
    param('id').isUUID().withMessage('Invalid request ID'),
    body('comments').optional().trim().isLength({ max: 500 }).withMessage('Comments too long')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const requestId = req.params.id;
    const { comments } = req.body;
    const reviewerId = req.user.id;

    // Get request details
    const [request] = await db.execute(`
      SELECT lr.*, e.client_id
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.id = ? AND lr.status = 'pending'
    `, [requestId]);

    if (request.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }

    // Verify client access
    if (request[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update request status
    await db.execute(`
      UPDATE leave_requests 
      SET status = 'approved', 
          reviewed_by = ?, 
          reviewed_at = NOW(), 
          reviewer_comments = ?
      WHERE id = ?
    `, [reviewerId, comments, requestId]);

    res.json({
      success: true,
      message: 'Leave request approved successfully'
    });
  })
);

// PUT /api/leaves/requests/:id/reject - Reject leave request
router.put('/requests/:id/reject',
  checkPermission('leaves.reject'),
  [
    param('id').isUUID().withMessage('Invalid request ID'),
    body('comments').trim().isLength({ min: 10, max: 500 }).withMessage('Rejection reason is required (10-500 characters)')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const requestId = req.params.id;
    const { comments } = req.body;
    const reviewerId = req.user.id;

    // Get request details
    const [request] = await db.execute(`
      SELECT lr.*, e.client_id
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.id = ? AND lr.status = 'pending'
    `, [requestId]);

    if (request.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }

    // Verify client access
    if (request[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update request status
    await db.execute(`
      UPDATE leave_requests 
      SET status = 'rejected', 
          reviewed_by = ?, 
          reviewed_at = NOW(), 
          reviewer_comments = ?
      WHERE id = ?
    `, [reviewerId, comments, requestId]);

    res.json({
      success: true,
      message: 'Leave request rejected successfully'
    });
  })
);

// =============================================
// LEAVE ANALYTICS & REPORTS
// =============================================

// GET /api/leaves/dashboard - Get leave dashboard data
router.get('/dashboard',
  checkPermission('leaves.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId; // Now req.user will be available
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    console.log('📊 Dashboard request for client:', clientId, 'date:', date);

    // Get employees on leave today
    const [onLeaveToday] = await db.execute(`
      SELECT 
        e.id,
        CONCAT(e.first_name, ' ', e.last_name) as name,
        e.profile_image,
        lr.start_date,
        lr.end_date,
        lt.name as leave_type,
        lr.reason,
        d.name as department
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.client_id = ?
      AND lr.status = 'approved'
      AND ? BETWEEN lr.start_date AND lr.end_date
    `, [clientId, date]);

    // Get pending requests count
    const [pendingRequests] = await db.execute(`
      SELECT COUNT(*) as count
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.client_id = ? AND lr.status = 'pending'
    `, [clientId]);

    // Get department summary
    const [departmentSummary] = await db.execute(`
      SELECT 
        d.name as department_name,
        COUNT(e.id) as total_employees,
        COUNT(CASE WHEN lr.id IS NOT NULL THEN 1 END) as employees_on_leave,
        ROUND((COUNT(e.id) - COUNT(CASE WHEN lr.id IS NOT NULL THEN 1 END)) / COUNT(e.id) * 100, 1) as availability_percentage
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.client_id = ?
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id 
        AND lr.status = 'approved' 
        AND ? BETWEEN lr.start_date AND lr.end_date
      WHERE d.client_id = ?
      GROUP BY d.id, d.name
      ORDER BY d.name
    `, [clientId, date, clientId]);

    res.json({
      success: true,
      data: {
        summary: {
          onLeaveCount: onLeaveToday.length,
          pendingRequestsCount: pendingRequests[0].count,
          urgentRequestsCount: 0, // You can add this logic later
          availableCount: 0, // You can calculate this
          totalEmployees: 0 // You can calculate this
        },
        onLeaveToday: onLeaveToday,
        departmentSummary: departmentSummary,
        upcomingLeaves: [] // You can add this later
      }
    });
  })
);

// GET /api/leaves/balance/:employeeId - Get leave balance for employee
router.get('/balance/:employeeId',
  checkPermission('leaves.view'),
  [param('employeeId').isUUID().withMessage('Invalid employee ID')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const employeeId = req.params.employeeId;
    const clientId = req.user.client_id;
    const currentYear = new Date().getFullYear();

    // Verify employee belongs to client
    const [employee] = await db.execute(`
      SELECT id FROM employees WHERE id = ? AND client_id = ?
    `, [employeeId, clientId]);

    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get leave balance for each leave type
    const [leaveBalance] = await db.execute(`
      SELECT 
        lt.id,
        lt.name,
        lt.max_days_per_year,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as used_days,
        COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN lr.days_requested ELSE 0 END), 0) as pending_days,
        (lt.max_days_per_year - COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0)) as remaining_days
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id 
        AND lr.employee_id = ? 
        AND YEAR(lr.start_date) = ?
      WHERE lt.client_id = ? AND lt.is_active = TRUE
      GROUP BY lt.id, lt.name, lt.max_days_per_year
      ORDER BY lt.name
    `, [employeeId, currentYear, clientId]);

    res.json({
      success: true,
      data: {
        employeeId,
        year: currentYear,
        leaveBalance
      }
    });
  })
);

// =============================================
// EXPORT FUNCTIONALITY
// =============================================

// GET /api/leaves/export - Export leave data
router.get('/export',
  checkPermission('leaves.reports'),
  validateDateRange,
  asyncHandler(async (req, res) => {
    const clientId = req.user.client_id;
    const { 
      start_date = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0],
      format = 'csv',
      status,
      department_id
    } = req.query;

    let whereClause = 'WHERE e.client_id = ? AND lr.start_date >= ? AND lr.end_date <= ?';
    let params = [clientId, start_date, end_date];

    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }
    if (department_id) {
      whereClause += ' AND e.department_id = ?';
      params.push(department_id);
    }

    const [leaveData] = await db.execute(`
      SELECT 
        e.employee_id as 'Employee ID',
        CONCAT(e.first_name, ' ', e.last_name) as 'Employee Name',
        d.name as 'Department',
        des.title as 'Designation',
        lt.name as 'Leave Type',
        lr.start_date as 'Start Date',
        lr.end_date as 'End Date',
        lr.days_requested as 'Days Requested',
        lr.reason as 'Reason',
        lr.status as 'Status',
        lr.applied_at as 'Applied At',
        lr.reviewed_at as 'Reviewed At',
        CONCAT(reviewer.first_name, ' ', reviewer.last_name) as 'Reviewed By',
        lr.reviewer_comments as 'Comments'
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN admin_users au ON lr.reviewed_by = au.id
      LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
      ${whereClause}
      ORDER BY lr.applied_at DESC
    `, params);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = [
        Object.keys(leaveData[0] || {}).join(','),
        ...leaveData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && value.includes(',') 
              ? `"${value}"` 
              : value
          ).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=leave-report-${start_date}-to-${end_date}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: leaveData,
        meta: {
          start_date,
          end_date,
          total_records: leaveData.length
        }
      });
    }
  })
);

module.exports = router;