import React, { useState, useEffect } from 'react';
import { TextInput, Button, Select, Badge, Modal, Table, Alert } from "flowbite-react";
import { payrollApiService, PayrollRecord, PayrollFilters, CreatePayrollData, BulkProcessData, AdvancedCalculationOptions } from '../../services/payrollService';
import { AttendanceMetrics } from '../../services/payrollCalculationService';

// Utility function for number to words conversion
const numberToWords = (num: number): string => {
  return `${num} only`; // Simplified implementation
};
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

  // Advanced calculation options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedCalculationOptions>({
    useFlatTax: true,
    taxRate: 0.15,
    useProgressiveTax: false,
    performanceScore: undefined,
    overtimeHours: 0,
    overtimeType: 'weekday',
    attendance: undefined
  });

  // Calculation preview
  const [calculationPreview, setCalculationPreview] = useState<any>(null);
  const [showCalculationPreview, setShowCalculationPreview] = useState(false);

  // Dropdown state
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  
  // Payment status modal states
  const [showPaymentStatusModal, setShowPaymentStatusModal] = useState(false);
  const [selectedPaymentRecord, setSelectedPaymentRecord] = useState<PayrollRecord | null>(null);
  const [paymentStatusForm, setPaymentStatusForm] = useState({
    status: 'pending' as 'pending' | 'paid' | 'failed',
    payment_date: '',
    payment_reference: '',
    notes: ''
  });

  // Bulk payment status update states
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [bulkPaymentForm, setBulkPaymentForm] = useState({
    status: 'paid' as 'pending' | 'paid' | 'failed',
    payment_date: '',
    payment_reference: '',
    notes: ''
  });

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

  // Fix the Edit functionality - Add Edit Modal
const EditModal = () => (
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
);

// Fix the Payslip Modal
const PayslipModal = () => (
  <Modal show={showPayslipModal} onClose={() => setShowPayslipModal(false)} size="5xl">
    <Modal.Header>
      <div className="flex justify-between items-center w-full">
        <span>Payslip - {selectedRecord?.name}</span>
        <Button size="sm" color="blue" onClick={() => window.print()}>
          Print
        </Button>
      </div>
    </Modal.Header>
    <Modal.Body>
      {payslipData && selectedRecord && (
        <div className="payslip-content bg-white p-8 rounded-lg print:p-0">
          {/* Company Header */}
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
            <h1 className="text-3xl font-bold text-gray-800">PAYSLIP</h1>
            <p className="text-lg text-gray-600">{payslipData.company?.name || 'Company Name'}</p>
            <p className="text-sm text-gray-500">
              {payslipData.company?.address || 'Company Address'}
            </p>
            <p className="text-sm text-gray-500">
              Tel: {payslipData.company?.phone || 'N/A'} | Email: {payslipData.company?.email || 'N/A'}
            </p>
          </div>

          {/* Pay Period */}
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-lg mb-2">Pay Period</h3>
            <p className="text-gray-700">
              From: {formatDate(selectedRecord.payPeriod.start)} To: {formatDate(selectedRecord.payPeriod.end)}
            </p>
          </div>

          {/* Employee Info */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-800">Employee Information</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {selectedRecord.name}</p>
                <p><span className="font-medium">Employee ID:</span> {selectedRecord.employeeCode}</p>
                <p><span className="font-medium">Department:</span> {selectedRecord.department || 'N/A'}</p>
                <p><span className="font-medium">Designation:</span> {selectedRecord.designation || 'N/A'}</p>
                <p><span className="font-medium">Email:</span> {selectedRecord.email}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-800">Payment Details</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Payment Date:</span> {formatDate(selectedRecord.payment.date)}</p>
                <p><span className="font-medium">Payment Method:</span> {selectedRecord.payment.method.replace('_', ' ').toUpperCase()}</p>
                <p><span className="font-medium">Payment Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    selectedRecord.payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedRecord.payment.status.toUpperCase()}
                  </span>
                </p>
                {selectedRecord.payment.reference && (
                  <p><span className="font-medium">Reference:</span> {selectedRecord.payment.reference}</p>
                )}
              </div>
            </div>
          </div>

          {/* Salary Breakdown */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Earnings */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-green-700 border-b border-green-200 pb-2">Earnings</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base Salary:</span>
                  <span className="font-medium">{formatCurrency(selectedRecord.earnings.baseSalary)}</span>
                </div>
                {selectedRecord.earnings.allowances > 0 && (
                  <div className="flex justify-between">
                    <span>Allowances:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.earnings.allowances)}</span>
                  </div>
                )}
                {selectedRecord.earnings.overtime > 0 && (
                  <div className="flex justify-between">
                    <span>Overtime:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.earnings.overtime)}</span>
                  </div>
                )}
                {selectedRecord.earnings.bonus > 0 && (
                  <div className="flex justify-between">
                    <span>Bonus:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.earnings.bonus)}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between font-semibold text-green-700">
                  <span>Gross Salary:</span>
                  <span>{formatCurrency(selectedRecord.summary.grossSalary)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-red-700 border-b border-red-200 pb-2">Deductions</h3>
              <div className="space-y-2 text-sm">
                {selectedRecord.deductions.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax Deduction:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.deductions.tax)}</span>
                  </div>
                )}
                {selectedRecord.deductions.providentFund > 0 && (
                  <div className="flex justify-between">
                    <span>Provident Fund:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.deductions.providentFund)}</span>
                  </div>
                )}
                {selectedRecord.deductions.insurance > 0 && (
                  <div className="flex justify-between">
                    <span>Insurance:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.deductions.insurance)}</span>
                  </div>
                )}
                {selectedRecord.deductions.loan > 0 && (
                  <div className="flex justify-between">
                    <span>Loan Deduction:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.deductions.loan)}</span>
                  </div>
                )}
                {selectedRecord.deductions.other > 0 && (
                  <div className="flex justify-between">
                    <span>Other Deductions:</span>
                    <span className="font-medium">{formatCurrency(selectedRecord.deductions.other)}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between font-semibold text-red-700">
                  <span>Total Deductions:</span>
                  <span>{formatCurrency(selectedRecord.summary.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary */}
          <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-blue-800">Net Salary:</span>
              <span className="text-2xl font-bold text-blue-800">{formatCurrency(selectedRecord.summary.netSalary)}</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              <p className="italic">
                Amount in words: {numberToWords(selectedRecord.summary.netSalary)}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-500">
            <p>This is a computer-generated payslip and does not require a signature.</p>
            <p>Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      )}
    </Modal.Body>
    <Modal.Footer>
      <Button onClick={() => setShowPayslipModal(false)}>Close</Button>
    </Modal.Footer>
  </Modal>
);

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

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.employee-dropdown-container')) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Open payment status modal
  const openPaymentStatusModal = (record: PayrollRecord) => {
    setSelectedPaymentRecord(record);
    setPaymentStatusForm({
      status: record.payment.status as 'pending' | 'paid' | 'failed',
      payment_date: record.payment.date || '',
      payment_reference: record.payment.reference || '',
      notes: record.notes || ''
    });
    setShowPaymentStatusModal(true);
  };

  // Update payment status with detailed information
  const updatePaymentStatus = async () => {
    if (!selectedPaymentRecord) return;
    
    try {
      setLoading(true);
      
      // Auto-set payment date if status is 'paid' and no date is provided
      const paymentDate = paymentStatusForm.status === 'paid' && !paymentStatusForm.payment_date 
        ? new Date().toISOString().split('T')[0] 
        : paymentStatusForm.payment_date;
      
      await payrollApiService.updatePaymentStatus(
        selectedPaymentRecord.id, 
        paymentStatusForm.status, 
        paymentDate || undefined,
        paymentStatusForm.payment_reference || undefined
      );
      
      // If notes were added, update the payroll record
      if (paymentStatusForm.notes !== (selectedPaymentRecord.notes || '')) {
        await payrollApiService.updatePayroll(selectedPaymentRecord.id, {
          notes: paymentStatusForm.notes
        });
      }
      
      setSuccessMessage('Payment status updated successfully');
      setShowPaymentStatusModal(false);
      setSelectedPaymentRecord(null);
      fetchPayrollRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment status');
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk record selection
  const handleRecordSelection = (recordId: string, checked: boolean) => {
    const newSelection = new Set(selectedRecords);
    if (checked) {
      newSelection.add(recordId);
    } else {
      newSelection.delete(recordId);
    }
    setSelectedRecords(newSelection);
  };

  // Handle select all records
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredRecords.map(record => record.id));
      setSelectedRecords(allIds);
    } else {
      setSelectedRecords(new Set());
    }
  };

  // Open bulk payment status modal
  const openBulkPaymentModal = () => {
    if (selectedRecords.size === 0) {
      setError('Please select at least one payroll record');
      return;
    }
    setBulkPaymentForm({
      status: 'paid',
      payment_date: new Date().toISOString().split('T')[0],
      payment_reference: '',
      notes: ''
    });
    setShowBulkPaymentModal(true);
  };

  // Bulk update payment status - NEW OPTIMIZED VERSION
  const bulkUpdatePaymentStatus = async () => {
    try {
      setLoading(true);

      const paymentDate = bulkPaymentForm.status === 'paid' && !bulkPaymentForm.payment_date 
        ? new Date().toISOString().split('T')[0] 
        : bulkPaymentForm.payment_date;

      // Single API call for all records
      const response = await payrollApiService.bulkUpdatePaymentStatus({
        record_ids: Array.from(selectedRecords),
        payment_status: bulkPaymentForm.status,
        payment_date: paymentDate || undefined,
        payment_reference: bulkPaymentForm.payment_reference || undefined
      });

      if (response.success) {
        // Handle notes update separately if provided (since bulk API doesn't handle notes yet)
        if (bulkPaymentForm.notes.trim()) {
          let notesUpdateCount = 0;
          for (const recordId of selectedRecords) {
            try {
              await payrollApiService.updatePayroll(recordId, {
                notes: bulkPaymentForm.notes
              });
              notesUpdateCount++;
            } catch (err) {
              console.warn(`Failed to update notes for record ${recordId}:`, err);
            }
          }
          
          if (notesUpdateCount > 0) {
            setSuccessMessage(
              `Successfully updated ${response.data.updated_records} payment status(es) and added notes to ${notesUpdateCount} records`
            );
          } else {
            setSuccessMessage(
              `Successfully updated ${response.data.updated_records} payment status(es)`
            );
          }
        } else {
          setSuccessMessage(
            `Successfully updated ${response.data.updated_records} payment status(es) to ${bulkPaymentForm.status.toUpperCase()}`
          );
        }
      } else {
        throw new Error(response.message || 'Bulk update failed');
      }

      setShowBulkPaymentModal(false);
      setSelectedRecords(new Set());
      fetchPayrollRecords();
    } catch (err: any) {
      console.error('Bulk payment status update error:', err);
      setError(err.message || 'Failed to update payment statuses');
    } finally {
      setLoading(false);
    }
  };

  // ISSUE 3 FIX: Enhanced create payroll with advanced calculations
  const handleSimpleCreatePayroll = async () => {
    try {
      setLoading(true);
      
      const selectedEmployee = employees.find(e => e.id === simpleAddData.employee_id);
      if (!selectedEmployee) {
        throw new Error('Please select an employee');
      }

      const base_salary = selectedEmployee.base_salary || 0;

      // Use advanced calculation if enabled
      let calculationResult;
      if (showAdvancedOptions) {
        calculationResult = payrollApiService.previewPayrollCalculation(
          { base_salary },
          {
            allowances: simpleAddData.default_allowances,
            bonus: simpleAddData.default_bonus,
            insurance: simpleAddData.insurance_amount,
            useFlatTax: advancedOptions.useFlatTax,
            taxRate: advancedOptions.useFlatTax ? simpleAddData.tax_rate : undefined,
            useProgressiveTax: advancedOptions.useProgressiveTax,
            performanceScore: advancedOptions.performanceScore,
            overtimeHours: advancedOptions.overtimeHours,
            attendance: advancedOptions.attendance
          }
        );
      } else {
        // Simple calculation (existing logic)
        const overtime_amount = 0;
        const gross_salary = base_salary + simpleAddData.default_allowances + overtime_amount + simpleAddData.default_bonus;
        const tax_deduction = gross_salary * simpleAddData.tax_rate;
        const provident_fund = base_salary * simpleAddData.provident_fund_rate;
        
        calculationResult = {
          baseSalary: base_salary,
          allowances: simpleAddData.default_allowances,
          overtimeAmount: overtime_amount,
          bonus: simpleAddData.default_bonus,
          commission: 0,
          taxDeduction: tax_deduction,
          providentFund: provident_fund,
          insurance: simpleAddData.insurance_amount,
          loanDeduction: 0,
          attendanceDeduction: 0,
          otherDeductions: 0
        };
      }
      
      const payrollData: CreatePayrollData = {
        employee_id: simpleAddData.employee_id,
        pay_period_start: simpleAddData.pay_period_start,
        pay_period_end: simpleAddData.pay_period_end,
        base_salary: calculationResult.baseSalary,
        allowances: calculationResult.allowances,
        overtime_amount: calculationResult.overtimeAmount,
        bonus: calculationResult.bonus,
        commission: calculationResult.commission,
        tax_deduction: calculationResult.taxDeduction,
        provident_fund: calculationResult.providentFund,
        insurance: calculationResult.insurance,
        loan_deduction: calculationResult.loanDeduction,
        other_deductions: calculationResult.otherDeductions + calculationResult.attendanceDeduction,
        payment_method: 'bank_transfer',
        notes: showAdvancedOptions ? 'Created with advanced calculations' : 'Created from simplified form'
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
    setAdvancedOptions({
      useFlatTax: true,
      taxRate: 0.15,
      useProgressiveTax: false,
      performanceScore: undefined,
      overtimeHours: 0,
      overtimeType: 'weekday',
      attendance: undefined
    });
    setCalculationPreview(null);
    setShowCalculationPreview(false);
    setShowEmployeeDropdown(false);
  };

  // Preview payroll calculation with advanced options
  const previewPayrollCalculation = () => {
    const selectedEmployee = employees.find(e => e.id === simpleAddData.employee_id);
    if (!selectedEmployee) {
      setError('Please select an employee first');
      return;
    }

    try {
      const preview = payrollApiService.previewPayrollCalculation(
        { base_salary: selectedEmployee.base_salary || 0 },
        {
          allowances: simpleAddData.default_allowances,
          bonus: simpleAddData.default_bonus,
          insurance: simpleAddData.insurance_amount,
          useFlatTax: advancedOptions.useFlatTax,
          taxRate: advancedOptions.useFlatTax ? simpleAddData.tax_rate : undefined,
          useProgressiveTax: advancedOptions.useProgressiveTax,
          performanceScore: advancedOptions.performanceScore,
          overtimeHours: advancedOptions.overtimeHours,
          attendance: advancedOptions.attendance
        }
      );

      setCalculationPreview(preview);
      setShowCalculationPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate payroll preview');
    }
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
        payment_date: editingRecord.payment.date || new Date().toISOString().split('T')[0],
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
                {Array.from({ length: 24 }, (_, i) => {
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
              {selectedRecords.size > 0 && (
                <Button color="orange" size="sm" onClick={openBulkPaymentModal}>
                  💳 Update Status ({selectedRecords.size})
                </Button>
              )}
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
                  <th scope="col" className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={filteredRecords.length > 0 && selectedRecords.size === filteredRecords.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
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
                    <td colSpan={12} className="text-center py-8 text-gray-500">
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
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedRecords.has(record.id)}
                            onChange={(e) => handleRecordSelection(record.id, e.target.checked)}
                          />
                        </td>
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
                          <div onClick={() => openPaymentStatusModal(record)} className="cursor-pointer">
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
              
              {/* Searchable Dropdown */}
              <div className="relative employee-dropdown-container">
                <TextInput
                  type="text"
                  placeholder="Search and select employee..."
                  value={employeeSearchTerm}
                  onChange={(e) => {
                    setEmployeeSearchTerm(e.target.value);
                    setShowEmployeeDropdown(true);
                    // Clear selection when typing if it doesn't match
                    if (e.target.value && simpleAddData.employee_id) {
                      const selectedEmp = employees.find(emp => emp.id === simpleAddData.employee_id);
                      const fullName = selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : '';
                      if (!fullName.toLowerCase().includes(e.target.value.toLowerCase())) {
                        setSimpleAddData({...simpleAddData, employee_id: ''});
                      }
                    }
                  }}
                  onFocus={() => {
                    if (!simpleAddData.employee_id) {
                      setEmployeeSearchTerm('');
                    }
                    setShowEmployeeDropdown(true);
                  }}
                  className="pr-10"
                  required
                />
                <HiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                
                {/* Dropdown List */}
                {showEmployeeDropdown && (employeeSearchTerm || !simpleAddData.employee_id) && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {employees
                      .filter(emp => {
                        if (!employeeSearchTerm.trim()) return true; // Show all if no search term
                        const searchLower = employeeSearchTerm.toLowerCase();
                        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                        const employeeCode = emp.employee_code.toLowerCase();
                        return fullName.includes(searchLower) || employeeCode.includes(searchLower);
                      })
                      .sort((a, b) => {
                        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((emp) => (
                        <div
                          key={emp.id}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => {
                            setSimpleAddData({
                              ...simpleAddData,
                              employee_id: emp.id
                            });
                            setEmployeeSearchTerm(`${emp.first_name} ${emp.last_name} - ${emp.employee_code}`);
                            setShowEmployeeDropdown(false);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-gray-900">
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {emp.employee_code} | Dept: {emp.department || 'N/A'}
                              </div>
                            </div>
                            <div className="text-sm font-medium text-blue-600">
                              Rs. {(emp.base_salary || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    
                    {employees.filter(emp => {
                      const searchLower = employeeSearchTerm.toLowerCase();
                      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                      const employeeCode = emp.employee_code.toLowerCase();
                      return fullName.includes(searchLower) || employeeCode.includes(searchLower);
                    }).length === 0 && (
                      <div className="px-3 py-2 text-gray-500 text-center">
                        No employees found matching "{employeeSearchTerm}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected Employee Display */}
              {simpleAddData.employee_id && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  <div className="font-medium">Selected Employee:</div>
                  <div className="text-blue-700">
                    {(() => {
                      const selectedEmp = employees.find(e => e.id === simpleAddData.employee_id);
                      return selectedEmp ? 
                        `${selectedEmp.first_name} ${selectedEmp.last_name} (${selectedEmp.employee_code}) - Base Salary: Rs. ${(selectedEmp.base_salary || 0).toLocaleString()}` : 
                        'Employee not found';
                    })()}
                  </div>
                </div>
              )}
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
            
            {/* Advanced Options Toggle */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Advanced Calculation Options</label>
                <Button
                  size="xs"
                  color="blue"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                >
                  {showAdvancedOptions ? 'Hide' : 'Show'} Advanced
                </Button>
              </div>

              {showAdvancedOptions && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  {/* Tax Calculation Options */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Tax Calculation Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="taxMethod"
                          checked={advancedOptions.useFlatTax}
                          onChange={() => setAdvancedOptions({
                            ...advancedOptions,
                            useFlatTax: true,
                            useProgressiveTax: false
                          })}
                          className="mr-2"
                        />
                        Flat Tax Rate
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="taxMethod"
                          checked={advancedOptions.useProgressiveTax}
                          onChange={() => setAdvancedOptions({
                            ...advancedOptions,
                            useFlatTax: false,
                            useProgressiveTax: true
                          })}
                          className="mr-2"
                        />
                        Progressive Tax (Sri Lankan Slabs)
                      </label>
                    </div>
                  </div>

                  {/* Overtime Calculation */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Overtime Hours</label>
                      <TextInput
                        type="number"
                        value={advancedOptions.overtimeHours || 0}
                        onChange={(e) => setAdvancedOptions({
                          ...advancedOptions,
                          overtimeHours: Number(e.target.value)
                        })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Overtime Type</label>
                      <Select
                        value={advancedOptions.overtimeType || 'weekday'}
                        onChange={(e) => setAdvancedOptions({
                          ...advancedOptions,
                          overtimeType: e.target.value as any
                        })}
                      >
                        <option value="weekday">Weekday (1.5x)</option>
                        <option value="saturday">Saturday (1.5x)</option>
                        <option value="sunday">Sunday (2.0x)</option>
                        <option value="holiday">Holiday (2.5x)</option>
                      </Select>
                    </div>
                  </div>

                  {/* Performance Score */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Performance Score (0-100) for Bonus</label>
                    <TextInput
                      type="number"
                      min="0"
                      max="100"
                      value={advancedOptions.performanceScore || ''}
                      onChange={(e) => setAdvancedOptions({
                        ...advancedOptions,
                        performanceScore: e.target.value ? Number(e.target.value) : undefined
                      })}
                      placeholder="Leave empty to use default bonus"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Performance bonus = (Score/100) × 20% × Base Salary
                    </p>
                  </div>

                  {/* Calculate Preview Button */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="green"
                      onClick={previewPayrollCalculation}
                      disabled={!simpleAddData.employee_id}
                    >
                      📊 Preview Calculation
                    </Button>
                    {showCalculationPreview && (
                      <Button
                        size="sm"
                        color="gray"
                        onClick={() => setShowCalculationPreview(false)}
                      >
                        Hide Preview
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Calculation Preview */}
            {showCalculationPreview && calculationPreview && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3">Calculation Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 p-3 rounded">
                    <h5 className="font-medium text-green-700 mb-2">Earnings</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Base Salary:</span>
                        <span>{formatCurrency(calculationPreview.baseSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Allowances:</span>
                        <span>{formatCurrency(calculationPreview.allowances)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overtime:</span>
                        <span>{formatCurrency(calculationPreview.overtimeAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bonus:</span>
                        <span>{formatCurrency(calculationPreview.bonus)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Gross:</span>
                        <span>{formatCurrency(calculationPreview.grossSalary)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded">
                    <h5 className="font-medium text-red-700 mb-2">Deductions</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency(calculationPreview.taxDeduction)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PF:</span>
                        <span>{formatCurrency(calculationPreview.providentFund)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Insurance:</span>
                        <span>{formatCurrency(calculationPreview.insurance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Other:</span>
                        <span>{formatCurrency(calculationPreview.otherDeductions + calculationPreview.attendanceDeduction)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Total:</span>
                        <span>{formatCurrency(calculationPreview.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded mt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Net Salary:</span>
                    <span className="text-blue-600">{formatCurrency(calculationPreview.netSalary)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Hourly Rate: {formatCurrency(calculationPreview.hourlyRate)} | 
                    Daily Rate: {formatCurrency(calculationPreview.dailyRate)}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-gray-100 p-3 rounded">
              <p className="text-sm text-gray-600">
                * Base salary will be fetched from employee record<br/>
                * Use Advanced Options for progressive tax, overtime, and performance bonuses<br/>
                * Preview calculations before creating the payroll record
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

      {/* Payment Status Update Modal */}
      <Modal show={showPaymentStatusModal} onClose={() => setShowPaymentStatusModal(false)} size="lg">
        <Modal.Header>
          Update Payment Status - {selectedPaymentRecord?.name}
        </Modal.Header>
        <Modal.Body>
          {selectedPaymentRecord && (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Employee:</span>
                    <div className="text-gray-700">{selectedPaymentRecord.name}</div>
                  </div>
                  <div>
                    <span className="font-medium">Net Salary:</span>
                    <div className="text-green-600 font-semibold">
                      {formatCurrency(selectedPaymentRecord.summary.netSalary)}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Pay Period:</span>
                    <div className="text-gray-700">
                      {formatDate(selectedPaymentRecord.payPeriod.start)} - {formatDate(selectedPaymentRecord.payPeriod.end)}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Current Status:</span>
                    <div className="mt-1">{getStatusBadge(selectedPaymentRecord.payment.status)}</div>
                  </div>
                </div>
              </div>

              {/* Payment Status Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Update Payment Status *</label>
                  <Select
                    value={paymentStatusForm.status}
                    onChange={(e) => setPaymentStatusForm({
                      ...paymentStatusForm, 
                      status: e.target.value as 'pending' | 'paid' | 'failed'
                    })}
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                  </Select>
                </div>

                {/* Payment Date - Show when status is 'paid' */}
                {paymentStatusForm.status === 'paid' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Date</label>
                    <TextInput
                      type="date"
                      value={paymentStatusForm.payment_date}
                      onChange={(e) => setPaymentStatusForm({
                        ...paymentStatusForm, 
                        payment_date: e.target.value
                      })}
                      placeholder="Auto-set to today if empty"
                    />
                  </div>
                )}

                {/* Payment Reference - Show when status is 'paid' */}
                {paymentStatusForm.status === 'paid' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Reference</label>
                    <TextInput
                      type="text"
                      value={paymentStatusForm.payment_reference}
                      onChange={(e) => setPaymentStatusForm({
                        ...paymentStatusForm, 
                        payment_reference: e.target.value
                      })}
                      placeholder="Transaction ID, Check number, etc."
                    />
                  </div>
                )}

                {/* Notes - Always show */}
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    value={paymentStatusForm.notes}
                    onChange={(e) => setPaymentStatusForm({
                      ...paymentStatusForm, 
                      notes: e.target.value
                    })}
                    placeholder="Optional notes about this payment..."
                  />
                </div>

                {/* Status-specific help text */}
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  {paymentStatusForm.status === 'pending' && (
                    <div>💡 Payment is waiting to be processed</div>
                  )}
                  {paymentStatusForm.status === 'paid' && (
                    <div>✅ Payment has been successfully completed</div>
                  )}
                  {paymentStatusForm.status === 'failed' && (
                    <div>❌ Payment failed - may need manual intervention</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowPaymentStatusModal(false)}>
            Cancel
          </Button>
          <Button color="blue" onClick={updatePaymentStatus} disabled={loading}>
            {loading ? 'Updating...' : 'Update Status'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Payment Status Update Modal */}
      <Modal show={showBulkPaymentModal} onClose={() => setShowBulkPaymentModal(false)} size="lg">
        <Modal.Header>
          Bulk Update Payment Status ({selectedRecords.size} records)
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            {/* Selected Records Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Selected Records</h4>
              <div className="text-sm text-gray-700">
                <p>{selectedRecords.size} payroll records selected for status update</p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {Array.from(selectedRecords).map(recordId => {
                    const record = filteredRecords.find(r => r.id === recordId);
                    return record ? (
                      <div key={recordId} className="flex justify-between py-1">
                        <span>{record.name}</span>
                        <span>{formatCurrency(record.summary.netSalary)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            {/* Bulk Payment Status Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Update Status To *</label>
                <Select
                  value={bulkPaymentForm.status}
                  onChange={(e) => setBulkPaymentForm({
                    ...bulkPaymentForm, 
                    status: e.target.value as 'pending' | 'paid' | 'failed'
                  })}
                  required
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                </Select>
              </div>

              {/* Payment Date - Show when status is 'paid' */}
              {bulkPaymentForm.status === 'paid' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Date</label>
                  <TextInput
                    type="date"
                    value={bulkPaymentForm.payment_date}
                    onChange={(e) => setBulkPaymentForm({
                      ...bulkPaymentForm, 
                      payment_date: e.target.value
                    })}
                    placeholder="Auto-set to today if empty"
                  />
                </div>
              )}

              {/* Payment Reference - Show when status is 'paid' */}
              {bulkPaymentForm.status === 'paid' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Reference</label>
                  <TextInput
                    type="text"
                    value={bulkPaymentForm.payment_reference}
                    onChange={(e) => setBulkPaymentForm({
                      ...bulkPaymentForm, 
                      payment_reference: e.target.value
                    })}
                    placeholder="Batch number, transaction ID, etc."
                  />
                </div>
              )}

              {/* Notes - Always show */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes (Applied to all selected records)</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  value={bulkPaymentForm.notes}
                  onChange={(e) => setBulkPaymentForm({
                    ...bulkPaymentForm, 
                    notes: e.target.value
                  })}
                  placeholder="Optional notes for all selected payments..."
                />
              </div>

              {/* Status-specific help text */}
              <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded">
                ⚠️ <strong>Warning:</strong> This will update {selectedRecords.size} payment records at once. 
                {bulkPaymentForm.status === 'paid' && ' All records will be marked as paid with the same date and reference.'}
                {bulkPaymentForm.status === 'failed' && ' All records will be marked as failed.'}
                {bulkPaymentForm.status === 'pending' && ' All records will be marked as pending.'}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowBulkPaymentModal(false)}>
            Cancel
          </Button>
          <Button color="orange" onClick={bulkUpdatePaymentStatus} disabled={loading}>
            {loading ? 'Updating...' : `Update ${selectedRecords.size} Records`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PayrollDashboard;