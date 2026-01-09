const { getDB } = require('../config/database');

/**
 * Middleware to ensure employee can only access their own data
 * This middleware should be used after authenticate() middleware
 */
const ensureOwnEmployeeAccess = async (req, res, next) => {
  try {
    const db = getDB();

    // Super admin can access any employee data
    if (req.user?.isSuperAdmin) {
      return next();
    }

    // Get the employee_id linked to this admin user
    const [adminUser] = await db.execute(`
      SELECT employee_id
      FROM admin_users
      WHERE id = ?
    `, [req.user.userId]);

    if (adminUser.length === 0 || !adminUser[0].employee_id) {
      return res.status(403).json({
        success: false,
        message: 'No employee profile linked to this account'
      });
    }

    const employeeId = adminUser[0].employee_id;

    // Check if the requested employee ID matches the user's employee ID
    const requestedEmployeeId = req.params.id || req.params.employeeId || req.body.employee_id;

    if (requestedEmployeeId && requestedEmployeeId !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own employee data.'
      });
    }

    // Attach employee ID to request for use in controllers
    req.employeeId = employeeId;
    next();
  } catch (error) {
    console.error('Employee access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking employee access'
    });
  }
};

/**
 * Middleware to restrict access to employee role only
 * Prevents admin users from accessing employee-only endpoints
 */
const requireEmployeeRole = (req, res, next) => {
  // Check if user has employee role (not admin or super admin)
  if (req.user?.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is for employees only'
    });
  }

  // Check if user's role is employee role (you can customize this check)
  if (req.user?.roleName?.toLowerCase() !== 'employee') {
    return res.status(403).json({
      success: false,
      message: 'Employee role required. This interface is for employees only.',
      currentRole: req.user?.roleName
    });
  }

  next();
};

/**
 * Middleware to ensure employee can only view (read-only access)
 * Blocks any write operations (POST, PUT, PATCH, DELETE)
 */
const enforceReadOnly = (req, res, next) => {
  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (writeMethod && !req.user?.isSuperAdmin) {
    // Allow only specific POST endpoints (like leave application)
    const allowedPostPaths = [
      '/api/employee-portal/leaves/apply',
      '/api/employee-portal/leaves/request'
    ];

    const isAllowedPost = req.method === 'POST' && allowedPostPaths.some(path => req.path.includes(path));

    if (!isAllowedPost) {
      return res.status(403).json({
        success: false,
        message: 'Read-only access. You cannot modify this data.'
      });
    }
  }

  next();
};

/**
 * Middleware to ensure employee can only access their own attendance records
 */
const ensureOwnAttendance = async (req, res, next) => {
  try {
    const db = getDB();

    // Super admin can access any attendance
    if (req.user?.isSuperAdmin) {
      return next();
    }

    // Get the employee_id linked to this admin user
    const [adminUser] = await db.execute(`
      SELECT employee_id
      FROM admin_users
      WHERE id = ?
    `, [req.user.userId]);

    if (adminUser.length === 0 || !adminUser[0].employee_id) {
      return res.status(403).json({
        success: false,
        message: 'No employee profile linked to this account'
      });
    }

    const employeeId = adminUser[0].employee_id;

    // If there's a specific attendance record ID, verify it belongs to this employee
    if (req.params.id) {
      const [attendance] = await db.execute(`
        SELECT employee_id
        FROM attendance
        WHERE id = ?
      `, [req.params.id]);

      if (attendance.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      if (attendance[0].employee_id !== employeeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This attendance record does not belong to you.'
        });
      }
    }

    // For list queries, restrict to only this employee's records
    req.employeeId = employeeId;
    req.query.employee_id = employeeId; // Force filter by this employee

    next();
  } catch (error) {
    console.error('Attendance access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking attendance access'
    });
  }
};

/**
 * Middleware to ensure employee can only access their own payroll records
 */
const ensureOwnPayroll = async (req, res, next) => {
  try {
    const db = getDB();

    // Super admin can access any payroll
    if (req.user?.isSuperAdmin) {
      return next();
    }

    // Get the employee_id linked to this admin user
    const [adminUser] = await db.execute(`
      SELECT employee_id
      FROM admin_users
      WHERE id = ?
    `, [req.user.userId]);

    if (adminUser.length === 0 || !adminUser[0].employee_id) {
      return res.status(403).json({
        success: false,
        message: 'No employee profile linked to this account'
      });
    }

    const employeeId = adminUser[0].employee_id;

    // If there's a specific payroll record ID, verify it belongs to this employee
    if (req.params.id) {
      const [payroll] = await db.execute(`
        SELECT employee_id
        FROM payroll_records
        WHERE id = ?
      `, [req.params.id]);

      if (payroll.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }

      if (payroll[0].employee_id !== employeeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This payroll record does not belong to you.'
        });
      }
    }

    // For list queries or history, restrict to only this employee's records
    req.employeeId = employeeId;

    next();
  } catch (error) {
    console.error('Payroll access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking payroll access'
    });
  }
};

/**
 * Middleware to ensure employee can only access their own leave requests
 */
const ensureOwnLeaves = async (req, res, next) => {
  try {
    const db = getDB();

    // Super admin can access any leave request
    if (req.user?.isSuperAdmin) {
      return next();
    }

    // Get the employee_id linked to this admin user
    const [adminUser] = await db.execute(`
      SELECT employee_id
      FROM admin_users
      WHERE id = ?
    `, [req.user.userId]);

    if (adminUser.length === 0 || !adminUser[0].employee_id) {
      return res.status(403).json({
        success: false,
        message: 'No employee profile linked to this account'
      });
    }

    const employeeId = adminUser[0].employee_id;

    // If there's a specific leave request ID, verify it belongs to this employee
    if (req.params.id) {
      const [leave] = await db.execute(`
        SELECT employee_id
        FROM leave_requests
        WHERE id = ?
      `, [req.params.id]);

      if (leave.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Leave request not found'
        });
      }

      if (leave[0].employee_id !== employeeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This leave request does not belong to you.'
        });
      }
    }

    // For list queries and new leave requests, restrict to only this employee
    req.employeeId = employeeId;
    req.body.employee_id = employeeId; // Force employee_id in body for new requests

    next();
  } catch (error) {
    console.error('Leave access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking leave access'
    });
  }
};

/**
 * Middleware to ensure employee can only access their own financial records
 */
const ensureOwnFinancialRecords = async (req, res, next) => {
  try {
    const db = getDB();

    // Super admin can access any financial records
    if (req.user?.isSuperAdmin) {
      return next();
    }

    // Get the employee_id linked to this admin user
    const [adminUser] = await db.execute(`
      SELECT employee_id
      FROM admin_users
      WHERE id = ?
    `, [req.user.userId]);

    if (adminUser.length === 0 || !adminUser[0].employee_id) {
      return res.status(403).json({
        success: false,
        message: 'No employee profile linked to this account'
      });
    }

    const employeeId = adminUser[0].employee_id;
    const requestedEmployeeId = req.params.employee_id;

    // Ensure employee can only access their own financial records
    if (requestedEmployeeId && requestedEmployeeId !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own financial records.'
      });
    }

    req.employeeId = employeeId;
    next();
  } catch (error) {
    console.error('Financial records access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking financial records access'
    });
  }
};

module.exports = {
  ensureOwnEmployeeAccess,
  requireEmployeeRole,
  enforceReadOnly,
  ensureOwnAttendance,
  ensureOwnPayroll,
  ensureOwnLeaves,
  ensureOwnFinancialRecords
};
