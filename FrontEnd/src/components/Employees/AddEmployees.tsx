// Complete Backend Connected AddEmployees.tsx - Fixed Infinite Loop

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { 
  TextInput, 
  Select, 
  Label, 
  Button, 
  Alert,
  Spinner,
  Card,
  Breadcrumb,
  Badge
} from 'flowbite-react';
import { 
  HiUser, 
  HiBriefcase, 
  HiDocumentText,
  HiCheck,
  HiX,
  HiArrowLeft,
  HiArrowRight,
  HiHome
} from 'react-icons/hi';
import { DynamicProtectedComponent } from '../RBACSystem/rbacExamples';
import apiService from '../../services/api';
import FileUploadBox from './FileUploadBox';

// Form data interface matching your database structure
interface EmployeeFormData {
  // Personal Information
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | '';
  address: string;
  city: string;
  state: string;
  zip_code: string;
  nationality: string;
  marital_status: 'single' | 'married' | 'divorced' | 'widowed' | '';
  
  // Professional Information
  employee_id: string;
  department_id: string;
  designation_id: string;
  manager_id: string;
  hire_date: string;
  employment_status: 'active' | 'inactive';
  employment_type: 'permanent' | 'contract' | 'intern' | 'consultant';
  salary: number | '';
  
  // Emergency Contact
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
}

// Validation errors interface
interface ValidationErrors {
  [key: string]: string;
}

// Reference data interfaces
interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  title: string;
  department_id?: string;
}

interface Manager {
  id: string;
  full_name: string;
  department_name?: string;
}

const AddEmployees: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [filteredDesignations, setFilteredDesignations] = useState<Designation[]>([]);
  const [filteredManagers, setFilteredManagers] = useState<Manager[]>([]);

  // Form data
  const [formData, setFormData] = useState<EmployeeFormData>({
    // Personal Information
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    nationality: '',
    marital_status: '',
    
    // Professional Information
    employee_id: '',
    department_id: '',
    designation_id: '',
    manager_id: '',
    hire_date: '',
    employment_status: 'active',
    employment_type: 'permanent',
    salary: '',
    
    // Emergency Contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: ''
  });

  // Steps configuration
  const steps = [
    {
      title: 'Personal Information',
      icon: HiUser,
      description: 'Basic personal details'
    },
    {
      title: 'Professional Information',
      icon: HiBriefcase,
      description: 'Job and department details'
    },
    {
      title: 'Emergency Contact',
      icon: HiDocumentText,
      description: 'Emergency contact information'
    }
  ];

  // Load reference data on component mount
  useEffect(() => {
    loadReferenceData();
    generateEmployeeId();
  }, []);

  // Filter designations when department changes (NO STATE UPDATES HERE)
  useEffect(() => {
    if (formData.department_id) {
      const filtered = designations.filter(
        designation => designation.department_id === formData.department_id
      );
      setFilteredDesignations(filtered);
    } else {
      setFilteredDesignations(designations);
    }
  }, [formData.department_id, designations]);

  // Filter managers when department changes (NO STATE UPDATES HERE)
  useEffect(() => {
    if (formData.department_id) {
      const selectedDept = departments.find(d => d.id === formData.department_id);
      const filtered = managers.filter(
        manager => manager.department_name === selectedDept?.name
      );
      setFilteredManagers(filtered);
    } else {
      setFilteredManagers(managers);
    }
  }, [formData.department_id, managers, departments]);

  // Load departments, designations, and managers
  const loadReferenceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load departments
      const deptResponse = await apiService.getDepartments();
      if (deptResponse.success && deptResponse.data) {
        setDepartments(deptResponse.data.departments || []);
      }

      // Load designations
      const desigResponse = await apiService.getDesignations();
      if (desigResponse.success && desigResponse.data) {
        setDesignations(desigResponse.data.designations || []);
        setFilteredDesignations(desigResponse.data.designations || []);
      }

      // Load managers
      const managerResponse = await apiService.getManagers();
      if (managerResponse.success && managerResponse.data) {
        setManagers(managerResponse.data.managers || []);
        setFilteredManagers(managerResponse.data.managers || []);
      }

    } catch (err: any) {
      console.error('Failed to load reference data:', err);
      setError('Failed to load form data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate unique employee ID
  const generateEmployeeId = useCallback(() => {
    const prefix = 'EMP';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const employeeId = `${prefix}${timestamp}${random}`;
    
    setFormData(prev => ({ ...prev, employee_id: employeeId }));
  }, []);

  // Handle department change separately to reset designation and manager
  const handleDepartmentChange = (departmentId: string) => {
    setFormData(prev => ({ 
      ...prev, 
      department_id: departmentId,
      designation_id: '', // Reset designation when department changes
      manager_id: ''      // Reset manager when department changes
    }));
    
    // Clear validation errors for related fields
    if (validationErrors.department_id || validationErrors.designation_id || validationErrors.manager_id) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.department_id;
        delete newErrors.designation_id;
        delete newErrors.manager_id;
        return newErrors;
      });
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof EmployeeFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    const errors: ValidationErrors = {};

    switch (step) {
      case 0: // Personal Information
        if (!formData.first_name.trim()) errors.first_name = 'First name is required';
        if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
        if (!formData.email.trim()) {
          errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          errors.email = 'Please enter a valid email address';
        }
        if (!formData.phone.trim()) errors.phone = 'Phone number is required';
        if (!formData.date_of_birth) errors.date_of_birth = 'Date of birth is required';
        break;

      case 1: // Professional Information
        if (!formData.employee_id.trim()) errors.employee_id = 'Employee ID is required';
        if (!formData.department_id) errors.department_id = 'Department is required';
        if (!formData.designation_id) errors.designation_id = 'Designation is required';
        if (!formData.hire_date) errors.hire_date = 'Hire date is required';
        if (!formData.employment_status) errors.employment_status = 'Employment status is required';
        if (!formData.employment_type) errors.employment_type = 'Employment type is required';
        break;

      case 2: // Emergency Contact
        if (!formData.emergency_contact_name.trim()) {
          errors.emergency_contact_name = 'Emergency contact name is required';
        }
        if (!formData.emergency_contact_phone.trim()) {
          errors.emergency_contact_phone = 'Emergency contact phone is required';
        }
        if (!formData.emergency_contact_relation.trim()) {
          errors.emergency_contact_relation = 'Emergency contact relation is required';
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      setError(null);
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setError(null);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    try {
      setSubmitLoading(true);
      setError(null);

      // Prepare data for submission
      const submitData = {
        ...formData,
        employee_code: formData.employee_id, // Map employee_id to employee_code for backend
        base_salary: formData.salary ? Number(formData.salary) : undefined
      };

      console.log('🚀 Submitting employee data:', submitData);

      const response = await apiService.createEmployee(submitData);

      if (response.success) {
        setSuccess('Employee created successfully!');
        
        // Reset form after successful submission
        setTimeout(() => {
          navigate('/employees');
        }, 2000);
      } else {
        setError(response.message || 'Failed to create employee');
      }
    } catch (err: any) {
      console.error('❌ Failed to create employee:', err);
      setError(err.message || 'Failed to create employee. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      nationality: '',
      marital_status: '',
      employee_id: '',
      department_id: '',
      designation_id: '',
      manager_id: '',
      hire_date: '',
      employment_status: 'active',
      employment_type: 'permanent',
      salary: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: ''
    });
    setCurrentStep(0);
    setValidationErrors({});
    setError(null);
    setSuccess(null);
    generateEmployeeId();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Loading form data...</span>
      </div>
    );
  }

  return (
    <DynamicProtectedComponent permission="employees.create">
      <div className="rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-darkgray p-6 w-full">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <Breadcrumb.Item href="/" icon={HiHome}>
            Dashboard
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/employees">
            Employees
          </Breadcrumb.Item>
          <Breadcrumb.Item>Add Employee</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Add New Employee
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete all steps to add a new employee to your organization
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button color="gray" onClick={() => navigate('/employees')}>
              <HiX className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button color="purple" onClick={handleReset}>
              Reset Form
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={index} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 
                    ${isActive 
                      ? 'border-purple-600 bg-purple-600 text-white' 
                      : isCompleted 
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                    }
                  `}>
                    {isCompleted ? (
                      <HiCheck className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="ml-3">
                    <div className={`text-sm font-medium ${isActive ? 'text-purple-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {step.description}
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert color="failure" className="mb-6" dismissible onDismiss={() => setError(null)}>
            <span className="font-medium">Error:</span> {error}
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert color="success" className="mb-6">
            <span className="font-medium">Success:</span> {success}
          </Alert>
        )}

        {/* Form Content */}
        <Card>
          <div className="p-6">
            {/* Step 0: Personal Information */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Personal Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="first_name" value="First Name *" />
                    <TextInput
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      placeholder="Enter first name"
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
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      placeholder="Enter last name"
                      color={validationErrors.last_name ? 'failure' : undefined}
                    />
                    {validationErrors.last_name && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.last_name}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email" value="Email Address *" />
                    <TextInput
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter email address"
                      color={validationErrors.email ? 'failure' : undefined}
                    />
                    {validationErrors.email && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone" value="Phone Number *" />
                    <TextInput
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter phone number"
                      color={validationErrors.phone ? 'failure' : undefined}
                    />
                    {validationErrors.phone && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="date_of_birth" value="Date of Birth *" />
                    <TextInput
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                      color={validationErrors.date_of_birth ? 'failure' : undefined}
                    />
                    {validationErrors.date_of_birth && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.date_of_birth}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="gender" value="Gender" />
                    <Select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="nationality" value="Nationality" />
                    <TextInput
                      id="nationality"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                      placeholder="Enter nationality"
                    />
                  </div>

                  <div>
                    <Label htmlFor="marital_status" value="Marital Status" />
                    <Select
                      id="marital_status"
                      value={formData.marital_status}
                      onChange={(e) => handleInputChange('marital_status', e.target.value)}
                    >
                      <option value="">Select marital status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" value="Address" />
                  <TextInput
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter full address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="city" value="City" />
                    <TextInput
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Enter city"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state" value="State" />
                    <TextInput
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="Enter state"
                    />
                  </div>

                  <div>
                    <Label htmlFor="zip_code" value="ZIP Code" />
                    <TextInput
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => handleInputChange('zip_code', e.target.value)}
                      placeholder="Enter ZIP code"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Professional Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Professional Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="employee_id" value="Employee ID *" />
                    <TextInput
                      id="employee_id"
                      value={formData.employee_id}
                      onChange={(e) => handleInputChange('employee_id', e.target.value)}
                      placeholder="Employee ID"
                      color={validationErrors.employee_id ? 'failure' : undefined}
                    />
                    {validationErrors.employee_id && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.employee_id}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Auto-generated unique ID</p>
                  </div>

                  <div>
                    <Label htmlFor="hire_date" value="Hire Date *" />
                    <TextInput
                      id="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => handleInputChange('hire_date', e.target.value)}
                      color={validationErrors.hire_date ? 'failure' : undefined}
                    />
                    {validationErrors.hire_date && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.hire_date}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="department_id" value="Department *" />
                    <Select
                      id="department_id"
                      value={formData.department_id}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      color={validationErrors.department_id ? 'failure' : undefined}
                    >
                      <option value="">Select department</option>
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
                      value={formData.designation_id}
                      onChange={(e) => handleInputChange('designation_id', e.target.value)}
                      color={validationErrors.designation_id ? 'failure' : undefined}
                      disabled={!formData.department_id}
                    >
                      <option value="">Select designation</option>
                      {filteredDesignations.map((designation) => (
                        <option key={designation.id} value={designation.id}>
                          {designation.title}
                        </option>
                      ))}
                    </Select>
                    {validationErrors.designation_id && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.designation_id}</p>
                    )}
                    {!formData.department_id && (
                      <p className="text-sm text-gray-500 mt-1">Select department first</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="manager_id" value="Manager" />
                    <Select
                      id="manager_id"
                      value={formData.manager_id}
                      onChange={(e) => handleInputChange('manager_id', e.target.value)}
                      disabled={!formData.department_id}
                    >
                      <option value="">Select manager (optional)</option>
                      {filteredManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name}
                        </option>
                      ))}
                    </Select>
                    {!formData.department_id && (
                      <p className="text-sm text-gray-500 mt-1">Select department first</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="employment_status" value="Employment Status *" />
                    <Select
                      id="employment_status"
                      value={formData.employment_status}
                      onChange={(e) => handleInputChange('employment_status', e.target.value)}
                      color={validationErrors.employment_status ? 'failure' : undefined}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Select>
                    {validationErrors.employment_status && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.employment_status}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="employment_type" value="Employment Type *" />
                    <Select
                      id="employment_type"
                      value={formData.employment_type}
                      onChange={(e) => handleInputChange('employment_type', e.target.value)}
                      color={validationErrors.employment_type ? 'failure' : undefined}
                    >
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                      <option value="consultant">Consultant</option>
                    </Select>
                    {validationErrors.employment_type && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.employment_type}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="salary" value="Base Salary" />
                    <TextInput
                      id="salary"
                      type="number"
                      value={formData.salary}
                      onChange={(e) => handleInputChange('salary', e.target.value)}
                      placeholder="Enter base salary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Emergency Contact */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Emergency Contact Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="emergency_contact_name" value="Contact Name *" />
                    <TextInput
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                      placeholder="Enter emergency contact name"
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
                      value={formData.emergency_contact_phone}
                      onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                      placeholder="Enter emergency contact phone"
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
                      value={formData.emergency_contact_relation}
                      onChange={(e) => handleInputChange('emergency_contact_relation', e.target.value)}
                      placeholder="e.g., Spouse, Parent, Sibling"
                      color={validationErrors.emergency_contact_relation ? 'failure' : undefined}
                    />
                    {validationErrors.emergency_contact_relation && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.emergency_contact_relation}</p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Review Your Information
                  </h4>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <p><strong>Employee:</strong> {formData.first_name} {formData.last_name}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>Employee ID:</strong> {formData.employee_id}</p>
                    <p><strong>Department:</strong> {departments.find(d => d.id === formData.department_id)?.name || 'Not selected'}</p>
                    <p><strong>Designation:</strong> {designations.find(d => d.id === formData.designation_id)?.title || 'Not selected'}</p>
                    <p><strong>Employment Type:</strong> {formData.employment_type}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            color="gray"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <HiArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStep < steps.length - 1 ? (
              <Button color="purple" onClick={handleNext}>
                Next
                <HiArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                color="purple" 
                onClick={handleSubmit}
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating Employee...
                  </>
                ) : (
                  <>
                    <HiCheck className="w-4 h-4 mr-2" />
                    Create Employee
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DynamicProtectedComponent>
  );
};

export default AddEmployees;