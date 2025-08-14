// src/components/RBACSystem/rbacSystem.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, LoginResponse, User } from '../../services/api';
import { Navigate, useLocation } from 'react-router-dom';
// ========== TYPE DEFINITIONS ==========

export interface Role {
  id: string;
  name: string;
  description: string;
  access_level: 'basic' | 'moderate' | 'full';
  is_system_role: number;
  is_editable: boolean;
  is_active: boolean;
  permissions?: string[];
  permission_count?: number;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
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
  
  // CRUD methods
  createRole: (roleData: {
    name: string;
    description?: string;
    access_level: 'basic' | 'moderate' | 'full';
    permissions: string[];
  }) => Promise<void>;
  updateRole: (roleId: string, updates: {
    name?: string;
    description?: string;
    access_level?: 'basic' | 'moderate' | 'full';
    permissions?: string[];
  }) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
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
    console.log('🚀 Starting auth initialization...');
    setIsLoading(true);
    setError(null);

    // Check if user is already logged in
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('accessToken');
    const savedRefreshToken = localStorage.getItem('refreshToken');

    console.log('🔍 Checking localStorage:', { 
      hasUser: !!savedUser, 
      hasToken: !!savedToken, 
      hasRefresh: !!savedRefreshToken 
    });

    if (savedUser && savedToken &&savedRefreshToken) {
      try {
        const user: User = JSON.parse(savedUser);
        console.log('✅ Restoring user from localStorage:', user);
        
        // ✅ CRITICAL: Set user state IMMEDIATELY
        setCurrentUser(user);
        
        // 🔧 FIX: Set current client from user data
        if (user.clientId && user.clientName) {
          const clientFromUser = {
            id: user.clientId,
            name: user.clientName,
            description: '',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          console.log('✅ Setting current client from user data:', clientFromUser);
          setCurrentClientState(clientFromUser);
        }
        
        console.log('✅ User and client state set, starting background refresh...');
        
        // Run background tasks without blocking
        setTimeout(async () => {
          try {
            console.log('🔄 Attempting to refresh user data...');
            await refreshUserData();
            console.log('✅ User data refreshed successfully');
            
            // Load RBAC data AFTER user is confirmed
            console.log('🚀 Initializing RBAC data for user:', user.name);
            await loadRoles();
            await loadClients();
            await loadAdminUsers();
            console.log('✅ RBAC data loaded successfully');
            
          } catch (error) {
            console.warn('⚠️ Background refresh failed, using cached data:', error);
          }
        }, 100); // Small delay to let user state propagate
        
      } catch (parseError) {
        console.error('❌ Failed to parse saved user data:', parseError);
        // Clear corrupted data
        

        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setCurrentUser(null);
        setCurrentClientState(null);
      }
    } else {
      console.log('ℹ️ No saved user data found');
      setCurrentUser(null);
      setCurrentClientState(null);
    }
  } catch (error) {
    console.error('❌ Auth initialization failed:', error);
    setError('Failed to initialize authentication');
    setCurrentUser(null);
    setCurrentClientState(null);
  } finally {
    // ✅ CRITICAL: Set loading to false AFTER user is set
    console.log('✅ Auth initialization complete');
    setIsLoading(false);
  }
};


  // ========== DATA LOADING ==========

  const loadRoles = async (): Promise<void> => {
    try {
      console.log('🔄 Loading roles from API...');
      const response = await apiService.getRoles();
      if (response.success && response.data) {
        console.log('✅ Roles loaded:', response.data.roles?.length || 0);
        setRoles(response.data.roles || []);
        

      }
    } catch (error) {
      console.error('❌ Failed to load roles:', error);
      setError('Failed to load roles');
    }
  };

  // const loadClients = async (): Promise<void> => {

  //   try {


      
  //     console.log('🔄 Loading clients from API...');
  //     const response = await apiService.getClients();
  //     if (response.success && response.data) {
  //       console.log('✅ Clients loaded:', response.data.clients?.length || 0);
  //       setClients(response.data.clients || []);
  //       console.log("sam",response.data)
  //     }
  //   } catch (error) {
  //     console.error('❌ Failed to load clients:', error);
  //     // Don't set error for clients as it might not be available
  //   }
  // };

 
  // ========== DATA LOADING ON USER LOGIN ==========
  useEffect(() => {
    const initializeData = async () => {
      if (currentUser) {
        console.log('🚀 Initializing RBAC data for user:', currentUser.name);
        try {
          await Promise.all([
            loadRoles(),
          //  loadClients(), // Uncomment if you have client endpoints
          ]);
        } catch (error) {
          console.error('Failed to initialize RBAC data:', error);
        }
      }
    };

    initializeData();
  }, [currentUser]);

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
        
        // ✅ SAVE TO LOCALSTORAGE
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        
        // Set current user state
        setCurrentUser(user);
        setError(null);
        
        console.log('✅ Login successful, user set:', user);
        
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
      
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  };

  const refreshUserData = async (): Promise<void> => {
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        setCurrentUser(response.data.user);

        console.log("my data", response.data);
        // localStorage.setItem('user', JSON.stringify(response.data.user));
         setCurrentUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      throw error;
    }
  };

const hasPermission = (permission: string): boolean => {
  if (!currentUser) return false;
  if (!!currentUser.isSuperAdmin) return true;

  // Handle object-based permissions (after refresh)
  if (Array.isArray(currentUser.permissions) && typeof currentUser.permissions[0] === 'object') {
    return currentUser.permissions.some((perm: any) => perm.key === permission);
  }

  // Handle string-based permissions (e.g., fresh login)
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
    console.log('🚀 Setting current client:', clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setCurrentClientState(client);
    }
  };

  // ========== ROLE MANAGEMENT ==========

  const createRole = async (roleData: {
    name: string;
    description?: string;
    access_level: 'basic' | 'moderate' | 'full';
    permissions: string[];
  }): Promise<void> => {
    try {
      console.log('🚀 Creating role:', roleData);
      setError(null);
      
      const response = await apiService.createRole(roleData);
      
      if (response.success) {
        console.log('✅ Role created successfully');
        
        // Reload roles to get the new role
        await loadRoles();
      } else {
        console.error('❌ Role creation failed:', response.message);
        setError(response.message || 'Failed to create role');
        throw new Error(response.message || 'Failed to create role');
      }
    } catch (error: any) {
      console.error('💥 Role creation error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create role';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateRole = async (roleId: string, updates: {
    name?: string;
    description?: string;
    access_level?: 'basic' | 'moderate' | 'full';
    permissions?: string[];
  }): Promise<void> => {
    try {
      console.log('🚀 Updating role:', roleId, updates);
      setError(null);
      
      const response = await apiService.updateRole(roleId, updates);
      
      if (response.success) {
        console.log('✅ Role updated successfully');
        
        // Reload roles to get the updated role
        await loadRoles();
      } else {
        console.error('❌ Role update failed:', response.message);
        setError(response.message || 'Failed to update role');
        throw new Error(response.message || 'Failed to update role');
      }
    } catch (error: any) {
      console.error('💥 Role update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update role';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteRole = async (roleId: string): Promise<void> => {
    try {
      console.log('🚀 Deleting role:', roleId);
      setError(null);
      
      const response = await apiService.deleteRole(roleId);
      
      if (response.success) {
        console.log('✅ Role deleted successfully');
        
        // Reload roles to remove the deleted role
        await loadRoles();
      } else {
        console.error('❌ Role deletion failed:', response.message);
        setError(response.message || 'Failed to delete role');
        throw new Error(response.message || 'Failed to delete role');
      }
    } catch (error: any) {
      console.error('💥 Role deletion error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete role';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
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
  return <Navigate to="/admin/login" replace />;
}

  // Check if user has required permission
  if (!hasPermission(permission)) {
    console.log('🚫 User does not have required permission:', permission);

    //User does not have required permission: dashboard.view

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