// =============================================
// LEAVE REQUEST FORM COMPONENT
// File: src/components/Leaves/LeaveRequestForm.tsx
// =============================================

import React, { useState, useEffect } from "react";
import { Button, Card, Alert, Spinner, Label, TextInput, Textarea, Select } from "flowbite-react";
import { FaArrowLeft, FaCalendarAlt, FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useMyLeaves } from "../../hooks/useLeaves";
import leaveApiService, { LeaveType, CreateLeaveRequestData } from "../../services/leaveApi";

// =============================================
// INTERFACES
// =============================================

interface FormData {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  supporting_documents: File[];
}

interface FormErrors {
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
  const { leaveTypes, balance, loading, submitting, error, submitRequest, getBalance, clearError } = useMyLeaves();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    supporting_documents: []
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    // Calculate days when dates change
    if (formData.start_date && formData.end_date) {
      const days = leaveApiService.calculateBusinessDays(formData.start_date, formData.end_date);
      setCalculatedDays(days);
    } else {
      setCalculatedDays(0);
    }
  }, [formData.start_date, formData.end_date]);

  useEffect(() => {
    // Update selected leave type when form changes
    if (formData.leave_type_id) {
      const leaveType = leaveTypes.find(lt => lt.id === formData.leave_type_id);
      setSelectedLeaveType(leaveType || null);
    } else {
      setSelectedLeaveType(null);
    }
  }, [formData.leave_type_id, leaveTypes]);

  useEffect(() => {
    // Get current user's balance when component mounts
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.employeeId) {
          getBalance(user.employeeId);
        }
      } catch (error) {
        console.error('Failed to get user data:', error);
      }
    }
  }, [getBalance]);

  // =============================================
  // HANDLERS
  // =============================================

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files).slice(0, 5); // Max 5 files
      setFormData(prev => ({ ...prev, supporting_documents: fileArray }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required fields
    if (!formData.leave_type_id) {
      newErrors.leave_type_id = 'Please select a leave type';
    }
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }
    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    }
    if (!formData.reason.trim() || formData.reason.trim().length < 10) {
      newErrors.reason = 'Please provide a detailed reason (minimum 10 characters)';
    }

    // Date validation
    if (formData.start_date && formData.end_date) {
      const validation = leaveApiService.validateLeaveDates(formData.start_date, formData.end_date);
      if (!validation.isValid) {
        newErrors.general = validation.errors.join('. ');
      }
    }

    // Leave type specific validation
    if (selectedLeaveType && calculatedDays > 0) {
      // Check consecutive days limit
      if (selectedLeaveType.maxConsecutiveDays > 0 && calculatedDays > selectedLeaveType.maxConsecutiveDays) {
        newErrors.general = `This leave type allows maximum ${selectedLeaveType.maxConsecutiveDays} consecutive days`;
      }

      // Check available balance
      const leaveBalance = balance.find(b => b.leaveType.id === selectedLeaveType.id);
      if (leaveBalance && calculatedDays > leaveBalance.balance.remaining) {
        newErrors.general = `Insufficient leave balance. Available: ${leaveBalance.balance.remaining} days, Requested: ${calculatedDays} days`;
      }

      // Check notice period
      const daysUntilStart = Math.ceil((new Date(formData.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart < selectedLeaveType.noticePeriodDays) {
        newErrors.general = `This leave type requires ${selectedLeaveType.noticePeriodDays} days advance notice`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const requestData: CreateLeaveRequestData = {
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      days_requested: calculatedDays,
      reason: formData.reason.trim(),
      supporting_documents: formData.supporting_documents.length > 0 ? 
        formData.supporting_documents.map(file => ({ name: file.name, size: file.size })) : undefined
    };

    const success = await submitRequest(requestData);
    
    if (success) {
      navigate('/my-leave-requests', {
        state: { message: 'Leave request submitted successfully!' }
      });
    }
  };

  const handlePreview = () => {
    if (validateForm()) {
      setShowPreview(true);
    }
  };

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const getLeaveBalance = (leaveTypeId: string) => {
    return balance.find(b => b.leaveType.id === leaveTypeId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderLeaveTypeInfo = () => {
    if (!selectedLeaveType) return null;

    const leaveBalance = getLeaveBalance(selectedLeaveType.id);

    return (
      <Card className="mt-4 bg-blue-50 dark:bg-blue-900/20">
        <div className="space-y-3">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <FaInfoCircle />
            {selectedLeaveType.name} Details
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Type:</strong> {selectedLeaveType.isPaid ? 'Paid' : 'Unpaid'}</p>
              <p><strong>Max per year:</strong> {selectedLeaveType.maxDaysPerYear} days</p>
              {selectedLeaveType.maxConsecutiveDays > 0 && (
                <p><strong>Max consecutive:</strong> {selectedLeaveType.maxConsecutiveDays} days</p>
              )}
              <p><strong>Notice required:</strong> {selectedLeaveType.noticePeriodDays} days</p>
            </div>
            
            {leaveBalance && (
              <div>
                <p><strong>Allocated:</strong> {leaveBalance.balance.allocated} days</p>
                <p><strong>Used:</strong> {leaveBalance.balance.used} days</p>
                <p><strong>Pending:</strong> {leaveBalance.balance.pending} days</p>
                <p className={`font-medium ${leaveBalance.balance.remaining > 5 ? 'text-green-600' : 'text-red-600'}`}>
                  <strong>Available:</strong> {leaveBalance.balance.remaining} days
                </p>
              </div>
            )}
          </div>

          {selectedLeaveType.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              {selectedLeaveType.description}
            </p>
          )}
        </div>
      </Card>
    );
  };

  const renderPreviewModal = () => {
    if (!showPreview) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h3 className="text-xl font-bold mb-4">Review Leave Request</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label value="Leave Type" />
                  <p className="font-medium">{selectedLeaveType?.name}</p>
                </div>
                <div>
                  <Label value="Duration" />
                  <p className="font-medium">{calculatedDays} day{calculatedDays > 1 ? 's' : ''}</p>
                </div>
                <div>
                  <Label value="Start Date" />
                  <p className="font-medium">{formatDate(formData.start_date)}</p>
                </div>
                <div>
                  <Label value="End Date" />
                  <p className="font-medium">{formatDate(formData.end_date)}</p>
                </div>
              </div>
              
              <div>
                <Label value="Reason" />
                <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {formData.reason}
                </p>
              </div>

              {formData.supporting_documents.length > 0 && (
                <div>
                  <Label value="Supporting Documents" />
                  <ul className="mt-1 space-y-1">
                    {formData.supporting_documents.map((file, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                        📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button color="gray" onClick={() => setShowPreview(false)}>
                Back to Edit
              </Button>
              <Button color="purple" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Spinner size="sm" className="mr-2" /> : null}
                Submit Request
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="xl" />
        <span className="ml-3">Loading leave information...</span>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          color="gray"
          size="sm"
          onClick={() => navigate('/leaves')}
          className="flex items-center gap-2"
        >
          <FaArrowLeft className="w-4 h-4" />
          Back to Leaves
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Submit Leave Request</h1>
      </div>

      {/* Error Display */}
      {(error || errors.general) && (
        <Alert color="failure" className="mb-4">
          <div className="flex items-center justify-between">
            <span>{error || errors.general}</span>
            <Button size="xs" color="failure" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Leave Details</h3>

            {/* Leave Type Selection */}
            <div>
              <Label htmlFor="leave_type" value="Leave Type *" />
              <Select
                id="leave_type"
                value={formData.leave_type_id}
                onChange={(e) => handleInputChange('leave_type_id', e.target.value)}
                className={errors.leave_type_id ? 'border-red-500' : ''}
                required
              >
                <option value="">Select leave type</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.isPaid ? 'Paid' : 'Unpaid'})
                  </option>
                ))}
              </Select>
              {errors.leave_type_id && (
                <p className="text-red-500 text-sm mt-1">{errors.leave_type_id}</p>
              )}
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date" value="Start Date *" />
                <TextInput
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={errors.start_date ? 'border-red-500' : ''}
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
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  min={formData.start_date || new Date().toISOString().split('T')[0]}
                  className={errors.end_date ? 'border-red-500' : ''}
                  required
                />
                {errors.end_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>
                )}
              </div>
            </div>

            {/* Duration Display */}
            {calculatedDays > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <FaCalendarAlt className="inline mr-2" />
                  Duration: <strong>{calculatedDays} business day{calculatedDays > 1 ? 's' : ''}</strong>
                  {formData.start_date && formData.end_date && (
                    <span className="ml-2">
                      ({formatDate(formData.start_date)} to {formatDate(formData.end_date)})
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Leave Type Information */}
            {renderLeaveTypeInfo()}

            {/* Reason */}
            <div>
              <Label htmlFor="reason" value="Reason for Leave *" />
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="Please provide a detailed reason for your leave request..."
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

            {/* Supporting Documents */}
            <div>
              <Label htmlFor="documents" value="Supporting Documents (Optional)" />
              <input
                id="documents"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum 5 files. Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB each)
              </p>
              
              {formData.supporting_documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  {formData.supporting_documents.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-sm">📄 {file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            color="gray"
            onClick={() => navigate('/leaves')}
          >
            Cancel
          </Button>
          <Button
            type="button"
            color="blue"
            onClick={handlePreview}
            disabled={!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason.trim()}
          >
            Preview Request
          </Button>
          <Button
            type="submit"
            color="purple"
            disabled={submitting}
          >
            {submitting ? <Spinner size="sm" className="mr-2" /> : null}
            Submit Request
          </Button>
        </div>
      </form>

      {/* Preview Modal */}
      {renderPreviewModal()}
    </div>
  );
};

export default LeaveRequestForm;