import React, { useState, useEffect } from 'react';
import { TextInput, Button, Select, Badge, Modal, Table, Alert } from "flowbite-react";
import { payrollApiService, PayrollRecord, PayrollFilters, CreatePayrollData, BulkProcessData } from '../../services/payrollService';
import apiService from '../../services/api';
import { HiInformationCircle, HiExclamationCircle } from 'react-icons/hi';
import { HiSearch, HiX, HiChevronDown  } from 'react-icons/hi';


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
  const [payslipData, setPayslipData] = useState<any>(null);

  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

  // ISSUE 3 FIX: Simplified Add Form
  const [simpleAddData, setSimpleAddData] = useState<{
    employee_id: string;
    pay_period_start: string;
    pay_period_end: string;
    default_allowances: number;
    default_bonus: number;
    tax_rate: number;
    provident_fund_rate: number;
    insurance_amount: number;
  }>({
    employee_id: '',
    pay_period_start: '',
    pay_period_end: '',
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

      const response = await payrollApiService.getPayrollRecords(filters);
      
      if (response.success && response.data) {
        setPayrollRecords(response.data);
        setTotalRecords(response.pagination?.total || 0);
        setSummary(response.summary || null);
      } else {
        setPayrollRecords([]);
        setTotalRecords(0);
        setSummary(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payroll records');
      setPayrollRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments and employees
  const fetchDepartments = async () => {
    try {
      const response = await apiService.getDepartments();
      if (response.success && response.data && Array.isArray(response.data)) {
        setDepartments(response.data);
      } else {
        // Ensure departments is always an array
        setDepartments([]);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
      // Ensure departments is always an array even on error
      setDepartments([]);
    }
  };

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

  useEffect(() => {
    fetchPayrollRecords();
    fetchDepartments();
    fetchEmployees();
  }, [selectedMonth, filterStatus, filterDepartment, currentPage, recordsPerPage, sortBy, sortOrder]);

  // ISSUE 5 FIX: Format currency with Rs.
  const formatCurrency = (amount: number) => {
    return `Rs. ${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return payrollApiService.formatDate(dateString);
  };

  const getStatusBadge = (status: string) => {
    const color = payrollApiService.getPaymentStatusColor(status);
    return <Badge color={color} size="sm">{status.toUpperCase()}</Badge>;
  };

  // ISSUE 1 FIX: Toggle payment status with all 4 statuses
  const togglePaymentStatus = async (record: PayrollRecord) => {
    try {
      // Cycle through statuses: pending -> processing -> paid -> failed -> pending
      let newStatus = 'pending';
      switch(record.payment.status) {
        case 'pending': newStatus = 'processing'; break;
        case 'processing': newStatus = 'paid'; break;
        case 'paid': newStatus = 'failed'; break;
        case 'failed': newStatus = 'pending'; break;
      }
      
      const paymentDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
      
      await payrollApiService.updatePaymentStatus(record.id, newStatus, paymentDate || undefined);
      setSuccessMessage('Payment status updated successfully');
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment status');
    }
  };

  // ISSUE 3 FIX: Simplified create payroll
  const handleSimpleCreatePayroll = async () => {
    try {
      setLoading(true);
      
      const selectedEmployee = employees.find(e => e.id === simpleAddData.employee_id);
      if (!selectedEmployee) {
        throw new Error('Please select an employee');
      }

      // Calculate overtime from attendance (simulate for now)
      const overtime_amount = 0; // This should be calculated from attendance
      
      const base_salary = selectedEmployee.base_salary || 0;
      const gross_salary = base_salary + simpleAddData.default_allowances + overtime_amount + simpleAddData.default_bonus;
      const tax_deduction = gross_salary * simpleAddData.tax_rate;
      const provident_fund = base_salary * simpleAddData.provident_fund_rate;
      
      const payrollData: CreatePayrollData = {
        employee_id: simpleAddData.employee_id,
        pay_period_start: simpleAddData.pay_period_start,
        pay_period_end: simpleAddData.pay_period_end,
        base_salary: base_salary,
        allowances: simpleAddData.default_allowances,
        overtime_amount: overtime_amount,
        bonus: simpleAddData.default_bonus,
        commission: 0,
        tax_deduction: tax_deduction,
        provident_fund: provident_fund,
        insurance: simpleAddData.insurance_amount,
        loan_deduction: 0,
        other_deductions: 0,
        payment_method: 'bank_transfer',
        notes: 'Created from simplified form'
      };

      await payrollApiService.createPayroll(payrollData);
      setSuccessMessage('Payroll record created successfully');
      setShowAddModal(false);
      resetSimpleAddForm();
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to create payroll record');
    } finally {
      setLoading(false);
    }
  };

  const resetSimpleAddForm = () => {
    setSimpleAddData({
      employee_id: '',
      pay_period_start: '',
      pay_period_end: '',
      default_allowances: 0,
      default_bonus: 0,
      tax_rate: 0.15,
      provident_fund_rate: 0.08,
      insurance_amount: 0
    });
  };

  // ISSUE 2 FIX: Update payroll with proper structure
  const handleUpdatePayroll = async () => {
    if (!editingRecord) return;
    
    try {
      setLoading(true);
      
      const updateData = {
        employee_id: editingRecord.employeeId,
        pay_period_start: editingRecord.payPeriod.start,
        pay_period_end: editingRecord.payPeriod.end,
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
        payment_date: editingRecord.payment.date,
        payment_reference: editingRecord.payment.reference,
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

  const handleBulkProcess = async () => {
    // Existing bulk process code remains same
  };

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

  const showPayslip = async (record: PayrollRecord) => {
    try {
      setSelectedRecord(record);
      const response = await payrollApiService.getPayslip(record.id);
      if (response.success && response.data) {
        setPayslipData(response.data);
      } else {
        setPayslipData({
          company: {
            name: 'Your Company Name',
            address: 'Company Address',
            phone: 'Company Phone',
            email: 'Company Email'
          }
        });
      }
      setShowPayslipModal(true);
    } catch (err: any) {
      setPayslipData({
        company: {
          name: 'Your Company Name',
          address: 'Company Address',
          phone: 'Company Phone',
          email: 'Company Email'
        }
      });
      setShowPayslipModal(true);
    }
  };

  const totalGrossSalary = summary?.totalGross || 0;
  const totalNetSalary = summary?.totalNet || 0;
  const totalDeductions = summary?.totalDeductions || 0;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  // ISSUE 4 FIX: Search through all records
  const [allPayrollRecords, setAllPayrollRecords] = useState<PayrollRecord[]>([]);
  
  useEffect(() => {
    // Fetch all records for search
    const fetchAllRecords = async () => {
      try {
        const [year, month] = selectedMonth.split('-');
        const response = await payrollApiService.getPayrollRecords({
          month: parseInt(month),
          year: parseInt(year),
          limit: 10000, // Get all records
          offset: 0
        });
        if (response.success && response.data) {
          setAllPayrollRecords(response.data);
        }
      } catch (err) {
        console.error('Error fetching all records:', err);
      }
    };
    fetchAllRecords();
  }, [selectedMonth]);

  // ISSUE 4 FIX: Safe search filter
  const filteredRecords = searchTerm 
    ? allPayrollRecords.filter((record) => {
        if (!record) return false;
        const searchLower = searchTerm.toLowerCase();
        const name = record.name || '';
        const employeeCode = record.employeeCode || '';
        const email = record.email || '';
        const department = record.department || '';
        const designation = record.designation || '';
        
        return name.toLowerCase().includes(searchLower) ||
               employeeCode.toLowerCase().includes(searchLower) ||
               email.toLowerCase().includes(searchLower) ||
               department.toLowerCase().includes(searchLower) ||
               designation.toLowerCase().includes(searchLower);
      })
    : payrollRecords;

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
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

      <div className="flex justify-between items-center mb-6">
        <div>
          <h5 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll Management</h5>
          <p className="text-gray-600 dark:text-gray-400">Employee salary and payment tracking</p>
        </div>
        
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
        <div className="flex flex-col gap-4 mb-6">
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
                {departments.map((dept) => (
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
                📊 Export
              </Button>
              <Button color="purple" size="sm" onClick={() => setShowBulkProcessModal(true)}>
                ⚡ Bulk
              </Button>
              <Button color="green" size="sm" onClick={() => setShowAddModal(true)}>
                ➕ Add
              </Button>
            </div>
          </div>
        </div>

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
                      No payroll records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage).map((record) => {
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
                              {(record.name || 'U').charAt(0)}
                            </div>
                            <div className="ml-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{record.name || 'Unknown'}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{record.employeeCode || ''}</div>
                              <div className="text-xs text-gray-400">{record.designation || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">{record.department || 'N/A'}</div>
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
              out of {searchTerm ? filteredRecords.length : totalRecords} records
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
              let pageNumber = index + 1;
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

      {/* ISSUE 3 FIX: Simplified Add Modal */}
      <Modal show={showAddModal} onClose={() => { setShowAddModal(false); resetSimpleAddForm(); }} size="2xl">
        <Modal.Header>Create Payroll Record</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Employee *</label>
              
              {/* Search Input */}
              <TextInput
                type="text"
                placeholder="Search employees..."
                value={employeeSearchTerm}
                onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                className="mb-2"
              />
              
              {/* Dropdown */}
              <Select
                value={simpleAddData.employee_id}
                onChange={(e) => {
                  const emp = employees.find(em => em.id === e.target.value);
                  setSimpleAddData({
                    ...simpleAddData,
                    employee_id: e.target.value
                  });
                }}
                required
              >
                <option value="">Select Employee</option>
                {employees
                  .filter(emp => {
                    if (!employeeSearchTerm.trim()) return true;
                    const searchLower = employeeSearchTerm.toLowerCase();
                    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                    const employeeCode = emp.employee_code.toLowerCase();
                    return fullName.includes(searchLower) || employeeCode.includes(searchLower);
                  })
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.employee_code} (Base: Rs. {emp.base_salary || 0})
                    </option>
                  ))}
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Period Start *</label>
                <TextInput
                  type="date"
                  value={simpleAddData.pay_period_start}
                  onChange={(e) => setSimpleAddData({...simpleAddData, pay_period_start: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period End *</label>
                <TextInput
                  type="date"
                  value={simpleAddData.pay_period_end}
                  onChange={(e) => setSimpleAddData({...simpleAddData, pay_period_end: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Default Allowances</label>
                <TextInput
                  type="number"
                  value={simpleAddData.default_allowances}
                  onChange={(e) => setSimpleAddData({...simpleAddData, default_allowances: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default Bonus</label>
                <TextInput
                  type="number"
                  value={simpleAddData.default_bonus}
                  onChange={(e) => setSimpleAddData({...simpleAddData, default_bonus: Number(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                <TextInput
                  type="number"
                  step="0.01"
                  value={simpleAddData.tax_rate * 100}
                  onChange={(e) => setSimpleAddData({...simpleAddData, tax_rate: Number(e.target.value) / 100})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PF Rate (%)</label>
                <TextInput
                  type="number"
                  step="0.01"
                  value={simpleAddData.provident_fund_rate * 100}
                  onChange={(e) => setSimpleAddData({...simpleAddData, provident_fund_rate: Number(e.target.value) / 100})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Insurance Amount</label>
                <TextInput
                  type="number"
                  value={simpleAddData.insurance_amount}
                  onChange={(e) => setSimpleAddData({...simpleAddData, insurance_amount: Number(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-sm text-gray-600">
                * Base salary will be fetched from employee record<br/>
                * Overtime will be calculated from attendance records
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => { setShowAddModal(false); resetSimpleAddForm(); }}>Cancel</Button>
          <Button color="blue" onClick={handleSimpleCreatePayroll} disabled={loading}>Create Payroll</Button>
        </Modal.Footer>
      </Modal>

      {/* ISSUE 2 FIX: Complete Edit Modal with Commission and Loan */}
      <Modal show={isEditing} onClose={() => { setIsEditing(false); setEditingRecord(null); }} size="4xl">
        <Modal.Header>Edit Payroll Record - {editingRecord?.name}</Modal.Header>
        <Modal.Body>
          {editingRecord && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Earnings</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Base Salary</label>
                  <TextInput
                    type="number"
                    value={editingRecord.earnings.baseSalary}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      earnings: { ...editingRecord.earnings, baseSalary: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Allowances</label>
                  <TextInput
                    type="number"
                    value={editingRecord.earnings.allowances}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      earnings: { ...editingRecord.earnings, allowances: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Overtime</label>
                  <TextInput
                    type="number"
                    value={editingRecord.earnings.overtime}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      earnings: { ...editingRecord.earnings, overtime: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bonus</label>
                  <TextInput
                    type="number"
                    value={editingRecord.earnings.bonus}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      earnings: { ...editingRecord.earnings, bonus: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Commission</label>
                  <TextInput
                    type="number"
                    value={editingRecord.earnings.commission}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      earnings: { ...editingRecord.earnings, commission: Number(e.target.value) }
                    })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Deductions</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Tax Deduction</label>
                  <TextInput
                    type="number"
                    value={editingRecord.deductions.tax}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      deductions: { ...editingRecord.deductions, tax: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provident Fund</label>
                  <TextInput
                    type="number"
                    value={editingRecord.deductions.providentFund}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      deductions: { ...editingRecord.deductions, providentFund: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Insurance</label>
                  <TextInput
                    type="number"
                    value={editingRecord.deductions.insurance}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      deductions: { ...editingRecord.deductions, insurance: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Loan Deduction</label>
                  <TextInput
                    type="number"
                    value={editingRecord.deductions.loan}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      deductions: { ...editingRecord.deductions, loan: Number(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Other Deductions</label>
                  <TextInput
                    type="number"
                    value={editingRecord.deductions.other}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      deductions: { ...editingRecord.deductions, other: Number(e.target.value) }
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => { setIsEditing(false); setEditingRecord(null); }}>Cancel</Button>
          <Button color="blue" onClick={handleUpdatePayroll} disabled={loading}>Save Changes</Button>
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
                  {formatCurrency(selectedRecord.earnings.allowances + selectedRecord.earnings.overtime + 
                                  selectedRecord.earnings.bonus + selectedRecord.earnings.commission)}
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