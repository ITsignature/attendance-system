export interface Employee {
  id: string;
  client_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  nationality?: string;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Employment Details
  hire_date: string;
  department_id?: string;
  designation_id?: string;
  manager_id?: string;
  employee_type: 'permanent' | 'contract' | 'intern' | 'consultant';
  work_location?: 'office' | 'remote' | 'hybrid';
  employment_status: 'active' | 'inactive' | 'terminated' | 'resigned';
  
  // Salary Information
  base_salary?: number;
  currency?: string;
  
  // Documents and Additional Info
  profile_image?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data from relations
  department_name?: string;
  designation_title?: string;
  manager_name?: string;
}

export interface CreateEmployeeData {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  nationality?: string;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Employment Details
  hire_date: string;
  department_id?: string;
  designation_id?: string;
  manager_id?: string;
  employee_type: 'permanent' | 'contract' | 'intern' | 'consultant';
  work_location?: 'office' | 'remote' | 'hybrid';
  employment_status: 'active' | 'inactive' | 'terminated' | 'resigned';
  
  // Salary Information
  base_salary?: number;
  currency?: string;
  
  // Documents and Additional Info
  profile_image?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

export interface UpdateEmployeeData {
  employee_code?: string;
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
  
  // Employment Details
  hire_date?: string;
  department_id?: string;
  designation_id?: string;
  manager_id?: string;
  employee_type?: 'permanent' | 'contract' | 'intern' | 'consultant';
  work_location?: 'office' | 'remote' | 'hybrid';
  employment_status?: 'active' | 'inactive' | 'terminated' | 'resigned';
  
  // Salary Information
  base_salary?: number;
  currency?: string;
  
  // Documents and Additional Info
  profile_image?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

export interface EmployeeFilters {
  page?: number;
  limit?: number;
  search?: string;
  department_id?: string;
  designation_id?: string;
  employment_status?: 'active' | 'inactive' | 'terminated' | 'resigned';
  employee_type?: 'permanent' | 'contract' | 'intern' | 'consultant';
  work_location?: 'office' | 'remote' | 'hybrid';
  gender?: 'male' | 'female' | 'other';
  hire_date_from?: string;
  hire_date_to?: string;
  manager_id?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  terminated: number;
  resigned: number;
  permanent: number;
  contract: number;
  intern: number;
  consultant: number;
  office: number;
  remote: number;
  hybrid: number;
  by_department: Array<{
    department_id: string;
    department_name: string;
    count: number;
  }>;
  by_designation: Array<{
    designation_id: string;
    designation_title: string;
    count: number;
  }>;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  manager_name?: string;
  employee_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Designation {
  id: string;
  title: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  level?: number;
  salary_range_min?: number;
  salary_range_max?: number;
  employee_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Manager {
  id: string;
  full_name: string;
  department_name?: string;
  designation_title?: string;
  employee_code: string;
}

// Form validation errors
export interface EmployeeValidationErrors {
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  hire_date?: string;
  department_id?: string;
  designation_id?: string;
  employee_type?: string;
  employment_status?: string;
  work_location?: string;
  base_salary?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

// API Response types
export interface EmployeeResponse {
  success: boolean;
  message: string;
  data: {
    employees: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SingleEmployeeResponse {
  success: boolean;
  message: string;
  data: {
    employee: Employee;
  };
}

export interface EmployeeStatsResponse {
  success: boolean;
  message: string;
  data: EmployeeStats;
}

// Enums for better type safety
export enum EmploymentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  RESIGNED = 'resigned'
}

export enum EmployeeType {
  PERMANENT = 'permanent',
  CONTRACT = 'contract',
  INTERN = 'intern',
  CONSULTANT = 'consultant'
}

export enum WorkLocation {
  OFFICE = 'office',
  REMOTE = 'remote',
  HYBRID = 'hybrid'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed'
}

// Constants for dropdowns
export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'resigned', label: 'Resigned' }
];

export const EMPLOYEE_TYPE_OPTIONS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'consultant', label: 'Consultant' }
];

export const WORK_LOCATION_OPTIONS = [
  { value: 'office', label: 'Office' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' }
];

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' }
];