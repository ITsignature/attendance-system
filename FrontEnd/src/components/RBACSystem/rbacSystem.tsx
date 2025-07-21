// src/components/RBACSystem/rbacSystem.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, LoginResponse, User } from '../../services/api';

// ========== TYPE DEFINITIONS ==========

export interface Role {
  id: string;
  name: string;
  description: string;
  access_level: 'basic' | 'moderate' | 'full';
  is_system_role: boolean;
  is_editable: boolean;
  is_active: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface Client {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  clientId: string;
  roleId: string;
  department?: string;
  is_active: boolean;
}

// ========== MODULES FOR ROLE MANAGEMENT ==========
export const MODULES = {
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Main dashboard and analytics',
    permissions: [
      { id: 'dashboard.view', name: 'View Dashboard', description: 'Access to main dashboard and overview' }
    ]
  },
  employees: {
    id: 'employees',
    name: 'Employee Management',
    description: 'Manage employee records and information',
    permissions: [
      { id: 'employees.view', name: 'View Employees', description: 'View employee list and profiles' },
      { id: 'employees.create', name: 'Add Employees', description: 'Add new employees to the system' },
      { id: 'employees.edit', name: 'Edit Employees', description: 'Modify employee information' },
      { id: 'employees.delete', name: 'Delete Employees', description: 'Remove employees from system' }
    ]
  },
  attendance: {
    id: 'attendance',
    name: 'Attendance Management',
    description: 'Track and manage employee attendance',
    permissions: [
      { id: 'attendance.view', name: 'View Attendance', description: 'View attendance records and reports' },
      { id: 'attendance.edit', name: 'Edit Attendance', description: 'Modify attendance records' },
      { id: 'attendance.reports', name: 'Attendance Reports', description: 'Generate attendance reports' }
    ]
  },
  leaves: {
    id: 'leaves',
    name: 'Leave Management',
    description: 'Manage leave requests and approvals',
    permissions: [
      { id: 'leaves.view', name: 'View Leaves', description: 'View leave records and requests' },
      { id: 'leaves.approve', name: 'Approve Leaves', description: 'Approve employee leave requests' },
      { id: 'leaves.reject', name: 'Reject Leaves', description: 'Reject employee leave requests' }
    ]
  },
  payroll: {
    id: 'payroll',
    name: 'Payroll Management',
    description: 'Manage employee payroll and compensation',
    permissions: [
      { id: 'payroll.view', name: 'View Payroll', description: 'View payroll information and reports' },
      { id: 'payroll.process', name: 'Process Payroll', description: 'Process monthly payroll' },
      { id: 'payroll.edit', name: 'Edit Payroll', description: 'Modify payroll records and salaries' },
      { id: 'payroll.reports', name: 'Payroll Reports', description: 'Generate payroll reports' }
    ]
  },
  settings: {
    id: 'settings',
    name: 'System Settings',
    description: 'Manage system configuration and settings',
    permissions: [
      { id: 'settings.view', name: 'View Settings', description: 'View system configuration' },
      { id: 'settings.edit', name: 'Edit Settings', description: 'Modify system settings' }
    ]
  },
  rbac: {
    id: 'rbac',
    name: 'Role & Permission Management',
    description: 'Manage roles and permissions',
    permissions: [
      { id: 'rbac.view', name: 'View Roles', description: 'View roles and permissions' },
      { id: 'rbac.create', name: 'Create Roles', description: 'Create new custom roles' },
      { id: 'rbac.edit', name: 'Edit Roles', description: 'Modify existing roles' },
      { id: 'rbac.delete', name: 'Delete Roles', description: 'Delete custom roles' },
      { id: 'rbac.assign', name: 'Assign Roles', description: 'Assign roles to users' }
    ]
  }
};

export interface DynamicRBACContextType {
  // Auth state
  currentUser: User | null;
  currentClient: Client | null;
  isLoading: boolean;
  error: string | null;
  
  // Data
  roles: Role[];
  clients: Client[];
  adminUsers: AdminUser[];
  
  // Auth methods
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Permission methods
  hasPermission: (permission: string) => boolean;
  getAllPermissions: () => string[];
  getInheritedPermissions: (permissions: string[]) => string[];
  
  // Data methods
  refreshUserData: () => Promise<void>;
  setCurrentClient: (clientId: string) => void;
  
  // CRUD methods (if needed)
  createRole?: (roleData: Omit<Role, 'id'>) => Promise<void>;
  updateRole?: (roleId: string, updates: Partial<Role>) => Promise<void>;
  deleteRole?: (roleId: string) => Promise<void>;
}

// ========== CONTEXT CREATION ==========

const DynamicRBACContext = createContext<DynamicRBACContextType | undefined>(undefined);

// ========== PROVIDER COMPONENT ==========

interface DynamicRBACProviderProps {
  children: ReactNode;
}

export const DynamicRBACProvider: React.FC<DynamicRBACProviderProps> = ({ children }) => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentClient, setCurrentClientState] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [roles, setRoles] = useState<Role[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  // ========== INITIALIZATION ==========
  
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is already logged in
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('accessToken');

      if (savedUser && savedToken) {
        const user: User = JSON.parse(savedUser);
        setCurrentUser(user);
        
        // Try to get fresh user data from API
        try {
          await refreshUserData();
        } catch (error) {
          console.warn('Failed to refresh user data, using cached data');
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      setError('Failed to initialize authentication');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== AUTH METHODS ==========

  const login = async (email: string, password: string): Promise<boolean> => {
  setIsLoading(true);
  setError(null);
  
  try {
    console.log('🔐 Attempting admin login for:', email);
    
    const response = await apiService.login(email, password);
    
    console.log('✅ Login response:', response);
    
    if (response.success && response.data) {
      // Check if user is an admin user (has proper role/permissions)
      const user = response.data.user;
      console.log(user);
      
      if (!user.roleId || !user.permissions || user.permissions.length === 0) {
        setError('Access denied: Admin privileges required');
        return false;
      }
      
      setCurrentUser(response.data.user);
      setError(null);
      return true;
    } else {
      setError(response.message || 'Login failed - Admin access required');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Login error:', error);
    
    // Handle specific backend error responses
    if (error.response?.status === 401) {
      const errorData = error.response.data;
      setError(errorData.message || 'Invalid credentials or access denied');
    } else if (error.response?.status === 403) {
      setError('Access forbidden - Admin privileges required');
    } else if (error.response?.status === 429) {
      setError('Too many login attempts - Please try again later');
    } else {
      setError('Login failed - Please check your internet connection');
    }
    return false;
  } finally {
    setIsLoading(false);
  }
};

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local state regardless of API success
      setCurrentUser(null);
      setCurrentClientState(null);
      setRoles([]);
      setClients([]);
      setAdminUsers([]);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        setCurrentUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      throw error;
    }
  };

  // ========== PERMISSION METHODS ==========

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    
    // Super admin has all permissions
    if (currentUser.isSuperAdmin) return true;
    
    // Check if user has specific permission
    return currentUser.permissions.includes(permission);
  };

  const getAllPermissions = (): string[] => {
    return currentUser?.permissions || [];
  };

  const getInheritedPermissions = (permissions: string[]): string[] => {
    // For now, just return the permissions as-is
    // In a more complex system, you might add inherited permissions based on role hierarchy
    return permissions;
  };

  // ========== CLIENT MANAGEMENT ==========

  const setCurrentClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setCurrentClientState(client);
    }
  };

  // ========== ROLE MANAGEMENT (Optional) ==========

  const createRole = async (roleData: Omit<Role, 'id'>): Promise<void> => {
    // Implementation would call API
    console.log('Create role:', roleData);
  };

  const updateRole = async (roleId: string, updates: Partial<Role>): Promise<void> => {
    // Implementation would call API
    console.log('Update role:', roleId, updates);
  };

  const deleteRole = async (roleId: string): Promise<void> => {
    // Implementation would call API
    console.log('Delete role:', roleId);
  };

  // ========== CONTEXT VALUE ==========

  const value: DynamicRBACContextType = {
    // Auth state
    currentUser,
    currentClient,
    isLoading,
    error,
    
    // Data
    roles,
    clients,
    adminUsers,
    
    // Auth methods
    login,
    logout,
    
    // Permission methods
    hasPermission,
    getAllPermissions,
    getInheritedPermissions,
    
    // Data methods
    refreshUserData,
    setCurrentClient,
    
    // CRUD methods
    createRole,
    updateRole,
    deleteRole
  };

  return (
    <DynamicRBACContext.Provider value={value}>
      {children}
    </DynamicRBACContext.Provider>
  );
};

// ========== HOOK ==========

export const useDynamicRBAC = (): DynamicRBACContextType => {
  const context = useContext(DynamicRBACContext);
  if (context === undefined) {
    throw new Error('useDynamicRBAC must be used within a DynamicRBACProvider');
  }
  return context;
};

// ========== PROTECTED ROUTE COMPONENT ==========

interface DynamicProtectedRouteProps {
  children: React.ReactNode;
  permission: string;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export const DynamicProtectedRoute: React.FC<DynamicProtectedRouteProps> = ({
  children,
  permission,
  fallback
}) => {
  const { currentUser, hasPermission, isLoading } = useDynamicRBAC();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Check if user is logged in
  if (!currentUser) {
    window.location.href = '/admin/login';
    return null;
  }

  // Check if user has required permission
  if (!hasPermission(permission)) {
    return fallback ? <>{fallback}</> : (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-500 mt-2">Required permission: {permission}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ========== PROTECTED COMPONENT ==========

interface DynamicProtectedComponentProps {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
}

export const DynamicProtectedComponent: React.FC<DynamicProtectedComponentProps> = ({
  children,
  permission,
  fallback = null
}) => {
  const { hasPermission } = useDynamicRBAC();

  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};