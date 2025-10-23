/**
 * Frontend Live Payroll Calculation Service
 * This service replicates the backend payroll calculation logic in TypeScript
 * to enable fast, real-time salary calculations without database operations
 */

interface EmployeeData {
  record_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  designation_name: string;
  base_salary: number;
  department_id: string;
  attendance: {
    expected_salary: number;
    earned_salary: number;
    shortfall: number;
    components: any[];
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
  }>;
  financial: {
    loans: number;
    advances: number;
    bonuses: number;
    loanRecords: any[];
    advanceRecords: any[];
    bonusRecords: any[];
  };
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
  allowances_total: number;
  bonuses_total: number;
  total_earnings: number;
  gross_salary: number;
  epf_employee: number;
  etf_employer: number;
  deductions_total: number;
  net_salary: number;
}

class LivePayrollCalculationService {
  /**
   * Calculate allowances for an employee
   */
  calculateAllowances(employee: EmployeeData): number {
    let total = 0;

    if (!employee.allowances || employee.allowances.length === 0) {
      return 0;
    }

    employee.allowances.forEach(allowance => {
      let amount = parseFloat(allowance.amount as any) || 0;

      if (allowance.is_percentage) {
        // Percentage-based allowance (calculated on base salary)
        amount = (employee.base_salary * amount) / 100;
      }

      total += amount;
    });

    return Math.round(total * 100) / 100;
  }

  /**
   * Calculate EPF and ETF deductions
   */
  calculateStatutoryDeductions(actualEarnedBase: number, employee: EmployeeData): {
    epf_employee: number;
    etf_employer: number;
    total: number;
  } {
    let epf_employee = 0;
    let etf_employer = 0;

    if (!employee.deductions || employee.deductions.length === 0) {
      return { epf_employee: 0, etf_employer: 0, total: 0 };
    }

    employee.deductions.forEach(deduction => {
      const value = parseFloat(deduction.calculation_value as any) || 0;

      if (deduction.calculation_type === 'percentage') {
        const amount = (actualEarnedBase * value) / 100;

        // Identify EPF vs ETF by category or name
        if (deduction.category === 'epf' || deduction.component_name.toLowerCase().includes('epf')) {
          epf_employee += amount;
        } else if (deduction.category === 'etf' || deduction.component_name.toLowerCase().includes('etf')) {
          etf_employer += amount;
        }
      }
    });

    return {
      epf_employee: Math.round(epf_employee * 100) / 100,
      etf_employer: Math.round(etf_employer * 100) / 100,
      total: Math.round((epf_employee + etf_employer) * 100) / 100
    };
  }

  /**
   * Calculate payroll for a single employee
   */
  calculateEmployee(employee: EmployeeData): CalculatedPayroll {
    // Step 1: Get attendance-based salary
    const expected_base_salary = employee.attendance.expected_salary;
    const actual_earned_base = employee.attendance.earned_salary;
    const attendance_shortfall = employee.attendance.shortfall;

    // Step 2: Calculate allowances (full amount, not prorated)
    const allowances_total = this.calculateAllowances(employee);

    // Step 3: Get financial bonuses
    const bonuses_total = employee.financial.bonuses;

    // Step 4: Calculate statutory deductions (EPF/ETF on actual earned base only)
    const statutoryDeductions = this.calculateStatutoryDeductions(actual_earned_base, employee);

    // Step 5: Calculate financial deductions
    const financial_deductions = employee.financial.loans + employee.financial.advances;

    // Step 6: Calculate totals
    const total_earnings = allowances_total + bonuses_total; // Excludes base salary
    const gross_salary = actual_earned_base + allowances_total + bonuses_total;
    const deductions_total = statutoryDeductions.total + financial_deductions;
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
      allowances_total: Math.round(allowances_total * 100) / 100,
      bonuses_total: Math.round(bonuses_total * 100) / 100,
      total_earnings: Math.round(total_earnings * 100) / 100,
      gross_salary: Math.round(gross_salary * 100) / 100,
      epf_employee: statutoryDeductions.epf_employee,
      etf_employer: statutoryDeductions.etf_employer,
      deductions_total: Math.round(deductions_total * 100) / 100,
      net_salary: Math.round(net_salary * 100) / 100
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
export type { EmployeeData, CalculatedPayroll };
