import React, { useState, useEffect } from "react";
import { Button, Card, Alert, Spinner, Label, TextInput, Textarea, Select } from "flowbite-react";
import { FaArrowLeft, FaCalendarAlt, FaInfoCircle, FaUser, FaFileUpload } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useLeaveManagement } from "../../hooks/useLeaves";
import { Employee } from "../../types/employee";

// =============================================
// INTERFACES
// =============================================

interface FormData {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  admin_notes: string;
  supporting_documents: File[];
}

interface FormErrors {
  employee_id?: string;
  leave_type_id?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  general?: string;
}

// =============================================
// MAIN COMPONENT
// =============================================

const LeaveRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const { 
    leaveTypes, 
    loading, 
    error 
  } = useLeaveManagement();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    employee_id: '',
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    admin_notes: '',
    supporting_documents: []
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    // Load employees on component mount
    loadEmployees();
  }, []);

  useEffect(() => {
    // Calculate days when dates change
    if (formData.start_date && formData.end_date) {
      const days = calculateBusinessDays(formData.start_date, formData.end_date);
      setCalculatedDays(days);
    } else {
      setCalculatedDays(0);
    }
  }, [formData.start_date, formData.end_date]);

  useEffect(() => {
    // Clear success message after 5 seconds
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // =============================================
  // HELPER FUNCTIONS
  // =============================================

  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);
      
      // Import your employee API service
      const apiService = (await import('../../services/api')).default;
      
      // Fetch employees from database
      console.log('🔄 Loading employees from database...');
      const response = await apiService.getEmployees({
        limit: 1000, // Get all employees for the dropdown
        status: 'active' // Only active employees
      });
      
      if (response.success && response.data?.employees) {
        console.log('✅ Loaded employees:', response.data.employees.length);
        setEmployees(response.data.employees);
      } else {
        console.error('❌ Failed to load employees:', response.message);
        setEmployees([]);
        setErrors(prev => ({ ...prev, general: 'Failed to load employees. Please refresh the page.' }));
      }
    } catch (error) {
      console.error('❌ Error loading employees:', error);
      setEmployees([]);
      setErrors(prev => ({ ...prev, general: 'Error loading employees. Please check your connection.' }));
    } finally {
      setEmployeesLoading(false);
    }
  };

  const calculateBusinessDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return count;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // =============================================
  // FORM HANDLERS
  // =============================================

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear specific field error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Handle employee selection
    if (field === 'employee_id') {
      const employee = employees.find(emp => emp.id === value);
      setSelectedEmployee(employee || null);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      if (fileArray.length > 5) {
        setErrors(prev => ({ ...prev, general: 'Maximum 5 files allowed' }));
        return;
      }
      
      setFormData(prev => ({ ...prev, supporting_documents: fileArray }));
      
      // Clear any file-related errors
      if (errors.general?.includes('files')) {
        setErrors(prev => ({ ...prev, general: undefined }));
      }
    }
  };

  // =============================================
  // VALIDATION
  // =============================================

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Employee selection
    if (!formData.employee_id) {
      newErrors.employee_id = 'Please select an employee';
    }

    // Leave type
    if (!formData.leave_type_id) {
      newErrors.leave_type_id = 'Please select a leave type';
    }

    // Start date
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    // End date
    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    } else if (formData.start_date && formData.end_date < formData.start_date) {
      newErrors.end_date = 'End date cannot be before start date';
    }

    // Reason
    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =============================================
  // FORM SUBMISSION
  // =============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitLoading(true);
      setErrors({});

      // Import the leave API service directly
      const leaveApiService = (await import('../../services/leaveApi')).default;

      const submitData = {
        employee_id: formData.employee_id, // This is the key - admin specifies which employee
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason.trim(),
        days_requested: calculatedDays,
        notes: formData.admin_notes.trim(), // Admin notes become "notes" in the API
        supporting_documents: formData.supporting_documents
      };

      console.log('🚀 Submitting admin leave request:', submitData);

      // Use the regular submitLeaveRequest API - it detects admin requests by the employee_id field
      // The backend route /api/leaves/request handles both employee and admin submissions
      const response = await leaveApiService.submitLeaveRequestForEmployee(submitData);

      if (response.success) {
        setSuccess(`Leave request created successfully for ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}!`);
        
        // Reset form
        setFormData({
          employee_id: '',
          leave_type_id: '',
          start_date: '',
          end_date: '',
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
        setErrors({ general: response.message || 'Failed to create leave request. Please try again.' });
      }

    } catch (error: any) {
      console.error('Failed to create leave request:', error);
      setErrors({ general: error.message || 'Failed to create leave request. Please try again.' });
    } finally {
      setSubmitLoading(false);
    }
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderSelectedLeaveType = () => {
    const selectedType = leaveTypes.find(type => type.id === formData.leave_type_id);
    
    if (!selectedType) return null;

    return (
      <Card className="mb-4 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <FaInfoCircle className="text-blue-500 mt-1" />
          <div>
            <h4 className="font-semibold text-blue-800">{selectedType.name}</h4>
            {selectedType.description && (
              <p className="text-sm text-blue-600 mt-1">{selectedType.description}</p>
            )}
            <div className="text-sm text-blue-600 mt-2">
              <strong>Max Days:</strong> {selectedType.max_days_per_request || 'Unlimited'} | 
              <strong> Advance Notice:</strong> {selectedType.advance_notice_days || 0} days
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderSelectedEmployee = () => {
    if (!selectedEmployee) return null;

    return (
      <Card className="mb-4 bg-green-50 border-green-200">
        <div className="flex items-start space-x-3">
          <FaUser className="text-green-500 mt-1" />
          <div>
            <h4 className="font-semibold text-green-800">
              {selectedEmployee.first_name} {selectedEmployee.last_name}
            </h4>
            <p className="text-sm text-green-600">
              {selectedEmployee.employee_code} • {selectedEmployee.department_name || selectedEmployee.department || 'No Department'}
            </p>
            <p className="text-sm text-green-600">{selectedEmployee.email}</p>
          </div>
        </div>
      </Card>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="xl" />
        <span className="ml-2">Loading leave types...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            size="sm"
            color="gray"
            onClick={() => navigate('/leave-requests')}
          >
            <FaArrowLeft className="mr-2" />
            Back to Requests
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Leave Request</h1>
            <p className="text-gray-600">Create a leave request for an employee</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <Alert color="success" className="mb-6">
          <div className="flex items-center">
            <FaInfoCircle className="mr-2" />
            {success}
          </div>
        </Alert>
      )}

      {/* Error Message */}
      {(error || errors.general) && (
        <Alert color="failure" className="mb-6">
          <div className="flex items-center">
            <FaInfoCircle className="mr-2" />
            {error || errors.general}
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">
              Leave Request Details
            </h2>

            {/* Employee Selection */}
            <div>
              <Label htmlFor="employee_id" value="Select Employee *" />
              <Select
                id="employee_id"
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                className={errors.employee_id ? 'border-red-500' : ''}
                disabled={employeesLoading}
                required
              >
                <option value="">
                  {employeesLoading ? 'Loading employees...' : 'Choose employee...'}
                </option>
                {!employeesLoading && employees.length === 0 && (
                  <option value="" disabled>No employees found</option>
                )}
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code}) - {employee.department_name || employee.department || 'No Dept'}
                  </option>
                ))}
              </Select>
              {errors.employee_id && (
                <p className="text-red-500 text-sm mt-1">{errors.employee_id}</p>
              )}
              {employeesLoading && (
                <p className="text-blue-500 text-sm mt-1 flex items-center">
                  <Spinner size="sm" className="mr-2" />
                  Loading employees from database...
                </p>
              )}
              {!employeesLoading && employees.length === 0 && (
                <p className="text-yellow-600 text-sm mt-1">
                  No active employees found. Please check if employees are added to the system.
                </p>
              )}
            </div>

            {/* Selected Employee Info */}
            {renderSelectedEmployee()}

            {/* Leave Type Selection */}
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

            {/* Selected Leave Type Info */}
            {renderSelectedLeaveType()}

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
                  required
                />
                {errors.end_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>
                )}
              </div>
            </div>

            {/* Calculated Days Display */}
            {calculatedDays > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  <strong>Total Business Days: {calculatedDays} day{calculatedDays !== 1 ? 's' : ''}</strong>
                  {formData.start_date && formData.end_date && (
                    <span className="ml-2">
                      ({formatDate(formData.start_date)} to {formatDate(formData.end_date)})
                    </span>
                  )}
                </p>
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
                placeholder="Internal notes for this leave request (visible to admins only)..."
                rows={3}
              />
              <p className="text-sm text-gray-500 mt-1">
                These notes are only visible to administrators and will not be shown to the employee.
              </p>
            </div>

            {/* Supporting Documents */}
            <div>
              <Label htmlFor="documents" value="Supporting Documents (Optional)" />
              <div className="mt-1">
                <input
                  id="documents"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Maximum 5 files. Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
              </p>
              
              {/* Show selected files */}
              {formData.supporting_documents.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700">Selected files:</p>
                  <ul className="text-sm text-gray-600">
                    {formData.supporting_documents.map((file, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <FaFileUpload />
                        <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            color="gray"
            onClick={() => navigate('/leave-requests')}
            disabled={submitLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="blue"
            disabled={submitLoading || !formData.employee_id || !formData.leave_type_id}
          >
            {submitLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Creating Request...
              </>
            ) : (
              <>
                💾 Create Request
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;