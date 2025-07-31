// AllEmployees.tsx - Corrected with proper employment_status and employee_type values

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
  HiOutlineDotsVertical, 
  HiOutlineEye, 
  HiOutlinePencil, 
  HiOutlineTrash,
  HiOutlineFilter,
  HiOutlineDownload,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineX
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
  const [employees, setEmployees] = useState<Employee[]>([]);
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
  
  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 10
  });
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Bulk operation states
  const [bulkOperationProgress, setBulkOperationProgress] = useState(0);
  const [showBulkProgress, setShowBulkProgress] = useState(false);

  // Reference lists
  const [departments, setDepartments] = useState<string[]>([]);

  // Load employees from backend (exclude terminated and resigned by default)
  const loadEmployees = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);
      setError(null);
      
      // Always exclude terminated and resigned employees from the table
      const adjustedFilters = {
        ...filters,
        exclude_terminated_resigned: true
      };
      
      console.log('🔄 Loading employees with filters:', adjustedFilters);
      
      const response = await apiService.getEmployees(adjustedFilters);
      
      if (response.success && response.data) {
        const data = response.data as EmployeesResponse;
        console.log('📊 Employees data:', data.employees);

      // Filter out terminated employees
      const activeEmployees = data.employees.filter(
        (emp) => emp.employment_status !== 'terminated'
      );

        setEmployees(activeEmployees);
        setPagination({
          currentPage: data.page,
          totalPages: data.totalPages,
          totalRecords: data.total,
          recordsPerPage: data.limit
        });
        
       
        // Extract unique departments
        const uniqueDepts = [...new Set(data.employees
          .map(emp => emp.department_name)
          .filter(dept => dept)
        )];
        setDepartments(uniqueDepts);
        
        console.log('✅ Employees loaded:', data.employees.length);
      } else {
        setError(response.message || 'Failed to load employees');
      }
    } catch (err: any) {
      console.error('❌ Failed to load employees:', err);
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  // Load employee statistics
  const loadStats = useCallback(async () => {
    try {
      const response = await apiService.getEmployeeStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.warn('Failed to load employee stats:', err);
      // Calculate stats from current employee data instead
      if (employees.length > 0) {
        const calculatedStats = {
          total: employees.length,
          active: employees.filter(emp => emp.employment_status === 'active').length,
          inactive: employees.filter(emp => emp.employment_status === 'inactive').length,
          terminated: employees.filter(emp => emp.employment_status === 'terminated').length,
          resigned: employees.filter(emp => emp.employment_status === 'resigned').length,
          permanent: employees.filter(emp => emp.employee_type === 'permanent').length,
          contract: employees.filter(emp => emp.employee_type === 'contract').length,
          intern: employees.filter(emp => emp.employee_type === 'intern').length,
          consultant: employees.filter(emp => emp.employee_type === 'consultant').length,
          by_department: []
        };
        setStats(calculatedStats);
      }
    }
  }, [employees]);

  // Load data on mount and filter changes
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Load stats after employees are loaded
  useEffect(() => {
    if (employees.length > 0) {
      loadStats();
    }
  }, [employees, loadStats]);

  // Handle filter changes
  const updateFilter = (key: keyof EmployeeFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when filters change
    }));
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
        setEmployees(prev => prev.filter(emp => emp.id !== employeeToDelete));
        
        // Update stats
        await loadStats();
        
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
        
        // Show success message (optional)
        console.log('✅ Employee terminated successfully');
      } else {
        setError(response.message || 'Failed to terminate employee');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to terminate employee');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) return;
    
    try {
      setShowBulkProgress(true);
      setBulkOperationProgress(0);
      

      console.log("1111",selectedEmployees)
      // Bulk update to terminated status instead of delete
      const updates = selectedEmployees.map(id => ({
        id,
        data: { employment_status: 'terminated' as const }
      }));
      
      const response = await apiService.bulkDeleteEmployees(selectedEmployees);
      
      if (response.success) {
        setBulkOperationProgress(100);
        setTimeout(() => {
          // Remove terminated employees from current view
          setEmployees(prev => prev.filter(emp => !selectedEmployees.includes(emp.id)));
          
          setShowBulkDeleteModal(false);
          setShowBulkProgress(false);
          setSelectedEmployees([]);
          setSelectAll(false);
          
          // Update stats
          loadStats();
        }, 500);
      } else {
        setError(response.message || 'Failed to terminate employees');
        setShowBulkProgress(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to terminate employees');
      setShowBulkProgress(false);
    }
  };

  // Export handler
  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await apiService.exportEmployees(format, filters);
      if (response.success) {
        // Handle file download
        console.log('Export successful');
        setShowExportModal(false);
      } else {
        setError(response.message || 'Failed to export employees');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export employees');
    }
  };

  // Format text helpers
  const formatEmploymentStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatEmploymentType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Check if filters are applied
  const hasActiveFilters = filters.search || filters.employment_status || filters.employee_type;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Loading employees...</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-darkgray p-6 w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            All Employees
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your organization's employees
          </p>
        </div>
        
        <div className="flex gap-2">
          <Tooltip content="Refresh Data">
            <Button 
              color="gray" 
              size="sm"
              onClick={() => loadEmployees(false)}
              disabled={refreshing}
            >
              <HiOutlineRefresh className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </Tooltip>
          
          <DynamicProtectedComponent permission="employees.export">
            <Button 
              color="gray" 
              size="sm"
              onClick={() => setShowExportModal(true)}
            >
              <HiOutlineDownload className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DynamicProtectedComponent>
          
          <DynamicProtectedComponent permission="employees.create">
            <Button 
              color="purple" 
              onClick={() => navigate("/add-employee")}
            >
              <HiOutlinePlus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DynamicProtectedComponent>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="failure" className="mb-4" dismissible onDismiss={() => setError(null)}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      {/* Employee Statistics */}
      {stats && (
        <DynamicProtectedComponent permission="employees.view">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Total</h3>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.total}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Active</h3>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.active}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Inactive</h3>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{stats.inactive}</p>
            </div>
          </div>
        </DynamicProtectedComponent>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <HiOutlineSearch className="w-4 h-4 text-gray-500" />
          </div>
          <TextInput
            type="search"
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
          </Dropdown>
          
          {/* Type Filter */}
          <Dropdown
            label={filters.employee_type ? formatEmploymentType(filters.employee_type) : "All Types"}
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
            <Button color="gray" size="sm" onClick={clearFilters}>
              <HiOutlineX className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedEmployees.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-purple-800 dark:text-purple-200">
              {selectedEmployees.length} employee(s) selected
            </span>
            <div className="flex gap-2">
              <DynamicProtectedComponent permission="employees.delete">
                <Button 
                  color="failure" 
                  size="sm"
                  onClick={() => setShowBulkDeleteModal(true)}
                >
                  <HiOutlineTrash className="w-4 h-4 mr-2" />
                  Terminate Selected
                </Button>
              </DynamicProtectedComponent>
            </div>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="overflow-x-auto">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell className="p-4">
              <Checkbox
                checked={selectAll}
                onChange={handleSelectAll}
              />
            </Table.HeadCell>
            <Table.HeadCell>Employee</Table.HeadCell>
            <Table.HeadCell>Department</Table.HeadCell>
            <Table.HeadCell>Position</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Type</Table.HeadCell>
            <Table.HeadCell>Hire Date</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {employees.map((employee) => (
              <Table.Row 
                key={employee.id}
                className="bg-white dark:border-gray-700 dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={(e) => handleRowClick(employee.id, e)}
              >
                <Table.Cell className="p-4">
                  <Checkbox
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => handleEmployeeSelect(employee.id)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 dark:text-purple-300 font-medium">
                          {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
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
                  <span className="text-sm text-gray-900 dark:text-white">
                    {employee.department_name || 'Not Assigned'}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {employee.designation_title || 'Not Assigned'}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getStatusBadge(employee.employment_status)} size="sm">
                    {formatEmploymentStatus(employee.employment_status)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getTypeBadge(employee.employee_type)} size="sm">
                    {formatEmploymentType(employee.employee_type)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : 'N/A'}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} of{' '}
            {pagination.totalRecords} entries
          </div>
          <div className="flex gap-2">
            <Button
              color="gray"
              size="sm"
              disabled={pagination.currentPage === 1}
              onClick={() => handlePageChange(pagination.currentPage - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                color={page === pagination.currentPage ? "purple" : "gray"}
                size="sm"
                onClick={() => handlePageChange(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              color="gray"
              size="sm"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => handlePageChange(pagination.currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Terminate Confirmation Modal */}
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <Modal.Header>Confirm Termination</Modal.Header>
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