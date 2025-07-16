import React, { useState } from 'react';
import { TextInput, Button, Select, Badge, Modal, Table } from "flowbite-react";

// Type definitions
interface PayrollRecord {
  id: number;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  joinDate: string;
  baseSalary: number;
  allowances: number;
  overtime: number;
  bonus: number;
  grossSalary: number;
  taxDeduction: number;
  providentFund: number;
  insurance: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  currentDaySalary: number;
  paymentStatus: 'Paid' | 'Not Paid';
  paymentDate: string;
  paymentMethod: string;
  avatar: string;
}

interface PayrollData {
  [month: string]: PayrollRecord[];
}

const PayrollDashboard = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(10);
  const [selectedMonth, setSelectedMonth] = useState<string>('2024-06');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showAdditionsModal, setShowAdditionsModal] = useState<boolean>(false);
  const [showDeductionsModal, setShowDeductionsModal] = useState<boolean>(false);
  const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Sample payroll data for different months
  const [payrollData, setPayrollData] = useState<PayrollData>({
    '2024-06': [
      {
        id: 1, employeeId: 'EMP001', name: 'Leasie Watson', designation: 'Team Lead - Design', department: 'Design',
        joinDate: '2022-01-15', baseSalary: 85000, allowances: 15000, overtime: 5000, bonus: 10000,
        grossSalary: 115000, taxDeduction: 18000, providentFund: 8500, insurance: 2500, otherDeductions: 1000,
        totalDeductions: 30000, netSalary: 85000, currentDaySalary: 59500, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👩‍💼'
      },
      {
        id: 2, employeeId: 'EMP002', name: 'Darlene Robertson', designation: 'Web Designer', department: 'Design',
        joinDate: '2022-03-20', baseSalary: 65000, allowances: 10000, overtime: 3000, bonus: 5000,
        grossSalary: 83000, taxDeduction: 12000, providentFund: 6500, insurance: 2000, otherDeductions: 500,
        totalDeductions: 21000, netSalary: 62000, currentDaySalary: 43400, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👩‍🎨'
      },
      {
        id: 3, employeeId: 'EMP003', name: 'Jacob Jones', designation: 'Medical Assistant', department: 'Healthcare',
        joinDate: '2023-01-10', baseSalary: 55000, allowances: 8000, overtime: 2000, bonus: 3000,
        grossSalary: 68000, taxDeduction: 9000, providentFund: 5500, insurance: 1500, otherDeductions: 0,
        totalDeductions: 16000, netSalary: 52000, currentDaySalary: 36400, paymentStatus: 'Not Paid', paymentDate: '2024-07-01',
        paymentMethod: 'Bank Transfer', avatar: '👨‍⚕️'
      },
      {
        id: 4, employeeId: 'EMP004', name: 'Kathryn Murphy', designation: 'Marketing Coordinator', department: 'Marketing',
        joinDate: '2022-08-05', baseSalary: 60000, allowances: 9000, overtime: 2500, bonus: 4000,
        grossSalary: 75500, taxDeduction: 10500, providentFund: 6000, insurance: 1800, otherDeductions: 200,
        totalDeductions: 18500, netSalary: 57000, currentDaySalary: 39900, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👩‍💻'
      },
      {
        id: 5, employeeId: 'EMP005', name: 'Leslie Alexander', designation: 'Data Analyst', department: 'Analytics',
        joinDate: '2021-11-12', baseSalary: 70000, allowances: 12000, overtime: 4000, bonus: 6000,
        grossSalary: 92000, taxDeduction: 14000, providentFund: 7000, insurance: 2200, otherDeductions: 800,
        totalDeductions: 24000, netSalary: 68000, currentDaySalary: 47600, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👨‍💼'
      }
    ]
  });

  // Get current date info for daily salary calculation
  const getCurrentDateInfo = () => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // If viewing current month, use actual current date
    // If viewing past month, use last day of that month
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
    
    if (selectedYear === currentYear && selectedMonthNum === currentMonth) {
      return currentDay;
    } else {
      // Return last day of the selected month
      return new Date(selectedYear, selectedMonthNum, 0).getDate();
    }
  };

  const calculateCurrentDaySalary = (netSalary: number) => {
    const daysElapsed = getCurrentDateInfo();
    const dailyRate = netSalary / 30; // Assuming 30 days per month
    return Math.round(dailyRate * daysElapsed);
  };

  // Get payroll records for selected month
  const payrollRecords: PayrollRecord[] = payrollData[selectedMonth] || [];

  // Filter records based on search term and status
  const filteredRecords = payrollRecords.filter((record: PayrollRecord) => {
    const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || record.paymentStatus.toLowerCase() === filterStatus.toLowerCase().replace(' ', '');
    
    return matchesSearch && matchesStatus;
  });

  // Sort records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'salary':
        return b.netSalary - a.netSalary;
      case 'department':
        return a.department.localeCompare(b.department);
      default:
        return 0;
    }
  });

  // Pagination
  const totalRecords = sortedRecords.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = sortedRecords.slice(startIndex, endIndex);

  // Calculate totals
  const totalGrossSalary = filteredRecords.reduce((sum, record) => sum + record.grossSalary, 0);
  const totalNetSalary = filteredRecords.reduce((sum, record) => sum + record.netSalary, 0);
  const totalDeductions = filteredRecords.reduce((sum, record) => sum + record.totalDeductions, 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <Badge color="success" size="sm">{status}</Badge>;
      case 'Not Paid':
        return <Badge color="failure" size="sm">{status}</Badge>;
      default:
        return <Badge color="gray" size="sm">{status}</Badge>;
    }
  };

  // Toggle payment status
  const togglePaymentStatus = (recordId: number) => {
    setPayrollData(prevData => ({
      ...prevData,
      [selectedMonth]: prevData[selectedMonth].map(record => 
        record.id === recordId 
          ? { ...record, paymentStatus: record.paymentStatus === 'Paid' ? 'Not Paid' : 'Paid' }
          : record
      )
    }));
  };

  // Show additions breakdown
  const showAdditionsBreakdown = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setShowAdditionsModal(true);
  };

  // Show deductions breakdown
  const showDeductionsBreakdown = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setShowDeductionsModal(true);
  };

  // Start editing
  const startEditing = (record: PayrollRecord) => {
    setEditingRecord({ ...record });
    setIsEditing(true);
  };

  // Save edited record
  const saveEditedRecord = () => {
    if (editingRecord) {
      // Recalculate derived values
      const totalAdditions = editingRecord.allowances + editingRecord.overtime + editingRecord.bonus;
      const grossSalary = editingRecord.baseSalary + totalAdditions;
      const totalDeductions = editingRecord.taxDeduction + editingRecord.providentFund + editingRecord.insurance + editingRecord.otherDeductions;
      const netSalary = grossSalary - totalDeductions;
      const currentDaySalary = Math.round(netSalary / 30);

      const updatedRecord = {
        ...editingRecord,
        grossSalary,
        totalDeductions,
        netSalary,
        currentDaySalary
      };

      setPayrollData(prevData => ({
        ...prevData,
        [selectedMonth]: prevData[selectedMonth].map(record => 
          record.id === editingRecord.id ? updatedRecord : record
        )
      }));

      setIsEditing(false);
      setEditingRecord(null);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditingRecord(null);
  };

  // Show payslip
  const showPayslip = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setShowPayslipModal(true);
  };

  // Print payslip
  const printPayslip = () => {
    window.print();
  };

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h5 className="card-title">Payroll Management</h5>
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
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </div>
              <TextInput
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full"
              >
                <option value="2024-06">June 2024</option>
                <option value="2024-05">May 2024</option>
                <option value="2024-04">April 2024</option>
              </Select>
            </div>
          </div>
          
          {/* Second row - Filters and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="not paid">Not Paid</option>
              </Select>
            </div>
            
            <div>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full"
              >
                <option value="name">Sort by Name</option>
                <option value="salary">Sort by Salary</option>
                <option value="department">Sort by Department</option>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button color="blue" className="flex-1" size="sm">
                📊 Export
              </Button>
              <Button color="green" className="flex-1" size="sm">
                ➕ Add
              </Button>
            </div>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 min-w-[1400px]">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-3 py-3 w-40">Employee</th>
                <th scope="col" className="px-3 py-3 w-20">Department</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Base Salary</th>
                <th scope="col" className="px-3 py-3 w-24 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">Additions</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Gross Salary</th>
                <th scope="col" className="px-3 py-3 w-24 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">Deductions</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Net Salary</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Earned Till Date</th>
                <th scope="col" className="px-3 py-3 w-20">Status</th>
                <th scope="col" className="px-3 py-3 w-24">Payment Date</th>
                <th scope="col" className="px-3 py-3 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((record: PayrollRecord) => (
                <tr key={record.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-3 py-4 w-40">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                        {record.avatar}
                      </div>
                      <div className="ml-2 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{record.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{record.employeeId}</div>
                        <div className="text-xs text-gray-400 truncate">{record.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 w-20">
                    <div className="text-sm text-gray-900 dark:text-white truncate">{record.department}</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(record.baseSalary)}</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => showAdditionsBreakdown(record)}>
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(record.allowances + record.overtime + record.bonus)}
                    </div>
                    <div className="text-xs text-gray-400">Click for details</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(record.grossSalary)}</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => showDeductionsBreakdown(record)}>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {formatCurrency(record.totalDeductions)}
                    </div>
                    <div className="text-xs text-gray-400">Click for details</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(record.netSalary)}</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-medium text-purple-600 dark:text-purple-400">{formatCurrency(calculateCurrentDaySalary(record.netSalary))}</div>
                    <div className="text-xs text-gray-400">Until today</div>
                  </td>
                  <td className="px-3 py-4 w-20">
                    <div onClick={() => togglePaymentStatus(record.id)} className="cursor-pointer">
                      {getStatusBadge(record.paymentStatus)}
                    </div>
                  </td>
                  <td className="px-3 py-4 w-24">
                    <div className="text-sm text-gray-900 dark:text-white">{formatDate(record.paymentDate)}</div>
                    <div className="text-xs text-gray-400">{record.paymentMethod}</div>
                  </td>
                  <td className="px-3 py-4 w-20">
                    <div className="flex flex-col gap-1">
                      <Button size="xs" color="blue" onClick={() => showPayslip(record)}>View</Button>
                      <Button size="xs" color="gray" onClick={() => startEditing(record)}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
              Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} out of {totalRecords} records
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              size="sm"
              color="gray"
            >
              ←
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
              →
            </Button>
          </div>
        </div>
      </div>

      {/* Additions Modal */}
      <Modal show={showAdditionsModal} onClose={() => setShowAdditionsModal(false)}>
        <Modal.Header>Salary Additions - {selectedRecord?.name}</Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Allowances:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.allowances)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Overtime:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.overtime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Bonus:</span>
                <span className="text-blue-600">{formatCurrency(selectedRecord.bonus)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Additions:</span>
                <span className="text-green-600">{formatCurrency(selectedRecord.allowances + selectedRecord.overtime + selectedRecord.bonus)}</span>
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
                <span className="text-red-600">{formatCurrency(selectedRecord.taxDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Provident Fund:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.providentFund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Insurance:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.insurance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Other Deductions:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.otherDeductions)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Deductions:</span>
                <span className="text-red-600">{formatCurrency(selectedRecord.totalDeductions)}</span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowDeductionsModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal show={isEditing} onClose={cancelEditing} size="4xl">
        <Modal.Header>Edit Employee Payroll - {editingRecord?.name}</Modal.Header>
        <Modal.Body>
          {editingRecord && (
            <div className="grid grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Basic Information</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Base Salary</label>
                  <TextInput
                    type="number"
                    value={editingRecord.baseSalary}
                    onChange={(e) => setEditingRecord({...editingRecord, baseSalary: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Allowances</label>
                  <TextInput
                    type="number"
                    value={editingRecord.allowances}
                    onChange={(e) => setEditingRecord({...editingRecord, allowances: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Overtime</label>
                  <TextInput
                    type="number"
                    value={editingRecord.overtime}
                    onChange={(e) => setEditingRecord({...editingRecord, overtime: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bonus</label>
                  <TextInput
                    type="number"
                    value={editingRecord.bonus}
                    onChange={(e) => setEditingRecord({...editingRecord, bonus: Number(e.target.value)})}
                  />
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Deductions</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Tax Deduction</label>
                  <TextInput
                    type="number"
                    value={editingRecord.taxDeduction}
                    onChange={(e) => setEditingRecord({...editingRecord, taxDeduction: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provident Fund</label>
                  <TextInput
                    type="number"
                    value={editingRecord.providentFund}
                    onChange={(e) => setEditingRecord({...editingRecord, providentFund: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Insurance</label>
                  <TextInput
                    type="number"
                    value={editingRecord.insurance}
                    onChange={(e) => setEditingRecord({...editingRecord, insurance: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Other Deductions</label>
                  <TextInput
                    type="number"
                    value={editingRecord.otherDeductions}
                    onChange={(e) => setEditingRecord({...editingRecord, otherDeductions: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Method</label>
                  <Select
                    value={editingRecord.paymentMethod}
                    onChange={(e) => setEditingRecord({...editingRecord, paymentMethod: e.target.value})}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Check">Check</option>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex gap-2">
            <Button color="gray" onClick={cancelEditing}>Cancel</Button>
            <Button color="blue" onClick={saveEditedRecord}>Save Changes</Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Payslip Modal */}
      <Modal show={showPayslipModal} onClose={() => setShowPayslipModal(false)} size="4xl">
        <Modal.Header>
          <div className="flex justify-between items-center w-full">
            <span>Payslip - {selectedRecord?.name}</span>
            <Button size="sm" color="blue" onClick={printPayslip}>
              🖨️ Print
            </Button>
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <div className="payslip-content bg-white p-8 rounded-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* Header */}
              <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
                <h1 className="text-2xl font-bold text-gray-800">PAYSLIP</h1>
                <p className="text-gray-600">Company Name - HR Management System</p>
                <p className="text-sm text-gray-500">Pay Period: {selectedMonth}</p>
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-800">Employee Information</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Name:</span> {selectedRecord.name}</p>
                    <p><span className="font-medium">Employee ID:</span> {selectedRecord.employeeId}</p>
                    <p><span className="font-medium">Designation:</span> {selectedRecord.designation}</p>
                    <p><span className="font-medium">Department:</span> {selectedRecord.department}</p>
                    <p><span className="font-medium">Join Date:</span> {formatDate(selectedRecord.joinDate)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-800">Payment Information</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Payment Date:</span> {formatDate(selectedRecord.paymentDate)}</p>
                    <p><span className="font-medium">Payment Method:</span> {selectedRecord.paymentMethod}</p>
                    <p><span className="font-medium">Status:</span> <span className={selectedRecord.paymentStatus === 'Paid' ? 'text-green-600' : 'text-red-600'}>{selectedRecord.paymentStatus}</span></p>
                  </div>
                </div>
              </div>

              {/* Salary Breakdown */}
              <div className="grid grid-cols-2 gap-8 mb-6">
                {/* Earnings */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700 border-b border-green-200 pb-1">Earnings</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Base Salary:</span>
                      <span>{formatCurrency(selectedRecord.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Allowances:</span>
                      <span>{formatCurrency(selectedRecord.allowances)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overtime:</span>
                      <span>{formatCurrency(selectedRecord.overtime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bonus:</span>
                      <span>{formatCurrency(selectedRecord.bonus)}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold text-green-700">
                      <span>Gross Salary:</span>
                      <span>{formatCurrency(selectedRecord.grossSalary)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-red-700 border-b border-red-200 pb-1">Deductions</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Tax Deduction:</span>
                      <span>{formatCurrency(selectedRecord.taxDeduction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Provident Fund:</span>
                      <span>{formatCurrency(selectedRecord.providentFund)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Insurance:</span>
                      <span>{formatCurrency(selectedRecord.insurance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Deductions:</span>
                      <span>{formatCurrency(selectedRecord.otherDeductions)}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold text-red-700">
                      <span>Total Deductions:</span>
                      <span>{formatCurrency(selectedRecord.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-blue-800">Net Salary:</span>
                  <span className="text-2xl font-bold text-blue-800">{formatCurrency(selectedRecord.netSalary)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-blue-600">Earned Till Date:</span>
                  <span className="text-lg font-semibold text-blue-600">{formatCurrency(calculateCurrentDaySalary(selectedRecord.netSalary))}</span>
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

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .payslip-content, .payslip-content * {
            visibility: visible;
          }
          .payslip-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default PayrollDashboard;
