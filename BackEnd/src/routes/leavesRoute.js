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
  body('leave_duration').isIn(['full_day', 'half_day', 'short_leave']).withMessage('Valid leave duration is required'),
  body('start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format'),
  body('end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10-500 characters'),
  body('days_requested').isFloat({ min: 0.25, max: 365 }).withMessage('Days requested must be between 0.25 and 365'),
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

      // Get leave requests with duration information
      const [requests] = await db.execute(`
        SELECT 
          lr.id,
          lr.leave_type_id,
          lt.name as leave_type_name,
          lr.start_date,
          lr.end_date,
          lr.leave_duration,
          lr.start_time,
          lr.end_time,
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
    const db = getDB();
    const clientId = req.user.clientId;
    
    const { 
      start_date, 
      end_date, 
      status, 
      department_id, 
      employee_id,
      leave_type_id,
      leave_duration, // NEW filter
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
    if (leave_duration) {
      whereClause += ' AND lr.leave_duration = ?';
      params.push(leave_duration);
    }

    // Get total count for pagination
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      ${whereClause}
    `, params);

    // Get leave requests with duration and time information
    const [requests] = await db.execute(`
      SELECT 
        lr.id,
        lr.employee_id,
        CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
        e.employee_code,
        e.email as employee_email,
        lr.leave_type_id,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        COALESCE(lr.leave_duration, 'full_day') as leave_duration,
        lr.start_time,
        lr.end_time,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.applied_at,
        lr.reviewed_at,
        lr.reviewer_comments,
        lr.supporting_documents,
        CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name,
        d.name as department_name,
        des.title as designation_title
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN admin_users au ON lr.reviewed_by = au.id
      LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN lr.status = 'pending' THEN 1 
          WHEN lr.status = 'approved' THEN 2
          WHEN lr.status = 'rejected' THEN 3
          ELSE 4 
        END,
        lr.applied_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Format the response
    const formattedRequests = requests.map(req => ({
      ...req,
      // Add formatted time range for short leaves
      time_range: req.leave_duration === 'short_leave' && req.start_time && req.end_time
        ? `${req.start_time.substring(0, 5)} - ${req.end_time.substring(0, 5)}`
        : null,
      // Add duration label
      duration_label: req.leave_duration === 'full_day' ? 'Full Day' :
                     req.leave_duration === 'half_day' ? 'Half Day' :
                     req.leave_duration === 'short_leave' ? 'Short Leave' : 'Full Day'
    }));

    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: formattedRequests,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: totalPages,
        current_page: Math.floor(offset / limit) + 1
      }
    });
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
    body('leave_duration').isIn(['full_day', 'half_day', 'short_leave']).withMessage('Valid leave duration is required'),
    body('start_time').optional({ values: 'falsy' }).matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format'),
    body('end_time').optional({ values: 'falsy' }).matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format'),
    body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10-500 characters'),
    body('days_requested').isFloat({ min: 0.25, max: 365 }).withMessage('Days requested must be between 0.25 and 365'),
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

    const db = getDB();
    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      leave_duration = 'full_day',
      start_time = null,
      end_time = null,
      reason,
      days_requested,
      supporting_documents = null,
      notes = null,
      is_paid = true
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

      // For half-day and short leave, start and end date must be the same
      if (leave_duration !== 'full_day' && start_date !== end_date) {
        return res.status(400).json({
          success: false,
          message: 'Half-day and short leaves must be on the same date'
        });
      }

      // Validate time fields for short leave
      if (leave_duration === 'short_leave' && (!start_time || !end_time)) {
        return res.status(400).json({
          success: false,
          message: 'Start time and end time are required for short leave'
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be on or after start date'
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
        SELECT id, start_date, end_date, status, leave_duration
        FROM leave_requests 
        WHERE employee_id = ? 
        AND status IN ('pending', 'approved')
        AND NOT (end_date < ? OR start_date > ?)
      `, [employee_id, start_date, end_date]);

      if (overlapping.length > 0) {
        // For half-day, check if the overlapping request is also half-day on a different period
        if (leave_duration === 'half_day' && overlapping[0].leave_duration === 'half_day' 
            && overlapping[0].start_date === start_date) {
          return res.status(400).json({
            success: false,
            message: `Employee already has a half-day leave on ${start_date}`
          });
        } else if (overlapping.length > 0 && leave_duration !== 'half_day') {
          return res.status(400).json({
            success: false,
            message: `Employee has overlapping leave request from ${overlapping[0].start_date} to ${overlapping[0].end_date}`
          });
        }
      }

      // Calculate actual days based on duration
      let calculatedDays = days_requested;
      if (leave_duration === 'half_day') {
        calculatedDays = 0.5;
      } else if (leave_duration === 'short_leave') {
        calculatedDays = 0.25; // Quarter day for short leave
      }

      // Check paid leave balance and determine if this leave can be paid
      let finalIsPaid = is_paid;
      let paidLeaveInfo = null;

      if (is_paid) {
        // Get paid_leaves_per_month setting
        const [paidLeavesSetting] = await db.execute(`
          SELECT setting_value
          FROM system_settings
          WHERE setting_key = 'paid_leaves_per_month'
          AND (client_id = ? OR client_id IS NULL)
          ORDER BY CASE WHEN client_id IS NULL THEN 1 ELSE 0 END
          LIMIT 1
        `, [clientId]);

        let paidLeavesLimit = 2; // Default value
        if (paidLeavesSetting.length > 0) {
          try {
            paidLeavesLimit = JSON.parse(paidLeavesSetting[0].setting_value);
          } catch (e) {
            paidLeavesLimit = parseInt(paidLeavesSetting[0].setting_value) || 2;
          }
        }

        // Calculate the month range for the leave request
        const requestStartMonth = new Date(start_date);
        const firstDayOfMonth = new Date(requestStartMonth.getFullYear(), requestStartMonth.getMonth(), 1);
        const lastDayOfMonth = new Date(requestStartMonth.getFullYear(), requestStartMonth.getMonth() + 1, 0);

        // Calculate total paid leaves already taken/approved in this month
        const [existingPaidLeaves] = await db.execute(`
          SELECT COALESCE(SUM(days_requested), 0) as total_paid_leaves
          FROM leave_requests
          WHERE employee_id = ?
          AND is_paid = TRUE
          AND status IN ('approved', 'pending')
          AND (
            (start_date >= ? AND start_date <= ?)
            OR (end_date >= ? AND end_date <= ?)
            OR (start_date <= ? AND end_date >= ?)
          )
        `, [employee_id, firstDayOfMonth, lastDayOfMonth, firstDayOfMonth, lastDayOfMonth, firstDayOfMonth, lastDayOfMonth]);

        const totalPaidLeavesTaken = parseFloat(existingPaidLeaves[0].total_paid_leaves) || 0;
        const remainingPaidLeaves = paidLeavesLimit - totalPaidLeavesTaken;

        paidLeaveInfo = {
          paid_leaves_limit: paidLeavesLimit,
          paid_leaves_taken: totalPaidLeavesTaken,
          paid_leaves_remaining: remainingPaidLeaves,
          days_requested: calculatedDays,
          month: `${requestStartMonth.getFullYear()}-${String(requestStartMonth.getMonth() + 1).padStart(2, '0')}`
        };

        // If remaining leaves are insufficient, automatically set as unpaid
        if (calculatedDays > remainingPaidLeaves) {
          finalIsPaid = false;
          console.log(`⚠️ Paid leave limit exceeded. Setting leave as UNPAID. Limit: ${paidLeavesLimit}, Taken: ${totalPaidLeavesTaken}, Remaining: ${remainingPaidLeaves}, Requested: ${calculatedDays}`);
        } else {
          console.log(`✅ Paid leave check passed. Limit: ${paidLeavesLimit}, Taken: ${totalPaidLeavesTaken}, Remaining: ${remainingPaidLeaves}, Requesting: ${calculatedDays}`);
        }
      }

      // Create leave request
      const requestId = uuidv4();
      const combinedReason = notes ? `${reason}\n\nAdmin Notes: ${notes}` : reason;

      await db.execute(`
        INSERT INTO leave_requests (
          id, employee_id, leave_type_id, start_date, end_date,
          leave_duration, start_time, end_time,
          days_requested, is_paid, reason, supporting_documents, status,
          applied_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
      `, [
        requestId, employee_id, leave_type_id, start_date, end_date,
        leave_duration, start_time, end_time,
        calculatedDays, finalIsPaid, combinedReason, supporting_documents
      ]);

      // Build response message
      let responseMessage = `Leave request created successfully for ${employee[0].first_name} ${employee[0].last_name}`;
      if (is_paid && !finalIsPaid) {
        responseMessage += `. Note: Leave marked as UNPAID due to monthly paid leave limit exceeded`;
      }

      const responseData = {
        id: requestId,
        employee_name: `${employee[0].first_name} ${employee[0].last_name}`,
        leave_type: leaveType[0].name,
        leave_duration,
        start_date,
        end_date,
        start_time,
        end_time,
        days_requested: calculatedDays,
        is_paid: finalIsPaid,
        was_auto_adjusted: is_paid && !finalIsPaid
      };

      // Add paid leave info if available
      if (paidLeaveInfo) {
        responseData.paid_leave_info = paidLeaveInfo;
      }

      res.status(201).json({
        success: true,
        message: responseMessage,
        warning: is_paid && !finalIsPaid ? 'This leave was automatically marked as unpaid because the employee has exceeded their monthly paid leave limit' : null,
        data: responseData
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
      // Get employees on leave today with duration info
      const [onLeaveToday] = await db.execute(`
        SELECT 
          e.id,
          CONCAT_WS(' ', e.first_name, e.last_name) AS name,
          e.employee_code,
          e.profile_image,
          lr.start_date,
          lr.end_date,
          COALESCE(lr.leave_duration, 'full_day') as leave_duration,
          lr.start_time,
          lr.end_time,
          lr.days_requested,
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
        ORDER BY lr.leave_duration, e.first_name
      `, [clientId, date, date]);

      // Get pending requests count
      const [pendingCount] = await db.execute(`
        SELECT COUNT(*) as count
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.client_id = ? AND lr.status = 'pending'
      `, [clientId]);

      // Get upcoming leaves (next 7 days)
      const [upcomingLeaves] = await db.execute(`
        SELECT 
          e.id,
          CONCAT(e.first_name, ' ', e.last_name) as name,
          e.employee_code,
          lr.start_date,
          lr.end_date,
          COALESCE(lr.leave_duration, 'full_day') as leave_duration,
          lr.days_requested,
          lt.name as leave_type,
          d.name as department
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.client_id = ?
        AND lr.status = 'approved'
        AND lr.start_date > ?
        AND lr.start_date <= DATE_ADD(?, INTERVAL 7 DAY)
        ORDER BY lr.start_date
        LIMIT 10
      `, [clientId, date, date]);

      // Get monthly statistics with duration breakdown
      const currentMonth = new Date(date).getMonth() + 1;
      const currentYear = new Date(date).getFullYear();
      
      const [monthlyStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
          SUM(CASE WHEN COALESCE(leave_duration, 'full_day') = 'full_day' THEN 1 ELSE 0 END) as full_day_count,
          SUM(CASE WHEN leave_duration = 'half_day' THEN 1 ELSE 0 END) as half_day_count,
          SUM(CASE WHEN leave_duration = 'short_leave' THEN 1 ELSE 0 END) as short_leave_count,
          SUM(days_requested) as total_days_requested
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.client_id = ?
        AND MONTH(lr.start_date) = ?
        AND YEAR(lr.start_date) = ?
      `, [clientId, currentMonth, currentYear]);

      // Format response
      const dashboard = {
        summary: {
          onLeaveCount: onLeaveToday.length,
          pendingRequestsCount: pendingCount[0].count,
          upcomingLeavesCount: upcomingLeaves.length,
          approvedThisMonthCount: monthlyStats[0]?.approved_count || 0,
          // New duration breakdown
          durationBreakdown: {
            fullDay: monthlyStats[0]?.full_day_count || 0,
            halfDay: monthlyStats[0]?.half_day_count || 0,
            shortLeave: monthlyStats[0]?.short_leave_count || 0
          }
        },
        onLeaveToday: onLeaveToday.map(leave => ({
          ...leave,
          // Format time for short leaves
          timeRange: leave.leave_duration === 'short_leave' && leave.start_time && leave.end_time
            ? `${leave.start_time.substring(0, 5)} - ${leave.end_time.substring(0, 5)}`
            : null
        })),
        upcomingLeaves,
        monthlyStats: monthlyStats[0] || {},
        date
      };

      res.json({
        success: true,
        data: dashboard
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