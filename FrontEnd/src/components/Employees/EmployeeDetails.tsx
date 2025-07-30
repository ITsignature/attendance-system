// EmployeeDetails.tsx - Complete Enhanced Design Matching AddEmployees
import React, { useState, useEffect } from "react";
import { Tabs, Button, Select, Modal, TextInput, Label, Badge, Spinner, Alert, Card, Breadcrumb } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText, HiCash, HiHome, HiCalendar, HiClock, HiPhone, HiMail, HiLocationMarker, HiIdentification } from "react-icons/hi";
import { FaEye, FaDownload, FaPlus, FaTrash, FaEdit } from "react-icons/fa";
import { useNavigate, useParams } from "react-router";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";
import apiService from '../../services/api';

// Types
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  employee_code: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_title?: string;
  manager_id?: string;
  manager_name?: string;
  hire_date: string;
  employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  employee_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  base_salary?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  break_duration?: number;
  total_hours?: number;
  overtime_hours?: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  work_type?: 'office' | 'remote' | 'hybrid';
  notes?: string;
}

interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applied_at: string;
  reviewed_at?: string;
  reviewer_name?: string;
  reviewer_comments?: string;
}

interface FinancialRecord {
  id: string;
  type: 'salary' | 'advance' | 'loan' | 'bonus';
  amount: number;
  date: string;
  monthYear?: string;
  description: string;
  slip?: File | null;
  slipUrl?: string;
  status: 'Paid' | 'Pending' | 'Approved' | 'Rejected';
}

interface FieldProps {
  label: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, value, icon }) => (
  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
    </div>
    <p className="text-base text-gray-900 dark:text-white font-medium">
      {value || 'Not provided'}
    </p>
  </div>
);

const EmployeeDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id: employeeId } = useParams<{ id: string }>();
  
  // State management
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeSidebarTab, setActiveSidebarTab] = useState("Profile");
  
  // Filter states
  const [attendanceMonth, setAttendanceMonth] = useState("2024-07");
  const [leaveMonth, setLeaveMonth] = useState("2024-07");
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonthYear, setFilterMonthYear] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  // Sidebar tabs with icons
  const sidebarTabs = [
    { id: "Profile", label: "Profile", icon: HiUser },
    { id: "Attendance", label: "Attendance", icon: HiClock },
    { id: "Leave", label: "Leave", icon: HiCalendar },
    { id: "Financial Records", label: "Financial", icon: HiCash }
  ];

  // Load employee data on mount
  useEffect(() => {
    if (!employeeId) {
      setError('Employee ID is required');
      setLoading(false);
      return;
    }
    
    loadEmployeeData();
  }, [employeeId]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 Loading employee data for ID:', employeeId);
      
      const response = await apiService.getEmployee(employeeId!);
      
      if (response.success && response.data) {
        const employeeData = response.data.employee;
        setEmployee(employeeData);
        console.log('✅ Employee data loaded:', employeeData);
        
        // Load additional data
        await Promise.all([
          loadAttendanceData(employeeData.id),
          loadLeaveData(employeeData.id),
          loadFinancialData(employeeData.id)
        ]);
        
      } else {
        setError(response.message || 'Failed to load employee data');
      }
    } catch (error: any) {
      console.error('❌ Failed to load employee:', error);
      setError('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async (empId: string) => {
    try {
      // Mock data for now - replace with actual API call
      const mockAttendance: AttendanceRecord[] = [
        {
          id: '1',
          date: '2024-07-01',
          check_in_time: '09:28',
          check_out_time: '19:00',
          break_duration: 30,
          total_hours: 9.02,
          overtime_hours: 1.02,
          status: 'present',
          work_type: 'office'
        },
        {
          id: '2',
          date: '2024-07-02',
          check_in_time: '09:20',
          check_out_time: '19:00',
          break_duration: 20,
          total_hours: 9.20,
          overtime_hours: 1.20,
          status: 'present',
          work_type: 'office'
        },
        {
          id: '3',
          date: '2024-07-03',
          check_in_time: '09:25',
          check_out_time: '19:00',
          break_duration: 30,
          total_hours: 9.05,
          overtime_hours: 1.05,
          status: 'present',
          work_type: 'office'
        },
        {
          id: '4',
          date: '2024-07-04',
          check_in_time: '09:45',
          check_out_time: '19:00',
          break_duration: 40,
          total_hours: 8.35,
          overtime_hours: 0.35,
          status: 'late',
          work_type: 'office'
        },
        {
          id: '5',
          date: '2024-07-05',
          check_in_time: '10:00',
          check_out_time: '19:00',
          break_duration: 30,
          total_hours: 8.30,
          overtime_hours: 0.30,
          status: 'late',
          work_type: 'office'
        }
      ];
      
      setAttendance(mockAttendance);
    } catch (error) {
      console.warn('Failed to load attendance data:', error);
      setAttendance([]);
    }
  };

  const loadLeaveData = async (empId: string) => {
    try {
      // Mock data for now - replace with actual API call
      const mockLeaves: LeaveRecord[] = [
        {
          id: '1',
          leave_type: 'Annual Leave',
          start_date: '2024-06-05',
          end_date: '2024-06-08',
          days_requested: 3,
          reason: 'Family vacation',
          status: 'pending',
          applied_at: '2024-06-01',
          reviewer_name: 'Mark Williams'
        },
        {
          id: '2',
          leave_type: 'Sick Leave',
          start_date: '2024-04-06',
          end_date: '2024-04-10',
          days_requested: 4,
          reason: 'Medical treatment',
          status: 'approved',
          applied_at: '2024-04-01',
          reviewed_at: '2024-04-02',
          reviewer_name: 'Mark Williams'
        },
        {
          id: '3',
          leave_type: 'Personal Leave',
          start_date: '2024-03-14',
          end_date: '2024-03-16',
          days_requested: 2,
          reason: 'Personal matters',
          status: 'approved',
          applied_at: '2024-03-10',
          reviewed_at: '2024-03-11',
          reviewer_name: 'Mark Williams'
        }
      ];
      
      setLeaves(mockLeaves);
    } catch (error) {
      console.warn('Failed to load leave data:', error);
      setLeaves([]);
    }
  };

  const loadFinancialData = async (empId: string) => {
    try {
      // Mock financial data - replace with actual API call
      const mockFinancial: FinancialRecord[] = [
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
          type: 'bonus',
          amount: 15000,
          date: '2024-06-15',
          description: 'Performance Bonus Q2 2024',
          status: 'Paid'
        }
      ];
      
      setFinancialRecords(mockFinancial);
    } catch (error) {
      console.warn('Failed to load financial data:', error);
      setFinancialRecords([]);
    }
  };

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    return new Date(`2000-01-01 ${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatHours = (hours?: number) => {
    if (hours === undefined || hours === null) return 'N/A';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')} Hrs`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'paid':
      case 'present':
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
      case 'cancelled':
      case 'absent':
      case 'terminated':
        return 'failure';
      case 'late':
      case 'on_leave':
        return 'warning';
      default:
        return 'gray';
    }
  };

  const getFilteredFinancialRecords = () => {
    let filtered = financialRecords;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(record => record.type === filterType);
    }
    
    if (filterMonthYear !== 'all') {
      filtered = filtered.filter(record => record.monthYear === filterMonthYear);
    }
    
    return filtered;
  };

  const getPaginatedRecords = () => {
    const filtered = getFilteredFinancialRecords();
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const getUniqueMonthYears = () => {
    const monthYears = financialRecords
      .filter(record => record.monthYear)
      .map(record => record.monthYear!)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => b.localeCompare(a));
    
    return monthYears.map(monthYear => {
      const [year, month] = monthYear.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        value: monthYear,
        label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner size="xl" />
          <span className="ml-3 text-lg">Loading employee details...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !employee) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Alert color="failure">
          <span className="font-medium">Error!</span> {error || 'Employee not found'}
        </Alert>
      </div>
    );
  }

  return (
    <DynamicProtectedComponent permission="employees.view">
      <div className="max-w-6xl mx-auto p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <Breadcrumb.Item href="/dashboard" icon={HiHome}>
            Dashboard
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/employees">
            Employees
          </Breadcrumb.Item>
          <Breadcrumb.Item>{employee.full_name}</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img
                src="https://via.placeholder.com/80"
                alt="Employee Avatar"
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {employee.first_name} {employee.last_name}
                </h1>
                <div className="flex items-center gap-4 mb-2">
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    {employee.designation_title || 'No designation'}
                  </p>
                  <Badge 
                    color={getStatusBadgeColor(employee.employment_status)}
                    size="sm"
                  >
                    {employee.employment_status.charAt(0).toUpperCase() + employee.employment_status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <HiMail className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">{employee.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HiIdentification className="w-4 h-4 text-gray-500" />
                    <Badge color="gray" size="sm">{employee.employee_code}</Badge>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <DynamicProtectedComponent permission="employees.edit">
                <Button color="purple" onClick={() => navigate(`/edit-employee/${employee.id}`)}>
                  <FaEdit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </DynamicProtectedComponent>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {sidebarTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSidebarTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeSidebarTab === tab.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <div className="p-6">
            {/* Profile Tab */}
            {activeSidebarTab === "Profile" && (
              <div className="space-y-8">
                {/* Personal Information Section */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiUser className="w-6 h-6 text-purple-600" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="First Name" value={employee.first_name} />
                    <Field label="Last Name" value={employee.last_name} />
                    <Field 
                      label="Email" 
                      value={employee.email} 
                      icon={<HiMail className="w-4 h-4 text-gray-500" />}
                    />
                    <Field 
                      label="Phone" 
                      value={employee.phone} 
                      icon={<HiPhone className="w-4 h-4 text-gray-500" />}
                    />
                    <Field label="Date of Birth" value={employee.date_of_birth ? formatDate(employee.date_of_birth) : undefined} />
                    <Field label="Gender" value={employee.gender} />
                    <Field label="Marital Status" value={employee.marital_status} />
                    <Field label="Nationality" value={employee.nationality} />
                    <Field 
                      label="Address" 
                      value={employee.address} 
                      icon={<HiLocationMarker className="w-4 h-4 text-gray-500" />}
                    />
                    <Field label="City" value={employee.city} />
                    <Field label="State" value={employee.state} />
                    <Field label="ZIP Code" value={employee.zip_code} />
                  </div>
                </div>

                {/* Professional Information Section */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiBriefcase className="w-6 h-6 text-purple-600" />
                    Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="Employee Code" value={employee.employee_code} />
                    <Field label="Department" value={employee.department_name} />
                    <Field label="Designation" value={employee.designation_title} />
                    <Field label="Manager" value={employee.manager_name} />
                    <Field label="Hire Date" value={formatDate(employee.hire_date)} />
                    <Field label="Employment Status" value={employee.employment_status} />
                    <Field label="Employee Type" value={employee.employee_type} />
                    <Field label="Base Salary" value={employee.base_salary ? `$${employee.base_salary.toLocaleString()}` : undefined} />
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiPhone className="w-6 h-6 text-purple-600" />
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Contact Name" value={employee.emergency_contact_name} />
                    <Field label="Contact Phone" value={employee.emergency_contact_phone} />
                    <Field label="Relationship" value={employee.emergency_contact_relation} />
                  </div>
                </div>

                {/* Documents Section */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiDocumentText className="w-6 h-6 text-purple-600" />
                    Documents
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="space-y-3">
                      {/* Mock documents - replace with actual document management */}
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <HiDocumentText className="w-5 h-5 text-gray-500" />
                          <span className="text-sm font-medium">Appointment Letter.pdf</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="xs" color="gray">
                            <FaEye className="w-3 h-3" />
                          </Button>
                          <Button size="xs" color="gray">
                            <FaDownload className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <HiDocumentText className="w-5 h-5 text-gray-500" />
                          <span className="text-sm font-medium">Experience Certificate.pdf</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="xs" color="gray">
                            <FaEye className="w-3 h-3" />
                          </Button>
                          <Button size="xs" color="gray">
                            <FaDownload className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <DynamicProtectedComponent permission="employees.edit">
                        <Button size="sm" color="purple" className="mt-4">
                          <FaPlus className="w-3 h-3 mr-2" />
                          Upload Document
                        </Button>
                      </DynamicProtectedComponent>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeSidebarTab === "Attendance" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <HiClock className="w-6 h-6 text-purple-600" />
                    Attendance Records
                  </h3>
                  <Select
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value)}
                    className="w-48"
                  >
                    <option value="2024-07">July 2024</option>
                    <option value="2024-06">June 2024</option>
                    <option value="2024-05">May 2024</option>
                  </Select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Check In</th>
                        <th className="px-6 py-3">Check Out</th>
                        <th className="px-6 py-3">Break</th>
                        <th className="px-6 py-3">Total Hours</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record) => (
                        <tr key={record.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-6 py-4">{formatTime(record.check_in_time)}</td>
                          <td className="px-6 py-4">{formatTime(record.check_out_time)}</td>
                          <td className="px-6 py-4">{record.break_duration || 0} min</td>
                          <td className="px-6 py-4">{formatHours(record.total_hours)}</td>
                          <td className="px-6 py-4">
                            <Badge color={getStatusBadgeColor(record.status)} size="sm">
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Attendance Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Present Days</h4>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {attendance.filter(a => a.status === 'absent').length}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Avg Hours</h4>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatHours(attendance.reduce((sum, a) => sum + (a.total_hours || 0), 0) / attendance.length)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Leave Tab */}
            {activeSidebarTab === "Leave" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <HiCalendar className="w-6 h-6 text-purple-600" />
                    Leave Records
                  </h3>
                  <Select
                    value={leaveMonth}
                    onChange={(e) => setLeaveMonth(e.target.value)}
                    className="w-48"
                  >
                    <option value="2024-07">July 2024</option>
                    <option value="2024-06">June 2024</option>
                    <option value="2024-05">May 2024</option>
                  </Select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-6 py-3">Leave Type</th>
                        <th className="px-6 py-3">Date Range</th>
                        <th className="px-6 py-3">Days</th>
                        <th className="px-6 py-3">Reason</th>
                        <th className="px-6 py-3">Reviewed By</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((leave) => (
                        <tr key={leave.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {leave.leave_type}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p>{formatDate(leave.start_date)} - {formatDate(leave.end_date)}</p>
                              <p className="text-xs text-gray-500">
                                Applied: {formatDate(leave.applied_at)}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">{leave.days_requested} Days</td>
                          <td className="px-6 py-4">
                            <div className="max-w-xs">
                              <p className="truncate" title={leave.reason}>{leave.reason}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">{leave.reviewer_name || 'N/A'}</td>
                          <td className="px-6 py-4">
                            <Badge color={getStatusBadgeColor(leave.status)} size="sm">
                              {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Leave Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Total Requests</h4>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{leaves.length}</p>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Approved</h4>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {leaves.filter(l => l.status === 'approved').length}
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Pending</h4>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                      {leaves.filter(l => l.status === 'pending').length}
                    </p>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Rejected</h4>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {leaves.filter(l => l.status === 'rejected').length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Records Tab */}
            {activeSidebarTab === "Financial Records" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <HiCash className="w-6 h-6 text-purple-600" />
                    Financial Records
                  </h3>
                  
                  <div className="flex items-center gap-4">
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
                    
                    <Select
                      value={filterType}
                      onChange={(e) => {
                        setFilterType(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-32"
                      sizing="sm"
                    >
                      <option value="all">All Types</option>
                      <option value="salary">Salary</option>
                      <option value="bonus">Bonus</option>
                      <option value="advance">Advance</option>
                      <option value="loan">Loan</option>
                    </Select>

                    <DynamicProtectedComponent permission="payroll.view">
                      <Button size="sm" color="purple">
                        <FaPlus className="w-3 h-3 mr-2" />
                        Add Record
                      </Button>
                    </DynamicProtectedComponent>
                  </div>
                </div>

                {/* Financial Records Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Amount</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedRecords().map((record) => (
                        <tr key={record.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-6 py-4">
                            <Badge 
                              color={record.type === 'salary' ? 'blue' : record.type === 'bonus' ? 'green' : 'gray'}
                              size="sm"
                            >
                              {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            ${record.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="max-w-xs">
                              <p className="truncate" title={record.description}>{record.description}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-6 py-4">
                            <Badge color={getStatusBadgeColor(record.status)} size="sm">
                              {record.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {record.slipUrl && (
                                <>
                                  <Button size="xs" color="gray" title="View Slip">
                                    <FaEye className="w-3 h-3" />
                                  </Button>
                                  <Button size="xs" color="gray" title="Download Slip">
                                    <FaDownload className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              <DynamicProtectedComponent permission="payroll.edit">
                                <Button size="xs" color="red" title="Delete Record">
                                  <FaTrash className="w-3 h-3" />
                                </Button>
                              </DynamicProtectedComponent>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {getFilteredFinancialRecords().length > recordsPerPage && (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {((currentPage - 1) * recordsPerPage) + 1} to{" "}
                      {Math.min(currentPage * recordsPerPage, getFilteredFinancialRecords().length)} of{" "}
                      {getFilteredFinancialRecords().length} records
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color="gray"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        color="gray"
                        disabled={currentPage * recordsPerPage >= getFilteredFinancialRecords().length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Total Salary (YTD)</h4>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                      ${financialRecords
                        .filter(r => r.type === 'salary')
                        .reduce((sum, r) => sum + r.amount, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Total Bonuses</h4>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                      ${financialRecords
                        .filter(r => r.type === 'bonus')
                        .reduce((sum, r) => sum + r.amount, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Current Salary</h4>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                      ${employee.base_salary?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions Footer */}
        <div className="mt-8 flex justify-between items-center">
          <Button color="gray" onClick={() => navigate('/employees')}>
            ← Back to Employees
          </Button>
          
          <div className="flex gap-3">
            <DynamicProtectedComponent permission="employees.edit">
              <Button color="light">
                Generate Report
              </Button>
            </DynamicProtectedComponent>
            
            <DynamicProtectedComponent permission="employees.edit">
              <Button color="purple">
                <FaEdit className="w-4 h-4 mr-2" />
                Quick Edit
              </Button>
            </DynamicProtectedComponent>
          </div>
        </div>
      </div>
    </DynamicProtectedComponent>
  );
};

export default EmployeeDetails;