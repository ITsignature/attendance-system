import React, { useState, useEffect } from "react";
import { Table, Button, Badge, Alert, Spinner, Modal, TextInput, Textarea } from "flowbite-react";
import { FaArrowLeft, FaCheck, FaTimes, FaEye, FaDownload, FaFilter } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeaveManagement } from "../../hooks/useLeaves";
import leaveApiService from "../../services/leaveApi";
import { LeaveRequest } from "../../services/leaveApi";

// =============================================
// INTERFACES
// =============================================

interface ApprovalModalData {
  request: LeaveRequest;
  isOpen: boolean;
  type: 'approve' | 'reject';
}

interface FilterState {
  status: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  employeeName: string;
}

// =============================================
// MAIN COMPONENT
// =============================================

const LeaveRequestsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Hook for leave management
  const {
    requests,
    loading,
    submitting,
    error,
    stats,
    approveRequest,
    rejectRequest,
    bulkApprove,
    exportData,
    fetchRequests,
    clearError
  } = useLeaveManagement();

  // Local state
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('filter') || 'pending');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [approvalModal, setApprovalModal] = useState<ApprovalModalData>({
    request: {} as LeaveRequest,
    isOpen: false,
    type: 'approve'
  });
  const [comments, setComments] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: activeTab,
    department: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    employeeName: ''
  });

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    // Update filters when tab changes
    setFilters(prev => ({ ...prev, status: activeTab }));
    fetchRequestsWithFilters();
  }, [activeTab]);

  useEffect(() => {
    // Update URL when tab changes
    setSearchParams({ filter: activeTab });
  }, [activeTab, setSearchParams]);

  // =============================================
  // DATA FETCHING
  // =============================================

  const fetchRequestsWithFilters = async () => {
    const filterParams: any = {};
    
    if (filters.status && filters.status !== 'all') {
      filterParams.status = filters.status;
    }
    if (filters.department) {
      filterParams.department_id = filters.department;
    }
    if (filters.leaveType) {
      filterParams.leave_type_id = filters.leaveType;
    }
    if (filters.startDate) {
      filterParams.start_date = filters.startDate;
    }
    if (filters.endDate) {
      filterParams.end_date = filters.endDate;
    }

    await fetchRequests(filterParams);
  };

  // =============================================
  // HANDLERS
  // =============================================

  const handleApprove = (request: LeaveRequest) => {
    setApprovalModal({
      request,
      isOpen: true,
      type: 'approve'
    });
    setComments('');
  };

  const handleReject = (request: LeaveRequest) => {
    setApprovalModal({
      request,
      isOpen: true,
      type: 'reject'
    });
    setComments('');
  };

  const handleConfirmAction = async () => {
    if (!approvalModal.request.id) return;

    let success = false;
    
    if (approvalModal.type === 'approve') {
      success = await approveRequest(approvalModal.request.id, comments);
    } else {
      if (!comments.trim()) {
        alert('Rejection reason is required');
        return;
      }
      success = await rejectRequest(approvalModal.request.id, comments);
    }

    if (success) {
      setApprovalModal({ request: {} as LeaveRequest, isOpen: false, type: 'approve' });
      setComments('');
      setSelectedRequests([]);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) {
      alert('Please select requests to approve');
      return;
    }

    const success = await bulkApprove(selectedRequests, 'Bulk approved');
    if (success) {
      setSelectedRequests([]);
    }
  };

  const handleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const handleSelectAll = () => {
    const filteredRequests = getFilteredRequests();
    if (selectedRequests.length === filteredRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(filteredRequests.map(req => req.id));
    }
  };

  const handleExport = async () => {
    await exportData({
      ...filters,
      format: 'csv'
    });
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchRequestsWithFilters();
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      status: activeTab,
      department: '',
      leaveType: '',
      startDate: '',
      endDate: '',
      employeeName: ''
    });
    fetchRequestsWithFilters();
  };

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const getFilteredRequests = (): LeaveRequest[] => {
    let filtered = requests;

    // Filter by active tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(req => req.details.status === activeTab);
    }

    // Filter by employee name
    if (filters.employeeName) {
      const searchTerm = filters.employeeName.toLowerCase();
      filtered = filtered.filter(req => 
        req.employee.name.toLowerCase().includes(searchTerm) ||
        req.employee.code.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'warning', icon: '⏳' },
      approved: { color: 'success', icon: '✅' },
      rejected: { color: 'failure', icon: '❌' },
      cancelled: { color: 'gray', icon: '🚫' }
    };
    
    const { color, icon } = config[status as keyof typeof config] || { color: 'gray', icon: '❓' };
    
    return (
      <Badge color={color} className="flex items-center gap-1">
        <span>{icon}</span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const canApproveOrReject = (status: string) => {
    return status === 'pending';
  };

  const getUrgencyBadge = (startDate: string, status: string) => {
    if (status !== 'pending') return null;
    
    const daysUntilStart = Math.ceil((new Date(startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilStart <= 1) {
      return <Badge color="red" size="xs">Urgent</Badge>;
    } else if (daysUntilStart <= 7) {
      return <Badge color="yellow" size="xs">High Priority</Badge>;
    }
    
    return null;
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderFilters = () => (
    <Modal show={showFilters} onClose={() => setShowFilters(false)}>
      <Modal.Header>Advanced Filters</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Employee Name/Code
              </label>
              <TextInput
                placeholder="Search by name or employee code"
                value={filters.employeeName}
                onChange={(e) => handleFilterChange('employeeName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Department
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="">All Departments</option>
                <option value="hr">Human Resources</option>
                <option value="engineering">Engineering</option>
                <option value="marketing">Marketing</option>
                <option value="sales">Sales</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Leave Type
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.leaveType}
                onChange={(e) => handleFilterChange('leaveType', e.target.value)}
              >
                <option value="">All Leave Types</option>
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="emergency">Emergency Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date From
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date To
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between w-full">
          <Button color="gray" onClick={clearFilters}>
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button color="gray" onClick={() => setShowFilters(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );

  const renderApprovalModal = () => (
    <Modal show={approvalModal.isOpen} onClose={() => setApprovalModal({ request: {} as LeaveRequest, isOpen: false, type: 'approve' })}>
      <Modal.Header>
        {approvalModal.type === 'approve' ? 'Approve' : 'Reject'} Leave Request
      </Modal.Header>
      <Modal.Body>
        {approvalModal.request.employee && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Request Details</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Employee:</strong> {approvalModal.request.employee.name}</div>
                <div><strong>Leave Type:</strong> {approvalModal.request.leaveType.name}</div>
                <div><strong>Duration:</strong> {leaveApiService.formatLeaveDuration(
                  approvalModal.request.dates.start,
                  approvalModal.request.dates.end,
                  approvalModal.request.dates.daysRequested
                )}</div>
                <div><strong>Reason:</strong> {approvalModal.request.details.reason}</div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {approvalModal.type === 'approve' ? 'Comments (Optional)' : 'Rejection Reason (Required)'}
              </label>
              <Textarea
                placeholder={approvalModal.type === 'approve' ? 'Add any comments...' : 'Please provide a reason for rejection...'}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                required={approvalModal.type === 'reject'}
              />
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button 
            color="gray" 
            onClick={() => setApprovalModal({ request: {} as LeaveRequest, isOpen: false, type: 'approve' })}
          >
            Cancel
          </Button>
          <Button 
            color={approvalModal.type === 'approve' ? 'success' : 'failure'}
            onClick={handleConfirmAction}
            disabled={submitting || (approvalModal.type === 'reject' && !comments.trim())}
          >
            {submitting ? <Spinner size="sm" /> : null}
            {approvalModal.type === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );

  // =============================================
  // MAIN RENDER
  // =============================================

  const filteredRequests = getFilteredRequests();

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
        
        <div className="flex items-center gap-2">
          {selectedRequests.length > 0 && activeTab === 'pending' && (
            <Button
              color="success"
              size="sm"
              onClick={handleBulkApprove}
              disabled={submitting}
              className="flex items-center gap-2"
            >
              {submitting ? <Spinner size="sm" /> : <FaCheck />}
              Bulk Approve ({selectedRequests.length})
            </Button>
          )}
          
          <Button
            color="blue"
            size="sm"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2"
          >
            <FaFilter className="w-4 h-4" />
            Filters
          </Button>
          
          <Button
            color="green"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <FaDownload className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert color="failure" className="mb-4">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <Button size="xs" color="failure" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Requests</h3>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Pending</h3>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{stats.pending}</p>
          {stats.urgent > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">({stats.urgent} urgent)</p>
          )}
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Approved</h3>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.approved}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Rejected</h3>
          <p className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.rejected}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'pending', label: 'Pending Requests', count: stats.pending },
            { key: 'approved', label: 'Approved Leaves', count: stats.approved },
            { key: 'rejected', label: 'Rejected Leaves', count: stats.rejected },
            { key: 'all', label: 'All Requests', count: stats.total }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-2">Loading requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No {activeTab} requests found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'pending' && "All caught up! No pending requests to review."}
              {activeTab === 'approved' && "No approved leave requests found."}
              {activeTab === 'rejected' && "No rejected leave requests found."}
              {activeTab === 'all' && "No leave requests found."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </Table.HeadCell>
                <Table.HeadCell>Employee</Table.HeadCell>
                <Table.HeadCell>Leave Type</Table.HeadCell>
                <Table.HeadCell>Duration</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Applied</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {filteredRequests.map((request) => (
                  <Table.Row key={request.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request.id)}
                        onChange={() => handleSelectRequest(request.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {request.employee.avatar ? (
                            <img 
                              src={request.employee.avatar} 
                              alt={request.employee.name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                                {request.employee.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {request.employee.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {request.employee.code} • {request.employee.department}
                          </p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{request.leaveType.name}</span>
                        {request.leaveType.isPaid && (
                          <Badge color="green" size="xs">Paid</Badge>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium">
                          {formatDate(request.dates.start)} - {formatDate(request.dates.end)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {request.dates.daysRequested} day{request.dates.daysRequested > 1 ? 's' : ''}
                        </p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.details.status)}
                        {getUrgencyBadge(request.dates.start, request.details.status)}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <p className="text-sm">
                        {formatDate(request.details.appliedAt)}
                      </p>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => navigate(`/leave-request/${request.id}`)}
                        >
                          <FaEye className="w-3 h-3" />
                        </Button>
                        
                        {canApproveOrReject(request.details.status) && (
                          <>
                            <Button
                              size="xs"
                              color="success"
                              onClick={() => handleApprove(request)}
                              disabled={submitting}
                            >
                              <FaCheck className="w-3 h-3" />
                            </Button>
                            <Button
                              size="xs"
                              color="failure"
                              onClick={() => handleReject(request)}
                              disabled={submitting}
                            >
                              <FaTimes className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>

      {/* Modals */}
      {renderFilters()}
      {renderApprovalModal()}
    </div>
  );
};

export default LeaveRequestsManagement;