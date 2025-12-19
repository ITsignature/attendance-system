// EditEmployeeDetails.tsx - Complete version with loading overlay
import React, { useState, useEffect } from "react";
import { Tabs, TextInput, Select, Button, Alert, Spinner, Label, Checkbox } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText, HiSave, HiX, HiClock } from "react-icons/hi";
import { FaDownload, FaTrash } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import apiService from '../../services/api';
import FileUploadBox from "./FileUploadBox";

// Loading Overlay Component
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  submessage?: string;
  spinnerSize?: 'sm' | 'md' | 'lg' | 'xl';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Processing...',
  submessage,
  spinnerSize = 'xl'
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center max-w-md mx-4">
        <Spinner size={spinnerSize} className="mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
          {message}
        </h3>
        {submessage && (
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
            {submessage}
          </p>
        )}
      </div>
    </div>
  );
};

// Types
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  nationality?: string;
  marital_status: 'single' | 'married' | 'divorced' | 'widowed';
  employee_code: string;
  department_id: string;
  designation_id: string;
  manager_id?: string;
  hire_date: string;
  employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  employee_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  base_salary?: number;
  attendance_affects_salary?: boolean;

  // Overtime Configuration
  overtime_enabled?: boolean;
  pre_shift_overtime_enabled?: boolean;
  post_shift_overtime_enabled?: boolean;
  weekday_ot_multiplier?: number | null;
  saturday_ot_multiplier?: number | null;
  sunday_ot_multiplier?: number | null;
  holiday_ot_multiplier?: number | null;

  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
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
  department_name?: string;
  designation_title?: string;
  manager_name?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface EmployeeDocument {
  id: string;
  document_type: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by_name?: string;
}

interface PendingDocument {
  documentType: string;
  file: File;
  id: string;
}

const EditEmployeeDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id: employeeId } = useParams<{ id: string }>();
  
  // State
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  
  // Loading overlay state
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [loadingSubmessage, setLoadingSubmessage] = useState('');
  
  // Reference data
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [filteredDesignations, setFilteredDesignations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [filteredManagers, setFilteredManagers] = useState<any[]>([]);
  
  // Document management
  const [documents, setDocuments] = useState<{[key: string]: EmployeeDocument[]}>({});
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [documentUploading, setDocumentUploading] = useState(false);

  // Helper functions for loading overlay
  const showLoading = (message: string, submessage?: string) => {
    setLoadingMessage(message);
    setLoadingSubmessage(submessage || '');
    setShowLoadingOverlay(true);
  };

  const hideLoading = () => {
    setShowLoadingOverlay(false);
  };

  // Load data on component mount
  useEffect(() => {
    if (!employeeId) {
      setError('Employee ID is required');
      setLoading(false);
      return;
    }
    
    loadEmployeeData();
    loadReferenceData();
    loadDocuments();
  }, [employeeId]);

  // Filter managers when department changes
  useEffect(() => {
    if (formData?.department_id) {
      const selectedDept = departments.find(d => d.id === formData.department_id);
      const filtered = managers.filter(
        manager => manager.department_name === selectedDept?.name
      );
      setFilteredManagers(filtered);
    } else {
      setFilteredManagers(managers);
    }
  }, [formData?.department_id, departments, managers]);

  useEffect(() => {
    if (formData?.department_id) {
      const filtered = designations.filter(
        designation => designation.department_id === formData.department_id
      );
      setFilteredDesignations(filtered);
    } else {
      setFilteredDesignations(designations);
    }
  }, [formData?.department_id, designations]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getEmployee(employeeId!);
      
      if (response.success && response.data) {
        const employeeData = response.data.employee;

        // Ensure weekend_working_config is properly initialized
        const normalizedEmployeeData = {
          ...employeeData,
          weekend_working_config: employeeData.weekend_working_config || null
        };

        setEmployee(normalizedEmployeeData);
        setFormData({ ...normalizedEmployeeData });
      } else {
        setError(response.message || 'Failed to load employee data');
      }
    } catch (error: any) {
      console.error('Failed to load employee:', error);
      setError('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!employeeId) return;
    
    try {
      console.log('Loading documents for employee:', employeeId);
      
      const response = await apiService.apiCall(`/api/employees/${employeeId}/documents`);
      
      if (response.success && response.data) {
        const data = response.data as any;
        console.log('Documents loaded:', data.documents);
        setDocuments(data.documents || {});
      } else {
        console.warn('Failed to load documents:', response.message);
        setDocuments({});
      }
    } catch (error) {
      console.warn('Failed to load documents:', error);
      setDocuments({});
    }
  };

  const loadReferenceData = async () => {
    try {
      const [deptResponse, designResponse, managerResponse] = await Promise.all([
        apiService.getDepartments(),
        apiService.getDesignations(),
        apiService.getManagers()
      ]);

      if (deptResponse.success && deptResponse.data) {
        setDepartments(deptResponse.data.departments || []);
      }

      if (designResponse.success && designResponse.data) {
        setDesignations(designResponse.data.designations || []);
      }

      if (managerResponse.success && managerResponse.data) {
        setManagers(managerResponse.data.managers || []);
      }
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };

  const handleDocumentSelect = (documentType: string, file: File | null) => {
    if (!file) {
      setPendingDocuments(prev => prev.filter(doc => doc.documentType !== documentType));
      return;
    }

    const existingIndex = pendingDocuments.findIndex(doc => doc.documentType === documentType);
    
    const newDocument: PendingDocument = {
      documentType,
      file,
      id: `${documentType}_${Date.now()}`
    };

    if (existingIndex >= 0) {
      setPendingDocuments(prev => {
        const updated = [...prev];
        updated[existingIndex] = newDocument;
        return updated;
      });
    } else {
      setPendingDocuments(prev => [...prev, newDocument]);
    }
  };

  const removePendingDocument = (documentId: string) => {
    setPendingDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const uploadPendingDocuments = async (): Promise<boolean> => {
    if (pendingDocuments.length === 0) return true;

    setDocumentUploading(true);
    const uploadResults: boolean[] = [];

    try {
      for (const pendingDoc of pendingDocuments) {
        const formData = new FormData();
        formData.append(pendingDoc.documentType, pendingDoc.file);

        const token = localStorage.getItem('accessToken');
        const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
        
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

        const response = await fetch(`${baseURL}/api/employees/${employeeId}/documents`, {
          method: 'POST',
          headers,
          body: formData
        });

        const data = await response.json();
        uploadResults.push(data.success);

        if (!data.success) {
          setError(`Failed to upload ${pendingDoc.file.name}: ${data.message}`);
        }
      }

      if (uploadResults.every(result => result === true)) {
        setPendingDocuments([]);
        await loadDocuments();
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Document upload error:', error);
      setError('Failed to upload documents: ' + error.message);
      return false;
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      showLoading('Downloading Document...', `Preparing ${filename} for download.`);
      
      const token = localStorage.getItem('accessToken');
      const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
      
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
    } finally {
      hideLoading();
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      showLoading('Deleting Document...', 'Removing document from database.');
      
      const response = await apiService.apiCall(
        `/api/employees/${employeeId}/documents/${documentId}`,
        {
          method: 'DELETE'
        }
      );
      
      if (response.success) {
        setSuccess('Document deleted successfully');
        await loadDocuments();
      } else {
        setError('Failed to delete document');
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('Failed to delete document');
    } finally {
      hideLoading();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleChange = (field: keyof Employee, value: string | number | boolean) => {
    if (!formData) return;
    
    setFormData(prev => ({
      ...prev!,
      [field]: value
    }));

    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCompanyScheduleChange = async (checked: boolean) => {
    if (!formData) return;

    if (checked) {
      try {
        const response = await apiService.apiCall('/api/settings');
        if (response.success) {
          const settings = response.data.settings;
          setFormData(prev => ({
            ...prev!,
            follows_company_schedule: true,
            in_time: settings.work_start_time?.value || '09:00',
            out_time: settings.work_end_time?.value || '17:00'
          }));
        }
      } catch (error) {
        console.error('Failed to load company schedule:', error);
        setFormData(prev => ({
          ...prev!,
          follows_company_schedule: true
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev!,
        follows_company_schedule: false
      }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData) return false;
    
    const errors: ValidationErrors = {};

    if (!formData.first_name?.trim()) {
      errors.first_name = 'First name is required';
    }

    if (!formData.last_name?.trim()) {
      errors.last_name = 'Last name is required';
    }

    if (!formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone?.trim()) {
      errors.phone = 'Phone number is required';
    }

    if (!formData.employee_code?.trim()) {
      errors.employee_code = 'Employee code is required';
    }

    if (!formData.department_id) {
      errors.department_id = 'Department is required';
    }

    if (!formData.designation_id) {
      errors.designation_id = 'Designation is required';
    }

    if (!formData.emergency_contact_name?.trim()) {
      errors.emergency_contact_name = 'Emergency contact name is required';
    }

    if (!formData.emergency_contact_phone?.trim()) {
      errors.emergency_contact_phone = 'Emergency contact phone is required';
    }

    if (!formData.emergency_contact_relation?.trim()) {
      errors.emergency_contact_relation = 'Emergency contact relation is required';
    }

    if (formData.in_time && formData.out_time) {
      const inTime = new Date(`2000-01-01T${formData.in_time}`);
      const outTime = new Date(`2000-01-01T${formData.out_time}`);
      
      if (outTime <= inTime) {
        errors.out_time = 'Out time must be after in time';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getChangedFields = (): any => {
    if (!employee || !formData) return {};

    const changes: any = {};
    
    Object.keys(formData).forEach(key => {
      const originalValue = employee[key as keyof Employee];
      const newValue = formData[key as keyof Employee];
      
      if (originalValue !== newValue) {
        if (!((!originalValue || originalValue === '') && (!newValue || newValue === ''))) {
          changes[key] = newValue;
        }
      }
    });

    return changes;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setError('Please fix the validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const changedData = getChangedFields();
      const hasFormChanges = Object.keys(changedData).length > 0;
      const hasPendingDocs = pendingDocuments.length > 0;
      const pendingDocsCount = pendingDocuments.length;

      if (!hasFormChanges && !hasPendingDocs) {
        setError('No changes detected');
        return;
      }

      let updateSuccess = true;
      let uploadSuccess = true;

      // Show loading overlay for the entire save process
      if (hasFormChanges && hasPendingDocs) {
        showLoading('Updating Employee...', 'Saving changes and uploading documents. Please wait.');
      } else if (hasFormChanges) {
        showLoading('Updating Employee...', 'Saving employee information changes.');
      } else if (hasPendingDocs) {
        showLoading('Uploading Documents...', `Uploading ${pendingDocsCount} document(s).`);
      }

      // Upload pending documents first
      if (hasPendingDocs) {
        console.log(`Uploading ${pendingDocsCount} pending documents...`);
        uploadSuccess = await uploadPendingDocuments();
      }

      // Update employee data if there are changes
      if (hasFormChanges) {
        console.log('Updating employee with changes:', changedData);

        const response = await apiService.updateEmployee(employeeId!, changedData);

        if (response.success && response.data) {
          setSuccess('Employee updated successfully!');
          setEmployee(response.data.employee);
          setFormData({ ...response.data.employee });
          
          setTimeout(() => {
            navigate(`/employee/${employeeId}`);
          }, 2000);
        } else {
          setError(response.message || 'Failed to update employee');
          updateSuccess = false;
          
          const responseData = response as any;
          if (responseData.field) {
            setValidationErrors({
              [responseData.field]: response.message || 'Invalid value'
            });
          }
        }
      }

      if (updateSuccess && uploadSuccess) {
        const messages = [];
        if (hasFormChanges) messages.push('Employee information updated');
        if (hasPendingDocs) messages.push(`${pendingDocsCount} document(s) uploaded`);
        setSuccess(messages.join(' and ') + ' successfully!');
        
        setTimeout(() => {
          navigate(`/employee/${employeeId}`);
        }, 2000);
      }

    } catch (error: any) {
      console.error('Save employee error:', error);
      setError(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
      hideLoading();
    }
  };

  const handleCancel = () => {
    setPendingDocuments([]);
    navigate(`/employee/${employeeId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="xl" />
        <span className="ml-3 text-lg">Loading employee data...</span>
      </div>
    );
  }

  if (!employee || !formData) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-md">
        <Alert color="failure">
          <span className="font-medium">Error!</span> {error || 'Failed to load employee data'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      {/* Loading Overlay */}
      <LoadingOverlay 
        isVisible={showLoadingOverlay} 
        message={loadingMessage} 
        submessage={loadingSubmessage} 
      />

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">
          Edit Employee Details: {employee.first_name} {employee.last_name}
        </h3>
        <p className="text-sm text-gray-500">
          Employee &gt; {employee.employee_code} &gt; Edit Details
        </p>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <Alert color="failure" className="mb-4">
          <span className="font-medium">Error!</span> {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" className="mb-4">
          <span className="font-medium">Success!</span> {success}
        </Alert>
      )}

      {/* Show pending documents notification */}
      {pendingDocuments.length > 0 && (
        <Alert color="info" className="mb-4">
          <span className="font-medium">Note:</span> You have {pendingDocuments.length} document(s) pending upload. 
          They will be uploaded when you click "Save Changes".
        </Alert>
      )}

      <Tabs aria-label="Edit Employee Info Tabs">
        {/* Personal Information Tab */}
        <Tabs.Item title="Personal Information" icon={HiUser}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Basic Information */}
            <div>
              <Label htmlFor="first_name" value="First Name *" />
              <TextInput
                id="first_name"
                value={formData.first_name || ''}
                onChange={(e) => handleChange('first_name', e.target.value)}
                color={validationErrors.first_name ? 'failure' : undefined}
              />
              {validationErrors.first_name && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.first_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="last_name" value="Last Name *" />
              <TextInput
                id="last_name"
                value={formData.last_name || ''}
                onChange={(e) => handleChange('last_name', e.target.value)}
                color={validationErrors.last_name ? 'failure' : undefined}
              />
              {validationErrors.last_name && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.last_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email" value="Email *" />
              <TextInput
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                color={validationErrors.email ? 'failure' : undefined}
              />
              {validationErrors.email && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone" value="Phone *" />
              <TextInput
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                color={validationErrors.phone ? 'failure' : undefined}
              />
              {validationErrors.phone && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.phone}</p>
              )}
            </div>

            <div>
              <Label htmlFor="date_of_birth" value="Date of Birth" />
              <TextInput
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth || ''}
                onChange={(e) => handleChange('date_of_birth', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="gender" value="Gender" />
              <Select
                id="gender"
                value={formData.gender || ''}
                onChange={(e) => handleChange('gender', e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="marital_status" value="Marital Status" />
              <Select
                id="marital_status"
                value={formData.marital_status || ''}
                onChange={(e) => handleChange('marital_status', e.target.value)}
              >
                <option value="">Select Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="nationality" value="Nationality" />
              <TextInput
                id="nationality"
                value={formData.nationality || ''}
                onChange={(e) => handleChange('nationality', e.target.value)}
              />
            </div>

            {/* Address Information */}
            <div className="md:col-span-2">
              <Label htmlFor="address" value="Address" />
              <TextInput
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="city" value="City" />
              <TextInput
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="state" value="State" />
              <TextInput
                id="state"
                value={formData.state || ''}
                onChange={(e) => handleChange('state', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="zip_code" value="ZIP Code" />
              <TextInput
                id="zip_code"
                value={formData.zip_code || ''}
                onChange={(e) => handleChange('zip_code', e.target.value)}
              />
            </div>

            {/* Emergency Contact */}
            <div className="md:col-span-2 border-t pt-4 mt-4">
              <h4 className="text-lg font-medium mb-3">Emergency Contact</h4>
            </div>

            <div>
              <Label htmlFor="emergency_contact_name" value="Contact Name *" />
              <TextInput
                id="emergency_contact_name"
                value={formData.emergency_contact_name || ''}
                onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                color={validationErrors.emergency_contact_name ? 'failure' : undefined}
              />
              {validationErrors.emergency_contact_name && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.emergency_contact_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergency_contact_phone" value="Contact Phone *" />
              <TextInput
                id="emergency_contact_phone"
                value={formData.emergency_contact_phone || ''}
                onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                color={validationErrors.emergency_contact_phone ? 'failure' : undefined}
              />
              {validationErrors.emergency_contact_phone && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.emergency_contact_phone}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergency_contact_relation" value="Relationship *" />
              <TextInput
                id="emergency_contact_relation"
                value={formData.emergency_contact_relation || ''}
                onChange={(e) => handleChange('emergency_contact_relation', e.target.value)}
                placeholder="e.g., Spouse, Parent, Sibling"
                color={validationErrors.emergency_contact_relation ? 'failure' : undefined}
              />
              {validationErrors.emergency_contact_relation && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.emergency_contact_relation}</p>
              )}
            </div>
          </div>
        </Tabs.Item>

        {/* Professional Information Tab */}
        <Tabs.Item title="Professional Information" icon={HiBriefcase}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <Label htmlFor="employee_code" value="Employee Code *" />
              <TextInput
                id="employee_code"
                value={formData.employee_code || ''}
                onChange={(e) => handleChange('employee_code', e.target.value)}
                color={validationErrors.employee_code ? 'failure' : undefined}
              />
              {validationErrors.employee_code && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.employee_code}</p>
              )}
            </div>

            <div>
              <Label htmlFor="department_id" value="Department *" />
              <Select
                id="department_id"
                value={formData.department_id || ''}
                onChange={(e) => handleChange('department_id', e.target.value)}
                color={validationErrors.department_id ? 'failure' : undefined}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
              {validationErrors.department_id && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.department_id}</p>
              )}
            </div>

            <div>
              <Label htmlFor="designation_id" value="Designation *" />
              <Select
                id="designation_id"
                value={formData.designation_id || ''}
                onChange={(e) => handleChange('designation_id', e.target.value)}
                color={validationErrors.designation_id ? 'failure' : undefined}
                disabled={!formData.department_id}
              >
                <option value="">
                  {formData.department_id ? 'Select designation' : 'Select department first'}
                </option>
                {filteredDesignations.map((designation) => (
                  <option key={designation.id} value={designation.id}>
                    {designation.title}
                  </option>
                ))}
              </Select>
              {validationErrors.designation_id && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.designation_id}</p>
              )}
            </div>

            <div>
              <Label htmlFor="manager_id" value="Manager" />
              <Select
                id="manager_id"
                value={formData.manager_id || ''}
                onChange={(e) => handleChange('manager_id', e.target.value)}
              >
                <option value="">Select Manager</option>
                {filteredManagers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="hire_date" value="Hire Date" />
              <TextInput
                id="hire_date"
                type="date"
                value={formData.hire_date || ''}
                onChange={(e) => handleChange('hire_date', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="employment_status" value="Employment Status" />
              <Select
                id="employment_status"
                value={formData.employment_status || ''}
                onChange={(e) => handleChange('employment_status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="employee_type" value="Employee Type" />
              <Select
                id="employee_type"
                value={formData.employee_type || ''}
                onChange={(e) => handleChange('employee_type', e.target.value)}
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="base_salary" value="Base Salary" />
              <TextInput
                id="base_salary"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.base_salary?.toString() || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  handleChange('base_salary', value ? parseFloat(value) : 0);
                }}
              />
            </div>

            {/* Salary Calculation Settings */}
            <div className="md:col-span-2 border-t pt-4 mt-4">
              <h4 className="text-lg font-medium mb-3">Salary Calculation Settings</h4>
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <Checkbox
                  id="attendance_affects_salary"
                  checked={formData.attendance_affects_salary === true || formData.attendance_affects_salary === 1}
                  onChange={(e) => handleChange('attendance_affects_salary', e.target.checked)}
                />
                <div>
                  <Label htmlFor="attendance_affects_salary" className="font-medium">
                    Calculate Salary Based on Attendance
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(formData.attendance_affects_salary === true || formData.attendance_affects_salary === 1)
                      ? "Employee's salary is calculated based on attendance records (pro-rated for absences)."
                      : "Employee receives full base salary regardless of attendance (suitable for executives, contractors with fixed monthly rates, etc.)."
                    }
                  </p>
                </div>
              </div>

              {(formData.attendance_affects_salary === false || formData.attendance_affects_salary === 0) && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      This employee will receive their full base salary every month regardless of attendance. Attendance tracking will still be active for reporting purposes.
                    </p>
                  </div>
                </div>
              )}

              {/* Overtime Configuration */}
              <div className="border-t pt-6 mt-6">
                <h5 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-4">
                  Overtime Calculation Settings
                </h5>

                {/* Overtime Enabled Checkbox */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Checkbox
                      id="overtime_enabled"
                      checked={formData.overtime_enabled === true || formData.overtime_enabled === 1}
                      onChange={(e) => handleChange('overtime_enabled', e.target.checked)}
                    />
                    <div>
                      <Label htmlFor="overtime_enabled" className="font-medium">
                        Enable Overtime Calculation
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Calculate and include overtime pay in this employee's salary based on hours worked beyond scheduled time.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Overtime Configuration Fields - Only shown when overtime is enabled */}
                {(formData.overtime_enabled === true || formData.overtime_enabled === 1) && (
                  <div className="ml-6 space-y-4 border-l-2 border-blue-300 dark:border-blue-600 pl-4">
                    {/* Pre-Shift and Post-Shift Overtime */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Checkbox
                          id="pre_shift_overtime_enabled"
                          checked={formData.pre_shift_overtime_enabled === true || formData.pre_shift_overtime_enabled === 1}
                          onChange={(e) => handleChange('pre_shift_overtime_enabled', e.target.checked)}
                        />
                        <Label htmlFor="pre_shift_overtime_enabled" className="text-sm">
                          Pre-Shift Overtime (before scheduled start time)
                        </Label>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Checkbox
                          id="post_shift_overtime_enabled"
                          checked={formData.post_shift_overtime_enabled === true || formData.post_shift_overtime_enabled === 1}
                          onChange={(e) => handleChange('post_shift_overtime_enabled', e.target.checked)}
                        />
                        <Label htmlFor="post_shift_overtime_enabled" className="text-sm">
                          Post-Shift Overtime (after scheduled end time)
                        </Label>
                      </div>
                    </div>

                    {/* Overtime Multipliers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      <div>
                        <Label htmlFor="weekday_ot_multiplier" value="Weekday OT Multiplier" />
                        <TextInput
                          id="weekday_ot_multiplier"
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="5.0"
                          value={formData.weekday_ot_multiplier || ''}
                          onChange={(e) => handleChange('weekday_ot_multiplier', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="e.g., 1.5"
                          helperText="Mon-Fri overtime rate"
                        />
                      </div>

                      <div>
                        <Label htmlFor="saturday_ot_multiplier" value="Saturday OT Multiplier" />
                        <TextInput
                          id="saturday_ot_multiplier"
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="5.0"
                          value={formData.saturday_ot_multiplier || ''}
                          onChange={(e) => handleChange('saturday_ot_multiplier', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="e.g., 2.0"
                          helperText="Saturday overtime rate"
                        />
                      </div>

                      <div>
                        <Label htmlFor="sunday_ot_multiplier" value="Sunday OT Multiplier" />
                        <TextInput
                          id="sunday_ot_multiplier"
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="5.0"
                          value={formData.sunday_ot_multiplier || ''}
                          onChange={(e) => handleChange('sunday_ot_multiplier', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="e.g., 2.5"
                          helperText="Sunday overtime rate"
                        />
                      </div>

                      <div>
                        <Label htmlFor="holiday_ot_multiplier" value="Holiday OT Multiplier" />
                        <TextInput
                          id="holiday_ot_multiplier"
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="5.0"
                          value={formData.holiday_ot_multiplier || ''}
                          onChange={(e) => handleChange('holiday_ot_multiplier', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="e.g., 3.0"
                          helperText="Holiday overtime rate"
                        />
                      </div>
                    </div>

                    {/* Overtime Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> Overtime multipliers determine how much extra the employee earns for overtime hours.
                        For example, 1.5x means they earn 150% of their regular hourly rate for overtime work.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Work Schedule Section */}
            <div className="md:col-span-2 border-t pt-4 mt-4">
              <h4 className="text-lg font-medium mb-3 flex items-center gap-2">
                <HiClock className="w-5 h-5 text-purple-600" />
                Work Schedule
              </h4>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <Checkbox
                  id="follows_company_schedule"
                  checked={formData.follows_company_schedule || false}
                  onChange={(e) => handleCompanyScheduleChange(e.target.checked)}
                />
                <div>
                  <Label htmlFor="follows_company_schedule" className="font-medium">
                    Follow Company Schedule
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.follows_company_schedule 
                      ? 'Employee follows company standard work hours' 
                      : 'Employee has custom work hours'
                    }
                  </p>
                </div>
              </div>

              {formData.follows_company_schedule && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                  <div className="flex items-center gap-2">
                    <HiClock className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Company Schedule: {formData.in_time && formData.out_time 
                        ? `${formData.in_time} - ${formData.out_time}` 
                        : 'Loading...'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="in_time" value="In Time *" />
              <TextInput
                id="in_time"
                type="time"
                value={formData.in_time || ''}
                onChange={(e) => handleChange('in_time', e.target.value)}
                disabled={formData.follows_company_schedule}
                color={validationErrors.in_time ? 'failure' : undefined}
                className={formData.follows_company_schedule ? 'opacity-60' : ''}
              />
              {validationErrors.in_time && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.in_time}</p>
              )}
            </div>

            <div>
              <Label htmlFor="out_time" value="Out Time *" />
              <TextInput
                id="out_time"
                type="time"
                value={formData.out_time || ''}
                onChange={(e) => handleChange('out_time', e.target.value)}
                disabled={formData.follows_company_schedule}
                color={validationErrors.out_time ? 'failure' : undefined}
                className={formData.follows_company_schedule ? 'opacity-60' : ''}
              />
              {validationErrors.out_time && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.out_time}</p>
              )}
            </div>

            {!formData.follows_company_schedule && (
              <div className="md:col-span-2 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-200">
                      This employee has custom work hours different from company standard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Weekend Working Configuration Section */}
            <div className="md:col-span-2 border-t pt-6 mt-6">
              <h4 className="text-lg font-medium mb-3 flex items-center gap-2">
                <HiClock className="w-5 h-5 text-green-600" />
                Weekend Working Configuration
              </h4>
            </div>

            {/* Saturday Working */}
            <div className="md:col-span-2 mb-6">
              <div className="flex items-center mb-3">
                <input
                  id="saturday_working"
                  type="checkbox"
                  checked={formData.weekend_working_config?.saturday?.working || false}
                  onChange={(e) => {
                    const working = e.target.checked;
                    setFormData(prev => ({
                      ...prev!,
                      weekend_working_config: {
                        ...prev!.weekend_working_config,
                        saturday: working ? {
                          working: true,
                          in_time: '09:00',
                          out_time: '17:00',
                          full_day_salary: false
                        } : undefined
                      }
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="saturday_working" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                  Saturday Working Day
                </label>
              </div>

              {formData.weekend_working_config?.saturday?.working && (
                <div className="ml-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="saturday_in_time" value="Saturday In Time" />
                      <TextInput
                        id="saturday_in_time"
                        type="time"
                        value={formData.weekend_working_config.saturday.in_time}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev!,
                            weekend_working_config: {
                              ...prev!.weekend_working_config,
                              saturday: {
                                ...prev!.weekend_working_config!.saturday!,
                                in_time: e.target.value
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="saturday_out_time" value="Saturday Out Time" />
                      <TextInput
                        id="saturday_out_time"
                        type="time"
                        value={formData.weekend_working_config.saturday.out_time}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev!,
                            weekend_working_config: {
                              ...prev!.weekend_working_config,
                              saturday: {
                                ...prev!.weekend_working_config!.saturday!,
                                out_time: e.target.value
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="saturday_full_day_salary"
                      type="checkbox"
                      checked={formData.weekend_working_config.saturday.full_day_salary}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev!,
                          weekend_working_config: {
                            ...prev!.weekend_working_config,
                            saturday: {
                              ...prev!.weekend_working_config!.saturday!,
                              full_day_salary: e.target.checked
                            }
                          }
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="saturday_full_day_salary" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Saturday Full Day Salary (same weight as weekday)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Sunday Working */}
            <div className="md:col-span-2 mb-6">
              <div className="flex items-center mb-3">
                <input
                  id="sunday_working"
                  type="checkbox"
                  checked={formData.weekend_working_config?.sunday?.working || false}
                  onChange={(e) => {
                    const working = e.target.checked;
                    setFormData(prev => ({
                      ...prev!,
                      weekend_working_config: {
                        ...prev!.weekend_working_config,
                        sunday: working ? {
                          working: true,
                          in_time: '09:00',
                          out_time: '17:00',
                          full_day_salary: false
                        } : undefined
                      }
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="sunday_working" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                  Sunday Working Day
                </label>
              </div>

              {formData.weekend_working_config?.sunday?.working && (
                <div className="ml-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sunday_in_time" value="Sunday In Time" />
                      <TextInput
                        id="sunday_in_time"
                        type="time"
                        value={formData.weekend_working_config.sunday.in_time}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev!,
                            weekend_working_config: {
                              ...prev!.weekend_working_config,
                              sunday: {
                                ...prev!.weekend_working_config!.sunday!,
                                in_time: e.target.value
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sunday_out_time" value="Sunday Out Time" />
                      <TextInput
                        id="sunday_out_time"
                        type="time"
                        value={formData.weekend_working_config.sunday.out_time}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev!,
                            weekend_working_config: {
                              ...prev!.weekend_working_config,
                              sunday: {
                                ...prev!.weekend_working_config!.sunday!,
                                out_time: e.target.value
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="sunday_full_day_salary"
                      type="checkbox"
                      checked={formData.weekend_working_config.sunday.full_day_salary}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev!,
                          weekend_working_config: {
                            ...prev!.weekend_working_config,
                            sunday: {
                              ...prev!.weekend_working_config!.sunday!,
                              full_day_salary: e.target.checked
                            }
                          }
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="sunday_full_day_salary" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Sunday Full Day Salary (same weight as weekday)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Weekend Working Info */}
            <div className="md:col-span-2 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Weekend Working Information
              </h5>
              <div className="text-sm text-green-600 dark:text-green-300 space-y-1">
                <p>• <strong>Full Day Salary:</strong> If checked, this day gets the same salary weight as a regular weekday</p>
                <p>• <strong>Hourly Salary:</strong> If unchecked, salary is calculated proportionally based on hours worked</p>
                <p>• Weekend working days will be included in attendance and payroll calculations</p>
              </div>
            </div>
          </div>
        </Tabs.Item>

        {/* Documents Tab */}
        <Tabs.Item title="Documents" icon={HiDocumentText}>
          <div className="mt-6 space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700">
              <h4 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                <HiDocumentText className="w-5 h-5" />
                Select Documents to Upload
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-800 dark:text-white">Identity Documents</h5>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h6 className="font-medium text-blue-800 dark:text-blue-200 mb-2">National ID</h6>
                    <FileUploadBox
                      id="national_id"
                      label=""
                      onFileChange={(file) => handleDocumentSelect('national_id', file)}
                      loading={documentUploading}
                    />
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h6 className="font-medium text-green-800 dark:text-green-200 mb-2">Passport</h6>
                    <FileUploadBox
                      id="passport"
                      label=""
                      onFileChange={(file) => handleDocumentSelect('passport', file)}
                      loading={documentUploading}
                    />
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <h6 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Other Documents</h6>
                    <FileUploadBox
                      id="other"
                      label=""
                      onFileChange={(file) => handleDocumentSelect('other', file)}
                      loading={documentUploading}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-800 dark:text-white">Professional Documents</h5>

                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                    <h6 className="font-medium text-orange-800 dark:text-orange-200 mb-2">Resume/CV</h6>
                    <FileUploadBox
                      id="resume"
                      label=""
                      onFileChange={(file) => handleDocumentSelect('resume', file)}
                      loading={documentUploading}
                    />
                  </div>

                  <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                    <h6 className="font-medium text-teal-800 dark:text-teal-200 mb-2">Education</h6>
                    <FileUploadBox
                      id="education"
                      label=""
                      onFileChange={(file) => handleDocumentSelect('education', file)}
                      loading={documentUploading}
                    />
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                    <h6 className="font-medium text-indigo-800 dark:text-indigo-200 mb-2">Experience</h6>
                    <FileUploadBox
                      id="experience"
                      label=""
                      onFileChange={(file) => handleDocumentSelect('experience', file)}
                      loading={documentUploading}
                    />
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-4">
                Supported formats: PDF, DOC, DOCX, JPG, PNG. Maximum 10MB per file.
                Documents will be uploaded when you click "Save Changes".
              </p>
            </div>

            {pendingDocuments.length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <HiClock className="w-5 h-5 text-orange-600" />
                  Pending Uploads ({pendingDocuments.length})
                </h4>
                
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <div className="space-y-2">
                    {pendingDocuments.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <HiDocumentText className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {doc.file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Type: {doc.documentType.replace('_', ' ')} • 
                              Size: {formatFileSize(doc.file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="xs"
                          color="red"
                          onClick={() => removePendingDocument(doc.id)}
                        >
                          <HiX className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-3">
                    These documents will be uploaded when you save changes.
                  </p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <HiDocumentText className="w-5 h-5 text-purple-600" />
                Existing Documents
              </h4>
              
              {Object.keys(documents).length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <HiDocumentText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No documents uploaded yet.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Use the upload section above to add documents.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(documents).map(([documentType, docs]) => (
                    <div key={documentType} className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                      <h5 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 capitalize border-b pb-2">
                        {documentType.replace('_', ' ')} ({docs.length} {docs.length === 1 ? 'file' : 'files'})
                      </h5>
                      
                      <div className="space-y-3">
                        {docs.map((doc) => (
                          <div 
                            key={doc.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-2xl flex-shrink-0">{getDocumentIcon(doc.mime_type)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {doc.original_filename}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                              </div>
                            </div>
                            
                            <div className="flex gap-2 ml-4 flex-shrink-0">
                              <Button 
                                size="xs" 
                                color="gray" 
                                title="Download"
                                onClick={() => handleDownloadDocument(doc.id, doc.original_filename)}
                              >
                                <FaDownload className="w-3 h-3" />
                              </Button>
                              
                              <Button 
                                size="xs" 
                                color="red" 
                                title="Delete"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <FaTrash className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Document Types</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-yellow-700 dark:text-yellow-300">
                <span>• National ID</span>
                <span>• Passport</span>
                <span>• Resume/CV</span>
                <span>• Education Certificates</span>
                <span>• Experience Letters</span>
                <span>• Other Documents</span>
              </div>
            </div>
          </div>
        </Tabs.Item>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
        <Button color="gray" onClick={handleCancel}>
          <HiX className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button 
          color="purple" 
          onClick={handleSave}
          disabled={saving || documentUploading}
        >
          {saving || documentUploading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              {documentUploading ? 'Uploading Documents...' : 'Saving...'}
            </>
          ) : (
            <>
              <HiSave className="w-4 h-4 mr-2" />
              Save Changes
              {pendingDocuments.length > 0 && ` (${pendingDocuments.length} docs)`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default EditEmployeeDetails;