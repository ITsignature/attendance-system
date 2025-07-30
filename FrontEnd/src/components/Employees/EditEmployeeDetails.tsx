// EditEmployeeDetails.tsx - Complete backend integration
import React, { useState, useEffect } from "react";
import { Tabs, TextInput, Select, Button, Alert, Spinner, Label } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText, HiSave, HiX } from "react-icons/hi";
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
}

interface ValidationErrors {
  [key: string]: string;
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

  // Load data on component mount
  useEffect(() => {
    if (!employeeId) {
      setError('Employee ID is required');
      setLoading(false);
      return;
    }
    
    loadEmployeeData();
    loadReferenceData();
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

  const handleChange = (field: keyof Employee, value: string | number) => {
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
          </div>
        </Tabs.Item>

        {/* Documents Tab */}
        <Tabs.Item title="Documents" icon={HiDocumentText}>
          <div className="mt-6">
            <FileUploadBox />
            <p className="text-sm text-gray-500 mt-4">
              Upload employee documents such as ID cards, certificates, contracts, etc.
            </p>
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