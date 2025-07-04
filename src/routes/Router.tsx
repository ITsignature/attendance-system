// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import Loadable from 'src/layouts/full/shared/loadable/Loadable';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// Dashboard
const Dashboard = Loadable(lazy(() => import('../views/dashboards/Dashboard')));

// utilities
const Typography = Loadable(lazy(() => import('../views/typography/Typography')));
const Table = Loadable(lazy(() => import('../views/tables/Table')));
const Form = Loadable(lazy(() => import('../views/forms/Form')));
const Shadow = Loadable(lazy(() => import('../views/shadows/Shadow')));


const AllEmployees = Loadable(lazy(() => import('../views/AllEmployees')));
const AddEmployees = Loadable(lazy(() => import('../views/AddEmployees')));
const EmployeeDetails = Loadable(lazy(() => import('../views/EmployeeDetails')));
const EditEmployeeDetails = Loadable(lazy(() => import('../views/EditEmployeeDetails')));
const ViewDepartments = Loadable(lazy(() => import('../views/DepartmentsPage')));
const EmployeesByDesignation = Loadable(lazy(() => import('../views/EmployeesByDesignation')));
const AttendancePage = Loadable(lazy(() => import('../views/AttendancePage')));
const LeavePage = Loadable(lazy(() => import('../views/leavesPage')));
const HolidayPage = Loadable(lazy(() => import('../views/holidaysPage')));

// icons
const Solar = Loadable(lazy(() => import('../views/icons/Solar')));

// authentication
const Login = Loadable(lazy(() => import('../views/auth/login/Login')));
const Register = Loadable(lazy(() => import('../views/auth/register/Register')));
const SamplePage = Loadable(lazy(() => import('../views/sample-page/SamplePage')));
const Error = Loadable(lazy(() => import('../views/auth/error/Error')));

const Router = [
  {
    path: '/',
    element: <FullLayout />,
    children: [
      { path: '/', exact: true, element: <Dashboard /> },
      { path: '/employees', exact: true, element: <AllEmployees /> },
      { path: '/add-employee', exact: true, element: <AddEmployees /> },
      { path: '/employee/:id', exact: true, element: <EmployeeDetails /> },
      { path: '/edit-employee/:id', exact: true, element: <EditEmployeeDetails /> },
      { path: '/Departments', exact: true, element: <ViewDepartments /> },
      { path: '/departments-employees', exact: true, element: <EmployeesByDesignation /> },
      { path: '/attendance', exact: true, element: <AttendancePage /> },
      { path: '/leaves', exact: true, element: <LeavePage /> },
      { path: '/holidays', exact: true, element: <HolidayPage /> },
   
      
      { path: '/ui/table', exact: true, element: <Table /> },
      { path: '/ui/form', exact: true, element: <Form /> },
      { path: '/ui/shadow', exact: true, element: <Shadow /> },
      { path: '/icons/solar', exact: true, element: <Solar /> },
      { path: '/sample-page', exact: true, element: <SamplePage /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/auth/login', element: <Login /> },
      { path: '/auth/register', element: <Register /> },
      { path: '404', element: <Error /> },
      { path: '/auth/404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
];

const router = createBrowserRouter(Router, { basename: '/MatDash' });
export default router;
