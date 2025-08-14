const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
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

// Apply authentication and client access to all routes
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
      data: leaveTypes
    });
  })
);

// =============================================
// LEAVE REQUESTS - EMPLOYEE ACTIONS
// =============================================

// GET /api/leaves/my-requests - Get current user's leave requests
// GET /api/leaves/my-requests - Get current user's leave requests
router.get('/my-requests',
  checkPermission('leaves.view'),
  validateDateRange,
  asyncHandler(async (req, res) => {
    const db = getDB();
    const userId = req.user.userId;
    const { start_date, end_date, status, limit = 50, offset = 0 } = req.query;

    try {
      // First, find the employee ID from the user ID
      const [employee] = await db.execute(`
        SELECT e.id as employee_id, e.client_id
        FROM employees e
        JOIN admin_users au ON e.id = au.employee_id
        WHERE au.id = ? AND e.client_id = ?
      `, [userId, req.user.clientId]);

      if (employee.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found for current user'
        });
      }

      const employeeId = employee[0].employee_id;

      // Build WHERE clause for leave requests
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

      // Get leave requests
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

      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      console.error('Error fetching my leave requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave requests',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// =============================================
// LEAVE REQUESTS - MANAGER/HR ACTIONS
// =============================================

// GET /api/leaves/requests - Get all leave requests (for managers/HR)
// FIXED: Moved const db = getDB() to correct position and fixed syntax
router.get('/requests',
  checkPermission('leaves.approve'),
  validateDateRange,
  asyncHandler(async (req, res) => {
    const db = getDB(); // FIXED: This was in the wrong position causing syntax error
    const clientId = req.user.clientId; // FIXED: Changed from client_id to clientId
    
    const { 
      start_date, 
      end_date, 
      status, 
      department_id, 
      employee_id,
      leave_type_id,
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
    if (leave_type_id) {
      whereClause += ' AND lr.leave_type_id = ?';
      params.push(leave_type_id);
    }

    try {
      // Get leave requests with all related information
      const [requests] = await db.execute(`
        SELECT 
          lr.id,
          lr.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          d.name as department_name,
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
        LEFT JOIN admin_users au ON lr.reviewed_by = au.id
        LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
        ${whereClause}
        ORDER BY lr.applied_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      // Get total count for pagination
      const [countResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        ${whereClause}
      `, params);

      res.json({
        success: true,
        data: {
          requests,
          pagination: {
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            pages: Math.ceil(countResult[0].total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave requests',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// POST /api/leaves/request - Submit new leave request
// POST /api/leaves/request - Submit new leave request
// POST /api/leaves/request - Admin creates leave request for any employee
router.post('/request',
  checkPermission('leaves.approve'),
  [
    body('employee_id').isUUID().withMessage('Valid employee ID is required'),
    body('leave_type_id').isUUID().withMessage('Valid leave type ID is required'),
    body('start_date').isISO8601().withMessage('Valid start date is required'),
    body('end_date').isISO8601().withMessage('Valid end date is required'),
    body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10-500 characters'),
    body('days_requested').isInt({ min: 1 }).withMessage('Days requested must be a positive integer'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long')
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
    console.log('🔍 Create leave request request body:', req.body);
    const db = getDB();
    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      reason,
      days_requested,
      supporting_documents = null,
      notes = null
    } = req.body;

    const adminUserId = req.user.userId;
    const clientId = req.user.clientId;

    try {
      // Verify employee belongs to same client
      const [employee] = await db.execute(`
        SELECT id, first_name, last_name, email, employment_status
        FROM employees 
        WHERE id = ? AND client_id = ?
      `, [employee_id, clientId]);

      if (employee.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Employee not found or does not belong to your organization'
        });
      }

      if (employee[0].employment_status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Cannot create leave request for inactive employee'
        });
      }

      // Validate date range
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      // Verify leave type belongs to client
      const [leaveType] = await db.execute(`
        SELECT id, name, max_days_per_year, max_consecutive_days
        FROM leave_types 
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
        SELECT id, start_date, end_date, status 
        FROM leave_requests 
        WHERE employee_id = ? 
        AND status IN ('pending', 'approved')
        AND NOT (end_date < ? OR start_date > ?)
      `, [employee_id, start_date, end_date]);

      if (overlapping.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Employee has overlapping leave request from ${overlapping[0].start_date} to ${overlapping[0].end_date}`
        });
      }

      // Create leave request
      const requestId = uuidv4();
      const combinedReason = notes ? `${reason}\n\nAdmin Notes: ${notes}` : reason;
      
      await db.execute(`
        INSERT INTO leave_requests (
          id, employee_id, leave_type_id, start_date, end_date,
          days_requested, reason, supporting_documents, status, 
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
      `, [
        requestId, employee_id, leave_type_id, start_date, end_date,
        days_requested, combinedReason, supporting_documents, adminUserId
      ]);

      res.status(201).json({
        success: true,
        message: `Leave request created successfully for ${employee[0].first_name} ${employee[0].last_name}`,
        data: { 
          id: requestId,
          employee_name: `${employee[0].first_name} ${employee[0].last_name}`,
          leave_type: leaveType[0].name,
          start_date,
          end_date,
          days_requested
        }
      });
    } catch (error) {
      console.error('Error creating leave request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create leave request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
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

    const db = getDB();
    const requestId = req.params.id;
    const { comments } = req.body;
    const reviewerId = req.user.userId;

    try {
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
      if (request[0].client_id !== req.user.clientId) {
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
`, [reviewerId, comments || null, requestId]);

      res.json({
        success: true,
        message: 'Leave request approved successfully'
      });
    } catch (error) {
      console.error('Error approving leave request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve leave request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
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

    const db = getDB();
    const requestId = req.params.id;
    const { comments } = req.body;
    const reviewerId = req.user.userId;

    try {
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
      if (request[0].client_id !== req.user.clientId) {
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
      `, [reviewerId, comments||null, requestId]);

      res.json({
        success: true,
        message: 'Leave request rejected successfully'
      });
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject leave request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// =============================================
// LEAVE DASHBOARD & ANALYTICS
// =============================================

// GET /api/leaves/dashboard - Get simple leave dashboard data
router.get('/dashboard',
  checkPermission('leaves.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    try {
      // Get employees on leave today
      const [onLeaveToday] = await db.execute(`
        SELECT 
          e.id,
          CONCAT(e.first_name, ' ', e.last_name) as name,
          e.employee_code,
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
        AND lr.start_date <= ?
        AND lr.end_date >= ?
        ORDER BY e.first_name ASC
      `, [clientId, date, date]);

      // Get pending requests that need attention
      const [pendingRequests] = await db.execute(`
        SELECT 
          lr.id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          lt.name as leave_type,
          lr.start_date,
          lr.end_date,
          lr.days_requested,
          lr.reason,
          lr.applied_at,
          d.name as department
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.client_id = ?
        AND lr.status = 'pending'
        ORDER BY lr.applied_at ASC
        LIMIT 10
      `, [clientId]);

      res.json({
        success: true,
        data: {
          onLeaveToday,
          pendingRequests,
          summary: {
            employeesOnLeaveCount: onLeaveToday.length,
            pendingRequestsCount: pendingRequests.length
          },
          date
        }
      });
    } catch (error) {
      console.error('Error fetching leave dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

module.exports = router;