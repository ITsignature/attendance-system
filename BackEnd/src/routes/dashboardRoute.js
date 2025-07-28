const express = require('express');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// GET DASHBOARD OVERVIEW
// =============================================
router.get('/overview', 
  checkPermission('dashboard.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;

    // Get basic statistics
    const [employeeStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN employment_status = 'active' THEN 1 END) as active_employees,
        COUNT(CASE WHEN employment_status = 'inactive' THEN 1 END) as inactive_employees,
        COUNT(CASE WHEN employee_type = 'permanent' THEN 1 END) as permanent_employees,
        COUNT(CASE WHEN employee_type = 'contract' THEN 1 END) as contract_employees,
        COUNT(CASE WHEN work_location = 'remote' THEN 1 END) as remote_employees
      FROM employees
      WHERE client_id = ?
    `, [clientId]);

    // Get today's attendance
    const [todayAttendance] = await db.execute(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_today,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_today,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_today,
        COUNT(CASE WHEN a.status = 'on_leave' THEN 1 END) as on_leave_today
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.client_id = ? AND a.date = CURDATE()
    `, [clientId]);

    // Get leave requests
    const [leaveStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_requests
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.client_id = ?
      AND lr.applied_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [clientId]);

    // Get payroll stats for current month
    const [payrollStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN pr.payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN pr.payment_status = 'paid' THEN 1 END) as completed_payments,
        SUM(CASE WHEN pr.payment_status = 'paid' THEN pr.net_salary ELSE 0 END) as total_paid_amount
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE e.client_id = ?
      AND pr.pay_period_start >= DATE_FORMAT(NOW(), '%Y-%m-01')
    `, [clientId]);

    // Get departments count
    const [departmentStats] = await db.execute(`
      SELECT COUNT(*) as total_departments
      FROM departments
      WHERE client_id = ? AND is_active = TRUE
    `, [clientId]);

    res.status(200).json({
      success: true,
      data: {
        employees: employeeStats[0],
        attendance: todayAttendance[0],
        leaves: leaveStats[0],
        payroll: payrollStats[0],
        departments: departmentStats[0]
      }
    });
  })
);

// =============================================
// GET ATTENDANCE OVERVIEW FOR CURRENT WEEK
// =============================================
router.get('/attendance-overview', 
  checkPermission('attendance.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;

    // Get attendance data for current week
    const [weeklyAttendance] = await db.execute(`
      SELECT 
        DAYNAME(a.date) as day_name,
        DATE(a.date) as date,
        COUNT(*) as total_records,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'on_leave' THEN 1 END) as on_leave_count,
        ROUND(
          (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as attendance_percentage
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.client_id = ?
      AND a.date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND a.date <= DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)
      GROUP BY a.date, DAYNAME(a.date)
      ORDER BY a.date
    `, [clientId]);

    res.status(200).json({
      success: true,
      data: {
        weeklyAttendance
      }
    });
  })
);

// =============================================
// GET EMPLOYEE DISTRIBUTION BY DEPARTMENT
// =============================================
router.get('/employee-distribution', 
  checkPermission('employees.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;

    const [distribution] = await db.execute(`
      SELECT 
        COALESCE(d.name, 'Unassigned') as department_name,
        COUNT(e.id) as employee_count,
        COUNT(CASE WHEN e.employment_status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN e.work_location = 'remote' THEN 1 END) as remote_count
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.client_id = ?
      GROUP BY d.id, d.name
      ORDER BY employee_count DESC
    `, [clientId]);

    res.status(200).json({
      success: true,
      data: {
        distribution
      }
    });
  })
);

// =============================================
// GET RECENT ACTIVITIES
// =============================================
router.get('/recent-activities', 
  checkPermission('dashboard.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    const limit = req.query.limit || 10;

    // Get recent leave requests
    const [recentLeaves] = await db.execute(`
      SELECT 
        'leave_request' as type,
        lr.id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        lr.start_date,
        lr.end_date,
        lr.status,
        lr.applied_at as created_at
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.client_id = ?
      ORDER BY lr.applied_at DESC
      LIMIT ?
    `, [clientId, parseInt(limit)]);

    // Get recent employee additions
    const [recentEmployees] = await db.execute(`
      SELECT 
        'new_employee' as type,
        e.id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.hire_date,
        e.created_at
      FROM employees e
      WHERE e.client_id = ?
      AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY e.created_at DESC
      LIMIT ?
    `, [clientId, parseInt(limit)]);

    // Combine and sort activities
    const activities = [
      ...recentLeaves.map(item => ({
        ...item,
        description: `${item.employee_name} applied for leave from ${item.start_date} to ${item.end_date}`,
        timestamp: item.created_at
      })),
      ...recentEmployees.map(item => ({
        ...item,
        description: `${item.employee_name} joined the company`,
        timestamp: item.created_at
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        activities
      }
    });
  })
);

// =============================================
// GET MONTHLY ATTENDANCE TRENDS
// =============================================
router.get('/attendance-trends', 
  checkPermission('attendance.reports'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    const months = req.query.months || 6;

    const [trends] = await db.execute(`
      SELECT 
        DATE_FORMAT(a.date, '%Y-%m') as month,
        COUNT(*) as total_records,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        ROUND(AVG(a.total_hours), 2) as avg_hours_per_day,
        ROUND(
          (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as attendance_percentage
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.client_id = ?
      AND a.date >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(a.date, '%Y-%m')
      ORDER BY month DESC
    `, [clientId, parseInt(months)]);

    res.status(200).json({
      success: true,
      data: {
        trends
      }
    });
  })
);

module.exports = router;
