// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import Loadable from 'src/layouts/full/shared/loadable/Loadable';
import { DynamicProtectedRoute, UnauthorizedPage } from '../components/RBACSystem/rbacExamples';

/* *Layouts** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// Dashboard
const Dashboard = Loadable(lazy(() => import('../components/dashboard/DashboardView')));

// Attendance
const Attendance = Loadable(lazy(() => import('../components/Attendance/AttendanceView')));

//Payroll
const Payroll = Loadable(lazy(() => import('../components/Payroll/PayrollView')));

//Employees
const AllEmployees = Loadable(lazy(() => import('../components/Employees/AllEmployees')));
const AddEmployees = Loadable(lazy(() => import('../components/Employees/AddEmployees')));
const EmployeeDetails = Loadable(lazy(() => import('../components/Employees/EmployeeDetails')));
const EditEmployeeDetails = Loadable(lazy(() => import('../components/Employees/EditEmployeeDetails')));

//Departments
const ViewDepartments = Loadable(lazy(() => import('../components/Departments/DepartmentsPage')));
const EmployeesByDesignation = Loadable(lazy(() => import('../components/Departments/EmployeesByDesignation')));

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
const RbacExamples = Loadable(lazy(() => import('../components/RBACSystem/rbacExamples')));

const Router = [
  {
    path: '/',
    element: <FullLayout />,
    children: [
      { 
        path: '/', 
        exact: true, 
        element: <Navigate to="/admin/login" replace /> 
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
          <DynamicProtectedRoute permission="employees.view">
            <ViewDepartments />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/departments-employees', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="employees.view">
            <EmployeesByDesignation />
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
          <DynamicProtectedRoute permission="leaves.approve">
            <LeaveRequestsManagement />
          </DynamicProtectedRoute>
        )
      },
      { 
        path: '/holidays', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="leaves.view">
            <HolidayPage />
          </DynamicProtectedRoute>
        )
      },
      
      // Payroll Management
      { 
        path: '/payroll', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="payroll.view">
            <Payroll />
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
          <DynamicProtectedRoute permission="settings.view">
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
      { 
        path: '/rbacexamples', 
        exact: true, 
        element: (
          <DynamicProtectedRoute permission="dashboard.view">
            <RbacExamples />
          </DynamicProtectedRoute>
        )
      },
      
      // Unauthorized page
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
  {
    path: '/admin',
    element: <BlankLayout />,
    children: [
      { path: 'login', element: <AdminLogin /> },
    ],
  },
];

const router = createBrowserRouter(Router, { basename: '/MatDash' });
export default router;