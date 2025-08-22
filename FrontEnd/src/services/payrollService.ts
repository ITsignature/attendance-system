// services/payrollApi.ts

import apiService, { ApiResponse } from './api';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  payPeriod: {
    start: string;
    end: string;
  };
  earnings: {
    baseSalary: number;
    allowances: number;
    overtime: number;
    bonus: number;
    commission: number;
  };
  deductions: {
    tax: number;
    providentFund: number;
    insurance: number;
    loan: number;
    other: number;
  };
  summary: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
  };
  payment: {
    status: 'pending' | 'processing' | 'paid' | 'failed';
    method: 'bank_transfer' | 'cash' | 'cheque';
    date: string | null;
    reference: string | null;
  };
  processing: {
    processedBy: string | null;
    processedAt: string | null;
  };
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollFilters {
  month?: number;
  year?: number;
  status?: 'all' | 'pending' | 'processing' | 'paid' | 'failed';
  department_id?: string;
  employee_id?: string;
  payment_method?: 'bank_transfer' | 'cash' | 'cheque';
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface CreatePayrollData {
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  base_salary: number;
  allowances?: number;
  overtime_amount?: number;
  bonus?: number;
  commission?: number;
  tax_deduction?: number;
  provident_fund?: number;
  insurance?: number;
  loan_deduction?: number;
  other_deductions?: number;
  payment_method?: 'bank_transfer' | 'cash' | 'cheque';
  payment_date?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
}

export interface UpdatePayrollData extends Partial<CreatePayrollData> {}

export interface BulkProcessData {
  pay_period_start: string;
  pay_period_end: string;
  department_id?: string;
  employee_ids?: string[];
  auto_calculate_overtime?: boolean;
  default_allowances?: number;
  default_bonus?: number;
  tax_rate?: number;
  provident_fund_rate?: number;
  insurance_amount?: number;
}

export interface PayrollSummary {
  period: {
    year: number;
    month: number;
    start_date: string;
    end_date: string;
  };
  summary: {
    total_employees: number;
    total_records: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    average_net: number;
    highest_salary: number;
    lowest_salary: number;
    total_overtime: number;
    total_bonus: number;
    paid_count: number;
    pending_count: number;
    processing_count: number;
    failed_count: number;
  };
  department_breakdown: Array<{
    department_id: string;
    department_name: string;
    employee_count: number;
    total_gross: number;
    total_net: number;
    average_net: number;
  }>;
}

export interface Payslip {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  employee: {
    id: string;
    name: string;
    email: string;
    phone: string;
    designation: string;
    department: string;
    hire_date: string;
    bank_account: string | null;
    bank_name: string | null;
  };
  payroll: {
    id: string;
    period: {
      start: string;
      end: string;
    };
    earnings: {
      basic_salary: number;
      allowances: number;
      overtime: number;
      bonus: number;
      commission: number;
      gross_total: number;
    };
    deductions: {
      tax: number;
      provident_fund: number;
      insurance: number;
      loan: number;
      other: number;
      total: number;
    };
    net_salary: number;
    payment: {
      status: string;
      method: string;
      date: string | null;
      reference: string | null;
    };
  };
  generated_at: string;
}

export interface EmployeePayrollHistory {
  employee: {
    id: string;
    name: string;
  };
  history: Array<{
    id: string;
    pay_period_start: string;
    pay_period_end: string;
    base_salary: number;
    gross_salary: number;
    total_deductions: number;
    net_salary: number;
    payment_status: string;
    payment_method: string;
    payment_date: string | null;
    created_at: string;
  }>;
  statistics: {
    total_records: number;
    total_earned: number;
    average_salary: number;
    highest_salary: number;
    lowest_salary: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
}

// =============================================
// PAYROLL API SERVICE CLASS
// =============================================

class PayrollApiService {
  // Get payroll records with filters
  async getPayrollRecords(filters?: PayrollFilters): Promise<ApiResponse<{
    data: PayrollRecord[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      pages: number;
      current_page: number;
    };
    summary: {
      totalGross: number;
      totalDeductions: number;
      totalNet: number;
      statusCounts: {
        paid: number;
        pending: number;
        processing: number;
      };
    };
  }>> {
    const params = new URLSearchParams();
    
    

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();

    console.log("query",queryString);
    

    return apiService.apiCall(`/api/payroll${queryString ? `?${queryString}` : ''}`);
  }

  // Get single payroll record
  async getPayrollRecord(id: string): Promise<ApiResponse<PayrollRecord>> {
    return apiService.apiCall(`/api/payroll/${id}`);
  }

  // Create payroll record
  async createPayroll(data: CreatePayrollData): Promise<ApiResponse> {
    return apiService.apiCall('/api/payroll', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Update payroll record
  async updatePayroll(id: string, data: UpdatePayrollData): Promise<ApiResponse> {
    return apiService.apiCall(`/api/payroll/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Update payment status
  async updatePaymentStatus(id: string, status: string, paymentDate?: string, paymentReference?: string): Promise<ApiResponse> {
    return apiService.apiCall(`/api/payroll/${id}/payment-status`, {
      method: 'PATCH',
      body: JSON.stringify({
        payment_status: status,
        payment_date: paymentDate,
        payment_reference: paymentReference
      })
    });
  }

  // Delete payroll record
  async deletePayroll(id: string): Promise<ApiResponse> {
    return apiService.apiCall(`/api/payroll/${id}`, {
      method: 'DELETE'
    });
  }

  // Bulk process payroll
  async bulkProcess(data: BulkProcessData): Promise<ApiResponse> {
    return apiService.apiCall('/api/payroll/bulk-process', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Get payroll summary for a period
  async getPayrollSummary(period: string): Promise<ApiResponse<PayrollSummary>> {
    return apiService.apiCall(`/api/payroll/summary/${period}`);
  }

  // Generate payslip
  async getPayslip(id: string): Promise<ApiResponse<Payslip>> {
    return apiService.apiCall(`/api/payroll/${id}/payslip`);
  }

  // Get employee payroll history
  async getEmployeeHistory(employeeId: string, limit = 12, offset = 0): Promise<ApiResponse<EmployeePayrollHistory>> {
    return apiService.apiCall(`/api/payroll/employee/${employeeId}/history?limit=${limit}&offset=${offset}`);
  }

  // Export payroll data
  async exportPayroll(format: 'csv' | 'json', filters?: PayrollFilters): Promise<void | ApiResponse> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    const url = `/api/payroll/export/${format}${queryString ? `?${queryString}` : ''}`;

    if (format === 'csv') {
      // Handle CSV download
      const response = await fetch(`${apiService['baseURL']}${url}`, {
        headers: apiService['getHeaders']()
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `payroll_export_${filters?.year}_${filters?.month}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } else {
      // Return JSON data
      return apiService.apiCall(url);
    }
  }

  // Helper method to format currency
  formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Helper method to format date
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Helper to get payment status color
  getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'processing':
        return 'info';
      case 'failed':
        return 'failure';
      default:
        return 'gray';
    }
  }

  // Helper to calculate current month earned salary
  calculateEarnedTillDate(netSalary: number, payPeriodStart: string, payPeriodEnd: string): number {
    const today = new Date();
    const startDate = new Date(payPeriodStart);
    const endDate = new Date(payPeriodEnd);
    
    // If today is after the period end, return full salary
    if (today >= endDate) {
      return netSalary;
    }
    
    // If today is before the period start, return 0
    if (today < startDate) {
      return 0;
    }
    
    // Calculate proportional salary
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dailyRate = netSalary / totalDays;
    
    return Math.round(dailyRate * daysElapsed);
  }
}

// Export singleton instance
export const payrollApiService = new PayrollApiService();
export default payrollApiService;