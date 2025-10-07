// =============================================
// PAYROLL RUN SERVICE - INDUSTRY STANDARD FRONTEND
// =============================================
// Frontend service for managing payroll runs (batches) instead of individual records
// Implements modern payroll workflow: Create Run → Calculate → Process

import apiService, { ApiResponse } from './api';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface PayrollRun {
  id: string;
  run_number: string;
  run_name: string;
  run_type: 'regular' | 'bonus' | 'correction' | 'off-cycle';
  run_status: 'draft' | 'calculating' | 'calculated' | 'processing' | 'completed' | 'cancelled';
  period_id: string;
  period_start_date: string;
  period_end_date: string;
  pay_date: string;
  
  // Statistics
  total_employees: number;
  processed_employees: number;
  total_gross_amount: number;
  total_deductions_amount: number;
  total_net_amount: number;
  
  // Workflow tracking
  created_by: string;
  created_by_name: string;
  processed_by?: string;
  processed_by_name?: string;

  // Timestamps
  created_at: string;
  processed_at?: string;
  completed_at?: string;
  
  calculation_method: 'simple' | 'advanced';
  notes?: string;
  processing_errors?: any;
}

export interface CreatePayrollRunData {
  period_id: string;
  run_name: string;
  run_type?: 'regular' | 'bonus' | 'correction' | 'off-cycle';
  calculation_method?: 'simple' | 'advanced';
  employee_filters?: {
    department_id?: string;
    employee_ids?: string[];
    employee_type?: 'full-time' | 'part-time' | 'contract' | 'intern';
  };
  notes?: string;
}

export interface PayrollRunFilters {
  status?: 'draft' | 'calculating' | 'calculated' | 'processing' | 'completed' | 'cancelled' | 'all';
  period_id?: string;
  run_type?: 'regular' | 'bonus' | 'correction' | 'off-cycle';
  limit?: number;
  offset?: number;
}

export interface ProcessPaymentData {
  payment_method?: 'bank_transfer' | 'cash' | 'cheque';
  payment_date?: string;
  batch_reference?: string;
}

export interface WorkflowStatus {
  workflow: {
    id: string;
    status: 'active' | 'completed' | 'rejected';
    current_level: number;
    total_levels: number;
    initiated_by_name: string;
    created_at: string;
    completed_at?: string;
  };
  steps: Array<{
    step_level: number;
    step_name: string;
    step_title: string;
    status: 'pending' | 'active' | 'approved' | 'rejected';
    required_role: string;
    approved_by_name?: string;
    approved_at?: string;
  }>;
  approvals: Array<{
    approval_level: string;
    approval_status: string;
    approval_date: string;
    comments: string;
    approver_name: string;
  }>;
  current_step?: any;
  completed_steps: any[];
  pending_steps: any[];
}

export interface PayrollPeriod {
  id: string;
  period_number: number;
  period_year: number;
  period_type: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  period_start_date: string;
  period_end_date: string;
  cut_off_date: string;
  pay_date: string;
  status: 'active' | 'closed' | 'archived';
}

// =============================================
// PAYROLL RUN API SERVICE CLASS
// =============================================

class PayrollRunApiService {

  // =============================================
  // PAYROLL RUN CRUD OPERATIONS
  // =============================================

  /**
   * Get paginated list of payroll runs
   */
  async getPayrollRuns(filters?: PayrollRunFilters): Promise<ApiResponse<PayrollRun[]>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    return apiService.apiCall(`/api/payroll-runs${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get single payroll run with full details
   */
  async getPayrollRun(runId: string): Promise<ApiResponse<PayrollRun>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}`);
  }

  /**
   * Create new payroll run
   */
  async createPayrollRun(data: CreatePayrollRunData): Promise<ApiResponse<{
    run_id: string;
    run_number: string;
    total_employees: number;
    status: string;
  }>> {
    return apiService.apiCall('/api/payroll-runs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // =============================================
  // PAYROLL RUN PROCESSING WORKFLOW
  // =============================================

  /**
   * Calculate payroll for entire run
   */
  async calculatePayrollRun(runId: string): Promise<ApiResponse<{
    run_id: string;
    processed_records: number;
    error_records: number;
    status: string;
  }>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/calculate`, {
      method: 'POST'
    });
  }

  /**
   * Process payments for calculated payroll run
   */
  async processPayrollRun(runId: string, paymentData: ProcessPaymentData = {}): Promise<ApiResponse<{
    run_id: string;
    records_processed: number;
    payment_date: string;
    status: string;
  }>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/process`, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  /**
   * Cancel payroll run
   */
  async cancelPayrollRun(runId: string, cancellationReason: string): Promise<ApiResponse> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellation_reason: cancellationReason })
    });
  }

  // =============================================
  // WORKFLOW & APPROVAL METHODS
  // =============================================

  /**
   * Get workflow status for payroll run
   */
  async getWorkflowStatus(runId: string): Promise<ApiResponse<WorkflowStatus>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/workflow`);
  }

  /**
   * Get component breakdown for a specific payroll record
   */
  async getRecordComponents(recordId: string): Promise<ApiResponse<Array<{
    id: string;
    component_code: string;
    component_name: string;
    component_type: 'earning' | 'deduction' | 'tax';
    component_category: string;
    calculated_amount: number;
    calculation_method: string;
    details?: string;
  }>>> {
    return apiService.apiCall(`/api/payroll-runs/records/${recordId}/components`);
  }

  /**
   * Get individual employee records for a payroll run
   */
  async getPayrollRecords(runId: string): Promise<ApiResponse<Array<{
    id: string;
    employee_id: string;
    employee_code: string;
    employee_name: string;
    department_name: string;
    designation_name: string;
    calculation_status: string;
    worked_days: number;
    worked_hours: number;
    overtime_hours: number;
    leave_days: number;
    total_earnings: number;
    total_deductions: number;
    total_taxes: number;
    gross_salary: number;
    taxable_income: number;
    net_salary: number;
    payment_status: string;
    payment_method: string;
    payment_date: string;
    calculated_at: string;
    notes: string;
    base_salary: number;
  }>>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/records`);
  }

  /**
   * Get pending approvals for current user
   */
  async getPendingApprovals(): Promise<ApiResponse<Array<{
    run_id: string;
    run_number: string;
    run_name: string;
    total_employees: number;
    total_net_amount: number;
    step_name: string;
    step_title: string;
    hours_pending: number;
    period_start_date: string;
    period_end_date: string;
  }>>> {
    return apiService.apiCall('/api/payroll-runs/approvals/pending');
  }

  /**
   * Get approval history for payroll run
   */
  async getApprovalHistory(runId: string): Promise<ApiResponse<Array<{
    approval_level: string;
    approval_status: string;
    approval_date: string;
    comments: string;
    approver_name: string;
    approver_email: string;
  }>>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/approvals`);
  }

  // =============================================
  // PAYROLL RUN DATA ACCESS
  // =============================================

  /**
   * Get payroll records within a run
   */
  async getRunRecords(runId: string, filters?: {
    status?: 'pending' | 'calculating' | 'calculated' | 'error' | 'excluded';
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    data: any[];
    pagination: any;
  }>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    return apiService.apiCall(`/api/payroll-runs/${runId}/records${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get payroll run summary and statistics
   */
  async getRunSummary(runId: string): Promise<ApiResponse<{
    run_info: {
      id: string;
      run_number: string;
      run_name: string;
      status: string;
      period: {
        start: string;
        end: string;
        pay_date: string;
      };
    };
    statistics: {
      total_employees: number;
      processed_employees: number;
      total_gross_amount: number;
      total_deductions_amount: number;
      total_net_amount: number;
    };
    workflow: {
      created_at: string;
      created_by: string;
      reviewed_at?: string;
      reviewed_by?: string;
      approved_at?: string;
      approved_by?: string;
      processed_at?: string;
      processed_by?: string;
    };
  }>> {
    return apiService.apiCall(`/api/payroll-runs/${runId}/summary`);
  }

  // =============================================
  // PAYROLL PERIODS MANAGEMENT
  // =============================================

  /**
   * Get available payroll periods for creating runs
   */
  async getAvailablePeriods(): Promise<ApiResponse<PayrollPeriod[]>> {
    return apiService.apiCall('/api/payroll-runs/periods/available');
  }

  /**
   * Create new payroll period
   */
  async createPayrollPeriod(data: {
    period_type: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
    period_start_date: string;
    period_end_date: string;
    pay_date: string;
    cut_off_date: string;
  }): Promise<ApiResponse> {
    return apiService.apiCall('/api/payroll-runs/periods', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get status color for UI display
   */
  getRunStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'draft': 'gray',
      'calculating': 'yellow',
      'calculated': 'blue',
      'processing': 'purple',
      'completed': 'success',
      'cancelled': 'failure'
    };

    return colorMap[status] || 'gray';
  }

  /**
   * Get status icon for UI display
   */
  getRunStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      'draft': '📝',
      'calculating': '⚙️',
      'calculated': '🧮',
      'processing': '💳',
      'completed': '🎉',
      'cancelled': '❌'
    };

    return iconMap[status] || '📄';
  }

  /**
   * Get human readable status text
   */
  getRunStatusText(status: string): string {
    const textMap: Record<string, string> = {
      'draft': 'Draft',
      'calculating': 'Calculating...',
      'calculated': 'Calculated',
      'processing': 'Processing Payments',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };

    return textMap[status] || status;
  }

  /**
   * Check if user can perform action on run
   */
  canPerformAction(run: PayrollRun, action: string): boolean {
    const actionMatrix: Record<string, string[]> = {
      'calculate': ['draft', 'calculating'],
      'process': ['calculated'],
      'cancel': ['draft', 'calculated']
    };

    return actionMatrix[action]?.includes(run.run_status) || false;
  }

  /**
   * Get next possible actions for run
   */
  getAvailableActions(run: PayrollRun): Array<{
    action: string;
    label: string;
    color: string;
    permission: string;
  }> {
    const actions = [];
    
    if (this.canPerformAction(run, 'calculate')) {
      actions.push({
        action: 'calculate',
        label: 'Calculate Payroll',
        color: 'blue',
        permission: 'payroll.process'
      });
    }

    if (this.canPerformAction(run, 'process')) {
      actions.push({
        action: 'process',
        label: 'Process Payments',
        color: 'purple',
        permission: 'payroll.process'
      });
    }
    
    if (this.canPerformAction(run, 'cancel')) {
      actions.push({
        action: 'cancel',
        label: 'Cancel Run',
        color: 'red',
        permission: 'payroll.edit'
      });
    }
    
    return actions;
  }
}

// Export singleton instance
export const payrollRunApiService = new PayrollRunApiService();
export default payrollRunApiService;