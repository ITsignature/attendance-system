import React, { useState, useEffect } from "react";
import { Button, Badge, Alert, Spinner, Card } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";
import { useLeaveDashboard } from "../../hooks/useLeaves";
import leaveApiService from "../../services/leaveApi";

// =============================================
// INTERFACES
// =============================================

interface Employee {
  id: string;
  name: string;
  code: string;
  avatar: string;
  department: string;
  leave: {
    type: string;
    isPaid: boolean;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  };
}

// =============================================
// MAIN COMPONENT
// =============================================

const LeavePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Use the dashboard hook
  const { dashboard, loading, error, refresh, clearError } = useLeaveDashboard(true, 300000); // Auto-refresh every 5 minutes

  // Local state for UI
  const [refreshing, setRefreshing] = useState(false);

  // =============================================
  // HANDLERS
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

  const handleCreateLeaveRequest = () => {
    navigate("/leave-request/new");
  };

  // =============================================
  // UTILITY FUNCTIONS
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
      'Maternity Leave': 'pink'
    };
    return colors[leaveType] || 'gray';
  };

  const getPendingRequestsCount = () => {
    return dashboard?.summary.pendingRequestsCount || 0;
  };

  const getUrgentRequestsCount = () => {
    return dashboard?.summary.urgentPendingCount || 0;
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderLoadingState = () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Spinner size="xl" className="mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading leave information...</p>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <Alert color="failure" className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Failed to load leave data</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" color="failure" onClick={clearError}>
            Dismiss
          </Button>
          <Button size="sm" color="gray" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      </div>
    </Alert>
  );

  const renderEmployeeCard = (employee: Employee) => (
    <Card key={employee.id} className="mb-4">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          {employee.avatar ? (
            <img 
              src={employee.avatar} 
              alt={employee.name}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                {employee.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {employee.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {employee.code} • {employee.department}
              </p>
            </div>
            <Badge 
              color={getLeaveTypeColor(employee.leave.type)}
              size="sm"
            >
              {employee.leave.type}
            </Badge>
          </div>
          <div className="mt-2">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">
                {leaveApiService.formatLeaveDuration(
                  employee.leave.startDate, 
                  employee.leave.endDate, 
                  employee.leave.days
                )}
              </span>
              {employee.leave.isPaid && (
                <Badge color="green" size="xs" className="ml-2">
                  Paid
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {employee.leave.reason}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  const renderDepartmentSummary = () => {
    if (!dashboard?.departmentSummary) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {dashboard.departmentSummary.map((dept, index) => (
          <Card key={index}>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              {dept.department || 'No Department'}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Employees:</span>
                <span className="font-medium">{dept.totalEmployees}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">On Leave:</span>
                <span className="font-medium text-red-600">{dept.employeesOnLeave}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pending:</span>
                <span className="font-medium text-yellow-600">{dept.pendingRequests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Availability:</span>
                <span className={`font-medium ${dept.availabilityPercentage >= 90 ? 'text-green-600' : dept.availabilityPercentage >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {dept.availabilityPercentage}%
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (loading && !dashboard) {
    return renderLoadingState();
  }

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray space-y-6">
      {/* Error Display */}
      {error && renderErrorState()}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Create Leave Request Button - For all employees */}
          <DynamicProtectedComponent permission="leaves.request">
            <Button
              color="purple"
              className="flex items-center gap-2"
              onClick={handleCreateLeaveRequest}
            >
              ➕ Request Leave
            </Button>
          </DynamicProtectedComponent>

          {/* My Leave Requests Button */}
          <Button
            color="blue"
            className="flex items-center gap-2"
            onClick={() => navigate("/my-leave-requests")}
          >
            📋 My Requests
          </Button>

          {/* Leave Requests Management Button - Only for managers/HR */}
          <DynamicProtectedComponent 
            permissions={["leaves.approve", "leaves.reject"]}
            requireAll={false}
          >
            <Button
              color="blue"
              className="flex items-center gap-2 relative"
              onClick={() => navigate("/leave-requests")}
            >
              📝 Manage Requests
              {getPendingRequestsCount() > 0 && (
                <Badge 
                  color="red" 
                  size="sm"
                  className="ml-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs font-bold min-w-[20px] h-5 flex items-center justify-center"
                >
                  {getPendingRequestsCount()}
                </Badge>
              )}
            </Button>
          </DynamicProtectedComponent>

          {/* Analytics Button - For managers/HR */}
          <DynamicProtectedComponent permission="leaves.reports">
            <Button
              color="green"
              className="flex items-center gap-2"
              onClick={() => navigate("/leave-analytics")}
            >
              📊 Analytics
            </Button>
          </DynamicProtectedComponent>
        </div>

        {/* Right: Date Picker and Refresh */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Date:
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

      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Leave Status for {formatDate(selectedDate)}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">On Leave</h3>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
              {dashboard?.summary.onLeaveCount || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Pending Requests</h3>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
              {getPendingRequestsCount()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Urgent Requests</h3>
            <p className="text-2xl font-bold text-red-800 dark:text-red-300">
              {getUrgentRequestsCount()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Available</h3>
            <p className="text-2xl font-bold text-green-800 dark:text-green-300">
              {dashboard?.departmentSummary.reduce((acc, dept) => acc + (dept.totalEmployees - dept.employeesOnLeave), 0) || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Department Summary */}
      <DynamicProtectedComponent permission="leaves.view">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Department Overview
          </h3>
          {renderDepartmentSummary()}
        </div>
      </DynamicProtectedComponent>

      {/* Employees on Leave Today */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Employees on Leave Today ({dashboard?.summary.onLeaveCount || 0})
        </h3>

        {dashboard?.onLeaveToday && dashboard.onLeaveToday.length > 0 ? (
          <div className="space-y-4">
            {dashboard.onLeaveToday.map(renderEmployeeCard)}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🏢</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              All Hands on Deck!
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              All employees are available and working on {formatDate(selectedDate)}.
            </p>
          </div>
        )}
      </div>

      {/* PROTECTED: Pending Requests Alert - Only for users who can approve leaves */}
      <DynamicProtectedComponent permission="leaves.approve">
        {getPendingRequestsCount() > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-yellow-400 mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Action Required
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    You have {getPendingRequestsCount()} pending leave request{getPendingRequestsCount() > 1 ? 's' : ''} waiting for approval.
                    {getUrgentRequestsCount() > 0 && (
                      <span className="font-medium"> {getUrgentRequestsCount()} of them are urgent (starting within 7 days).</span>
                    )}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                color="warning"
                onClick={() => navigate("/leave-requests?filter=pending")}
              >
                Review Now
              </Button>
            </div>
          </div>
        )}
      </DynamicProtectedComponent>

      {/* PROTECTED: Manager Quick Actions Panel - Only for users who can approve */}
      <DynamicProtectedComponent permission="leaves.approve">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
            Manager Actions
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              color="blue"
              onClick={() => navigate("/leave-requests?filter=pending")}
            >
              ✅ Approve Pending Requests
            </Button>
            <Button 
              size="sm" 
              color="red"
              onClick={() => navigate("/leave-requests?filter=rejected")}
            >
              ❌ Review Rejected Requests
            </Button>
            <Button 
              size="sm" 
              color="purple"
              onClick={() => navigate("/leave-calendar")}
            >
              📅 Team Leave Calendar
            </Button>
            <Button 
              size="sm" 
              color="green"
              onClick={() => navigate("/leave-analytics")}
            >
              📈 Leave Analytics
            </Button>
          </div>
        </div>
      </DynamicProtectedComponent>

      {/* Upcoming Leaves Preview */}
      {dashboard?.upcomingLeaves && dashboard.upcomingLeaves.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upcoming Leaves (Next 30 Days)
          </h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="space-y-2">
              {dashboard.upcomingLeaves.slice(0, 5).map((leave, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {leave.employeeName}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      ({leave.department})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {leaveApiService.formatLeaveDuration(leave.startDate, leave.endDate, leave.days)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {leave.leaveType}
                    </div>
                  </div>
                </div>
              ))}
              {dashboard.upcomingLeaves.length > 5 && (
                <div className="text-center pt-2">
                  <Button size="xs" color="gray" onClick={() => navigate("/leave-calendar")}>
                    View All ({dashboard.upcomingLeaves.length - 5} more)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavePage;