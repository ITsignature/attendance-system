/**
 * Frontend Live Payroll Calculation Service
 * This service replicates the backend payroll calculation logic in TypeScript
 * to enable fast, real-time salary calculations without database operations
 */

interface PaidLeaveDetail {
  start_date: string;
  end_date: string;
  duration_type: 'full_day' | 'half_day' | 'short_leave';
  short_leave_start: string | null;
  short_leave_end: string | null;
  hours: number;
  earned: number;
}

interface EarningsBySource {
  attendance: {
    hours: number;
    earned: number;
  };
  paid_leaves: {
    hours: number;
    earned: number;
    details?: PaidLeaveDetail[];
  };
  live_session: {
    hours: number;
    earned: number;
  };
  overtime?: {
    minutes: number;
    earned: number;
  };
  extra_time_ot?: {
    minutes: number;
    seconds: number;
    hourly_rate: number;
    multiplier: number;
    earned: number;
  };
  non_working_day_credit?: {
    earned: number;
    breakdown: {
      holidays: number;
      non_working_saturdays: number;
      non_working_sundays: number;
      daily_rate: number;
    };
    dates?: {
      holidays: string[];
      non_working_saturdays: string[];
      non_working_sundays: string[];
    };
  };
}

export type { PaidLeaveDetail };

interface UnpaidTimeOffDetail {
  start_date: string;
  end_date: string;
  duration_type: 'full_day' | 'half_day' | 'short_leave';
  short_leave_start: string | null;
  short_leave_end: string | null;
  hours: number;
  deduction: number;
}

interface TimeVarianceDetail {
  date: string;
  expected_hours: number;
  actual_hours: number;
  shortfall_hours: number;
  deduction: number;
}

interface AbsentDayDetail {
  date: string;
  deduction: number;
}

interface ShortfallByCause {
  unpaid_time_off: {
    hours: number;
    deduction: number;
    details?: UnpaidTimeOffDetail[];
  };
  time_variance: {
    hours: number;
    deduction: number;
    details?: TimeVarianceDetail[];
  };
  absent_days: {
    deduction: number;
    details?: AbsentDayDetail[];
  };
}

export type { UnpaidTimeOffDetail, TimeVarianceDetail, AbsentDayDetail };

interface EmployeeData {
  record_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  designation_name: string;
  base_salary: number;
  department_id: string;
  apit_enabled?: boolean | number;
  attendance: {
    expected_salary: number;
    earned_salary: number;
    shortfall: number;
    components: any[];
    earnings_by_source?: EarningsBySource | null;
    shortfall_by_cause?: ShortfallByCause | null;
  };
  allowances: Array<{
    id: string;
    allowance_name: string;
    allowance_type: string;
    amount: number;
    is_percentage: boolean;
    is_taxable: boolean;
  }>;
  deductions: Array<{
    id: string;
    component_name: string;
    calculation_type: string;
    calculation_value: number;
    category: string;
    deduct_from_base_salary?: boolean;
  }>;
  financial: {
    loans: number;
    advances: number;
    bonuses: number;
    loanRecords: any[];
    advanceRecords: any[];
    bonusRecords: any[];
  };
  overtime: {
    total_amount: number;
    records: Array<{
      date: string;
      day_type: string;
      total_minutes: number;
      pre_shift_minutes: number;
      post_shift_minutes: number;
      pre_shift_enabled: boolean;
      post_shift_enabled: boolean;
      hourly_rate: number;
      multiplier: number;
      amount: number;
    }>;
  };
}

interface AllowanceBreakdown {
  id: string;
  name: string;
  amount: number;
  is_percentage: boolean;
}

interface DeductionBreakdown {
  id: string;
  name: string;
  amount: number;
  category: string;
}

interface FinancialBreakdown {
  type: 'loan' | 'advance' | 'bonus';
  description: string;
  amount: number;
}

interface CalculatedPayroll {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  base_salary: number;
  expected_base_salary: number;
  actual_earned_base: number;
  attendance_shortfall: number;
  overtime_amount: number;
  allowances_total: number;
  allowances_breakdown: AllowanceBreakdown[];
  bonuses_total: number;
  bonuses_breakdown: FinancialBreakdown[];
  total_earnings: number;
  gross_salary: number;
  epf_employee: number;
  etf_employer: number;
  apit: number;
  deductions_total: number;
  deductions_breakdown: DeductionBreakdown[];
  financial_deductions_breakdown: FinancialBreakdown[];
  net_salary: number;
  earnings_by_source?: EarningsBySource | null;
  shortfall_by_cause?: ShortfallByCause | null;
  overtime_records?: Array<{
    date: string;
    day_type: string;
    total_minutes: number;
    pre_shift_minutes: number;
    post_shift_minutes: number;
    pre_shift_enabled: boolean;
    post_shift_enabled: boolean;
    hourly_rate: number;
    multiplier: number;
    amount: number;
  }>;
}

class LivePayrollCalculationService {
  /**
   * Calculate allowances for an employee
   */
  calculateAllowances(employee: EmployeeData): { total: number; breakdown: AllowanceBreakdown[] } {
    let total = 0;
    const breakdown: AllowanceBreakdown[] = [];

    if (!employee.allowances || employee.allowances.length === 0) {
      return { total: 0, breakdown: [] };
    }

    employee.allowances.forEach(allowance => {
      // Parse amount, defaulting to 0 if null/undefined/NaN
      const rawAmount = parseFloat(String(allowance.amount || 0));
      let amount = isNaN(rawAmount) ? 0 : rawAmount;

      if (allowance.is_percentage && amount > 0) {
        // Percentage-based allowance (calculated on base salary)
        amount = (employee.base_salary * amount) / 100;
      }

      const calculatedAmount = Math.round(amount * 100) / 100;

      breakdown.push({
        id: allowance.id,
        name: allowance.allowance_name,
        amount: calculatedAmount,
        is_percentage: allowance.is_percentage
      });

      total += calculatedAmount;
    });

    return {
      total: Math.round(total * 100) / 100,
      breakdown
    };
  }

  /**
   * Calculate all deductions (EPF, ETF, and employee-specific)
   */
  calculateStatutoryDeductions(actualEarnedBase: number, employee: EmployeeData): {
    epf_employee: number;
    etf_employer: number;
    total: number;
    breakdown: DeductionBreakdown[];
  } {
    let epf_employee = 0;
    let etf_employer = 0;
    let total = 0;
    const breakdown: DeductionBreakdown[] = [];
    const baseSalary = employee.base_salary || 0;

    if (!employee.deductions || employee.deductions.length === 0) {
      return { epf_employee: 0, etf_employer: 0, total: 0, breakdown: [] };
    }

    employee.deductions.forEach(deduction => {
      // Parse calculation value, defaulting to 0 if null/undefined/NaN
      const rawValue = parseFloat(String(deduction.calculation_value || 0));
      const value = isNaN(rawValue) ? 0 : rawValue;

      if (deduction.calculation_type === 'percentage' && value > 0) {
        // Use base salary if flagged, otherwise use actual earned (gross)
        const baseForCalc = deduction.deduct_from_base_salary ? baseSalary : actualEarnedBase;
        const amount = (baseForCalc * value) / 100;
        const calculatedAmount = Math.round(amount * 100) / 100;

        breakdown.push({
          id: deduction.id,
          name: deduction.component_name,
          amount: calculatedAmount,
          category: deduction.category
        });

        // Add to total
        total += calculatedAmount;

        // Identify EPF vs ETF by category or name
        if (deduction.category === 'epf' || deduction.component_name.toLowerCase().includes('epf')) {
          epf_employee += calculatedAmount;
        } else if (deduction.category === 'etf' || deduction.component_name.toLowerCase().includes('etf')) {
          etf_employer += calculatedAmount;
        }
      } else if (deduction.calculation_type === 'fixed' && value > 0) {
        // Handle fixed amount deductions
        const calculatedAmount = Math.round(value * 100) / 100;

        breakdown.push({
          id: deduction.id,
          name: deduction.component_name,
          amount: calculatedAmount,
          category: deduction.category
        });

        // Add to total
        total += calculatedAmount;

        // Add to appropriate category
        if (deduction.category === 'epf' || deduction.component_name.toLowerCase().includes('epf')) {
          epf_employee += calculatedAmount;
        } else if (deduction.category === 'etf' || deduction.component_name.toLowerCase().includes('etf')) {
          etf_employer += calculatedAmount;
        }
      }
    });

    return {
      epf_employee: Math.round(epf_employee * 100) / 100,
      etf_employer: Math.round(etf_employer * 100) / 100,
      total: Math.round(total * 100) / 100,
      breakdown
    };
  }

  /**
   * APIT (Advance Personal Income Tax) — Sri Lanka Summarized Tax Table
   * for Regular Profits from Employment.
   * Quick formula per band: tax = rate × monthly regular profits − relief.
   */
  calculateAPIT(monthlyRegularProfits: number): number {
    const income = monthlyRegularProfits || 0;

    const bands = [
      { upTo: 150000,   rate: 0,    relief: 0 },      // Band 1: relief from tax
      { upTo: 233333,   rate: 0.06, relief: 9000 },   // Band 2
      { upTo: 275000,   rate: 0.18, relief: 37000 },  // Band 3
      { upTo: 316667,   rate: 0.24, relief: 53500 },  // Band 4
      { upTo: 358333,   rate: 0.30, relief: 72500 },  // Band 5
      { upTo: Infinity, rate: 0.36, relief: 94000 }   // Band 6
    ];

    const band = bands.find(b => income <= b.upTo)!;
    return Math.max(0, income * band.rate - band.relief);
  }

  /**
   * Calculate payroll for a single employee
   */
  calculateEmployee(employee: EmployeeData): CalculatedPayroll {
    // Step 1: Get attendance-based salary
    const expected_base_salary = employee.attendance.expected_salary;
    let actual_earned_base = employee.attendance.earned_salary;
    const attendance_shortfall = employee.attendance.shortfall;

    // Step 1.5: Add non-working day credit for fixed-30 clients (holidays + non-working Sat/Sun)
    const non_working_day_credit = employee.attendance.earnings_by_source?.non_working_day_credit?.earned || 0;
    actual_earned_base += non_working_day_credit;

    // Step 1.6: Add overtime to actual earned base
    const overtime_amount = employee.overtime?.total_amount || 0;
    actual_earned_base += overtime_amount;

    // Add overtime to earnings_by_source if it exists
    let earnings_by_source = employee.attendance.earnings_by_source;
    if (overtime_amount > 0 && earnings_by_source) {
      const total_overtime_minutes = (employee.overtime?.records || []).reduce((sum, rec) => sum + rec.total_minutes, 0);
      earnings_by_source = {
        ...earnings_by_source,
        overtime: {
          minutes: total_overtime_minutes,
          earned: overtime_amount
        }
      };
    }

    // Step 2: Calculate allowances (full amount, not prorated)
    const allowancesResult = this.calculateAllowances(employee);

    // Step 3: Get financial bonuses with breakdown
    const bonuses_total = employee.financial.bonuses;
    const bonuses_breakdown: FinancialBreakdown[] = (employee.financial.bonusRecords || []).map((record: any) => ({
      type: 'bonus' as const,
      description: record.description || record.bonus_type || 'Bonus',
      amount: parseFloat(record.bonus_amount || record.addition_amount) || 0
    }));

    // Step 4: Calculate statutory deductions (EPF/ETF on actual earned base INCLUDING overtime)
    const statutoryDeductions = this.calculateStatutoryDeductions(actual_earned_base, employee);

    // Step 5: Calculate financial deductions with breakdown
    const financial_deductions = employee.financial.loans + employee.financial.advances;
    const financial_deductions_breakdown: FinancialBreakdown[] = [
      ...(employee.financial.loanRecords || []).map((record: any) => ({
        type: 'loan' as const,
        description: record.description || `Loan - ${record.loan_type || 'General'}`,
        amount: parseFloat(record.deduction_amount) || 0
      })),
      ...(employee.financial.advanceRecords || []).map((record: any) => ({
        type: 'advance' as const,
        description: record.description || `Advance - ${record.advance_type || 'General'}`,
        amount: parseFloat(record.deduction_amount) || 0
      }))
    ];

    // Step 6: Calculate totals
    const total_earnings = allowancesResult.total + bonuses_total; // Excludes base salary
    const gross_salary = actual_earned_base + allowancesResult.total + bonuses_total;

    // Step 6.5: APIT (income tax) — only for employees with apit_enabled flag
    const apitEnabled = employee.apit_enabled === true || employee.apit_enabled === 1;
    const apit = apitEnabled ? Math.round(this.calculateAPIT(gross_salary) * 100) / 100 : 0;

    const deductions_breakdown = [...statutoryDeductions.breakdown];
    if (apit > 0) {
      deductions_breakdown.push({
        id: 'apit',
        name: 'APIT (Income Tax)',
        amount: apit,
        category: 'tax'
      });
    }

    const deductions_total = statutoryDeductions.total + financial_deductions + apit;
    const net_salary = gross_salary - deductions_total;

    return {
      employee_id: employee.employee_id,
      employee_code: employee.employee_code,
      employee_name: employee.employee_name,
      department_name: employee.department_name,
      base_salary: employee.base_salary,
      expected_base_salary: Math.round(expected_base_salary * 100) / 100,
      actual_earned_base: Math.round(actual_earned_base * 100) / 100,
      attendance_shortfall: Math.round(attendance_shortfall * 100) / 100,
      overtime_amount: Math.round(overtime_amount * 100) / 100,
      allowances_total: Math.round(allowancesResult.total * 100) / 100,
      allowances_breakdown: allowancesResult.breakdown,
      bonuses_total: Math.round(bonuses_total * 100) / 100,
      bonuses_breakdown: bonuses_breakdown,
      total_earnings: Math.round(total_earnings * 100) / 100,
      gross_salary: Math.round(gross_salary * 100) / 100,
      epf_employee: statutoryDeductions.epf_employee,
      etf_employer: statutoryDeductions.etf_employer,
      apit: apit,
      deductions_total: Math.round(deductions_total * 100) / 100,
      deductions_breakdown: deductions_breakdown,
      financial_deductions_breakdown: financial_deductions_breakdown,
      net_salary: Math.round(net_salary * 100) / 100,
      earnings_by_source: earnings_by_source || null,
      shortfall_by_cause: employee.attendance.shortfall_by_cause || null,
      overtime_records: employee.overtime?.records || []
    };
  }

  /**
   * Calculate payroll for all employees
   */
  calculateAllEmployees(employees: EmployeeData[]): CalculatedPayroll[] {
    return employees.map(emp => this.calculateEmployee(emp));
  }
}

export const livePayrollCalculationService = new LivePayrollCalculationService();
export type { EmployeeData, CalculatedPayroll, AllowanceBreakdown, DeductionBreakdown, FinancialBreakdown };
