// EditEmployeeDetails.tsx - Complete backend integration
import React, { useState, useEffect } from "react";
import { Tabs, TextInput, Select, Button, Alert, Spinner, Label, Checkbox } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText, HiSave, HiX, HiClock } from "react-icons/hi";
import { FaDownload, FaTrash } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import apiService from '../../services/api';
import FileUploadBox from "./FileUploadBox";

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
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  // Added work schedule fields
  in_time?: string;
  out_time?: string;
  follows_company_schedule?: boolean;
  department_name?: string;
  designation_title?: string;
  manager_name?: string;
}

interface UpdateEmployeeData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  nationality?: string;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  employee_code?: string;
  department_id?: string;
  designation_id?: string;
  manager_id?: string;
  hire_date?: string;
  employment_status?: 'active' | 'inactive' | 'terminated' | 'on_leave';
  employee_type?: 'full_time' | 'part_time' | 'contract' | 'intern';
  base_salary?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  // Added work schedule fields
  in_time?: string;
  out_time?: string;
  follows_company_schedule?: boolean;
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
  notes?: string;
  uploaded_by_name?: string;
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
  
  // Reference data
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [filteredManagers, setFilteredManagers] = useState<any[]>([]);
  
  // Document management
  const [documents, setDocuments] = useState<{[key: string]: EmployeeDocument[]}>({});
  const [documentUploading, setDocumentUploading] = useState(false);

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

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getEmployee(employeeId!);
      
      if (response.success && response.data) {
        const employeeData = response.data.employee;
        setEmployee(employeeData);
        setFormData({ ...employeeData }); // Create a copy for editing
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
      console.log('🔄 Loading documents for employee:', employeeId);
      
      const response = await apiService.apiCall(`/api/employees/${employeeId}/documents`);
      
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

// Fixed handleDocumentUpload function
const handleDocumentUpload = async (documentType: string, file: File) => {
  if (!file) return;

  try {
    setDocumentUploading(true);
    const formData = new FormData();
    
    // Add single file to FormData with the document type as the field name
    formData.append(documentType, file);
    
    // Add notes for the document
    formData.append('notes', `${documentType.replace('_', ' ')} document for employee`);

    const response = await apiService.apiCall(
      `/api/employees/${employeeId}/documents`,
      'POST',
      formData,
      { 'Content-Type': 'multipart/form-data' }
    );

    if (response.success) {
      setSuccess(`Successfully uploaded document: ${file.name}`);
      // Reload documents to show the newly uploaded ones
      await loadDocuments();
    } else {
      setError('Failed to upload document: ' + response.message);
    }
  } catch (error: any) {
    console.error('Document upload error:', error);
    setError('Failed to upload document: ' + error.message);
  } finally {
    setDocumentUploading(false);
  }
};

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const response = await apiService.apiCall(
        `/api/employees/${employeeId}/documents/${documentId}/download`,
        'GET',
        null,
        { responseType: 'blob' }
      );
      
      if (response.success) {
        // Create blob URL and trigger download
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download document:', error);
      setError('Failed to download document');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await apiService.apiCall(
        `/api/employees/${employeeId}/documents/${documentId}`,
        'DELETE'
      );
      
      if (response.success) {
        setSuccess('Document deleted successfully');
        // Reload documents after deletion
        await loadDocuments();
      } else {
        setError('Failed to delete document');
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('Failed to delete document');
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

  const handleChange = (field: keyof Employee, value: string | number | boolean) => {
    if (!formData) return;
    
    setFormData(prev => ({
      ...prev!,
      [field]: value
    }));

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle company schedule checkbox change - fetch company times when enabled
  const handleCompanyScheduleChange = async (checked: boolean) => {
    if (!formData) return;

    if (checked) {
      // Fetch fresh company times from database when checkbox is checked
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
        // Only fallback if database fetch fails
        setFormData(prev => ({
          ...prev!,
          follows_company_schedule: true
        }));
      }
    } else {
      // Just update the checkbox, keep current times for manual editing
      setFormData(prev => ({
        ...prev!,
        follows_company_schedule: false
      }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData) return false;
    
    const errors: ValidationErrors = {};

    // Required field validation
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

    // Work schedule validation
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

  const getChangedFields = (): UpdateEmployeeData => {
    if (!employee || !formData) return {};

    const changes: UpdateEmployeeData = {};
    
    // Compare each field and only include changed ones
    Object.keys(formData).forEach(key => {
      const originalValue = employee[key as keyof Employee];
      const newValue = formData[key as keyof Employee];
      
      // Handle different data types and null/undefined
      if (originalValue !== newValue) {
        // Special handling for empty strings vs null/undefined
        if (!((!originalValue || originalValue === '') && (!newValue || newValue === ''))) {
          changes[key as keyof UpdateEmployeeData] = newValue;
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

      // Get only changed fields
      const changedData = getChangedFields();
      
      if (Object.keys(changedData).length === 0) {
        setError('No changes detected');
        return;
      }

      console.log('Updating employee with changes:', changedData);

      const response = await apiService.updateEmployee(employeeId!, changedData);

      if (response.success && response.data) {
        setSuccess('Employee updated successfully!');
        setEmployee(response.data.employee);
        setFormData({ ...response.data.employee });
        
        // Navigate back to employee details after a delay
        setTimeout(() => {
          navigate(`/employee/${employeeId}`);
        }, 2000);
      } else {
        setError(response.message || 'Failed to update employee');
        
        // Handle field-specific errors
        if (response.field) {
          setValidationErrors({
            [response.field]: response.message || 'Invalid value'
          });
        }
      }
    } catch (error: any) {
      console.error('Update employee error:', error);
      setError(error.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
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
              >
                <option value="">Select Designation</option>
                {designations.map((designation) => (
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
                type="number"
                value={formData.base_salary?.toString() || ''}
                onChange={(e) => handleChange('base_salary', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>

            {/* Work Schedule Section */}
            <div className="md:col-span-2 border-t pt-4 mt-4">
              <h4 className="text-lg font-medium mb-3 flex items-center gap-2">
                <HiClock className="w-5 h-5 text-purple-600" />
                Work Schedule
              </h4>
            </div>

            {/* Company Schedule Checkbox */}
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

              {/* Show current company schedule if following */}
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

            {/* Time Fields */}
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

            {/* Warning for custom schedule */}
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
          </div>
        </Tabs.Item>

        {/* Documents Tab */}
        <Tabs.Item title="Documents" icon={HiDocumentText}>
          <div className="mt-6 space-y-6">
            {/* Upload Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700">
              <h4 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                <HiDocumentText className="w-5 h-5" />
                Upload New Documents
              </h4>
              
              <FileUploadBox onFilesSelected={handleDocumentUpload} />
              
              {documentUploading && (
                <div className="mt-4 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Spinner size="sm" />
                  <span>Uploading documents...</span>
                </div>
              )}
              
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-4">
                Supported formats: PDF, DOC, DOCX, JPG, PNG, Excel files. Maximum 10MB per file.
              </p>
            </div>

            {/* Existing Documents */}
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
                                {doc.notes && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                    "{doc.notes}"
                                  </p>
                                )}
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

            {/* Document Types Info */}
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
          disabled={saving}
        >
          {saving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <HiSave className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default EditEmployeeDetails;