import React, { useState } from "react";
import { Button, Badge, Modal, Textarea, Select } from "flowbite-react";
import { FaCheck, FaTimes, FaEye, FaArrowLeft } from "react-icons/fa";

interface LeaveRequest {
  id: number;
  employeeId: string;
  employeeName: string;
  avatar: string;
  department: string;
  designation: string;
  startDate: string;
  endDate: string;
  reason: string;
  leaveType: string;
  daysRequested: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedDate: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
}

const LeaveRequestsManagement = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionReason, setActionReason] = useState('');

  // Sample leave requests data
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: 1,
      employeeId: 'EMP001',
      employeeName: 'John Smith',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      department: 'Engineering',
      designation: 'Software Developer',
      startDate: '2024-07-15',
      endDate: '2024-07-17',
      reason: 'Family vacation - Need to attend cousin\'s wedding out of town',
      leaveType: 'Annual Leave',
      daysRequested: 3,
      status: 'Pending',
      appliedDate: '2024-07-01'
    },
    {
      id: 2,
      employeeId: 'EMP002',
      employeeName: 'Sarah Johnson',
      avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
      department: 'Marketing',
      designation: 'Marketing Manager',
      startDate: '2024-07-20',
      endDate: '2024-07-22',
      reason: 'Medical appointment for routine checkup',
      leaveType: 'Sick Leave',
      daysRequested: 3,
      status: 'Pending',
      appliedDate: '2024-07-02'
    },
    {
      id: 3,
      employeeId: 'EMP003',
      employeeName: 'Mike Davis',
      avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
      department: 'Sales',
      designation: 'Sales Executive',
      startDate: '2024-07-25',
      endDate: '2024-07-25',
      reason: 'Personal work - Bank documentation',
      leaveType: 'Personal Leave',
      daysRequested: 1,
      status: 'Pending',
      appliedDate: '2024-07-05'
    },
    {
      id: 4,
      employeeId: 'EMP004',
      employeeName: 'Emily Wilson',
      avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
      department: 'HR',
      designation: 'HR Coordinator',
      startDate: '2024-08-01',
      endDate: '2024-08-03',
      reason: 'Sister\'s wedding ceremony',
      leaveType: 'Annual Leave',
      daysRequested: 3,
      status: 'Pending',
      appliedDate: '2024-07-08'
    },
    {
      id: 5,
      employeeId: 'EMP005',
      employeeName: 'David Brown',
      avatar: 'https://randomuser.me/api/portraits/men/5.jpg',
      department: 'Finance',
      designation: 'Accountant',
      startDate: '2024-08-05',
      endDate: '2024-08-07',
      reason: 'Flu symptoms and fever',
      leaveType: 'Sick Leave',
      daysRequested: 3,
      status: 'Pending',
      appliedDate: '2024-07-10'
    },
    // Approved leaves
    {
      id: 6,
      employeeId: 'EMP006',
      employeeName: 'Lisa Garcia',
      avatar: 'https://randomuser.me/api/portraits/women/6.jpg',
      department: 'Design',
      designation: 'UI/UX Designer',
      startDate: '2024-06-20',
      endDate: '2024-06-22',
      reason: 'Annual vacation with family',
      leaveType: 'Annual Leave',
      daysRequested: 3,
      status: 'Approved',
      appliedDate: '2024-06-01',
      approvedBy: 'Mark Williams',
      approvedDate: '2024-06-03'
    },
    {
      id: 7,
      employeeId: 'EMP007',
      employeeName: 'Robert Taylor',
      avatar: 'https://randomuser.me/api/portraits/men/7.jpg',
      department: 'Engineering',
      designation: 'Senior Developer',
      startDate: '2024-06-15',
      endDate: '2024-06-16',
      reason: 'Medical procedure',
      leaveType: 'Sick Leave',
      daysRequested: 2,
      status: 'Approved',
      appliedDate: '2024-06-05',
      approvedBy: 'Mark Williams',
      approvedDate: '2024-06-06'
    },
    // Rejected leaves
    {
      id: 8,
      employeeId: 'EMP008',
      employeeName: 'Jennifer Lee',
      avatar: 'https://randomuser.me/api/portraits/women/8.jpg',
      department: 'Sales',
      designation: 'Sales Manager',
      startDate: '2024-07-01',
      endDate: '2024-07-05',
      reason: 'Personal vacation',
      leaveType: 'Annual Leave',
      daysRequested: 5,
      status: 'Rejected',
      appliedDate: '2024-06-20',
      approvedBy: 'Mark Williams',
      approvedDate: '2024-06-22',
      rejectionReason: 'Peak business period - cannot approve extended leave during quarter end'
    }
  ]);

  // Mock navigate function
  const navigate = (path: string) => {
    console.log('Navigate to:', path);
  };

  // Filter requests based on active tab
  const filteredRequests = leaveRequests.filter(request => {
    switch (activeTab) {
      case 'pending':
        return request.status === 'Pending';
      case 'approved':
        return request.status === 'Approved';
      case 'rejected':
        return request.status === 'Rejected';
      default:
        return false;
    }
  });

  // Handle approve/reject actions
  const handleAction = (request: LeaveRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setShowActionModal(true);
  };

  // Confirm action
  const confirmAction = () => {
    if (selectedRequest) {
      const updatedRequests = leaveRequests.map(request => {
        if (request.id === selectedRequest.id) {
          return {
            ...request,
            status: actionType === 'approve' ? 'Approved' : 'Rejected' as 'Approved' | 'Rejected',
            approvedBy: 'Mark Williams',
            approvedDate: new Date().toISOString().split('T')[0],
            ...(actionType === 'reject' && { rejectionReason: actionReason })
          };
        }
        return request;
      });

      setLeaveRequests(updatedRequests);
      setShowActionModal(false);
      setActionReason('');
      setSelectedRequest(null);
    }
  };

  // View details
  const viewDetails = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge color="warning" size="sm">Pending</Badge>;
      case 'Approved':
        return <Badge color="success" size="sm">Approved</Badge>;
      case 'Rejected':
        return <Badge color="failure" size="sm">Rejected</Badge>;
      default:
        return <Badge color="gray" size="sm">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate days between dates
  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            color="gray"
            size="sm"
            onClick={() => navigate('/leaves')}
            className="flex items-center gap-2"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Leaves
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Requests Management</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'pending', label: 'Pending Requests', count: leaveRequests.filter(r => r.status === 'Pending').length },
            { key: 'approved', label: 'Approved Leaves', count: leaveRequests.filter(r => r.status === 'Approved').length },
            { key: 'rejected', label: 'Rejected Leaves', count: leaveRequests.filter(r => r.status === 'Rejected').length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
              }`}
            >
              {tab.label}
              <Badge color={activeTab === tab.key ? 'purple' : 'gray'} size="sm">
                {tab.count}
              </Badge>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No {activeTab} requests found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'pending' && "All caught up! No pending requests to review."}
              {activeTab === 'approved' && "No approved leave requests to display."}
              {activeTab === 'rejected' && "No rejected leave requests to display."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <img
                      src={request.avatar}
                      alt={request.employeeName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {request.employeeName}
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {request.designation} • {request.department} • {request.employeeId}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Leave Period</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {request.daysRequested} day{request.daysRequested > 1 ? 's' : ''} • {request.leaveType}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {request.reason}
                          </p>
                        </div>
                      </div>
                      
                      {request.status === 'Approved' && request.approvedBy && (
                        <div className="mt-3 text-sm text-green-600 dark:text-green-400">
                          ✓ Approved by {request.approvedBy} on {formatDate(request.approvedDate!)}
                        </div>
                      )}
                      
                      {request.status === 'Rejected' && request.rejectionReason && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">Rejection Reason:</p>
                          <p className="text-sm text-red-600 dark:text-red-400">{request.rejectionReason}</p>
                          <p className="text-xs text-red-500 mt-1">
                            Rejected by {request.approvedBy} on {formatDate(request.approvedDate!)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      color="gray"
                      onClick={() => viewDetails(request)}
                      className="flex items-center gap-2"
                    >
                      <FaEye className="w-3 h-3" />
                      View
                    </Button>
                    
                    {request.status === 'Pending' && (
                      <>
                        <Button
                          size="sm"
                          color="success"
                          onClick={() => handleAction(request, 'approve')}
                          className="flex items-center gap-2"
                        >
                          <FaCheck className="w-3 h-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          color="failure"
                          onClick={() => handleAction(request, 'reject')}
                          className="flex items-center gap-2"
                        >
                          <FaTimes className="w-3 h-3" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Details Modal */}
      <Modal show={showDetailsModal} onClose={() => setShowDetailsModal(false)} size="2xl">
        <Modal.Header>Leave Request Details</Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <img
                  src={selectedRequest.avatar}
                  alt={selectedRequest.employeeName}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-xl font-semibold">{selectedRequest.employeeName}</h3>
                  <p className="text-gray-600">{selectedRequest.designation}</p>
                  <p className="text-sm text-gray-500">{selectedRequest.department} • {selectedRequest.employeeId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Leave Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Type:</span> {selectedRequest.leaveType}</div>
                    <div><span className="font-medium">Start Date:</span> {formatDate(selectedRequest.startDate)}</div>
                    <div><span className="font-medium">End Date:</span> {formatDate(selectedRequest.endDate)}</div>
                    <div><span className="font-medium">Days:</span> {selectedRequest.daysRequested}</div>
                    <div><span className="font-medium">Applied On:</span> {formatDate(selectedRequest.appliedDate)}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Status Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Status:</span> {getStatusBadge(selectedRequest.status)}</div>
                    {selectedRequest.approvedBy && (
                      <>
                        <div><span className="font-medium">Processed By:</span> {selectedRequest.approvedBy}</div>
                        <div><span className="font-medium">Processed On:</span> {formatDate(selectedRequest.approvedDate!)}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Reason for Leave</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {selectedRequest.reason}
                </p>
              </div>

              {selectedRequest.rejectionReason && (
                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Rejection Reason</h4>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {selectedRequest.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Action Confirmation Modal */}
      <Modal show={showActionModal} onClose={() => setShowActionModal(false)} size="md">
        <Modal.Header>
          {actionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <div className="space-y-4">
              <p>
                Are you sure you want to {actionType} the leave request for{' '}
                <strong>{selectedRequest.employeeName}</strong>?
              </p>
              
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <div><strong>Period:</strong> {formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}</div>
                <div><strong>Days:</strong> {selectedRequest.daysRequested}</div>
                <div><strong>Reason:</strong> {selectedRequest.reason}</div>
              </div>

              {actionType === 'reject' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this leave request..."
                    rows={3}
                    required
                  />
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            color={actionType === 'approve' ? 'success' : 'failure'}
            onClick={confirmAction}
            disabled={actionType === 'reject' && !actionReason.trim()}
          >
            {actionType === 'approve' ? 'Approve' : 'Reject'}
          </Button>
          <Button color="gray" onClick={() => setShowActionModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LeaveRequestsManagement;