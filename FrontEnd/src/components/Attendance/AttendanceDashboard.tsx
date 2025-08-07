import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from 'flowbite-react';
import { 
  HiClock, 
  HiBriefcase, 
  HiUserGroup, 
  HiTrendingUp,
  HiChartBar
} from 'react-icons/hi';
import apiService from '../../services/api';

interface AttendanceStats {
  total_employees: number;
  arrival_stats: {
    on_time: number;
    late: number;
    absent: number;
  };
  duration_stats: {
    full_day: number;
    half_day: number;
    short_leave: number;
    on_leave: number;
  };
  total_hours: number;
  overtime_hours: number;
}

const AttendanceDashboard: React.FC = () => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadAttendanceStats();
  }, [selectedDate]);

  const loadAttendanceStats = async () => {
    try {
      setLoading(true);
      // This would be a new API endpoint for dashboard stats
      const response = await apiService.apiCall(`/api/attendance/stats?date=${selectedDate}`);
      if (response.success) {
        setStats(response.data);
      }

      console.log("stats",stats);
    } catch (error) {
      console.error('Failed to load attendance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  };

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }
  

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Attendance Overview
        </h2>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={loadAttendanceStats} size="sm">
            <HiChartBar className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Employees */}
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <HiUserGroup className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Employees
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total_employees}
              </p>
            </div>
          </div>
        </Card>

        {/* Arrival Performance */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center">
              <HiClock className="h-6 w-6 text-green-600 mr-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Arrival Status</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">On Time</span>
                <div className="flex items-center">
                  <Badge color="success" size="sm">{stats.arrival_stats.on_time}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.arrival_stats.on_time, stats.total_employees)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Late</span>
                <div className="flex items-center">
                  <Badge color="warning" size="sm">{stats.arrival_stats.late}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.arrival_stats.late, stats.total_employees)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Absent</span>
                <div className="flex items-center">
                  <Badge color="failure" size="sm">{stats.arrival_stats.absent}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.arrival_stats.absent, stats.total_employees)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Work Duration */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center">
              <HiBriefcase className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Work Duration</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Full Day</span>
                <div className="flex items-center">
                  <Badge color="success" size="sm">{stats.duration_stats.full_day}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.duration_stats.full_day, stats.total_employees)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Half Day</span>
                <div className="flex items-center">
                  <Badge color="info" size="sm">{stats.duration_stats.half_day}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.duration_stats.half_day, stats.total_employees)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Short Leave</span>
                <div className="flex items-center">
                  <Badge color="warning" size="sm">{stats.duration_stats.short_leave}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.duration_stats.short_leave, stats.total_employees)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">On Leave</span>
                <div className="flex items-center">
                  <Badge color="purple" size="sm">{stats.duration_stats.on_leave}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {getPercentage(stats.duration_stats.on_leave, stats.total_employees)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Hours Summary */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center">
              <HiTrendingUp className="h-6 w-6 text-purple-600 mr-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Hours Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Hours</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {stats.total_hours.toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overtime Hours</span>
                <span className="font-semibold text-orange-600">
                  {stats.overtime_hours.toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg per Employee</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {(stats.total_hours / stats.total_employees).toFixed(1)}h
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AttendanceDashboard;