import { EmployeeFilters, CreateEmployeeData, UpdateEmployeeData } from '../types/employee';

import { 
  LeaveType, 
  LeaveRequest, 
  CreateLeaveRequestData, 
  CreateLeaveTypeData,
  LeaveRequestFilters 
} from './leaveApi';

export interface LoginResponse {

  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      clientId: string;
      clientName: string;
      roleId: string;
      roleName: string;
      accessLevel: string;
      isSuperAdmin: boolean;
      permissions: string[];
      lastLogin: string | null;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  clientId: string;
  clientName: string;
  roleId: string;
  roleName: string;
  accessLevel: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

export interface AttendanceFilters {
  page?: number;
  limit?: number;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  break_duration?: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAttendanceData {
  employee_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  work_type?: 'office' | 'remote' | 'hybrid';
  break_duration?: number;
  notes?: string;
}

export interface UpdateAttendanceData {
  check_in_time?: string;
  check_out_time?: string;
  break_duration?: number;
  status?: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
}
class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
    this.token = localStorage.getItem('accessToken');
  }

  // Set authentication token
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('accessToken', token);
  }

  // Remove authentication token
  removeToken() {
    this.token = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // Get headers with authentication
  // Update your existing getHeaders() method to include this:
private getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (this.token) {
    headers['Authorization'] = `Bearer ${this.token}`;
  }

  // ADD THIS SECTION for multi-tenant support
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.clientId) {
        headers['X-Client-ID'] = user.clientId;
      }
    } catch (error) {
      console.warn('Failed to parse user data for client ID');
    }
  }

  return headers;
}

  // Generic API call method
  public async apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        headers: this.getHeaders(),
        ...options,
      };

      console.log('respone check')
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.apiCall<LoginResponse['data']>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      this.setToken(response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response as LoginResponse;
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.apiCall('/auth/logout', {
        method: 'POST',
      });
      this.removeToken();
      return response;
    } catch (error) {
      // Even if logout fails on server, clear local storage
      this.removeToken();
      throw error;
    }
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.apiCall('/auth/me');
  }

  async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.apiCall<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.success && response.data) {
      this.setToken(response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }

    return response;
  }

  // Dashboard methods
  async getDashboardOverview(): Promise<ApiResponse> {
    return this.apiCall('/api/dashboard/overview');
  }

// Enhanced Employee methods
async getEmployees(params?: EmployeeFilters): Promise<ApiResponse> {
  const queryString = params ? '?' + new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {} as Record<string, string>)
  ).toString() : '';
  
  console.log('🔄 Fetching employees:', queryString);
  return this.apiCall(`/api/employees${queryString}`);
}

async getEmployee(id: string): Promise<ApiResponse> {
  console.log('🔄 Fetching employee:', id);
  return this.apiCall(`/api/employees/${id}`);
}

async createEmployee(employeeData: any): Promise<ApiResponse> {
  console.log('🔄 Creating employee:', employeeData);
  
  // Client-side validation
  const requiredFields = [
    'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 
    'gender', 'employee_code', 'department_id', 'designation_id', 
    'hire_date', 'employee_type', 'emergency_contact_name', 
    'emergency_contact_phone', 'emergency_contact_relation'
  ];
  
  for (const field of requiredFields) {
    if (!employeeData[field] || employeeData[field].toString().trim() === '') {
      console.log(`❌ Missing required field: ${field} = "${employeeData[field]}"`);
      throw new Error(`${field.replace('_', ' ')} is required`);
    }
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(employeeData.email)) {
    throw new Error('Please enter a valid email address');
  }
  
  return this.apiCall('/api/employees', {
    method: 'POST',
    body: JSON.stringify(employeeData),
  });
}

// Check if employee ID is unique
async checkEmployeeIdAvailability(employeeId: string): Promise<ApiResponse> {
  console.log('🔄 Checking employee ID availability:', employeeId);
  return this.apiCall(`/api/employees/check-id?employee_id=${encodeURIComponent(employeeId)}`);
}

// Check if email is unique
async checkEmailAvailability(email: string): Promise<ApiResponse> {
  console.log('🔄 Checking email availability:', email);
  return this.apiCall(`/api/employees/check-email?email=${encodeURIComponent(email)}`);
}
async updateEmployee(id: string, employeeData: UpdateEmployeeData): Promise<ApiResponse> {
  console.log('🔄 Updating employee:', id, employeeData);
  return this.apiCall(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(employeeData),
  });
}

async deleteEmployee(id: string): Promise<ApiResponse> {
  console.log('🔄 Deleting employee:', id);
  return this.apiCall(`/api/employees/${id}`, {
    method: 'DELETE',
  });
}

// Bulk operations
async bulkDeleteEmployees(employeeIds: string[]): Promise<ApiResponse> {
  console.log('🔄 Bulk deleting employees:', employeeIds);
  return this.apiCall('/api/employees/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}

async bulkUpdateEmployees(updates: Array<{id: string, data: UpdateEmployeeData}>): Promise<ApiResponse> {
  console.log('🔄 Bulk updating employees:', updates);
  return this.apiCall('/api/employees/bulk-update', {
    method: 'PUT',
    body: JSON.stringify({ updates }),
  });
}

// Employee statistics
async getEmployeeStats(): Promise<ApiResponse> {
  console.log('🔄 Fetching employee statistics');
  return this.apiCall('/api/employees/stats');
}

// Export employees
async exportEmployees(format: 'csv' | 'excel' = 'csv', filters?: EmployeeFilters): Promise<ApiResponse> {
  const queryString = filters ? '?' + new URLSearchParams(
    Object.entries({...filters, format}).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {} as Record<string, string>)
  ).toString() : `?format=${format}`;
  
  console.log('🔄 Exporting employees:', format);
  return this.apiCall(`/api/employees/export${queryString}`);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Enhanced Department methods
// ---------------------------------------------------------------------------------------------------------------------------------

async getDepartments(): Promise<ApiResponse> {
  console.log('🔄 Fetching departments');
  return this.apiCall('/api/departments');
}

async getDepartmentsWithEmployees(): Promise<ApiResponse> {
  console.log('🔄 Fetching departments');
  return this.apiCall('/api/departments/with-employees');
}

async getDepartmentsWithDesignations(): Promise<ApiResponse> {
  console.log('🔄 Fetching departments');
  return this.apiCall('/api/departments/with-designations');
}


async createDepartment(deptData: {
  name: string;
  description?: string;
  manager_id?: string | null;
  budget?: number | null;
}): Promise<ApiResponse> {
  return this.apiCall('/api/departments', {
    method: 'POST',
    body: JSON.stringify(deptData),
  });
}


async deleteDesignation(id: string): Promise<ApiResponse> {
  console.log('🔄 Deleting designation:', id);
  return this.apiCall(`/api/designations/${id}`, {
    method: 'DELETE',
  });
}



async deleteDepartment(id: string): Promise<ApiResponse> {
  console.log('🔄 Deleting department:', id);
  return this.apiCall(`/api/departments/${id}`, {
    method: 'DELETE',
  });
}


async createDesignation(deptData: {
  title: string;
  department_id: string;
  responsibilities: string[];
}): Promise<ApiResponse> {
  return this.apiCall('/api/designations', {
    method: 'POST',
    body: JSON.stringify(deptData),
  }); 
}


async getDesignations(departmentId?: string): Promise<ApiResponse> {
  const queryString = departmentId ? `?department_id=${departmentId}` : '';
  console.log('🔄 Fetching designations');
  return this.apiCall(`/api/designations${queryString}`);
}

async getManagers(departmentId?: string): Promise<ApiResponse> {
  const queryString = departmentId ? `?department_id=${departmentId}` : '';
  console.log('🔄 Fetching managers');
  return this.apiCall(`/api/employees/managers${queryString}`);
}

  // ========== ATTENDANCE METHODS ==========
  
  /**
 * Get attendance records with dual status filtering
 */
async getAttendanceRecords(filters: URLSearchParams): Promise<ApiResponse> {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });

  return this.apiCall(`/api/attendance?${params.toString()}`);
}

/**
 * Create attendance record with dual status
 */
async createAttendanceRecord(data: AttendanceFormData): Promise<ApiResponse> {
  return this.apiCall('/api/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update attendance record with dual status
 */
async updateAttendanceRecord(id: string, data: Partial<AttendanceFormData>): Promise<ApiResponse> {

  console.log('🔄 Updating attendance record:', id,"data",data);
  return this.apiCall(`/api/attendance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Bulk update attendance statuses
 */ 
async bulkUpdateAttendanceStatus(data: {
  date: string;
  employee_ids: string[];
  update_arrival?: boolean;
  update_duration?: boolean;
}): Promise<ApiResponse> {
  return this.apiCall('/api/attendance/bulk-update-status', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get employee schedule information
 */
async getEmployeeSchedule(employeeId: string): Promise<ApiResponse> {
  return this.apiCall(`/api/attendance/employee-schedule/${employeeId}`);
}

/**
 * Get attendance status badge styling
 */
getArrivalStatusColor(status: string): string {
  switch (status) {
    case 'on_time': return 'success';
    case 'late': return 'warning';
    case 'absent': return 'failure';
    default: return 'gray';
  }
}

/**
 * Get work duration badge styling
 */
getWorkDurationColor(duration: string): string {
  switch (duration) {
    case 'full_day': return 'success';
    case 'half_day': return 'info';
    case 'short_leave': return 'warning';
    case 'on_leave': return 'purple';
    default: return 'gray';
  }
}

  // RBAC methods
  async getRoles(): Promise<ApiResponse> {
    return this.apiCall('/api/rbac/roles');
  }

  async getPermissions(): Promise<ApiResponse> {
    return this.apiCall('/api/rbac/permissions');
  }

  async createRole(roleData: {
    name: string;
    description?: string;
    access_level: 'basic' | 'moderate' | 'full';
    permissions: string[];
  }): Promise<ApiResponse> {
    return this.apiCall('/api/rbac/roles', {
      method: 'POST',
      body: JSON.stringify(roleData),
    });
  }

  async updateRole(roleId: string, roleData: {
    name?: string;
    description?: string;
    access_level?: 'basic' | 'moderate' | 'full';
    permissions?: string[];
  }): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(roleData),
    });
  }

  async deleteRole(roleId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  async getRole(roleId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/roles/${roleId}`);
  }

  // Client methods
  async getClients(): Promise<ApiResponse> {
    return this.apiCall('/api/clients');
  }

  async createClient(clientData: {
    name: string;
    description?: string;
    contact_email?: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse> {
    return this.apiCall('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  }

  async updateClient(clientId: string, clientData: {
    name?: string;
    description?: string;
    contact_email?: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse> {
    return this.apiCall(`/api/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
  }

  async deleteClient(clientId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/clients/${clientId}`, {
      method: 'DELETE',
    });
  }

// =============================================
// ADMIN USER MANAGEMENT METHODS
// =============================================

// Get all admin users
async getAdminUsers(): Promise<ApiResponse> {
  return this.apiCall('/api/rbac/admin-users');
}

// Get single admin user
async getAdminUser(userId: string): Promise<ApiResponse> {
  return this.apiCall(`/api/rbac/admin-users/${userId}`);
}

// Create admin user
async createAdminUser(userData: {
  name: string;
  email: string;
  password: string;
  role_id: string;
  department?: string;
  client_id?: string;
  is_active?: boolean;
  is_super_admin?: boolean;
}): Promise<ApiResponse> {
  return this.apiCall('/api/rbac/admin-users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

// Update admin user
async updateAdminUser(userId: string, userData: {
  name?: string;
  email?: string;
  role_id?: string;
  department?: string;
  is_active?: boolean;
}): Promise<ApiResponse> {
  return this.apiCall(`/api/rbac/admin-users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
}

// Delete admin user
async deleteAdminUser(userId: string): Promise<ApiResponse> {
  return this.apiCall(`/api/rbac/admin-users/${userId}`, {
    method: 'DELETE',
  });
}

// Assign role to user (alternative method)
async assignRoleToUser(userId: string, roleId: string): Promise<ApiResponse> {
  return this.apiCall(`/api/rbac/admin-users/${userId}/assign-role`, {
    method: 'PUT',
    body: JSON.stringify({ role_id: roleId }),
  });
}

  // Health check
async healthCheck(): Promise<ApiResponse> {
    return this.apiCall('/health');
  }

// =============================================
// LEAVE MANAGEMENT METHODS
// =============================================

// Leave Types
async getLeaveTypes(): Promise<ApiResponse<LeaveType[]>> {
  return this.apiCall('/api/leaves/types');
}

async createLeaveType(data: CreateLeaveTypeData): Promise<ApiResponse> {
  return this.apiCall('/api/leaves/types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async updateLeaveType(id: string, data: Partial<CreateLeaveTypeData>): Promise<ApiResponse> {
  return this.apiCall(`/api/leaves/types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async deleteLeaveType(id: string): Promise<ApiResponse> {
  return this.apiCall(`/api/leaves/types/${id}`, {
    method: 'DELETE',
  });
}

// Leave Requests - Employee
async getMyLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const url = `/api/leaves/my-requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return this.apiCall(url);
}

async submitLeaveRequest(data: CreateLeaveRequestData): Promise<ApiResponse> {
  return this.apiCall('/api/leaves/request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async cancelLeaveRequest(requestId: string): Promise<ApiResponse> {
  return this.apiCall(`/api/leaves/requests/${requestId}/cancel`, {
    method: 'PUT',
  });
}

// Leave Requests - Manager/HR
async getAllLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const url = `/api/leaves/requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return this.apiCall(url);
}

async approveLeaveRequest(requestId: string, comments?: string): Promise<ApiResponse> {
  return this.apiCall(`/api/leaves/requests/${requestId}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ comments }),
  });
}

async rejectLeaveRequest(requestId: string, comments: string): Promise<ApiResponse> {
  return this.apiCall(`/api/leaves/requests/${requestId}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ comments }),
  });
}

async bulkApproveRequests(requestIds: string[], comments?: string): Promise<ApiResponse> {
  return this.apiCall('/api/leaves/requests/bulk-approve', {
    method: 'POST',
    body: JSON.stringify({ request_ids: requestIds, comments }),
  });
}

// Dashboard & Analytics
async getLeaveDashboard(date?: string): Promise<ApiResponse> {
  const url = `/api/leaves/dashboard${date ? `?date=${date}` : ''}`;
  return this.apiCall(url);
}

async getEmployeeLeaveBalance(employeeId: string, year?: number): Promise<ApiResponse> {
  const url = `/api/leaves/balance/${employeeId}${year ? `?year=${year}` : ''}`;
  return this.apiCall(url);
}

async getLeaveAnalytics(filters?: {
  start_date?: string;
  end_date?: string;
  department_id?: string;
  leave_type_id?: string;
}): Promise<ApiResponse> {
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const url = `/api/leaves/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return this.apiCall(url);
}

// Export
async exportLeaveData(filters?: {
  start_date?: string;
  end_date?: string;
  format?: 'json' | 'csv' | 'xlsx';
  status?: string;
  department_id?: string;
}): Promise<ApiResponse> {
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const url = `/api/leaves/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  if (filters?.format === 'csv') {
    // For CSV downloads, handle blob response
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `leave-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      return { success: true, message: 'Export downloaded successfully' };
    } catch (error) {
      throw error;
    }
  } else {
    return this.apiCall(url);
  }
}

// =============================================
// UTILITY METHODS FOR ATTENDANCE
// =============================================

/**
 * Format time for display (12-hour format)
 */
formatTime(time?: string): string {
  if (!time) return 'Not Recorded';
  
  try {
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 < 12 ? 'AM' : 'PM';
    return `${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    return time;
  }
}

/**
 * Format date for display
 */
formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return date;
  }
}

/**
 * Calculate working hours between two times
 */
calculateHours(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  
  try {
    const checkInTime = new Date(`2000-01-01 ${checkIn}`);
    const checkOutTime = new Date(`2000-01-01 ${checkOut}`);
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  } catch (error) {
    return 0;
  }
}

/**
 * Get attendance status badge color for UI
 */
getStatusBadgeColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'present': return 'success';
    case 'late': return 'warning';
    case 'absent': return 'failure';
    case 'half_day': return 'info';
    case 'on_leave': return 'purple';
    default: return 'gray';
  }
}
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;