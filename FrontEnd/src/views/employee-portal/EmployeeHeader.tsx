import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDynamicRBAC } from '../../components/RBACSystem/rbacSystem';
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';

const EmployeeHeader = () => {
  const { currentUser, logout } = useDynamicRBAC();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left side */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Welcome back, {currentUser?.name?.split(' ')[0] || 'Employee'}!
        </h2>
        <p className="text-sm text-gray-500">{currentUser?.clientName || 'Loading...'}</p>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <BellIcon className="w-6 h-6" />
          {/* Notification badge */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <UserCircleIcon className="w-8 h-8 text-gray-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-700">{currentUser?.name}</p>
              <p className="text-xs text-gray-500">{currentUser?.roleName}</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              ></div>

              {/* Menu */}
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700">{currentUser?.name}</p>
                  <p className="text-xs text-gray-500">{currentUser?.email}</p>
                </div>

                <button
                  onClick={() => {
                    navigate('/employee-portal/profile');
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  My Profile
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default EmployeeHeader;
