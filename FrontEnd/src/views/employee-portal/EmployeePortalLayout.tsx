import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useDynamicRBAC } from '../../components/RBACSystem/rbacSystem';
import EmployeeSidebar from './EmployeeSidebar';
import EmployeeHeader from './EmployeeHeader';

const EmployeePortalLayout = () => {
  const { currentUser, isLoading } = useDynamicRBAC();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect non-employees to admin login
  if (!currentUser || currentUser.roleName !== 'Employee') {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <EmployeeSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <EmployeeHeader />

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default EmployeePortalLayout;
