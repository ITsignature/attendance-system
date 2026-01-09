import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ClockIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface DashboardStats {
  attendance: {
    present_days: number;
    absent_days: number;
    late_days: number;
    total_days: number;
  };
  leaves: {
    pending: number;
    approved: number;
    remaining: number;
  };
  payroll: {
    last_payment: number;
    currency: string;
  };
}

const EmployeeDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      // Fetch attendance summary
      const attendanceRes = await axios.get(`${API_BASE}/api/employee-portal/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 30 }
      });

      // Fetch leave balance
      const leaveRes = await axios.get(`${API_BASE}/api/employee-portal/leaves/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch payroll history
      const payrollRes = await axios.get(`${API_BASE}/api/employee-portal/payroll/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1 }
      });

      const attendanceSummary = attendanceRes.data.data.summary;
      const leaveBalances = leaveRes.data.data.balance || [];
      const lastPayroll = payrollRes.data.data.history[0];

      // Calculate total remaining leaves
      const totalRemaining = leaveBalances.reduce((sum: number, lb: any) => sum + (lb.remaining || 0), 0);

      // Get pending leaves count
      const leaveReqRes = await axios.get(`${API_BASE}/api/employee-portal/leaves/my-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'pending' }
      });

      setStats({
        attendance: {
          present_days: attendanceSummary?.present_days || 0,
          absent_days: attendanceSummary?.absent_days || 0,
          late_days: attendanceSummary?.late_days || 0,
          total_days: attendanceSummary?.total_days || 0,
        },
        leaves: {
          pending: leaveReqRes.data.data.requests?.length || 0,
          approved: leaveBalances.reduce((sum: number, lb: any) => sum + (lb.used || 0), 0),
          remaining: totalRemaining,
        },
        payroll: {
          last_payment: lastPayroll?.net_salary || 0,
          currency: 'Rs.',
        },
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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

  const statCards = [
    {
      title: 'Attendance',
      icon: ClockIcon,
      color: 'blue',
      stats: [
        { label: 'Present', value: stats?.attendance.present_days || 0 },
        { label: 'Absent', value: stats?.attendance.absent_days || 0 },
        { label: 'Late', value: stats?.attendance.late_days || 0 },
      ],
    },
    {
      title: 'Leaves',
      icon: CalendarIcon,
      color: 'green',
      stats: [
        { label: 'Remaining', value: stats?.leaves.remaining || 0 },
        { label: 'Pending', value: stats?.leaves.pending || 0 },
        { label: 'Taken', value: stats?.leaves.approved || 0 },
      ],
    },
    {
      title: 'Last Payment',
      icon: CurrencyDollarIcon,
      color: 'purple',
      value: `Rs. ${stats?.payroll.last_payment?.toLocaleString() || 0}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome to Your Dashboard</h1>
        <p className="opacity-90">Here's a quick overview of your information</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{card.title}</h3>
              <card.icon className={`w-8 h-8 text-${card.color}-500`} />
            </div>

            {card.value ? (
              <p className={`text-3xl font-bold text-${card.color}-600`}>{card.value}</p>
            ) : (
              <div className="space-y-2">
                {card.stats?.map((stat, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-gray-600">{stat.label}</span>
                    <span className={`font-semibold text-${card.color}-600`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/employee-portal/profile"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <CheckCircleIcon className="w-6 h-6 text-blue-600 mr-3" />
            <span className="font-medium text-gray-700">View Profile</span>
          </a>

          <a
            href="/employee-portal/attendance"
            className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <ClockIcon className="w-6 h-6 text-green-600 mr-3" />
            <span className="font-medium text-gray-700">Check Attendance</span>
          </a>

          <a
            href="/employee-portal/leaves"
            className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <CalendarIcon className="w-6 h-6 text-purple-600 mr-3" />
            <span className="font-medium text-gray-700">Apply Leave</span>
          </a>

          <a
            href="/employee-portal/payroll"
            className="flex items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <CurrencyDollarIcon className="w-6 h-6 text-orange-600 mr-3" />
            <span className="font-medium text-gray-700">View Payslips</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
