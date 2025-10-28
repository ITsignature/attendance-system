import React, { useState } from "react";
import { Button, Alert, Spinner, Card } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useLeaveDashboard } from "../../hooks/useLeaves";

// =============================================
// INTERFACES (SIMPLIFIED)
// =============================================

interface EmployeeOnLeave {
  id: string;
  name: string;
  employee_code: string;
  department: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

// =============================================
// MAIN COMPONENT - SIMPLIFIED ADMIN LANDING
// =============================================

const LeavePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Use the dashboard hook (no auto-refresh to keep it simple)
  const { dashboard, loading, error, refresh, clearError } = useLeaveDashboard(false);

  // Local refresh state
  const [refreshing, setRefreshing] = useState(false);

  // =============================================
  // HANDLERS (SIMPLIFIED)
  // =============================================

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    await refresh(newDate);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh(selectedDate);
    setRefreshing(false);
  };

  const handleManageRequests = () => {
    navigate("/leave-requests");
  };

  // =============================================
  // UTILITY FUNCTIONS (SIMPLIFIED)
  // =============================================

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLeaveTypeColor = (leaveType: string) => {
    const colors: Record<string, string> = {
      'Annual Leave': 'blue',
      'Sick Leave': 'red',
      'Personal Leave': 'purple',
      'Emergency Leave': 'yellow',
      'Maternity Leave': 'pink',
      'Paternity Leave': 'green'
    };
    return colors[leaveType] || 'gray';
  };

  const getPendingRequestsCount = () => {
    return dashboard?.summary?.pendingRequestsCount || 0;
  };

  // =============================================
  // RENDER FUNCTIONS (SIMPLIFIED)
  // =============================================

  const renderLoadingState = () => (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Spinner size="xl" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading leave information...</p>
        </div>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <Alert color="failure" className="mb-4">
      <div className="flex items-center justify-between">
        <span>{error}</span>
        <Button size="xs" color="failure" onClick={clearError}>
          Dismiss
        </Button>
      </div>
    </Alert>
  );

  const renderEmployeeCard = (employee: EmployeeOnLeave, index: number) => (
    <Card key={index} className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                {employee.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {employee.name}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {employee.employee_code} • {employee.department}
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className={`px-2 py-1 rounded-full text-xs font-medium bg-${getLeaveTypeColor(employee.leave_type)}-100 text-${getLeaveTypeColor(employee.leave_type)}-800 dark:bg-${getLeaveTypeColor(employee.leave_type)}-900 dark:text-${getLeaveTypeColor(employee.leave_type)}-300`}
            >
              {employee.leave_type}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date(employee.start_date).toLocaleDateString()} - {new Date(employee.end_date).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {employee.reason}
          </p>
        </div>
      </div>
    </Card>
  );

  // =============================================
  // MAIN RENDER (SIMPLIFIED)
  // =============================================

  if (loading && !dashboard) {
    return renderLoadingState();
  }


  console.log("dash",dashboard)
  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray space-y-6">
      {/* Error Display */}
      {error && renderErrorState()}

      {/* Header Section - SIMPLIFIED */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Main Action Button */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Leave Overview
          </h1>
          
          <Button
            color="blue"
            className="flex items-center gap-2"
            onClick={handleManageRequests}
          >
            📋 Manage All Requests
            {getPendingRequestsCount() > 0 && (
              <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs font-bold min-w-[20px] h-5 flex items-center justify-center">
                {getPendingRequestsCount()}
              </span>
            )}
          </Button>
        </div>

        {/* Right: Date Picker & Refresh */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Date:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Button
            size="sm"
            color="gray"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? <Spinner size="sm" /> : '🔄'}
          </Button>
        </div>
      </div>

      {/* Date Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          📅 {formatDate(selectedDate)}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {dashboard?.summary?.onLeaveCount || 0} employee(s) on leave today
        </p>
      </div>

      {/* Employees on Leave Today - SIMPLIFIED */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          👥 Employees on Leave Today ({dashboard?.summary?.onLeaveCount || 0})
        </h3>

        {dashboard?.onLeaveToday && dashboard.onLeaveToday.length > 0 ? (
          <div className="space-y-3">
            {dashboard.onLeaveToday.map((employee: EmployeeOnLeave, index: number) => 
              renderEmployeeCard(employee, index)
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🏢</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              All Hands on Deck!
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              No employees are on leave today. Great attendance! 🎉
            </p>
          </div>
        )}
      </div>

      {/* Simple Footer Info */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            💼 Total active requests: {dashboard?.summary?.totalActiveRequests || 0}
          </span>
          <span>
            ⏳ Pending approvals: {getPendingRequestsCount()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LeavePage;