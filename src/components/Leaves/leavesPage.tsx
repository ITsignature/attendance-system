import React, { useState } from "react";
import { Table, Button, Badge } from "flowbite-react";
import { useNavigate } from "react-router";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";

const leaveData = [
  {
    id: 1,
    name: "Darlene Robertson",
    reason: "Personal reasons",
    avatar: "https://randomuser.me/api/portraits/women/1.jpg",
  },
  {
    id: 2,
    name: "Floyd Miles",
    reason: "Medical appointment",
    avatar: "https://randomuser.me/api/portraits/men/2.jpg",
  },
  {
    id: 3,
    name: "Cody Fisher",
    reason: "Family emergency",
    avatar: "https://randomuser.me/api/portraits/men/3.jpg",
  },
  {
    id: 4,
    name: "Dianne Russell",
    reason: "Sick leave",
    avatar: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    id: 5,
    name: "Savannah Nguyen",
    reason: "Urgent personal work",
    avatar: "https://randomuser.me/api/portraits/women/5.jpg",
  },
  {
    id: 6,
    name: "Jacob Jones",
    reason: "Attending a wedding",
    avatar: "https://randomuser.me/api/portraits/men/6.jpg",
  },
  {
    id: 7,
    name: "Marvin McKinney",
    reason: "Funeral",
    avatar: "https://randomuser.me/api/portraits/men/7.jpg",
  },
  {
    id: 8,
    name: "Brooklyn Simmons",
    reason: "Travel commitment",
    avatar: "https://randomuser.me/api/portraits/women/8.jpg",
  },
  {
    id: 9,
    name: "Kristin Watson",
    reason: "Childcare",
    avatar: "https://randomuser.me/api/portraits/women/9.jpg",
  },
  {
    id: 10,
    name: "Kathryn Murphy",
    reason: "Rest due to illness",
    avatar: "https://randomuser.me/api/portraits/women/10.jpg",
  },
  {
    id: 11,
    name: "Arlene McCoy",
    reason: "Sick leave",
    avatar: "https://randomuser.me/api/portraits/women/11.jpg",
  },
  {
    id: 12,
    name: "Devon Lane",
    reason: "Family emergency",
    avatar: "https://randomuser.me/api/portraits/men/12.jpg",
  },
];

// Sample pending leave requests for counter
const pendingLeaveRequests = [
  {
    id: 1,
    employeeName: "John Smith",
    startDate: "2024-07-15",
    endDate: "2024-07-17",
    reason: "Family vacation",
    status: "Pending",
    daysRequested: 3
  },
  {
    id: 2,
    employeeName: "Sarah Johnson",
    startDate: "2024-07-20",
    endDate: "2024-07-22",
    reason: "Medical appointment",
    status: "Pending",
    daysRequested: 3
  },
  {
    id: 3,
    employeeName: "Mike Davis",
    startDate: "2024-07-25",
    endDate: "2024-07-25",
    reason: "Personal work",
    status: "Pending",
    daysRequested: 1
  },
  {
    id: 4,
    employeeName: "Emily Wilson",
    startDate: "2024-08-01",
    endDate: "2024-08-03",
    reason: "Wedding ceremony",
    status: "Pending",
    daysRequested: 3
  },
  {
    id: 5,
    employeeName: "David Brown",
    startDate: "2024-08-05",
    endDate: "2024-08-07",
    reason: "Sick leave",
    status: "Pending",
    daysRequested: 3
  }
];

const LeavePage = () => {
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState(currentDate.toISOString().split('T')[0]);
  const navigate = useNavigate();

  // Count pending leave requests
  const pendingRequestsCount = pendingLeaveRequests.filter(request => request.status === "Pending").length;

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray space-y-6">
      {/* UPDATED: Header with Navigation Buttons on Left and Date Picker on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Action Buttons */}
        <div className="flex gap-3">
          <Button
            color="purple"
            className="flex items-center gap-2"
            onClick={() => navigate("/holidays")}
          >
            📅 Holidays
          </Button>
          
          {/* UPDATED: Leave Requests Button - Only for users who can APPROVE OR REJECT leaves */}
          <DynamicProtectedComponent 
            permissions={["leaves.approve", "leaves.reject"]}
            requireAll={false}
          >
            <Button
              color="blue"
              className="flex items-center gap-2 relative"
              onClick={() => navigate("/leave-requests")}
            >
              📝 Leave Requests
              {pendingRequestsCount > 0 && (
                <Badge 
                  color="red" 
                  size="sm"
                  className="ml-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs font-bold min-w-[20px] h-5 flex items-center justify-center"
                >
                  {pendingRequestsCount}
                </Badge>
              )}
            </Button>
          </DynamicProtectedComponent>
        </div>

        {/* Right: Calendar Date Picker */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Date:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
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
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{leaveData.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400">Pending Requests</h3>
            <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{pendingRequestsCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Available Employees</h3>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">{50 - leaveData.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-purple-600 dark:text-purple-400">Total Employees</h3>
            <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">50</p>
          </div>
        </div>
      </div>

      {/* UPDATED: PROTECTED Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {/* UPDATED: View All Requests - Only for users who can approve or reject */}
        <DynamicProtectedComponent 
          permissions={["leaves.approve", "leaves.reject"]}
          requireAll={false}
        >
          <Button size="sm" color="gray" onClick={() => navigate("/leave-requests")}>
            🔍 View All Requests
          </Button>
        </DynamicProtectedComponent>
        
        <Button size="sm" color="gray" onClick={() => navigate("/holidays")}>
          📅 Manage Holidays
        </Button>
        
        {/* UPDATED: Leave Reports - Only for users who can approve or reject */}
        <DynamicProtectedComponent 
          permissions={["leaves.approve", "leaves.reject"]}
          requireAll={false}
        >
          <Button size="sm" color="gray">
            📊 Leave Reports
          </Button>
        </DynamicProtectedComponent>
        
        <DynamicProtectedComponent permission="settings.view">
          <Button size="sm" color="gray">
            ⚙️ Leave Policies
          </Button>
        </DynamicProtectedComponent>
      </div>

      {/* Leave Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Employees Currently on Leave</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Showing {leaveData.length} employees who are on leave on {formatDate(selectedDate)}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Employee Name</Table.HeadCell>
              <Table.HeadCell>Leave Reason</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              {/* PROTECTED: Actions column only for managers/HR who can approve */}
              <DynamicProtectedComponent permission="leaves.approve">
                <Table.HeadCell>Actions</Table.HeadCell>
              </DynamicProtectedComponent>
            </Table.Head>
            <Table.Body className="divide-y">
              {leaveData.map((emp, index) => (
                <Table.Row 
                  key={index}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => navigate(`/employee/${emp.id}`)}
                >
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{emp.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Employee ID: EMP{String(emp.id).padStart(3, '0')}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-gray-900 dark:text-white">{emp.reason}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Selected date</div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="warning" size="sm">On Leave</Badge>
                  </Table.Cell>
                  
                  {/* PROTECTED: Action buttons only for managers/HR who can approve */}
                  <DynamicProtectedComponent permission="leaves.approve">
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button 
                          size="xs" 
                          color="blue"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leave-details/${emp.id}`);
                          }}
                        >
                          View Details
                        </Button>
                        <Button 
                          size="xs" 
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle contact employee
                            alert(`Contacting ${emp.name}...`);
                          }}
                        >
                          Contact
                        </Button>
                      </div>
                    </Table.Cell>
                  </DynamicProtectedComponent>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {leaveData.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No one is on leave on this date!
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              All employees are available and working on {formatDate(selectedDate)}.
            </p>
          </div>
        )}
      </div>

      {/* PROTECTED: Pending Requests Alert - Only for users who can approve leaves */}
      <DynamicProtectedComponent permission="leaves.approve">
        {pendingRequestsCount > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-yellow-400 mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Action Required
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    You have {pendingRequestsCount} pending leave request{pendingRequestsCount > 1 ? 's' : ''} waiting for approval.
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                color="warning"
                onClick={() => navigate("/leave-requests")}
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
    </div>
  );
};

export default LeavePage;