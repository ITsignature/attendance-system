import React, { useState } from 'react';
import { TextInput, Button, Select, Badge } from "flowbite-react";

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
  paymentStatus: 'Paid' | 'Pending' | 'Processing';
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

  // Sample payroll data for different months
  const payrollData: PayrollData = {
    '2024-06': [
      {
        id: 1, employeeId: 'EMP001', name: 'Leasie Watson', designation: 'Team Lead - Design', department: 'Design',
        joinDate: '2022-01-15', baseSalary: 85000, allowances: 15000, overtime: 5000, bonus: 10000,
        grossSalary: 115000, taxDeduction: 18000, providentFund: 8500, insurance: 2500, otherDeductions: 1000,
        totalDeductions: 30000, netSalary: 85000, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👩‍💼'
      },
      {
        id: 2, employeeId: 'EMP002', name: 'Darlene Robertson', designation: 'Web Designer', department: 'Design',
        joinDate: '2022-03-20', baseSalary: 65000, allowances: 10000, overtime: 3000, bonus: 5000,
        grossSalary: 83000, taxDeduction: 12000, providentFund: 6500, insurance: 2000, otherDeductions: 500,
        totalDeductions: 21000, netSalary: 62000, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👩‍🎨'
      },
      {
        id: 3, employeeId: 'EMP003', name: 'Jacob Jones', designation: 'Medical Assistant', department: 'Healthcare',
        joinDate: '2023-01-10', baseSalary: 55000, allowances: 8000, overtime: 2000, bonus: 3000,
        grossSalary: 68000, taxDeduction: 9000, providentFund: 5500, insurance: 1500, otherDeductions: 0,
        totalDeductions: 16000, netSalary: 52000, paymentStatus: 'Processing', paymentDate: '2024-07-01',
        paymentMethod: 'Bank Transfer', avatar: '👨‍⚕️'
      },
      {
        id: 4, employeeId: 'EMP004', name: 'Kathryn Murphy', designation: 'Marketing Coordinator', department: 'Marketing',
        joinDate: '2022-08-05', baseSalary: 60000, allowances: 9000, overtime: 2500, bonus: 4000,
        grossSalary: 75500, taxDeduction: 10500, providentFund: 6000, insurance: 1800, otherDeductions: 200,
        totalDeductions: 18500, netSalary: 57000, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👩‍💻'
      },
      {
        id: 5, employeeId: 'EMP005', name: 'Leslie Alexander', designation: 'Data Analyst', department: 'Analytics',
        joinDate: '2021-11-12', baseSalary: 70000, allowances: 12000, overtime: 4000, bonus: 6000,
        grossSalary: 92000, taxDeduction: 14000, providentFund: 7000, insurance: 2200, otherDeductions: 800,
        totalDeductions: 24000, netSalary: 68000, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👨‍💼'
      },
      {
        id: 6, employeeId: 'EMP006', name: 'Ronald Richards', designation: 'Python Developer', department: 'Development',
        joinDate: '2022-02-28', baseSalary: 80000, allowances: 14000, overtime: 6000, bonus: 8000,
        grossSalary: 108000, taxDeduction: 16000, providentFund: 8000, insurance: 2400, otherDeductions: 600,
        totalDeductions: 27000, netSalary: 81000, paymentStatus: 'Pending', paymentDate: '2024-07-01',
        paymentMethod: 'Bank Transfer', avatar: '👨‍💻'
      },
      {
        id: 7, employeeId: 'EMP007', name: 'Guy Hawkins', designation: 'UI/UX Designer', department: 'Design',
        joinDate: '2023-04-18', baseSalary: 72000, allowances: 11000, overtime: 3500, bonus: 5500,
        grossSalary: 92000, taxDeduction: 13500, providentFund: 7200, insurance: 2100, otherDeductions: 200,
        totalDeductions: 23000, netSalary: 69000, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👨‍🎨'
      },
      {
        id: 8, employeeId: 'EMP008', name: 'Albert Flores', designation: 'React Developer', department: 'Development',
        joinDate: '2022-06-10', baseSalary: 78000, allowances: 13000, overtime: 5500, bonus: 7000,
        grossSalary: 103500, taxDeduction: 15500, providentFund: 7800, insurance: 2300, otherDeductions: 400,
        totalDeductions: 26000, netSalary: 77500, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👨‍💻'
      },
      {
        id: 9, employeeId: 'EMP009', name: 'Savannah Nguyen', designation: 'iOS Developer', department: 'Development',
        joinDate: '2023-02-14', baseSalary: 75000, allowances: 12500, overtime: 4500, bonus: 6500,
        grossSalary: 98500, taxDeduction: 14500, providentFund: 7500, insurance: 2200, otherDeductions: 300,
        totalDeductions: 24500, netSalary: 74000, paymentStatus: 'Processing', paymentDate: '2024-07-01',
        paymentMethod: 'Bank Transfer', avatar: '👩‍💻'
      },
      {
        id: 10, employeeId: 'EMP010', name: 'Marvin McKinney', designation: 'HR Manager', department: 'Human Resources',
        joinDate: '2021-09-30', baseSalary: 82000, allowances: 16000, overtime: 2000, bonus: 9000,
        grossSalary: 109000, taxDeduction: 17000, providentFund: 8200, insurance: 2600, otherDeductions: 200,
        totalDeductions: 28000, netSalary: 81000, paymentStatus: 'Paid', paymentDate: '2024-06-30',
        paymentMethod: 'Bank Transfer', avatar: '👨‍💼'
      }
    ],
    '2024-05': [
      {
        id: 1, employeeId: 'EMP001', name: 'Leasie Watson', designation: 'Team Lead - Design', department: 'Design',
        joinDate: '2022-01-15', baseSalary: 85000, allowances: 15000, overtime: 4000, bonus: 8000,
        grossSalary: 112000, taxDeduction: 17500, providentFund: 8500, insurance: 2500, otherDeductions: 500,
        totalDeductions: 29000, netSalary: 83000, paymentStatus: 'Paid', paymentDate: '2024-05-31',
        paymentMethod: 'Bank Transfer', avatar: '👩‍💼'
      },
      {
        id: 2, employeeId: 'EMP002', name: 'Darlene Robertson', designation: 'Web Designer', department: 'Design',
        joinDate: '2022-03-20', baseSalary: 65000, allowances: 10000, overtime: 2500, bonus: 4000,
        grossSalary: 81500, taxDeduction: 11500, providentFund: 6500, insurance: 2000, otherDeductions: 0,
        totalDeductions: 20000, netSalary: 61500, paymentStatus: 'Paid', paymentDate: '2024-05-31',
        paymentMethod: 'Bank Transfer', avatar: '👩‍🎨'
      }
    ]
  };

  // Get payroll records for selected month
  const payrollRecords: PayrollRecord[] = payrollData[selectedMonth] || [];

  // Filter records based on search term and status
  const filteredRecords = payrollRecords.filter((record: PayrollRecord) => {
    const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || record.paymentStatus.toLowerCase() === filterStatus.toLowerCase();
    
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
      case 'Processing':
        return <Badge color="warning" size="sm">{status}</Badge>;
      case 'Pending':
        return <Badge color="failure" size="sm">{status}</Badge>;
      default:
        return <Badge color="gray" size="sm">{status}</Badge>;
    }
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
          
          {/* Second row - Filters and Export */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
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
            
            <div>
              <Button color="blue" className="w-full">
                📊 Export Report
              </Button>
            </div>
            
            <div>
              <Button color="green" className="w-full">
                ➕ Add Employee
              </Button>
            </div>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 min-w-[1200px]">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-3 py-3 w-48">Employee</th>
                <th scope="col" className="px-3 py-3 w-24">Department</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Base Salary</th>
                <th scope="col" className="px-3 py-3 w-20 text-right">Allowances</th>
                <th scope="col" className="px-3 py-3 w-20 text-right">Overtime</th>
                <th scope="col" className="px-3 py-3 w-20 text-right">Bonus</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Gross Salary</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Deductions</th>
                <th scope="col" className="px-3 py-3 w-24 text-right">Net Salary</th>
                <th scope="col" className="px-3 py-3 w-20">Status</th>
                <th scope="col" className="px-3 py-3 w-24">Payment Date</th>
                <th scope="col" className="px-3 py-3 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((record: PayrollRecord) => (
                <tr key={record.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-3 py-4 w-48">
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
                  <td className="px-3 py-4 w-24">
                    <div className="text-sm text-gray-900 dark:text-white truncate">{record.department}</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(record.baseSalary)}</div>
                  </td>
                  <td className="px-3 py-4 w-20 text-right">
                    <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(record.allowances)}</div>
                  </td>
                  <td className="px-3 py-4 w-20 text-right">
                    <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(record.overtime)}</div>
                  </td>
                  <td className="px-3 py-4 w-20 text-right">
                    <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(record.bonus)}</div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(record.grossSalary)}</div>
                  </td>
                  <td className="px-3 py-4 w-24">
                    <div className="text-sm text-red-600 dark:text-red-400 text-right">{formatCurrency(record.totalDeductions)}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      <div>Tax: {formatCurrency(record.taxDeduction)}</div>
                      <div>PF: {formatCurrency(record.providentFund)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-4 w-24 text-right">
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(record.netSalary)}</div>
                  </td>
                  <td className="px-3 py-4 w-20">
                    {getStatusBadge(record.paymentStatus)}
                  </td>
                  <td className="px-3 py-4 w-24">
                    <div className="text-sm text-gray-900 dark:text-white">{formatDate(record.paymentDate)}</div>
                    <div className="text-xs text-gray-400">{record.paymentMethod}</div>
                  </td>
                  <td className="px-3 py-4 w-20">
                    <div className="flex flex-col gap-1">
                      <Button size="xs" color="blue">View</Button>
                      <Button size="xs" color="gray">Edit</Button>
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
    </div>
  );
};

export default PayrollDashboard;

// Add this line to make it work with your import pattern
export { PayrollDashboard };