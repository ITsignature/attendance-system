import { EmployeeFilters, CreateEmployeeData, UpdateEmployeeData } from '../types/employee';
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
 // ApiService
private async apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<ApiResponse<T>> {
  const url = `${this.baseURL}${endpoint}`;
  const config: RequestInit = {
    headers: this.getHeaders(),
    ...options,
  };

  try {
    const resp = await fetch(url, config);
    // Try to parse JSON even on errors to read message
    let data: any = null;
    try { data = await resp.json(); } catch {}

    if (!resp.ok) {
      // If access token expired, try refresh once then retry original call
      if (resp.status === 401 && !isRetry) {
        console.warn('⚠️ 401 detected. Attempting token refresh...');
        try {
          await this.refreshToken();
          // retry with fresh Authorization header
          return this.apiCall<T>(endpoint, options, true);
        } catch (e) {
          console.error('🔒 Refresh failed. Clearing auth & redirecting.');
          this.removeToken();
          // optionally: window.location.href = '/admin/login';
          throw e instanceof Error ? e : new Error('Unauthorized');
        }
      }
      throw new Error(data?.message || `HTTP error! status: ${resp.status}`);
    }

    // resp.ok
    return (data ?? { success: true }) as ApiResponse<T>;
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
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
  console.log('🔄 Bulk updating employees status terminated:', employeeIds);
  return this.apiCall('/api/employees/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids: employeeIds }),
  });
}

// async bulkUpdateEmployees(updates: Array<{id: string, data: UpdateEmployeeData}>): Promise<ApiResponse> {
//   console.log('🔄 Bulk updating employees:', updates);
//   return this.apiCall('/api/employees/bulk-update', {
//     method: 'PUT',
//     body: JSON.stringify({ updates }),
//   });
// }

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

// Enhanced Department methods
async getDepartments(): Promise<ApiResponse> {
  console.log('🔄 Fetching departments');
  return this.apiCall('/api/departments');
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
   * Get attendance records with filtering and pagination
   */
  async getAttendance(filters?: AttendanceFilters): Promise<ApiResponse> {
    const queryString = filters ? '?' + new URLSearchParams(
      Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString() : '';
    
    console.log('🔄 Fetching attendance records with filters:', filters);
    return this.apiCall(`/api/attendance${queryString}`);
  }

  /**
   * Create a new attendance record
   */
  async createAttendance(data: CreateAttendanceData): Promise<ApiResponse> {
    console.log('🔄 Creating attendance record:', data);
    
    // Validate required fields
    if (!data.employee_id || !data.date || !data.status) {
      return {
        success: false,
        message: 'Employee ID, date, and status are required'
      };
    }

    return this.apiCall('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing attendance record
   */
  async updateAttendance(attendanceId: string, data: UpdateAttendanceData): Promise<ApiResponse> {
    console.log('🔄 Updating attendance record:', attendanceId, data);
    
    if (!attendanceId) {
      return {
        success: false,
        message: 'Attendance ID is required'
      };
    }

    return this.apiCall(`/api/attendance/${attendanceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get attendance records for a specific employee
   */
  async getEmployeeAttendance(employeeId: string, startDate?: string, endDate?: string): Promise<ApiResponse> {
    console.log('🔄 Fetching employee attendance:', employeeId);
    
    const filters: AttendanceFilters = {
      employeeId,
      sortBy: 'date',
      sortOrder: 'DESC'
    };
    
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    return this.getAttendance(filters);
  }

  /**
   * Get today's attendance summary
   */
  async getTodayAttendance(): Promise<ApiResponse> {
    const today = new Date().toISOString().split('T')[0];
    console.log('🔄 Fetching today\'s attendance:', today);
    
    return this.getAttendance({
      startDate: today,
      endDate: today,
      sortBy: 'employee_name',
      sortOrder: 'ASC'
    });
  }

  /**
   * Mark attendance for quick check-in/check-out
   */
  async quickCheckIn(employeeId: string): Promise<ApiResponse> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    console.log('🔄 Quick check-in for employee:', employeeId);
    
    return this.createAttendance({
      employee_id: employeeId,
      date: today,
      check_in_time: checkInTime,
      status: 'present',
      work_type: 'office'
    });
  }

  async quickCheckOut(attendanceId: string): Promise<ApiResponse> {
    const now = new Date();
    const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    console.log('🔄 Quick check-out for attendance:', attendanceId);
    
    return this.updateAttendance(attendanceId, {
      check_out_time: checkOutTime
    });
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