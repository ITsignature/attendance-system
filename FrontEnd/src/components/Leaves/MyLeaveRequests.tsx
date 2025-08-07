// =============================================
// COMPLETE MY LEAVE REQUESTS - Production Ready
// File: src/components/Leaves/MyLeaveRequests.tsx
// =============================================

import React, { useState, useEffect } from "react";
import { Table, Button, Badge, Alert, Spinner, Card, Modal, TextInput, Tooltip } from "flowbite-react";
import { 
  FaArrowLeft, 
  FaPlus, 
  FaEye, 
  FaTimes, 
  FaDownload, 
  FaCalendarAlt,
  FaFilter,
  FaSearch,
  FaEdit,
  FaPrint,
  FaFileExport,
  FaInfoCircle,
  FaClock,
  FaCheckCircle,
  FaTimesCircle
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { useMyLeaves } from "../../hooks/useLeaves";
import leaveApiService, { LeaveRequest } from "../../services/leaveApi";

// =============================================
// INTERFACES
// =============================================

interface FilterState {
  status: string;
  year: string;
  leaveType: string;
  searchTerm: string;
  dateRange: {
    start: string;
    end: string;
  };
}

interface ViewMode {
  mode: 'table' | 'card';
}

// =============================================
// MAIN COMPONENT
// =============================================

const MyLeaveRequests: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Hook for personal leave management
  const {
    requests,
    balance,
    leaveTypes,
    loading,
    submitting,
    error,
    cancelRequest,
    refreshRequests,
    getBalance,
    clearError
  } = useMyLeaves();

  // Local state
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    year: new Date().getFullYear().toString(),
    leaveType: 'all',
    searchTerm: '',
    dateRange: {
      start: '',
      end: ''
    }
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>({ mode: 'table' });
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'appliedAt', direction: 'desc' });

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    // Show success message if redirected from form submission
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message from history state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    // Auto-hide success message after 5 seconds
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    // Get current user's balance when component mounts
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.employeeId) {
          getBalance(user.employeeId, parseInt(filters.year));
        }
      } catch (error) {
        console.error('Failed to get user data:', error);
      }
    }
  }, [getBalance, filters.year]);

  // =============================================
  // HANDLERS
  // =============================================

  const handleFilterChange = (key: keyof FilterState, value: string | any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleViewDetails = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setShowDetails(true);
  };

  const handleCancelRequest = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setShowCancelModal(true);
  };

  const handleEditRequest = (request: LeaveRequest) => {
    // Navigate to edit form (if request is still pending)
    navigate(`/leave-request/edit/${request.id}`);
  };

  const confirmCancelRequest = async () => {
    if (!selectedRequest) return;

    const success = await cancelRequest(selectedRequest.id);
    
    if (success) {
      setShowCancelModal(false);
      setSelectedRequest(null);
      setSuccessMessage('Leave request cancelled successfully');
    }
  };

  const handleRefresh = async () => {
    await refreshRequests();
  };

  const handleExportRequests = async () => {
    try {
      await leaveApiService.exportLeaveData({
        format: 'csv',
        ...filters
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const clearAllFilters = () => {
    setFilters({
      status: 'all',
      year: new Date().getFullYear().toString(),
      leaveType: 'all',
      searchTerm: '',
      dateRange: {
        start: '',
        end: ''
      }
    });
  };

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const getFilteredAndSortedRequests = (): LeaveRequest[] => {
    let filtered = [...requests];

    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(req => req.details.status === filters.status);
    }

    if (filters.year !== 'all') {
      filtered = filtered.filter(req => 
        new Date(req.dates.start).getFullYear().toString() === filters.year
      );
    }

    if (filters.leaveType !== 'all') {
      filtered = filtered.filter(req => req.leaveType.id === filters.leaveType);
    }

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(req => 
        req.leaveType.name.toLowerCase().includes(searchTerm) ||
        req.details.reason.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.dateRange.start) {
      filtered = filtered.filter(req => 
        new Date(req.dates.start) >= new Date(filters.dateRange.start)
      );
    }

    if (filters.dateRange.end) {
      filtered = filtered.filter(req => 
        new Date(req.dates.end) <= new Date(filters.dateRange.end)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a;
      let bValue: any = b;

      switch (sortConfig.key) {
        case 'appliedAt':
          aValue = new Date(a.details.appliedAt);
          bValue = new Date(b.details.appliedAt);
          break;
        case 'startDate':
          aValue = new Date(a.dates.start);
          bValue = new Date(b.dates.start);
          break;
        case 'leaveType':
          aValue = a.leaveType.name;
          bValue = b.leaveType.name;
          break;
        case 'status':
          aValue = a.details.status;
          bValue = b.details.status;
          break;
        case 'days':
          aValue = a.dates.daysRequested;
          bValue = b.dates.daysRequested;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const getStatusBadge = (status: string, size: 'sm' | 'xs' = 'sm') => {
    const config = {
      pending: { color: 'warning', icon: '⏳', text: 'Pending' },
      approved: { color: 'success', icon: '✅', text: 'Approved' },
      rejected: { color: 'failure', icon: '❌', text: 'Rejected' },
      cancelled: { color: 'gray', icon: '🚫', text: 'Cancelled' }
    };
    
    const { color, icon, text } = config[status as keyof typeof config] || 
      { color: 'gray', icon: '❓', text: 'Unknown' };
    
    return (
      <Badge color={color} size={size} className="flex items-center gap-1">
        <span>{icon}</span>
        {text}
      </Badge>
    );
  };

  const formatDate = (dateString: string, format: 'short' | 'long' = 'short') => {
    const date = new Date(dateString);
    if (format === 'long') {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canCancelRequest = (request: LeaveRequest) => {
    return (request.details.status === 'pending' || request.details.status === 'approved') && 
           new Date(request.dates.start) > new Date();
  };

  const canEditRequest = (request: LeaveRequest) => {
    return request.details.status === 'pending' && new Date(request.dates.start) > new Date();
  };

  const getRequestStats = () => {
    const currentYear = parseInt(filters.year);
    const yearRequests = requests.filter(r => 
      new Date(r.dates.start).getFullYear() === currentYear
    );

    const stats = {
      total: yearRequests.length,
      pending: yearRequests.filter(r => r.details.status === 'pending').length,
      approved: yearRequests.filter(r => r.details.status === 'approved').length,
      rejected: yearRequests.filter(r => r.details.status === 'rejected').length,
      cancelled: yearRequests.filter(r => r.details.status === 'cancelled').length,
      totalDaysUsed: yearRequests
        .filter(r => r.details.status === 'approved')
        .reduce((sum, r) => sum + r.dates.daysRequested, 0),
      totalDaysPending: yearRequests
        .filter(r => r.details.status === 'pending')
        .reduce((sum, r) => sum + r.dates.daysRequested, 0)
    };
    return stats;
  };

  const getUpcomingLeaves = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    return requests.filter(req => 
      req.details.status === 'approved' &&
      new Date(req.dates.start) > now &&
      new Date(req.dates.start) <= thirtyDaysFromNow
    );
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderLeaveBalance = () => (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Leave Balance ({filters.year})
        </h3>
        <div className="flex gap-2">
          <select
            className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.year}
            onChange={(e) => handleFilterChange('year', e.target.value)}
          >
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
          <Tooltip content="Refresh balance data">
            <Button 
              size="xs" 
              color="gray"
              onClick={() => {
                const userData = localStorage.getItem('user');
                if (userData) {
                  try {
                    const user = JSON.parse(userData);
                    if (user.employeeId) {
                      getBalance(user.employeeId, parseInt(filters.year));
                    }
                  } catch (error) {
                    console.error('Failed to get user data:', error);
                  }
                }
              }}
            >
              🔄
            </Button>
          </Tooltip>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {balance.map((lb) => (
          <div key={lb.leaveType.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {lb.leaveType.name}
              </h4>
              <Badge color={lb.leaveType.isPaid ? 'green' : 'gray'} size="xs">
                {lb.leaveType.isPaid ? 'Paid' : 'Unpaid'}
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Allocated:</span>
                <span className="font-medium">{lb.balance.allocated} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Used:</span>
                <span className="font-medium text-red-600">{lb.balance.used} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pending:</span>
                <span className="font-medium text-yellow-600">{lb.balance.pending} days</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600 dark:text-gray-400">Available:</span>
                <span className={`font-bold ${lb.balance.remaining > 5 ? 'text-green-600' : lb.balance.remaining > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {lb.balance.remaining} days
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(lb.balance.utilizationPercentage, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{lb.balance.utilizationPercentage}% utilized</span>
                <span>{lb.balance.allocated - lb.balance.used - lb.balance.pending} days left</span>
              </div>
            </div>

            {/* Quick action */}
            <Button
              size="xs"
              color="purple"
              className="w-full"
              onClick={() => navigate(`/leave-request/new?type=${lb.leaveType.id}`)}
            >
              Request {lb.leaveType.name}
            </Button>
          </div>
        ))}
        
        {balance.length === 0 && (
          <div className="col-span-full text-center py-8">
            <FaInfoCircle className="mx-auto text-4xl text-gray-400 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">No leave balance data available</p>
            <Button size="sm" color="blue" className="mt-2" onClick={handleRefresh}>
              Refresh Data
            </Button>
          </div>
        )}
      </div>
    </Card>
  );

  const renderQuickStats = () => {
    const stats = getRequestStats();
    const upcomingLeaves = getUpcomingLeaves();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Request Statistics */}
        <div className="lg:col-span-3">
          <Card>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Request Statistics ({filters.year})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-xs text-blue-500">Total</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs text-yellow-500">Pending</div>
              </div>
              <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                <div className="text-xs text-green-500">Approved</div>
              </div>
              <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
                <div className="text-xs text-red-500">Rejected</div>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
                <div className="text-xs text-gray-500">Cancelled</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Days Used: </span>
                <span className="font-medium">{stats.totalDaysUsed} days</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Days Pending: </span>
                <span className="font-medium">{stats.totalDaysPending} days</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Upcoming Leaves */}
        <div>
          <Card>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FaCalendarAlt className="text-blue-500" />
              Upcoming
            </h4>
            <div className="space-y-2">
              {upcomingLeaves.slice(0, 3).map((leave) => (
                <div key={leave.id} className="text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="font-medium">{leave.leaveType.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {formatDate(leave.dates.start)} - {leave.dates.end !== leave.dates.start ? formatDate(leave.dates.end) : ''}
                  </div>
                </div>
              ))}
              {upcomingLeaves.length === 0 && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <div className="text-2xl mb-1">🏖️</div>
                  <div className="text-xs">No upcoming leaves</div>
                </div>
              )}
              {upcomingLeaves.length > 3 && (
                <div className="text-center">
                  <Button size="xs" color="blue">
                    View All ({upcomingLeaves.length})
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderAdvancedFilters = () => (
    <Modal show={showFilters} onClose={() => setShowFilters(false)} size="lg">
      <Modal.Header>Advanced Filters</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Term
              </label>
              <TextInput
                placeholder="Search by leave type or reason..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                icon={FaSearch}
              />
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
                Leave Type
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.leaveType}
                onChange={(e) => handleFilterChange('leaveType', e.target.value)}
              >
                <option value="all">All Leave Types</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Year
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
              >
                <option value="all">All Years</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date From
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.dateRange.start}
                onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date To
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.dateRange.end}
                onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, end: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between w-full">
          <Button color="gray" onClick={clearAllFilters}>
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button color="gray" onClick={() => setShowFilters(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={() => setShowFilters(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );

  const renderDetailsModal = () => {
    if (!selectedRequest || !showDetails) return null;

    return (
      <Modal show={showDetails} onClose={() => setShowDetails(false)} size="xl">
        <Modal.Header>Leave Request Details</Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            {/* Status Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {selectedRequest.details.status === 'pending' && '⏳'}
                  {selectedRequest.details.status === 'approved' && '✅'}
                  {selectedRequest.details.status === 'rejected' && '❌'}
                  {selectedRequest.details.status === 'cancelled' && '🚫'}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedRequest.leaveType.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Request ID: {selectedRequest.id}
                  </p>
                </div>
              </div>
              {getStatusBadge(selectedRequest.details.status)}
            </div>

            {/* Basic Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Leave Type
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium">{selectedRequest.leaveType.name}</span>
                    <Badge color={selectedRequest.leaveType.isPaid ? 'green' : 'gray'} size="xs">
                      {selectedRequest.leaveType.isPaid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Start Date
                  </label>
                  <p className="mt-1 font-medium">{formatDate(selectedRequest.dates.start, 'long')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duration
                  </label>
                  <p className="mt-1 font-medium flex items-center gap-2">
                    <FaCalendarAlt className="text-blue-500" />
                    {selectedRequest.dates.daysRequested} business day{selectedRequest.dates.daysRequested > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <div className="mt-1">
                    {getStatusBadge(selectedRequest.details.status)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    End Date
                  </label>
                  <p className="mt-1 font-medium">{formatDate(selectedRequest.dates.end, 'long')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Applied On
                  </label>
                  <p className="mt-1 font-medium flex items-center gap-2">
                    <FaClock className="text-gray-500" />
                    {formatDate(selectedRequest.details.appliedAt, 'long')}
                  </p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Leave
              </label>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <p className="text-gray-900 dark:text-white leading-relaxed">
                  {selectedRequest.details.reason}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Request Timeline
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
                    <FaCheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Request Submitted</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {formatDate(selectedRequest.details.appliedAt, 'long')} at {new Date(selectedRequest.details.appliedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {selectedRequest.details.reviewedAt && (
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${
                    selectedRequest.details.status === 'approved' 
                      ? 'bg-green-50 dark:bg-green-900/20' 
                      : selectedRequest.details.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${
                      selectedRequest.details.status === 'approved' 
                        ? 'bg-green-500' 
                        : selectedRequest.details.status === 'rejected'
                        ? 'bg-red-500'
                        : 'bg-gray-500'
                    }`}>
                      {selectedRequest.details.status === 'approved' && <FaCheckCircle className="w-4 h-4" />}
                      {selectedRequest.details.status === 'rejected' && <FaTimesCircle className="w-4 h-4" />}
                      {selectedRequest.details.status === 'cancelled' && <FaTimes className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        selectedRequest.details.status === 'approved' 
                          ? 'text-green-900 dark:text-green-100' 
                          : selectedRequest.details.status === 'rejected'
                          ? 'text-red-900 dark:text-red-100'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        Request {selectedRequest.details.status.charAt(0).toUpperCase() + selectedRequest.details.status.slice(1)}
                      </p>
                      <p className={`text-sm ${
                        selectedRequest.details.status === 'approved' 
                          ? 'text-green-700 dark:text-green-300' 
                          : selectedRequest.details.status === 'rejected'
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {formatDate(selectedRequest.details.reviewedAt, 'long')} at {new Date(selectedRequest.details.reviewedAt).toLocaleTimeString()}
                        {selectedRequest.details.reviewerName && (
                          <span> by {selectedRequest.details.reviewerName}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Review Information */}
            {selectedRequest.details.reviewedAt && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Review Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Reviewed By
                    </label>
                    <p className="mt-1 font-medium">{selectedRequest.details.reviewerName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Review Date
                    </label>
                    <p className="mt-1 font-medium">{formatDate(selectedRequest.details.reviewedAt, 'long')}</p>
                  </div>
                </div>
                {selectedRequest.details.reviewerComments && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Manager Comments
                    </label>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                      <p className="text-gray-900 dark:text-white leading-relaxed">
                        {selectedRequest.details.reviewerComments}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Supporting Documents */}
            {selectedRequest.details.supportingDocuments && selectedRequest.details.supportingDocuments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Supporting Documents
                </label>
                <div className="space-y-2">
                  {selectedRequest.details.supportingDocuments.map((doc: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="text-blue-500">📄</div>
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {doc.size && `${(doc.size / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                      </div>
                      <Button size="xs" color="blue">
                        <FaDownload className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Notes */}
            {canCancelRequest(selectedRequest) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FaInfoCircle className="text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                      Request Actions Available
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      You can cancel this request since it hasn't started yet. 
                      {selectedRequest.details.status === 'approved' && 
                        " Your leave balance will be restored upon cancellation."
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              {canCancelRequest(selectedRequest) && (
                <Button 
                  color="failure" 
                  size="sm"
                  onClick={() => {
                    setShowDetails(false);
                    handleCancelRequest(selectedRequest);
                  }}
                >
                  Cancel Request
                </Button>
              )}
              {canEditRequest(selectedRequest) && (
                <Button 
                  color="warning" 
                  size="sm"
                  onClick={() => {
                    setShowDetails(false);
                    handleEditRequest(selectedRequest);
                  }}
                >
                  <FaEdit className="w-3 h-3 mr-1" />
                  Edit Request
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                color="blue" 
                size="sm"
                onClick={() => window.print()}
              >
                <FaPrint className="w-3 h-3 mr-1" />
                Print
              </Button>
              <Button color="gray" onClick={() => setShowDetails(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    );
  };

  const renderCancelModal = () => (
    <Modal show={showCancelModal} onClose={() => setShowCancelModal(false)}>
      <Modal.Header>
        <div className="flex items-center gap-2">
          <FaTimes className="text-red-500" />
          Cancel Leave Request
        </div>
      </Modal.Header>
      <Modal.Body>
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <FaInfoCircle className="text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">
                  Are you sure you want to cancel this request?
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  This action cannot be undone. You'll need to submit a new request if you change your mind.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h5 className="font-medium mb-3">Request Details:</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Leave Type:</span>
                  <span className="font-medium">{selectedRequest.leaveType.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                  <span className="font-medium">{leaveApiService.formatLeaveDuration(
                    selectedRequest.dates.start,
                    selectedRequest.dates.end,
                    selectedRequest.dates.daysRequested
                  )}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span>{getStatusBadge(selectedRequest.details.status, 'xs')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Days:</span>
                  <span className="font-medium">{selectedRequest.dates.daysRequested} day{selectedRequest.dates.daysRequested > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">What happens next:</h5>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Your request status will change to "Cancelled"</li>
                {selectedRequest.details.status === 'approved' && (
                  <li>• Your leave balance will be restored</li>
                )}
                <li>• You can submit a new request anytime</li>
                <li>• Your manager will be notified of the cancellation</li>
              </ul>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button color="gray" onClick={() => setShowCancelModal(false)}>
            Keep Request
          </Button>
          <Button 
            color="failure" 
            onClick={confirmCancelRequest}
            disabled={submitting}
          >
            {submitting ? <Spinner size="sm" className="mr-2" /> : <FaTimes className="mr-2" />}
            Cancel Request
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );

  const renderTableView = () => {
    const filteredRequests = getFilteredAndSortedRequests();

    const getSortIcon = (column: string) => {
      if (sortConfig.key !== column) return '↕️';
      return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    return (
      <div className="overflow-x-auto">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('leaveType')}
            >
              <div className="flex items-center gap-2">
                Leave Type
                <span className="text-xs">{getSortIcon('leaveType')}</span>
              </div>
            </Table.HeadCell>
            <Table.HeadCell 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('startDate')}
            >
              <div className="flex items-center gap-2">
                Duration
                <span className="text-xs">{getSortIcon('startDate')}</span>
              </div>
            </Table.HeadCell>
            <Table.HeadCell 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('days')}
            >
              <div className="flex items-center gap-2">
                Days
                <span className="text-xs">{getSortIcon('days')}</span>
              </div>
            </Table.HeadCell>
            <Table.HeadCell 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center gap-2">
                Status
                <span className="text-xs">{getSortIcon('status')}</span>
              </div>
            </Table.HeadCell>
            <Table.HeadCell 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('appliedAt')}
            >
              <div className="flex items-center gap-2">
                Applied
                <span className="text-xs">{getSortIcon('appliedAt')}</span>
              </div>
            </Table.HeadCell>
            <Table.HeadCell>Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {filteredRequests.map((request) => (
              <Table.Row key={request.id} className="bg-white dark:border-gray-700 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{request.leaveType.name}</span>
                    <Badge color={request.leaveType.isPaid ? 'green' : 'gray'} size="xs">
                      {request.leaveType.isPaid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <FaCalendarAlt className="w-3 h-3 text-gray-400" />
                      {formatDate(request.dates.start)} - {formatDate(request.dates.end)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(request.dates.start).toLocaleDateString('en-US', { weekday: 'short' })} to{' '}
                      {new Date(request.dates.end).toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="text-center">
                    <span className="font-bold text-lg">{request.dates.daysRequested}</span>
                    <p className="text-xs text-gray-500">day{request.dates.daysRequested > 1 ? 's' : ''}</p>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {getStatusBadge(request.details.status)}
                </Table.Cell>
                <Table.Cell>
                  <div>
                    <p className="text-sm font-medium">{formatDate(request.details.appliedAt)}</p>
                    <p className="text-xs text-gray-500">
                      {Math.ceil((new Date().getTime() - new Date(request.details.appliedAt).getTime()) / (1000 * 3600 * 24))} days ago
                    </p>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-1">
                    <Tooltip content="View Details">
                      <Button
                        size="xs"
                        color="blue"
                        onClick={() => handleViewDetails(request)}
                      >
                        <FaEye className="w-3 h-3" />
                      </Button>
                    </Tooltip>
                    
                    {canEditRequest(request) && (
                      <Tooltip content="Edit Request">
                        <Button
                          size="xs"
                          color="warning"
                          onClick={() => handleEditRequest(request)}
                        >
                          <FaEdit className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                    )}
                    
                    {canCancelRequest(request) && (
                      <Tooltip content="Cancel Request">
                        <Button
                          size="xs"
                          color="failure"
                          onClick={() => handleCancelRequest(request)}
                          disabled={submitting}
                        >
                          <FaTimes className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        
        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No leave requests found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {filters.status !== 'all' || filters.searchTerm || filters.leaveType !== 'all' 
                ? "Try adjusting your filters to see more results."
                : "You haven't submitted any leave requests yet."
              }
            </p>
            {filters.status === 'all' && !filters.searchTerm && filters.leaveType === 'all' && (
              <Button 
                color="purple"
                onClick={() => navigate('/leave-request/new')}
                className="flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Submit Your First Request
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Leave Requests</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage and track your leave requests
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            color="purple"
            size="sm"
            onClick={() => navigate('/leave-request/new')}
            className="flex items-center gap-2"
          >
            <FaPlus className="w-4 h-4" />
            New Request
          </Button>
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
            onClick={handleExportRequests}
            className="flex items-center gap-2"
          >
            <FaFileExport className="w-4 h-4" />
            Export
          </Button>
          <Button
            color="gray"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : '🔄'}
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert color="success" className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaCheckCircle />
              <span>{successMessage}</span>
            </div>
            <Button size="xs" color="success" onClick={() => setSuccessMessage('')}>
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert color="failure" className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaTimesCircle />
              <span>{error}</span>
            </div>
            <Button size="xs" color="failure" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {/* Leave Balance */}
      {renderLeaveBalance()}

      {/* Quick Stats & Upcoming Leaves */}
      {renderQuickStats()}

      {/* Main Content */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Leave Requests
            </h3>
            <div className="flex items-center gap-2">
              <TextInput
                placeholder="Search requests..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                size="sm"
                icon={FaSearch}
                className="w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-2">Loading your requests...</span>
          </div>
        ) : (
          renderTableView()
        )}
      </Card>

      {/* Modals */}
      {renderAdvancedFilters()}
      {renderDetailsModal()}
      {renderCancelModal()}
    </div>
  );
};

export default MyLeaveRequests;