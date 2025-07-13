import React, { useState } from "react";
import { Tabs, Button, Select, Modal, TextInput, Label, Badge } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText, HiCash } from "react-icons/hi";
import { FaEye, FaDownload, FaPlus, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";

const employeeDetails = {
  personal: {
    firstName: "Brooklyn",
    lastName: "Simmons",
    mobile: "(702) 555-0122",
    email: "brooklyn.s@example.com",
    dob: "July 14, 1995",
    maritalStatus: "Married",
    gender: "Female",
    nationality: "America",
    address: "2464 Royal Ln. Mesa, New Jersey",
    city: "California",
    state: "United State",
    zip: "35624",
  },
  professional: {
    empId: "879912390",
    username: "brooklyn_simmons",
    type: "Office",
    email: "brooklyn.s@example.com",
    department: "Project Manager",
    designation: "Project Manager",
    workingDays: "5 Days",
    joiningDate: "July 10, 2022",
    location: "2464 Royal Ln. Mesa, New Jersey",
  },
  documents: [
    "Appointment Letter.pdf",
    "Reliving Letter.pdf",
    "Experience Letter.pdf",
  ],
  attendance: [
    ["July 01, 2023", "09:28 AM", "07:00 PM", "00:30 Min", "09:02 Hrs", "On Time"],
    ["July 02, 2023", "09:20 AM", "07:00 PM", "00:20 Min", "09:20 Hrs", "On Time"],
    ["July 03, 2023", "09:25 AM", "07:00 PM", "00:30 Min", "09:05 Hrs", "On Time"],
    ["July 04, 2023", "09:45 AM", "07:00 PM", "00:40 Min", "08:35 Hrs", "Late"],
    ["July 05, 2023", "10:00 AM", "07:00 PM", "00:30 Min", "08:30 Hrs", "Late"],
  ],
  leave: [
    ["June, 2023", "June 05 - June 08", "3 Days", "Mark Williams", "Pending"],
    ["Apr, 2023", "Apr 06 - Apr 10", "4 Days", "Mark Williams", "Approved"],
    ["Mar, 2023", "Mar 14 - Mar 16", "2 Days", "Mark Williams", "Approved"],
    ["Feb, 2023", "Feb 02 - Feb 10", "8 Days", "Mark Williams", "Approved"],
    ["Jan, 2023", "Jan 16 - Jan 19", "3 Days", "Mark Williams", "Reject"],
  ],
};

interface FieldProps {
  label: string;
  value: string;
}

interface FinancialRecord {
  id: string;
  type: 'salary' | 'advance' | 'loan';
  amount: number;
  date: string;
  monthYear?: string; // Changed to YYYY-MM format for salary slips
  description: string;
  slip?: File | null;
  slipUrl?: string;
  status: 'Paid' | 'Pending' | 'Approved' | 'Rejected';
}

const ViewEmployeeDetails = () => {
  // Mock navigation functions for demo
  const navigate = useNavigate();
  const params = { id: '123' };
  
  const [activeSidebarTab, setActiveSidebarTab] = useState("Profile");
  const [attendanceMonth, setAttendanceMonth] = useState("July , 2023");
  const [leaveMonth, setLeaveMonth] = useState("Jun , 2023");

  // Financial Records State - Updated with more examples
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([
    // 2024 Salary Slips
    {
      id: '1',
      type: 'salary',
      amount: 85000,
      date: '2024-07-31',
      monthYear: '2024-07',
      description: 'Monthly Salary - July 2024',
      slipUrl: 'salary_july_2024.pdf',
      status: 'Paid'
    },
    {
      id: '2',
      type: 'salary',
      amount: 85000,
      date: '2024-06-30',
      monthYear: '2024-06',
      description: 'Monthly Salary - June 2024',
      slipUrl: 'salary_june_2024.pdf',
      status: 'Paid'
    },
    {
      id: '3',
      type: 'salary',
      amount: 82000,
      date: '2024-05-31',
      monthYear: '2024-05',
      description: 'Monthly Salary - May 2024',
      slipUrl: 'salary_may_2024.pdf',
      status: 'Paid'
    },
    {
      id: '4',
      type: 'salary',
      amount: 82000,
      date: '2024-04-30',
      monthYear: '2024-04',
      description: 'Monthly Salary - April 2024',
      slipUrl: 'salary_april_2024.pdf',
      status: 'Paid'
    },
    {
      id: '5',
      type: 'salary',
      amount: 80000,
      date: '2024-03-31',
      monthYear: '2024-03',
      description: 'Monthly Salary - March 2024',
      slipUrl: 'salary_march_2024.pdf',
      status: 'Paid'
    },
    {
      id: '6',
      type: 'salary',
      amount: 80000,
      date: '2024-02-29',
      monthYear: '2024-02',
      description: 'Monthly Salary - February 2024',
      slipUrl: 'salary_feb_2024.pdf',
      status: 'Paid'
    },
    // Advance Payments
    {
      id: '7',
      type: 'advance',
      amount: 15000,
      date: '2024-07-15',
      description: 'Medical Emergency Advance',
      slipUrl: 'advance_july_15.pdf',
      status: 'Approved'
    },
    {
      id: '8',
      type: 'advance',
      amount: 10000,
      date: '2024-06-10',
      description: 'Travel Advance for Business Trip',
      slipUrl: 'advance_june_10.pdf',
      status: 'Paid'
    },
    {
      id: '9',
      type: 'advance',
      amount: 8000,
      date: '2024-05-20',
      description: 'Emergency Home Repair Advance',
      slipUrl: 'advance_may_20.pdf',
      status: 'Paid'
    },
    {
      id: '10',
      type: 'advance',
      amount: 12000,
      date: '2024-04-05',
      description: 'Educational Fee Advance',
      slipUrl: 'advance_april_5.pdf',
      status: 'Approved'
    },
    {
      id: '11',
      type: 'advance',
      amount: 7500,
      date: '2024-03-12',
      description: 'Festival Advance',
      slipUrl: 'advance_march_12.pdf',
      status: 'Paid'
    },
    // Loans
    {
      id: '12',
      type: 'loan',
      amount: 50000,
      date: '2024-06-01',
      description: 'Personal Loan - Housing Down Payment',
      slipUrl: 'loan_housing_agreement.pdf',
      status: 'Approved'
    },
    {
      id: '13',
      type: 'loan',
      amount: 25000,
      date: '2024-04-15',
      description: 'Vehicle Loan - Car Purchase',
      slipUrl: 'loan_vehicle_agreement.pdf',
      status: 'Approved'
    },
    {
      id: '14',
      type: 'loan',
      amount: 15000,
      date: '2024-03-01',
      description: 'Education Loan - Professional Course',
      slipUrl: 'loan_education_agreement.pdf',
      status: 'Paid'
    },
    {
      id: '15',
      type: 'loan',
      amount: 30000,
      date: '2024-02-10',
      description: 'Home Renovation Loan',
      slipUrl: 'loan_renovation_agreement.pdf',
      status: 'Approved'
    },
    // 2023 Records
    {
      id: '16',
      type: 'salary',
      amount: 78000,
      date: '2023-12-31',
      monthYear: '2023-12',
      description: 'Monthly Salary - December 2023',
      slipUrl: 'salary_dec_2023.pdf',
      status: 'Paid'
    },
    {
      id: '17',
      type: 'advance',
      amount: 9000,
      date: '2023-12-20',
      description: 'Year-end Bonus Advance',
      slipUrl: 'advance_dec_20_2023.pdf',
      status: 'Paid'
    },
    {
      id: '18',
      type: 'salary',
      amount: 78000,
      date: '2023-11-30',
      monthYear: '2023-11',
      description: 'Monthly Salary - November 2023',
      slipUrl: 'salary_nov_2023.pdf',
      status: 'Paid'
    }
  ]);

  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [newFinancialRecord, setNewFinancialRecord] = useState<Partial<FinancialRecord>>({
    type: 'salary',
    amount: 0,
    date: '',
    description: '',
    status: 'Pending'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonthYear, setFilterMonthYear] = useState<string>('all'); // NEW: Month/Year filter
  const [currentPage, setCurrentPage] = useState(1); // NEW: Pagination
  const recordsPerPage = 5; // NEW: Records per page

  // Updated sidebar tabs to include Financial Records
  const sidebarTabs = ["Profile", "Attendance", "Leave", "Financial Records"];

  // NEW: Generate month-year options for dropdown
  const generateMonthYearOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // Generate last 12 months + next 3 months
    for (let i = -12; i <= 3; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value: monthYear, label: displayText });
    }
    
    return options;
  };

  // NEW: Check if salary slip already exists for a month
  const isSalarySlipExists = (monthYear: string) => {
    return financialRecords.some(record => 
      record.type === 'salary' && 
      record.monthYear === monthYear
    );
  };

  // NEW: Format month year for display
  const formatMonthYear = (monthYear: string) => {
    if (!monthYear) return '';
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // UPDATED: Add duplicate prevention for salary slips
  const handleAddFinancialRecord = () => {
    if (!newFinancialRecord.amount || !newFinancialRecord.date || !newFinancialRecord.description) {
      alert('Please fill all required fields');
      return;
    }

    // Check for duplicate salary slip
    if (newFinancialRecord.type === 'salary') {
      if (!newFinancialRecord.monthYear) {
        alert('Please select month/year for salary slip');
        return;
      }
      if (isSalarySlipExists(newFinancialRecord.monthYear)) {
        alert('Salary slip for this month already exists!');
        return;
      }
    }

    const record: FinancialRecord = {
      id: Date.now().toString(),
      type: newFinancialRecord.type as 'salary' | 'advance' | 'loan',
      amount: newFinancialRecord.amount,
      date: newFinancialRecord.date,
      description: newFinancialRecord.description,
      slip: selectedFile,
      slipUrl: selectedFile?.name,
      status: newFinancialRecord.status as 'Paid' | 'Pending' | 'Approved' | 'Rejected',
      ...(newFinancialRecord.type === 'salary' && { monthYear: newFinancialRecord.monthYear })
    };

    setFinancialRecords([...financialRecords, record]);
    setShowFinancialModal(false);
    setNewFinancialRecord({
      type: 'salary',
      amount: 0,
      date: '',
      description: '',
      status: 'Pending'
    });
    setSelectedFile(null);
  };

  const handleDeleteFinancialRecord = (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      setFinancialRecords(financialRecords.filter(record => record.id !== id));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-600',
      'Pending': 'bg-yellow-100 text-yellow-600',
      'Approved': 'bg-blue-100 text-blue-600',
      'Rejected': 'bg-red-100 text-red-600'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-600';
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'salary': return <HiBriefcase className="text-green-600 w-5 h-5" />;
      case 'advance': return <HiCash className="text-blue-600 w-5 h-5" />;
      case 'loan': return <HiDocumentText className="text-purple-600 w-5 h-5" />;
      default: return <HiDocumentText className="w-5 h-5" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // NEW: Get unique month/year options from existing records
  const getUniqueMonthYears = () => {
    const monthYears = new Set<string>();
    
    financialRecords.forEach(record => {
      const recordDate = new Date(record.date);
      const monthYear = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
      monthYears.add(monthYear);
    });
    
    return Array.from(monthYears)
      .sort((a, b) => b.localeCompare(a)) // Sort newest first
      .map(monthYear => {
        const [year, month] = monthYear.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const displayText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return { value: monthYear, label: displayText };
      });
  };

  // NEW: Handle summary card clicks to filter by type
  const handleSummaryCardClick = (type: string) => {
    setFilterType(type);
    setCurrentPage(1); // Reset to first page
  };

  // NEW: Filter and paginate records
  const getFilteredAndPaginatedRecords = () => {
    let filtered = financialRecords;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(record => record.type === filterType);
    }
    
    // Filter by month/year
    if (filterMonthYear !== 'all') {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        const recordMonthYear = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
        return recordMonthYear === filterMonthYear;
      });
    }
    
    // Sort by date (newest first)
    const sorted = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Paginate
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const paginated = sorted.slice(startIndex, endIndex);
    
    return {
      records: paginated,
      totalRecords: sorted.length,
      totalPages: Math.ceil(sorted.length / recordsPerPage)
    };
  };

  const { records: paginatedRecords, totalRecords, totalPages } = getFilteredAndPaginatedRecords();

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img
            src="https://via.placeholder.com/60"
            alt="avatar"
            className="w-16 h-16 rounded-full object-cover"
          />
          <div>
            <h4 className="text-lg font-semibold">{employeeDetails.personal.firstName} {employeeDetails.personal.lastName}</h4>
            <p className="text-sm text-gray-500">{employeeDetails.professional.designation}</p>
            <p className="text-sm text-gray-500">{employeeDetails.personal.email}</p>
          </div>
        </div>
        
        {/* PROTECTED: Edit Profile Button - Only for users who can edit employees */}
        <DynamicProtectedComponent permission="employees.edit">
          <Button color="purple" onClick={() => navigate(`/edit-employee/${params.id}`)}>
            Edit Profile
          </Button>
        </DynamicProtectedComponent>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-1/5">
          <div className="bg-gray-100 h-full rounded-lg p-6">
            <ul className="space-y-3">
              {sidebarTabs.map((tab) => (
                <li
                  key={tab}
                  onClick={() => setActiveSidebarTab(tab)}
                  className={`cursor-pointer hover:text-purple-600 transition-colors ${
                    activeSidebarTab === tab
                      ? "text-purple-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  {tab}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-4/5 ps-6">
          {activeSidebarTab === "Profile" && (
            <Tabs aria-label="Employee Info Tabs">
              <Tabs.Item title="Personal Information" icon={HiUser}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {Object.entries(employeeDetails.personal).map(([key, value]) => (
                    <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())} value={value} />
                  ))}
                </div>
              </Tabs.Item>

              <Tabs.Item title="Professional Information" icon={HiBriefcase}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {Object.entries(employeeDetails.professional).map(([key, value]) => (
                    <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())} value={value} />
                  ))}
                </div>
              </Tabs.Item>

              <Tabs.Item title="Documents" icon={HiDocumentText}>
                <div className="space-y-4 mt-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Official Documents</h5>
                    <p className="text-sm text-blue-600">
                      Upload official documents like appointment letters, experience certificates, etc.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employeeDetails.documents.map((file, i) => (
                      <div
                        key={i}
                        className="border border-gray-300 rounded-md px-4 py-3 flex justify-between items-center"
                      >
                        <p className="text-sm font-medium text-gray-700">{file}</p>
                        <div className="flex gap-4 text-purple-600">
                          <FaEye className="cursor-pointer" />
                          <FaDownload className="cursor-pointer" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Tabs.Item>
            </Tabs>
          )}

          {activeSidebarTab === "Attendance" && (
            <div>
              <div className="flex justify-end mb-3">
                <Select
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className="w-fit text-sm"
                >
                  <option>July , 2023</option>
                  <option>June , 2023</option>
                  <option>May , 2023</option>
                </Select>
              </div>
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Check In</th>
                    <th className="p-2">Check Out</th>
                    <th className="p-2">Break</th>
                    <th className="p-2">Working Hours</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDetails.attendance.map(([date, inTime, outTime, breakTime, hours, status], i) => (
                    <tr key={i}>
                      <td className="p-2">{date}</td>
                      <td className="p-2">{inTime}</td>
                      <td className="p-2">{outTime}</td>
                      <td className="p-2">{breakTime}</td>
                      <td className="p-2">{hours}</td>
                      <td className="p-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            status === "Late"
                              ? "bg-red-100 text-red-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSidebarTab === "Leave" && (
            <div>
              <div className="flex justify-end mb-3">
                <Select
                  value={leaveMonth}
                  onChange={(e) => setLeaveMonth(e.target.value)}
                  className="w-fit text-sm"
                >
                  <option>Jun , 2023</option>
                  <option>May , 2023</option>
                  <option>Apr , 2023</option>
                </Select>
              </div>
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-2">Month</th>
                    <th className="p-2">Duration</th>
                    <th className="p-2">Days</th>
                    <th className="p-2">Reporting Manager</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDetails.leave.map(([month, duration, days, manager, status], i) => (
                    <tr key={i}>
                      <td className="p-2">{month}</td>
                      <td className="p-2">{duration}</td>
                      <td className="p-2">{days}</td>
                      <td className="p-2">{manager}</td>
                      <td className="p-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            status === "Approved"
                              ? "bg-green-100 text-green-600"
                              : status === "Reject"
                              ? "bg-red-100 text-red-600"
                              : "bg-yellow-100 text-yellow-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* UPDATED FINANCIAL RECORDS TAB */}
          {activeSidebarTab === "Financial Records" && (
            <div className="space-y-6">
              {/* Header Controls */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold">Financial Records</h3>
                  
                  {/* Month/Year Filter */}
                  <Select
                    value={filterMonthYear}
                    onChange={(e) => {
                      setFilterMonthYear(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-48"
                    sizing="sm"
                  >
                    <option value="all">All Months</option>
                    {getUniqueMonthYears().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  
                  {/* Type Filter */}
                  <Select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-40"
                    sizing="sm"
                  >
                    <option value="all">All Types</option>
                    <option value="salary">Salary Slips</option>
                    <option value="advance">Advance Payments</option>
                    <option value="loan">Loans</option>
                  </Select>
                </div>
                
                {/* PROTECTED: Add Record Button - Only for users who can edit employees */}
                <DynamicProtectedComponent permission="employees.edit">
                  <Button 
                    onClick={() => setShowFinancialModal(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <FaPlus className="mr-2 w-4 h-4" /> Add Record
                  </Button>
                </DynamicProtectedComponent>
              </div>

              {/* Summary Stats - Now Clickable */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  className="bg-green-50 p-4 rounded-lg cursor-pointer hover:bg-green-100 transition-colors border-2 border-transparent hover:border-green-200"
                  onClick={() => handleSummaryCardClick('salary')}
                >
                  <div className="flex items-center">
                    <HiBriefcase className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-green-600 font-medium">Salary Slips</p>
                      <p className="text-xl font-bold text-green-800">
                        {financialRecords.filter(r => r.type === 'salary').length}
                      </p>
                      <p className="text-xs text-green-500">Click to view all</p>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="bg-blue-50 p-4 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border-2 border-transparent hover:border-blue-200"
                  onClick={() => handleSummaryCardClick('advance')}
                >
                  <div className="flex items-center">
                    <HiCash className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Advances</p>
                      <p className="text-xl font-bold text-blue-800">
                        {financialRecords.filter(r => r.type === 'advance').length}
                      </p>
                      <p className="text-xs text-blue-500">Click to view all</p>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="bg-purple-50 p-4 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors border-2 border-transparent hover:border-purple-200"
                  onClick={() => handleSummaryCardClick('loan')}
                >
                  <div className="flex items-center">
                    <HiDocumentText className="h-8 w-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Loans</p>
                      <p className="text-xl font-bold text-purple-800">
                        {financialRecords.filter(r => r.type === 'loan').length}
                      </p>
                      <p className="text-xs text-purple-500">Click to view all</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Status */}
              {(filterType !== 'all' || filterMonthYear !== 'all') && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Filtered by:</span>
                  {filterType !== 'all' && (
                    <Badge color="blue" className="capitalize">
                      {filterType}
                    </Badge>
                  )}
                  {filterMonthYear !== 'all' && (
                    <Badge color="green">
                      {getUniqueMonthYears().find(m => m.value === filterMonthYear)?.label}
                    </Badge>
                  )}
                  <Button
                    size="xs"
                    color="gray"
                    onClick={() => {
                      setFilterType('all');
                      setFilterMonthYear('all');
                      setCurrentPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                  <span className="text-gray-500">({totalRecords} records found)</span>
                </div>
              )}

              {/* Financial Records Grid */}
              <div className="grid gap-4">
                {paginatedRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">📄</div>
                    <h3 className="text-lg font-medium mb-2">No Records Found</h3>
                    <p className="text-sm">
                      {filterType !== 'all' || filterMonthYear !== 'all' 
                        ? 'Try adjusting your filters or add a new record.' 
                        : 'Start by adding your first financial record.'
                      }
                    </p>
                  </div>
                ) : (
                  paginatedRecords.map((record) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getTypeIcon(record.type)}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 capitalize">
                                {record.type}
                                {record.monthYear && ` - ${formatMonthYear(record.monthYear)}`}
                              </h4>
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(record.status)}`}>
                                {record.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{record.description}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-lg font-semibold text-green-600">
                                {formatCurrency(record.amount)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(record.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {record.slipUrl && (
                            <>
                              <Button size="xs" color="blue" className="p-2">
                                <FaEye className="w-3 h-3" />
                              </Button>
                              <Button size="xs" color="green" className="p-2">
                                <FaDownload className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          {/* PROTECTED: Delete Financial Record - Only for users who can edit employees */}
                          <DynamicProtectedComponent permission="employees.edit">
                            <Button 
                              size="xs" 
                              color="red" 
                              className="p-2"
                              onClick={() => handleDeleteFinancialRecord(record.id)}
                            >
                              <FaTrash className="w-3 h-3" />
                            </Button>
                          </DynamicProtectedComponent>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      color="gray"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          size="sm"
                          color={currentPage === page ? "blue" : "gray"}
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    
                    <Button
                      size="sm"
                      color="gray"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* UPDATED Add Financial Record Modal */}
      <Modal show={showFinancialModal} onClose={() => setShowFinancialModal(false)} size="md">
        <Modal.Header>Add Financial Record</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type" value="Type" />
              <Select
                id="type"
                value={newFinancialRecord.type}
                onChange={(e) => setNewFinancialRecord({...newFinancialRecord, type: e.target.value as any})}
              >
                <option value="salary">Salary Slip</option>
                <option value="advance">Advance Payment</option>
                <option value="loan">Loan</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount" value="Amount" />
                <TextInput
                  id="amount"
                  type="number"
                  value={newFinancialRecord.amount || ''}
                  onChange={(e) => setNewFinancialRecord({...newFinancialRecord, amount: Number(e.target.value)})}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label htmlFor="date" value="Date" />
                <TextInput
                  id="date"
                  type="date"
                  value={newFinancialRecord.date}
                  onChange={(e) => setNewFinancialRecord({...newFinancialRecord, date: e.target.value})}
                />
              </div>
            </div>

            {/* UPDATED: Salary month/year dropdown */}
            {newFinancialRecord.type === 'salary' && (
              <div>
                <Label htmlFor="monthYear" value="Month/Year" />
                <Select
                  id="monthYear"
                  value={newFinancialRecord.monthYear || ''}
                  onChange={(e) => setNewFinancialRecord({...newFinancialRecord, monthYear: e.target.value})}
                  required
                >
                  <option value="">Select month</option>
                  {generateMonthYearOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {newFinancialRecord.monthYear && isSalarySlipExists(newFinancialRecord.monthYear) && (
                  <p className="text-red-500 text-sm mt-1">
                    ⚠️ Salary slip for this month already exists!
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="description" value="Description" />
              <TextInput
                id="description"
                value={newFinancialRecord.description}
                onChange={(e) => setNewFinancialRecord({...newFinancialRecord, description: e.target.value})}
                placeholder="Enter description"
              />
            </div>

            <div>
              <Label htmlFor="status" value="Status" />
              <Select
                id="status"
                value={newFinancialRecord.status}
                onChange={(e) => setNewFinancialRecord({...newFinancialRecord, status: e.target.value as any})}
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
                <option value="Rejected">Rejected</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="slip" value="Upload Slip/Document" />
              <div className="mt-2">
                <input
                  id="slip"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-green-600">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleAddFinancialRecord} className="bg-purple-600">
            Add Record
          </Button>
          <Button color="gray" onClick={() => setShowFinancialModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const Field = ({ label, value }: FieldProps) => (
  <div>
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <p className="font-medium text-gray-800 text-sm">{value}</p>
  </div>
);

export default ViewEmployeeDetails;