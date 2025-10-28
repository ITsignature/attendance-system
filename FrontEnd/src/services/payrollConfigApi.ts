import apiService from './api';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface PayrollComponent {
  id: string;
  component_name: string;
  component_type: 'earning' | 'deduction';
  category: string;
  calculation_type: 'fixed' | 'percentage' | 'formula';
  calculation_value: number;
  calculation_formula?: string;
  is_taxable: boolean;
  is_mandatory: boolean;
  applies_to: 'all' | 'department' | 'designation' | 'individual';
  applies_to_ids?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAllowance {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  allowance_type: string;
  allowance_name: string;
  amount: number;
  is_percentage: boolean;
  is_taxable: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to?: string;
  created_at: string;
}

export interface EmployeeDeduction {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  deduction_type: string;
  deduction_name: string;
  amount: number;
  is_percentage: boolean;
  is_recurring: boolean;
  remaining_installments?: number;
  is_active: boolean;
  effective_from: string;
  effective_to?: string;
  created_at: string;
}

export interface CreatePayrollComponentRequest {
  component_name: string;
  component_type: 'earning' | 'deduction';
  category: string;
  calculation_type: 'fixed' | 'percentage' | 'formula';
  calculation_value?: number;
  calculation_formula?: string;
  is_taxable?: boolean;
  is_mandatory?: boolean;
  applies_to?: 'all' | 'department' | 'designation' | 'individual';
  applies_to_ids?: string[];
}

export interface CreateEmployeeAllowanceRequest {
  employee_id: string;
  allowance_type: string;
  allowance_name: string;
  amount: number;
  is_percentage?: boolean;
  is_taxable?: boolean;
  effective_from: string;
  effective_to?: string;
}

export interface CreateEmployeeDeductionRequest {
  employee_id: string;
  deduction_type: string;
  deduction_name: string;
  amount: number;
  is_percentage?: boolean;
  is_recurring?: boolean;
  remaining_installments?: number;
  effective_from: string;
  effective_to?: string;
}

// =============================================
// PAYROLL CONFIG API SERVICE
// =============================================

class PayrollConfigApiService {

  // =============================================
  // PAYROLL COMPONENTS
  // =============================================

  async getPayrollComponents(): Promise<PayrollComponent[]> {
    const response = await apiService.apiCall('/api/payroll-runs/components');
    return response.data || [];
  }

  async createPayrollComponent(data: CreatePayrollComponentRequest): Promise<any> {
    return apiService.apiCall('/api/payroll-runs/components', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayrollComponent(id: string, data: Partial<CreatePayrollComponentRequest>): Promise<any> {
    return apiService.apiCall(`/api/payroll-runs/components/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePayrollComponent(id: string): Promise<any> {
    return apiService.apiCall(`/api/payroll-runs/components/${id}`, {
      method: 'DELETE',
    });
  }

  // =============================================
  // EMPLOYEE ALLOWANCES
  // =============================================

  async getEmployeeAllowances(employeeId?: string, activeOnly: boolean = true): Promise<EmployeeAllowance[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId);
    if (!activeOnly) params.append('active_only', 'false');

    const response = await apiService.apiCall(`/api/payroll-runs/employee-allowances?${params}`);
    return response.data || [];
  }

  async createEmployeeAllowance(data: CreateEmployeeAllowanceRequest): Promise<any> {
    return apiService.apiCall('/api/payroll-runs/employee-allowances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployeeAllowance(id: string, data: Partial<CreateEmployeeAllowanceRequest>): Promise<any> {
    return apiService.apiCall(`/api/payroll-runs/employee-allowances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmployeeAllowance(id: string): Promise<any> {
    return apiService.apiCall(`/api/payroll-runs/employee-allowances/${id}`, {
      method: 'DELETE',
    });
  }

  // =============================================
  // EMPLOYEE DEDUCTIONS
  // =============================================

  async getEmployeeDeductions(employeeId?: string, activeOnly: boolean = true): Promise<EmployeeDeduction[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId);
    if (!activeOnly) params.append('active_only', 'false');

    const response = await apiService.apiCall(`/api/payroll-runs/employee-deductions?${params}`);
    return response.data || [];
  }

  async createEmployeeDeduction(data: CreateEmployeeDeductionRequest): Promise<any> {
    return apiService.apiCall('/api/payroll-runs/employee-deductions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployeeDeduction(id: string, data: Partial<CreateEmployeeDeductionRequest>): Promise<any> {
    return apiService.apiCall(`/api/payroll-runs/employee-deductions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmployeeDeduction(id: string): Promise<any> {
    return apiService.apiCall(`/api/payroll-runs/employee-deductions/${id}`, {
      method: 'DELETE',
    });
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  getComponentCategories() {
    return [
      { value: 'basic', label: 'Basic Salary' },
      { value: 'allowance', label: 'Allowances' },
      { value: 'bonus', label: 'Bonuses' },
      { value: 'tax', label: 'Taxes' },
      { value: 'insurance', label: 'Insurance' },
      { value: 'loan', label: 'Loan Deductions' },
      { value: 'other', label: 'Other' }
    ];
  }

  getAllowanceTypes() {
    return [
      { value: 'house_allowance', label: 'House Allowance' },
      { value: 'transport_allowance', label: 'Transport Allowance' },
      { value: 'medical_allowance', label: 'Medical Allowance' },
      { value: 'communication_allowance', label: 'Communication Allowance' },
      { value: 'meal_allowance', label: 'Meal Allowance' },
      { value: 'special_allowance', label: 'Special Allowance' },
      { value: 'other_allowance', label: 'Other Allowance' }
    ];
  }

  getDeductionTypes() {
    return [
      { value: 'loan_deduction', label: 'Loan Deduction' },
      { value: 'advance_salary', label: 'Advance Salary' },
      { value: 'insurance', label: 'Insurance Premium' },
      { value: 'pension_fund', label: 'Pension Fund' },
      { value: 'disciplinary', label: 'Disciplinary Deduction' },
      { value: 'other_deduction', label: 'Other Deduction' }
    ];
  }

  getCalculationTypes() {
    return [
      { value: 'fixed', label: 'Fixed Amount' },
      { value: 'percentage', label: 'Percentage of Base Salary' },
      { value: 'formula', label: 'Custom Formula' }
    ];
  }

  getAppliesTo() {
    return [
      { value: 'all', label: 'All Employees' },
      { value: 'department', label: 'Specific Departments' },
      { value: 'designation', label: 'Specific Designations' },
      { value: 'individual', label: 'Individual Employees' }
    ];
  }
}

export default new PayrollConfigApiService();