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
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic API call method
  private async apiCall<T>(
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
    'gender', 'employee_id', 'department_id', 'designation_id', 
    'hire_date', 'employment_type', 'emergency_contact_name', 
    'emergency_contact_phone', 'emergency_contact_relation'
  ];
  
  for (const field of requiredFields) {
    if (!employeeData[field] || employeeData[field].toString().trim() === '') {
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

  // Attendance methods
  async getAttendance(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ApiResponse> {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString() : '';
    
    return this.apiCall(`/api/attendance${queryString}`);
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
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;