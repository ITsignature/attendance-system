// EmployeeDetails.tsx - Complete Enhanced Design with Updated Attendance and Leave tabs
import React, { useState, useEffect } from "react";
import { Tabs, Button, Select, Modal, TextInput, Label, Badge, Spinner, Alert, Card, Breadcrumb, Table } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText, HiCash, HiHome, HiCalendar, HiClock, HiPhone, HiMail, HiLocationMarker, HiIdentification, HiRefresh } from "react-icons/hi";
import { FaEye, FaDownload, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate, useParams } from "react-router";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";
import apiService from '../../services/api';
import leaveApiService from '../../services/leaveApi';
import payrollApiService, { PayrollRecord } from '../../services/payrollService';

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
  // Added work schedule fields
  in_time?: string;
  out_time?: string;
  follows_company_schedule?: boolean;
  weekend_working_config?: {
    saturday?: {
      working: boolean;
      in_time: string;
      out_time: string;
      full_day_salary: boolean;
    };
    sunday?: {
      working: boolean;
      in_time: string;
      out_time: string;
      full_day_salary: boolean;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  break_duration?: number;
  arrival_status: 'on_time' | 'late' | 'absent';
  work_duration: 'full_day' | 'half_day' | 'short_leave' | 'on_leave';
  work_type: 'office' | 'remote' | 'hybrid';
  notes?: string;
  scheduled_in_time?: string;
  scheduled_out_time?: string;
  follows_company_schedule?: boolean;
  department_name?: string;
  created_at: string;
  updated_at: string;
}

interface LeaveRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_duration: 'full_day' | 'half_day' | 'short_leave';
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applied_at: string;
  reviewed_at?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewer_comments?: string;
  admin_notes?: string;
  supporting_documents?: any[];
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
  payrollRecord?: PayrollRecord;
  canDownloadSlip?: boolean;
}

interface EmployeeDocument {
  id: string;
  document_type: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  notes?: string;
  uploaded_by_name?: string;
}

interface FieldProps {
  label: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
}

interface AttendanceFilters {
  startDate: string;
  endDate: string;
  arrival_status: string;
  work_duration: string;
}

interface LeaveFilters {
  status: string;
  year: string;
  month: string;
}

const Field: React.FC<FieldProps> = ({ label, value, icon }) => (
  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
    </div>
    <p
      className={`text-base font-medium ${
        value ? "text-gray-900 dark:text-white" : "text-gray-300"
      }`}
    >
      {value || "Not provided"}
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
  const [documents, setDocuments] = useState<{[key: string]: EmployeeDocument[]}>({});
  const [financialLoading, setFinancialLoading] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState<any>(null);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [addingRecord, setAddingRecord] = useState(false);
  const [newRecordData, setNewRecordData] = useState({
    type: 'loan' as 'loan' | 'advance' | 'bonus',
    amount: '',
    description: '',
    loanType: 'personal',
    interestRate: '',
    tenureMonths: '',
    startDate: new Date().toISOString().split('T')[0],
    bonusType: 'performance',
    bonusPeriod: '',
    advanceType: 'salary',
    deductionMonths: '1',
    requiredDate: '',
    justification: '',
    notes: ''
  });
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeSidebarTab, setActiveSidebarTab] = useState("Profile");
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [leavesLoading, setLeavesLoading] = useState(false);
  
  // Get today's date in YYYY-MM-DD format
  const todayStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Get first day of current month
  const firstDayOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  };

  // Attendance Filter states
  const [attendanceFilters, setAttendanceFilters] = useState<AttendanceFilters>({
    startDate: firstDayOfMonth(),
    endDate: todayStr(),
    arrival_status: '',
    work_duration: ''
  });

  // Leave Filter states
  const [leaveFilters, setLeaveFilters] = useState<LeaveFilters>({
    status: '',
    year: new Date().getFullYear().toString(),
    month: ''
  });

  // Filter states for Financial Records (keeping existing)
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

  // Load attendance when filters change
  useEffect(() => {
    if (employee && activeSidebarTab === "Attendance") {
      loadAttendanceData(employee.id);
    }
  }, [attendanceFilters, activeSidebarTab]);

  // Load leaves when filters change
  useEffect(() => {
    if (employee && activeSidebarTab === "Leave") {
      loadLeaveData(employee.id);
    }
  }, [leaveFilters, activeSidebarTab]);

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
          loadFinancialData(employeeData.id),
          loadDocuments(employeeData.id)
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
      setAttendanceLoading(true);
      
      // Build query parameters for attendance
      const params = new URLSearchParams();
      params.append('employeeId', empId);
      params.append('startDate', attendanceFilters.startDate);
      params.append('endDate', attendanceFilters.endDate);
      params.append('limit', '1000'); // Get all records, no pagination
      
      if (attendanceFilters.arrival_status) {
        params.append('arrival_status', attendanceFilters.arrival_status);
      }
      if (attendanceFilters.work_duration) {
        params.append('work_duration', attendanceFilters.work_duration);
      }
      
      const response = await apiService.getAttendanceRecords(params.toString());
      
      if (response.success && response.data) {
        setAttendance(response.data.attendance || []);
      } else {
        setAttendance([]);
      }
    } catch (error) {
      console.warn('Failed to load attendance data:', error);
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadLeaveData = async (empId: string) => {
    try {
      setLeavesLoading(true);
      
      // Fetch all leave requests and filter for this employee
      const response = await leaveApiService.getAllLeaveRequests({
        employee_id: empId
      });
      
      if (response.success && response.data) {
        let leaveRequests = Array.isArray(response.data) 
          ? response.data 
          : (response.data.requests || []);
        
        // Filter by status if selected
        if (leaveFilters.status) {
          leaveRequests = leaveRequests.filter(req => req.status === leaveFilters.status);
        }
        
        // Filter by year
        if (leaveFilters.year) {
          leaveRequests = leaveRequests.filter(req => {
            const year = new Date(req.start_date).getFullYear().toString();
            return year === leaveFilters.year;
          });
        }
        
        // Filter by month
        if (leaveFilters.month) {
          leaveRequests = leaveRequests.filter(req => {
            const month = (new Date(req.start_date).getMonth() + 1).toString();
            return month === leaveFilters.month;
          });
        }
        
        setLeaves(leaveRequests);
      } else {
        setLeaves([]);
      }
    } catch (error) {
      console.warn('Failed to load leave data:', error);
      setLeaves([]);
    } finally {
      setLeavesLoading(false);
    }
  };

  const loadFinancialData = async (empId: string) => {
    try {
      setFinancialLoading(true);
      console.log('🔄 Loading financial data for employee:', empId);

      // Get financial records from our new API
      const response = await loadFinancialRecordsFromAPI(empId);

      if (response && response.length > 0) {
        setFinancialRecords(response);
        console.log('✅ Financial data loaded:', response.length, 'records');

        // Calculate summary from the loaded records
        const totalEarned = response.reduce((sum, record) => sum + record.amount, 0);
        setPayrollSummary({
          total_records: response.length,
          total_earned: totalEarned,
          average_salary: response.length > 0 ? totalEarned / response.length : 0,
          highest_salary: Math.max(...response.map(r => r.amount), 0),
          lowest_salary: Math.min(...response.map(r => r.amount), 0)
        });
      } else {
        console.warn('No financial records found for employee');
        setFinancialRecords([]);
        setPayrollSummary(null);
      }
    } catch (error) {
      console.error('❌ Failed to load financial data:', error);
      setFinancialRecords([]);
      setPayrollSummary(null);
    } finally {
      setFinancialLoading(false);
    }
  };

  const loadDocuments = async (empId: string) => {
    try {
      console.log('🔄 Loading documents for employee:', empId);
      
      const response = await apiService.apiCall(`/api/employees/${empId}/documents`);
      
      if (response.success && response.data) {
        console.log('✅ Documents loaded:', response.data.documents);
        setDocuments(response.data.documents || {});
      } else {
        console.warn('Failed to load documents:', response.message);
        setDocuments({});
      }
    } catch (error) {
      console.warn('Failed to load documents:', error);
      setDocuments({});
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
      
      // Get client ID for multi-tenant support
      const userData = localStorage.getItem('user');
      let clientId = null;
      if (userData) {
        try {
          const user = JSON.parse(userData);
          clientId = user.clientId;
        } catch {
          console.warn('Failed to parse user data for client ID');
        }
      }

      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
      };
      
      if (clientId) {
        headers['X-Client-ID'] = clientId;
      }

      const response = await fetch(
        `${baseURL}/api/employees/${employeeId}/documents/${documentId}/download`,
        {
          method: 'GET',
          headers
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        setError('Failed to download document');
      }
    } catch (error) {
      console.error('Failed to download document:', error);
      setError('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    return '📁';
  };

  // Handle terminate employee
  const handleTerminateEmployee = async () => {
    if (!employee) return;
    
    try {
      setTerminating(true);
      const response = await apiService.updateEmployee(employee.id, {
        employment_status: 'terminated'
      });
      
      if (response.success) {
        setEmployee(prev => prev ? { ...prev, employment_status: 'terminated' } : null);
        setShowTerminateModal(false);
      } else {
        setError(response.message || 'Failed to terminate employee');
      }
    } catch (err: any) {
      console.error('Failed to terminate employee:', err);
      setError(err.message || 'Failed to terminate employee');
    } finally {
      setTerminating(false);
    }
  };

  // Helper functions
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    try {
      // Handle both HH:MM and HH:MM:SS formats
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timeString;
    }
  };

  // Helper functions for financial data
  const formatMonthYear = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatMonthYearDescription = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  };

  const mapPaymentStatus = (status: string): 'Paid' | 'Pending' | 'Approved' | 'Rejected' => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'processing': return 'Approved';
      case 'failed': return 'Rejected';
      default: return 'Pending';
    }
  };

  // Handle payslip download
  const handleDownloadPayslip = async (recordId: string, description: string) => {
    try {
      console.log('🔄 Downloading payslip for record:', recordId);
      const response = await payrollApiService.getPayslip(recordId);

      if (response.success && response.data) {
        // Generate and download PDF from payslip data
        generatePayslipPDF(response.data, description);
      } else {
        setError('Failed to generate payslip');
      }
    } catch (error) {
      console.error('❌ Failed to download payslip:', error);
      setError('Failed to download payslip');
    }
  };

  // Handle adding new financial record
  const handleAddFinancialRecord = async () => {
    try {
      setAddingRecord(true);
      console.log('🔄 Adding financial record:', newRecordData);

      // Validate form data
      const validation = validateFinancialRecord(newRecordData);
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      // Prepare API payload based on record type
      let apiPayload: any = {
        employee_id: employee?.id,
        type: newRecordData.type,
        amount: parseFloat(newRecordData.amount),
        description: newRecordData.description,
        notes: newRecordData.notes,
        created_by: 'current_user' // This should come from auth context
      };

      // Add type-specific fields
      if (newRecordData.type === 'loan') {
        apiPayload = {
          ...apiPayload,
          loan_type: newRecordData.loanType,
          interest_rate: parseFloat(newRecordData.interestRate) || 0,
          tenure_months: parseInt(newRecordData.tenureMonths) || 12,
          start_date: newRecordData.startDate
        };
      } else if (newRecordData.type === 'advance') {
        apiPayload = {
          ...apiPayload,
          advance_type: newRecordData.advanceType,
          deduction_months: parseInt(newRecordData.deductionMonths) || 1,
          required_date: newRecordData.requiredDate,
          justification: newRecordData.justification
        };
      } else if (newRecordData.type === 'bonus') {
        apiPayload = {
          ...apiPayload,
          bonus_type: newRecordData.bonusType,
          bonus_period: newRecordData.bonusPeriod,
          effective_date: new Date().toISOString().split('T')[0]
        };
      }

      // Call appropriate API based on record type
      let response;
      switch (newRecordData.type) {
        case 'loan':
          response = await createEmployeeLoan(apiPayload);
          break;
        case 'advance':
          response = await createAdvancePayment(apiPayload);
          break;
        case 'bonus':
          response = await createBonusRecord(apiPayload);
          break;
        default:
          throw new Error('Invalid record type');
      }

      if (response.success) {
        // Refresh financial data
        await loadFinancialData(employee!.id);

        // Reset form and close modal
        setNewRecordData({
          type: 'loan',
          amount: '',
          description: '',
          loanType: 'personal',
          interestRate: '',
          tenureMonths: '',
          startDate: new Date().toISOString().split('T')[0],
          bonusType: 'performance',
          bonusPeriod: '',
          advanceType: 'salary',
          deductionMonths: '1',
          requiredDate: '',
          justification: '',
          notes: ''
        });
        setShowAddRecordModal(false);

        console.log('✅ Financial record added successfully');
      } else {
        setError(response.message || 'Failed to add financial record');
      }
    } catch (error: any) {
      console.error('❌ Failed to add financial record:', error);
      setError(error.message || 'Failed to add financial record');
    } finally {
      setAddingRecord(false);
    }
  };

  // Validate financial record data
  const validateFinancialRecord = (data: typeof newRecordData) => {
    const errors: string[] = [];

    if (!data.amount || parseFloat(data.amount) <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!data.description.trim()) {
      errors.push('Description is required');
    }

    if (data.type === 'loan') {
      if (!data.tenureMonths || parseInt(data.tenureMonths) <= 0) {
        errors.push('Tenure months must be greater than 0');
      }
      if (data.interestRate && parseFloat(data.interestRate) < 0) {
        errors.push('Interest rate cannot be negative');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // API functions for creating financial records
  const createEmployeeLoan = async (data: any) => {
    return apiService.apiCall('/api/employees/loans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  };

  const createAdvancePayment = async (data: any) => {
    return apiService.apiCall('/api/employees/advances', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        advance_type: data.advance_type || 'salary',
        deduction_months: parseInt(data.deduction_months) || 1
      })
    });
  };

  const createBonusRecord = async (data: any) => {
    return apiService.apiCall('/api/employees/bonuses', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        bonus_type: data.bonus_type || 'performance',
        effective_date: data.effective_date || new Date().toISOString().split('T')[0]
      })
    });
  };

  // Load financial records from dedicated endpoints
  const loadFinancialRecordsFromAPI = async (empId: string) => {
    try {
      const response = await apiService.apiCall(`/api/employees/${empId}/financial-records`);

      if (response.success && response.data) {
        const records = response.data.map((record: any) => ({
          id: record.id,
          type: record.type,
          amount: record.amount,
          date: record.created_at?.split('T')[0] || record.effective_date || record.start_date || record.request_date,
          monthYear: formatMonthYear(record.created_at || record.effective_date || record.start_date || record.request_date),
          description: record.description || `${record.type} - ${record.loan_type || record.advance_type || record.bonus_type}`,
          status: mapFinancialStatus(record.status),
          canDownloadSlip: record.status === 'paid' || record.status === 'approved',
          financialRecord: record
        }));

        setFinancialRecords(records);
        setPayrollSummary(response.summary);
        return records;
      }
    } catch (error) {
      console.error('Failed to load financial records from API:', error);
      return [];
    }
  };

  // Map financial record status to display status
  const mapFinancialStatus = (status: string): 'Paid' | 'Pending' | 'Approved' | 'Rejected' => {
    switch (status) {
      case 'paid':
      case 'completed': return 'Paid';
      case 'approved':
      case 'active': return 'Approved';  // Active loans/advances/bonuses are approved
      case 'pending': return 'Pending';
      case 'rejected':
      case 'cancelled': return 'Rejected';
      default: return 'Pending';
    }
  };

  // Generate PDF from payslip data (you can use libraries like jsPDF or html2pdf)
  const generatePayslipPDF = (payslipData: any, filename: string) => {
    // For now, create a simple download with JSON data
    // In production, you'd use a proper PDF generation library
    const dataStr = JSON.stringify(payslipData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatHours = (hours?: number) => {
    if (hours === undefined || hours === null) return 'N/A';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')} Hrs`;
  };

  // Attendance status badges
  const getArrivalStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return <Badge color="gray">Unknown</Badge>;
    }
    
    const colors: { [key: string]: any } = {
      'on_time': 'success',
      'late': 'warning', 
      'absent': 'failure'
    };
    return <Badge color={colors[status] || 'gray'}>{status.replace('_', ' ')}</Badge>;
  };

  const getWorkDurationBadge = (duration?: string | null) => {
    const label = duration ? duration.replace(/_/g, ' ') : 'N/A';
    const colorMap: Record<string, any> = {
      full_day: 'success',
      half_day: 'info',
      short_leave: 'warning',
      on_leave: 'purple',
    };
    const color = duration ? (colorMap[duration] ?? 'gray') : 'gray';
    return <Badge color={color}>{label}</Badge>;
  };

  const getWorkTypeBadge = (type?: string | null) => {
    const label = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'N/A';
    const colorMap: Record<string, any> = {
      office: 'blue',
      remote: 'green',
      hybrid: 'purple',
    };
    const color = type ? (colorMap[type] ?? 'gray') : 'gray';
    return <Badge color={color}>{label}</Badge>;
  };

  // Leave status badge
  const getLeaveStatusBadge = (status: string) => {
    const colors: Record<string, any> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'failure',
      cancelled: 'gray'
    };
    return <Badge color={colors[status] || 'gray'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>;
  };

  const getLeaveTypeColor = (leaveType: string) => {
    const colors: Record<string, string> = {
      'Annual Leave': 'blue',
      'Sick Leave': 'red',
      'Personal Leave': 'purple',
      'Emergency Leave': 'yellow',
      'Maternity Leave': 'pink',
      'Paternity Leave': 'green'
    };
    return colors[leaveType] || 'gray';
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

  // Generate year options for leave filter
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i.toString());
    }
    return years;
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
              
              <DynamicProtectedComponent permission="employees.delete">
                <Button 
                  color="failure" 
                  onClick={() => setShowTerminateModal(true)}
                  disabled={employee.employment_status === 'terminated'}
                >
                  <FaTrash className="w-4 h-4 mr-2" />
                  {employee.employment_status === 'terminated' ? 'Terminated' : 'Terminate'}
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
                    
                    {/* Enhanced Base Salary Field */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border-2 border-purple-200 dark:border-purple-800 shadow-md">
                      <div className="flex items-center gap-2 mb-2">
                        <HiCash className="w-5 h-5 text-purple-600" />
                        <p className="text-sm font-bold text-purple-800 dark:text-purple-200">Base Salary (Monthly)</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {employee.base_salary ? `LKR ${employee.base_salary.toLocaleString()}` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Work Schedule Section */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiClock className="w-6 h-6 text-purple-600" />
                    Work Schedule
                  </h3>

                  {/* Regular Work Schedule */}
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Regular Working Days</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field
                        label="In Time"
                        value={employee.in_time ? formatTime(employee.in_time) : undefined}
                        icon={<HiClock className="w-4 h-4 text-gray-500" />}
                      />
                      <Field
                        label="Out Time"
                        value={employee.out_time ? formatTime(employee.out_time) : undefined}
                        icon={<HiClock className="w-4 h-4 text-gray-500" />}
                      />
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <HiClock className="w-4 h-4 text-gray-500" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Follows Company Schedule</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            color={employee.follows_company_schedule ? 'green' : 'gray'}
                            size="sm"
                          >
                            {employee.follows_company_schedule ? 'Yes' : 'No'}
                          </Badge>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {employee.follows_company_schedule ? 'Uses company standard hours' : 'Custom schedule'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weekend Working Configuration */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Weekend Working Days</h4>

                    {employee.weekend_working_config ? (
                      <div className="space-y-4">
                        {/* Saturday Configuration */}
                        {employee.weekend_working_config.saturday?.working && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge color="green" size="sm">Saturday Working</Badge>
                              {employee.weekend_working_config.saturday.full_day_salary && (
                                <Badge color="blue" size="sm">Full Day Salary</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Field
                                label="Saturday In Time"
                                value={formatTime(employee.weekend_working_config.saturday.in_time)}
                                icon={<HiClock className="w-4 h-4 text-green-600" />}
                              />
                              <Field
                                label="Saturday Out Time"
                                value={formatTime(employee.weekend_working_config.saturday.out_time)}
                                icon={<HiClock className="w-4 h-4 text-green-600" />}
                              />
                            </div>
                            <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                              <span className="font-medium">Salary Type:</span> {employee.weekend_working_config.saturday.full_day_salary ? 'Full weekday salary weight' : 'Proportional to hours worked'}
                            </div>
                          </div>
                        )}

                        {/* Sunday Configuration */}
                        {employee.weekend_working_config.sunday?.working && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge color="blue" size="sm">Sunday Working</Badge>
                              {employee.weekend_working_config.sunday.full_day_salary && (
                                <Badge color="purple" size="sm">Full Day Salary</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Field
                                label="Sunday In Time"
                                value={formatTime(employee.weekend_working_config.sunday.in_time)}
                                icon={<HiClock className="w-4 h-4 text-blue-600" />}
                              />
                              <Field
                                label="Sunday Out Time"
                                value={formatTime(employee.weekend_working_config.sunday.out_time)}
                                icon={<HiClock className="w-4 h-4 text-blue-600" />}
                              />
                            </div>
                            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                              <span className="font-medium">Salary Type:</span> {employee.weekend_working_config.sunday.full_day_salary ? 'Full weekday salary weight' : 'Proportional to hours worked'}
                            </div>
                          </div>
                        )}

                        {/* No Weekend Working Days */}
                        {!employee.weekend_working_config.saturday?.working && !employee.weekend_working_config.sunday?.working && (
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                            <p className="text-gray-600 dark:text-gray-400">No weekend working days configured</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                        <p className="text-gray-600 dark:text-gray-400">No weekend working configuration</p>
                      </div>
                    )}
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
                    <div className="space-y-4">
                      {Object.keys(documents).length === 0 ? (
                        <div className="text-center py-8">
                          <HiDocumentText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500 dark:text-gray-400">No documents uploaded yet.</p>
                        </div>
                      ) : (
                        Object.entries(documents).map(([documentType, docs]) => (
                          <div key={documentType} className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize border-b pb-1">
                              {documentType.replace('_', ' ')} ({docs.length})
                            </h4>
                            <div className="space-y-2">
                              {docs.map((doc) => (
                                <div 
                                  key={doc.id} 
                                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-sm transition-shadow"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className="text-2xl">{getDocumentIcon(doc.mime_type)}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {doc.original_filename}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span>{formatFileSize(doc.file_size)}</span>
                                        <span>•</span>
                                        <span>{formatDate(doc.uploaded_at)}</span>
                                        {doc.uploaded_by_name && (
                                          <>
                                            <span>•</span>
                                            <span>by {doc.uploaded_by_name}</span>
                                          </>
                                        )}
                                      </div>
                                      {doc.notes && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                          {doc.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2 ml-4">
                                    <Button 
                                      size="xs" 
                                      color="gray" 
                                      title="Download"
                                      onClick={() => handleDownloadDocument(doc.id, doc.original_filename)}
                                    >
                                      <FaDownload className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab - Updated UI matching AttendanceView */}
            {activeSidebarTab === "Attendance" && (
              <div className="space-y-6">
                {/* Filters Section */}
                <Card className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date</label>
                      <TextInput
                        type="date"
                        value={attendanceFilters.startDate}
                        onChange={(e) => setAttendanceFilters(prev => ({
                          ...prev,
                          startDate: e.target.value,
                          endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate
                        }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">End Date</label>
                      <TextInput
                        type="date"
                        value={attendanceFilters.endDate}
                        onChange={(e) => setAttendanceFilters(prev => ({
                          ...prev,
                          endDate: e.target.value,
                          startDate: prev.startDate > e.target.value ? e.target.value : prev.startDate
                        }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Arrival Status</label>
                      <Select
                        value={attendanceFilters.arrival_status}
                        onChange={(e) => setAttendanceFilters(prev => ({ ...prev, arrival_status: e.target.value }))}
                      >
                        <option value="">All Status</option>
                        <option value="on_time">On Time</option>
                        <option value="late">Late</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Work Duration</label>
                      <Select
                        value={attendanceFilters.work_duration}
                        onChange={(e) => setAttendanceFilters(prev => ({ ...prev, work_duration: e.target.value }))}
                      >
                        <option value="">All Duration</option>
                        <option value="full_day">Full Day</option>
                        <option value="half_day">Half Day</option>
                        <option value="short_leave">Short Leave</option>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button 
                        onClick={() => loadAttendanceData(employee.id)} 
                        disabled={attendanceLoading}
                      >
                        <HiRefresh className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Attendance Table */}
                <Card>
                  {attendanceLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner size="xl" />
                      <span className="ml-3">Loading attendance records...</span>
                    </div>
                  ) : attendance.length === 0 ? (
                    <div className="text-center py-12">
                      <HiClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No attendance records found for the selected period.</p>
                    </div>
                  ) : (
                    <Table hoverable>
                      <Table.Head>
                        <Table.HeadCell>Date</Table.HeadCell>
                        <Table.HeadCell>Check In</Table.HeadCell>
                        <Table.HeadCell>Check Out</Table.HeadCell>
                        <Table.HeadCell>Break</Table.HeadCell>
                        <Table.HeadCell>Total Hours</Table.HeadCell>
                        <Table.HeadCell>Overtime</Table.HeadCell>
                        <Table.HeadCell>Arrival Status</Table.HeadCell>
                        <Table.HeadCell>Work Duration</Table.HeadCell>
                        <Table.HeadCell>Work Type</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {attendance.map((record) => (
                          <Table.Row key={record.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                            <Table.Cell className="font-medium text-gray-900 dark:text-white">
                              {formatDate(record.date)}
                            </Table.Cell>
                            <Table.Cell>{formatTime(record.check_in_time)}</Table.Cell>
                            <Table.Cell>{formatTime(record.check_out_time)}</Table.Cell>
                            <Table.Cell>{record.break_duration || 0} min</Table.Cell>
                            <Table.Cell>{formatHours(record.total_hours)}</Table.Cell>
                            <Table.Cell>{formatHours(record.overtime_hours)}</Table.Cell>
                            <Table.Cell>{getArrivalStatusBadge(record.arrival_status)}</Table.Cell>
                            <Table.Cell>{getWorkDurationBadge(record.work_duration)}</Table.Cell>
                            <Table.Cell>{getWorkTypeBadge(record.work_type)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                  
                  {/* Summary Section */}
                  {attendance.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Total Days</h4>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{attendance.length}</p>
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">On Time</h4>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                          {attendance.filter(r => r.arrival_status === 'on_time').length}
                        </p>
                      </div>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Late</h4>
                        <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                          {attendance.filter(r => r.arrival_status === 'late').length}
                        </p>
                      </div>
                      
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Total Hours</h4>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                          {attendance.reduce((sum, r) => sum + (r.total_hours || 0), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Leave Tab - Updated UI matching LeaveRequests */}
            {activeSidebarTab === "Leave" && (
              <div className="space-y-6">
                {/* Filters Section */}
                <Card className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <Select
                        value={leaveFilters.status}
                        onChange={(e) => setLeaveFilters(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Year</label>
                      <Select
                        value={leaveFilters.year}
                        onChange={(e) => setLeaveFilters(prev => ({ ...prev, year: e.target.value }))}
                      >
                        {getYearOptions().map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Month</label>
                      <Select
                        value={leaveFilters.month}
                        onChange={(e) => setLeaveFilters(prev => ({ ...prev, month: e.target.value }))}
                      >
                        <option value="">All Months</option>
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button 
                        onClick={() => loadLeaveData(employee.id)} 
                        disabled={leavesLoading}
                      >
                        <HiRefresh className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Leave Table */}
                <Card>
                  {leavesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner size="xl" />
                      <span className="ml-3">Loading leave requests...</span>
                    </div>
                  ) : leaves.length === 0 ? (
                    <div className="text-center py-12">
                      <HiCalendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No leave requests found.</p>
                    </div>
                  ) : (
                    <Table hoverable>
                      <Table.Head>
                        <Table.HeadCell>Leave Type</Table.HeadCell>
                        <Table.HeadCell>Duration</Table.HeadCell>
                        <Table.HeadCell>Date Range</Table.HeadCell>
                        <Table.HeadCell>Days</Table.HeadCell>
                        <Table.HeadCell>Reason</Table.HeadCell>
                        <Table.HeadCell>Status</Table.HeadCell>
                        <Table.HeadCell>Applied Date</Table.HeadCell>
                        <Table.HeadCell>Reviewed By</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {leaves.map((leave) => (
                          <Table.Row key={leave.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                            <Table.Cell>
                              <span className={`text-sm font-medium text-${getLeaveTypeColor(leave.leave_type_name)}-600`}>
                                {leave.leave_type_name}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge color="info" size="sm">
                                {leave.leave_duration?.replace('_', ' ')}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="text-sm">
                                <div>{formatDate(leave.start_date)}</div>
                                <div className="text-gray-500">to {formatDate(leave.end_date)}</div>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              <span className="font-medium">{leave.days_requested}</span>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="max-w-xs">
                                <p className="truncate text-sm" title={leave.reason}>
                                  {leave.reason}
                                </p>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              {getLeaveStatusBadge(leave.status)}
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-sm text-gray-500">
                                {formatDate(leave.applied_at)}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="text-sm">
                                <p>{leave.reviewer_name || 'Pending'}</p>
                                {leave.reviewed_at && (
                                  <p className="text-xs text-gray-500">{formatDate(leave.reviewed_at)}</p>
                                )}
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                  
                  {/* Leave Summary Cards */}
                  {leaves.length > 0 && (
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
                  )}
                </Card>
              </div>
            )}

            {/* Financial Records Tab - Keeping existing implementation */}
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

                    <DynamicProtectedComponent permission="payroll.edit">
                      <Button
                        size="sm"
                        color="purple"
                        onClick={() => setShowAddRecordModal(true)}
                      >
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
                            LKR {record.amount.toLocaleString()}
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
                      LKR {financialRecords
                        .filter(r => r.type === 'salary')
                        .reduce((sum, r) => sum + r.amount, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Total Bonuses</h4>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                      LKR {financialRecords
                        .filter(r => r.type === 'bonus')
                        .reduce((sum, r) => sum + r.amount, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Current Salary</h4>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                      LKR {employee.base_salary?.toLocaleString() || 'N/A'}
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
        </div>

        {/* Add Financial Record Modal */}
        <Modal show={showAddRecordModal} onClose={() => setShowAddRecordModal(false)} size="lg">
          <Modal.Header>Add Financial Record for {employee.first_name} {employee.last_name}</Modal.Header>
          <Modal.Body>
            <div className="space-y-6">
              {/* Record Type Selection */}
              <div>
                <Label htmlFor="recordType" value="Record Type" className="mb-2" />
                <Select
                  id="recordType"
                  value={newRecordData.type}
                  onChange={(e) => setNewRecordData(prev => ({
                    ...prev,
                    type: e.target.value as 'loan' | 'advance' | 'bonus'
                  }))}
                >
                  <option value="loan">Loan</option>
                  <option value="advance">Advance Payment</option>
                  <option value="bonus">Bonus</option>
                </Select>
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="amount" value="Amount (LKR)" className="mb-2" />
                <TextInput
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={newRecordData.amount}
                  onChange={(e) => setNewRecordData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" value="Description" className="mb-2" />
                <TextInput
                  id="description"
                  placeholder="Enter description"
                  value={newRecordData.description}
                  onChange={(e) => setNewRecordData(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              {/* Loan-specific fields */}
              {newRecordData.type === 'loan' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="loanType" value="Loan Type" className="mb-2" />
                      <Select
                        id="loanType"
                        value={newRecordData.loanType}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, loanType: e.target.value }))}
                      >
                        <option value="personal">Personal Loan</option>
                        <option value="advance">Salary Advance</option>
                        <option value="emergency">Emergency Loan</option>
                        <option value="housing">Housing Loan</option>
                        <option value="education">Education Loan</option>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="interestRate" value="Interest Rate (%)" className="mb-2" />
                      <TextInput
                        id="interestRate"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newRecordData.interestRate}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, interestRate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tenureMonths" value="Tenure (Months)" className="mb-2" />
                      <TextInput
                        id="tenureMonths"
                        type="number"
                        placeholder="12"
                        value={newRecordData.tenureMonths}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, tenureMonths: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="startDate" value="Start Date" className="mb-2" />
                      <TextInput
                        id="startDate"
                        type="date"
                        value={newRecordData.startDate}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, startDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Loan Calculation Preview */}
                  {newRecordData.amount && newRecordData.tenureMonths && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Loan Calculation Preview</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Monthly EMI:</p>
                          <p className="font-semibold">
                            LKR {(
                              parseFloat(newRecordData.amount) / parseInt(newRecordData.tenureMonths || '1')
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Total Payable:</p>
                          <p className="font-semibold">
                            LKR {(
                              parseFloat(newRecordData.amount) *
                              (1 + (parseFloat(newRecordData.interestRate || '0') / 100))
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Advance-specific fields */}
              {newRecordData.type === 'advance' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="advanceType" value="Advance Type" className="mb-2" />
                      <Select
                        id="advanceType"
                        value={newRecordData.advanceType}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, advanceType: e.target.value }))}
                      >
                        <option value="salary">Salary Advance</option>
                        <option value="emergency">Emergency Advance</option>
                        <option value="travel">Travel Advance</option>
                        <option value="medical">Medical Advance</option>
                        <option value="educational">Educational Advance</option>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="deductionMonths" value="Deduction Period (Months)" className="mb-2" />
                      <TextInput
                        id="deductionMonths"
                        type="number"
                        min="1"
                        max="12"
                        placeholder="1"
                        value={newRecordData.deductionMonths}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, deductionMonths: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="requiredDate" value="Required Date" className="mb-2" />
                      <TextInput
                        id="requiredDate"
                        type="date"
                        value={newRecordData.requiredDate}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, requiredDate: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="justification" value="Justification" className="mb-2" />
                      <TextInput
                        id="justification"
                        placeholder="Reason for advance request"
                        value={newRecordData.justification}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, justification: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Advance Calculation Preview */}
                  {newRecordData.amount && newRecordData.deductionMonths && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Deduction Schedule</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Monthly Deduction:</p>
                          <p className="font-semibold">
                            LKR {(
                              parseFloat(newRecordData.amount) / parseInt(newRecordData.deductionMonths || '1')
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Deduction Period:</p>
                          <p className="font-semibold">
                            {newRecordData.deductionMonths} month{parseInt(newRecordData.deductionMonths) > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Bonus-specific fields */}
              {newRecordData.type === 'bonus' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bonusType" value="Bonus Type" className="mb-2" />
                      <Select
                        id="bonusType"
                        value={newRecordData.bonusType}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, bonusType: e.target.value }))}
                      >
                        <option value="performance">Performance Bonus</option>
                        <option value="annual">Annual Bonus</option>
                        <option value="quarterly">Quarterly Bonus</option>
                        <option value="project">Project Bonus</option>
                        <option value="spot">Spot Bonus</option>
                        <option value="retention">Retention Bonus</option>
                        <option value="referral">Referral Bonus</option>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="bonusPeriod" value="Bonus Period" className="mb-2" />
                      <TextInput
                        id="bonusPeriod"
                        placeholder="e.g., Q4 2024, Annual 2024"
                        value={newRecordData.bonusPeriod}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, bonusPeriod: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Bonus Payment Info</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Payment Method:</p>
                        <p className="font-semibold">Next Payroll</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Bonus Amount:</p>
                        <p className="font-semibold">
                          LKR {newRecordData.amount ? parseFloat(newRecordData.amount).toLocaleString() : '0'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <Label htmlFor="notes" value="Additional Notes" className="mb-2" />
                <TextInput
                  id="notes"
                  placeholder="Optional notes"
                  value={newRecordData.notes}
                  onChange={(e) => setNewRecordData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {/* Approval Notice */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Approval Required</h4>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  This {newRecordData.type} request will be sent for approval before processing.
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              color="purple"
              onClick={handleAddFinancialRecord}
              disabled={addingRecord || !newRecordData.amount || !newRecordData.description}
            >
              {addingRecord ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                `Create ${newRecordData.type.charAt(0).toUpperCase() + newRecordData.type.slice(1)}`
              )}
            </Button>
            <Button
              color="gray"
              onClick={() => {
                setShowAddRecordModal(false);
                setNewRecordData({
                  type: 'loan',
                  amount: '',
                  description: '',
                  loanType: 'personal',
                  interestRate: '',
                  tenureMonths: '',
                  startDate: new Date().toISOString().split('T')[0],
                  bonusType: 'performance',
                  bonusPeriod: '',
                  advanceType: 'salary',
                  deductionMonths: '1',
                  requiredDate: '',
                  justification: '',
                  notes: ''
                });
              }}
              disabled={addingRecord}
            >
              Cancel
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Terminate Confirmation Modal */}
        <Modal show={showTerminateModal} onClose={() => setShowTerminateModal(false)}>
          <Modal.Header>Confirm Employee Termination</Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to terminate <strong>{employee.first_name} {employee.last_name}</strong>? This will change their status to "Terminated" and they will no longer have access to the system.</p>
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Warning:</strong> This action cannot be undone. The employee will be marked as terminated in the system.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button 
              color="failure" 
              onClick={handleTerminateEmployee}
              disabled={terminating}
            >
              {terminating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Terminating...
                </>
              ) : (
                'Terminate Employee'
              )}
            </Button>
            <Button color="gray" onClick={() => setShowTerminateModal(false)} disabled={terminating}>
              Cancel
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </DynamicProtectedComponent>
  );
};

export default EmployeeDetails;