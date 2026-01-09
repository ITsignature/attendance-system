import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { UserIcon, EnvelopeIcon, PhoneIcon, BriefcaseIcon, CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  nationality: string;
  marital_status: string;
  hire_date: string;
  employee_type: string;
  work_location: string;
  employment_status: string;
  base_salary: number;
  currency: string;
  in_time: string;
  out_time: string;
  department_name: string;
  designation_title: string;
  manager_name: string;
  years_of_service: number;
}

const EmployeeProfile = () => {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/api/employee-portal/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setProfile(response.data.data.employee);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-600">Unable to load profile. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          {profile.employment_status}
        </span>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-32"></div>

        {/* Profile Content */}
        <div className="px-6 pb-6">
          {/* Profile Image & Basic Info */}
          <div className="flex items-end -mt-16 mb-6">
            <div className="bg-white rounded-full p-2 shadow-lg">
              <UserIcon className="w-24 h-24 text-gray-400 bg-gray-100 rounded-full p-4" />
            </div>
            <div className="ml-6 mb-2">
              <h2 className="text-2xl font-bold text-gray-800">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-gray-600">{profile.designation_title}</p>
              <p className="text-sm text-gray-500">{profile.employee_code}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <EnvelopeIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-800">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <PhoneIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-800">{profile.phone}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <MapPinIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="text-gray-800">
                      {profile.address}, {profile.city}, {profile.state} {profile.zip_code}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Employment Information</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <BriefcaseIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="text-gray-800">{profile.department_name}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <UserIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Manager</p>
                    <p className="text-gray-800">{profile.manager_name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Hire Date</p>
                    <p className="text-gray-800">
                      {new Date(profile.hire_date).toLocaleDateString()} ({profile.years_of_service} years)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Employee Type</p>
                <p className="text-gray-800 font-medium capitalize">{profile.employee_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Work Location</p>
                <p className="text-gray-800 font-medium capitalize">{profile.work_location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Work Schedule</p>
                <p className="text-gray-800 font-medium">
                  {profile.in_time} - {profile.out_time}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gender</p>
                <p className="text-gray-800 font-medium capitalize">{profile.gender}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="text-gray-800 font-medium">
                  {new Date(profile.date_of_birth).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Marital Status</p>
                <p className="text-gray-800 font-medium capitalize">{profile.marital_status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nationality</p>
                <p className="text-gray-800 font-medium">{profile.nationality}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> To update your profile information, please contact your HR department.
        </p>
      </div>
    </div>
  );
};

export default EmployeeProfile;
