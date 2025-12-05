// services/api.ts
import { EmployeeFilters, CreateEmployeeData, UpdateEmployeeData } from '../types/employee';
import {
  LeaveType,
  LeaveRequest,
  CreateLeaveRequestData,
  CreateLeaveTypeData,
  LeaveRequestFilters
} from './leaveApi';

/* ----------------------------- Shared Types ----------------------------- */

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

/** Filters your backend `/api/attendance` actually supports */
export interface AttendanceFilters {
  page?: number;
  limit?: number;
  employeeId?: string;
  startDate?: string;          // YYYY-MM-DD
  endDate?: string;            // YYYY-MM-DD
  arrival_status?: 'on_time' | 'late' | 'absent';
  work_duration?: 'full_day' | 'half_day' | 'short_leave' | 'on_leave' | '';
  sortBy?: string;             // e.g. 'date'
  sortOrder?: 'ASC' | 'DESC';
}

/** Row shape (kept close to your server payload) */
export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_hours?: number | null;
  overtime_hours?: number | null;
  break_duration?: number | null;
  status?: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave'; // (legacy)
  arrival_status?: 'on_time' | 'late' | 'absent';
  work_duration?: 'full_day' | 'half_day' | 'short_leave' | 'on_leave' | '' | null;
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string | null;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  scheduled_in_time?: string | null;
  scheduled_out_time?: string | null;
  follows_company_schedule?: 0 | 1 | boolean;
  created_at?: string;
  updated_at?: string;
}

/** Form shape used by your create/update attendance (dual status) */
export interface AttendanceFormData {
  employee_id: string;
  date: string; // YYYY-MM-DD
  check_in_time?: string;   // "HH:MM" or "HH:MM:SS"
  check_out_time?: string;  // "HH:MM" or "HH:MM:SS"
  arrival_status?: 'on_time' | 'late' | 'absent';
  work_duration?: 'full_day' | 'half_day' | 'short_leave' | 'on_leave' | '';
  break_duration?: number;
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
}

interface GetLiveDataParams {
  month?: string | number;
  year?: string | number;
}

/* ------------------------------ Api Service ----------------------------- */

class ApiService {
  
  private baseURL: string;
  private token: string | null = null;

    // 🔽 NEW: single-flight refresh coordination
  private refreshPromise: Promise<void> | null = null;

  // 🔽 NEW: proactive refresh timer
  private refreshTimer: number | null = null;
  private maxRefreshRetries = 2;

  constructor() {
    this.baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
    this.token = localStorage.getItem('accessToken');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('accessToken', token);
  }

 removeToken() {
 
  this.token = null;

  // NEW: clear scheduled refresh
  if (this.refreshTimer) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  localStorage.removeItem('accessToken');
  // localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('accessTokenExpiresIn');

}

  /** Build headers including tenant header */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Multi-tenant support
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.clientId) headers['X-Client-ID'] = user.clientId;
      } catch {
        console.warn('Failed to parse user data for client ID');
      }
    }

    return headers;
  }

  /** Primitive -> string, null/undefined/'' -> skip */
  private static toQueryString(input?: string | URLSearchParams | Record<string, any>): string {
    if (!input) return '';

    if (typeof input === 'string') return input.replace(/^\?/, '');
    if (input instanceof URLSearchParams) return input.toString();

    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.append(key, String(value));
    });
    return params.toString();
  }

  /** Generic API call */
  // public async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  //   try {
  //     const url = `${this.baseURL}${endpoint}`;
  //     const config: RequestInit = {
  //       headers: this.getHeaders(),
  //       ...options,
  //     };

  //     const res = await fetch(url, config);
  //     const data = await res.json();

  //     if (!res.ok) {
  //       throw new Error(data?.message || `HTTP ${res.status}`);
  //     }

  //     return data;
  //   } catch (error) {
  //     console.error('API call failed:', error);
  //     throw error;
  //   }
  // }

  public async apiCall<T>(endpoint: string, options: RequestInit = {}, _retryOn401 = true): Promise<ApiResponse<T>> {
  const url = `${this.baseURL}${endpoint}`;
  const config: RequestInit = { headers: this.getHeaders(), ...options };

  // First attempt
  let res = await fetch(url, config);

  // If expired/unauthorized, try single-flight refresh + retry ONCE
  if (res.status === 401 && _retryOn401) {
    try {
      await this.queueRefresh(); // runs one refresh for all callers
      const retryConfig: RequestInit = { headers: this.getHeaders(), ...options };
      res = await fetch(url, retryConfig);
    } catch (e) {
      // refresh failed -> hard logout + bubble error
      this.removeToken();
      throw e;
    }
  }

  // Parse JSON safely
  let data: any;
  try {
    data = await res.json();
  } catch {
    // non-JSON error responses
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // non-JSON success (rare)
    return { success: true, message: 'ok', data: undefined } as ApiResponse<T>;
  }

  if (!res.ok) {
    // Only remove token on 401 Unauthorized errors
    if (res.status === 401) {
      this.removeToken();
    }

    // If there are validation errors, include them in the error message
    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const validationMessages = data.errors.map((err: any) => err.msg).join(', ');
      throw new Error(validationMessages);
    }

    throw new Error(data?.message || `HTTP ${res.status}`);
  }

  return data;
}

  /* ----------------------------- Auth Methods ---------------------------- */

  // async login(email: string, password: string): Promise<LoginResponse> {
  //   const response = await this.apiCall<LoginResponse['data']>('/auth/login', {
  //     method: 'POST',
  //     body: JSON.stringify({ email, password }),
  //   });

  //   if (response.success && response.data) {
  //     this.setToken(response.data.accessToken);
  //     localStorage.setItem('refreshToken', response.data.refreshToken);
  //     localStorage.setItem('user', JSON.stringify(response.data.user));
  //   }

  //   return response as LoginResponse;
  // }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.apiCall('/auth/logout', { method: 'POST' });
      this.removeToken();
      return response;
    } catch (error) {
      this.removeToken();
      throw error;
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
  const response = await this.apiCall<LoginResponse['data']>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (response.success && response.data) {
    this.setToken(response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    //localStorage.setItem('user', JSON.stringify(response.data.user));

    // NEW: schedule proactive refresh if backend returns expiresIn
    let secs =
      typeof response.data.expiresIn === 'string'
        ? parseInt(response.data.expiresIn, 10)
        : Number(response.data.expiresIn);
    if (!Number.isNaN(secs)) {
      localStorage.setItem('accessTokenExpiresIn', String(secs));
      this.scheduleTokenRefresh(secs);
    }
  }

  return response as LoginResponse;
}

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.apiCall('/auth/me');
  }

  // async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
  //   const refreshToken = localStorage.getItem('refreshToken');
  //   if (!refreshToken) throw new Error('No refresh token available');

  //   const response = await this.apiCall<{ accessToken: string; refreshToken: string }>(
  //     '/auth/refresh',
  //     { method: 'POST', body: JSON.stringify({ refreshToken }) }
  //   );

  //   if (response.success && response.data) {
  //     this.setToken(response.data.accessToken);
  //     localStorage.setItem('refreshToken', response.data.refreshToken);
  //   }

  //   return response;
  // }

  // services/api.ts
async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken: string; expiresIn?: number | string }>> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');

  const url = `${this.baseURL}/auth/refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // ⛔️ no Authorization header
    body: JSON.stringify({ refreshToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    // ensure we clear tokens if refresh is invalid
    this.removeToken();
    throw new Error(data?.message || `HTTP ${res.status}`);
  }

  // Expected shape: { success, data: { accessToken, refreshToken, expiresIn? } }
  if (data?.success && data?.data) {
    const { accessToken, refreshToken: newRefresh, expiresIn } = data.data;
    
    console.log('New Refreshed token', accessToken);

    this.setToken(accessToken);
    if (newRefresh) localStorage.setItem('refreshToken', newRefresh);

    // store/schedule expiry if provided
    if (expiresIn) {
      const secs =
        typeof expiresIn === 'string' ? parseInt(expiresIn, 10) : Number(expiresIn);

        console.log("secs",secs);

      if (!Number.isNaN(secs)) {
        localStorage.setItem('accessTokenExpiresIn', String(secs));
        this.scheduleTokenRefresh(secs);
      }
    }
  }

  return data;
}

  // services/api.ts (inside class)
private scheduleTokenRefresh(expiresInSeconds?: number) {
  // clear any existing timer
  if (this.refreshTimer) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
  if (!expiresInSeconds) return;

  // refresh 60s before expiry (never < 5s)
  const refreshInMs = Math.max((expiresInSeconds - 60) * 1000, 5000);
  console.log(`🔄 Scheduling refresh in ${refreshInMs / 1000}s for token expiring in ${expiresInSeconds}s`);
  this.refreshTimer = window.setTimeout(async () => {
    try {
      console.log('🔄 Auto-refresh triggered');
      await this.queueRefresh(); // will no-op if already refreshing
    } catch {
      // ignore here; the next actual API call will force logout if needed
    }
  }, refreshInMs);
}

// services/api.ts (inside class)
private async queueRefresh(): Promise<void> {
  if (this.refreshPromise) {
    return this.refreshPromise; // another request already kicked it off
  }
  this.refreshPromise = (async () => {
    try {
      const res = await this.refreshToken(); // will throw if it fails
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Refresh failed');
      }
      // success handled inside refreshToken() (it sets tokens)
    } finally {
      this.refreshPromise = null;
    }
  })();
  return this.refreshPromise;
}

  /* --------------------------- Dashboard Methods ------------------------- */

  async getDashboardOverview(): Promise<ApiResponse> {
    return this.apiCall('/api/dashboard/overview');
  }

  /* ---------------------------- Employee Methods ------------------------- */

  async getEmployees(params?: EmployeeFilters): Promise<ApiResponse> {
    const qs = ApiService.toQueryString(params);
    console.log('🔄 Fetching employees:', qs ? `?${qs}` : '');
    return this.apiCall(`/api/employees${qs ? `?${qs}` : ''}`);
  }

  async getEmployee(id: string): Promise<ApiResponse> {
    return this.apiCall(`/api/employees/${id}`);
  }

  async createEmployee(employeeData: any): Promise<ApiResponse> {
    // ... (unchanged from your version)
    const requiredFields = [
      'first_name', 'last_name', 'email', 'phone', 'date_of_birth',
      'gender', 'employee_code', 'department_id', 'designation_id',
      'hire_date', 'employee_type', 'emergency_contact_name',
      'emergency_contact_phone', 'emergency_contact_relation'
    ];
    for (const field of requiredFields) {
      if (!employeeData[field] || employeeData[field].toString().trim() === '') {
        throw new Error(`${field.replace('_', ' ')} is required`);
      }
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(employeeData.email)) {
      throw new Error('Please enter a valid email address');
    }
    return this.apiCall('/api/employees', { method: 'POST', body: JSON.stringify(employeeData) });
  }

  async checkEmployeeIdAvailability(employeeId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/employees/check-id?employee_id=${encodeURIComponent(employeeId)}`);
  }
  async checkEmailAvailability(email: string): Promise<ApiResponse> {
    return this.apiCall(`/api/employees/check-email?email=${encodeURIComponent(email)}`);
  }
  async   (id: string, employeeData: UpdateEmployeeData): Promise<ApiResponse> {
    return this.apiCall(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(employeeData) });
  }
  async deleteEmployee(id: string): Promise<ApiResponse> {
    return this.apiCall(`/api/employees/${id}`, { method: 'DELETE' });
  }
  async bulkDeleteEmployees(employeeIds: string[]): Promise<ApiResponse> {
    return this.apiCall('/api/employees/bulk-delete', {
      method: 'POST', body: JSON.stringify({ employee_ids: employeeIds }),
    });
  }
  
    async updateEmployee(id: string, employeeData: UpdateEmployeeData): Promise<ApiResponse> {
    return this.apiCall(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(employeeData) });
  }
  async bulkUpdateEmployees(updates: Array<{ id: string; data: UpdateEmployeeData }>): Promise<ApiResponse> {
    return this.apiCall('/api/employees/bulk-update', {
      method: 'PUT', body: JSON.stringify({ updates }),
    });
  }
  async getEmployeeStats(): Promise<ApiResponse> {
    return this.apiCall('/api/employees/stats');
  }
  async exportEmployees(format: 'csv' | 'excel' = 'csv', filters?: EmployeeFilters): Promise<ApiResponse> {
    const qs = ApiService.toQueryString({ ...(filters || {}), format });
    return this.apiCall(`/api/employees/export?${qs}`);
  }

  /* --------------------------- Department/Role/etc ----------------------- */
  async getDepartments(): Promise<ApiResponse> { return this.apiCall('/api/departments'); }
  async getDepartmentsWithEmployees(): Promise<ApiResponse> { return this.apiCall('/api/departments/with-employees'); }
  async getDepartmentsWithDesignations(): Promise<ApiResponse> { return this.apiCall('/api/departments/with-designations'); }

  async createDepartment(deptData: {
    name: string; description?: string; manager_id?: string | null; budget?: number | null;
  }): Promise<ApiResponse> {
    return this.apiCall('/api/departments', { method: 'POST', body: JSON.stringify(deptData) });
  }

  async deleteDesignation(id: string): Promise<ApiResponse> {
    return this.apiCall(`/api/designations/${id}`, { method: 'DELETE' });
  }
  async deleteDepartment(id: string): Promise<ApiResponse> {
    return this.apiCall(`/api/departments/${id}`, { method: 'DELETE' });
  }
  async createDesignation(deptData: { title: string; department_id: string; responsibilities: string[]; }): Promise<ApiResponse> {
    return this.apiCall('/api/designations', { method: 'POST', body: JSON.stringify(deptData) });
  }
  async getDesignations(departmentId?: string): Promise<ApiResponse> {
    const qs = departmentId ? `?department_id=${departmentId}` : '';
    return this.apiCall(`/api/designations${qs}`);
  }
  async getManagers(departmentId?: string): Promise<ApiResponse> {
    const qs = departmentId ? `?department_id=${departmentId}` : '';
    return this.apiCall(`/api/employees/managers${qs}`);
  }

async getPayrollLiveAll(params?: GetLiveDataParams): Promise<ApiResponse> {
  const query = params 
    ? `?${new URLSearchParams({
        month: params.month?.toString() || '',
        year: params.year?.toString() || ''
      }).toString()}`
    : '';
  
  return this.apiCall(`/api/payroll-runs/live/all${query}`);
}
  /* ---------------------------- Attendance APIs -------------------------- */

  /**
   * Get attendance records — accepts:
   *  - object (AttendanceFilters)
   *  - URLSearchParams
   *  - string (already-built query string)
   */
  async getAttendanceRecords(filters?: AttendanceFilters | URLSearchParams | string): Promise<ApiResponse<{
    attendance: AttendanceRecord[];
    pagination: { currentPage: number; totalPages: number; totalRecords: number; recordsPerPage: number; };
  }>> {
    const qs = ApiService.toQueryString(filters);
    const url = `/api/attendance${qs ? `?${qs}` : ''}`;
    console.log('🔄 Fetching attendance:', url);
    return this.apiCall(url);
  }

  /** Create attendance record (dual statuses supported) */
  async createAttendanceRecord(data: AttendanceFormData): Promise<ApiResponse> {
    return this.apiCall('/api/attendance', { method: 'POST', body: JSON.stringify(data) });
  }

  /** PATCH update attendance record (send only changed fields) */
  async updateAttendanceRecord(id: string, data: Partial<AttendanceFormData>): Promise<ApiResponse> {
    console.log('🔄 Updating attendance record:', id, 'data:', data);
    return this.apiCall(`/api/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  /** Bulk update flags */
  async bulkUpdateAttendanceStatus(data: {
    date: string;
    employee_ids: string[];
    update_arrival?: boolean;
    update_duration?: boolean;
  }): Promise<ApiResponse> {
    return this.apiCall('/api/attendance/bulk-update-status', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async getEmployeeSchedule(employeeId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/attendance/employee-schedule/${employeeId}`);
  }

  getArrivalStatusColor(status: string): string {
    switch (status) {
      case 'on_time': return 'success';
      case 'late': return 'warning';
      case 'absent': return 'failure';
      default: return 'gray';
    }
  }
  getWorkDurationColor(duration: string): string {
    switch (duration) {
      case 'full_day': return 'success';
      case 'half_day': return 'info';
      case 'short_leave': return 'warning';
      case 'on_leave': return 'purple';
      default: return 'gray';
    }
  }

  /* ---------------------------- RBAC / Clients --------------------------- */

  async getRoles(): Promise<ApiResponse> { return this.apiCall('/api/rbac/roles'); }
  async getPermissions(): Promise<ApiResponse> { return this.apiCall('/api/rbac/permissions'); }
  async createRole(roleData: {
    name: string; description?: string; access_level: 'basic' | 'moderate' | 'full'; permissions: string[];
  }): Promise<ApiResponse> {
    return this.apiCall('/api/rbac/roles', { method: 'POST', body: JSON.stringify(roleData) });
  }
  async updateRole(roleId: string, roleData: {
    name?: string; description?: string; access_level?: 'basic' | 'moderate' | 'full'; permissions?: string[];
  }): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/roles/${roleId}`, { method: 'PUT', body: JSON.stringify(roleData) });
  }
  async deleteRole(roleId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/roles/${roleId}`, { method: 'DELETE' });
  }
  async getRole(roleId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/roles/${roleId}`);
  }

  async getClients(): Promise<ApiResponse> { return this.apiCall('/api/clients'); }
  async createClient(clientData: {
    name: string; description?: string; contact_email?: string; phone?: string; address?: string;
  }): Promise<ApiResponse> {
    return this.apiCall('/api/clients', { method: 'POST', body: JSON.stringify(clientData) });
  }
  async updateClient(clientId: string, clientData: {
    name?: string; description?: string; contact_email?: string; phone?: string; address?: string;
  }): Promise<ApiResponse> {
    return this.apiCall(`/api/clients/${clientId}`, { method: 'PUT', body: JSON.stringify(clientData) });
  }
  async deleteClient(clientId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/clients/${clientId}`, { method: 'DELETE' });
  }

  /* ------------------------- Admin User Management ----------------------- */

  async getAdminUsers(): Promise<ApiResponse> { return this.apiCall('/api/rbac/admin-users'); }
  async getAdminUser(userId: string): Promise<ApiResponse> { return this.apiCall(`/api/rbac/admin-users/${userId}`); }
  async createAdminUser(userData: {
    name: string; email: string; password: string; role_id: string;
    department?: string; client_id?: string; is_active?: boolean; is_super_admin?: boolean;
  }): Promise<ApiResponse> {
    return this.apiCall('/api/rbac/admin-users', { method: 'POST', body: JSON.stringify(userData) });
  }
  async updateAdminUser(userId: string, userData: {
    name?: string; email?: string; role_id?: string; department?: string; is_active?: boolean;
  }): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/admin-users/${userId}`, { method: 'PUT', body: JSON.stringify(userData) });
  }
  async deleteAdminUser(userId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/admin-users/${userId}`, { method: 'DELETE' });
  }
  async assignRoleToUser(userId: string, roleId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/rbac/admin-users/${userId}/assign-role`, {
      method: 'PUT', body: JSON.stringify({ role_id: roleId }),
    });
  }

  /* -------------------------- Health / Leaves APIs ----------------------- */

  async healthCheck(): Promise<ApiResponse> { return this.apiCall('/health'); }

  // Leave Types
  async getLeaveTypes(): Promise<ApiResponse<LeaveType[]>> { return this.apiCall('/api/leaves/types'); }
  async createLeaveType(data: CreateLeaveTypeData): Promise<ApiResponse> {
    return this.apiCall('/api/leaves/types', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateLeaveType(id: string, data: Partial<CreateLeaveTypeData>): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteLeaveType(id: string): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/types/${id}`, { method: 'DELETE' });
  }

  // Leave Requests - Employee
  async getMyLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
    const qs = ApiService.toQueryString(filters);
    return this.apiCall(`/api/leaves/my-requests${qs ? `?${qs}` : ''}`);
  }
  async submitLeaveRequest(data: CreateLeaveRequestData): Promise<ApiResponse> {
    return this.apiCall('/api/leaves/request', { method: 'POST', body: JSON.stringify(data) });
  }
  async cancelLeaveRequest(requestId: string): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/requests/${requestId}/cancel`, { method: 'PUT' });
  }

  // Leave Requests - Manager/HR
  async getAllLeaveRequests(filters?: LeaveRequestFilters): Promise<ApiResponse<LeaveRequest[]>> {
    const qs = ApiService.toQueryString(filters);
    return this.apiCall(`/api/leaves/requests${qs ? `?${qs}` : ''}`);
  }
  async approveLeaveRequest(requestId: string, comments?: string): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/requests/${requestId}/approve`, {
      method: 'PUT', body: JSON.stringify({ comments }),
    });
  }
  async rejectLeaveRequest(requestId: string, comments: string): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/requests/${requestId}/reject`, {
      method: 'PUT', body: JSON.stringify({ comments }),
    });
  }
  async bulkApproveRequests(requestIds: string[], comments?: string): Promise<ApiResponse> {
    return this.apiCall('/api/leaves/requests/bulk-approve', {
      method: 'POST', body: JSON.stringify({ request_ids: requestIds, comments }),
    });
  }

  // Dashboard & Analytics
  async getLeaveDashboard(date?: string): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/dashboard${date ? `?date=${date}` : ''}`);
  }
  async getEmployeeLeaveBalance(employeeId: string, year?: number): Promise<ApiResponse> {
    return this.apiCall(`/api/leaves/balance/${employeeId}${year ? `?year=${year}` : ''}`);
  }
  async getLeaveAnalytics(filters?: {
    start_date?: string; end_date?: string; department_id?: string; leave_type_id?: string;
  }): Promise<ApiResponse> {
    const qs = ApiService.toQueryString(filters);
    return this.apiCall(`/api/leaves/analytics${qs ? `?${qs}` : ''}`);
  }

  // Export
  async exportLeaveData(filters?: {
    start_date?: string;
    end_date?: string;
    format?: 'json' | 'csv' | 'xlsx';
    status?: string;
    department_id?: string;
  }): Promise<ApiResponse> {
    const qs = ApiService.toQueryString(filters);
    const url = `/api/leaves/export${qs ? `?${qs}` : ''}`;

    if (filters?.format === 'csv') {
      const response = await fetch(`${this.baseURL}${url}`, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Export failed');
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
    }

    return this.apiCall(url);
  }

  /* -------------------- Manual Attendance helpers -------------------- */

private normalizeTime(t?: string) {
  // Accept "HH:MM" and "HH:MM:SS" and return "HH:MM:SS" or undefined
  if (!t) return undefined;
  const parts = t.split(':');
  if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
  if (parts.length === 3) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0')}`;
  return undefined;
}

/** List attendance for a single date (used by Manual Sheet) */
async listAttendanceByDate(date: string) {
  return this.getAttendanceRecords({
    page: 1,
    limit: 10000,
    startDate: date,
    endDate: date,
    sortBy: 'employee_id',
    sortOrder: 'ASC',
  });
}

/** Create a new attendance row (manual sheet) */
async createAttendanceRow(input: {
  employee_id: string;
  date: string;                        // YYYY-MM-DD
  check_in_time?: string;              // HH:MM or HH:MM:SS
  check_out_time?: string;
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
}) {
  const body = {
    employee_id: input.employee_id,
    date: input.date,
    check_in_time: this.normalizeTime(input.check_in_time),
    check_out_time: this.normalizeTime(input.check_out_time),
    work_type: input.work_type ?? undefined,
    // If your backend actually expects "work_location", this line makes it work too:
    work_location: input.work_type ?? undefined,
    notes: input.notes ?? undefined,
  };
  return this.apiCall<{ id: string }>('/api/attendance', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Update an existing attendance row (manual sheet) */
async updateAttendanceRow(id: string, patch: {
  check_in_time?: string;
  check_out_time?: string;
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
}) {
  const body = {
    check_in_time: this.normalizeTime(patch.check_in_time),
    check_out_time: this.normalizeTime(patch.check_out_time),
    work_type: patch.work_type ?? undefined,
    // If backend uses "work_location", send both
    work_location: patch.work_type ?? undefined,
    notes: patch.notes ?? undefined,
  };
  return this.apiCall(`/api/attendance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Bulk upsert helper if you want “Save All” to call one method */
async upsertManualRows(rows: Array<{
  id?: string;
  employee_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
}>) {
  await Promise.all(rows.map(r => {
    return r.id
      ? this.updateAttendanceRow(r.id, r)
      : this.createAttendanceRow(r as any);
  }));
}
 /* ---------------------------- UI Utilities ----------------------------- */

  formatTime(time?: string): string {
    if (!time) return 'Not Recorded';
    try {
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 < 12 ? 'AM' : 'PM';
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  }

  formatDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  }

  calculateHours(checkIn?: string, checkOut?: string): number {
    if (!checkIn || !checkOut) return 0;
    try {
      const checkInTime = new Date(`2000-01-01 ${checkIn}`);
      const checkOutTime = new Date(`2000-01-01 ${checkOut}`);
      const diffMs = checkOutTime.getTime() - checkInTime.getTime();
      return Math.max(0, diffMs / (1000 * 60 * 60));
    } catch {
      return 0;
    }
  }

  getStatusBadgeColor(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'present': return 'success';
      case 'late': return 'warning';
      case 'absent': return 'failure';
      case 'half_day': return 'info';
      case 'on_leave': return 'purple';
      default: return 'gray';
    }
  }
}

/* Singleton */
export const apiService = new ApiService();
export default apiService;
