// payrollRoute.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { v4: uuidv4 } = require('uuid');
const HolidayService = require('../services/HolidayService');
const SettingsHelper = require('../utils/settingsHelper');

// Apply authentication and client access to all routes
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// VALIDATION HELPERS
// =============================================

const validatePayrollRecord = [
  body('employee_id').isUUID().withMessage('Valid employee ID is required'),
  body('pay_period_start').isISO8601().withMessage('Valid pay period start date is required'),
  body('pay_period_end').isISO8601().withMessage('Valid pay period end date is required'),
  body('base_salary').isFloat({ min: 0 }).withMessage('Base salary must be a positive number'),
  body('allowances').optional().isFloat({ min: 0 }).withMessage('Allowances must be a positive number'),
  body('overtime_amount').optional().isFloat({ min: 0 }).withMessage('Overtime must be a positive number'),
  body('bonus').optional().isFloat({ min: 0 }).withMessage('Bonus must be a positive number'),
  body('tax_deduction').optional().isFloat({ min: 0 }).withMessage('Tax deduction must be a positive number'),
  body('provident_fund').optional().isFloat({ min: 0 }).withMessage('Provident fund must be a positive number'),
  body('insurance').optional().isFloat({ min: 0 }).withMessage('Insurance must be a positive number'),
  body('other_deductions').optional().isFloat({ min: 0 }).withMessage('Other deductions must be a positive number'),
  body('payment_method').optional().isIn(['bank_transfer', 'cash', 'cheque']).withMessage('Invalid payment method'),
  body('payment_date').optional().isISO8601().withMessage('Valid payment date is required'),
];

const validateBulkProcess = [
  body('pay_period_start').isISO8601().withMessage('Valid pay period start date is required'),
  body('pay_period_end').isISO8601().withMessage('Valid pay period end date is required'),
  body('department_id').optional().isUUID().withMessage('Valid department ID is required'),
  body('employee_ids').optional().isArray().withMessage('Employee IDs must be an array'),
  body('employee_ids.*').optional().isUUID().withMessage('Each employee ID must be valid'),
];

// =============================================
// HELPER FUNCTIONS
// =============================================

// Calculate gross salary
const calculateGrossSalary = (baseSalary, allowances = 0, overtime = 0, bonus = 0, commission = 0) => {
  return parseFloat(baseSalary) + parseFloat(allowances) + parseFloat(overtime) + parseFloat(bonus) + parseFloat(commission);
};

// Calculate total deductions
const calculateTotalDeductions = (taxDeduction = 0, providentFund = 0, insurance = 0, loanDeduction = 0, otherDeductions = 0) => {
  return parseFloat(taxDeduction) + parseFloat(providentFund) + parseFloat(insurance) + parseFloat(loanDeduction) + parseFloat(otherDeductions);
};

// Calculate net salary
const calculateNetSalary = (grossSalary, totalDeductions) => {
  return parseFloat(grossSalary) - parseFloat(totalDeductions);
};

// Get employee salary details
const getEmployeeSalaryDetails = async (employeeId, clientId, db) => {
  const [employee] = await db.execute(`
    SELECT 
      e.id,
      e.first_name,
      e.last_name,
      e.email,
      e.employee_code,
      e.department_id,
      e.designation_id,
      e.base_salary,
      e.employment_status,
      d.name as department_name,
      des.title as designation_title
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    WHERE e.id = ? AND e.client_id = ? AND e.employment_status = 'active'
  `, [employeeId, clientId]);

  return employee[0] || null;
};

// Calculate overtime from attendance records
const calculateOvertimeFromAttendance = async (employeeId, startDate, endDate, db) => {
  const [overtimeRecords] = await db.execute(`
    SELECT 
      SUM(overtime_hours) as total_overtime_hours,
      COUNT(DISTINCT date) as days_worked
    FROM attendance
    WHERE employee_id = ? 
      AND date BETWEEN ? AND ?
      AND status = 'present'
  `, [employeeId, startDate, endDate]);

  return {
    totalOvertimeHours: overtimeRecords[0]?.total_overtime_hours || 0,
    daysWorked: overtimeRecords[0]?.days_worked || 0
  };
};

/**
 * Calculate overtime amount using PROPER DYNAMIC METHODS (NO HARDCODING)
 * This method replicates the sophisticated logic from PayrollRunService
 */
const calculateDynamicOvertimeAmount = async (employeeId, baseSalary, totalOvertimeHours, startDate, endDate, clientId, db) => {
  try {
    console.log(`🔧 DYNAMIC OVERTIME CALCULATION for employee ${employeeId}`);
    
    // 1. Get employee-specific daily hours (NOT HARDCODED 8 hours!)
    const employeeDailyHours = await getEmployeeDailyHours(employeeId, clientId, db);
    
    // 2. Get actual working days in period (NOT HARDCODED 22 days!)
    const workingDaysInPeriod = await HolidayService.calculateWorkingDays(
      clientId, 
      startDate, 
      endDate
    );
    
    // 3. Calculate proper hourly rate using ACTUAL values
    const hourlyRate = baseSalary / (workingDaysInPeriod.working_days * employeeDailyHours);
    
    console.log(`📊 CALCULATION BREAKDOWN:`);
    console.log(`   Base Salary: ${baseSalary}`);
    console.log(`   Working Days: ${workingDaysInPeriod.working_days} (excluding holidays)`);
    console.log(`   Employee Daily Hours: ${employeeDailyHours}h`);
    console.log(`   Hourly Rate: ${hourlyRate.toFixed(2)}`);
    console.log(`   Total Overtime Hours: ${totalOvertimeHours}h`);
    
    // 4. Get overtime multipliers from settings (NOT HARDCODED 1.5x!)
    const overtimeMultipliers = await getOvertimeMultipliers(clientId);
    
    // 5. Calculate overtime amount with proper multiplier
    // For now using regular multiplier - could be enhanced to check specific dates for holidays/weekends
    const overtimeAmount = totalOvertimeHours * hourlyRate * overtimeMultipliers.regular;
    
    console.log(`   Overtime Multiplier: ${overtimeMultipliers.regular}x`);
    console.log(`   Final Overtime Amount: ${overtimeAmount.toFixed(2)}`);
    console.log(`🔧 DYNAMIC CALCULATION COMPLETE\n`);
    
    return Math.round(overtimeAmount * 100) / 100; // Round to 2 decimal places
    
  } catch (error) {
    console.error('Error in dynamic overtime calculation:', error);
    // Fallback to prevent system failure - but log the issue
    console.warn('⚠️  FALLING BACK TO BASIC CALCULATION DUE TO ERROR');
    const settingsHelper = new SettingsHelper(clientId);
    const basicRate = await settingsHelper.getSetting('overtime_rate_multiplier') || 1.5;
    const basicHourlyRate = baseSalary / (22 * 8); // Only as emergency fallback
    return totalOvertimeHours * basicHourlyRate * basicRate;
  }
};

/**
 * Get employee-specific daily working hours
 * Checks if employee follows company schedule or has custom hours
 */
const getEmployeeDailyHours = async (employeeId, clientId, db) => {
  try {
    // Get employee schedule info
    const [employee] = await db.execute(`
      SELECT in_time, out_time, follows_company_schedule 
      FROM employees WHERE id = ? AND client_id = ?
    `, [employeeId, clientId]);
    
    if (!employee[0]) {
      throw new Error('Employee not found');
    }
    
    const emp = employee[0];
    
    // If employee follows company schedule, get from settings
    if (emp.follows_company_schedule || !emp.in_time || !emp.out_time) {
      const settingsHelper = new SettingsHelper(clientId);
      const workingHoursPerDay = await settingsHelper.getSetting('working_hours_per_day') || 8;
      console.log(`   Using company schedule: ${workingHoursPerDay} hours/day`);
      return workingHoursPerDay;
    }
    
    // Calculate from employee's custom schedule
    const inTime = new Date(`2000-01-01 ${emp.in_time}`);
    const outTime = new Date(`2000-01-01 ${emp.out_time}`);
    
    if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) {
      console.warn(`Invalid time format for employee ${employeeId}, using default`);
      return 8; // Fallback
    }
    
    const diffMs = outTime.getTime() - inTime.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    const dailyHours = Math.max(1, Math.min(16, hours)); // Reasonable bounds
    
    console.log(`   Using employee custom schedule: ${emp.in_time} - ${emp.out_time} = ${dailyHours} hours/day`);
    return dailyHours;
    
  } catch (error) {
    console.error('Error getting employee daily hours:', error);
    return 8; // Fallback to prevent system failure
  }
};

/**
 * Get overtime multipliers from system settings
 * Returns different rates for regular, weekend, and holiday overtime
 */
const getOvertimeMultipliers = async (clientId) => {
  try {
    const settingsHelper = new SettingsHelper(clientId);
    
    // Get working hours config (has weekend and holiday multipliers)
    const workingHoursConfig = await settingsHelper.getSetting('working_hours_config') || {};
    
    // Get basic overtime rate
    const basicOvertimeRate = await settingsHelper.getSetting('overtime_rate_multiplier') || 1.5;
    
    return {
      regular: basicOvertimeRate,
      weekend: workingHoursConfig.weekend_hours_multiplier || 1.5,
      holiday: workingHoursConfig.holiday_hours_multiplier || 2.5
    };
    
  } catch (error) {
    console.error('Error getting overtime multipliers:', error);
    // Return safe defaults
    return {
      regular: 1.5,
      weekend: 1.5, 
      holiday: 2.5
    };
  }
};

// =============================================
// GET PAYROLL RECORDS
// =============================================
router.get('/', 
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    const { 
      month, 
      year,
      status = 'all',
      department_id,
      employee_id,
      payment_method,
      limit = 10,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

  console.log("xxx",req)

    // Build WHERE clause
    let whereConditions = ['e.client_id = ?'];
    let queryParams = [clientId];

    // Filter by month/year or specific period
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      whereConditions.push('pr.pay_period_start >= ? AND pr.pay_period_end <= ?');
      queryParams.push(startDate, endDate);
      console.log(startDate);
      console.log(endDate);
    }

    if (status !== 'all') {
      whereConditions.push('pr.payment_status = ?');
      queryParams.push(status);
    }

    if (department_id) {
      whereConditions.push('e.department_id = ?');
      queryParams.push(department_id);
    }

    if (employee_id) {
      whereConditions.push('pr.employee_id = ?');
      queryParams.push(employee_id);
    }

    if (payment_method) {
      whereConditions.push('pr.payment_method = ?');
      queryParams.push(payment_method);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count for pagination
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      ${whereClause}
    `, queryParams);
    console.log('countresult',countResult);

      console.log('whereClause',whereClause);
    // Get payroll records with employee details
    const [records] = await db.execute(`
      SELECT 
        pr.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        d.name as department_name,
        des.title as designation_title,
        CONCAT(processor.first_name, ' ', processor.last_name) as processed_by_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN admin_users au ON pr.processed_by = au.id
      LEFT JOIN employees processor ON au.employee_id = processor.id
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);
  
    console.log('records', records);

    // Format the response
    const formattedRecords = records.map(record => ({
      id: record.id,
      employeeId: record.employee_id,
      employeeCode: record.employee_code,
      name: record.last_name ? `${record.first_name} ${record.last_name}` : record.first_name,
      email: record.email,
      phone: record.phone,
      designation: record.designation_title,
      department: record.department_name,
      payPeriod: {
        start: record.pay_period_start,
        end: record.pay_period_end
      },
      earnings: {
        baseSalary: parseFloat(record.base_salary),
        allowances: parseFloat(record.allowances),
        overtime: parseFloat(record.overtime_amount),
        bonus: parseFloat(record.bonus),
        commission: parseFloat(record.commission)
      },
      deductions: {
        tax: parseFloat(record.tax_deduction),
        providentFund: parseFloat(record.provident_fund),
        insurance: parseFloat(record.insurance),
        loan: parseFloat(record.loan_deduction),
        other: parseFloat(record.other_deductions)
      },
      summary: {
        grossSalary: parseFloat(record.gross_salary),
        totalDeductions: parseFloat(record.total_deductions),
        netSalary: parseFloat(record.net_salary)
      },
      payment: {
        status: record.payment_status,
        method: record.payment_method,
        date: record.payment_date,
        reference: record.payment_reference
      },
      processing: {
        processedBy: record.processed_by_name,
        processedAt: record.processed_at
      },
      notes: record.notes,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    }));

    console.log('formatted: ',formattedRecords);

    // Calculate summary statistics
    const [summaryStats] = await db.execute(`
      SELECT 
        SUM(gross_salary) as total_gross,
        SUM(total_deductions) as total_deductions,
        SUM(net_salary) as total_net,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN payment_status = 'processing' THEN 1 END) as processing_count
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      data: formattedRecords,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(countResult[0].total / limit),
        current_page: Math.floor(offset / limit) + 1
      },
      summary: {
        totalGross: parseFloat(summaryStats[0].total_gross || 0),
        totalDeductions: parseFloat(summaryStats[0].total_deductions || 0),
        totalNet: parseFloat(summaryStats[0].total_net || 0),
        statusCounts: {
          paid: summaryStats[0].paid_count || 0,
          pending: summaryStats[0].pending_count || 0,
          processing: summaryStats[0].processing_count || 0
        }
      }
    });

     console.log('response 1',res.data)

  })
);

// =============================================
// GET SINGLE PAYROLL RECORD
// =============================================
router.get('/:id', 
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const clientId = req.user.clientId;

    const [record] = await db.execute(`
      SELECT 
        pr.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.hire_date,
        e.employee_type,
        d.name as department_name,
        des.title as designation_title,
        CONCAT(processor.first_name, ' ', processor.last_name) as processed_by_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN admin_users au ON pr.processed_by = au.id
      LEFT JOIN employees processor ON au.employee_id = processor.id
      WHERE pr.id = ? AND e.client_id = ?
    `, [id, clientId]);

    if (record.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    res.json({
      success: true,
      data: record[0]
    });
  })
);

// =============================================
// CREATE PAYROLL RECORD
// =============================================
router.post('/', 
  checkPermission('payroll.edit'),
  validatePayrollRecord,
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
    const clientId = req.user.clientId;
    const userId = req.user.userId;
    const {
      employee_id,
      pay_period_start,
      pay_period_end,
      base_salary,
      allowances = 0,
      overtime_amount = 0,
      bonus = 0,
      commission = 0,
      tax_deduction = 0,
      provident_fund = 0,
      insurance = 0,
      loan_deduction = 0,
      other_deductions = 0,
      payment_method = 'bank_transfer',
      payment_date = null,
      payment_reference = null,
      notes = null
    } = req.body;

    // Verify employee belongs to same client
    const employee = await getEmployeeSalaryDetails(employee_id, clientId, db);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }

    // Check for duplicate payroll record
    const [existing] = await db.execute(`
      SELECT id FROM payroll_records 
      WHERE employee_id = ? 
        AND pay_period_start = ? 
        AND pay_period_end = ?
    `, [employee_id, pay_period_start, pay_period_end]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Payroll record already exists for this employee and period'
      });
    }

    // Calculate totals
    const gross_salary = calculateGrossSalary(base_salary, allowances, overtime_amount, bonus, commission);
    const total_deductions = calculateTotalDeductions(tax_deduction, provident_fund, insurance, loan_deduction, other_deductions);
    const net_salary = calculateNetSalary(gross_salary, total_deductions);

    // Determine payment status
    const payment_status = payment_date ? 'paid' : 'pending';

    const recordId = uuidv4();

    // Insert payroll record
    await db.execute(`
      INSERT INTO payroll_records (
        id, employee_id, pay_period_start, pay_period_end,
        base_salary, allowances, overtime_amount, bonus, commission,
        gross_salary, tax_deduction, provident_fund, insurance, 
        loan_deduction, other_deductions, total_deductions, net_salary,
        payment_status, payment_method, payment_date, payment_reference,
        processed_by, processed_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `, [
      recordId, employee_id, pay_period_start, pay_period_end,
      base_salary, allowances, overtime_amount, bonus, commission,
      gross_salary, tax_deduction, provident_fund, insurance,
      loan_deduction, other_deductions, total_deductions, net_salary,
      payment_status, payment_method, payment_date, payment_reference,
      userId, notes
    ]);

    res.status(201).json({
      success: true,
      message: 'Payroll record created successfully',
      data: {
        id: recordId,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        gross_salary,
        total_deductions,
        net_salary,
        payment_status
      }
    });
  })
);

// =============================================
// UPDATE PAYROLL RECORD
// =============================================
router.put('/:id', 
  checkPermission('payroll.edit'),
  validatePayrollRecord,
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
    const { id } = req.params;
    const clientId = req.user.clientId;
    const userId = req.user.userId;

    // Check if record exists
    const [existing] = await db.execute(`
      SELECT pr.*, e.client_id 
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE pr.id = ? AND e.client_id = ?
    `, [id, clientId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Don't allow editing paid records unless admin
    if (existing[0].payment_status === 'paid' && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit paid payroll records'
      });
    }

    const {
      base_salary,
      allowances = 0,
      overtime_amount = 0,
      bonus = 0,
      commission = 0,
      tax_deduction = 0,
      provident_fund = 0,
      insurance = 0,
      loan_deduction = 0,
      other_deductions = 0,
      payment_method,
      payment_date,
      payment_reference,
      notes
    } = req.body;

    // Calculate totals
    const gross_salary = calculateGrossSalary(base_salary, allowances, overtime_amount, bonus, commission);
    const total_deductions = calculateTotalDeductions(tax_deduction, provident_fund, insurance, loan_deduction, other_deductions);
    const net_salary = calculateNetSalary(gross_salary, total_deductions);

    // Update record
    await db.execute(`
      UPDATE payroll_records SET
        base_salary = ?, allowances = ?, overtime_amount = ?, bonus = ?, commission = ?,
        gross_salary = ?, tax_deduction = ?, provident_fund = ?, insurance = ?,
        loan_deduction = ?, other_deductions = ?, total_deductions = ?, net_salary = ?,
        payment_method = ?, payment_date = ?, payment_reference = ?,
        processed_by = ?, processed_at = NOW(), notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      base_salary, allowances, overtime_amount, bonus, commission,
      gross_salary, tax_deduction, provident_fund, insurance,
      loan_deduction, other_deductions, total_deductions, net_salary,
      payment_method, payment_date, payment_reference,
      userId, notes, id
    ]);

    res.json({
      success: true,
      message: 'Payroll record updated successfully',
      data: {
        gross_salary,
        total_deductions,
        net_salary
      }
    });
  })
);

// =============================================
// UPDATE PAYMENT STATUS
// =============================================
router.patch('/:id/payment-status', 
  checkPermission('payroll.process'),
  [
    body('payment_status').isIn(['pending', 'processing', 'paid', 'failed']).withMessage('Invalid payment status'),
    body('payment_date').optional().isISO8601().withMessage('Invalid payment date'),
    body('payment_reference').optional().isString().withMessage('Invalid payment reference')
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
    const { id } = req.params;
    const clientId = req.user.clientId;
    const { payment_status, payment_date, payment_reference } = req.body;

    // Check if record exists
    const [existing] = await db.execute(`
      SELECT pr.*, e.client_id 
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE pr.id = ? AND e.client_id = ?
    `, [id, clientId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // FIX: Use null instead of undefined for optional parameters
    const finalPaymentDate = payment_date || null;
    const finalPaymentReference = payment_reference || null;

    // Update payment status
    await db.execute(`
      UPDATE payroll_records SET
        payment_status = ?,
        payment_date = ?,
        payment_reference = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [payment_status, finalPaymentDate, finalPaymentReference, id]);

    res.json({
      success: true,
      message: 'Payment status updated successfully'
    });
  })
);

// =============================================
// BULK UPDATE PAYMENT STATUS
// =============================================
router.patch('/bulk-payment-status', 
  checkPermission('payroll.process'),
  [
    body('record_ids')
      .isArray({ min: 1 })
      .withMessage('Record IDs must be a non-empty array'),
    body('record_ids.*')
      .isUUID()
      .withMessage('Each record ID must be a valid UUID'),
    body('payment_status')
      .isIn(['pending', 'paid', 'failed'])
      .withMessage('Invalid payment status. Must be pending, paid, or failed'),
    body('payment_date')
      .optional()
      .isISO8601()
      .withMessage('Invalid payment date format'),
    body('payment_reference')
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage('Payment reference must be a string with max 255 characters')
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
    const clientId = req.user.clientId;
    const userId = req.user.userId;
    const { 
      record_ids, 
      payment_status, 
      payment_date = null, 
      payment_reference = null 
    } = req.body;

    try {
      // Start transaction
      await db.execute('START TRANSACTION');

      // First, verify all records exist and belong to the client
      const placeholders = record_ids.map(() => '?').join(',');
      const [existingRecords] = await db.execute(`
        SELECT pr.id, pr.payment_status, e.client_id,
               CONCAT(e.first_name, ' ', e.last_name) as employee_name
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE pr.id IN (${placeholders}) AND e.client_id = ?
      `, [...record_ids, clientId]);

      // Check if all records were found
      if (existingRecords.length !== record_ids.length) {
        await db.execute('ROLLBACK');
        const foundIds = existingRecords.map(r => r.id);
        const missingIds = record_ids.filter(id => !foundIds.includes(id));
        
        return res.status(404).json({
          success: false,
          message: 'Some payroll records not found or access denied',
          details: {
            missing_records: missingIds,
            found: existingRecords.length,
            requested: record_ids.length
          }
        });
      }

      // Check for any restrictions (optional - you can remove this if not needed)
      const paidRecords = existingRecords.filter(r => r.payment_status === 'paid');
      if (paidRecords.length > 0 && !req.user.isSuperAdmin) {
        await db.execute('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Cannot modify paid records without admin privileges',
          details: {
            paid_records: paidRecords.map(r => ({
              id: r.id,
              employee_name: r.employee_name
            }))
          }
        });
      }

      // Perform bulk update
      const updateResult = await db.execute(`
        UPDATE payroll_records pr
        JOIN employees e ON pr.employee_id = e.id 
        SET 
          pr.payment_status = ?,
          pr.payment_date = ?,
          pr.payment_reference = ?,
          pr.updated_at = NOW()
        WHERE pr.id IN (${placeholders}) AND e.client_id = ?
      `, [payment_status, payment_date, payment_reference, ...record_ids, clientId]);

      // Log the bulk update activity (optional)
      if (updateResult[0].affectedRows > 0) {
        await db.execute(`
          INSERT INTO activity_logs (
            id, user_id, action, resource_type, resource_id, 
            description, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          uuidv4(),
          userId,
          'bulk_payment_status_update',
          'payroll_records',
          null,
          `Bulk updated payment status to ${payment_status} for ${updateResult[0].affectedRows} records`,
          JSON.stringify({
            record_ids,
            payment_status,
            payment_date,
            payment_reference,
            affected_rows: updateResult[0].affectedRows
          })
        ]).catch(() => {}); // Ignore logging errors
      }

      // Commit transaction
      await db.execute('COMMIT');

      // Return success response
      res.json({
        success: true,
        message: `Successfully updated payment status for ${updateResult[0].affectedRows} records`,
        data: {
          updated_records: updateResult[0].affectedRows,
          payment_status,
          payment_date,
          payment_reference,
          processed_at: new Date().toISOString()
        }
      });

    } catch (error) {
      // Rollback transaction on error
      await db.execute('ROLLBACK');
      console.error('Bulk payment status update error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to update payment statuses',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  })
);

// =============================================
// BULK PROCESS PAYROLL
// =============================================
router.post('/bulk-process', 
  checkPermission('payroll.process'),
  validateBulkProcess,
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
    const clientId = req.user.clientId;
    const userId = req.user.userId;
    const {
      pay_period_start,
      pay_period_end,
      department_id,
      employee_ids,
      auto_calculate_overtime = true,
      default_allowances = 0,
      default_bonus = 0,
      tax_rate = 0.15,
      provident_fund_rate = 0.05,
      insurance_amount = 0
    } = req.body;

    // Build employee filter
    let employeeConditions = ['e.client_id = ?', 'e.employment_status = "active"'];
    let employeeParams = [clientId];

    if (department_id) {
      employeeConditions.push('e.department_id = ?');
      employeeParams.push(department_id);
    }

    if (employee_ids && employee_ids.length > 0) {
      const placeholders = employee_ids.map(() => '?').join(',');
      employeeConditions.push(`e.id IN (${placeholders})`);
      employeeParams.push(...employee_ids);
    }

    // Get employees to process
    const [employees] = await db.execute(`
      SELECT 
        e.id,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.base_salary,
        e.department_id,
        e.designation_id
      FROM employees e
      WHERE ${employeeConditions.join(' AND ')}
    `, employeeParams);

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No employees found for processing'
      });
    }

    const results = [];
    const errors_list = [];

    // Process each employee
    for (const employee of employees) {
      try {
        // Check for existing record
        const [existing] = await db.execute(`
          SELECT id FROM payroll_records 
          WHERE employee_id = ? 
            AND pay_period_start = ? 
            AND pay_period_end = ?
        `, [employee.id, pay_period_start, pay_period_end]);

        if (existing.length > 0) {
          errors_list.push({
            employee_id: employee.id,
            employee_name: `${employee.first_name} ${employee.last_name}`,
            error: 'Payroll record already exists for this period'
          });
          continue;
        }

        // Calculate overtime if enabled
        let overtime_amount = 0;
        if (auto_calculate_overtime) {
          const overtime = await calculateOvertimeFromAttendance(
            employee.id, 
            pay_period_start, 
            pay_period_end, 
            db
          );
          
          if (overtime.totalOvertimeHours > 0) {
            // PROPER DYNAMIC CALCULATION - NO HARDCODING
            overtime_amount = await calculateDynamicOvertimeAmount(
              employee.id,
              employee.base_salary,
              overtime.totalOvertimeHours,
              pay_period_start,
              pay_period_end,
              clientId,
              db
            );
          }
        }

        // Calculate salary components
        const base_salary = employee.base_salary || 0;
        const allowances = default_allowances;
        const bonus = default_bonus;
        const gross_salary = calculateGrossSalary(base_salary, allowances, overtime_amount, bonus, 0);
        
        // Calculate deductions
        const tax_deduction = gross_salary * tax_rate;
        const provident_fund = base_salary * provident_fund_rate;
        const insurance = insurance_amount;
        const total_deductions = calculateTotalDeductions(tax_deduction, provident_fund, insurance, 0, 0);
        const net_salary = calculateNetSalary(gross_salary, total_deductions);

        const recordId = uuidv4();

        // Insert payroll record
        await db.execute(`
          INSERT INTO payroll_records (
            id, employee_id, pay_period_start, pay_period_end,
            base_salary, allowances, overtime_amount, bonus, commission,
            gross_salary, tax_deduction, provident_fund, insurance, 
            loan_deduction, other_deductions, total_deductions, net_salary,
            payment_status, payment_method, processed_by, processed_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [
          recordId, employee.id, pay_period_start, pay_period_end,
          base_salary, allowances, overtime_amount, bonus, 0,
          gross_salary, tax_deduction, provident_fund, insurance,
          0, 0, total_deductions, net_salary,
          'pending', 'bank_transfer', userId, 'Bulk processed'
        ]);

        results.push({
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          employee_code: employee.employee_code,
          gross_salary,
          net_salary,
          status: 'success'
        });

      } catch (error) {
        errors_list.push({
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} out of ${employees.length} employees`,
      data: {
        processed: results,
        errors: errors_list,
        summary: {
          total_employees: employees.length,
          successful: results.length,
          failed: errors_list.length
        }
      }
    });
  })
);

// =============================================
// DELETE PAYROLL RECORD
// =============================================
router.delete('/:id', 
  checkPermission('payroll.edit'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const clientId = req.user.clientId;

    // Check if record exists and belongs to client
    const [existing] = await db.execute(`
      SELECT pr.*, e.client_id 
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE pr.id = ? AND e.client_id = ?
    `, [id, clientId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Don't allow deleting paid records
    if (existing[0].payment_status === 'paid') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete paid payroll records'
      });
    }

    // Delete the record
    await db.execute('DELETE FROM payroll_records WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Payroll record deleted successfully'
    });
  })
);

// =============================================
// GET PAYROLL SUMMARY FOR PERIOD
// =============================================
router.get('/summary/:period', 
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { period } = req.params; // Format: YYYY-MM
    const clientId = req.user.clientId;
    
    const [year, month] = period.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Get summary statistics
    const [summary] = await db.execute(`
      SELECT 
        COUNT(DISTINCT pr.employee_id) as total_employees,
        COUNT(pr.id) as total_records,
        SUM(pr.gross_salary) as total_gross,
        SUM(pr.total_deductions) as total_deductions,
        SUM(pr.net_salary) as total_net,
        AVG(pr.net_salary) as average_net,
        MAX(pr.net_salary) as highest_salary,
        MIN(pr.net_salary) as lowest_salary,
        SUM(pr.overtime_amount) as total_overtime,
        SUM(pr.bonus) as total_bonus,
        COUNT(CASE WHEN pr.payment_status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN pr.payment_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN pr.payment_status = 'processing' THEN 1 END) as processing_count,
        COUNT(CASE WHEN pr.payment_status = 'failed' THEN 1 END) as failed_count
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE e.client_id = ? 
        AND pr.pay_period_start >= ? 
        AND pr.pay_period_end <= ?
    `, [clientId, startDate, endDate]);

    // Get department-wise breakdown
    const [departmentBreakdown] = await db.execute(`
      SELECT 
        d.id as department_id,
        d.name as department_name,
        COUNT(DISTINCT pr.employee_id) as employee_count,
        SUM(pr.gross_salary) as total_gross,
        SUM(pr.net_salary) as total_net,
        AVG(pr.net_salary) as average_net
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.client_id = ? 
        AND pr.pay_period_start >= ? 
        AND pr.pay_period_end <= ?
      GROUP BY d.id, d.name
      ORDER BY total_gross DESC
    `, [clientId, startDate, endDate]);

    res.json({
      success: true,
      data: {
        period: {
          year: parseInt(year),
          month: parseInt(month),
          start_date: startDate,
          end_date: endDate
        },
        summary: summary[0],
        department_breakdown: departmentBreakdown
      }
    });
  })
);

// =============================================
// GENERATE PAYSLIP
// =============================================
router.get('/:id/payslip', 
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const clientId = req.user.clientId;

    // Get complete payroll details for payslip
    const [payslip] = await db.execute(`
      SELECT 
        pr.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.address,
        e.hire_date,
        e.employee_type,
        e.bank_account_number,
        e.bank_name,
        d.name as department_name,
        des.title as designation_title,
        c.name as company_name,
        c.address as company_address,
        c.phone as company_phone,
        c.contact_email as company_email
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE pr.id = ? AND e.client_id = ?
    `, [id, clientId]);

    if (payslip.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    const record = payslip[0];

    // Format payslip data
    const payslipData = {
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
          basic_salary: parseFloat(record.base_salary),
          allowances: parseFloat(record.allowances),
          overtime: parseFloat(record.overtime_amount),
          bonus: parseFloat(record.bonus),
          commission: parseFloat(record.commission),
          gross_total: parseFloat(record.gross_salary)
        },
        deductions: {
          tax: parseFloat(record.tax_deduction),
          provident_fund: parseFloat(record.provident_fund),
          insurance: parseFloat(record.insurance),
          loan: parseFloat(record.loan_deduction),
          other: parseFloat(record.other_deductions),
          total: parseFloat(record.total_deductions)
        },
        net_salary: parseFloat(record.net_salary),
        payment: {
          status: record.payment_status,
          method: record.payment_method,
          date: record.payment_date,
          reference: record.payment_reference
        }
      },
      generated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: payslipData
    });
  })
);

// =============================================
// GET EMPLOYEE PAYROLL HISTORY
// =============================================
router.get('/employee/:employeeId/history', 
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { employeeId } = req.params;
    const clientId = req.user.clientId;
    const { limit = 12, offset = 0 } = req.query;

    // Verify employee belongs to client
    const [employee] = await db.execute(`
      SELECT id, first_name, last_name 
      FROM employees 
      WHERE id = ? AND client_id = ?
    `, [employeeId, clientId]);

    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get payroll history
    const [history] = await db.execute(`
      SELECT 
        id,
        pay_period_start,
        pay_period_end,
        base_salary,
        gross_salary,
        total_deductions,
        net_salary,
        payment_status,
        payment_method,
        payment_date,
        created_at
      FROM payroll_records
      WHERE employee_id = ?
      ORDER BY pay_period_end DESC
      LIMIT ? OFFSET ?
    `, [employeeId, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM payroll_records
      WHERE employee_id = ?
    `, [employeeId]);

    // Calculate statistics
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_records,
        SUM(net_salary) as total_earned,
        AVG(net_salary) as average_salary,
        MAX(net_salary) as highest_salary,
        MIN(net_salary) as lowest_salary
      FROM payroll_records
      WHERE employee_id = ? AND payment_status = 'paid'
    `, [employeeId]);

    res.json({
      success: true,
      data: {
        employee: {
          id: employeeId,
          name: `${employee[0].first_name} ${employee[0].last_name}`
        },
        history,
        statistics: stats[0],
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });
  })
);

// =============================================
// EXPORT PAYROLL DATA
// =============================================
router.get('/export/:format', 
  checkPermission('payroll.edit'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { format } = req.params; // csv or json
    const clientId = req.user.clientId;
    const { 
      month, 
      year,
      department_id,
      status = 'all'
    } = req.query;

    // Build query
    let whereConditions = ['e.client_id = ?'];
    let queryParams = [clientId];

    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      whereConditions.push('pr.pay_period_start >= ? AND pr.pay_period_end <= ?');
      queryParams.push(startDate, endDate);
    }

    if (department_id) {
      whereConditions.push('e.department_id = ?');
      queryParams.push(department_id);
    }

    if (status !== 'all') {
      whereConditions.push('pr.payment_status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get data for export
    const [records] = await db.execute(`
      SELECT 
        e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email,
        d.name as department,
        des.title as designation,
        pr.pay_period_start,
        pr.pay_period_end,
        pr.base_salary,
        pr.allowances,
        pr.overtime_amount,
        pr.bonus,
        pr.commission,
        pr.gross_salary,
        pr.tax_deduction,
        pr.provident_fund,
        pr.insurance,
        pr.loan_deduction,
        pr.other_deductions,
        pr.total_deductions,
        pr.net_salary,
        pr.payment_status,
        pr.payment_method,
        pr.payment_date,
        pr.payment_reference
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ${whereClause}
      ORDER BY e.employee_code, pr.pay_period_start
    `, queryParams);

    if (format === 'json') {
      res.json({
        success: true,
        data: records,
        metadata: {
          total_records: records.length,
          export_date: new Date().toISOString(),
          filters: { month, year, department_id, status }
        }
      });
    } else if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = Object.keys(records[0] || {}).join(',');
      const csvRows = records.map(record => 
        Object.values(record).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payroll_export_${year}_${month}.csv`);
      res.send(csvContent);
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid export format. Use "csv" or "json"'
      });
    }
  })
);

router.get("/live", async (req, res) => {
  const { employee_id, month, year } = req.query;
  if (!employee_id || !month || !year) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    // 🔸 1. Total attendance stats
    const [attendanceRows] = await connection.execute(
      `
      SELECT is_weekend, SUM(payable_duration) as total_payable, COUNT(*) as days
      FROM attendance
      WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
      GROUP BY is_weekend
      `,
      [employee_id, month, year]
    );

    // 🔸 2. Fetch weekend config
    const [employeeRows] = await connection.execute(
      `SELECT weekend_working_config, in_time, out_time FROM employees WHERE id = ?`,
      [employee_id]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const weekendConfig = JSON.parse(employeeRows[0].weekend_working_config);
    const weekdayInTime = employeeRows[0].in_time;
    const weekdayOutTime = employeeRows[0].out_time;

    // 🔸 3. Find last active check-in
    const [activeCheckIn] = await connection.execute(
      `
      SELECT date, check_in_time
      FROM attendance
      WHERE employee_id = ? 
        AND check_out_time IS NULL
      ORDER BY date DESC, check_in_time DESC
      LIMIT 1
      `,
      [employee_id]
    );

    let lastCheckInTime = null;
    let lastCheckInDate = null;
    if (activeCheckIn.length > 0) {
      lastCheckInTime = activeCheckIn[0].check_in_time;
      lastCheckInDate = activeCheckIn[0].date;
    }

    // 🧮 4. Initialize response
    let jsonResponse = {
      empid: employee_id,
      month: parseInt(month),
      year: parseInt(year),
      weekdays_of_month: 0,
      saturdays_of_month: 0,
      sundays_of_month: 0,
      is_over_time_paid: false,
      is_sunday_workday: weekendConfig.sunday.working,
      is_saturday_workday: weekendConfig.saturday.working,
      ïs_fullday_salary_sunday: weekendConfig.sunday.full_day_salary,
      ïs_fullday_salary_satuday: weekendConfig.saturday.full_day_salary,
      weekday_shedule_in_time: weekdayInTime,
      weekday_shedule_out_time: weekdayOutTime,
      saturday_shedule_in_time: weekendConfig.saturday.in_time,
      saturday_shedule_out_time: weekendConfig.saturday.out_time,
      sunday_shedule_in_time: weekendConfig.sunday.in_time,
      sunday_shedule_out_time: weekendConfig.sunday.out_time,
      overtime_hours: 0,
      sum_of_weekday_payable_hours: 0,
      sum_of_saturday_payable_hours: 0,
      sum_of_sunday_payable_hours: 0,
      last_check_in_date: lastCheckInDate,
      last_check_in_time: lastCheckInTime
    };

    // 🧮 5. Fill in stats
    attendanceRows.forEach(row => {
      const dayOfWeek = row.is_weekend;
      const totalHours = Number(row.total_payable) || 0;
      const days = Number(row.days) || 0;

      if (dayOfWeek === 1) { // Sunday
        jsonResponse.sundays_of_month = days;
        jsonResponse.sum_of_sunday_payable_hours = totalHours;
      } else if (dayOfWeek === 7) { // Saturday
        jsonResponse.saturdays_of_month = days;
        jsonResponse.sum_of_saturday_payable_hours = totalHours;
      } else {
        jsonResponse.weekdays_of_month += days;
        jsonResponse.sum_of_weekday_payable_hours += totalHours;
      }
    });

    res.json(jsonResponse);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    connection.end();
  }
});

module.exports = router;