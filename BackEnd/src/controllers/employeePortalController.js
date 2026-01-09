const { getDB } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

/**
 * Get employee's own profile details
 * @route GET /api/employee-portal/profile
 */
const getMyProfile = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  const [employees] = await db.execute(`
    SELECT
      e.id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.email,
      e.phone,
      e.date_of_birth,
      e.gender,
      e.address,
      e.city,
      e.state,
      e.zip_code,
      e.nationality,
      e.marital_status,
      e.hire_date,
      e.employee_type,
      e.work_location,
      e.employment_status,
      e.base_salary,
      e.currency,
      e.in_time,
      e.out_time,
      e.follows_company_schedule,
      e.weekend_working_config,
      e.emergency_contact_name,
      e.emergency_contact_phone,
      e.emergency_contact_relation,
      e.profile_image,
      d.name as department_name,
      des.title as designation_title,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) as years_of_service
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN employees m ON e.manager_id = m.id
    WHERE e.id = ? AND e.client_id = ?
  `, [employeeId, req.user.clientId]);

  if (employees.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Employee profile not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      employee: employees[0]
    }
  });
});

/**
 * Get employee's own attendance records
 * @route GET /api/employee-portal/attendance
 */
const getMyAttendance = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  const { date_from, date_to, page = 1, limit = 30 } = req.query;
  const offset = (page - 1) * limit;

  let whereConditions = ['a.employee_id = ?'];
  let queryParams = [employeeId];

  if (date_from) {
    whereConditions.push('a.date >= ?');
    queryParams.push(date_from);
  }

  if (date_to) {
    whereConditions.push('a.date <= ?');
    queryParams.push(date_to);
  }

  const whereClause = whereConditions.join(' AND ');

  // Get total count
  const [countResult] = await db.execute(`
    SELECT COUNT(*) as total
    FROM attendance a
    WHERE ${whereClause}
  `, queryParams);

  const total = countResult[0].total;

  // Get attendance records
  const [attendanceRecords] = await db.execute(`
    SELECT
      a.id,
      a.date,
      a.check_in_time,
      a.check_out_time,
      a.total_hours,
      a.overtime_hours,
      a.status,
      a.arrival_status,
      a.is_weekend,
      a.work_type,
      a.scheduled_in_time,
      a.scheduled_out_time,
      a.payable_duration,
      a.notes,
      e.employee_code,
      CONCAT(e.first_name, ' ', e.last_name) as employee_name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE ${whereClause}
    ORDER BY a.date DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, parseInt(limit), offset]);

  // Get attendance summary
  const [summary] = await db.execute(`
    SELECT
      COUNT(*) as total_days,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
      SUM(CASE WHEN arrival_status = 'late' THEN 1 ELSE 0 END) as late_days,
      AVG(total_hours) as avg_hours,
      SUM(overtime_hours) as total_overtime_hours
    FROM attendance
    WHERE employee_id = ?
    ${date_from ? 'AND date >= ?' : ''}
    ${date_to ? 'AND date <= ?' : ''}
  `, [employeeId, ...(date_from ? [date_from] : []), ...(date_to ? [date_to] : [])]);

  res.status(200).json({
    success: true,
    data: {
      attendance: attendanceRecords,
      summary: summary[0],
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        recordsPerPage: parseInt(limit)
      }
    }
  });
});

/**
 * Get employee's payroll history
 * @route GET /api/employee-portal/payroll/history
 */
const getMyPayrollHistory = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  const { limit = 12, offset = 0 } = req.query;

  // Get payroll history with period information
  const [history] = await db.execute(`
    SELECT
      pr.id,
      pp.period_start_date as pay_period_start,
      pp.period_end_date as pay_period_end,
      pr.base_salary,
      pr.gross_salary,
      pr.total_deductions,
      pr.net_salary,
      pr.payment_status,
      pr.payment_method,
      pr.payment_date,
      pr.payment_reference,
      pr.created_at,
      pr.total_earnings as allowances,
      pr.overtime_hours as overtime_amount,
      0 as bonus
    FROM payroll_records pr
    JOIN payroll_runs prn ON pr.run_id = prn.id
    JOIN payroll_periods pp ON prn.period_id = pp.id
    WHERE pr.employee_id = ?
      AND pr.calculation_status IN ('calculated', 'error')
    ORDER BY pp.period_end_date DESC
    LIMIT ? OFFSET ?
  `, [employeeId, parseInt(limit), parseInt(offset)]);

  // Get total count
  const [countResult] = await db.execute(`
    SELECT COUNT(*) as total
    FROM payroll_records pr
    JOIN payroll_runs prn ON pr.run_id = prn.id
    WHERE pr.employee_id = ?
      AND pr.calculation_status IN ('calculated', 'error')
  `, [employeeId]);

  const total = countResult[0].total;

  // Get statistics
  const [stats] = await db.execute(`
    SELECT
      COUNT(*) as total_records,
      SUM(net_salary) as total_earned,
      AVG(net_salary) as average_salary,
      MAX(net_salary) as highest_salary,
      MIN(net_salary) as lowest_salary
    FROM payroll_records
    WHERE employee_id = ?
  `, [employeeId]);

  res.status(200).json({
    success: true,
    data: {
      history,
      statistics: stats[0],
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Get single payroll record with payslip details
 * @route GET /api/employee-portal/payroll/:id
 */
const getMyPayslip = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;
  const payrollId = req.params.id;

  const [payroll] = await db.execute(`
    SELECT
      pr.id,
      pr.employee_id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.email,
      e.phone,
      e.hire_date,
      e.employee_type,
      e.bank_account_number,
      e.bank_name,
      e.bank_branch,
      d.name as department_name,
      des.title as designation_title,
      pp.period_start_date as pay_period_start,
      pp.period_end_date as pay_period_end,
      pr.base_salary,
      pr.total_earnings as allowances,
      pr.overtime_hours as overtime_amount,
      0 as bonus,
      0 as commission,
      pr.gross_salary,
      pr.total_taxes as tax_deduction,
      0 as provident_fund,
      0 as insurance,
      0 as loan_deduction,
      0 as other_deductions,
      pr.total_deductions,
      pr.net_salary,
      pr.payment_status,
      pr.payment_method,
      pr.payment_date,
      pr.payment_reference,
      pr.notes,
      c.name as company_name,
      c.contact_email as company_email,
      c.phone as company_phone,
      c.address as company_address
    FROM payroll_records pr
    JOIN payroll_runs prn ON pr.run_id = prn.id
    JOIN payroll_periods pp ON prn.period_id = pp.id
    JOIN employees e ON pr.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN clients c ON e.client_id = c.id
    WHERE pr.id = ? AND pr.employee_id = ?
      AND pr.calculation_status IN ('calculated', 'error')
  `, [payrollId, employeeId]);

  if (payroll.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Payroll record not found'
    });
  }

  const record = payroll[0];

  res.status(200).json({
    success: true,
    data: {
      company: {
        name: record.company_name,
        address: record.company_address,
        phone: record.company_phone,
        email: record.company_email
      },
      employee: {
        id: record.employee_code,
        name: `${record.first_name} ${record.last_name}`,
        email: record.email,
        phone: record.phone,
        designation: record.designation_title,
        department: record.department_name,
        hire_date: record.hire_date,
        bank_account: record.bank_account_number,
        bank_name: record.bank_name
      },
      payroll: {
        id: record.id,
        period: {
          start: record.pay_period_start,
          end: record.pay_period_end
        },
        earnings: {
          basic_salary: parseFloat(record.base_salary || 0),
          allowances: parseFloat(record.allowances || 0),
          overtime: parseFloat(record.overtime_amount || 0),
          bonus: parseFloat(record.bonus || 0),
          commission: parseFloat(record.commission || 0),
          gross_total: parseFloat(record.gross_salary || 0)
        },
        deductions: {
          tax: parseFloat(record.tax_deduction || 0),
          provident_fund: parseFloat(record.provident_fund || 0),
          insurance: parseFloat(record.insurance || 0),
          loan: parseFloat(record.loan_deduction || 0),
          other: parseFloat(record.other_deductions || 0),
          total: parseFloat(record.total_deductions || 0)
        },
        net_salary: parseFloat(record.net_salary || 0),
        payment: {
          status: record.payment_status,
          method: record.payment_method,
          date: record.payment_date,
          reference: record.payment_reference
        }
      },
      generated_at: new Date().toISOString()
    }
  });
});

/**
 * Get employee's own leave requests
 * @route GET /api/employee-portal/leaves/my-requests
 */
const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  const { start_date, end_date, status, limit = 50, offset = 0 } = req.query;

  let whereConditions = ['lr.employee_id = ?'];
  let queryParams = [employeeId];

  if (start_date) {
    whereConditions.push('lr.start_date >= ?');
    queryParams.push(start_date);
  }

  if (end_date) {
    whereConditions.push('lr.end_date <= ?');
    queryParams.push(end_date);
  }

  if (status) {
    whereConditions.push('lr.status = ?');
    queryParams.push(status);
  }

  const whereClause = whereConditions.join(' AND ');

  const [leaveRequests] = await db.execute(`
    SELECT
      lr.id,
      lr.leave_type_id,
      lt.name as leave_type_name,
      lr.start_date,
      lr.end_date,
      lr.leave_duration,
      lr.start_time,
      lr.end_time,
      lr.days_requested as number_of_days,
      lr.reason,
      lr.status,
      lr.applied_at as applied_date,
      lr.reviewed_at as approved_date,
      lr.reviewer_comments as rejection_reason,
      lr.supporting_documents,
      lt.is_paid,
      CONCAT(reviewer.name) as approved_by_name
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    LEFT JOIN admin_users reviewer ON lr.reviewed_by = reviewer.id
    WHERE ${whereClause}
    ORDER BY lr.applied_at DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, parseInt(limit), parseInt(offset)]);

  res.status(200).json({
    success: true,
    data: {
      requests: leaveRequests
    }
  });
});

/**
 * Apply for leave
 * @route POST /api/employee-portal/leaves/apply
 */
const applyForLeave = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  const {
    leave_type_id,
    start_date,
    end_date,
    leave_duration = 'full_day',
    start_time,
    end_time,
    reason,
    notes,
    supporting_documents
  } = req.body;

  // Validation
  if (!leave_type_id || !start_date || !end_date || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: leave_type_id, start_date, end_date, reason'
    });
  }

  if (reason.length < 10 || reason.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Reason must be between 10 and 500 characters'
    });
  }

  if (leave_duration === 'short_leave' && (!start_time || !end_time)) {
    return res.status(400).json({
      success: false,
      message: 'start_time and end_time are required for short leave'
    });
  }

  // Get leave type details
  const [leaveTypes] = await db.execute(`
    SELECT * FROM leave_types WHERE id = ? AND client_id = ? AND is_active = TRUE
  `, [leave_type_id, req.user.clientId]);

  if (leaveTypes.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Leave type not found or inactive'
    });
  }

  const leaveType = leaveTypes[0];

  // Calculate days requested
  let days_requested = 0;
  if (leave_duration === 'full_day') {
    const start = new Date(start_date);
    const end = new Date(end_date);
    days_requested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  } else if (leave_duration === 'half_day') {
    days_requested = 0.5;
  } else if (leave_duration === 'short_leave') {
    // Calculate hours
    const startTimeObj = new Date(`2000-01-01 ${start_time}`);
    const endTimeObj = new Date(`2000-01-01 ${end_time}`);
    const hours = (endTimeObj - startTimeObj) / (1000 * 60 * 60);
    days_requested = hours / 8; // Assuming 8-hour workday
  }

  // Check if employee has already taken maximum days
  const [leaveTaken] = await db.execute(`
    SELECT SUM(days_requested) as total_days
    FROM leave_requests
    WHERE employee_id = ?
      AND leave_type_id = ?
      AND status = 'approved'
      AND YEAR(start_date) = YEAR(?)
  `, [employeeId, leave_type_id, start_date]);

  const totalDaysTaken = parseFloat(leaveTaken[0].total_days || 0);

  if (leaveType.max_days_per_year && (totalDaysTaken + days_requested) > leaveType.max_days_per_year) {
    return res.status(400).json({
      success: false,
      message: `You have exceeded the maximum allowed days (${leaveType.max_days_per_year}) for this leave type this year. Days taken: ${totalDaysTaken}`
    });
  }

  // Check consecutive days limit
  if (leaveType.max_consecutive_days && days_requested > leaveType.max_consecutive_days) {
    return res.status(400).json({
      success: false,
      message: `Maximum consecutive days allowed: ${leaveType.max_consecutive_days}`
    });
  }

  // Check notice period
  if (leaveType.notice_period_days) {
    const noticeDate = new Date();
    noticeDate.setDate(noticeDate.getDate() + leaveType.notice_period_days);
    const requestedStartDate = new Date(start_date);

    if (requestedStartDate < noticeDate) {
      return res.status(400).json({
        success: false,
        message: `This leave type requires ${leaveType.notice_period_days} days notice`
      });
    }
  }

  // Get employee details
  const [employees] = await db.execute(`
    SELECT first_name, last_name FROM employees WHERE id = ?
  `, [employeeId]);

  const employee = employees[0];

  // Create leave request
  const leaveRequestId = require('uuid').v4();
  await db.execute(`
    INSERT INTO leave_requests (
      id, employee_id, leave_type_id, start_date, end_date,
      leave_duration, start_time, end_time, days_requested,
      reason, status, applied_at, supporting_documents
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?)
  `, [
    leaveRequestId, employeeId, leave_type_id, start_date, end_date,
    leave_duration, start_time || null, end_time || null, days_requested,
    reason, supporting_documents || null
  ]);

  res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: {
      id: leaveRequestId,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      leave_type: leaveType.name,
      leave_duration,
      start_date,
      end_date,
      days_requested,
      is_paid: leaveType.is_paid,
      status: 'pending'
    }
  });
});

/**
 * Get leave types available
 * @route GET /api/employee-portal/leaves/types
 */
const getLeaveTypes = asyncHandler(async (req, res) => {
  const db = getDB();

  const [leaveTypes] = await db.execute(`
    SELECT
      id,
      name,
      description,
      max_days_per_year,
      max_consecutive_days,
      is_paid,
      requires_approval,
      notice_period_days
    FROM leave_types
    WHERE client_id = ? AND is_active = TRUE
    ORDER BY name
  `, [req.user.clientId]);

  res.status(200).json({
    success: true,
    data: {
      leaveTypes: leaveTypes
    }
  });
});

/**
 * Get leave balance for employee
 * @route GET /api/employee-portal/leaves/balance
 */
const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;
  const currentYear = new Date().getFullYear();

  // Get all leave types
  const [leaveTypes] = await db.execute(`
    SELECT id, name, max_days_per_year, is_paid
    FROM leave_types
    WHERE client_id = ? AND is_active = TRUE
  `, [req.user.clientId]);

  // Get leave taken for each type
  const balances = [];
  for (const leaveType of leaveTypes) {
    const [taken] = await db.execute(`
      SELECT SUM(days_requested) as days_taken
      FROM leave_requests
      WHERE employee_id = ?
        AND leave_type_id = ?
        AND status = 'approved'
        AND YEAR(start_date) = ?
    `, [employeeId, leaveType.id, currentYear]);

    const daysTaken = parseFloat(taken[0].days_taken || 0);
    const maxDays = parseFloat(leaveType.max_days_per_year || 0);

    balances.push({
      leave_type_id: leaveType.id,
      leave_type_name: leaveType.name,
      is_paid: leaveType.is_paid,
      total_allocated: maxDays,
      used: daysTaken,
      remaining: maxDays - daysTaken
    });
  }

  res.status(200).json({
    success: true,
    data: {
      year: currentYear,
      balance: balances
    }
  });
});

/**
 * Get employee's financial records (loans, advances, bonuses) - READ ONLY
 * @route GET /api/employee-portal/financial-records
 */
const getMyFinancialRecords = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  // Get loans
  const [loans] = await db.execute(`
    SELECT
      id,
      loan_type,
      loan_amount,
      interest_rate,
      tenure_months,
      monthly_deduction,
      total_paid,
      remaining_amount,
      start_date,
      end_date,
      status,
      notes,
      created_at
    FROM employee_loans
    WHERE employee_id = ?
    ORDER BY created_at DESC
  `, [employeeId]);

  // Get advances
  const [advances] = await db.execute(`
    SELECT
      id,
      advance_type,
      advance_amount as amount,
      description as reason,
      deduction_months,
      monthly_deduction as deduction_per_month,
      remaining_amount,
      request_date as date,
      deduction_start_date,
      status,
      justification,
      notes,
      created_at
    FROM employee_advances
    WHERE employee_id = ?
    ORDER BY created_at DESC
  `, [employeeId]);

  // Get bonuses
  const [bonuses] = await db.execute(`
    SELECT
      id,
      bonus_type,
      bonus_amount as amount,
      description as reason,
      bonus_period,
      effective_date as date,
      payment_date,
      payment_method,
      status,
      notes,
      created_at
    FROM employee_bonuses
    WHERE employee_id = ?
    ORDER BY created_at DESC
  `, [employeeId]);

  res.status(200).json({
    success: true,
    data: {
      loans: loans,
      advances: advances,
      bonuses: bonuses
    }
  });
});

/**
 * Get employee's live payroll preview for all payroll runs
 * @route GET /api/employee-portal/payroll/live-preview
 */
const getMyLivePayrollPreview = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;

  // Get all payroll runs with this employee's records
  const [payrollRuns] = await db.execute(`
    SELECT DISTINCT
      prn.id as run_id,
      prn.run_number,
      prn.run_name,
      prn.run_status,
      pp.period_start_date,
      pp.period_end_date,
      pp.period_type,
      prn.created_at
    FROM payroll_runs prn
    JOIN payroll_periods pp ON prn.period_id = pp.id
    JOIN payroll_records pr ON pr.run_id = prn.id
    WHERE pr.employee_id = ?
    ORDER BY pp.period_start_date DESC
  `, [employeeId]);

  res.status(200).json({
    success: true,
    data: {
      payrollRuns: payrollRuns
    }
  });
});

/**
 * Get employee's live payroll details for a specific run
 * @route GET /api/employee-portal/payroll/live-preview/:runId
 * This calculates payroll in real-time based on current data
 */
const getMyLivePayrollDetails = asyncHandler(async (req, res) => {
  const db = getDB();
  const employeeId = req.employeeId;
  const runId = req.params.runId;

  // Use the PayrollRunService to get live calculated data (it's exported as a singleton)
  const payrollService = require('../services/PayrollRunService');

  // First, verify this employee is part of this payroll run and get client_id from payroll_runs
  const [recordCheck] = await db.execute(`
    SELECT pr.id, prn.client_id
    FROM payroll_records pr
    JOIN payroll_runs prn ON pr.run_id = prn.id
    WHERE pr.employee_id = ? AND pr.run_id = ?
  `, [employeeId, runId]);

  if (recordCheck.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'You are not part of this payroll run'
    });
  }

  const clientId = recordCheck[0].client_id;

  try {
    // Get full live payroll data for the run (this includes ALL employees)
    const liveData = await payrollService.getLivePayrollData(runId, clientId);

    // Filter to only this employee's data
    const myEmployeeData = liveData.employees.find(emp => emp.employee_id === employeeId);

    if (!myEmployeeData) {
      return res.status(404).json({
        success: false,
        message: 'Your payroll data could not be calculated'
      });
    }

    // Calculate earnings and deductions from the live data
    const earnings = [];
    const deductions = [];

    // Base Salary
    const earnedSalary = myEmployeeData.attendance?.earned_salary || 0;
    earnings.push({
      component_name: 'Base Salary (Earned)',
      component_type: 'earning',
      amount: earnedSalary,
      calculation_method: 'attendance-based'
    });

    // Allowances
    (myEmployeeData.allowances || []).forEach(allowance => {
      const allowanceAmount = allowance.is_percentage
        ? (earnedSalary * parseFloat(allowance.amount)) / 100
        : parseFloat(allowance.amount);

      earnings.push({
        component_name: allowance.allowance_name,
        component_type: 'earning',
        amount: allowanceAmount,
        calculation_method: allowance.is_percentage ? 'percentage' : 'fixed',
        is_taxable: allowance.is_taxable
      });
    });

    // Bonuses
    (myEmployeeData.financial?.bonusRecords || []).forEach(bonus => {
      earnings.push({
        component_name: `${bonus.bonus_type} Bonus`,
        component_type: 'earning',
        amount: parseFloat(bonus.bonus_amount || bonus.addition_amount),
        calculation_method: 'financial'
      });
    });

    // Calculate gross salary
    const grossSalary = earnings.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    // Deductions
    (myEmployeeData.deductions || []).forEach(deduction => {
      const deductionAmount = deduction.calculation_type === 'percentage'
        ? (grossSalary * parseFloat(deduction.calculation_value)) / 100
        : parseFloat(deduction.calculation_value);

      deductions.push({
        component_name: deduction.component_name,
        component_type: 'deduction',
        amount: deductionAmount,
        calculation_method: deduction.calculation_type
      });
    });

    // Loan Deductions
    (myEmployeeData.financial?.loanRecords || []).forEach(loan => {
      deductions.push({
        component_name: `${loan.loan_type} Loan Deduction`,
        component_type: 'deduction',
        amount: parseFloat(loan.deduction_amount || loan.monthly_deduction),
        calculation_method: 'financial'
      });
    });

    // Advance Deductions
    (myEmployeeData.financial?.advanceRecords || []).forEach(advance => {
      deductions.push({
        component_name: `${advance.advance_type} Advance Deduction`,
        component_type: 'deduction',
        amount: parseFloat(advance.deduction_amount || advance.monthly_deduction),
        calculation_method: 'financial'
      });
    });

    // Calculate net salary
    const totalDeductions = deductions.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const netSalary = grossSalary - totalDeductions;

    // Calculate work summary from attendance data
    const attendanceData = myEmployeeData.attendance || {};
    const earningsBySource = attendanceData.earnings_by_source || {};

    // Calculate total worked hours (attendance + paid leaves)
    const attendanceHours = earningsBySource.attendance?.hours || 0;
    const paidLeaveHours = earningsBySource.paid_leaves?.hours || 0;
    const workedHours = attendanceHours + paidLeaveHours;

    // Calculate worked days (approximate from hours, assuming 8 hours per day)
    const workedDays = workedHours > 0 ? (workedHours / 8).toFixed(1) : 0;

    // Get overtime hours from overtime records
    const overtimeRecords = myEmployeeData.overtime?.records || [];
    const overtimeHours = overtimeRecords.reduce((sum, ot) => sum + (parseFloat(ot.overtime_hours) || 0), 0);

    // Calculate leave days from paid leave hours
    const leaveDays = paidLeaveHours > 0 ? (paidLeaveHours / 8).toFixed(1) : 0;

    // Build comprehensive record object
    const record = {
      employee_code: myEmployeeData.employee_code,
      employee_name: myEmployeeData.employee_name,
      department_name: myEmployeeData.department_name,
      designation_name: myEmployeeData.designation_name,
      period_start_date: liveData.period.start_date,
      period_end_date: liveData.period.end_date,
      pay_date: liveData.period.pay_date,
      run_name: liveData.run.name,
      run_number: liveData.run.number,

      // Work summary
      worked_days: workedDays,
      worked_hours: workedHours.toFixed(2),
      overtime_hours: overtimeHours.toFixed(2),
      leave_days: leaveDays,

      // Salary breakdown
      base_salary: myEmployeeData.base_salary,
      earned_salary: earnedSalary,
      expected_salary: myEmployeeData.attendance?.expected_salary || 0,
      gross_salary: grossSalary,
      total_deductions: totalDeductions,
      net_salary: netSalary,

      // Status
      status: 'live_preview',

      // Additional info
      calculation_date: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: {
        record: record,
        earnings: earnings,
        deductions: deductions,
        attendance_details: myEmployeeData.attendance
      }
    });

  } catch (error) {
    console.error('Error calculating live payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate live payroll data',
      error: error.message
    });
  }
});

module.exports = {
  getMyProfile,
  getMyAttendance,
  getMyPayrollHistory,
  getMyPayslip,
  getMyLeaveRequests,
  applyForLeave,
  getLeaveTypes,
  getMyLeaveBalance,
  getMyFinancialRecords,
  getMyLivePayrollPreview,
  getMyLivePayrollDetails
};
