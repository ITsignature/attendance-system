import { useState, useEffect, useCallback } from 'react';
import leaveApiService, { 
  LeaveType, 
  LeaveRequest, 
  LeaveBalance, 
  LeaveDashboard,
  LeaveRequestFilters,
  CreateLeaveRequestData,
  CreateLeaveTypeData
} from '../services/leaveApi';

// =============================================
// HOOK INTERFACES
// =============================================

interface UseLeavesReturn {
  // Data
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  myLeaveRequests: LeaveRequest[];
  leaveBalance: LeaveBalance[];
  dashboard: LeaveDashboard | null;
  
  // Loading states
  loading: boolean;
  submitting: boolean;
  refreshing: boolean;
  
  // Error states
  error: string | null;
  
  // Pagination
  pagination: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
  
  // Actions
  fetchLeaveTypes: () => Promise<void>;
  fetchLeaveRequests: (filters?: LeaveRequestFilters) => Promise<void>;
  fetchMyLeaveRequests: (filters?: LeaveRequestFilters) => Promise<void>;
  fetchLeaveDashboard: (date?: string) => Promise<void>;
  fetchLeaveBalance: (employeeId: string, year?: number) => Promise<void>;
  
  submitLeaveRequest: (data: CreateLeaveRequestData) => Promise<boolean>;
  approveLeaveRequest: (requestId: string, comments?: string) => Promise<boolean>;
  rejectLeaveRequest: (requestId: string, comments: string) => Promise<boolean>;
  cancelLeaveRequest: (requestId: string) => Promise<boolean>;
  
  createLeaveType: (data: CreateLeaveTypeData) => Promise<boolean>;
  updateLeaveType: (id: string, data: Partial<CreateLeaveTypeData>) => Promise<boolean>;
  deleteLeaveType: (id: string) => Promise<boolean>;
  
  bulkApproveRequests: (requestIds: string[], comments?: string) => Promise<boolean>;
  exportLeaveData: (filters?: any) => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  refreshAll: () => Promise<void>;
}

// =============================================
// MAIN HOOK
// =============================================

export const useLeaves = (): UseLeavesReturn => {
  // Data states
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance[]>([]);
  const [dashboard, setDashboard] = useState<LeaveDashboard | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    pages: 0
  });

  // =============================================
  // FETCH FUNCTIONS
  // =============================================

  const fetchLeaveTypes = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await leaveApiService.getLeaveTypes();
      
      if (response.success && response.data) {
        setLeaveTypes(Array.isArray(response.data) ? response.data : []);
      } else {
        setError(response.message || 'Failed to fetch leave types');
        setLeaveTypes([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leave types');
      setLeaveTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeaveRequests = useCallback(async (filters?: LeaveRequestFilters) => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);
      
      const response = await leaveApiService.getAllLeaveRequests(filters);
      
      if (response.success && response.data) {
        // FIXED: Handle both data structures from backend
        const requests = Array.isArray(response.data) 
          ? response.data 
          : (response.data.requests || []);
        
        setLeaveRequests(requests);
        
        // Handle pagination from either structure
        if (response.pagination) {
          setPagination(response.pagination);
        } else if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        setError(response.message || 'Failed to fetch leave requests');
        setLeaveRequests([]); // FIXED: Ensure it's always an array
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leave requests');
      setLeaveRequests([]); // FIXED: Ensure it's always an array
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const fetchMyLeaveRequests = useCallback(async (filters?: LeaveRequestFilters) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await leaveApiService.getMyLeaveRequests(filters);
      
      if (response.success && response.data) {
        // FIXED: Handle both data structures from backend
        const requests = Array.isArray(response.data) 
          ? response.data 
          : (response.data.requests || []);
        
        setMyLeaveRequests(requests);
        
        // Handle pagination from either structure
        if (response.pagination) {
          setPagination(response.pagination);
        } else if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        setError(response.message || 'Failed to fetch my leave requests');
        setMyLeaveRequests([]); // FIXED: Ensure it's always an array
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch my leave requests');
      setMyLeaveRequests([]); // FIXED: Ensure it's always an array
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeaveDashboard = useCallback(async (date?: string) => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);
      
      const response = await leaveApiService.getLeaveDashboard(date);
      
      if (response.success && response.data) {
        setDashboard(response.data);
      } else {
        setError(response.message || 'Failed to fetch leave dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leave dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const fetchLeaveBalance = useCallback(async (employeeId: string, year?: number) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await leaveApiService.getEmployeeLeaveBalance(employeeId, year);
      
      if (response.success && response.data) {
        setLeaveBalance(response.data.leaveBalance || []);
      } else {
        setError(response.message || 'Failed to fetch leave balance');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leave balance');
    } finally {
      setLoading(false);
    }
  }, []);

  // =============================================
  // ACTION FUNCTIONS
  // =============================================

  const submitLeaveRequest = useCallback(async (data: CreateLeaveRequestData): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.submitLeaveRequest(data);
      
      if (response.success) {
        // Refresh my requests
        await fetchMyLeaveRequests();
        return true;
      } else {
        setError(response.message || 'Failed to submit leave request');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit leave request');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchMyLeaveRequests]);

  const approveLeaveRequest = useCallback(async (requestId: string, comments?: string): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.approveLeaveRequest(requestId, comments);
      
      if (response.success) {
        // Update the request in local state - FIXED: Handle different data structures
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'approved',
                  reviewer_comments: comments,
                  details: req.details ? { ...req.details, status: 'approved', reviewerComments: comments } : undefined
                }
              : req
          )
        );
        
        // Refresh dashboard if needed
        if (dashboard) {
          await fetchLeaveDashboard();
        }
        
        return true;
      } else {
        setError(response.message || 'Failed to approve leave request');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve leave request');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [dashboard, fetchLeaveDashboard]);

  const rejectLeaveRequest = useCallback(async (requestId: string, comments: string): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.rejectLeaveRequest(requestId, comments);
      
      if (response.success) {
        // Update the request in local state - FIXED: Handle different data structures
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'rejected',
                  reviewer_comments: comments,
                  details: req.details ? { ...req.details, status: 'rejected', reviewerComments: comments } : undefined
                }
              : req
          )
        );
        
        return true;
      } else {
        setError(response.message || 'Failed to reject leave request');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject leave request');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const cancelLeaveRequest = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.cancelLeaveRequest(requestId);
      
      if (response.success) {
        // Update the request in local state - FIXED: Handle different data structures
        setMyLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'cancelled',
                  details: req.details ? { ...req.details, status: 'cancelled' } : undefined
                }
              : req
          )
        );
        
        return true;
      } else {
        setError(response.message || 'Failed to cancel leave request');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel leave request');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const createLeaveType = useCallback(async (data: CreateLeaveTypeData): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.createLeaveType(data);
      
      if (response.success) {
        // Refresh leave types
        await fetchLeaveTypes();
        return true;
      } else {
        setError(response.message || 'Failed to create leave type');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create leave type');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchLeaveTypes]);

  const updateLeaveType = useCallback(async (id: string, data: Partial<CreateLeaveTypeData>): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.updateLeaveType(id, data);
      
      if (response.success) {
        // Refresh leave types
        await fetchLeaveTypes();
        return true;
      } else {
        setError(response.message || 'Failed to update leave type');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update leave type');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchLeaveTypes]);

  const deleteLeaveType = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.deleteLeaveType(id);
      
      if (response.success) {
        // Remove from local state
        setLeaveTypes(prev => prev.filter(type => type.id !== id));
        return true;
      } else {
        setError(response.message || 'Failed to delete leave type');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete leave type');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const bulkApproveRequests = useCallback(async (requestIds: string[], comments?: string): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.bulkApproveRequests(requestIds, comments);
      
      if (response.success) {
        // Update multiple requests in local state - FIXED: Handle different data structures
        setLeaveRequests(prev => 
          prev.map(req => 
            requestIds.includes(req.id)
              ? { 
                  ...req, 
                  status: 'approved',
                  reviewer_comments: comments,
                  details: req.details ? { ...req.details, status: 'approved', reviewerComments: comments } : undefined
                }
              : req
          )
        );
        
        // Refresh dashboard if needed
        if (dashboard) {
          await fetchLeaveDashboard();
        }
        
        return true;
      } else {
        setError(response.message || 'Failed to bulk approve requests');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to bulk approve requests');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [dashboard, fetchLeaveDashboard]);

  const exportLeaveData = useCallback(async (filters?: any): Promise<void> => {
    try {
      setError(null);
      setSubmitting(true);
      
      await leaveApiService.exportLeaveData(filters);
    } catch (err: any) {
      setError(err.message || 'Failed to export leave data');
    } finally {
      setSubmitting(false);
    }
  }, []);

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // Fetch all data concurrently - call the API service directly to avoid dependency issues
      await Promise.allSettled([
        (async () => {
          try {
            const response = await leaveApiService.getLeaveTypes();
            if (response.success && response.data) {
              setLeaveTypes(Array.isArray(response.data) ? response.data : []);
            }
          } catch (error) {
            console.error('Failed to fetch leave types:', error);
          }
        })(),
        (async () => {
          try {
            const response = await leaveApiService.getLeaveDashboard();
            if (response.success && response.data) {
              setDashboard(response.data);
            }
          } catch (error) {
            console.error('Failed to fetch dashboard:', error);
          }
        })(),
        (async () => {
          try {
            const response = await leaveApiService.getAllLeaveRequests();
            if (response.success && response.data) {
              const requests = Array.isArray(response.data) 
                ? response.data 
                : (response.data.requests || []);
              setLeaveRequests(requests);
            }
          } catch (error) {
            console.error('Failed to fetch leave requests:', error);
          }
        })()
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, []); // No dependencies needed since we call API service directly

  // =============================================
  // RETURN HOOK INTERFACE
  // =============================================

  return {
    // Data
    leaveTypes,
    leaveRequests,
    myLeaveRequests,
    leaveBalance,
    dashboard,
    
    // Loading states
    loading,
    submitting,
    refreshing,
    
    // Error state
    error,
    
    // Pagination
    pagination,
    
    // Fetch functions
    fetchLeaveTypes,
    fetchLeaveRequests,
    fetchMyLeaveRequests,
    fetchLeaveDashboard,
    fetchLeaveBalance,
    
    // Action functions
    submitLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    bulkApproveRequests,
    exportLeaveData,
    
    // Utility functions
    clearError,
    refreshAll
  };
};

// =============================================
// SPECIALIZED HOOKS
// =============================================

/**
 * Hook for employee leave management (simplified interface)
 */
export const useMyLeaves = () => {
  const {
    myLeaveRequests,
    leaveBalance,
    leaveTypes,
    loading,
    submitting,
    error,
    fetchMyLeaveRequests,
    fetchLeaveBalance,
    fetchLeaveTypes,
    submitLeaveRequest,
    cancelLeaveRequest,
    clearError
  } = useLeaves();

  // Auto-fetch data on mount
  useEffect(() => {
    fetchMyLeaveRequests();
    fetchLeaveTypes();
  }, [fetchMyLeaveRequests, fetchLeaveTypes]);

  return {
    requests: myLeaveRequests,
    balance: leaveBalance,
    leaveTypes,
    loading,
    submitting,
    error,
    submitRequest: submitLeaveRequest,
    cancelRequest: cancelLeaveRequest,
    refreshRequests: fetchMyLeaveRequests,
    getBalance: fetchLeaveBalance,
    clearError
  };
};

/**
 * Hook for manager/HR leave management
 */
export const useLeaveManagement = () => {
  const {
    leaveRequests,
    dashboard,
    leaveTypes,
    loading,
    submitting,
    refreshing,
    error,
    pagination,
    fetchLeaveRequests,
    fetchLeaveDashboard,
    fetchLeaveTypes,
    approveLeaveRequest,
    rejectLeaveRequest,
    bulkApproveRequests,
    exportLeaveData,
    refreshAll,
    clearError
  } = useLeaves();

  const [initialized, setInitialized] = useState(false);

  // Auto-fetch data on mount - FIXED: Use initialized flag to prevent infinite loop
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      refreshAll();
    }
  }, [initialized, refreshAll]);

  // Helper function to get pending requests - FIXED: Handle different data structures
  const getPendingRequests = useCallback(() => {
    // FIXED: Ensure leaveRequests is an array before filtering
    if (!Array.isArray(leaveRequests)) {
      console.warn('leaveRequests is not an array:', leaveRequests);
      return [];
    }
    
    return leaveRequests.filter(req => {
      // FIXED: Handle different data structures
      const status = req.status || req.details?.status;
      return status === 'pending';
    });
  }, [leaveRequests]);

  // Helper function to get urgent requests (starting within 7 days) - FIXED: Handle different data structures
  const getUrgentRequests = useCallback(() => {
    // FIXED: Ensure leaveRequests is an array before filtering
    if (!Array.isArray(leaveRequests)) {
      console.warn('leaveRequests is not an array:', leaveRequests);
      return [];
    }
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return leaveRequests.filter(req => {
      // FIXED: Handle different data structures
      const status = req.status || req.details?.status;
      const startDate = req.start_date || req.dates?.start;
      
      return status === 'pending' && 
             startDate && 
             new Date(startDate) <= sevenDaysFromNow;
    });
  }, [leaveRequests]);

  return {
    requests: Array.isArray(leaveRequests) ? leaveRequests : [], // FIXED: Always return array
    dashboard,
    leaveTypes,
    loading,
    submitting,
    refreshing,
    error,
    pagination,
    
    // Actions
    approveRequest: approveLeaveRequest,
    rejectRequest: rejectLeaveRequest,
    bulkApprove: bulkApproveRequests,
    exportData: exportLeaveData,
    refresh: refreshAll,
    fetchRequests: fetchLeaveRequests,
    clearError,
    
    // Helper functions
    getPendingRequests,
    getUrgentRequests,
    
    // Statistics - FIXED: Handle different data structures
    stats: {
      total: Array.isArray(leaveRequests) ? leaveRequests.length : 0,
      pending: getPendingRequests().length,
      urgent: getUrgentRequests().length,
      approved: Array.isArray(leaveRequests) 
        ? leaveRequests.filter(req => (req.status || req.details?.status) === 'approved').length 
        : 0,
      rejected: Array.isArray(leaveRequests) 
        ? leaveRequests.filter(req => (req.status || req.details?.status) === 'rejected').length 
        : 0
    }
  };
};

/**
 * Hook for leave dashboard only
 */
export const useLeaveDashboard = (autoRefresh = false, refreshInterval = 300000) => {
  const {
    dashboard,
    loading,
    error,
    fetchLeaveDashboard,
    clearError
  } = useLeaves();

  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Auto-fetch on mount with authentication check
  useEffect(() => {
    const loadDashboard = async () => {
      const token = localStorage.getItem('accessToken');
      if (token && !initialLoadDone) {
        try {
          await fetchLeaveDashboard();
          setInitialLoadDone(true);
        } catch (error) {
          console.error('Dashboard load failed:', error);
          setInitialLoadDone(true);
        }
      } else if (!token) {
        console.warn('No authentication token found');
        setInitialLoadDone(true);
      }
    };

    // Add a small delay to ensure auth is loaded
    const timer = setTimeout(loadDashboard, 100);
    return () => clearTimeout(timer);
  }, [fetchLeaveDashboard, initialLoadDone]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !initialLoadDone) return;

    const interval = setInterval(() => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        fetchLeaveDashboard();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchLeaveDashboard, initialLoadDone]);

  const refreshDashboard = useCallback((date?: string) => {
    return fetchLeaveDashboard(date);
  }, [fetchLeaveDashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: refreshDashboard,
    clearError
  };
};

export default useLeaves;