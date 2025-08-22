// payrollService.js
const { v4: uuidv4 } = require('uuid');

class PayrollService {
  constructor(db) {
    this.db = db;
  }

  // =============================================
  // TAX CALCULATION METHODS
  // =============================================
  
  /**
   * Calculate tax based on progressive tax slabs
   * @param {number} grossSalary - Gross salary amount
   * @param {string} country - Country code for tax rules
   * @returns {number} Tax amount
   */
  calculateProgressiveTax(grossSalary, country = 'LK') {
    // Sri Lankan tax slabs (example)
    const taxSlabs = [
      { min: 0, max: 100000, rate: 0 },
      { min: 100000, max: 200000, rate: 0.06 },
      { min: 200000, max: 300000, rate: 0.12 },
      { min: 300000, max: 500000, rate: 0.18 },
      { min: 500000, max: 750000, rate: 0.24 },
      { min: 750000, max: Infinity, rate: 0.36 }
    ];

    let tax = 0;
    let remainingSalary = grossSalary;

    for (const slab of taxSlabs) {
      if (remainingSalary <= 0) break;
      
      const taxableInSlab = Math.min(
        remainingSalary,
        slab.max - slab.min
      );
      
      tax += taxableInSlab * slab.rate;
      remainingSalary -= taxableInSlab;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Calculate flat tax rate
   * @param {number} grossSalary - Gross salary amount
   * @param {number} taxRate - Tax rate (e.g., 0.15 for 15%)
   * @returns {number} Tax amount
   */
  calculateFlatTax(grossSalary, taxRate) {
    return Math.round(grossSalary * taxRate * 100) / 100;
  }

  // =============================================
  // PROVIDENT FUND CALCULATIONS
  // =============================================
  
  /**
   * Calculate EPF/ETF contributions
   * @param {number} baseSalary - Base salary amount
   * @param {object} rates - EPF/ETF rates
   * @returns {object} EPF/ETF amounts
   */
  calculateProvidentFund(baseSalary, rates = {}) {
    const defaultRates = {
      employeeEPF: 0.08,  // 8% employee contribution
      employerEPF: 0.12,  // 12% employer contribution
      employerETF: 0.03   // 3% ETF contribution
    };

    const finalRates = { ...defaultRates, ...rates };

    return {
      employeeEPF: Math.round(baseSalary * finalRates.employeeEPF * 100) / 100,
      employerEPF: Math.round(baseSalary * finalRates.employerEPF * 100) / 100,
      employerETF: Math.round(baseSalary * finalRates.employerETF * 100) / 100
    };
  }

  // =============================================
  // OVERTIME CALCULATIONS
  // =============================================
  
  /**
   * Calculate overtime payment
   * @param {number} hourlyRate - Regular hourly rate
   * @param {number} overtimeHours - Number of overtime hours
   * @param {object} multipliers - Overtime multipliers for different scenarios
   * @returns {number} Overtime payment amount
   */
  calculateOvertime(hourlyRate, overtimeHours, multipliers = {}) {
    const defaultMultipliers = {
      weekday: 1.5,    // 1.5x for weekday overtime
      saturday: 1.5,   // 1.5x for Saturday
      sunday: 2.0,     // 2x for Sunday
      holiday: 2.5     // 2.5x for public holidays
    };

    const finalMultipliers = { ...defaultMultipliers, ...multipliers };
    
    // For simplicity, using weekday multiplier
    // In production, you'd track overtime by day type
    return Math.round(hourlyRate * overtimeHours * finalMultipliers.weekday * 100) / 100;
  }

  /**
   * Get hourly rate from monthly salary
   * @param {number} monthlySalary - Monthly salary
   * @param {number} workingDays - Working days per month (default 22)
   * @param {number} hoursPerDay - Working hours per day (default 8)
   * @returns {number} Hourly rate
   */
  getHourlyRate(monthlySalary, workingDays = 22, hoursPerDay = 8) {
    return monthlySalary / (workingDays * hoursPerDay);
  }

  // =============================================
  // LEAVE DEDUCTIONS
  // =============================================
  
  /**
   * Calculate salary deduction for unpaid leaves
   * @param {number} dailyRate - Daily salary rate
   * @param {number} unpaidLeaveDays - Number of unpaid leave days
   * @returns {number} Deduction amount
   */
  calculateLeaveDeduction(dailyRate, unpaidLeaveDays) {
    return Math.round(dailyRate * unpaidLeaveDays * 100) / 100;
  }

  /**
   * Get daily rate from monthly salary
   * @param {number} monthlySalary - Monthly salary
   * @param {number} workingDays - Working days per month
   * @returns {number} Daily rate
   */
  getDailyRate(monthlySalary, workingDays = 22) {
    return monthlySalary / workingDays;
  }

  // =============================================
  // LOAN MANAGEMENT
  // =============================================
  
  /**
   * Calculate loan EMI
   * @param {number} principal - Loan amount
   * @param {number} annualRate - Annual interest rate (e.g., 0.12 for 12%)
   * @param {number} tenureMonths - Loan tenure in months
   * @returns {number} Monthly EMI amount
   */
  calculateEMI(principal, annualRate, tenureMonths) {
    const monthlyRate = annualRate / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) /
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return Math.round(emi * 100) / 100;
  }

  /**
   * Get active loan deductions for an employee
   * @param {string} employeeId - Employee ID
   * @param {string} payPeriod - Pay period
   * @returns {Promise<number>} Total loan deduction
   */
  async getActiveLoanDeductions(employeeId, payPeriod) {
    const [loans] = await this.db.execute(`
      SELECT 
        SUM(monthly_deduction) as total_deduction
      FROM employee_loans
      WHERE employee_id = ?
        AND status = 'active'
        AND start_date <= ?
        AND (end_date IS NULL OR end_date >= ?)
    `, [employeeId, payPeriod, payPeriod]);

    return loans[0]?.total_deduction || 0;
  }

  // =============================================
  // ATTENDANCE-BASED CALCULATIONS
  // =============================================
  
  /**
   * Calculate attendance-based deductions
   * @param {string} employeeId - Employee ID
   * @param {string} startDate - Period start date
   * @param {string} endDate - Period end date
   * @returns {Promise<object>} Attendance metrics and deductions
   */
  async calculateAttendanceDeductions(employeeId, startDate, endDate) {
    // Get attendance summary
    const [attendance] = await this.db.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_days,
        SUM(CASE WHEN overtime_hours > 0 THEN overtime_hours ELSE 0 END) as total_overtime
      FROM attendance
      WHERE employee_id = ?
        AND date BETWEEN ? AND ?
    `, [employeeId, startDate, endDate]);

    const metrics = attendance[0] || {};

    // Get employee's daily rate
    const [employee] = await this.db.execute(`
      SELECT base_salary FROM employees WHERE id = ?
    `, [employeeId]);

    const dailyRate = this.getDailyRate(employee[0]?.base_salary || 0);
    
    // Calculate deductions
    const deductions = {
      absent_deduction: dailyRate * (metrics.absent_days || 0),
      half_day_deduction: (dailyRate / 2) * (metrics.half_days || 0),
      late_penalty: 0 // Can be configured based on company policy
    };

    return {
      metrics,
      deductions,
      total_deduction: Object.values(deductions).reduce((a, b) => a + b, 0)
    };
  }

  // =============================================
  // BONUS CALCULATIONS
  // =============================================
  
  /**
   * Calculate performance bonus
   * @param {number} baseSalary - Base salary
   * @param {number} performanceScore - Performance score (0-100)
   * @param {number} maxBonusPercentage - Maximum bonus percentage
   * @returns {number} Bonus amount
   */
  calculatePerformanceBonus(baseSalary, performanceScore, maxBonusPercentage = 0.20) {
    const bonusPercentage = (performanceScore / 100) * maxBonusPercentage;
    return Math.round(baseSalary * bonusPercentage * 100) / 100;
  }

  /**
   * Calculate annual bonus (13th month, etc.)
   * @param {number} baseSalary - Base salary
   * @param {number} monthsWorked - Number of months worked in the year
   * @returns {number} Annual bonus amount
   */
  calculateAnnualBonus(baseSalary, monthsWorked = 12) {
    return Math.round((baseSalary / 12) * monthsWorked * 100) / 100;
  }

  // =============================================
  // PAYROLL VALIDATION
  // =============================================
  
  /**
   * Validate payroll data before processing
   * @param {object} payrollData - Payroll data to validate
   * @returns {object} Validation result
   */
  validatePayrollData(payrollData) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!payrollData.employee_id) {
      errors.push('Employee ID is required');
    }
    if (!payrollData.pay_period_start || !payrollData.pay_period_end) {
      errors.push('Pay period dates are required');
    }
    if (!payrollData.base_salary || payrollData.base_salary <= 0) {
      errors.push('Valid base salary is required');
    }

    // Check date validity
    const startDate = new Date(payrollData.pay_period_start);
    const endDate = new Date(payrollData.pay_period_end);
    
    if (startDate >= endDate) {
      errors.push('Pay period end date must be after start date');
    }

    // Check for unusual values
    if (payrollData.overtime_amount > payrollData.base_salary) {
      warnings.push('Overtime amount exceeds base salary');
    }
    if (payrollData.total_deductions > payrollData.gross_salary * 0.5) {
      warnings.push('Total deductions exceed 50% of gross salary');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // =============================================
  // BATCH PROCESSING
  // =============================================
  
  /**
   * Process payroll for multiple employees
   * @param {array} employees - Array of employee IDs
   * @param {object} payPeriod - Pay period details
   * @param {object} defaultValues - Default values for calculations
   * @returns {Promise<object>} Processing results
   */
  async batchProcessPayroll(employees, payPeriod, defaultValues = {}) {
    const results = {
      successful: [],
      failed: [],
      summary: {
        total: employees.length,
        processed: 0,
        errors: 0
      }
    };

    for (const employeeId of employees) {
      try {
        // Get employee details
        const [employee] = await this.db.execute(`
          SELECT * FROM employees WHERE id = ? AND employment_status = 'active'
        `, [employeeId]);

        if (employee.length === 0) {
          throw new Error('Employee not found or inactive');
        }

        const emp = employee[0];

        // Calculate components
        const baseSalary = emp.base_salary || 0;
        const allowances = defaultValues.allowances || 0;
        
        // Get attendance-based calculations
        const attendanceData = await this.calculateAttendanceDeductions(
          employeeId, 
          payPeriod.start, 
          payPeriod.end
        );
        
        const overtimeHours = attendanceData.metrics.total_overtime || 0;
        const hourlyRate = this.getHourlyRate(baseSalary);
        const overtimeAmount = this.calculateOvertime(hourlyRate, overtimeHours);
        
        // Calculate gross salary
        const grossSalary = baseSalary + allowances + overtimeAmount + (defaultValues.bonus || 0);
        
        // Calculate deductions
        const taxDeduction = defaultValues.useFlatTax ? 
          this.calculateFlatTax(grossSalary, defaultValues.taxRate || 0.15) :
          this.calculateProgressiveTax(grossSalary);
        
        const pfData = this.calculateProvidentFund(baseSalary);
        const loanDeduction = await this.getActiveLoanDeductions(employeeId, payPeriod.start);
        
        const totalDeductions = taxDeduction + 
                               pfData.employeeEPF + 
                               (defaultValues.insurance || 0) + 
                               loanDeduction + 
                               attendanceData.total_deduction;
        
        const netSalary = grossSalary - totalDeductions;

        // Create payroll record
        const recordId = uuidv4();
        await this.db.execute(`
          INSERT INTO payroll_records (
            id, employee_id, pay_period_start, pay_period_end,
            base_salary, allowances, overtime_amount, bonus,
            gross_salary, tax_deduction, provident_fund, insurance,
            loan_deduction, other_deductions, total_deductions, net_salary,
            payment_status, payment_method, processed_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [
          recordId, employeeId, payPeriod.start, payPeriod.end,
          baseSalary, allowances, overtimeAmount, defaultValues.bonus || 0,
          grossSalary, taxDeduction, pfData.employeeEPF, defaultValues.insurance || 0,
          loanDeduction, attendanceData.total_deduction, totalDeductions, netSalary,
          'pending', 'bank_transfer', 'Batch processed'
        ]);

        results.successful.push({
          employee_id: employeeId,
          record_id: recordId,
          net_salary: netSalary
        });
        results.summary.processed++;

      } catch (error) {
        results.failed.push({
          employee_id: employeeId,
          error: error.message
        });
        results.summary.errors++;
      }
    }

    return results;
  }

  // =============================================
  // REPORTS AND ANALYTICS
  // =============================================
  
  /**
   * Generate payroll report for a period
   * @param {string} clientId - Client ID
   * @param {string} startDate - Report start date
   * @param {string} endDate - Report end date
   * @returns {Promise<object>} Report data
   */
  async generatePayrollReport(clientId, startDate, endDate) {
    // Overall summary
    const [summary] = await this.db.execute(`
      SELECT 
        COUNT(DISTINCT pr.employee_id) as total_employees,
        COUNT(pr.id) as total_transactions,
        SUM(pr.gross_salary) as total_gross,
        SUM(pr.total_deductions) as total_deductions,
        SUM(pr.net_salary) as total_net,
        AVG(pr.net_salary) as average_net,
        SUM(pr.overtime_amount) as total_overtime,
        SUM(pr.bonus) as total_bonus
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE e.client_id = ?
        AND pr.pay_period_start >= ?
        AND pr.pay_period_end <= ?
    `, [clientId, startDate, endDate]);

    // Department breakdown
    const [departmentData] = await this.db.execute(`
      SELECT 
        d.name as department,
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
    `, [clientId, startDate, endDate]);

    // Payment status breakdown
    const [paymentStatus] = await this.db.execute(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(net_salary) as total_amount
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE e.client_id = ?
        AND pr.pay_period_start >= ?
        AND pr.pay_period_end <= ?
      GROUP BY payment_status
    `, [clientId, startDate, endDate]);

    // Monthly trend
    const [monthlyTrend] = await this.db.execute(`
      SELECT 
        DATE_FORMAT(pr.pay_period_start, '%Y-%m') as month,
        COUNT(DISTINCT pr.employee_id) as employee_count,
        SUM(pr.gross_salary) as total_gross,
        SUM(pr.net_salary) as total_net
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE e.client_id = ?
        AND pr.pay_period_start >= ?
        AND pr.pay_period_end <= ?
      GROUP BY DATE_FORMAT(pr.pay_period_start, '%Y-%m')
      ORDER BY month
    `, [clientId, startDate, endDate]);

    return {
      summary: summary[0],
      by_department: departmentData,
      by_payment_status: paymentStatus,
      monthly_trend: monthlyTrend,
      report_period: {
        start: startDate,
        end: endDate
      },
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Get year-to-date payroll summary for an employee
   * @param {string} employeeId - Employee ID
   * @param {number} year - Year for YTD calculation
   * @returns {Promise<object>} YTD summary
   */
  async getEmployeeYTD(employeeId, year = new Date().getFullYear()) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [ytdData] = await this.db.execute(`
      SELECT 
        COUNT(*) as pay_periods,
        SUM(base_salary) as total_base,
        SUM(allowances) as total_allowances,
        SUM(overtime_amount) as total_overtime,
        SUM(bonus) as total_bonus,
        SUM(gross_salary) as total_gross,
        SUM(tax_deduction) as total_tax,
        SUM(provident_fund) as total_pf,
        SUM(insurance) as total_insurance,
        SUM(total_deductions) as total_deductions,
        SUM(net_salary) as total_net,
        AVG(net_salary) as average_net
      FROM payroll_records
      WHERE employee_id = ?
        AND pay_period_start >= ?
        AND pay_period_end <= ?
        AND payment_status = 'paid'
    `, [employeeId, startDate, endDate]);

    return {
      employee_id: employeeId,
      year,
      ytd_summary: ytdData[0],
      as_of_date: new Date().toISOString()
    };
  }
}

// =============================================
// PAYROLL NOTIFICATION SERVICE
// =============================================

class PayrollNotificationService {
  constructor(db, emailService) {
    this.db = db;
    this.emailService = emailService;
  }

  /**
   * Send payslip email to employee
   * @param {string} payrollRecordId - Payroll record ID
   * @returns {Promise<boolean>} Success status
   */
  async sendPayslipEmail(payrollRecordId) {
    try {
      // Get payroll and employee details
      const [record] = await this.db.execute(`
        SELECT 
          pr.*,
          e.email,
          e.first_name,
          e.last_name,
          c.name as company_name
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        JOIN clients c ON e.client_id = c.id
        WHERE pr.id = ?
      `, [payrollRecordId]);

      if (record.length === 0) {
        throw new Error('Payroll record not found');
      }

      const data = record[0];
      
      // Generate email content
      const emailContent = this.generatePayslipEmailContent(data);
      
      // Send email
      await this.emailService.send({
        to: data.email,
        subject: `Payslip for ${data.pay_period_start} to ${data.pay_period_end}`,
        html: emailContent
      });

      return true;
    } catch (error) {
      console.error('Error sending payslip email:', error);
      return false;
    }
  }

  /**
   * Generate payslip email HTML content
   * @param {object} payrollData - Payroll data
   * @returns {string} HTML content
   */
  generatePayslipEmailContent(payrollData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .header { background-color: #f8f9fa; padding: 20px; }
          .content { padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          .summary { background-color: #e9ecef; padding: 15px; margin-top: 20px; }
          .amount { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${payrollData.company_name}</h2>
          <h3>Payslip</h3>
        </div>
        <div class="content">
          <p>Dear ${payrollData.first_name} ${payrollData.last_name},</p>
          <p>Please find below your payslip for the period ${payrollData.pay_period_start} to ${payrollData.pay_period_end}.</p>
          
          <h4>Earnings</h4>
          <table>
            <tr><td>Base Salary</td><td class="amount">${payrollData.base_salary}</td></tr>
            <tr><td>Allowances</td><td class="amount">${payrollData.allowances}</td></tr>
            <tr><td>Overtime</td><td class="amount">${payrollData.overtime_amount}</td></tr>
            <tr><td>Bonus</td><td class="amount">${payrollData.bonus}</td></tr>
            <tr><th>Gross Salary</th><th class="amount">${payrollData.gross_salary}</th></tr>
          </table>
          
          <h4>Deductions</h4>
          <table>
            <tr><td>Tax</td><td class="amount">${payrollData.tax_deduction}</td></tr>
            <tr><td>Provident Fund</td><td class="amount">${payrollData.provident_fund}</td></tr>
            <tr><td>Insurance</td><td class="amount">${payrollData.insurance}</td></tr>
            <tr><th>Total Deductions</th><th class="amount">${payrollData.total_deductions}</th></tr>
          </table>
          
          <div class="summary">
            <h3>Net Salary: ${payrollData.net_salary}</h3>
            <p>Payment Status: ${payrollData.payment_status}</p>
            <p>Payment Method: ${payrollData.payment_method}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send bulk payroll notifications
   * @param {array} payrollRecordIds - Array of payroll record IDs
   * @returns {Promise<object>} Results summary
   */
  async sendBulkNotifications(payrollRecordIds) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const recordId of payrollRecordIds) {
      const success = await this.sendPayslipEmail(recordId);
      if (success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(recordId);
      }
    }

    return results;
  }
}

// =============================================
// PAYROLL SCHEDULER SERVICE
// =============================================

class PayrollScheduler {
  constructor(db, payrollService) {
    this.db = db;
    this.payrollService = payrollService;
  }

  /**
   * Schedule automatic payroll processing
   * @param {string} clientId - Client ID
   * @param {object} schedule - Schedule configuration
   * @returns {Promise<string>} Schedule ID
   */
  async createSchedule(clientId, schedule) {
    const scheduleId = uuidv4();
    
    await this.db.execute(`
      INSERT INTO payroll_schedules (
        id, client_id, schedule_name, frequency, 
        day_of_month, processing_time, is_active,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      scheduleId, clientId, schedule.name,
      schedule.frequency, schedule.dayOfMonth,
      schedule.processingTime, true
    ]);

    return scheduleId;
  }

  /**
   * Process scheduled payrolls
   * @returns {Promise<object>} Processing results
   */
  async processScheduledPayrolls() {
    const today = new Date();
    const currentDay = today.getDate();
    const currentTime = today.toTimeString().slice(0, 5);

    // Get active schedules for today
    const [schedules] = await this.db.execute(`
      SELECT * FROM payroll_schedules
      WHERE is_active = true
        AND day_of_month = ?
        AND processing_time <= ?
        AND last_processed_date < CURDATE()
    `, [currentDay, currentTime]);

    const results = [];

    for (const schedule of schedules) {
      try {
        // Get employees for this client
        const [employees] = await this.db.execute(`
          SELECT id FROM employees
          WHERE client_id = ?
            AND employment_status = 'active'
        `, [schedule.client_id]);

        const employeeIds = employees.map(e => e.id);
        
        // Process payroll
        const payPeriod = this.calculatePayPeriod(schedule.frequency);
        const processingResult = await this.payrollService.batchProcessPayroll(
          employeeIds,
          payPeriod,
          schedule.default_values
        );

        // Update schedule
        await this.db.execute(`
          UPDATE payroll_schedules
          SET last_processed_date = CURDATE(),
              last_result = ?
          WHERE id = ?
        `, [JSON.stringify(processingResult.summary), schedule.id]);

        results.push({
          schedule_id: schedule.id,
          client_id: schedule.client_id,
          result: processingResult
        });

      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        results.push({
          schedule_id: schedule.id,
          client_id: schedule.client_id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Calculate pay period based on frequency
   * @param {string} frequency - Payment frequency
   * @returns {object} Pay period dates
   */
  calculatePayPeriod(frequency) {
    const today = new Date();
    let start, end;

    switch (frequency) {
      case 'monthly':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      
      case 'bi-weekly':
        const dayOfMonth = today.getDate();
        if (dayOfMonth <= 15) {
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today.getFullYear(), today.getMonth(), 15);
        } else {
          start = new Date(today.getFullYear(), today.getMonth(), 16);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        break;
      
      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        start = weekStart;
        end = weekEnd;
        break;
      
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }
}

module.exports = {
  PayrollService,
  PayrollNotificationService,
  PayrollScheduler
};