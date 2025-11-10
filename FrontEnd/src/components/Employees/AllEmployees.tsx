import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { 
  TextInput, 
  Button, 
  Dropdown, 
  Badge, 
  Modal, 
  Alert,
  Spinner,
  Tooltip,
  Progress,
  Table,
  Checkbox
} from 'flowbite-react';
import {
  HiOutlinePlus,
  HiOutlineFilter,
  HiOutlineDownload,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineUsers,
  HiOutlineTrash
} from 'react-icons/hi';
import { DynamicProtectedComponent } from '../RBACSystem/rbacSystem';
import apiService from '../../services/api';
import { Employee, EmployeeFilters } from '../../types/employee';

interface EmployeesResponse {
  employees: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  terminated: number;
  resigned: number;
  permanent: number;
  contract: number;
  intern: number;
  consultant: number;
  by_department: Array<{
    department_name: string;
    count: number;
  }>;
}

const AllEmployees: React.FC = () => {
  const navigate = useNavigate();
  
  // State management
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // Store all employees
  const [employees, setEmployees] = useState<Employee[]>([]); // Filtered employees for display
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  
  // Filters and search
  const [filters, setFilters] = useState<EmployeeFilters>({
    page: 1,
    limit: 10,
    search: '',
    department_id: '',
    employment_status: '',
    employee_type: '',
    sortBy: 'first_name',
    sortOrder: 'asc'
  });
  
  // Modal states for bulk operations
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkProgress, setShowBulkProgress] = useState(false);
  const [bulkOperationProgress, setBulkOperationProgress] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 10
  });

  // Load all employees
  const loadEmployees = useCallback(async () => {
    try {
      setError(null);
      
      const response = await apiService.getEmployees({
        limit: 10000, // Get all employees for frontend filtering
        employment_status: '', // Don't filter on API level
        page: 1
      });

      if (response.success) {
        setAllEmployees(response.data.employees || []);
      } else {
        setError(response.message || 'Failed to load employees');
      }
    } catch (err: any) {
      console.error('Failed to load employees:', err);
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // FIXED: Filter employees on frontend
  const filterEmployees = useCallback(() => {
    let filtered = [...allEmployees];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.first_name?.toLowerCase().includes(searchTerm) ||
        emp.last_name?.toLowerCase().includes(searchTerm) ||
        emp.email?.toLowerCase().includes(searchTerm) ||
        emp.employee_code?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.employment_status) {
      filtered = filtered.filter(emp => emp.employment_status === filters.employment_status);
    }

    // Apply type filter
    if (filters.employee_type) {
      filtered = filtered.filter(emp => emp.employee_type === filters.employee_type);
    }

    // Apply department filter
    if (filters.department_id) {
      filtered = filtered.filter(emp => emp.department_name === filters.department_id);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch (filters.sortBy) {
        case 'first_name':
          aValue = a.first_name || '';
          bValue = b.first_name || '';
          break;
        case 'hire_date':
          aValue = a.hire_date || '';
          bValue = b.hire_date || '';
          break;
        default:
          aValue = a.first_name || '';
          bValue = b.first_name || '';
      }

      if (filters.sortOrder === 'desc') {
        return bValue.localeCompare(aValue);
      }
      return aValue.localeCompare(bValue);
    });

    // Apply pagination
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedEmployees = filtered.slice(startIndex, endIndex);

    // Update employees and pagination
    setEmployees(paginatedEmployees);
    setPagination({
      currentPage: filters.page,
      totalPages: Math.ceil(filtered.length / filters.limit),
      totalRecords: filtered.length,
      recordsPerPage: filters.limit
    });
  }, [allEmployees, filters]);

  // Load stats from all employees
  const loadStats = useCallback(async () => {
    if (allEmployees.length > 0) {
      const calculatedStats = {
        total: allEmployees.length,
        active: allEmployees.filter(emp => emp.employment_status === 'active').length,
        inactive: allEmployees.filter(emp => emp.employment_status === 'inactive').length,
        terminated: allEmployees.filter(emp => emp.employment_status === 'terminated').length,
        resigned: allEmployees.filter(emp => emp.employment_status === 'resigned').length,
        permanent: allEmployees.filter(emp => emp.employee_type === 'permanent').length,
        contract: allEmployees.filter(emp => emp.employee_type === 'contract').length,
        intern: allEmployees.filter(emp => emp.employee_type === 'intern').length,
        consultant: allEmployees.filter(emp => emp.employee_type === 'consultant').length,
        by_department: []
      };
      setStats(calculatedStats);
    }
  }, [allEmployees]);

  // Load data when filters change (but debounce search)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load all employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Filter employees when allEmployees or filters change
  useEffect(() => {
    if (allEmployees.length > 0) {
      filterEmployees();
    }
  }, [allEmployees, filterEmployees]);

  // Load stats after employees are loaded
  useEffect(() => {
    loadStats();
  }, [allEmployees, loadStats]);

  // FIXED: Handle filter changes without causing re-renders
  const updateFilter = (key: keyof EmployeeFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when filters change
    }));
  };

  // NEW: Handle status card clicks for filtering
  const handleStatusCardClick = (status: string) => {
    if (filters.employment_status === status) {
      // If already filtered by this status, clear the filter
      updateFilter('employment_status', '');
    } else {
      // Filter by this status
      updateFilter('employment_status', status);
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    updateFilter('page', page);
  };

  // Handle employee selection
  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
    setSelectAll(!selectAll);
  };

  // Navigation handler
  const handleRowClick = (empId: string, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || 
        target.closest('.dropdown-trigger') || 
        target.closest('button')) {
      return;
    }
    navigate(`/employee/${empId}`);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      search: '',
      department_id: '',
      employment_status: '',
      employee_type: '',
      sortBy: 'first_name',
      sortOrder: 'asc'
    });
  };

  // Status and type badge styling
  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: 'success',
      inactive: 'warning',
      terminated: 'failure',
      resigned: 'gray'
    };
    return statusColors[status as keyof typeof statusColors] || 'gray';
  };

  const getTypeBadge = (type: string) => {
    const typeColors = {
      permanent: 'success',
      contract: 'warning',
      intern: 'info',
      consultant: 'purple'
    };
    return typeColors[type as keyof typeof typeColors] || 'gray';
  };

  // Format employment status for display
  const formatEmploymentStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Format employee type for display
  const formatEmployeeType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Check if filters are active
  const hasActiveFilters = filters.search || filters.employment_status || 
                          filters.employee_type || filters.department_id;

  // Export handlers
  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await apiService.exportEmployees(format, filters);
      if (response.success) {
        // Handle file download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `employees.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setShowExportModal(false);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Delete handlers (terminate instead of delete)
  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    
    try {
      // Instead of deleting, update status to terminated
      const response = await apiService.updateEmployee(employeeToDelete, {
        employment_status: 'terminated'
      });
      
      if (response.success) {
        // Remove from current view immediately
        setAllEmployees(prev => prev.map(emp => 
          emp.id === employeeToDelete 
            ? { ...emp, employment_status: 'terminated' as any }
            : emp
        ));
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
      }
    } catch (err) {
      console.error('Failed to terminate employee:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) return;
    
    try {
      setShowBulkProgress(true);
      setBulkOperationProgress(0);
      
      // Terminate employees in batches
      const batchSize = 5;
      let completed = 0;
      
      for (let i = 0; i < selectedEmployees.length; i += batchSize) {
        const batch = selectedEmployees.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (empId) => {
          try {
            await apiService.updateEmployee(empId, {
              employment_status: 'terminated'
            });
            completed++;
            setBulkOperationProgress((completed / selectedEmployees.length) * 100);
          } catch (err) {
            console.error(`Failed to terminate employee ${empId}:`, err);
          }
        }));
      }
      
      // Update local state
      setAllEmployees(prev => prev.map(emp => 
        selectedEmployees.includes(emp.id) 
          ? { ...emp, employment_status: 'terminated' as any }
          : emp
      ));
      
      setSelectedEmployees([]);
      setSelectAll(false);
      setShowBulkDeleteModal(false);
      setShowBulkProgress(false);
      setBulkOperationProgress(0);
      
    } catch (err) {
      console.error('Bulk termination failed:', err);
      setShowBulkProgress(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              All Employees
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your organization's employee directory
            </p>
          </div>
          
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button
              color="gray"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                loadEmployees();
              }}
              disabled={loading || refreshing}
            >
              <HiOutlineRefresh className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            
            <DynamicProtectedComponent permission="employees.create">
              <Button
                color="blue"
                size="sm"
                onClick={() => navigate('/add-employee')}
              >
                <HiOutlinePlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DynamicProtectedComponent>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedEmployees.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2">
                <DynamicProtectedComponent permission="employees.delete">
                  <Button
                    size="xs"
                    color="failure"
                    onClick={() => setShowBulkDeleteModal(true)}
                  >
                    <HiOutlineTrash className="mr-1 h-3 w-3" />
                    Terminate Selected
                  </Button>
                </DynamicProtectedComponent>
                <Button
                  size="xs"
                  color="gray"
                  onClick={() => {
                    setSelectedEmployees([]);
                    setSelectAll(false);
                  }}
                >
                  <HiOutlineX className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      {/* Employee Statistics - Enhanced with Clickable Cards */}
      {stats && (
        <DynamicProtectedComponent permission="employees.view">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {/* Total Employees Card */}
            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                !filters.employment_status 
                  ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500' 
                  : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
              }`}
              onClick={() => handleStatusCardClick('')}
            >
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Total</h3>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.total}</p>
              {!filters.employment_status && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Showing all employees
                </div>
              )}
            </div>

            {/* Active Employees Card */}
            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                filters.employment_status === 'active' 
                  ? 'bg-green-100 dark:bg-green-900/40 ring-2 ring-green-500' 
                  : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
              }`}
              onClick={() => handleStatusCardClick('active')}
            >
              <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Active</h3>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.active}</p>
              {filters.employment_status === 'active' && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Click to clear filter
                </div>
              )}
            </div>

            {/* Inactive Employees Card */}
            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                filters.employment_status === 'inactive' 
                  ? 'bg-yellow-100 dark:bg-yellow-900/40 ring-2 ring-yellow-500' 
                  : 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
              }`}
              onClick={() => handleStatusCardClick('inactive')}
            >
              <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Inactive</h3>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{stats.inactive}</p>
              {filters.employment_status === 'inactive' && (
                <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                  Click to clear filter
                </div>
              )}
            </div>

            {/* Terminated Employees Card */}
            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                filters.employment_status === 'terminated' 
                  ? 'bg-red-100 dark:bg-red-900/40 ring-2 ring-red-500' 
                  : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
              }`}
              onClick={() => handleStatusCardClick('terminated')}
            >
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Terminated</h3>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">{stats.terminated}</p>
              {filters.employment_status === 'terminated' && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Click to clear filter
                </div>
              )}
            </div>

            {/* Resigned Employees Card */}
            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                filters.employment_status === 'resigned' 
                  ? 'bg-gray-100 dark:bg-gray-700 ring-2 ring-gray-500' 
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => handleStatusCardClick('resigned')}
            >
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Resigned</h3>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.resigned}</p>
              {filters.employment_status === 'resigned' && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Click to clear filter
                </div>
              )}
            </div>
          </div>

          {/* Filter Indicator */}
          {filters.employment_status && (
            <div className="mb-4 flex items-center gap-2">
              <Badge color="info" size="sm">
                Filtered by: {formatEmploymentStatus(filters.employment_status)}
              </Badge>
              <Button
                size="xs"
                color="gray"
                onClick={() => handleStatusCardClick('')}
              >
                <HiOutlineX className="h-3 w-3" />
              </Button>
            </div>
          )}
        </DynamicProtectedComponent>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* FIXED: Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <HiOutlineSearch className="w-4 h-4 text-gray-500" />
          </div>
          <TextInput
            type="text"
            placeholder="Search employees by name, email, or ID..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          {/* Status Filter */}
          <Dropdown
            label={filters.employment_status ? formatEmploymentStatus(filters.employment_status) : "All Status"}
            dismissOnClick={true}
            size="sm"
          >
            <Dropdown.Item onClick={() => updateFilter('employment_status', '')}>
              All Status
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employment_status', 'active')}>
              Active
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employment_status', 'inactive')}>
              Inactive
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employment_status', 'terminated')}>
              Terminated
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employment_status', 'resigned')}>
              Resigned
            </Dropdown.Item>
          </Dropdown>
          
          {/* Type Filter */}
          <Dropdown
            label={filters.employee_type ? formatEmployeeType(filters.employee_type) : "All Types"}
            dismissOnClick={true}
            size="sm"
          >
            <Dropdown.Item onClick={() => updateFilter('employee_type', '')}>
              All Types
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employee_type', 'permanent')}>
              Permanent
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employee_type', 'contract')}>
              Contract
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employee_type', 'intern')}>
              Intern
            </Dropdown.Item>
            <Dropdown.Item onClick={() => updateFilter('employee_type', 'consultant')}>
              Consultant
            </Dropdown.Item>
          </Dropdown>
          
          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              size="sm"
              color="gray"
              onClick={clearFilters}
            >
              <HiOutlineX className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
          
          {/* Export */}
          {/* <Button
            size="sm"
            color="gray"
            onClick={() => setShowExportModal(true)}
          >
            <HiOutlineDownload className="mr-1 h-4 w-4" />
            Export
          </Button> */}
        </div>
      </div>

      {/* Employee Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading employees...</span>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className="w-12">
                  <Checkbox
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </Table.HeadCell>
                <Table.HeadCell>Employee</Table.HeadCell>
                <Table.HeadCell>Department</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Type</Table.HeadCell>
                <Table.HeadCell>Base Salary</Table.HeadCell>
                <Table.HeadCell>Hire Date</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {employees.length > 0 ? (
                  employees.map((employee) => (
                    <Table.Row 
                      key={employee.id}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                      onClick={(e) => handleRowClick(employee.id, e)}
                    >
                      <Table.Cell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => handleEmployeeSelect(employee.id)}
                        />
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {employee.email}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              ID: {employee.employee_code}
                            </div>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {employee.department_name || 'Not Assigned'}
                        </div>
                        {employee.designation_title && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {employee.designation_title}
                          </div>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge 
                          color={getStatusBadge(employee.employment_status)}
                          size="sm"
                        >
                          {formatEmploymentStatus(employee.employment_status)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge 
                          color={getTypeBadge(employee.employee_type)}
                          size="sm"
                        >
                          {formatEmployeeType(employee.employee_type)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {employee.base_salary ? employee.base_salary.toLocaleString() : 'Not Set'}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {new Date(employee.hire_date).toLocaleDateString()}
                        </div>
                        {employee.years_of_service && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {employee.years_of_service} years
                          </div>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))
                ) : (
                  <Table.Row>
                    <Table.Cell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center">
                        <HiOutlineUsers className="h-12 w-12 text-gray-300 mb-4" />
                        <p className="text-lg text-gray-500 dark:text-gray-400">No employees found</p>
                        <p className="text-sm text-gray-400">
                          {hasActiveFilters 
                            ? 'Try adjusting your filters or search terms'
                            : 'Get started by adding your first employee'
                          }
                        </p>
                        {!hasActiveFilters && (
                          <DynamicProtectedComponent permission="employees.create">
                            <Button
                              color="blue"
                              size="sm"
                              className="mt-4"
                              onClick={() => navigate('/employees/add')}
                            >
                              <HiOutlinePlus className="mr-2 h-4 w-4" />
                              Add First Employee
                            </Button>
                          </DynamicProtectedComponent>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.currentPage - 1) * pagination.recordsPerPage + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.totalRecords}</span>{' '}
                  results
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  color="gray"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  Previous
                </Button>
                
                {/* Page Numbers */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(page => 
                    page === 1 || 
                    page === pagination.totalPages || 
                    Math.abs(page - pagination.currentPage) <= 2
                  )
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="text-gray-500">...</span>
                      )}
                      <Button
                        size="sm"
                        color={pagination.currentPage === page ? "blue" : "gray"}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    </React.Fragment>
                  ))
                }
                
                <Button
                  size="sm"
                  color="gray"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <Modal.Header>Confirm Employee Termination</Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to terminate this employee? This will change their status to "Terminated" and remove them from the active employee list.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button color="failure" onClick={handleDeleteEmployee}>
            Terminate
          </Button>
          <Button color="gray" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Terminate Modal */}
      <Modal show={showBulkDeleteModal} onClose={() => setShowBulkDeleteModal(false)}>
        <Modal.Header>Confirm Bulk Termination</Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to terminate {selectedEmployees.length} selected employees? This will change their status to "Terminated" and remove them from the active employee list.</p>
          {showBulkProgress && (
            <div className="mt-4">
              <Progress progress={bulkOperationProgress} />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="failure" onClick={handleBulkDelete} disabled={showBulkProgress}>
            Terminate All
          </Button>
          <Button color="gray" onClick={() => setShowBulkDeleteModal(false)} disabled={showBulkProgress}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Export Modal */}
      <Modal show={showExportModal} onClose={() => setShowExportModal(false)}>
        <Modal.Header>Export Employees</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              The export will include all employees matching your current filters.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                color="gray" 
                onClick={() => handleExport('csv')}
                className="flex flex-col items-center p-6"
              >
                <HiOutlineDownload className="w-8 h-8 mb-2" />
                <span>Export as CSV</span>
                <small className="text-gray-500">Comma-separated values</small>
              </Button>
              
              <Button 
                color="gray" 
                onClick={() => handleExport('excel')}
                className="flex flex-col items-center p-6"
              >
                <HiOutlineDownload className="w-8 h-8 mb-2" />
                <span>Export as Excel</span>
                <small className="text-gray-500">Microsoft Excel format</small>
              </Button>
            </div>
            
            {hasActiveFilters && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Export will include only employees matching your current filters.
                </p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowExportModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AllEmployees;