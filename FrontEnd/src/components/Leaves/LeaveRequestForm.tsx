import React, { useState, useEffect } from 'react';
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

const LeaveRequestForm = () => {
  const navigate = useNavigate();
  
  // State Management
  const [formData, setFormData] = useState({
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

  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [calculatedDays, setCalculatedDays] = useState(0);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Calculate days when dates or duration change
  useEffect(() => {
    calculateLeaveDays();
  }, [formData.start_date, formData.end_date, formData.leave_duration]);

  // Adjust end date when duration changes
  useEffect(() => {
    if (formData.leave_duration !== 'full_day' && formData.start_date) {
      setFormData(prev => ({ ...prev, end_date: formData.start_date }));
    }
  }, [formData.leave_duration]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Mock API calls - replace with actual API service
      const [employeesResponse, leaveTypesResponse] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/leaves/types')
      ]);

      const employeesData = await employeesResponse.json();
      const leaveTypesData = await leaveTypesResponse.json();

      if (employeesData.success) {
        setEmployees(employeesData.data || []);
      }
      
      if (leaveTypesData.success) {
        setLeaveTypes(leaveTypesData.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setErrors({ general: 'Failed to load required data' });
    } finally {
      setLoading(false);
    }
  };

  const calculateLeaveDays = () => {
    if (!formData.start_date || !formData.end_date) {
      setCalculatedDays(0);
      return;
    }

    if (formData.leave_duration === 'half_day') {
      setCalculatedDays(0.5);
    } else if (formData.leave_duration === 'short_leave') {
      setCalculatedDays(0.25);
    } else {
      // Calculate business days for full day leaves
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      let days = 0;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          days++;
        }
      }
      
      setCalculatedDays(days);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Handle employee selection
    if (field === 'employee_id') {
      const employee = employees.find(emp => emp.id === value);
      setSelectedEmployee(employee || null);
    }
  };

  const validateForm = () => {
    const newErrors = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
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

      // Mock API call - replace with actual API service
      const response = await fetch('/api/leaves/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      
      const result = await response.json();

      if (result.success) {
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
        setErrors({ general: result.message || 'Failed to create leave request' });
      }
    } catch (error) {
      console.error('Failed to create leave request:', error);
      setErrors({ general: 'Failed to create leave request. Please try again.' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDurationBadgeColor = (duration) => {
    switch (duration) {
      case 'full_day': return 'success';
      case 'half_day': return 'info';
      case 'short_leave': return 'warning';
      default: return 'gray';
    }
  };

  const getDurationLabel = (duration) => {
    switch (duration) {
      case 'full_day': return 'Full Day';
      case 'half_day': return 'Half Day';
      case 'short_leave': return 'Short Leave';
      default: return duration;
    }
  };

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
            <Select
              id="employee_id"
              value={formData.employee_id}
              onChange={(e) => handleInputChange('employee_id', e.target.value)}
              className={errors.employee_id ? 'border-red-500' : ''}
              required
            >
              <option value="">Choose an employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name} - {employee.employee_code}
                </option>
              ))}
            </Select>
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
              {['full_day', 'half_day', 'short_leave'].map((duration) => (
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
              <Label htmlFor="start_date" value="Start Date *" />
              <TextInput
                id="start_date"
                type="date"
                value={formData.start_date}
                min={getTodayDate()}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                className={errors.start_date ? 'border-red-500' : ''}
                icon={FaCalendarAlt}
                required
              />
              {errors.start_date && (
                <p className="text-red-500 text-sm mt-1">{errors.start_date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="end_date" value="End Date *" />
              <TextInput
                id="end_date"
                type="date"
                value={formData.end_date}
                min={formData.start_date || getTodayDate()}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
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
          {calculatedDays > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <FaInfoCircle className="text-yellow-600" />
                <p className="text-yellow-800">
                  <strong>Leave Duration: {calculatedDays} day{calculatedDays !== 1 ? 's' : ''}</strong>
                  {formData.start_date && formData.end_date && (
                    <span className="ml-2">
                      ({formatDate(formData.start_date)}
                      {formData.end_date !== formData.start_date && ` to ${formatDate(formData.end_date)}`})
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

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

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              color="gray"
              onClick={() => navigate('/leave-requests')}
              disabled={submitLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              disabled={submitLoading}
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