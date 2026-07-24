import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarIcon, ClockIcon, CheckCircleIcon, XCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string;
  check_out_time: string;
  total_hours: number;
  overtime_hours: number;
  status: string;
  arrival_status: string;
  is_weekend: boolean;
  work_type: string;
}

interface AttendanceSummary {
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  avg_hours: number;
  total_overtime_hours: number;
}

const RECORDS_PER_PAGE = 10;

const EmployeeAttendance = () => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);

    fetchAttendance(thirtyDaysAgo.toISOString().split('T')[0], today.toISOString().split('T')[0], 1);
  }, []);

  const fetchAttendance = async (from?: string, to?: string, page: number = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const params: any = { limit: RECORDS_PER_PAGE, page };
      if (from) params.date_from = from;
      if (to) params.date_to = to;

      const response = await axios.get(`${API_BASE}/api/employee-portal/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setAttendance(response.data.data.attendance);
      setSummary(response.data.data.summary);
      setCurrentPage(response.data.data.pagination.currentPage);
      setTotalPages(response.data.data.pagination.totalPages);
      setTotalRecords(response.data.data.pagination.totalRecords);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchAttendance(dateFrom, dateTo, 1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    fetchAttendance(dateFrom, dateTo, page);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-100';
      case 'absent': return 'text-red-600 bg-red-100';
      case 'late': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getWorkDuration = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return '-';
    const inTime = new Date(`2000-01-01 ${checkIn}`);
    const outTime = new Date(`2000-01-01 ${checkOut}`);
    const diffMs = outTime.getTime() - inTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Attendance</h1>
        <p className="text-gray-600">View your attendance records and statistics</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Days</p>
                <p className="text-2xl font-bold text-gray-800">{summary.total_days}</p>
              </div>
              <CalendarIcon className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Present</p>
                <p className="text-2xl font-bold text-green-600">{summary.present_days}</p>
              </div>
              <CheckCircleIcon className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Absent</p>
                <p className="text-2xl font-bold text-red-600">{summary.absent_days}</p>
              </div>
              <XCircleIcon className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleFilter}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Attendance Records */}
      {attendance.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No attendance records found for the selected period
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 md:hidden">
            {attendance.map((record) => {
              const duration = getWorkDuration(record.check_in_time, record.check_out_time);

              return (
                <div key={record.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(record.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                      {record.status}
                      {record.arrival_status === 'late' && ' (Late)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div>
                      <p className="text-gray-500">Check In</p>
                      <p className="text-gray-900">{record.check_in_time || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Check Out</p>
                      <p className="text-gray-900">{record.check_out_time || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Hours</p>
                      <p className="text-gray-900">
                        {record.total_hours?.toFixed(2) || '-'} hrs
                        {record.overtime_hours > 0 && (
                          <span className="ml-1 text-xs text-blue-600">
                            (+{record.overtime_hours.toFixed(2)} OT)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Work Duration</p>
                      <p className="text-gray-900">{duration}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendance.map((record) => {
                    const duration = getWorkDuration(record.check_in_time, record.check_out_time);

                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {new Date(record.date).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_in_time || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_out_time || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.total_hours?.toFixed(2) || '-'} hrs
                          {record.overtime_hours > 0 && (
                            <span className="ml-2 text-xs text-blue-600">
                              (+{record.overtime_hours.toFixed(2)} OT)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                            {record.status}
                            {record.arrival_status === 'late' && ' (Late)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {duration}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalRecords > 0 && (
        <div className="bg-white rounded-lg shadow px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-600 hidden sm:block">
            Page {currentPage} of {totalPages} &middot; {totalRecords} records
          </p>
          <p className="text-sm text-gray-600 sm:hidden">
            {currentPage} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendance;
