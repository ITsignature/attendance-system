// =============================================
// PAYROLL CALCULATION ENGINE (Frontend)
// =============================================
// Performs ALL payroll calculations in the browser
// 100x faster than backend calculation!

export interface EmployeeData {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  base_salary: number;
  weekday_hourly_rate: number;
  saturday_hourly_rate: number;
  sunday_hourly_rate: number;
  weekday_daily_hours: number;
  saturday_daily_hours: number;
  sunday_daily_hours: number;
  weekday_working_days: number;
  working_saturdays: number;
  working_sundays: number;
  daily_salary: number;
  department_name: string;
}

export interface AttendanceData {
  employee_id: string;
  completed_weekday_hours: number;
  completed_saturday_hours: number;
  completed_sunday_hours: number;
}

export interface ActiveSession {
  employee_id: string;
  check_in_time: string;
  scheduled_in_time: string;
  is_weekend: number; // 1=Sunday, 2-6=Weekday, 7=Saturday
}

export interface AllowanceData {
  employee_id: string;
  id: string;
  allowance_name: string;
  amount: number;
  allowance_type: string;
}

export interface DeductionData {
  employee_id: string;
  id: string;
  deduction_name: string;
  amount: number;
  deduction_type: string;
}

export interface LoanData {
  employee_id: string;
  id: string;
  loan_amount: number;
  remaining_balance: number;
  monthly_deduction_amount: number;
  start_date: string;
  end_date: string | null;
  status: string;
  loan_type: string;
}

export interface AdvanceData {
  employee_id: string;
  id: string;
  advance_amount: number;
  remaining_balance: number;
  monthly_deduction_amount: number;
  advance_date: string;
  deduction_start_date: string;
  status: string;
}

export interface BonusData {
  employee_id: string;
  id: string;
  bonus_amount: number;
  bonus_type: string;
  bonus_date: string;
  description: string;
  status: string;
}

export interface PayrollResult {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  base_salary: number;

  // Hours breakdown
  expected_hours: {
    weekday: number;
    saturday: number;
    sunday: number;
    total: number;
  };
  actual_hours: {
    weekday: number;
    saturday: number;
    sunday: number;
    total: number;
  };

  // Salary breakdown
  expected_earned: number;
  actual_earned: number;
  attendance_deduction: number;

  total_allowances: number;
  total_deductions: number;

  // Financial records
  loan_deductions: number;
  advance_deductions: number;
  bonuses: number;

  gross_salary: number;
  net_salary: number;

  // Live session info
  has_live_session: boolean;
  live_session_hours: number;
  live_session_day_type: 'weekday' | 'saturday' | 'sunday' | null;

  calculated_at: Date;
}

export class PayrollCalculationEngine {

  /**
   * Calculate payroll for a single employee
   */
  calculateEmployee(
    employee: EmployeeData,
    attendance: AttendanceData | undefined,
    activeSession: ActiveSession | undefined,
    allowances: AllowanceData[],
    deductions: DeductionData[],
    loans: LoanData[],
    advances: AdvanceData[],
    bonuses: BonusData[]
  ): PayrollResult {

    const now = new Date();

    // =============================================
    // 1. CALCULATE TODAY'S LIVE SESSION
    // =============================================

    let todayLiveHours = 0;
    let todayExpectedHours = 0;
    let todayDayType: 'weekday' | 'saturday' | 'sunday' | null = null;

    if (activeSession) {
      // Determine day type from is_weekend
      if (activeSession.is_weekend >= 2 && activeSession.is_weekend <= 6) {
        todayDayType = 'weekday';
      } else if (activeSession.is_weekend === 7) {
        todayDayType = 'saturday';
      } else if (activeSession.is_weekend === 1) {
        todayDayType = 'sunday';
      }

      // Calculate expected hours: scheduled_in_time → NOW
      if (activeSession.scheduled_in_time) {
        todayExpectedHours = this.calculateHoursBetween(
          activeSession.scheduled_in_time,
          now
        );
      }

      // Calculate actual hours: check_in_time → NOW
      if (activeSession.check_in_time) {
        todayLiveHours = this.calculateHoursBetween(
          activeSession.check_in_time,
          now
        );
      }
    }

    // =============================================
    // 2. CALCULATE TOTAL ACTUAL HOURS
    // =============================================

    const completedWeekdayHours = attendance?.completed_weekday_hours || 0;
    const completedSaturdayHours = attendance?.completed_saturday_hours || 0;
    const completedSundayHours = attendance?.completed_sunday_hours || 0;

    const actualHours = {
      weekday: completedWeekdayHours + (todayDayType === 'weekday' ? todayLiveHours : 0),
      saturday: completedSaturdayHours + (todayDayType === 'saturday' ? todayLiveHours : 0),
      sunday: completedSundayHours + (todayDayType === 'sunday' ? todayLiveHours : 0),
      total: 0
    };
    actualHours.total = actualHours.weekday + actualHours.saturday + actualHours.sunday;

    // =============================================
    // 3. CALCULATE TOTAL EXPECTED HOURS
    // =============================================

    // Expected from completed days (until yesterday)
    const expectedWeekdayHours = (employee.weekday_working_days * employee.weekday_daily_hours) +
                                 (todayDayType === 'weekday' ? todayExpectedHours : 0);
    const expectedSaturdayHours = (employee.working_saturdays * employee.saturday_daily_hours) +
                                  (todayDayType === 'saturday' ? todayExpectedHours : 0);
    const expectedSundayHours = (employee.working_sundays * employee.sunday_daily_hours) +
                                (todayDayType === 'sunday' ? todayExpectedHours : 0);

    const expectedHours = {
      weekday: expectedWeekdayHours,
      saturday: expectedSaturdayHours,
      sunday: expectedSundayHours,
      total: expectedWeekdayHours + expectedSaturdayHours + expectedSundayHours
    };

    // =============================================
    // 4. CALCULATE EARNED SALARY
    // =============================================

    const expectedEarned =
      (expectedHours.weekday * employee.weekday_hourly_rate) +
      (expectedHours.saturday * employee.saturday_hourly_rate) +
      (expectedHours.sunday * employee.sunday_hourly_rate);

    const actualEarned =
      (actualHours.weekday * employee.weekday_hourly_rate) +
      (actualHours.saturday * employee.saturday_hourly_rate) +
      (actualHours.sunday * employee.sunday_hourly_rate);

    // =============================================
    // 5. CALCULATE ATTENDANCE DEDUCTION
    // =============================================

    const attendanceDeduction = Math.max(0, expectedEarned - actualEarned);

    // =============================================
    // 6. CALCULATE ALLOWANCES & DEDUCTIONS
    // =============================================

    const totalAllowances = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);

    // =============================================
    // 7. CALCULATE FINANCIAL RECORDS (LOANS, ADVANCES, BONUSES)
    // =============================================

    // Calculate loan deductions (monthly installment amount)
    const loanDeductions = loans.reduce((sum, loan) => {
      return sum + (loan.monthly_deduction_amount || 0);
    }, 0);

    // Calculate advance deductions (monthly installment amount)
    const advanceDeductions = advances.reduce((sum, advance) => {
      return sum + (advance.monthly_deduction_amount || 0);
    }, 0);

    // Calculate bonuses (full amount for this period)
    const bonusAdditions = bonuses.reduce((sum, bonus) => {
      return sum + (bonus.bonus_amount || 0);
    }, 0);

    // =============================================
    // 8. CALCULATE FINAL SALARY
    // =============================================

    // Gross = Base + Allowances + Bonuses
    const grossSalary = employee.base_salary + totalAllowances + bonusAdditions;

    // Total Deductions = Regular Deductions + Attendance + Loans + Advances
    const totalDeductionsIncludingAll =
      totalDeductions +
      attendanceDeduction +
      loanDeductions +
      advanceDeductions;

    const netSalary = grossSalary - totalDeductionsIncludingAll;

    // =============================================
    // 9. RETURN RESULT
    // =============================================

    return {
      employee_id: employee.employee_id,
      employee_code: employee.employee_code,
      employee_name: employee.employee_name,
      department_name: employee.department_name,
      base_salary: employee.base_salary,

      expected_hours: expectedHours,
      actual_hours: actualHours,

      expected_earned: this.round(expectedEarned),
      actual_earned: this.round(actualEarned),
      attendance_deduction: this.round(attendanceDeduction),

      total_allowances: this.round(totalAllowances),
      total_deductions: this.round(totalDeductionsIncludingAll),

      // Financial records
      loan_deductions: this.round(loanDeductions),
      advance_deductions: this.round(advanceDeductions),
      bonuses: this.round(bonusAdditions),

      gross_salary: this.round(grossSalary),
      net_salary: this.round(netSalary),

      has_live_session: !!activeSession,
      live_session_hours: todayLiveHours,
      live_session_day_type: todayDayType,

      calculated_at: now
    };
  }

  /**
   * Calculate payroll for all employees
   */
  calculateAll(
    employees: EmployeeData[],
    attendance: AttendanceData[],
    activeSessions: ActiveSession[],
    allowances: AllowanceData[],
    deductions: DeductionData[],
    loans: LoanData[],
    advances: AdvanceData[],
    bonuses: BonusData[]
  ): PayrollResult[] {

    return employees.map(employee => {
      // Find data for this employee
      const empAttendance = attendance.find(a => a.employee_id === employee.employee_id);
      const empSession = activeSessions.find(s => s.employee_id === employee.employee_id);
      const empAllowances = allowances.filter(a => a.employee_id === employee.employee_id);
      const empDeductions = deductions.filter(d => d.employee_id === employee.employee_id);
      const empLoans = loans.filter(l => l.employee_id === employee.employee_id);
      const empAdvances = advances.filter(a => a.employee_id === employee.employee_id);
      const empBonuses = bonuses.filter(b => b.employee_id === employee.employee_id);

      return this.calculateEmployee(
        employee,
        empAttendance,
        empSession,
        empAllowances,
        empDeductions,
        empLoans,
        empAdvances,
        empBonuses
      );
    });
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Calculate hours between a time string and a date
   */
  private calculateHoursBetween(timeStr: string, endDate: Date): number {
    try {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);

      const startDate = new Date();
      startDate.setHours(hours, minutes, seconds || 0, 0);

      // If start time is in the future, return 0
      if (startDate > endDate) {
        return 0;
      }

      const diffMs = endDate.getTime() - startDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return Math.max(0, diffHours);
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 0;
    }
  }

  /**
   * Round to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

// Export singleton instance
export const payrollCalculationEngine = new PayrollCalculationEngine();
