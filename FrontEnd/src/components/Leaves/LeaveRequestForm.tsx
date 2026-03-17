import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Label,
  TextInput,
  Select,
  Textarea,
  Alert,
  Spinner,
  Badge
} from 'flowbite-react';
import {
  FaCalendarAlt,
  FaUser,
  FaInfoCircle,
  FaClock
} from 'react-icons/fa';
import leaveApiService from '../../services/leaveApi';
import apiService from '../../services/api';
import holidayService, { Holiday } from '../../services/holidayService';
import ReactSelect from 'react-select';


// Type Definitions
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_code: string;
  department_name?: string;
  designation?: string;
  employment_status: string;
}

interface LeaveType {
  id: string;
  name: string;
  description?: string;
  max_days_per_request?: number;
  advance_notice_days?: number;
  max_days_per_year?: number;
  max_days_per_month?: number;
  tracking_period?: 'Monthly' | 'Yearly';
  is_paid: boolean;
}

interface FormData {
  employee_id: string;
  leave_type_id: string;
  leave_duration: 'full_day' | 'half_day' | 'short_leave';
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  admin_notes: string;
  supporting_documents: File[];
}

interface FormErrors {
  employee_id?: string;
  leave_type_id?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  general?: string;
}

const LeaveRequestForm: React.FC = () => {
  const navigate = useNavigate();
  
  // State Management with proper types
  const [formData, setFormData] = useState<FormData>({
    employee_id: '',
    leave_type_id: '',
    leave_duration: 'full_day',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    reason: '',
    admin_notes: '',
    supporting_documents: []
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<string>('');
  const [calculatedDays, setCalculatedDays] = useState<number>(0);
  const [leaveTypeBalance, setLeaveTypeBalance] = useState<{
    limit: number;
    taken: number;
    remaining: number;
    period: string;
    tracking_period: 'Monthly' | 'Yearly';
    is_paid: boolean;
    leave_type_name: string;
    unlimited: boolean;
  } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const [holidaysInRange, setHolidaysInRange] = useState<Holiday[]>([]);

  // Display format dates (dd/mm/yyyy)
  const [displayStartDate, setDisplayStartDate] = useState<string>('');
  const [displayEndDate, setDisplayEndDate] = useState<string>('');

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Calculate days when dates or duration change
  useEffect(() => {
    calculateLeaveDays();
  }, [formData.start_date, formData.end_date, formData.leave_duration, holidaysInRange]);

  // Fetch leave type balance when employee, leave type, or start date changes
  useEffect(() => {
    if (formData.employee_id && formData.leave_type_id && formData.start_date) {
      fetchLeaveTypeBalance();
    } else {
      setLeaveTypeBalance(null);
    }
  }, [formData.employee_id, formData.leave_type_id, formData.start_date]);

  // Adjust end date when duration changes
  useEffect(() => {
    if (formData.leave_duration !== 'full_day' && formData.start_date) {
      setFormData(prev => ({ ...prev, end_date: formData.start_date }));
    }
  }, [formData.leave_duration, formData.start_date]);

  // Check for holidays in the selected date range
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      checkHolidaysInRange();
    } else {
      setHolidaysInRange([]);
    }
  }, [formData.start_date, formData.end_date]);

  const fetchLeaveTypeBalance = async (): Promise<void> => {
    if (!formData.employee_id || !formData.leave_type_id || !formData.start_date) return;

    try {
      setLoadingBalance(true);

      // Build query string for GET request
      const queryParams = new URLSearchParams({
        employee_id: formData.employee_id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date
      });

      const response = await apiService.apiCall(`/api/leaves/balance?${queryParams.toString()}`, {
        method: 'GET'
      });

      if (response.success && response.balance) {
        setLeaveTypeBalance(response.balance);
      } else {
        setLeaveTypeBalance(null);
      }

    } catch (error) {
      console.error('Failed to fetch leave type balance:', error);
      setLeaveTypeBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const checkHolidaysInRange = async (): Promise<void> => {
    if (!formData.start_date || !formData.end_date) return;

    try {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const holidays: Holiday[] = [];

      // Get years that the date range spans
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();

      // Fetch holidays for the relevant years
      const yearsToCheck = startYear === endYear ? [startYear] : [startYear, endYear];
      const allHolidays: Holiday[] = [];

      for (const year of yearsToCheck) {
        const yearHolidays = await holidayService.getHolidaysForYear(year);
        allHolidays.push(...yearHolidays);
      }

      // Check each day in the range for holidays
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const holiday = allHolidays.find(h => h.date === dateStr);
        if (holiday) {
          holidays.push(holiday);
        }
      }

      setHolidaysInRange(holidays);
    } catch (error) {
      console.error('Failed to check holidays:', error);
      setHolidaysInRange([]);
    }
  };

  const loadInitialData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Fetch employees and leave types
      const [employeesResponse, leaveTypesResponse] = await Promise.all([
        apiService.getEmployees({ limit: 10000, page: 1, status: 'active' }),
        leaveApiService.getLeaveTypes()
      ]);

      if (employeesResponse.success) {
        setEmployees(employeesResponse.data.employees || []);
      }
      
      if (leaveTypesResponse.success) {
        setLeaveTypes(leaveTypesResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setErrors({ general: 'Failed to load required data' });
    } finally {
      setLoading(false);
    }
  };

  const calculateLeaveDays = (): void => {
    if (!formData.start_date || !formData.end_date) {
      setCalculatedDays(0);
      return;
    }

    if (formData.leave_duration === 'half_day') {
      setCalculatedDays(0.5);
    } else if (formData.leave_duration === 'short_leave') {
      setCalculatedDays(0.25);
    } else {
      // Calculate ALL calendar days for full day leaves (including weekends)
      // The backend will determine actual payable hours based on employee's working schedule
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);

      // Calculate total calendar days
      const diffTime = end.getTime() - start.getTime();
      let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates

      // Subtract holidays from the count (holidays are non-working days, no leave needed)
      const holidayDays = holidaysInRange.length;
      const workingDays = totalDays - holidayDays;

      setCalculatedDays(Math.max(0, workingDays));
    }
  };

  const handleInputChange = (field: keyof FormData, value: any): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user types
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof FormErrors];
        return newErrors;
      });
    }

    // Handle employee selection
    if (field === 'employee_id') {
      const employee = employees.find(emp => emp.id === value);
      setSelectedEmployee(employee || null);
    }
  };

  // Handle date input changes (dd/mm/yyyy format with auto-formatting)
  const handleDateChange = (field: 'start_date' | 'end_date', rawValue: string): void => {
    // Remove all non-digit characters
    const digitsOnly = rawValue.replace(/\D/g, '');

    // Auto-format as user types: dd/mm/yyyy
    let formattedValue = '';
    if (digitsOnly.length > 0) {
      formattedValue = digitsOnly.substring(0, 2); // dd
      if (digitsOnly.length >= 3) {
        formattedValue += '/' + digitsOnly.substring(2, 4); // /mm
      }
      if (digitsOnly.length >= 5) {
        formattedValue += '/' + digitsOnly.substring(4, 8); // /yyyy
      }
    }

    // Update display state
    if (field === 'start_date') {
      setDisplayStartDate(formattedValue);
    } else {
      setDisplayEndDate(formattedValue);
    }

    // Validate format and convert to backend format
    if (isValidDateFormat(formattedValue) && formattedValue) {
      const backendDate = convertToBackendFormat(formattedValue);
      setFormData(prev => ({ ...prev, [field]: backendDate }));

      // Clear error
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } else if (!formattedValue) {
      // Clear the backend date if display is empty
      setFormData(prev => ({ ...prev, [field]: '' }));
    } else if (digitsOnly.length === 8) {
      // Only show error if user has entered 8 digits but format is invalid
      setErrors(prev => ({
        ...prev,
        [field]: 'Invalid date. Check day/month/year values'
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.employee_id) {
      newErrors.employee_id = 'Please select an employee';
    }

    if (!formData.leave_type_id) {
      newErrors.leave_type_id = 'Please select a leave type';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    }

    // Validate dates for non-full day leaves
    if (formData.leave_duration !== 'full_day' && formData.start_date !== formData.end_date) {
      newErrors.end_date = 'Half-day and short leaves must be on the same date';
    }

    // Validate times for short leave
    if (formData.leave_duration === 'short_leave') {
      if (!formData.start_time) {
        newErrors.start_time = 'Start time is required for short leave';
      }
      if (!formData.end_time) {
        newErrors.end_time = 'End time is required for short leave';
      }
      if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
        newErrors.end_time = 'End time must be after start time';
      }
    }

    if (!formData.reason.trim() || formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters';
    }

    // Validate no single-day leave on holidays
    if (holidaysInRange.length > 0) {
      // For half-day or short leave (always single day), block if it's a holiday
      if (formData.leave_duration === 'half_day' || formData.leave_duration === 'short_leave') {
        const holidayNames = holidaysInRange.map(h => h.name).join(', ');
        newErrors.general = `Cannot request ${formData.leave_duration === 'half_day' ? 'half-day' : 'short'} leave on a holiday: ${holidayNames}. Please select a different date.`;
      }
      // For full-day leave, only block if it's a single day (start === end) on a holiday
      else if (formData.leave_duration === 'full_day' && formData.start_date === formData.end_date) {
        const holidayNames = holidaysInRange.map(h => h.name).join(', ');
        newErrors.general = `Cannot request leave for a single day that is a holiday: ${holidayNames}. Please select a different date or extend the date range.`;
      }
      // If it's a date range (start !== end), allow it even with holidays
    }

    // Validate leave type balance
    if (leaveTypeBalance && !leaveTypeBalance.unlimited && calculatedDays > leaveTypeBalance.remaining) {
      newErrors.general = `Cannot request ${calculatedDays} day(s). Only ${leaveTypeBalance.remaining} day(s) remaining for ${leaveTypeBalance.leave_type_name} ${leaveTypeBalance.tracking_period === 'Monthly' ? 'this month' : 'this year'}.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitLoading(true);
      setErrors({});

      const submitData = {
        employee_id: formData.employee_id,
        leave_type_id: formData.leave_type_id,
        leave_duration: formData.leave_duration,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.leave_duration === 'short_leave' ? formData.start_time : null,
        end_time: formData.leave_duration === 'short_leave' ? formData.end_time : null,
        reason: formData.reason.trim(),
        days_requested: calculatedDays,
        notes: formData.admin_notes.trim() || null,
        supporting_documents: formData.supporting_documents?.length > 0 ? formData.supporting_documents : null
      };

      console.log('submit data',submitData);

      const response = await leaveApiService.submitLeaveRequestForEmployee(submitData);

      if (response.success) {
        setSuccess(`Leave request created successfully for ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}!`);

        // Reset form
        setFormData({
          employee_id: '',
          leave_type_id: '',
          leave_duration: 'full_day',
          start_date: '',
          end_date: '',
          start_time: '',
          end_time: '',
          reason: '',
          admin_notes: '',
          supporting_documents: []
        });
        setSelectedEmployee(null);
        setCalculatedDays(0);

        // Navigate back after 2 seconds
        setTimeout(() => {
          navigate('/leave-requests');
        }, 2000);
      } else {
        setErrors({ general: response.message || 'Failed to create leave request' });
      }
    } catch (error: any) {
      console.error('Failed to create leave request:', error);
      setErrors({ general: error.message || 'Failed to create leave request. Please try again.' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Convert yyyy-mm-dd to dd/mm/yyyy for display
  const convertToDisplayFormat = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Convert dd/mm/yyyy to yyyy-mm-dd for backend
  const convertToBackendFormat = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Validate dd/mm/yyyy format
  const isValidDateFormat = (dateStr: string): boolean => {
    if (!dateStr) return true; // Allow empty
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(regex);
    if (!match) return false;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    // Check valid day for the month
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };

  const getDurationBadgeColor = (duration: string): string => {
    switch (duration) {
      case 'full_day': return 'success';
      case 'half_day': return 'info';
      case 'short_leave': return 'warning';
      default: return 'gray';
    }
  };

  const getDurationLabel = (duration: string): string => {
    switch (duration) {
      case 'full_day': return 'Full Day';
      case 'half_day': return 'Half Day';
      case 'short_leave': return 'Short Leave';
      default: return duration;
    }
  };


const employeeOptions = employees
  .map(emp => ({
    value: emp.id, // the actual ID
    label: `${emp.first_name} ${emp.last_name} - ${emp.employee_code}`, // what shows in dropdown
  }))
  .sort((a, b) => a.label.localeCompare(b.label));



  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="xl" />
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="shadow-lg">
        <div className="border-b pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Leave Request
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Submit a new leave request for an employee
          </p>
        </div>

        {/* Alerts */}
        {errors.general && (
          <Alert color="failure" className="mb-4">
            <span className="font-medium">Error!</span> {errors.general}
          </Alert>
        )}

        {success && (
          <Alert color="success" className="mb-4">
            <span className="font-medium">Success!</span> {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee Selection */}
          <div>
            <Label htmlFor="employee_id" value="Select Employee *" />
<ReactSelect
  options={employeeOptions}
  value={employeeOptions.find(opt => opt.value === formData.employee_id) || null}
  onChange={(option) => handleInputChange('employee_id', option?.value || '')}
  isClearable
  placeholder="Choose an employee..."
  isSearchable
  styles={{
    control: (provided, state) => ({
      ...provided,
      borderRadius: '9999px',        // fully rounded
      borderColor: '#D1D5DB',       // Tailwind gray-300
      minHeight: '40px',
      boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none', // optional focus ring
      '&:hover': {
        borderColor: '#9CA3AF',     // Tailwind gray-400 on hover
        background:'rgb(209 213 219)'
      },
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: '12px',
     
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#F3F4F6' : 'white', // light gray on hover
      color: '#111827', // gray-900
    }),
  }}
/>


            {errors.employee_id && (
              <p className="text-red-500 text-sm mt-1">{errors.employee_id}</p>
            )}
          </div>

          {/* Selected Employee Info */}
          {selectedEmployee && (
            <Card className="bg-green-50 border-green-200">
              <div className="flex items-start space-x-3">
                <FaUser className="text-green-500 mt-1" />
                <div>
                  <h4 className="font-semibold text-green-800">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h4>
                  <p className="text-sm text-green-600">
                    {selectedEmployee.employee_code} • {selectedEmployee.department_name}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Leave Type */}
          <div>
            <Label htmlFor="leave_type_id" value="Leave Type *" />
            <Select
              id="leave_type_id"
              value={formData.leave_type_id}
              onChange={(e) => handleInputChange('leave_type_id', e.target.value)}
              className={errors.leave_type_id ? 'border-red-500' : ''}
              required
            >
              <option value="">Select leave type...</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
            {errors.leave_type_id && (
              <p className="text-red-500 text-sm mt-1">{errors.leave_type_id}</p>
            )}
          </div>

          {/* Leave Duration Selection */}
          <div>
            <Label htmlFor="leave_duration" value="Leave Duration *" />
            <div className="grid grid-cols-3 gap-3 mt-2">
              {(['full_day', 'half_day', 'short_leave'] as const).map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => handleInputChange('leave_duration', duration)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.leave_duration === duration
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <Badge color={getDurationBadgeColor(duration)} className="w-full">
                    {getDurationLabel(duration)}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    {duration === 'full_day' && 'Multiple days allowed'}
                    {duration === 'half_day' && '0.5 day'}
                    {duration === 'short_leave' && '0.25 day'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date" value="Start Date * (dd/mm/yyyy)" />
              <TextInput
                id="start_date"
                type="text"
                value={displayStartDate}
                onChange={(e) => handleDateChange('start_date', e.target.value)}
                placeholder="dd/mm/yyyy"
                maxLength={10}
                className={errors.start_date ? 'border-red-500' : ''}
                icon={FaCalendarAlt}
                required
              />
              {errors.start_date && (
                <p className="text-red-500 text-sm mt-1">{errors.start_date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="end_date" value="End Date * (dd/mm/yyyy)" />
              <TextInput
                id="end_date"
                type="text"
                value={displayEndDate}
                onChange={(e) => handleDateChange('end_date', e.target.value)}
                placeholder="dd/mm/yyyy"
                maxLength={10}
                className={errors.end_date ? 'border-red-500' : ''}
                icon={FaCalendarAlt}
                disabled={formData.leave_duration !== 'full_day'}
                required
              />
              {errors.end_date && (
                <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>
              )}
            </div>
          </div>

          {/* Time Selection for Short Leave */}
          {formData.leave_duration === 'short_leave' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time" value="Start Time *" />
                <TextInput
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  className={errors.start_time ? 'border-red-500' : ''}
                  icon={FaClock}
                  required
                />
                {errors.start_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.start_time}</p>
                )}
              </div>

              <div>
                <Label htmlFor="end_time" value="End Time *" />
                <TextInput
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange('end_time', e.target.value)}
                  className={errors.end_time ? 'border-red-500' : ''}
                  icon={FaClock}
                  required
                />
                {errors.end_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.end_time}</p>
                )}
              </div>
            </div>
          )}

          {/* Calculated Days Display */}
          {(calculatedDays > 0 || (formData.start_date && formData.end_date && formData.leave_duration === 'full_day')) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <FaInfoCircle className="text-yellow-600" />
                <div className="text-yellow-800">
                  <p>
                    <strong>Leave Duration: {calculatedDays} day{calculatedDays !== 1 ? 's' : ''}</strong>
                    {formData.start_date && formData.end_date && (
                      <span className="ml-2">
                        ({formatDate(formData.start_date)}
                        {formData.end_date !== formData.start_date && ` to ${formatDate(formData.end_date)}`})
                      </span>
                    )}
                  </p>
                  {holidaysInRange.length > 0 && formData.leave_duration === 'full_day' && (
                    <p className="text-sm mt-1">
                      Total calendar days: {(() => {
                        const start = new Date(formData.start_date);
                        const end = new Date(formData.end_date);
                        const diffTime = end.getTime() - start.getTime();
                        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      })()} (excluding {holidaysInRange.length} holiday{holidaysInRange.length !== 1 ? 's' : ''})
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Holiday Information */}
          {holidaysInRange.length > 0 && (() => {
            // Determine if this should block the request
            const shouldBlock =
              formData.leave_duration === 'half_day' ||
              formData.leave_duration === 'short_leave' ||
              (formData.leave_duration === 'full_day' && formData.start_date === formData.end_date);

            if (shouldBlock) {
              // Red warning - blocking submission
              return (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <FaInfoCircle className="text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-800 font-semibold">
                        ⚠️ Cannot Request Leave on Holiday
                      </p>
                      <p className="text-red-700 text-sm mt-1">
                        The selected date is a holiday:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-red-700 text-sm">
                        {holidaysInRange.map((holiday, index) => (
                          <li key={index}>
                            <strong>{holiday.name}</strong> - {formatDate(holiday.date)}
                          </li>
                        ))}
                      </ul>
                      <p className="text-red-700 text-sm mt-2 font-medium">
                        {formData.leave_duration === 'full_day'
                          ? '❌ Cannot take leave for a single day that is a holiday. Please select a different date or extend to a date range.'
                          : '❌ Cannot take half-day or short leave on a holiday. Please select a different date.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Blue info - just informational
              return (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <FaInfoCircle className="text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-blue-800 font-semibold">
                        ℹ️ Holiday Notice
                      </p>
                      <p className="text-blue-700 text-sm mt-1">
                        The following {holidaysInRange.length} holiday{holidaysInRange.length !== 1 ? 's' : ''} fall within your selected dates and will be automatically excluded from leave days:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-blue-700 text-sm">
                        {holidaysInRange.map((holiday, index) => (
                          <li key={index}>
                            <strong>{holiday.name}</strong> - {formatDate(holiday.date)}
                          </li>
                        ))}
                      </ul>
                      <p className="text-blue-700 text-sm mt-2 font-medium">
                        ✓ These days are already non-working days and won't count against your leave balance.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          })()}

          {/* Reason */}
          <div>
            <Label htmlFor="reason" value="Reason for Leave *" />
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              placeholder="Please provide a detailed reason for the leave request..."
              rows={4}
              className={errors.reason ? 'border-red-500' : ''}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Minimum 10 characters required ({formData.reason.length}/10)
            </p>
            {errors.reason && (
              <p className="text-red-500 text-sm mt-1">{errors.reason}</p>
            )}
          </div>

          {/* Admin Notes */}
          <div>
            <Label htmlFor="admin_notes" value="Admin Notes (Optional)" />
            <Textarea
              id="admin_notes"
              value={formData.admin_notes}
              onChange={(e) => handleInputChange('admin_notes', e.target.value)}
              placeholder="Internal notes for this leave request..."
              rows={3}
            />
          </div>

          {/* Leave Type Balance Information */}
          {formData.leave_type_id && formData.employee_id && formData.start_date && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <FaInfoCircle />
                Leave Balance
              </h4>

              {loadingBalance ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Spinner size="sm" />
                  <span>Loading balance...</span>
                </div>
              ) : leaveTypeBalance ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <p className="text-gray-700">
                      <strong className="text-blue-800">{leaveTypeBalance.leave_type_name}</strong>
                      {leaveTypeBalance.is_paid && (
                        <Badge color="success" size="xs" className="ml-2">Paid Leave</Badge>
                      )}
                    </p>

                    {leaveTypeBalance.unlimited ? (
                      <p className="text-green-600 font-medium mt-1">
                        ✓ Unlimited - No balance restrictions
                      </p>
                    ) : (
                      <>
                        <p className="text-gray-700 mt-1">
                          <strong className="text-lg text-blue-900">{leaveTypeBalance.remaining}</strong> of <strong>{leaveTypeBalance.limit}</strong> days remaining
                        </p>
                        <p className="text-xs text-gray-600">
                          Period: {leaveTypeBalance.period} ({leaveTypeBalance.tracking_period})
                        </p>
                        <p className="text-xs text-gray-500">
                          Already taken: {leaveTypeBalance.taken} day(s)
                        </p>

                        {calculatedDays > 0 && calculatedDays > leaveTypeBalance.remaining && (
                          <p className="text-sm text-red-600 font-medium mt-2 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Insufficient balance! Requesting {calculatedDays} day(s) but only {leaveTypeBalance.remaining} day(s) available.</span>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              color="gray"
              onClick={() => navigate('/leave-requests')}
              disabled={submitLoading}
              type="button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              disabled={
                submitLoading ||
                (holidaysInRange.length > 0 &&
                  (formData.leave_duration === 'half_day' ||
                    formData.leave_duration === 'short_leave' ||
                    (formData.leave_duration === 'full_day' && formData.start_date === formData.end_date)))
              }
            >
              {submitLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                'Create Leave Request'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default LeaveRequestForm;