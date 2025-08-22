// components/Payroll/Payroll.tsx

import React, { useState, useEffect } from 'react';
import { TextInput, Button, Select, Badge, Modal, Table, Alert } from "flowbite-react";
import { payrollApiService, PayrollRecord, PayrollFilters, CreatePayrollData, BulkProcessData } from '../../services/payrollService';
import apiService from '../../services/api';
import { HiInformationCircle, HiExclamationCircle } from 'react-icons/hi';

const PayrollDashboard = () => {
  // State Management
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Data States
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [summary, setSummary] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(10);
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAdditionsModal, setShowAdditionsModal] = useState<boolean>(false);
  const [showDeductionsModal, setShowDeductionsModal] = useState<boolean>(false);
  const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
  const [showBulkProcessModal, setShowBulkProcessModal] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  // New Payroll Form State
  const [newPayrollData, setNewPayrollData] = useState<CreatePayrollData>({
    employee_id: '',
    pay_period_start: '',
    pay_period_end: '',
    base_salary: 0,
    allowances: 0,
    overtime_amount: 0,
    bonus: 0,
    commission: 0,
    tax_deduction: 0,
    provident_fund: 0,
    insurance: 0,
    loan_deduction: 0,
    other_deductions: 0,
    payment_method: 'bank_transfer',
    notes: ''
  });

  // Bulk Process Form State
  const [bulkProcessData, setBulkProcessData] = useState<BulkProcessData>({
    pay_period_start: '',
    pay_period_end: '',
    auto_calculate_overtime: true,
    default_allowances: 0,
    default_bonus: 0,
    tax_rate: 0.15,
    provident_fund_rate: 0.08,
    insurance_amount: 0
  });

  // Fetch payroll records
  const fetchPayrollRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [year, month] = selectedMonth.split('-');
      const filters: PayrollFilters = {
        month: parseInt(month),
        year: parseInt(year),
        status: filterStatus as any,
        department_id: filterDepartment || undefined,
        limit: recordsPerPage,
        offset: (currentPage - 1) * recordsPerPage,
        sort_by: sortBy,
        sort_order: sortOrder
      };

      // Apply search filter if exists
      if (searchTerm) {
        // Since backend doesn't have direct search, we'll fetch all and filter client-side
        // Or you can add search functionality to your backend
      }
      
      console.log('Fetching payroll with filters:', filters);
      const response = await payrollApiService.getPayrollRecords(filters);
    

      if (response.success && response.data) {
        
        
          console.log('API Response:', response);

        setPayrollRecords(response.data.data);
        setTotalRecords(response.data.pagination?.total || 0);
        setSummary(response.data.summary || null);
      }
      else {
      console.warn('Invalid payroll response:', response); // Debug log
      setPayrollRecords([]);
      setTotalRecords(0);
      setSummary(null);
      setError('No payroll records found or invalid response');
    }

    } catch (err: any) {
    console.error('Error fetching payroll:', err);
    setError(err.message || 'Failed to fetch payroll records');
    setPayrollRecords([]);
    setTotalRecords(0);
    setSummary(null);
  } finally {
    setLoading(false);
  }
};

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await apiService.getDepartments();
      console.log('Departments API Response:', response);
      if (response.success && response.data) {
        setDepartments(response.data.departments);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      const response = await apiService.getEmployees({ limit: 1000 });
      if (response.success && response.data) {
        setEmployees(response.data.employees);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchPayrollRecords();
    fetchDepartments();
    fetchEmployees();
  }, [selectedMonth, filterStatus, filterDepartment, currentPage, recordsPerPage, sortBy, sortOrder]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return payrollApiService.formatCurrency(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return payrollApiService.formatDate(dateString);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const color = payrollApiService.getPaymentStatusColor(status);
    return <Badge color={color} size="sm">{status.toUpperCase()}</Badge>;
  };

  // Toggle payment status
  const togglePaymentStatus = async (record: PayrollRecord) => {
    try {
      const newStatus = record.payment.status === 'paid' ? 'pending' : 'paid';
      const paymentDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined;
      
      await payrollApiService.updatePaymentStatus(record.id, newStatus, paymentDate);
      setSuccessMessage('Payment status updated successfully');
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment status');
    }
  };

  // Create new payroll record
  const handleCreatePayroll = async () => {
    try {
      setLoading(true);
      
      // Calculate gross and net salary
      const grossSalary = newPayrollData.base_salary + 
                         (newPayrollData.allowances || 0) + 
                         (newPayrollData.overtime_amount || 0) + 
                         (newPayrollData.bonus || 0) + 
                         (newPayrollData.commission || 0);
      
      const totalDeductions = (newPayrollData.tax_deduction || 0) + 
                             (newPayrollData.provident_fund || 0) + 
                             (newPayrollData.insurance || 0) + 
                             (newPayrollData.loan_deduction || 0) + 
                             (newPayrollData.other_deductions || 0);

      await payrollApiService.createPayroll(newPayrollData);
      setSuccessMessage('Payroll record created successfully');
      setShowAddModal(false);
      resetNewPayrollForm();
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to create payroll record');
    } finally {
      setLoading(false);
    }
  };

  // Update payroll record
  const handleUpdatePayroll = async () => {
    if (!editingRecord) return;
    
    try {
      setLoading(true);
      
      const updateData = {
        base_salary: editingRecord.earnings.baseSalary,
        allowances: editingRecord.earnings.allowances,
        overtime_amount: editingRecord.earnings.overtime,
        bonus: editingRecord.earnings.bonus,
        commission: editingRecord.earnings.commission,
        tax_deduction: editingRecord.deductions.tax,
        provident_fund: editingRecord.deductions.providentFund,
        insurance: editingRecord.deductions.insurance,
        loan_deduction: editingRecord.deductions.loan,
        other_deductions: editingRecord.deductions.other,
        payment_method: editingRecord.payment.method,
        notes: editingRecord.notes
      };

      await payrollApiService.updatePayroll(editingRecord.id, updateData);
      setSuccessMessage('Payroll record updated successfully');
      setIsEditing(false);
      setEditingRecord(null);
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to update payroll record');
    } finally {
      setLoading(false);
    }
  };

  // Delete payroll record
  const handleDeletePayroll = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payroll record?')) return;
    
    try {
      await payrollApiService.deletePayroll(id);
      setSuccessMessage('Payroll record deleted successfully');
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to delete payroll record');
    }
  };

  // Bulk process payroll
  const handleBulkProcess = async () => {
    try {
      setLoading(true);
      
      const response = await payrollApiService.bulkProcess(bulkProcessData);
      
      if (response.success) {
        setSuccessMessage(`Successfully processed ${response.data?.processed?.length || 0} payroll records`);
        setShowBulkProcessModal(false);
        fetchPayrollRecords();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process bulk payroll');
    } finally {
      setLoading(false);
    }
  };

  // Export payroll data
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const [year, month] = selectedMonth.split('-');
      const filters: PayrollFilters = {
        month: parseInt(month),
        year: parseInt(year),
        status: filterStatus as any,
        department_id: filterDepartment || undefined
      };

      await payrollApiService.exportPayroll(format, filters);
      
      if (format === 'csv') {
        setSuccessMessage('Payroll data exported successfully');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export payroll data');
    }
  };

  // Generate and show payslip
  const showPayslip = async (record: PayrollRecord) => {
    try {
      const response = await payrollApiService.getPayslip(record.id);
      if (response.success && response.data) {
        setSelectedRecord(record);
        setShowPayslipModal(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate payslip');
    }
  };

  // Reset new payroll form
  const resetNewPayrollForm = () => {
    setNewPayrollData({
      employee_id: '',
      pay_period_start: '',
      pay_period_end: '',
      base_salary: 0,
      allowances: 0,
      overtime_amount: 0,
      bonus: 0,
      commission: 0,
      tax_deduction: 0,
      provident_fund: 0,
      insurance: 0,
      loan_deduction: 0,
      other_deductions: 0,
      payment_method: 'bank_transfer',
      notes: ''
    });
  };

  // Calculate totals for display
  const totalGrossSalary = summary?.totalGross || 0;
  const totalNetSalary = summary?.totalNet || 0;
  const totalDeductions = summary?.totalDeductions || 0;

  // Pagination
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  console.log("totalPages",totalPages)

  // Filter records client-side for search
  const filteredRecords = (payrollRecords || []).filter((record) => {
  if (!searchTerm) return true;
  const searchLower = searchTerm.toLowerCase();
  return record.name.toLowerCase().includes(searchLower) ||
         record.employeeCode.toLowerCase().includes(searchLower) ||
         record.email.toLowerCase().includes(searchLower) ||
         record.department.toLowerCase().includes(searchLower) ||
         record.designation.toLowerCase().includes(searchLower);
});

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
      {/* Error and Success Alerts */}
      {error && (
        <Alert color="failure" icon={HiExclamationCircle} className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert color="success" icon={HiInformationCircle} className="mb-4" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h5 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll Management</h5>
          <p className="text-gray-600 dark:text-gray-400">Employee salary and payment tracking</p>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-300">Total Gross</p>
            <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{formatCurrency(totalGrossSalary)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-300">Total Net</p>
            <p className="text-lg font-bold text-green-800 dark:text-green-200">{formatCurrency(totalNetSalary)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-300">Total Deductions</p>
            <p className="text-lg font-bold text-red-800 dark:text-red-200">{formatCurrency(totalDeductions)}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        {/* Filters and Controls */}
        <div className="flex flex-col gap-4 mb-6">
          {/* First row - Search and Month */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <TextInput
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full"
              >
                {/* Generate last 12 months */}
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                  return <option key={value} value={value}>{label}</option>;
                })}
              </Select>
            </div>
          </div>
          
          {/* Second row - Filters and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </Select>
            </div>
            
            <div>
              <Select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full"
              >
                <option value="">All Departments</option>
                {Array.isArray(departments) && departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </Select>
            </div>
            
            <div>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full"
              >
                <option value="created_at">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="net_salary">Sort by Salary</option>
                <option value="department">Sort by Department</option>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button color="blue" size="sm" onClick={() => handleExport('csv')}>
                📊 Export CSV
              </Button>
              <Button color="purple" size="sm" onClick={() => setShowBulkProcessModal(true)}>
                ⚡ Bulk Process
              </Button>
              <Button color="green" size="sm" onClick={() => setShowAddModal(true)}>
                ➕ Add
              </Button>
            </div>
          </div>
        </div>

        {/* Payroll Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-3">Employee</th>
                  <th scope="col" className="px-3 py-3">Department</th>
                  <th scope="col" className="px-3 py-3 text-right">Base Salary</th>
                  <th scope="col" className="px-3 py-3 text-right">Additions</th>
                  <th scope="col" className="px-3 py-3 text-right">Gross Salary</th>
                  <th scope="col" className="px-3 py-3 text-right">Deductions</th>
                  <th scope="col" className="px-3 py-3 text-right">Net Salary</th>
                  <th scope="col" className="px-3 py-3 text-right">Earned Till Date</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Payment Date</th>
                  <th scope="col" className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-gray-500">
                      No payroll records found for the selected period
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const totalAdditions = record.earnings.allowances + record.earnings.overtime + record.earnings.bonus + record.earnings.commission;
                    const earnedTillDate = payrollApiService.calculateEarnedTillDate(
                      record.summary.netSalary,
                      record.payPeriod.start,
                      record.payPeriod.end
                    );

                    return (
                      <tr key={record.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                        <td className="px-3 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm">
                              {record.name.charAt(0)}
                            </div>
                            <div className="ml-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{record.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{record.employeeCode}</div>
                              <div className="text-xs text-gray-400">{record.designation}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">{record.department}</div>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(record.earnings.baseSalary)}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" 
                            onClick={() => { setSelectedRecord(record); setShowAdditionsModal(true); }}>
                          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(totalAdditions)}
                          </div>
                          <div className="text-xs text-gray-400">Click for details</div>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(record.summary.grossSalary)}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => { setSelectedRecord(record); setShowDeductionsModal(true); }}>
                          <div className="text-sm text-red-600 dark:text-red-400">
                            {formatCurrency(record.summary.totalDeductions)}
                          </div>
                          <div className="text-xs text-gray-400">Click for details</div>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="text-sm font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(record.summary.netSalary)}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            {formatCurrency(earnedTillDate)}
                          </div>
                          <div className="text-xs text-gray-400">Until today</div>
                        </td>
                        <td className="px-3 py-4">
                          <div onClick={() => togglePaymentStatus(record)} className="cursor-pointer">
                            {getStatusBadge(record.payment.status)}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatDate(record.payment.date)}
                          </div>
                          <div className="text-xs text-gray-400">{record.payment.method.replace('_', ' ')}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-1">
                            <Button size="xs" color="blue" onClick={() => showPayslip(record)}>View</Button>
                            <Button size="xs" color="gray" onClick={() => { setEditingRecord(record); setIsEditing(true); }}>Edit</Button>
                            <Button size="xs" color="red" onClick={() => handleDeletePayroll(record.id)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Showing</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => setRecordsPerPage(parseInt(e.target.value))}
              className="w-20"
              sizing="sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </Select>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              out of {totalRecords} records
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              size="sm"
              color="gray"
            >
              Previous
            </Button>
            
            {[...Array(Math.min(totalPages, 5))].map((_, index) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = index + 1;
              } else if (currentPage <= 3) {
                pageNumber = index + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + index;
              } else {
                pageNumber = currentPage - 2 + index;
              }
              
              return (
                <Button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  size="sm"
                  color={currentPage === pageNumber ? 'blue' : 'gray'}
                  className="min-w-[2.5rem]"
                >
                  {pageNumber}
                </Button>
              );
            })}
            
            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              size="sm"
              color="gray"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Add Payroll Modal */}
      <Modal show={showAddModal} onClose={() => { setShowAddModal(false); resetNewPayrollForm(); }} size="4xl">
        <Modal.Header>Create New Payroll Record</Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Basic Information</h4>
              <div>
                <label className="block text-sm font-medium mb-1">Employee</label>
                <Select
                  value={newPayrollData.employee_id}
                  onChange={(e) => {
                    const emp = employees.find(e => e.id === e.target.value);
                    setNewPayrollData({
                      ...newPayrollData,
                      employee_id: e.target.value,
                      base_salary: emp?.base_salary || 0
                    });
                  }}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.employee_code}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Period Start</label>
                  <TextInput
                    type="date"
                    value={newPayrollData.pay_period_start}
                    onChange={(e) => setNewPayrollData({...newPayrollData, pay_period_start: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Period End</label>
                  <TextInput
                    type="date"
                    value={newPayrollData.pay_period_end}
                    onChange={(e) => setNewPayrollData({...newPayrollData, pay_period_end: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Base Salary</label>
                <TextInput
                  type="number"
                  value={newPayrollData.base_salary}
                  onChange={(e) => setNewPayrollData({...newPayrollData, base_salary: Number(e.target.value)})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Allowances</label>
                <TextInput
                  type="number"
                  value={newPayrollData.allowances}
                  onChange={(e) => setNewPayrollData({...newPayrollData, allowances: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Overtime</label>
                <TextInput
                  type="number"
                  value={newPayrollData.overtime_amount}
                  onChange={(e) => setNewPayrollData({...newPayrollData, overtime_amount: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bonus</label>
                <TextInput
                  type="number"
                  value={newPayrollData.bonus}
                  onChange={(e) => setNewPayrollData({...newPayrollData, bonus: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Deductions</h4>
              <div>
                <label className="block text-sm font-medium mb-1">Tax Deduction</label>
                <TextInput
                  type="number"
                  value={newPayrollData.tax_deduction}
                  onChange={(e) => setNewPayrollData({...newPayrollData, tax_deduction: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Provident Fund</label>
                <TextInput
                  type="number"
                  value={newPayrollData.provident_fund}
                  onChange={(e) => setNewPayrollData({...newPayrollData, provident_fund: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Insurance</label>
                <TextInput
                  type="number"
                  value={newPayrollData.insurance}
                  onChange={(e) => setNewPayrollData({...newPayrollData, insurance: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Deduction</label>
                <TextInput
                  type="number"
                  value={newPayrollData.loan_deduction}
                  onChange={(e) => setNewPayrollData({...newPayrollData, loan_deduction: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Other Deductions</label>
                <TextInput
                  type="number"
                  value={newPayrollData.other_deductions}
                  onChange={(e) => setNewPayrollData({...newPayrollData, other_deductions: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <Select
                  value={newPayrollData.payment_method}
                  onChange={(e) => setNewPayrollData({...newPayrollData, payment_method: e.target.value as any})}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <TextInput
                  type="text"
                  value={newPayrollData.notes || ''}
                  onChange={(e) => setNewPayrollData({...newPayrollData, notes: e.target.value})}
                />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => { setShowAddModal(false); resetNewPayrollForm(); }}>Cancel</Button>
          <Button color="blue" onClick={handleCreatePayroll} disabled={loading}>Create Payroll</Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Process Modal */}
      <Modal show={showBulkProcessModal} onClose={() => setShowBulkProcessModal(false)} size="2xl">
        <Modal.Header>Bulk Process Payroll</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Period Start</label>
                <TextInput
                  type="date"
                  value={bulkProcessData.pay_period_start}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, pay_period_start: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period End</label>
                <TextInput
                  type="date"
                  value={bulkProcessData.pay_period_end}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, pay_period_end: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Department (Optional)</label>
              <Select
                value={bulkProcessData.department_id || ''}
                onChange={(e) => setBulkProcessData({...bulkProcessData, department_id: e.target.value})}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bulkProcessData.auto_calculate_overtime}
                onChange={(e) => setBulkProcessData({...bulkProcessData, auto_calculate_overtime: e.target.checked})}
                className="rounded"
              />
              <label className="text-sm">Auto-calculate overtime from attendance</label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Default Allowances</label>
                <TextInput
                  type="number"
                  value={bulkProcessData.default_allowances}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, default_allowances: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default Bonus</label>
                <TextInput
                  type="number"
                  value={bulkProcessData.default_bonus}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, default_bonus: Number(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                <TextInput
                  type="number"
                  step="0.01"
                  value={bulkProcessData.tax_rate * 100}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, tax_rate: Number(e.target.value) / 100})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PF Rate (%)</label>
                <TextInput
                  type="number"
                  step="0.01"
                  value={bulkProcessData.provident_fund_rate * 100}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, provident_fund_rate: Number(e.target.value) / 100})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Insurance Amount</label>
                <TextInput
                  type="number"
                  value={bulkProcessData.insurance_amount}
                  onChange={(e) => setBulkProcessData({...bulkProcessData, insurance_amount: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowBulkProcessModal(false)}>Cancel</Button>
          <Button color="blue" onClick={handleBulkProcess} disabled={loading}>Process Payroll</Button>
        </Modal.Footer>
      </Modal>

      {/* Additions Modal */}
      <Modal show={showAdditionsModal} onClose={() => setShowAdditionsModal(false)}>
        <Modal.Header>Salary Additions - {selectedRecord?.name}</Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Allowances:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.earnings.allowances)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Overtime:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.earnings.overtime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Bonus:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.earnings.bonus)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Commission:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.earnings.commission)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Additions:</span>
                <span className="text-green-600">
                  {formatCurrency(selectedRecord.earnings.allowances + selectedRecord.earnings.overtime + selectedRecord.earnings.bonus + selectedRecord.earnings.commission)}
                </span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowAdditionsModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Deductions Modal */}
      <Modal show={showDeductionsModal} onClose={() => setShowDeductionsModal(false)}>
        <Modal.Header>Salary Deductions - {selectedRecord?.name}</Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Tax Deduction:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.deductions.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Provident Fund:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.deductions.providentFund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Insurance:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.deductions.insurance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Loan Deduction:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.deductions.loan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Other Deductions:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.deductions.other)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Deductions:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.summary.totalDeductions)}</span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowDeductionsModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PayrollDashboard;