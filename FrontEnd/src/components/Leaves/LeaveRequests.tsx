import React, { useState, useEffect } from "react";
import { Table, Button, Badge, Alert, Spinner, Modal, Textarea, Select } from "flowbite-react";
import { FaArrowLeft, FaCheck, FaTimes, FaFilter, FaPlus, FaSort, FaSortUp, FaSortDown, FaEdit, FaTrash } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeaveManagement } from "../../hooks/useLeaves";
import { LeaveRequest, LeaveType } from "../../services/leaveApi";
import leaveApiService from "../../services/leaveApi";
import { DynamicProtectedComponent } from '../RBACSystem/rbacSystem';
import apiService from "../../services/api";

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
  employeeId: string;
}

interface EmployeeOption {
  id: string;
  name: string;
  employee_code: string;
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
    endDate: '',
    employeeId: ''
  });
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [durationSort, setDurationSort] = useState<'asc' | 'desc' | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  // Edit modal
  const [editModal, setEditModal] = useState<{ isOpen: boolean; request: LeaveRequest | null }>({ isOpen: false, request: null });
  const [editForm, setEditForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    leave_duration: 'full_day' as 'full_day' | 'half_day' | 'short_leave',
    start_time: '',
    end_time: '',
    reason: '',
    is_paid: true
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; request: LeaveRequest | null }>({ isOpen: false, request: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  
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
    leaveApiService.getLeaveTypes().then(res => {
      if (res.success && Array.isArray(res.data)) setLeaveTypes(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiService.getEmployees({ limit: 200, page: 1 }).then(res => {
      if (res.success && Array.isArray(res.data?.employees)) {
        setEmployees(res.data.employees.map((e: any) => ({
          id: e.id,
          name: `${e.first_name} ${e.last_name}`,
          employee_code: e.employee_code
        })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const filterParams: Record<string, string> = {};
    if (activeTab !== 'all') filterParams.status = activeTab;
    if (filters.startDate) filterParams.start_date = filters.startDate;
    if (filters.endDate) filterParams.end_date = filters.endDate;
    if (filters.employeeId) filterParams.employee_id = filters.employeeId;
    fetchRequests(filterParams as any);
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
      endDate: '',
      employeeId: ''
    });
  };

  const handleOpenEdit = (request: LeaveRequest) => {
    setEditError('');
    setEditForm({
      leave_type_id: request.leave_type_id || '',
      start_date: request.start_date ? request.start_date.substring(0, 10) : '',
      end_date: request.end_date ? request.end_date.substring(0, 10) : '',
      leave_duration: request.leave_duration || 'full_day',
      start_time: request.start_time || '',
      end_time: request.end_time || '',
      reason: request.reason || '',
      is_paid: request.is_paid ?? true
    });
    setEditModal({ isOpen: true, request });
  };

  const handleSaveEdit = async () => {
    if (!editModal.request?.id) return;
    setEditError('');
    if (!editForm.leave_type_id || !editForm.start_date || !editForm.end_date || !editForm.reason.trim()) {
      setEditError('Please fill in all required fields.');
      return;
    }
    if (editForm.leave_duration === 'short_leave' && (!editForm.start_time || !editForm.end_time)) {
      setEditError('Start time and end time are required for short leave.');
      return;
    }
    setEditSaving(true);
    try {
      const res = await leaveApiService.updateLeaveRequest(editModal.request.id, {
        leave_type_id: editForm.leave_type_id,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        leave_duration: editForm.leave_duration,
        start_time: editForm.start_time || null,
        end_time: editForm.end_time || null,
        reason: editForm.reason,
        is_paid: editForm.is_paid
      });
      if (res.success) {
        setEditModal({ isOpen: false, request: null });
        const filterParams: Record<string, string> = {};
        if (activeTab !== 'all') filterParams.status = activeTab;
        if (filters.startDate) filterParams.start_date = filters.startDate;
        if (filters.endDate) filterParams.end_date = filters.endDate;
        if (filters.employeeId) filterParams.employee_id = filters.employeeId;
        fetchRequests(filterParams as any);
      } else {
        setEditError(res.message || 'Failed to update leave request.');
      }
    } catch (e: any) {
      setEditError(e.message || 'Failed to update leave request.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenDelete = (request: LeaveRequest) => {
    setDeleteModal({ isOpen: true, request });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.request?.id) return;
    setDeleteLoading(true);
    try {
      const res = await leaveApiService.deleteLeaveRequest(deleteModal.request.id);
      if (res.success) {
        setDeleteModal({ isOpen: false, request: null });
        const filterParams: Record<string, string> = {};
        if (activeTab !== 'all') filterParams.status = activeTab;
        if (filters.startDate) filterParams.start_date = filters.startDate;
        if (filters.endDate) filterParams.end_date = filters.endDate;
        if (filters.employeeId) filterParams.employee_id = filters.employeeId;
        fetchRequests(filterParams as any);
      }
    } catch (e) {
      // ignore
    } finally {
      setDeleteLoading(false);
    }
  };

  // =============================================
  // UTILITY FUNCTIONS (SIMPLIFIED)
  // =============================================

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  const handleDurationSort = () => {
    setDurationSort(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const getFilteredRequests = () => {
    if (!Array.isArray(requests)) return [];

    const filtered = requests.filter(request => {
      const status = request.status || request.details?.status || '';
      if (activeTab !== 'all' && status !== activeTab) return false;
      return true;
    });

    if (durationSort) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.start_date || '').getTime();
        const dateB = new Date(b.start_date || '').getTime();
        return durationSort === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return filtered;
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Employee
            </label>
            <select
              value={filters.employeeId}
              onChange={(e) => handleFilterChange('employeeId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>
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
          <div className="flex items-end">
            <Button color="gray" onClick={clearFilters} className="w-full">
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

  const renderEditModal = () => (
    <Modal show={editModal.isOpen} onClose={() => setEditModal({ isOpen: false, request: null })} size="lg">
      <Modal.Header>Edit Leave Request — {editModal.request?.employee_name}</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          {editError && <Alert color="failure">{editError}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type *</label>
              <select
                value={editForm.leave_type_id}
                onChange={e => setEditForm(p => ({ ...p, leave_type_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select leave type</option>
                {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Duration *</label>
              <select
                value={editForm.leave_duration}
                onChange={e => setEditForm(p => ({ ...p, leave_duration: e.target.value as any, start_time: '', end_time: '' }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="full_day">Full Day</option>
                <option value="half_day">Half Day</option>
                <option value="short_leave">Short Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
              <input type="date" value={editForm.start_date}
                onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value, end_date: editForm.leave_duration !== 'full_day' ? e.target.value : p.end_date }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
              <input type="date" value={editForm.end_date}
                disabled={editForm.leave_duration !== 'full_day'}
                onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
              />
            </div>

            {editForm.leave_duration === 'short_leave' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time *</label>
                  <input type="time" value={editForm.start_time}
                    onChange={e => setEditForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time *</label>
                  <input type="time" value={editForm.end_time}
                    onChange={e => setEditForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="edit_is_paid" checked={editForm.is_paid}
                onChange={e => setEditForm(p => ({ ...p, is_paid: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="edit_is_paid" className="text-sm font-medium text-gray-700 dark:text-gray-300">Paid Leave</label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
            <Textarea rows={3} value={editForm.reason}
              onChange={e => setEditForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Reason for leave (min 10 characters)"
            />
          </div>

          <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
            Note: Editing will reset the request status back to <strong>Pending</strong> for re-approval.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button color="gray" onClick={() => setEditModal({ isOpen: false, request: null })}>Cancel</Button>
          <Button color="blue" onClick={handleSaveEdit} disabled={editSaving}>
            {editSaving ? <Spinner size="sm" className="mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );

  const renderDeleteModal = () => (
    <Modal show={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, request: null })} size="md">
      <Modal.Header>Delete Leave Request</Modal.Header>
      <Modal.Body>
        <div className="space-y-3">
          <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this leave request?</p>
          {deleteModal.request && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm space-y-1">
              <div><strong>Employee:</strong> {deleteModal.request.employee_name}</div>
              <div><strong>Leave Type:</strong> {deleteModal.request.leave_type_name}</div>
              <div><strong>Duration:</strong> {formatDate(deleteModal.request.start_date || '')} – {formatDate(deleteModal.request.end_date || '')}</div>
              <div><strong>Status:</strong> {deleteModal.request.status}</div>
            </div>
          )}
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">This action cannot be undone.</p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button color="gray" onClick={() => setDeleteModal({ isOpen: false, request: null })}>Cancel</Button>
          <Button color="failure" onClick={handleConfirmDelete} disabled={deleteLoading}>
            {deleteLoading ? <Spinner size="sm" className="mr-2" /> : null}
            Delete
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
          <DynamicProtectedComponent permission="leaves.create">
            <Button
              color="purple"
              className="flex items-center gap-2"
              onClick={handleCreateRequest}
            >
              <FaPlus className="w-4 h-4" />
              Create New Request
            </Button>
          </DynamicProtectedComponent>

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
              <Table.HeadCell>
                <button
                  onClick={handleDurationSort}
                  className="flex items-center gap-1 hover:text-blue-600 font-semibold"
                >
                  Duration
                  {durationSort === 'asc' ? <FaSortUp className="w-3 h-3" /> : durationSort === 'desc' ? <FaSortDown className="w-3 h-3" /> : <FaSort className="w-3 h-3 opacity-40" />}
                </button>
              </Table.HeadCell>
              <Table.HeadCell>Days</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Applied Date</Table.HeadCell>
              <Table.HeadCell>Payment</Table.HeadCell>
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
                      {request.is_paid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          💰 Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Unpaid
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1">
                        {canApproveOrReject(status) && (
                          <>
                            <DynamicProtectedComponent permission="leaves.approve">
                              <Button size="xs" color="success" onClick={() => handleApprove(request)} disabled={submitting}>
                                <FaCheck className="w-3 h-3" />
                              </Button>
                            </DynamicProtectedComponent>
                            <DynamicProtectedComponent permission="leaves.reject">
                              <Button size="xs" color="failure" onClick={() => handleReject(request)} disabled={submitting}>
                                <FaTimes className="w-3 h-3" />
                              </Button>
                            </DynamicProtectedComponent>
                          </>
                        )}
                        <DynamicProtectedComponent permission="leaves.create">
                          <Button size="xs" color="blue" onClick={() => handleOpenEdit(request)} title="Edit">
                            <FaEdit className="w-3 h-3" />
                          </Button>
                          <Button size="xs" color="failure" onClick={() => handleOpenDelete(request)} title="Delete">
                            <FaTrash className="w-3 h-3" />
                          </Button>
                        </DynamicProtectedComponent>
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

      {/* Edit Modal */}
      {renderEditModal()}

      {/* Delete Modal */}
      {renderDeleteModal()}
    </div>
  );
};

export default LeaveRequestsManagement;