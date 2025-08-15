// services/leaveApi.ts
import apiService from './api';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface LeaveType {
  id: string;
  name: string;
  description?: string;
  max_days_per_year?: number;
  max_consecutive_days?: number;
  is_paid: boolean;
  requires_approval: boolean;
  notice_period_days?: number;
  is_active: boolean;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  leave_type_id: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  leave_duration: 'full_day' | 'half_day' | 'short_leave'; // NEW
  start_time?: string | null; // NEW
  end_time?: string | null; // NEW
  days_requested: number; // Now supports decimals
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applied_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_name?: string;
  reviewer_comments?: string;
  supporting_documents?: string[] | null;
  department_name?: string;
}

export interface LeaveDashboard {
  summary: {
    onLeaveCount: number;
    pendingRequestsCount: number;
    upcomingLeavesCount: number;
    approvedThisMonthCount: number;
  };
  onLeaveToday: Array<{
    id: string;
    name: string;
    employee_code: string;
    profile_image?: string;
    start_date: string;
    end_date: string;
    leave_duration: 'full_day' | 'half_day' | 'short_leave'; // NEW
    leave_type: string;
    reason: string;
    department?: string;
  }>;
  pendingRequests: LeaveRequest[];
  upcomingLeaves: LeaveRequest[];
}

export interface CreateLeaveRequestData {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  leave_duration: 'full_day' | 'half_day' | 'short_leave'; // NEW
  start_time?: string | null; // NEW - required for short_leave
  end_time?: string | null; // NEW - required for short_leave
  reason: string;
  days_requested: number; // Now supports decimals
  supporting_documents?: string[] | null;
  notes?: string | null;
}

export interface CreateLeaveTypeData {
  name: string;
  description?: string;
  max_days_per_year: number;
  max_consecutive_days?: number;
  is_paid: boolean;
  requires_approval: boolean;
  notice_period_days?: number;
  approval_hierarchy?: any[];
}

export interface LeaveRequestFilters {
  start_date?: string;
  end_date?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  department_id?: string;
  employee_id?: string;
  leave_type_id?: string;
  leave_duration?: 'full_day' | 'half_day' | 'short_leave'; // NEW
  limit?: number;
  offset?: number;
}

export interface LeaveBalance {
  employee_id: string;
  leave_type_id: string;
  leave_type_name: string;
  year: number;
  total_allocated: number;
  used: number; // Now supports decimals for half-day/short leaves
  pending: number; // Now supports decimals
  available: number; // Now supports decimals
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
}

// =============================================
// LEAVE API SERVICE CLASS
// =============================================

class LeaveApiService {
  
  /**
   * Get all leave types for the current client
   */
  async getLeaveTypes(): Promise<ApiResponse<LeaveType[]>> {
    try {
      const response = await apiService.apiCall('/api/leaves/types');
      return response;
    } catch (error) {
      console.error('Failed to fetch leave types:', error);
      throw error;
    }
  }

  /**
   * Create a new leave type
   */
  async createLeaveType(data: CreateLeaveTypeData): Promise<ApiResponse> {
    try {
      const response = await apiService.apiCall('/api/leaves/types', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Failed to create leave type:', error);
      throw error;
    }
  }

  /**
   * Update an existing leave type
   */
  async updateLeaveType(id: string, data: Partial<CreateLeaveTypeData>): Promise<ApiResponse> {
    try {
      const response = await apiService.apiCall(`/api/leaves/types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Failed to update leave type:', error);
      throw error;
    }
  }

  /**
   * Delete a leave type
   */
  async deleteLeaveType(id: string): Promise<ApiResponse> {
    try {
      const response = await apiService.apiCall(`/api/leaves/types/${id}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error('Failed to delete leave type:', error);
      throw error;
    }
  }

  /**
   * Get all leave requests with optional filters
   */
  async getAllLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }

      const url = `/api/leaves/requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiService.apiCall(url);
      return response;
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
      throw error;
    }
  }

  /**
   * Submit a leave request for an employee (admin action)
   * Now supports leave_duration, start_time, and end_time
   */
  async submitLeaveRequestForEmployee(data: CreateLeaveRequestData & { employee_id: string }): Promise<ApiResponse> {
    try {
      // Validate time fields for short leave
      if (data.leave_duration === 'short_leave' && (!data.start_time || !data.end_time)) {
        throw new Error('Start time and end time are required for short leave');
      }

      // Calculate days based on duration
      let calculatedDays = data.days_requested;
      if (data.leave_duration === 'half_day') {
        calculatedDays = 0.5;
      } else if (data.leave_duration === 'short_leave') {
        calculatedDays = 0.25;
      }

      const requestData = {
        ...data,
        days_requested: calculatedDays
      };

      const response = await apiService.apiCall('/api/leaves/request', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
      return response;
    } catch (error) {
      console.error('Failed to create leave request for employee:', error);
      throw error;
    }
  }

  /**
   * Approve a leave request
   */
  async approveLeaveRequest(requestId: string, comments?: string): Promise<ApiResponse> {
    try {
      const response = await apiService.apiCall(`/api/leaves/requests/${requestId}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ comments }),
      });
      return response;
    } catch (error) {
      console.error('Failed to approve leave request:', error);
      throw error;
    }
  }

  /**
   * Reject a leave request
   */
  async rejectLeaveRequest(requestId: string, comments: string): Promise<ApiResponse> {
    try {
      const response = await apiService.apiCall(`/api/leaves/requests/${requestId}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ comments }),
      });
      return response;
    } catch (error) {
      console.error('Failed to reject leave request:', error);
      throw error;
    }
  }

  /**
   * Get leave dashboard data
   */
  async getLeaveDashboard(date?: string): Promise<ApiResponse<LeaveDashboard>> {
    try {
      const url = `/api/leaves/dashboard${date ? `?date=${date}` : ''}`;
      const response = await apiService.apiCall(url);
      return response;
    } catch (error) {
      console.error('Failed to fetch leave dashboard:', error);
      throw error;
    }
  }

  /**
   * Get leave balance for an employee
   */
  async getLeaveBalance(employeeId?: string): Promise<ApiResponse<LeaveBalance[]>> {
    try {
      const url = `/api/leaves/balance${employeeId ? `?employee_id=${employeeId}` : ''}`;
      const response = await apiService.apiCall(url);
      return response;
    } catch (error) {
      console.error('Failed to fetch leave balance:', error);
      throw error;
    }
  }

  /**
   * Get my leave requests (for current employee)
   */
  async getMyLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }

      const url = `/api/leaves/my-requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiService.apiCall(url);
      return response;
    } catch (error) {
      console.error('Failed to fetch my leave requests:', error);
      throw error;
    }
  }

  /**
   * Cancel a leave request
   */
  async cancelLeaveRequest(requestId: string): Promise<ApiResponse> {
    try {
      const response = await apiService.apiCall(`/api/leaves/requests/${requestId}/cancel`, {
        method: 'PUT',
      });
      return response;
    } catch (error) {
      console.error('Failed to cancel leave request:', error);
      throw error;
    }
  }

  /**
   * Helper function to format leave duration display
   */
  formatLeaveDuration(duration: 'full_day' | 'half_day' | 'short_leave'): string {
    switch (duration) {
      case 'full_day':
        return 'Full Day';
      case 'half_day':
        return 'Half Day';
      case 'short_leave':
        return 'Short Leave';
      default:
        return duration;
    }
  }

  /**
   * Helper function to get badge color for leave duration
   */
  getDurationBadgeColor(duration: 'full_day' | 'half_day' | 'short_leave'): string {
    switch (duration) {
      case 'full_day':
        return 'success';
      case 'half_day':
        return 'info';
      case 'short_leave':
        return 'warning';
      default:
        return 'gray';
    }
  }

  /**
   * Calculate actual leave days based on duration
   */
  calculateLeaveDays(
    startDate: string, 
    endDate: string, 
    duration: 'full_day' | 'half_day' | 'short_leave'
  ): number {
    if (duration === 'half_day') {
      return 0.5;
    } else if (duration === 'short_leave') {
      return 0.25;
    } else {
      // Calculate business days for full day leaves
      const start = new Date(startDate);
      const end = new Date(endDate);
      let days = 0;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
          days++;
        }
      }
      
      return days;
    }
  }

  /**
   * Calculate business days between two dates
   */
  calculateBusinessDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;
    
    while (start <= end) {
      const dayOfWeek = start.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        businessDays++;
      }
      start.setDate(start.getDate() + 1);
    }
    
    return businessDays;
  }

  /**
   * Format leave duration for display
   */
  formatLeaveDurationText(startDate: string, endDate: string, days: number): string {
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    
    if (days === 1) {
      return `${start} (1 day)`;
    } else if (startDate === endDate) {
      return `${start} (1 day)`;
    } else {
      return `${start} to ${end} (${days} days)`;
    }
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status: string): string {
    const colors = {
      pending: 'yellow',
      approved: 'green',
      rejected: 'red',
      cancelled: 'gray'
    };
    return colors[status as keyof typeof colors] || 'gray';
  }

  /**
   * Get status icon for UI
   */
  getStatusIcon(status: string): string {
    const icons = {
      pending: '⏳',
      approved: '✅',
      rejected: '❌',
      cancelled: '🚫'
    };
    return icons[status as keyof typeof icons] || '❓';
  }

  /**
   * Validate leave request dates
   */
  validateLeaveDates(startDate: string, endDate: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start > end) {
      errors.push('End date must be on or after start date');
    }

    if (start < today) {
      errors.push('Cannot request leave for past dates');
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) {
      errors.push('Leave duration cannot exceed 365 days');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

// Create and export singleton instance
const leaveApiService = new LeaveApiService();
export default leaveApiService;