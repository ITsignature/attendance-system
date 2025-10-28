import {
  IconLayoutDashboard,
  IconUserPlus,
  IconUsers,
  IconClock,
  IconCalendar,
  IconCurrencyDollar,
  IconBuilding,
  IconSettings,
} from '@tabler/icons-react';

import { uniqueId } from 'lodash';

const SidebarContent = [
  {
    navlabel: true,
    subheader: 'Home',
    heading: 'Dashboard',
    children: [
      {
        id: uniqueId(),
        title: 'Dashboard',
        icon: IconLayoutDashboard,
        href: '/dashboard',
        permission: 'dashboard.view',
      },
    ],
  },
  {
    navlabel: true,
    subheader: 'HR Management',
    heading: 'Human Resources',
    children: [
      {
        id: uniqueId(),
        title: 'All Employees',
        icon: IconUsers,
        href: '/employees',
        permission: 'employees.view',
      },
      // {
      //   id: uniqueId(),
      //   title: 'Add Employee',
      //   icon: IconUserPlus,
      //   href: '/add-employee',
      //   permission: 'employees.create',
      // },
      {
        id: uniqueId(),
        title: 'Attendance',
        icon: IconClock,
        href: '/attendance',
        permission: 'attendance.view',
      },
        {
        id: uniqueId(),
        title: 'Payroll',
        icon: IconCurrencyDollar,
        href: '/payroll',
        permission: 'payroll.view',
      },
      {
        id: uniqueId(),
        title: 'live Payroll',
        icon: IconCurrencyDollar,
        href: '/live-payroll',
        permission: 'payroll.view',
      },
     
      // {
      //   id: uniqueId(),
      //   title: 'Dept. Employees',
      //   icon: IconUsers,
      //   href: '/departments-employees',
      //   permission: 'employees.view',
      // },
      {
        id: uniqueId(),
        title: 'Leaves',
        icon: IconCalendar,
        href: '/leaves',
        permission: 'leaves.view',
      },
      // {
      //   id: uniqueId(),
      //   title: 'Leave Requests',
      //   icon: IconCalendar,
      //   href: '/leave-requests',
      //   permission: 'leaves.approve',
      // },
   
       {
        id: uniqueId(),
        title: 'Departments',
        icon: IconBuilding,
        href: '/Departments',
        permission: 'employees.view',
      },
         {
        id: uniqueId(),
        title: 'Holidays',
        icon: IconCalendar,
        href: '/holidays',
        permission: 'leaves.view',
      },
    
    ],
  },
  {
    navlabel: true,
    subheader: 'Utilities',
    heading: 'System',
    children: [
      {
        id: uniqueId(),
        title: 'Settings',
        icon: IconSettings,
        href: '/settings',
        permission: 'settings.view',
      },
    ],
  },
  {
    navlabel: true,
    subheader: 'Admin',
    heading: 'Administration',
    children: [
      {
        id: uniqueId(),
        title: 'Role Management',
        icon: IconSettings,
        href: '/rolemanagement',
        permission: 'rbac.view',
      },
      {
        id: uniqueId(),
        title: 'User Management', 
        icon: IconUsers,
        href: '/adminusermanagement',
        permission: 'rbac.assign',
      },
    ],
  },
];

export default SidebarContent;