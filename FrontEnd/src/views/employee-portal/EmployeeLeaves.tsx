import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ClockIcon, CheckCircleIcon, XCircleIcon, ClockIcon as PendingIcon } from '@heroicons/react/24/outline';
import fi from 'date-fns/esm/locale/fi/index.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface LeaveType {
  id: string;
  name: string;
  max_days_per_year: number;
  requires_approval: boolean;
}

interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  total_allocated: number;
  used: number;
  remaining: number;
}

interface LeaveRequest {
  id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason: string;
  status: string;
  applied_date: string;
  approved_date: string | null;
  approved_by_name: string | null;
  rejection_reason: string | null;
  is_paid: boolean;
}

const EmployeeLeaves = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  //Display format dates(dd/mm/yyyy)
  const [displayStartDate, setDisplayStartDate] = useState('');
  const [displayEndDate, setDisplayEndDate] = useState('');

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const fetchLeaveData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [typesRes, balanceRes, requestsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/employee-portal/leaves/types`, { headers }),
        axios.get(`${API_BASE}/api/employee-portal/leaves/balance`, { headers }),
        axios.get(`${API_BASE}/api/employee-portal/leaves/my-requests`, { headers, params: { limit: 20 } }),
      ]);

      setLeaveTypes(typesRes.data?.data?.leaveTypes || []);
      setLeaveBalance(balanceRes.data?.data?.balance || []);
      setLeaveRequests(requestsRes.data?.data?.requests || []);
    } catch (error) {
      console.error('Error fetching leave data:', error);
      // Set empty arrays on error to prevent undefined errors
      setLeaveTypes([]);
      setLeaveBalance([]);
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        `${API_BASE}/api/employee-portal/leaves/apply`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccess('Leave application submitted successfully!');
        setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
        setShowApplyForm(false);
        fetchLeaveData(); // Refresh data
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to apply for leave');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <PendingIcon className="w-5 h-5 text-yellow-600" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert dd/mm/yyyy to yyyy/mm/dd for backend
  const convertToBackendFormat = (dateStr:string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3)
      return '';
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  };

  // Validate dd/mm/yyyy format
  const isValidDateFormat = (dateStr: string): boolean => {
    if (!dateStr)
      return true;
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(regex);
    if (!match)
      return false;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year  = parseInt(match[3], 10);

    if (month < 1 || month > 12)
      return false;
    if (day < 1 || day > 31)
      return false;
    if (year < 1900 || year > 2100)
      return false;

    const date = new Date(year, month-1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };


  //Handle date input change (dd/mm/yyy format with auto-formatting)
  const handleDateChange = (field: 'start_date' | 'end_date', rawValue: string): void => {
    //Remove all non-digit characters
    const digitsOnly = rawValue.replace(/\D/g, '');

    //Auto format as user types: dd/mm/yyyy
    let formattedValue = '';
    if (digitsOnly.length > 0){
      formattedValue = digitsOnly.substring(0,2); //dd
      if (digitsOnly.length >= 3) {
        formattedValue += '/' + digitsOnly.substring(2,4); //mm
      }
      if (digitsOnly.length >= 5) {
        formattedValue += '/' + digitsOnly.substring(4,8); //yyyy
      }
    }

  // update display state
  if (field === 'start_date'){
      setDisplayStartDate(formattedValue);
  } else {
      setDisplayEndDate(formattedValue);
  }

  //validate and convert to backend format
  if (isValidDateFormat(formattedValue) && formattedValue){
    const backEndDate = convertToBackendFormat(formattedValue);
    setFormData(prev => ({...prev, [field]: backEndDate}));
  } else if(!formattedValue){
    setFormData(prev => ({...prev, [field]: ''}));
  }  
};


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Leaves</h1>
          <p className="text-gray-600">Apply for leaves and track your leave balance</p>
        </div>
        <button
          onClick={() => setShowApplyForm(!showApplyForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showApplyForm ? 'Cancel' : 'Apply for Leave'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Apply Leave Form */}
      {showApplyForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Apply for Leave</h2>
          <form onSubmit={handleApplyLeave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Leave Type *
              </label>
              <select
                required
                value={formData.leave_type_id}
                onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select leave type</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} (Max: {type.max_days_per_year} days/year)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date * <span className="text-xs text-gray-500">(dd/mm/yyyy)</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayStartDate}
                  onChange={(e) => handleDateChange('start_date', e.target.value)}
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date * <span className="text-xs text-gray-500">(dd/mm/yyyy)</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayEndDate}
                  onChange={(e) => handleDateChange('end_date', e.target.value)}
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason *
              </label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please provide a reason for your leave..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowApplyForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Balance Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Leave Balance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaveBalance.length === 0 ? (
            <div className="col-span-3 text-center text-gray-500 py-8">
              No leave balance information available
            </div>
          ) : (
            leaveBalance.map((balance) => (
              <div key={balance.leave_type_id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  {balance.leave_type_name}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Allocated:</span>
                    <span className="font-medium">{balance.total_allocated} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Used:</span>
                    <span className="font-medium text-red-600">{balance.used} days</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-sm font-semibold text-gray-700">Remaining:</span>
                    <span className="font-bold text-green-600">{balance.remaining} days</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(balance.remaining / balance.total_allocated) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Leave Requests History */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Leave Requests History</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No leave requests found
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.leave_type_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(request.start_date)} -
                        </div>
                        <div className="text-sm text-gray-900">
                          {formatDate(request.end_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.number_of_days} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            request.is_paid
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {request.is_paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(request.status)}
                          <span
                            className={`ml-2 px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(request.applied_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs">
                          <p className="text-xs text-gray-600">
                            <strong>Reason:</strong> {request.reason}
                          </p>
                          {request.approved_by_name && (
                            <p className="text-xs text-gray-600 mt-1">
                              <strong>Approved by:</strong> {request.approved_by_name}
                            </p>
                          )}
                          {request.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1">
                              <strong>Rejection reason:</strong> {request.rejection_reason}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLeaves;
