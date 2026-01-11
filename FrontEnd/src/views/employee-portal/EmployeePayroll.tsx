import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CurrencyDollarIcon, DocumentTextIcon, CalendarIcon, EyeIcon } from '@heroicons/react/24/outline';

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
  const [activeTab, setActiveTab] = useState<'history' | 'live'>('history');
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [selectedLivePayroll, setSelectedLivePayroll] = useState<any>(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayrollHistory();
    fetchLivePayrollRuns();
  }, []);

  const fetchPayrollHistory = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/api/employee-portal/payroll/history`, {
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
    const { record, earnings, deductions } = selectedLivePayroll;

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600">Worked Days</p>
                <p className="text-lg font-semibold">{record.worked_days || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Worked Hours</p>
                <p className="text-lg font-semibold">{record.worked_hours || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Overtime Hours</p>
                <p className="text-lg font-semibold">{record.overtime_hours || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Leave Days</p>
                <p className="text-lg font-semibold">{record.leave_days || 0}</p>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b">Earnings</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Salary</span>
                <span className="font-medium">Rs. {(record.base_salary || 0).toLocaleString()}</span>
              </div>
              {earnings.map((earning: any) => (
                <div key={earning.component_name} className="flex justify-between">
                  <span className="text-gray-600">{earning.component_name}</span>
                  <span className="font-medium">Rs. {(earning.amount || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                <span>Gross Salary</span>
                <span className="text-blue-600">Rs. {(record.gross_salary || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b">Deductions</h3>
            <div className="space-y-2">
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

          {activeTab === 'live' && (
            <div className="overflow-x-auto">
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
                  {payrollRuns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No payroll runs found
                      </td>
                    </tr>
                  ) : (
                    payrollRuns.map((run) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeePayroll;
