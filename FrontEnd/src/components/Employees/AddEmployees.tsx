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
import { DynamicProtectedComponent } from '../RBACSystem/rbacSystem';
import apiService from '../../services/api';
import FileUploadBox from './FileUploadBox';

// Form data interface matching your database structure
interface EmployeeFormData {
  // Personal Information (includes emergency contact now)
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
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  
  // Professional Information
  employee_code: string;
  department_id: string;
  designation_id: string;
  manager_id: string;
  hire_date: string;
  employment_status: 'active' | 'inactive';
  employee_type: 'permanent' | 'contract' | 'intern' | 'consultant';
  salary: number | '';

  // Work Schedule Information
  in_time: string;
  out_time: string;
  follows_company_schedule: boolean;
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
  const [uploadedDocuments, setUploadedDocuments] = useState({});
  const [documentUploading, setDocumentUploading] = useState({});

  // Form data
  const [formData, setFormData] = useState<EmployeeFormData>({
    // Personal Information (including emergency contact)
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
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    
    // Professional Information
    employee_code: '',
    department_id: '',
    designation_id: '',
    manager_id: '',
    hire_date: '',
    employment_status: 'active',
    employee_type: 'permanent',
    salary: '',

    // Work Schedule Information
    in_time: '',
    out_time: '',
    follows_company_schedule: true
  });

  // Steps configuration - Updated structure
  const steps = [
    {
      title: 'Personal Information',
      icon: HiUser,
      description: 'Basic personal details and emergency contact'
    },
    {
      title: 'Professional Information',
      icon: HiBriefcase,
      description: 'Job and department details'
    },
    {
      title: 'Documents',
      icon: HiDocumentText,
      description: 'Upload and manage personal documents'
    }
  ];

  // Load reference data on component mount
  useEffect(() => {
    loadReferenceData();
    generateEmployeeId();
  }, []);

  // Load company work schedule on component mount
  useEffect(() => {
    const loadCompanySchedule = async () => {
      try {
        const response = await apiService.apiCall('/api/settings');
        if (response.success) {
          const settings = response.data.settings;
          const companyStartTime = settings.work_start_time?.value || '09:00';
          const companyEndTime = settings.work_end_time?.value || '17:00';
          
          // Set initial times from database
          setFormData(prev => ({
            ...prev,
            in_time: companyStartTime,
            out_time: companyEndTime
          }));
        }
      } catch (error) {
        console.error('Failed to load company schedule:', error);
        // Only fallback to hardcoded if API fails
        setFormData(prev => ({
          ...prev,
          in_time: '09:00',
          out_time: '17:00'
        }));
      }
    };
    
    loadCompanySchedule();
  }, []);

  // Filter designations when department changes
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

  // Filter managers when department changes
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
  }, [formData.department_id, departments, managers]);

  // Load reference data
  const loadReferenceData = async () => {
    try {
      setLoading(true);
      
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
      setError('Failed to load form data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Generate unique employee ID
  const generateEmployeeId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const newId = `EMP${timestamp}${random}`;
    console.log('Generated employee ID:', newId);
    
    setFormData(prev => ({
      ...prev,
      employee_code: newId
    }));
  };

  // Add this function to handle document uploads:
 const handleDocumentUpload = async (documentType: string, file: File) => {
  if (!file) return;
  
  // Set uploading state
  setDocumentUploading(prev => ({ ...prev, [documentType]: true }));
  
  const formData = new FormData();
  formData.append(documentType, file);
  formData.append('notes', `${documentType.replace('_', ' ')} document for employee`);
  
  try {
    // Note: You'll need the employee ID after creating the employee
    // For now, we'll store the files temporarily and upload after employee creation
    
    // Store file temporarily in state for upload after employee creation
    setUploadedDocuments(prev => ({
      ...prev,
      [documentType]: [...(prev[documentType] || []), file]
    }));
    
    console.log(`${documentType} file prepared for upload:`, file.name);
    
  } catch (error) {
    console.error('Document preparation error:', error);
    setError(`Failed to prepare ${documentType} document`);
  } finally {
    setDocumentUploading(prev => ({ ...prev, [documentType]: false }));
  }
 };

  // Handle company schedule checkbox change - FETCH FROM DATABASE
  const handleCompanyScheduleChange = async (checked: boolean) => {
    if (checked) {
      // Fetch fresh company times from database when checkbox is checked
      try {
        const response = await apiService.apiCall('/api/settings');
        if (response.success) {
          const settings = response.data.settings;
          setFormData(prev => ({
            ...prev,
            follows_company_schedule: true,
            in_time: settings.work_start_time?.value || '09:00',
            out_time: settings.work_end_time?.value || '17:00'
          }));
        }
      } catch (error) {
        console.error('Failed to load company schedule:', error);
        // Only fallback if database fetch fails
        setFormData(prev => ({
          ...prev,
          follows_company_schedule: true
        }));
      }
    } else {
      // Just update the checkbox, keep current times for manual editing
      setFormData(prev => ({
        ...prev,
        follows_company_schedule: false
      }));
    }
  };

  // Handle input changes
  const handleInputChange = useCallback((field: keyof EmployeeFormData, value: string | number) => {
    console.log(`🔄 handleInputChange called:`, { field, value, type: typeof value });

    setFormData(prev => ({
      ...prev,
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
  }, [validationErrors]);

  // Validate current step
  const validateStep = (step: number): boolean => {
    const errors: ValidationErrors = {};

    switch (step) {
      case 0: // Personal Information (including emergency contact)
        if (!formData.first_name.trim()) errors.first_name = 'First name is required';
        if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
        if (!formData.email.trim()) {
          errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          errors.email = 'Please enter a valid email address';
        }
        if (!formData.phone.trim()) errors.phone = 'Phone number is required';
        if (!formData.date_of_birth) errors.date_of_birth = 'Date of birth is required';
        if (!formData.gender) errors.gender = 'gender is required';
        // Emergency contact validation
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

      case 1: // Professional Information
        if (!formData.employee_code.trim()) errors.employee_code = 'Employee code is required';
        if (!formData.department_id) errors.department_id = 'Department is required';
        if (!formData.designation_id) errors.designation_id = 'Designation is required';
        if (!formData.hire_date) errors.hire_date = 'Hire date is required';
        if (!formData.employment_status) errors.employment_status = 'Employment status is required';
        if (!formData.employee_type) errors.employee_type = 'Employment type is required';
        
        // Work Schedule Validation
        if (!formData.in_time) {
          errors.in_time = 'In time is required';
        }
        
        if (!formData.out_time) {
          errors.out_time = 'Out time is required';
        }
        
        // Validate that out time is after in time
        if (formData.in_time && formData.out_time) {
          const inTime = new Date(`2000-01-01T${formData.in_time}`);
          const outTime = new Date(`2000-01-01T${formData.out_time}`);
          
          if (outTime <= inTime) {
            errors.out_time = 'Out time must be after in time';
          }
        }
        break;

      case 2: // Personal Documents
        // No validation required for documents step - it's optional
        break;
    }

    setValidationErrors(errors);

    console.log("validation error",errors);

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
    // Validate all steps before submission
    let allValid = true;
    for (let i = 0; i < steps.length - 1; i++) { // Skip documents step validation
      if (!validateStep(i)) {
        allValid = false;
        setCurrentStep(i); // Go to first invalid step
        break;
      }
    }

    if (!allValid) {
      return;
    }

    try {
      setSubmitLoading(true);
      setError(null);

      // Prepare data for submission
      const submitData = {
        // Personal Information
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        nationality: formData.nationality,
        marital_status: formData.marital_status,
        
        // Professional Information
        employee_code: formData.employee_code,
        department_id: formData.department_id,
        designation_id: formData.designation_id,
        manager_id: formData.manager_id,
        hire_date: formData.hire_date,
        employment_status: formData.employment_status,
        employee_type: formData.employee_type,
        salary: formData.salary ? Number(formData.salary) : undefined,
        
        // Emergency Contact
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        emergency_contact_relation: formData.emergency_contact_relation,
        
        // Work Schedule Information
        in_time: formData.in_time,
        out_time: formData.out_time,
        follows_company_schedule: formData.follows_company_schedule
      };

      console.log('🚀 Submitting employee data:', submitData);

      const response = await apiService.createEmployee(submitData);

      if (response.success) {
         const employeeId = response.data.employee.id;

         if (Object.keys(uploadedDocuments).length > 0) {
            await uploadEmployeeDocuments(employeeId);
         }

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

  const uploadEmployeeDocuments = async (employeeId: string) => {
  const token = localStorage.getItem('accessToken');
  const userData = localStorage.getItem('user');
  
  console.log('🔍 Upload Debug:', { hasToken: !!token, hasUserData: !!userData });
  
  if (!token) {
    console.error('❌ No token found');
    return;
  }

  try {
    for (const [documentType, files] of Object.entries(uploadedDocuments)) {
      if (files && files.length > 0) {
        const formData = new FormData();
        
        // Add all files of this type
        files.forEach((file: File) => {
          formData.append(documentType, file);
        });
        
        formData.append('notes', `${documentType.replace('_', ' ')} document for employee`);
        console.log('formdata',formData);
        
        const response = await fetch(`http://localhost:5000/api/employees/${employeeId}/documents`, {
          method: 'POST',
          // headers: {
          //   'Authorization': `Bearer ${localStorage.getItem('token')}`
          // },

          headers: {
    'Authorization': `Bearer ${token}`,
    ...(userData && { 'X-Client-ID': JSON.parse(userData).clientId })
  },
          body: formData
          
        });
        debugAuth;
        
        const result = await response.json();
        
        if (!result.success) {
          console.error(`Failed to upload ${documentType}:`, result.message);
        }
      }
    }
  } catch (error) {
    console.error('Document upload error:', error);
    // Don't fail the entire process if document upload fails
  }
};

const debugAuth = () => {
  console.log('🔍 Auth Debug:');
  console.log('accessToken:', localStorage.getItem('accessToken'));
  console.log('user:', localStorage.getItem('user'));
  
  const token = localStorage.getItem('accessToken');
  if (token) {
    const parts = token.split('.');
    console.log('Token parts:', parts.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
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
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
      employee_code: '',
      department_id: '',
      designation_id: '',
      manager_id: '',
      hire_date: '',
      employment_status: 'active',
      employee_type: 'permanent',
      salary: '',
      // Work Schedule Information
      in_time: '',
      out_time: '',
      follows_company_schedule: true
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
        <span className="ml-3 text-lg">Loading form data...</span>
      </div>
    );
  }

  return (
    <DynamicProtectedComponent permission="employees.create">
      <div className="max-w-6xl mx-auto p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <Breadcrumb.Item href="/dashboard" icon={HiHome}>
            Dashboard
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/employees">
            Employees
          </Breadcrumb.Item>
          <Breadcrumb.Item>Add Employee</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Add New Employee
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Fill in the employee details across the three sections below.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                      index <= currentStep
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-gray-200 border-gray-300 text-gray-500'
                    }`}
                  >
                    {index < currentStep ? (
                      <HiCheck className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${
                      index <= currentStep ? 'text-purple-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-24 mx-4 ${
                      index < currentStep ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Alert color="success" className="mb-6">
            <HiCheck className="h-4 w-4" />
            {success}
          </Alert>
        )}

        {error && (
          <Alert color="failure" className="mb-6">
            <HiX className="h-4 w-4" />
            {error}
          </Alert>
        )}

        {/* Form Content */}
        <Card>
          <div className="p-6">
            {/* Step 0: Personal Information (including Emergency Contact) */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="border-b pb-4 mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Personal Information
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter the employee's basic personal details and emergency contact information.
                  </p>
                </div>

                {/* Basic Personal Details */}
                <div className="mb-8">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
                    Basic Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        color={validationErrors.date_of_birth ? 'failure' : undefined}
                      >
                        <option>Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </Select>
                     {validationErrors.gender && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.gender}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="address" value="Address" />
                      <TextInput
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Enter full address"
                      />
                    </div>

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
                </div>

                {/* Emergency Contact Section */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
                    Emergency Contact Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name" value="Emergency Contact Name *" />
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
                      <Label htmlFor="emergency_contact_phone" value="Emergency Contact Phone *" />
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
                </div>
              </div>
            )}

            {/* Step 1: Professional Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="border-b pb-4 mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Professional Information
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter the employee's job-related details and organizational information.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employee_code" value="Employee Code *" />
                    <div className="flex gap-2">
                      <TextInput
                        id="employee_code"
                        value={formData.employee_code}
                        onChange={(e) => handleInputChange('employee_code', e.target.value)}
                        placeholder="Employee ID"
                        color={validationErrors.employee_code ? 'failure' : undefined}
                        className="flex-1"
                      />
                      <Button color="gray" onClick={generateEmployeeId}>
                        Generate
                      </Button>
                    </div>
                    {validationErrors.employee_code && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.employee_code}</p>
                    )}
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
                      onChange={(e) => handleInputChange('department_id', e.target.value)}
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
                    <Label htmlFor="manager_id" value="Reporting Manager" />
                    <Select
                      id="manager_id"
                      value={formData.manager_id}
                      onChange={(e) => handleInputChange('manager_id', e.target.value)}
                    >
                      <option value="">Select manager (optional)</option>
                      {filteredManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name}
                        </option>
                      ))}
                    </Select>
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
                    <Label htmlFor="employee_type" value="Employment Type *" />
                    <Select
                      id="employee_type"
                      value={formData.employee_type}
                      onChange={(e) => handleInputChange('employee_type', e.target.value)}
                      color={validationErrors.employee_type ? 'failure' : undefined}
                    >
                      <option value="">Select employment type</option>
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                      <option value="consultant">Consultant</option>
                    </Select>
                    {validationErrors.employee_type && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.employee_type}</p>
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

                {/* Work Schedule Section */}
                <div className="col-span-full">
                  <div className="border-t pt-6 mt-6">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Work Schedule
                    </h4>
                    
                    {/* Company Schedule Checkbox */}
                    <div className="mb-4">
                      <div className="flex items-center">
                        <input
                          id="follows_company_schedule"
                          type="checkbox"
                          checked={formData.follows_company_schedule}
                          onChange={(e) => handleCompanyScheduleChange(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="follows_company_schedule" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                          Use Company Standard Hours
                        </label>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Company standard: {formData.in_time && formData.out_time ? `${formData.in_time} - ${formData.out_time}` : 'Loading...'}
                      </p>
                    </div>

                    {/* Time Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="in_time" value="In Time *" />
                        <TextInput
                          id="in_time"
                          type="time"
                          value={formData.in_time}
                          onChange={(e) => handleInputChange('in_time', e.target.value)}
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
                          value={formData.out_time}
                          onChange={(e) => handleInputChange('out_time', e.target.value)}
                          disabled={formData.follows_company_schedule}
                          color={validationErrors.out_time ? 'failure' : undefined}
                          className={formData.follows_company_schedule ? 'opacity-60' : ''}
                        />
                        {validationErrors.out_time && (
                          <p className="text-red-600 text-sm mt-1">{validationErrors.out_time}</p>
                        )}
                      </div>
                    </div>

                    {!formData.follows_company_schedule && (
                      <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
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
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Department Summary
                  </h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p><strong>Selected Department:</strong> {departments.find(d => d.id === formData.department_id)?.name || 'None'}</p>
                    <p><strong>Available Designations:</strong> {filteredDesignations.length}</p>
                    <p><strong>Available Managers:</strong> {filteredManagers.length}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Personal Documents */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="border-b pb-4 mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Documents
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Upload and manage the employee's documents. This step is optional and can be completed later.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ID Documents */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white">
                      Identity Documents
                    </h4>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">National ID Card</h5>
                      <p className="text-sm text-blue-600 dark:text-blue-300 mb-3">
                        Upload a clear copy of the employee's national ID card (front and back)
                      </p>
                      <FileUploadBox
                          id="national_id"
                          label=""
                          onFileChange={(file) => handleDocumentUpload('national_id', file)}
                          loading={documentUploading.national_id}
                      />
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-green-800 dark:text-green-200 mb-2">Passport</h5>
                      <p className="text-sm text-green-600 dark:text-green-300 mb-3">
                        Upload a copy of the employee's passport (optional)
                      </p>
                      <FileUploadBox
                        id="passport"
                        label=""
                        onFileChange={(file) => handleDocumentUpload('passport', file)}
                        loading={documentUploading.passport}
                      />
                    </div>

                      <div className="bg-red-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-green-800 dark:text-green-200 mb-2">Other documents</h5>
                      <p className="text-sm text-green-600 dark:text-green-300 mb-3">
                        Upload a copy of the employee's other documents (optional)
                      </p>
                      <FileUploadBox
                        id="other"
                        label=""
                        onFileChange={(file) => handleDocumentUpload('other', file)}
                        loading={documentUploading.other}
                      />
                    </div>
                  </div>

                  {/* Professional Documents */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white">
                      Professional Documents
                    </h4>

                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Resume/CV</h5>
                      <p className="text-sm text-purple-600 dark:text-purple-300 mb-3">
                        Upload the employee's current resume or CV
                      </p>
                      <FileUploadBox
                        id="resume"
                        label=""
                        onFileChange={(file) => handleDocumentUpload('resume', file)}
                        loading={documentUploading.resume}
                      />
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-orange-800 dark:text-orange-200 mb-2">Educational Certificates</h5>
                      <p className="text-sm text-orange-600 dark:text-orange-300 mb-3">
                        Upload educational qualifications and certificates
                      </p>
                      <FileUploadBox
                        id="education"
                        label=""
                        onFileChange={(file) => handleDocumentUpload('education', file)}
                        loading={documentUploading.education}
                      />
                    </div>

                    <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-teal-800 dark:text-teal-200 mb-2">Previous Experience Letters</h5>
                      <p className="text-sm text-teal-600 dark:text-teal-300 mb-3">
                        Upload experience letters from previous employers (optional)
                      </p>
                      <FileUploadBox
                        id="experience"
                        label=""
                        onFileChange={(file) => handleDocumentUpload('experience', file)}
                        loading={documentUploading.experience}
                      />
                    </div>
                  </div>
                </div>

                {/* Document Upload Guidelines */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    📋 Document Upload Guidelines
                  </h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>• Supported formats: JPG, PNG, PDF, DOC, DOCX</li>
                    <li>• Maximum file size: 10MB per file</li>
                    <li>• Ensure documents are clear and readable</li>
                    <li>• You can upload multiple files for each document type</li>
                    <li>• Documents can be added or updated later from the employee profile</li>
                  </ul>
                </div>

                {/* Review Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    📄 Employee Information Summary
                  </h4>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <p><strong>Employee:</strong> {formData.first_name} {formData.last_name}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>Employee ID:</strong> {formData.employee_code}</p>
                    <p><strong>Department:</strong> {departments.find(d => d.id === formData.department_id)?.name || 'Not selected'}</p>
                    <p><strong>Designation:</strong> {designations.find(d => d.id === formData.designation_id)?.title || 'Not selected'}</p>
                    <p><strong>Employment Type:</strong> {formData.employee_type || 'Not selected'}</p>
                    <p><strong>Work Schedule:</strong> {formData.in_time} - {formData.out_time} ({formData.follows_company_schedule ? 'Company Standard' : 'Custom'})</p>
                    <p><strong>Emergency Contact:</strong> {formData.emergency_contact_name} ({formData.emergency_contact_relation}) - {formData.emergency_contact_phone}</p>
                  </div>
                  <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                    ✅ Ready to create employee profile. Documents can be uploaded now or added later.
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
            <Button color="light" onClick={handleReset}>
              Reset Form
            </Button>
            
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

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Contact your system administrator or refer to the user guide.
          </p>
        </div>
      </div>
    </DynamicProtectedComponent>
  );
};

export default AddEmployees;