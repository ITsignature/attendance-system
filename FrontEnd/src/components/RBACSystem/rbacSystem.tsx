import React, { createContext, useContext, useState, useEffect } from 'react';

// ========== TYPES ==========

export interface Permission {
  id: string;
  name: string;
  module: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  accessLevel: 'basic' | 'moderate' | 'full';
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  clientId: string;
  department?: string;
  isActive: boolean;
}

export interface Client {
  id: string;
  name: string;
  isActive: boolean;
}

// ========== PREDEFINED MODULES & PERMISSIONS ==========

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
    description: 'Manage payroll and compensation',
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
    description: 'Configure system settings and preferences',
    permissions: [
      { id: 'settings.view', name: 'View Settings', description: 'View system configuration' },
      { id: 'settings.edit', name: 'Edit Settings', description: 'Modify system settings' },
      { id: 'settings.admin', name: 'Admin Settings', description: 'Access admin-only configurations' }
    ]
  },
  rbac: {
    id: 'rbac',
    name: 'Role Management',
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

// ========== PERMISSION INHERITANCE ==========

export const PERMISSION_HIERARCHY: Record<string, string[]> = {
  'employees.delete': ['employees.edit', 'employees.view'],
  'employees.edit': ['employees.view'],
  'employees.create': ['employees.view'],
  'payroll.process': ['payroll.edit', 'payroll.view'],
  'payroll.edit': ['payroll.view'],
  'payroll.reports': ['payroll.view'],
  'attendance.edit': ['attendance.view'],
  'attendance.reports': ['attendance.view'],
  'leaves.approve': ['leaves.view'],
  'leaves.reject': ['leaves.view'],
  'settings.edit': ['settings.view'],
  'settings.admin': ['settings.edit', 'settings.view'],
  'rbac.create': ['rbac.view'],
  'rbac.edit': ['rbac.view'],
  'rbac.delete': ['rbac.view'],
  'rbac.assign': ['rbac.view']
};

// ========== DEFAULT SYSTEM ROLES ==========

export const SYSTEM_ROLES: Role[] = [
  {
    id: 'employee-basic',
    name: 'Employee',
    description: 'Basic employee access - can view own data and apply for leave',
    permissions: ['dashboard.view', 'leaves.view'],
    isSystemRole: true,
    accessLevel: 'basic',
    createdAt: new Date().toISOString()
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Department manager - can manage team, approve leaves, view reports',
    permissions: [
      'dashboard.view',
      'employees.view',
      'attendance.view', 'attendance.reports',
      'leaves.view', 'leaves.approve', 'leaves.reject',
      'payroll.view', 'payroll.reports'
    ],
    isSystemRole: true,
    accessLevel: 'moderate',
    createdAt: new Date().toISOString()
  },
  {
    id: 'hr-admin',
    name: 'HR Admin',
    description: 'Full HR access - can manage all employees, payroll, and system settings',
    permissions: [
      'dashboard.view',
      'employees.view', 'employees.create', 'employees.edit', 'employees.delete',
      'attendance.view', 'attendance.edit', 'attendance.reports',
      'leaves.view', 'leaves.approve', 'leaves.reject',
      'payroll.view', 'payroll.process', 'payroll.edit', 'payroll.reports',
      'settings.view', 'settings.edit',
      'rbac.view', 'rbac.create', 'rbac.edit', 'rbac.delete', 'rbac.assign'
    ],
    isSystemRole: true,
    accessLevel: 'full',
    createdAt: new Date().toISOString()
  }
];

// ========== RBAC CONTEXT ==========

interface DynamicRBACContextType {
  // Current State
  currentUser: AdminUser | null;
  currentClient: Client | null;
  
  // Data
  roles: Role[];
  clients: Client[];
  adminUsers: AdminUser[];
  
  // Role Management
  createRole: (roleData: Omit<Role, 'id' | 'createdAt'>) => void;
  updateRole: (roleId: string, updates: Partial<Role>) => void;
  deleteRole: (roleId: string) => void;
  
  // Permission Utilities
  getAllPermissions: () => Permission[];
  getInheritedPermissions: (permissions: string[]) => string[];
  hasPermission: (permission: string) => boolean;
  
  // User Management
  createAdminUser: (userData: Omit<AdminUser, 'id'>) => void;
  updateAdminUser: (userId: string, updates: Partial<AdminUser>) => void;
  deleteAdminUser: (userId: string) => void;
  
  // Client Management
  setCurrentClient: (clientId: string) => void;
  
  // Auth
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const DynamicRBACContext = createContext<DynamicRBACContextType | undefined>(undefined);

// ========== RBAC PROVIDER ==========

export const DynamicRBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [currentClient, setCurrentClientState] = useState<Client | null>(null);
  const [roles, setRoles] = useState<Role[]>(SYSTEM_ROLES);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [clients] = useState<Client[]>([
    { id: 'client-1', name: 'Acme Corporation', isActive: true },
    { id: 'client-2', name: 'TechStart Inc', isActive: true },
    { id: 'client-3', name: 'Global Dynamics', isActive: true }
  ]);

  // Initialize demo data
  useEffect(() => {
    // Create demo admin users
    setAdminUsers([
      {
        id: 'admin-1',
        name: 'Sarah Johnson',
        email: 'sarah@acme.com',
        roleId: 'hr-admin',
        clientId: 'client-1',
        department: 'Human Resources',
        isActive: true
      },
      {
        id: 'admin-2',
        name: 'Mike Chen',
        email: 'mike@techstart.com',
        roleId: 'manager',
        clientId: 'client-2',
        department: 'Engineering',
        isActive: true
      }
    ]);

    // Set default client
    setCurrentClientState(clients[0]);
    
    // Load saved user
    const savedUser = localStorage.getItem('adminUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // ========== PERMISSION UTILITIES ==========

  const getAllPermissions = (): Permission[] => {
    return Object.values(MODULES).flatMap(module => 
      module.permissions.map(perm => ({
        ...perm,
        module: module.id,
        description: perm.description
      }))
    );
  };

  const getInheritedPermissions = (permissions: string[]): string[] => {
    const inheritedSet = new Set(permissions);
    
    permissions.forEach(permission => {
      const inherited = PERMISSION_HIERARCHY[permission] || [];
      inherited.forEach(inheritedPerm => inheritedSet.add(inheritedPerm));
    });
    
    return Array.from(inheritedSet);
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    
    const userRole = roles.find(role => role.id === currentUser.roleId);
    if (!userRole) return false;
    
    const allPermissions = getInheritedPermissions(userRole.permissions);
    return allPermissions.includes(permission);
  };

  // ========== ROLE MANAGEMENT ==========

  const createRole = (roleData: Omit<Role, 'id' | 'createdAt'>) => {
    const newRole: Role = {
      ...roleData,
      id: `custom-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    setRoles(prev => [...prev, newRole]);
  };

  const updateRole = (roleId: string, updates: Partial<Role>) => {
    setRoles(prev => prev.map(role => 
      role.id === roleId && !role.isSystemRole 
        ? { ...role, ...updates }
        : role
    ));
  };

  const deleteRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role && !role.isSystemRole) {
      setRoles(prev => prev.filter(r => r.id !== roleId));
      // Also update any users with this role to a default role
      setAdminUsers(prev => prev.map(user => 
        user.roleId === roleId 
          ? { ...user, roleId: 'employee-basic' }
          : user
      ));
    }
  };

  // ========== USER MANAGEMENT ==========

  const createAdminUser = (userData: Omit<AdminUser, 'id'>) => {
    const newUser: AdminUser = {
      ...userData,
      id: `user-${Date.now()}`
    };
    
    setAdminUsers(prev => [...prev, newUser]);
  };

  const updateAdminUser = (userId: string, updates: Partial<AdminUser>) => {
    setAdminUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, ...updates } : user
    ));
  };

  const deleteAdminUser = (userId: string) => {
    setAdminUsers(prev => prev.filter(user => user.id !== userId));
  };

  // ========== CLIENT MANAGEMENT ==========

  const setCurrentClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setCurrentClientState(client);
    }
  };

  // ========== AUTH ==========

  const login = (email: string, password: string): boolean => {
    // Demo login - in real app, this would call API
    const user = adminUsers.find(u => u.email === email);
    if (user && password === 'demo123') {
      setCurrentUser(user);
      localStorage.setItem('adminUser', JSON.stringify(user));
      
      // Set client based on user
      const userClient = clients.find(c => c.id === user.clientId);
      if (userClient) {
        setCurrentClientState(userClient);
      }
      
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('adminUser');
  };

  // ========== CONTEXT VALUE ==========

  const value: DynamicRBACContextType = {
    currentUser,
    currentClient,
    roles,
    clients,
    adminUsers,
    createRole,
    updateRole,
    deleteRole,
    getAllPermissions,
    getInheritedPermissions,
    hasPermission,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser,
    setCurrentClient,
    login,
    logout
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

// ========== PROTECTED COMPONENT ==========

interface ProtectedComponentProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const DynamicProtectedComponent: React.FC<ProtectedComponentProps> = ({
  permission,
  children,
  fallback = null
}) => {
  const { hasPermission } = useDynamicRBAC();
  
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};