// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import Loadable from 'src/layouts/full/shared/loadable/Loadable';
import { useDynamicRBAC ,DynamicProtectedRoute } from '../components/RBACSystem/rbacSystem';
import LeaveRequestForm from '../components/Leaves/LeaveRequestForm';

/* *Layouts** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// Dashboard
const Dashboard = Loadable(lazy(() => import('../components/dashboard/DashboardView')));

// Attendance
const Attendance = Loadable(lazy(() => import('../components/Attendance/AttendanceView')));

//Payroll
const PayrollRunDashboard = Loadable(lazy(() => import('../components/Payroll/PayrollRunDashboard')));
const PayrollEmployeeRecords = Loadable(lazy(() => import('../components/Payroll/PayrollEmployeeRecords')));
const LivePayrollDashboard = Loadable(lazy(() => import('../components/LivePayrol/LivePayrollDashboard')));

const UnauthorizedPage = Loadable(lazy(() => import('../views/UnauthorizedPage')));

//Employees
const AllEmployees = Loadable(lazy(() => import('../components/Employees/AllEmployees')));
const AddEmployees = Loadable(lazy(() => import('../components/Employees/AddEmployees')));
const EmployeeDetails = Loadable(lazy(() => import('../components/Employees/EmployeeDetails')));
const EditEmployeeDetails = Loadable(lazy(() => import('../components/Employees/EditEmployeeDetails')));

//Departments
const ViewDepartments = Loadable(lazy(() => import('../components/Departments/EmployeesByDesignation')));
const DepartmentManagement = Loadable(lazy(() => import('../components/Departments/DepartmentsPage')));

//Leaves
const LeavePage = Loadable(lazy(() => import('../components/Leaves/leavesPage')));
const HolidayPage = Loadable(lazy(() => import('../components/Leaves/holidaysPage')));
const LeaveRequestsManagement = Loadable(lazy(() => import('../components/Leaves/LeaveRequests')));

// Icons
const Solar = Loadable(lazy(() => import('../views/icons/Solar')));

// Authentication
const Login = Loadable(lazy(() => import('../views/auth/login/Login')));
const Register = Loadable(lazy(() => import('../views/auth/register/Register')));
const Settings = Loadable(lazy(() => import('../components/Settings/Settings')));
const Error = Loadable(lazy(() => import('../views/auth/error/Error')));

// RBAC System Components
const RoleManagement = Loadable(lazy(() => import('../components/RBACSystem/roleManagement')));
const AdminUserManagement = Loadable(lazy(() => import('../components/RBACSystem/adminUserManagement')));
const AdminLogin = Loadable(lazy(() => import('../components/RBACSystem/adminLogin')));
const ManualAttendance =Loadable(lazy(() => import('../components/Attendance/ManualAttendance')));
const LivePayroll = Loadable(lazy(() => import('../components/LivePayrol/PayrollEmployeeRecords')));

// ==============================================
// SINGLE AUTHENTICATION WRAPPER FOR ENTIRE APP
// ==============================================
const AuthenticatedApp = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isLoading } = useDynamicRBAC();
  
  // Check if we have tokens while loading
  // 🔍 DEBUG: Log state changes
  console.log('🔍 AuthenticatedApp render:', { 
    currentUser: currentUser?.name || null, 
    isLoading 
  });
  const hasTokens = localStorage.getItem('accessToken') && localStorage.getItem('user');
  
  // Show loading if:
  // 1. Still loading AND no user set AND we have tokens (restoration in progress)
  if (isLoading && !currentUser && hasTokens) {    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-600">Restoring session...</p>
        </div>
      </div>
    );
  }
  
  // Show loading if still initializing
  if (isLoading) {
    console.log('⏳ Showing loading screen...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-600">Loading admin portal...</p>
        </div>
      </div>
    );
  }
  
  // Not logged in - redirect to admin login
  if (!currentUser) {
    console.log('❌ No user found, redirecting to login...');
    return <Navigate to="/admin/login" replace />;
  }
  
  // Logged in as admin - show the app
  console.log('✅ User authenticated, showing app for:', currentUser.name);
  return <>{children}</>;
};  

// ==============================================
// UPDATED ROUTER CONFIGURATION
// ==============================================
const Router = [
  {
    path: '/',
    element: (
      <AuthenticatedApp>
        <FullLayout />
      </AuthenticatedApp>
    ),
    
    children: [
      { 
        path: '/', 
        exact: true, 
        element: <Navigate to="/dashboard" replace /> 
      },
      
      // Dashboard - Basic access required
      { 
        path: '/dashboard', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="dashboard.view">
            <Dashboard />
          </DynamicProtectedRoute>
        )
      },
      
      // Employee Management - Various permission levels
      { 
        path: '/employees', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="employees.view">
            <AllEmployees />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/add-employee', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="employees.create">
            <AddEmployees />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/employee/:id', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="employees.view">
            <EmployeeDetails />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/edit-employee/:id', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="employees.edit">
            <EditEmployeeDetails />
          </DynamicProtectedRoute>
        )
      },
      
      // Department Management
      {
        path: '/Departments',
        exact: true,
        element: (
          <DynamicProtectedRoute permission="departments.view">
            <ViewDepartments />
          </DynamicProtectedRoute>
        )
      },
      {
        path: '/departments-manage',
        exact: true,
        element: (
          <DynamicProtectedRoute permission="departments.view">
            <DepartmentManagement />
          </DynamicProtectedRoute>
        )
      },
      
      // Attendance Management
      { 
        path: '/attendance', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="attendance.view">
            <Attendance />
          </DynamicProtectedRoute>
        )
      },

        { 
        path: '/manual-attendance', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="attendance.view">
            <ManualAttendance />
          </DynamicProtectedRoute>
        )
      },
      
      // Leave Management
      { 
        path: '/leaves', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="leaves.view">
            <LeavePage />
          </DynamicProtectedRoute>
        )
      },
      {
        path: '/leave-requests',
        exact: true,
        element: (
          <DynamicProtectedRoute permission="leaves.viewRequests">
            <LeaveRequestsManagement />
          </DynamicProtectedRoute>
        )
      },
      {
        path: '/holidays',
        exact: true,
        element: (
          <DynamicProtectedRoute permission="holidays.view">
            <HolidayPage />
          </DynamicProtectedRoute>
        )
      },
      {
  path: '/leave-request/new',
  exact: true,
  element: (
    <DynamicProtectedRoute permission="leaves.create">
      <LeaveRequestForm />
    </DynamicProtectedRoute>
  )
},

      // Payroll Management

      { 
        path: '/live-payroll', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="payroll.view">
            <LivePayroll />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/payroll', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="payroll.view">
            <PayrollRunDashboard />
          </DynamicProtectedRoute>
        )
      },
      {
        path: '/payroll/runs/:runId/employees',
        exact: true,
        element: (
          <DynamicProtectedRoute permission="payroll.view">
            <PayrollEmployeeRecords />
          </DynamicProtectedRoute>
        )
      },
      {
        path: '/payroll/runs/:runId/live',
        exact: true,
        element: (
          <DynamicProtectedRoute permission="payroll.view">
            <LivePayrollDashboard />
          </DynamicProtectedRoute>
        )
      },

      // System & Utilities
      { 
        path: '/icons/solar', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="dashboard.view">
            <Solar />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/settings',
        exact: true,
        element: (
          <DynamicProtectedRoute anyPermission={['settings.attendance.view', 'settings.leaves.view', 'settings.payroll.view', 'settings.payroll_components.view', 'settings.employee_allowances.view', 'settings.employee_deductions.view']}>
            <Settings />
          </DynamicProtectedRoute>
        )
      },
      
      // RBAC Management - Admin only
      { 
        path: '/rolemanagement', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="rbac.view">
            <RoleManagement />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/adminusermanagement', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="rbac.assign">
            <AdminUserManagement />
          </DynamicProtectedRoute>
        )
      },
      // { 
      //   path: '/rbacexamples', 
      //   exact: true, 
      //   element: (
      //     <DynamicProtectedRoute permission="dashboard.view">
      //       <RbacExamples />
      //     </DynamicProtectedRoute>
      //   )
      // },
      
      // Unauthorized page (for permission-denied within app)
      { 
        path: '/unauthorized', 
        exact: true, 
        element: <UnauthorizedPage />
      },
      
      { 
        path: '*', 
        element: <Navigate to="/auth/404" /> 
      },
    ],
  },
  
  // PUBLIC AUTHENTICATION ROUTES
  {
    path: '/auth',
    element: <BlankLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: '404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  
  // ADMIN LOGIN (Main login for your system)
  {
    path: '/admin',
    element: <BlankLayout />,
    children: [
      { path: 'login', element: <AdminLogin /> },
      { path: '*', element: <Navigate to="/admin/login" /> },
    ],
  },
];

const router = createBrowserRouter(Router);
export default router;