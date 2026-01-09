import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  UserIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const EmployeeSidebar = () => {
  const menuItems = [
    { path: '/employee-portal/dashboard', icon: HomeIcon, label: 'Dashboard' },
    { path: '/employee-portal/profile', icon: UserIcon, label: 'My Profile' },
    { path: '/employee-portal/attendance', icon: ClockIcon, label: 'My Attendance' },
    { path: '/employee-portal/payroll', icon: CurrencyDollarIcon, label: 'Payroll' },
    { path: '/employee-portal/leaves', icon: CalendarIcon, label: 'Leaves' },
    { path: '/employee-portal/financial-records', icon: BanknotesIcon, label: 'Financial Records' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-600">Employee Portal</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                isActive ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : ''
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          © 2024 HRMS System
        </p>
      </div>
    </div>
  );
};

export default EmployeeSidebar;
