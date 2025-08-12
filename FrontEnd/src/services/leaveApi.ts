import apiService from './api';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface LeaveType {
  id: string;
  name: string;
  description: string;
  maxDaysPerYear: number;
  maxConsecutiveDays: number;
  isPaid: boolean;
  requiresApproval: boolean;
  approvalHierarchy: any[];
  noticePeriodDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    code: string;
    email: string;
    avatar: string;
    department: string;
    designation: string;
  };
  leaveType: {
    id: string;
    name: string;
    isPaid: boolean;
  };
  dates: {
    start: string;
    end: string;
    daysRequested: number;
  };
  details: {
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    appliedAt: string;
    reviewedAt?: string;
    reviewerComments?: string;
    reviewerName?: string;
    supportingDocuments?: any[];
  };
}

// export interface LeaveBalance {
//   leaveType: {
//     id: string;
//     name: string;
//     description: string;
//     isPaid: boolean;
//     maxConsecutiveDays: number;
//   };
//   balance: {
//     allocated: number;
//     used: number;
//     pending: number;
//     remaining: number;
//     utilizationPercentage: number;
//   };
// }

export interface LeaveDashboard {
  date: string;
  summary: {
    onLeaveCount: number;
    pendingRequestsCount: number;
    urgentPendingCount: number;
  };
  onLeaveToday: Array<{
    id: string;
    name: string;
    code: string;
    avatar: string;
    department: string;
    leave: {
      type: string;
      isPaid: boolean;
      startDate: string;
      endDate: string;
      days: number;
      reason: string;
    };
  }>;
  monthlyStats: Record<string, {
    count: number;
    totalDays: number;
  }>;
  upcomingLeaves: Array<{
    employeeName: string;
    employeeCode: string;
    department: string;
    startDate: string;
    endDate: string;
    days: number;
    leaveType: string;
  }>;
  departmentSummary: Array<{
    department: string;
    totalEmployees: number;
    employeesOnLeave: number;
    pendingRequests: number;
    availabilityPercentage: number;
  }>;
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

export interface CreateLeaveRequestData {
  employee_id: string; // ← ADD this field (admin selects employee)
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  supporting_documents?: any[];
  notes?: string; // ← ADD this field (admin notes)
}

export interface LeaveRequestFilters {
  start_date?: string;
  end_date?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  department_id?: string;
  employee_id?: string;
  leave_type_id?: string;
  limit?: number;
  offset?: number;
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

  // =============================================
  // LEAVE TYPES
  // =============================================

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

  // =============================================
  // LEAVE REQUESTS - EMPLOYEE ACTIONS
  // =============================================

  /**
   * Get current user's leave requests
   */
  // async getMyLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
  //   try {
  //     const queryParams = new URLSearchParams();
  //     if (filters) {
  //       Object.entries(filters).forEach(([key, value]) => {
  //         if (value !== undefined && value !== null) {
  //           queryParams.append(key, value.toString());
  //         }
  //       });
  //     }

  //     const url = `/api/leaves/my-requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  //     const response = await apiService.apiCall(url);
  //     return response;
  //   } catch (error) {
  //     console.error('Failed to fetch my leave requests:', error);
  //     throw error;
  //   }
  // }

  /**
   * Submit a new leave request
   */
  // async submitLeaveRequest(data: CreateLeaveRequestData): Promise<ApiResponse> {
  //   try {
  //     const response = await apiService.apiCall('/api/leaves/request', {
  //       method: 'POST',
  //       body: JSON.stringify(data),
  //     });
  //     return response;
  //   } catch (error) {
  //     console.error('Failed to submit leave request:', error);
  //     throw error;
  //   }
  // }

  /**
   * Cancel a leave request
   */
  // async cancelLeaveRequest(requestId: string): Promise<ApiResponse> {
  //   try {
  //     const response = await apiService.apiCall(`/api/leaves/requests/${requestId}/cancel`, {
  //       method: 'PUT',
  //     });
  //     return response;
  //   } catch (error) {
  //     console.error('Failed to cancel leave request:', error);
  //     throw error;
  //   }
  // }

  // =============================================
  // LEAVE REQUESTS - MANAGER/HR ACTIONS
  // =============================================

  /**
   * Get all leave requests (for managers/HR)
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
 * Admin creates leave request for an employee
 */
async submitLeaveRequestForEmployee(data: CreateLeaveRequestData & { employee_id: string }): Promise<ApiResponse> {
  try {
    const response = await apiService.apiCall('/api/leaves/request', {
      method: 'POST',
      body: JSON.stringify(data),
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
   * Bulk approve multiple leave requests
   */
  // async bulkApproveRequests(requestIds: string[], comments?: string): Promise<ApiResponse> {
  //   try {
  //     const response = await apiService.apiCall('/api/leaves/requests/bulk-approve', {
  //       method: 'POST',
  //       body: JSON.stringify({ request_ids: requestIds, comments }),
  //     });
  //     return response;
  //   } catch (error) {
  //     console.error('Failed to bulk approve requests:', error);
  //     throw error;
  //   }
  // }

  // =============================================
  // DASHBOARD & ANALYTICS
  // =============================================

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
  // async getEmployeeLeaveBalance(employeeId: string, year?: number): Promise<ApiResponse<LeaveBalance[]>> {
  //   try {
  //     const url = `/api/leaves/balance/${employeeId}${year ? `?year=${year}` : ''}`;
  //     const response = await apiService.apiCall(url);
  //     return response;
  //   } catch (error) {
  //     console.error('Failed to fetch employee leave balance:', error);
  //     throw error;
  //   }
  // }

  /**
   * Get leave analytics
   */
  // async getLeaveAnalytics(filters?: {
  //   start_date?: string;
  //   end_date?: string;
  //   department_id?: string;
  //   leave_type_id?: string;
  // }): Promise<ApiResponse> {
  //   try {
  //     const queryParams = new URLSearchParams();
  //     if (filters) {
  //       Object.entries(filters).forEach(([key, value]) => {
  //         if (value !== undefined && value !== null) {
  //           queryParams.append(key, value.toString());
  //         }
  //       });
  //     }

  //     const url = `/api/leaves/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  //     const response = await apiService.apiCall(url);
  //     return response;
  //   } catch (error) {
  //     console.error('Failed to fetch leave analytics:', error);
  //     throw error;
  //   }
  // }

  // =============================================
  // EXPORT FUNCTIONALITY
  // =============================================

  /**
   * Export leave data
   */
  // async exportLeaveData(filters?: {
  //   start_date?: string;
  //   end_date?: string;
  //   format?: 'json' | 'csv' | 'xlsx';
  //   status?: string;
  //   department_id?: string;
  // }): Promise<ApiResponse> {
  //   try {
  //     const queryParams = new URLSearchParams();
  //     if (filters) {
  //       Object.entries(filters).forEach(([key, value]) => {
  //         if (value !== undefined && value !== null) {
  //           queryParams.append(key, value.toString());
  //         }
  //       });
  //     }

  //     const url = `/api/leaves/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
  //     if (filters?.format === 'csv') {
  //       // For CSV downloads, we need to handle blob response
  //       const response = await fetch(`${apiService['baseURL']}${url}`, {
  //         headers: apiService['getHeaders'](),
  //       });
        
  //       if (!response.ok) {
  //         throw new Error('Export failed');
  //       }
        
  //       const blob = await response.blob();
  //       const downloadUrl = window.URL.createObjectURL(blob);
  //       const link = document.createElement('a');
  //       link.href = downloadUrl;
  //       link.download = `leave-export-${new Date().toISOString().split('T')[0]}.csv`;
  //       document.body.appendChild(link);
  //       link.click();
  //       link.remove();
  //       window.URL.revokeObjectURL(downloadUrl);
        
  //       return { success: true, message: 'Export downloaded successfully' };
  //     } else {
  //       return await apiService.apiCall(url);
  //     }
  //   } catch (error) {
  //     console.error('Failed to export leave data:', error);
  //     throw error;
  //   }
  // }

  // =============================================
  // HELPER METHODS
  // =============================================

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
  formatLeaveDuration(startDate: string, endDate: string, days: number): string {
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

    if (start >= end) {
      errors.push('End date must be after start date');
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