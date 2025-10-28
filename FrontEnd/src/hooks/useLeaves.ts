import { useState, useEffect, useCallback } from 'react';
import leaveApiService, { 
  LeaveType, 
  LeaveRequest, 
  LeaveDashboard,
  LeaveRequestFilters,
  CreateLeaveRequestData,
  CreateLeaveTypeData
} from '../services/leaveApi';

// =============================================
// HOOK INTERFACES (ADMIN-ONLY)
// =============================================

interface UseLeavesReturn {
  // Data
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
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
  fetchLeaveDashboard: (date?: string) => Promise<void>;
  
  approveLeaveRequest: (requestId: string, comments?: string) => Promise<boolean>;
  rejectLeaveRequest: (requestId: string, comments: string) => Promise<boolean>;
  
  createLeaveType: (data: CreateLeaveTypeData) => Promise<boolean>;
  updateLeaveType: (id: string, data: Partial<CreateLeaveTypeData>) => Promise<boolean>;
  deleteLeaveType: (id: string) => Promise<boolean>;
  
  createLeaveRequestForEmployee: (data: CreateLeaveRequestData & { employee_id: string }) => Promise<boolean>;
  
  // Utility functions
  clearError: () => void;
  refreshAll: () => Promise<void>;
}

// =============================================
// MAIN HOOK (ADMIN-ONLY)
// =============================================

export const useLeaves = (): UseLeavesReturn => {
  // Data states (REMOVED: myLeaveRequests, leaveBalance)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
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
  // FETCH FUNCTIONS (ADMIN-ONLY)
  // =============================================

  const fetchLeaveTypes = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await leaveApiService.getLeaveTypes();
      
      if (response.success && response.data) {
        setLeaveTypes(Array.isArray(response.data) ? response.data : []);
        console.log('✅ Leave types loaded:', response.data.length);
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
        // Handle both data structures from backend
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
        setLeaveRequests([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leave requests');
      setLeaveRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

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

  // =============================================
  // ACTION FUNCTIONS (ADMIN-ONLY)
  // =============================================

  const approveLeaveRequest = useCallback(async (requestId: string, comments?: string): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.approveLeaveRequest(requestId, comments);
      
      if (response.success) {
        // Update the request in local state
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'approved' as const,
                  reviewer_comments: comments
                } as LeaveRequest
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
        // Update the request in local state
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'rejected' as const,
                  reviewer_comments: comments
                } as LeaveRequest
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

  // NEW: Admin creates leave request for employee
  const createLeaveRequestForEmployee = useCallback(async (data: CreateLeaveRequestData & { employee_id: string }): Promise<boolean> => {
    try {
      setError(null);
      setSubmitting(true);
      
      const response = await leaveApiService.submitLeaveRequestForEmployee(data);
      
      if (response.success) {
        // Refresh requests after creating
        await fetchLeaveRequests();
        return true;
      } else {
        setError(response.message || 'Failed to create leave request');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create leave request');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchLeaveRequests]);

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
      
      // Fetch admin data concurrently (REMOVED: myLeaveRequests)
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
  }, []);

  // =============================================
  // RETURN HOOK INTERFACE (ADMIN-ONLY)
  // =============================================

  return {
    // Data (REMOVED: myLeaveRequests, leaveBalance)
    leaveTypes,
    leaveRequests,
    dashboard,
    
    // Loading states
    loading,
    submitting,
    refreshing,
    
    // Error state
    error,
    
    // Pagination
    pagination,
    
    // Fetch functions (REMOVED: fetchMyLeaveRequests, fetchLeaveBalance)
    fetchLeaveTypes,
    fetchLeaveRequests,
    fetchLeaveDashboard,
    
    // Action functions (REMOVED: submitLeaveRequest, cancelLeaveRequest, bulkApproveRequests, exportLeaveData)
    approveLeaveRequest,
    rejectLeaveRequest,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    
    // NEW: Admin function
    createLeaveRequestForEmployee,
    
    // Utility functions
    clearError,
    refreshAll
  };
};

// =============================================
// SPECIALIZED HOOKS (ADMIN-ONLY)
// =============================================

/**
 * Hook for admin leave management (simplified)
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
    createLeaveRequestForEmployee,
    refreshAll,
    clearError
  } = useLeaves();

  const [initialized, setInitialized] = useState(false);

  // Auto-fetch data on mount
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      refreshAll();
    }
  }, [initialized, refreshAll]);

  // Helper function to get pending requests
  const getPendingRequests = useCallback(() => {
    if (!Array.isArray(leaveRequests)) return [];
    
    return leaveRequests.filter(req => {
      const status = req.status || req.details?.status;
      return status === 'pending';
    });
  }, [leaveRequests]);

  return {
    // Data
    requests: Array.isArray(leaveRequests) ? leaveRequests : [],
    leaveTypes,
    dashboard, // Basic dashboard only
    loading,
    submitting,
    refreshing,
    error,
    pagination,
    
    // Actions
    approveRequest: approveLeaveRequest,
    rejectRequest: rejectLeaveRequest,
    createRequestForEmployee: createLeaveRequestForEmployee, // NEW
    fetchRequests: fetchLeaveRequests,
    refresh: refreshAll,
    clearError,
    
    // Helper functions
    getPendingRequests,
    
    // Simple statistics
    stats: {
      total: Array.isArray(leaveRequests) ? leaveRequests.length : 0,
      pending: getPendingRequests().length,
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
 * Hook for simple leave dashboard (optional)
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