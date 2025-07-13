import React from 'react';
import { Navigate } from 'react-router-dom';
import { useDynamicRBAC } from './rbacSystem';

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
  redirectTo = '/admin/login',
  fallback
}) => {
  const { currentUser, hasPermission } = useDynamicRBAC();

  // Check if user is logged in
  if (!currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check if user has required permission
  if (!hasPermission(permission)) {
    return fallback ? <>{fallback}</> : <Navigate to="/admin/unauthorized" replace />;
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

// ========== PROTECTED BUTTON COMPONENT ==========

interface DynamicProtectedButtonProps {
  children: React.ReactNode;
  permission: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any; // Allow other props
}

export const DynamicProtectedButton: React.FC<DynamicProtectedButtonProps> = ({
  children,
  permission,
  onClick,
  className = '',
  disabled = false,
  ...props
}) => {
  const { hasPermission } = useDynamicRBAC();

  if (!hasPermission(permission)) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// ========== ROLE-BASED SIDEBAR ITEM ==========

interface DynamicSidebarItemProps {
  children: React.ReactNode;
  permission: string;
  className?: string;
}

export const DynamicSidebarItem: React.FC<DynamicSidebarItemProps> = ({
  children,
  permission,
  className = ''
}) => {
  const { hasPermission } = useDynamicRBAC();

  if (!hasPermission(permission)) {
    return null;
  }

  return <div className={className}>{children}</div>;
};

// ========== UNAUTHORIZED PAGE ==========

export const UnauthorizedPage: React.FC = () => {
  const { currentUser, roles } = useDynamicRBAC();
  
  const getUserRole = () => {
    if (!currentUser) return null;
    return roles.find(role => role.id === currentUser.roleId);
  };

  const userRole = getUserRole();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Access Denied
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Sorry, you don't have permission to access this resource.
        </p>
        
        {currentUser && userRole && (
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Your Current Access:
            </h3>
            <div className="text-sm space-y-1">
              <p><strong>Role:</strong> {userRole.name}</p>
              <p><strong>Access Level:</strong> {userRole.accessLevel}</p>
              <p><strong>Permissions:</strong> {userRole.permissions.length}</p>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          <button 
            onClick={() => window.history.back()}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Go Back
          </button>
          <button 
            onClick={() => window.location.href = '/admin/dashboard'}
            className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

// ========== PERMISSION CHECKER HOOK ==========

export const usePermissionChecker = () => {
  const { hasPermission, currentUser, roles } = useDynamicRBAC();

  const checkPermission = (permission: string): boolean => {
    return hasPermission(permission);
  };

  const checkMultiplePermissions = (permissions: string[], requireAll = false): boolean => {
    if (requireAll) {
      return permissions.every(permission => hasPermission(permission));
    }
    return permissions.some(permission => hasPermission(permission));
  };

  const getUserPermissions = (): string[] => {
    if (!currentUser) return [];
    const userRole = roles.find(role => role.id === currentUser.roleId);
    return userRole?.permissions || [];
  };

  const hasAnyAdminAccess = (): boolean => {
    return hasPermission('rbac.view') || hasPermission('settings.edit');
  };

  return {
    checkPermission,
    checkMultiplePermissions,
    getUserPermissions,
    hasAnyAdminAccess,
    currentUser,
    roles
  };
};

// ========== USAGE EXAMPLES COMPONENT ==========

export const DynamicRBACUsageExamples: React.FC = () => {
  const { currentUser, roles } = useDynamicRBAC();
  const { checkPermission, getUserPermissions } = usePermissionChecker();

  if (!currentUser) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg">
        <p className="text-yellow-800">Please log in to see RBAC examples.</p>
      </div>
    );
  }

  const userRole = roles.find(role => role.id === currentUser.roleId);
  const userPermissions = getUserPermissions();

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Dynamic RBAC System Demo
      </h2>

      {/* User Info */}
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">Current User Information:</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Name:</strong> {currentUser.name}
          </div>
          <div>
            <strong>Email:</strong> {currentUser.email}
          </div>
          <div>
            <strong>Role:</strong> {userRole?.name}
          </div>
          <div>
            <strong>Access Level:</strong> {userRole?.accessLevel}
          </div>
          <div>
            <strong>Department:</strong> {currentUser.department || 'Not assigned'}
          </div>
          <div>
            <strong>Total Permissions:</strong> {userPermissions.length}
          </div>
        </div>
      </div>

      {/* Permission Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DynamicProtectedComponent 
          permission="rbac.create"
          fallback={
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              ❌ Cannot create roles
            </div>
          }
        >
          <div className="p-4 bg-green-100 text-green-700 rounded-lg">
            ✅ Can create new roles
          </div>
        </DynamicProtectedComponent>

        <DynamicProtectedComponent 
          permission="employees.delete"
          fallback={
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              ❌ Cannot delete employees
            </div>
          }
        >
          <div className="p-4 bg-green-100 text-green-700 rounded-lg">
            ✅ Can delete employees
          </div>
        </DynamicProtectedComponent>

        <DynamicProtectedComponent 
          permission="payroll.process"
          fallback={
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              ❌ Cannot process payroll
            </div>
          }
        >
          <div className="p-4 bg-green-100 text-green-700 rounded-lg">
            ✅ Can process payroll
          </div>
        </DynamicProtectedComponent>

        <DynamicProtectedComponent 
          permission="settings.admin"
          fallback={
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              ❌ No admin settings access
            </div>
          }
        >
          <div className="p-4 bg-green-100 text-green-700 rounded-lg">
            ✅ Has admin settings access
          </div>
        </DynamicProtectedComponent>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <h3 className="font-semibold">Available Actions:</h3>
        <div className="flex flex-wrap gap-2">
          <DynamicProtectedButton
            permission="rbac.create"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => alert('Create Role clicked!')}
          >
            Create Role
          </DynamicProtectedButton>

          <DynamicProtectedButton
            permission="employees.create"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            onClick={() => alert('Add Employee clicked!')}
          >
            Add Employee
          </DynamicProtectedButton>

          <DynamicProtectedButton
            permission="payroll.process"
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            onClick={() => alert('Process Payroll clicked!')}
          >
            Process Payroll
          </DynamicProtectedButton>

          <DynamicProtectedButton
            permission="settings.admin"
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            onClick={() => alert('Admin Settings clicked!')}
          >
            Admin Settings
          </DynamicProtectedButton>
        </div>
      </div>

      {/* Permissions List */}
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">Your Permissions:</h3>
        <div className="flex flex-wrap gap-1">
          {userPermissions.map((permission) => {
            const [module, action] = permission.split('.');
            return (
              <span 
                key={permission}
                className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
              >
                {module}.{action}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DynamicRBACUsageExamples;