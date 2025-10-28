import React, { useState, useEffect } from "react";
import { Table, Button, Badge, Alert, Spinner, Modal, Textarea, Select } from "flowbite-react";
import { FaArrowLeft, FaCheck, FaTimes, FaEye, FaFilter, FaPlus } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeaveManagement } from "../../hooks/useLeaves";
import { LeaveRequest } from "../../services/leaveApi";

// =============================================
// INTERFACES (SIMPLIFIED)
// =============================================

interface ApprovalModalData {
  request: LeaveRequest | null;
  isOpen: boolean;
  type: 'approve' | 'reject';
}

interface SimpleFilters {
  status: string;
  startDate: string;
  endDate: string;
}

// =============================================
// MAIN COMPONENT (SIMPLIFIED)
// =============================================

const LeaveRequestsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Hook for leave management (using cleaned hook)
  const {
    requests,
    loading,
    submitting,
    error,
    stats,
    approveRequest,
    rejectRequest,
    fetchRequests,
    clearError
  } = useLeaveManagement();

  // Local state (SIMPLIFIED)
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('filter') || 'pending');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SimpleFilters>({
    status: '',
    startDate: '',
    endDate: ''
  });
  
  // Approval/Rejection modal
  const [approvalModal, setApprovalModal] = useState<ApprovalModalData>({
    request: null,
    isOpen: false,
    type: 'approve'
  });
  const [comments, setComments] = useState('');

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    // Fetch requests when tab or filters change
    const filterParams = {
      status: activeTab === 'all' ? '' : activeTab,
      ...filters
    };
    fetchRequests(filterParams);
  }, [activeTab, filters, fetchRequests]);

  // =============================================
  // HANDLERS (SIMPLIFIED)
  // =============================================

  const handleCreateRequest = () => {
    navigate("/leave-request/new");
  };

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
  if (!approvalModal.request?.id) return;

  let success = false;
  
  if (approvalModal.type === 'approve') {
    success = await approveRequest(approvalModal.request.id, comments || undefined);
  } else {
    // Enhanced validation for rejection
    if (!comments.trim()) {
      alert('Rejection reason is required');
      return;
    }
    
    // Add minimum character validation
    if (comments.trim().length < 10) {
      alert('Rejection reason must be at least 10 characters long');
      return;
    }
    
    if (comments.trim().length > 500) {
      alert('Rejection reason cannot exceed 500 characters');
      return;
    }
    
    success = await rejectRequest(approvalModal.request.id, comments);
  }

  if (success) {
    setApprovalModal({ request: null, isOpen: false, type: 'approve' });
    setComments('');
  }
};

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ filter: tab });
  };

  const handleFilterChange = (key: keyof SimpleFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      startDate: '',
      endDate: ''
    });
  };

  // =============================================
  // UTILITY FUNCTIONS (SIMPLIFIED)
  // =============================================

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'warning', label: 'Pending' },
      approved: { color: 'success', label: 'Approved' },
      rejected: { color: 'failure', label: 'Rejected' },
      cancelled: { color: 'gray', label: 'Cancelled' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'gray', label: status };
    
    return (
      <Badge color={config.color as any} size="sm">
        {config.label}
      </Badge>
    );
  };

  const canApproveOrReject = (status: string) => {
    return status === 'pending';
  };

  const getFilteredRequests = () => {
    if (!Array.isArray(requests)) return [];
    
    return requests.filter(request => {
      const status = request.status || request.details?.status || '';
      
      // Tab filter
      if (activeTab !== 'all' && status !== activeTab) {
        return false;
      }
      
      return true;
    });
  };

  // =============================================
  // RENDER FUNCTIONS
  // =============================================

  const renderTabs = () => (
    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav className="-mb-px flex space-x-8">
        {[
          { key: 'pending', label: 'Pending', count: stats.pending },
          { key: 'approved', label: 'Approved', count: stats.approved },
          { key: 'rejected', label: 'Rejected', count: stats.rejected },
          { key: 'all', label: 'All', count: stats.total }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );

  const renderFilters = () => (
    <div className={`mb-4 ${showFilters ? 'block' : 'hidden'}`}>
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button color="gray" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderApprovalModal = () => (
    <Modal show={approvalModal.isOpen} onClose={() => setApprovalModal({ request: null, isOpen: false, type: 'approve' })}>
      <Modal.Header>
        {approvalModal.type === 'approve' ? 'Approve' : 'Reject'} Leave Request
      </Modal.Header>
      <Modal.Body>
        {approvalModal.request && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Request Details</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Employee:</strong> {approvalModal.request.employee_name || 'N/A'}</div>
                <div><strong>Leave Type:</strong> {approvalModal.request.leave_type_name || 'N/A'}</div>
                <div><strong>Duration:</strong> {formatDate(approvalModal.request.start_date || '')} - {formatDate(approvalModal.request.end_date || '')}</div>
                <div><strong>Days:</strong> {approvalModal.request.days_requested || 'N/A'}</div>
                <div><strong>Reason:</strong> {approvalModal.request.reason || 'N/A'}</div>
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
            onClick={() => setApprovalModal({ request: null, isOpen: false, type: 'approve' })}
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

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            color="gray"
            size="sm"
            onClick={() => navigate("/leaves")}
          >
            <FaArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Leave Requests Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* CREATE NEW REQUEST BUTTON - PRIMARY ADMIN ACTION */}
          <Button
            color="purple"
            className="flex items-center gap-2"
            onClick={handleCreateRequest}
          >
            <FaPlus className="w-4 h-4" />
            Create New Request
          </Button>

          <Button
            color="gray"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Tabs */}
      {renderTabs()}

      {/* Filters */}
      {renderFilters()}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No {activeTab !== 'all' ? activeTab : ''} requests found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'pending' ? 'All caught up! No pending requests to review.' : 'No requests match your current filter.'}
            </p>
          </div>
        ) : (
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Employee</Table.HeadCell>
              <Table.HeadCell>Leave Type</Table.HeadCell>
              <Table.HeadCell>Duration</Table.HeadCell>
              <Table.HeadCell>Days</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Applied Date</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {filteredRequests.map((request) => {
                const status = request.status || request.details?.status || '';
                
                return (
                  <Table.Row key={request.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {request.employee_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {request.employee_code || ''} {request.employee?.department || ''}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {request.leave_type_name || request.leave_type_name || 'N/A'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <div>{formatDate(request.start_date || request.dates?.start || '')}</div>
                        <div className="text-gray-500">to {formatDate(request.end_date || request.dates?.end || '')}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-medium">
                        {request.days_requested || request.dates?.daysRequested || 'N/A'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {getStatusBadge(status)}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-gray-500">
                        {formatDate(request.applied_at || request.details?.appliedAt || '')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => console.log('View details:', request.id)}
                        >
                          <FaEye className="w-3 h-3" />
                        </Button>
                        
                        {canApproveOrReject(status) && (
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
                );
              })}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Approval Modal */}
      {renderApprovalModal()}
    </div>
  );
};

export default LeaveRequestsManagement;