import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CurrencyDollarIcon, DocumentTextIcon, CalendarIcon, EyeIcon } from '@heroicons/react/24/outline';
import { payrollRunApiService } from '../../services/payrollRunService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface PayrollRecord {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  base_salary: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  payment_status: string;
  payment_method: string;
  payment_date: string;
  allowances: number;
  overtime_amount: number;
  bonus: number;
  tax_deduction: number;
  provident_fund: number;
  insurance: number;
  loan_deduction: number;
}

interface PayrollRun {
  run_id: string;
  run_number: string;
  run_name: string;
  run_status: string;
  period_start_date: string;
  period_end_date: string;
  period_type: string;
}

const EmployeePayroll = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'live'>('live');
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [selectedLivePayroll, setSelectedLivePayroll] = useState<any>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailyDetailsModal, setDailyDetailsModal] = useState<{
      show: boolean;
      loading: boolean;
      data: any | null;
    }>({ show: false, loading: false, data: null });

  useEffect(() => {
    fetchPayrollHistory();
    fetchLivePayrollRuns();
  }, []);

  const openDailyDetailsModal = async () => {
      if (!selectedRunId) return;
      setDailyDetailsModal({ show: true, loading: true, data: null });

      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get(`${API_BASE}/api/employee-portal/payroll/live-preview/${selectedRunId}/daily-details`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.data) {
          setDailyDetailsModal(prev => ({ ...prev, loading: false, data: response.data.data }));
        } else {
          setDailyDetailsModal(prev => ({ ...prev, loading: false }));
        }
      } catch (err: any) {
        console.error('Error loading daily details:', err);
        setDailyDetailsModal(prev => ({ ...prev, loading: false }));
      }
    };

    const closeDailyDetailsModal = () => {
      setDailyDetailsModal({ show: false, loading: false, data: null });
    };

  const fetchPayrollHistory = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response =  await axios.get(`${API_BASE}/api/employee-portal/payroll/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 12 }
      });

      setPayrollHistory(response.data.data.history);
    } catch (error) {
      console.error('Error fetching payroll history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLivePayrollRuns = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/api/employee-portal/payroll/live-preview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPayrollRuns(response.data.data.payrollRuns);
    } catch (error) {
      console.error('Error fetching live payroll runs:', error);
    }
  };

  const viewPayslip = async (payrollId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/api/employee-portal/payroll/${payrollId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedPayroll(response.data.data);
      setShowPayslip(true);
    } catch (error) {
      console.error('Error fetching payslip:', error);
    }
  };

  const viewLivePreview = async (runId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/api/employee-portal/payroll/live-preview/${runId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedLivePayroll(response.data.data);
      setSelectedRunId(runId);
      setShowLivePreview(true);
    } catch (error) {
      console.error('Error fetching live preview:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'review': return 'text-yellow-600 bg-yellow-100';
      case 'calculating': return 'text-purple-600 bg-purple-100';
      case 'draft': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show Live Preview Details
  if (showLivePreview && selectedLivePayroll) {
    const { record, earnings, deductions, attendance_details } = selectedLivePayroll;

    // Extract detailed attendance data
    const earningsBySource = attendance_details?.earnings_by_source || {};
    const shortfallByCause = attendance_details?.shortfall_by_cause || {};

    

    // Calculate total expected days/hours
    const attendanceHours = earningsBySource.attendance?.hours || 0;
    const paidLeaveHours = earningsBySource.paid_leaves?.hours || 0;
    const liveSessionHours = earningsBySource.live_session?.hours || 0;

    // Get leave days from backend (calculated based on actual daily hours)
    const paidLeaveDays = record.paid_leave_days || 0;
    const unpaidLeaveDays = record.unpaid_leave_days || 0;

    // Get total working days from backend (accounts for custom cycles)
    const totalWorkingDays = record.total_working_days || 0;

    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowLivePreview(false)}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to Live Preview
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-800">Live Payroll Preview</h1>
            <p className="text-gray-600 mt-2">
              {record.run_name} ({new Date(record.period_start_date).toLocaleDateString()} - {new Date(record.period_end_date).toLocaleDateString()})
              {record.uses_custom_cycle && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Custom Cycle</span>
              )}
            </p>
            <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${getRunStatusColor(record.run_status)}`}>
              {record.run_status}
            </span>
          </div>

          {/* Employee Info */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-700 mb-3">Employee Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <p className="text-sm"><strong>Name:</strong> {record.employee_name}</p>
              <p className="text-sm"><strong>ID:</strong> {record.employee_code}</p>
              <p className="text-sm"><strong>Department:</strong> {record.department_name}</p>
              <p className="text-sm"><strong>Designation:</strong> {record.designation_name}</p>
            </div>
          </div>

          {/* Work Summary */}
          <div className="mb-8 bg-gray-50 p-6 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-3">Work Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600">Total Working Days</p>
                <p className="text-lg font-semibold">{totalWorkingDays}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Worked Days</p>
                <p className="text-lg font-semibold">{record.worked_days || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Worked Hours</p>
                <p className="text-lg font-semibold">{attendanceHours.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Overtime Hours</p>
                <p className="text-lg font-semibold text-blue-600">{record.overtime_hours || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Paid Leave Days</p>
                <p className="text-lg font-semibold text-green-600">{paidLeaveDays}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Unpaid Leave Days</p>
                <p className="text-lg font-semibold text-red-600">{unpaidLeaveDays}</p>
              </div>
            </div>
          </div>

{/* Earnings Calculation */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b">Salary Calculation</h3>
            <div className="space-y-3">
              {/* Base Salary (Total) */}
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Base Salary (Full Month)</span>
                <span className="font-medium text-gray-600">Rs. {(record.base_salary || 0).toLocaleString()}</span>
              </div>

              {/* Attendance Shortfall - Why salary is less than base */}
              {attendance_details && (shortfallByCause.unpaid_time_off?.deduction > 0 || shortfallByCause.time_variance?.deduction > 0 || shortfallByCause.absent_days?.deduction > 0) && (
                <div className="ml-4 bg-orange-50 p-3 rounded border border-orange-200">
                  <div className="font-medium text-orange-800 mb-2">Salary Reduction (Shortfall)</div>
                  <div className="ml-4 space-y-1 text-sm">
                    {shortfallByCause.unpaid_time_off && shortfallByCause.unpaid_time_off.deduction > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                          Unpaid Leaves ({shortfallByCause.unpaid_time_off.hours.toFixed(2)}h)
                        </span>
                        <span className="text-orange-700">-Rs. {(shortfallByCause.unpaid_time_off.deduction || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {shortfallByCause.time_variance && shortfallByCause.time_variance.deduction > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                          Late Arrivals and Early Departures ({shortfallByCause.time_variance.hours.toFixed(2)}h)
                        </span>
                        <span className="text-orange-700">-Rs. {(shortfallByCause.time_variance.deduction || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {shortfallByCause.absent_days && shortfallByCause.absent_days.deduction > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                          Absent Days
                        </span>
                        <span className="text-orange-700">-Rs. {(shortfallByCause.absent_days.deduction || 0).toLocaleString()}</span>
                      </div>
                    )}
                    </div>
                </div>
              )}

              {earningsBySource.attendance && (
              <div className="flex justify-between pt-1 border-t font-medium text-gray-600">
                  <span></span>
                  <span>
                    <button
                      onClick={() => openDailyDetailsModal()}
                      className="px-6 py-2 bg-purple-100 text-purple-800 border border-purple-800 rounded-lg hover:bg-purple-100 transition-colors mr-2"
                    >
                     View Daily Salary
                    </button>
                    Rs. {(earningsBySource.attendance.earned || 0).toLocaleString()}
                    </span>
                </div>
              )}

              {/* Base Salary Earned */}
              <div className="flex justify-between bg-blue-50 p-2 rounded">
                <span className="font-medium text-blue-800">Base Salary Earned</span>
                <span className="font-medium text-blue-800">Rs. {(record.earned_salary || 0).toLocaleString()}</span>
              </div>

              {/* Earnings Breakdown */}
              <div className="ml-4 bg-green-50 p-3 rounded">
                <div className="font-medium text-green-800 mb-2">Earnings from Work</div>
                <div className="ml-4 space-y-1 text-sm">
                  {earningsBySource.paid_leaves && earningsBySource.paid_leaves.earned > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Paid Leaves ({paidLeaveHours.toFixed(2)}h)
                      </span>
                      <span>+Rs. {(earningsBySource.paid_leaves.earned || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {liveSessionHours > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        Live Session ({liveSessionHours.toFixed(2)}h)
                      </span>
                      <span>Rs. {(earningsBySource.live_session?.earned || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {earnings.filter((e: any) => e.component_name !== 'Base Salary (Earned)').map((earning: any) => (
                    <div key={earning.component_name} className="flex justify-between text-gray-700">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-teal-500 rounded-full mr-2"></span>
                        {earning.component_name}
                      </span>
                      <span>+Rs. {(earning.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                  {!(earningsBySource.paid_leaves?.earned > 0) && !(liveSessionHours > 0) && earnings.filter((e: any) => e.component_name !== 'Base Salary (Earned)').length === 0 && (
                    <div className="text-gray-400 italic">No additional earnings</div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t-2 border-blue-600 font-semibold text-lg">
                <span>Gross Salary</span>
                <span className="text-blue-600">Rs. {(record.gross_salary || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b">Deductions (from Gross Salary)</h3>
            <div className="space-y-2">
              {deductions.length > 0 ? (
                <>
                  {deductions.map((deduction: any) => (
                    <div key={deduction.component_name} className="flex justify-between">
                      <span className="text-gray-600">{deduction.component_name}</span>
                      <span className="font-medium text-red-600">-Rs. {(deduction.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total Deductions</span>
                    <span className="text-red-600">-Rs. {(record.total_deductions || 0).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 italic">No deductions</div>
              )}
            </div>
          </div>

          {/* Net Salary */}
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-800">Net Salary</span>
              <span className="text-3xl font-bold text-blue-600">
                Rs. {(record.net_salary || 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-gray-600">
                <strong>Status:</strong> <span className="capitalize">{record.status}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Calculated:</strong> {new Date(record.calculation_date).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Daily Work Details Modal */}
        {dailyDetailsModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-lg shadow-lg max-w-5xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Daily Work Details</h3>
                  <p className="text-sm text-gray-500">{record.employee_name}</p>
                </div>
                <button
                  onClick={closeDailyDetailsModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto">
                {dailyDetailsModal.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-600">Loading daily details...</span>
                  </div>
                ) : dailyDetailsModal.data ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-600">Working Days</p>
                        <p className="text-xl font-bold text-blue-700">{dailyDetailsModal.data.summary.total_working_days}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total Hours</p>
                        <p className="text-xl font-bold text-blue-700">{dailyDetailsModal.data.summary.total_working_hours.toFixed(2)} hrs</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600">Absent Days</p>
                        <p className="text-xl font-bold text-red-600">{dailyDetailsModal.data.summary.absent_days ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-yellow-600">Paid Leaves</p>
                        <p className="text-xl font-bold text-yellow-600">{dailyDetailsModal.data.summary.paid_leave_days ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-600">Unpaid Leaves</p>
                        <p className="text-xl font-bold text-orange-600">{dailyDetailsModal.data.summary.unpaid_leave_days ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total Minutes</p>
                        <p className="text-xl font-bold text-blue-700">{dailyDetailsModal.data.summary.total_working_minutes.toLocaleString()} mins</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600">Total Salary Earned</p>
                        <p className="text-xl font-bold text-green-700">Rs. {dailyDetailsModal.data.summary.total_salary_earned.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Daily Records */}
                    {dailyDetailsModal.data.daily_records.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No records found for this period.</div>
                    ) : (
                      <>
                        {/* Mobile: card list */}
                        <div className="space-y-3 lg:hidden">
                          {dailyDetailsModal.data.daily_records.map((day: any, index: number) => {
                            const isAbsent = day.record_type === 'absent';
                            const isLeave = day.record_type === 'leave';
                            const isHoliday = day.record_type === 'holiday';
                            const isWeekendOff = day.record_type === 'weekend_off';
                            const isUnscheduledWeekend = day.day_type === 'Saturday (Unscheduled)' || day.day_type === 'Sunday (Unscheduled)';

                            const cardBg = isAbsent ? 'bg-red-50 border-red-100' :
                              isLeave && day.is_paid_leave ? 'bg-yellow-50 border-yellow-100' :
                              isLeave && !day.is_paid_leave ? 'bg-orange-50 border-orange-100' :
                              isHoliday ? 'bg-blue-50 border-blue-100' :
                              isWeekendOff ? 'bg-gray-50 border-gray-100' : 'border-gray-200';

                            const statusLabel = day.status === 'paid_leave' ? 'Paid Leave' :
                              day.status === 'unpaid_leave' ? 'Unpaid Leave' :
                              day.status === 'holiday' ? 'Holiday' :
                              day.status === 'weekend_off' ? 'Weekend Off' :
                              day.status;

                            return (
                              <div key={index} className={`border rounded-lg p-3 ${cardBg}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm text-gray-900">
                                    {new Date(day.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-xs text-gray-600 capitalize">{statusLabel}</span>
                                </div>
                                <div className="text-xs text-gray-500 mb-2">{day.day_type}</div>

                                <div className="grid grid-cols-2 gap-y-2 text-sm mb-2">
                                  <div>
                                    <p className="text-xs text-gray-500">Check In</p>
                                    <p className="text-gray-900">{day.check_in || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Check Out</p>
                                    <p className="text-gray-900">{day.check_out || '-'}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-black/5">
                                  <div className="text-sm">
                                    {isAbsent || isWeekendOff ? (
                                      <span className="text-gray-400">—</span>
                                    ) : isLeave ? (
                                      <div>
                                        <span className="text-yellow-700 font-medium">{day.leave_type_name}</span>
                                        <span className="text-xs text-gray-500 ml-1">({day.is_paid_leave ? 'Paid' : 'Unpaid'})</span>
                                      </div>
                                    ) : isHoliday ? (
                                      <span className="text-blue-700 font-medium">{day.holiday_name}</span>
                                    ) : isUnscheduledWeekend ? (
                                      <span className="text-red-600 font-bold">
                                        {day.overtime_minutes.toLocaleString()} mins ({(day.overtime_minutes / 60).toFixed(2)} hrs)
                                      </span>
                                    ) : (
                                      <>
                                        <span className="text-blue-600">{day.working_minutes.toLocaleString()} mins</span>
                                        <span className="text-xs text-gray-500 ml-1">({day.working_hours} hrs)</span>
                                        {day.overtime_minutes > 0 && <div className="text-xs text-red-600 font-medium">+{day.overtime_minutes} OT mins</div>}
                                      </>
                                    )}
                                  </div>
                                  <div className="text-sm font-bold text-right">
                                    {isAbsent ? (
                                      <span className="text-red-500">Rs. 0.00</span>
                                    ) : isWeekendOff ? (
                                      <span className="text-gray-400">—</span>
                                    ) : isHoliday ? (
                                      <span className="text-blue-600">—</span>
                                    ) : isLeave ? (
                                      day.is_paid_leave ? (
                                        <span className="text-yellow-700">Rs. {day.daily_salary.toLocaleString()}</span>
                                      ) : (
                                        <span className="text-orange-600">Rs. 0.00</span>
                                      )
                                    ) : isUnscheduledWeekend ? (
                                      <span className="text-red-600">Rs. {day.overtime_amount.toLocaleString()}</span>
                                    ) : (
                                      <>
                                        <span className="text-green-600">Rs. {day.daily_salary.toLocaleString()}</span>
                                        {day.overtime_amount > 0 && <div className="text-xs text-red-600 font-medium">+Rs. {day.overtime_amount.toLocaleString()} OT</div>}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop: table */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Date</th>
                                <th className="py-2 pr-4">Day Type</th>
                                <th className="py-2 pr-4">Check In</th>
                                <th className="py-2 pr-4">Check Out</th>
                                <th className="py-2 pr-4">Working Minutes</th>
                                <th className="py-2 pr-4">Daily Salary</th>
                                <th className="py-2 pr-4">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyDetailsModal.data.daily_records.map((day: any, index: number) => {
                                const isAbsent = day.record_type === 'absent';
                                const isLeave = day.record_type === 'leave';
                                const isHoliday = day.record_type === 'holiday';
                                const isWeekendOff = day.record_type === 'weekend_off';
                                const isUnscheduledWeekend = day.day_type === 'Saturday (Unscheduled)' || day.day_type === 'Sunday (Unscheduled)';

                                const rowBg = isAbsent ? 'bg-red-50' :
                                  isLeave && day.is_paid_leave ? 'bg-yellow-50' :
                                  isLeave && !day.is_paid_leave ? 'bg-orange-50' :
                                  isHoliday ? 'bg-blue-50' :
                                  isWeekendOff ? 'bg-gray-50' : '';

                                const statusLabel = day.status === 'paid_leave' ? 'Paid Leave' :
                                  day.status === 'unpaid_leave' ? 'Unpaid Leave' :
                                  day.status === 'holiday' ? 'Holiday' :
                                  day.status === 'weekend_off' ? 'Weekend Off' :
                                  day.status;

                                return (
                                  <tr key={index} className={`border-b ${rowBg}`}>
                                    <td className="py-2 pr-4 font-medium">
                                      {new Date(day.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="py-2 pr-4">{day.day_type}</td>
                                    <td className="py-2 pr-4">{day.check_in || '-'}</td>
                                    <td className="py-2 pr-4">{day.check_out || '-'}</td>
                                    <td className="py-2 pr-4">
                                      {isAbsent || isWeekendOff ? (
                                        <span className="text-gray-400">—</span>
                                      ) : isLeave ? (
                                        <div>
                                          <span className="text-yellow-700 font-medium">{day.leave_type_name}</span>
                                          <div className="text-xs text-gray-500">{day.is_paid_leave ? 'Paid' : 'Unpaid'}</div>
                                        </div>
                                      ) : isHoliday ? (
                                        <span className="text-blue-700 font-medium">{day.holiday_name}</span>
                                      ) : isUnscheduledWeekend ? (
                                        <span className="text-red-600 font-bold">
                                          {day.overtime_minutes.toLocaleString()} mins
                                          <div className="text-xs font-medium">({(day.overtime_minutes / 60).toFixed(2)} hrs)</div>
                                        </span>
                                      ) : (
                                        <>
                                          <span className="text-blue-600">{day.working_minutes.toLocaleString()} mins</span>
                                          <div className="text-xs text-gray-500">({day.working_hours} hrs)</div>
                                          {day.overtime_minutes > 0 && <div className="text-xs text-red-600 font-medium">+{day.overtime_minutes} OT mins</div>}
                                        </>
                                      )}
                                    </td>
                                    <td className="py-2 pr-4 font-bold">
                                      {isAbsent ? (
                                        <span className="text-red-500">Rs. 0.00</span>
                                      ) : isWeekendOff ? (
                                        <span className="text-gray-400">—</span>
                                      ) : isHoliday ? (
                                        <span className="text-blue-600">—</span>
                                      ) : isLeave ? (
                                        day.is_paid_leave ? (
                                          <span className="text-yellow-700">Rs. {day.daily_salary.toLocaleString()}</span>
                                        ) : (
                                          <span className="text-orange-600">Rs. 0.00 <span className="text-xs font-normal">(Unpaid)</span></span>
                                        )
                                      ) : isUnscheduledWeekend ? (
                                        <span className="text-red-600">Rs. {day.overtime_amount.toLocaleString()}</span>
                                      ) : (
                                        <>
                                          <span className="text-green-600">Rs. {day.daily_salary.toLocaleString()}</span>
                                          {day.overtime_amount > 0 && <div className="text-xs text-red-600 font-medium">+Rs. {day.overtime_amount.toLocaleString()} OT</div>}
                                        </>
                                      )}
                                    </td>
                                    <td className="py-2 pr-4 capitalize">{statusLabel}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* Period Info */}
                    <div className="text-sm text-gray-600 border-t pt-4">
                      <p>
                        <strong>Payroll Period:</strong>{' '}
                        {new Date(dailyDetailsModal.data.period.start_date).toLocaleDateString()} -{' '}
                        {new Date(dailyDetailsModal.data.period.end_date).toLocaleDateString()}
                        {dailyDetailsModal.data.period.uses_custom_cycle && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Custom Cycle</span>
                        )}
                      </p>
                      <p className="mt-1">
                        <strong>Base Salary:</strong> Rs. {dailyDetailsModal.data.employee.base_salary.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No data available</div>
                )}
              </div>

              <div className="flex justify-end p-4 border-t">
                <button
                  onClick={closeDailyDetailsModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show Payslip
  if (showPayslip && selectedPayroll) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowPayslip(false)}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to Payroll History
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-800">Payslip</h1>
            <p className="text-gray-600 mt-2">
              {new Date(selectedPayroll.payroll.period.start).toLocaleDateString()} - {new Date(selectedPayroll.payroll.period.end).toLocaleDateString()}
            </p>
          </div>

          {/* Employee & Company Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Employee Details</h3>
              <p className="text-sm"><strong>Name:</strong> {selectedPayroll.employee.name}</p>
              <p className="text-sm"><strong>ID:</strong> {selectedPayroll.employee.id}</p>
              <p className="text-sm"><strong>Department:</strong> {selectedPayroll.employee.department}</p>
              <p className="text-sm"><strong>Designation:</strong> {selectedPayroll.employee.designation}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Company Details</h3>
              <p className="text-sm"><strong>{selectedPayroll.company.name}</strong></p>
              <p className="text-sm">{selectedPayroll.company.address}</p>
              <p className="text-sm">{selectedPayroll.company.phone}</p>
            </div>
          </div>

          {/* Earnings */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b">Earnings</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Basic Salary</span>
                <span className="font-medium">Rs. {selectedPayroll.payroll.earnings.basic_salary.toLocaleString()}</span>
              </div>
              {selectedPayroll.payroll.earnings.allowances > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Allowances</span>
                  <span className="font-medium">Rs. {selectedPayroll.payroll.earnings.allowances.toLocaleString()}</span>
                </div>
              )}
              {selectedPayroll.payroll.earnings.overtime > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Overtime</span>
                  <span className="font-medium">Rs. {selectedPayroll.payroll.earnings.overtime.toLocaleString()}</span>
                </div>
              )}
              {selectedPayroll.payroll.earnings.bonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Bonus</span>
                  <span className="font-medium">Rs. {selectedPayroll.payroll.earnings.bonus.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Gross Salary</span>
                <span>Rs. {selectedPayroll.payroll.earnings.gross_total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b">Deductions</h3>
            <div className="space-y-2">
              {selectedPayroll.payroll.deductions.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium text-red-600">-Rs. {selectedPayroll.payroll.deductions.tax.toLocaleString()}</span>
                </div>
              )}
              {selectedPayroll.payroll.deductions.provident_fund > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Provident Fund</span>
                  <span className="font-medium text-red-600">-Rs. {selectedPayroll.payroll.deductions.provident_fund.toLocaleString()}</span>
                </div>
              )}
              {selectedPayroll.payroll.deductions.insurance > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Insurance</span>
                  <span className="font-medium text-red-600">-Rs. {selectedPayroll.payroll.deductions.insurance.toLocaleString()}</span>
                </div>
              )}
              {selectedPayroll.payroll.deductions.loan > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Deduction</span>
                  <span className="font-medium text-red-600">-Rs. {selectedPayroll.payroll.deductions.loan.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-600">-Rs. {selectedPayroll.payroll.deductions.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Net Salary */}
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-800">Net Salary</span>
              <span className="text-3xl font-bold text-blue-600">
                Rs. {selectedPayroll.payroll.net_salary.toLocaleString()}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-gray-600">
                <strong>Payment Status:</strong> <span className="capitalize">{selectedPayroll.payroll.payment.status}</span>
              </p>
              <p className="text-sm text-gray-600">
                <strong>Payment Method:</strong> <span className="capitalize">{selectedPayroll.payroll.payment.method?.replace('_', ' ')}</span>
              </p>
              {selectedPayroll.payroll.payment.date && (
                <p className="text-sm text-gray-600">
                  <strong>Payment Date:</strong> {new Date(selectedPayroll.payroll.payment.date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main View with Tabs
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Payroll</h1>
        <p className="text-gray-600">View your salary history and live payroll preview</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {/* Payroll History tab hidden — only Live Preview is shown
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <DocumentTextIcon className="w-5 h-5 mr-2" />
                Payroll History ({payrollHistory.length})
              </div>
            </button>
            */}
            <button
              onClick={() => setActiveTab('live')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'live'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <EyeIcon className="w-5 h-5 mr-2" />
                Live Preview ({payrollRuns.length})
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Payroll History tab content hidden — only Live Preview is shown
          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gross Salary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deductions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net Salary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payrollHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No payroll records found
                      </td>
                    </tr>
                  ) : (
                    payrollHistory.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {new Date(record.pay_period_start).toLocaleDateString()} -
                              </div>
                              <div className="text-sm text-gray-900">
                                {new Date(record.pay_period_end).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Rs. {record.gross_salary?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          -Rs. {record.total_deductions?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-green-600">
                            Rs. {record.net_salary?.toLocaleString() || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(record.payment_status)}`}>
                            {record.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => viewPayslip(record.id)}
                            className="text-blue-600 hover:text-blue-800 flex items-center"
                          >
                            <DocumentTextIcon className="w-5 h-5 mr-1" />
                            View Payslip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          */}

          {activeTab === 'live' && (
            payrollRuns.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No payroll runs found
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3 md:hidden">
                  {payrollRuns.map((run) => (
                    <div key={run.run_id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{run.run_name}</div>
                          <div className="text-xs text-gray-500">{run.run_number}</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getRunStatusColor(run.run_status)}`}>
                          {run.run_status}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-900 mb-1">
                        <CalendarIcon className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                        {new Date(run.period_start_date).toLocaleDateString()} - {new Date(run.period_end_date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500 capitalize mb-3">{run.period_type}</div>
                      <button
                        onClick={() => viewLivePreview(run.run_id)}
                        className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <EyeIcon className="w-5 h-5" />
                        View Details
                      </button>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Run Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payrollRuns.map((run) => (
                        <tr key={run.run_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{run.run_name}</div>
                            <div className="text-xs text-gray-500">{run.run_number}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm text-gray-900">
                                  {new Date(run.period_start_date).toLocaleDateString()} -
                                </div>
                                <div className="text-sm text-gray-900">
                                  {new Date(run.period_end_date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                            {run.period_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getRunStatusColor(run.run_status)}`}>
                              {run.run_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => viewLivePreview(run.run_id)}
                              className="text-blue-600 hover:text-blue-800 flex items-center"
                            >
                              <EyeIcon className="w-5 h-5 mr-1" />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeePayroll;
