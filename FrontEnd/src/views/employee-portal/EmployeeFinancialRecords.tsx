import { useEffect, useState } from 'react';
import axios from 'axios';
import { BanknotesIcon, CreditCardIcon, GiftIcon } from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Loan {
  id: string;
  loan_type: string;
  loan_amount: number;
  remaining_amount: number;
  monthly_deduction: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface Advance {
  id: string;
  advance_type: string;
  amount: number;
  remaining_amount: number;
  deduction_per_month: number;
  date: string;
  status: string;
  reason: string;
}

interface Bonus {
  id: string;
  bonus_type: string;
  amount: number;
  date: string;
  reason: string;
  status: string;
}

const EmployeeFinancialRecords = () => {
  const [activeTab, setActiveTab] = useState<'loans' | 'advances' | 'bonuses'>('loans');
  const [financialData, setFinancialData] = useState<{
    loans: Loan[];
    advances: Advance[];
    bonuses: Bonus[];
  }>({
    loans: [],
    advances: [],
    bonuses: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialRecords();
  }, []);

  const fetchFinancialRecords = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/api/employee-portal/financial-records`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setFinancialData({
        loans: response.data?.data?.loans || [],
        advances: response.data?.data?.advances || [],
        bonuses: response.data?.data?.bonuses || [],
      });
    } catch (error) {
      console.error('Error fetching financial records:', error);
      // Set empty arrays on error to prevent undefined errors
      setFinancialData({
        loans: [],
        advances: [],
        bonuses: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'completed':
      case 'paid':
        return 'text-blue-600 bg-blue-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'rejected':
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Financial Records</h1>
        <p className="text-gray-600">View your loans, advances, and bonuses</p>
      </div>

      {/* Info Message */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
        <p className="text-sm">
          This is a read-only view of your financial records. To apply for new loans, advances, or bonuses, please contact HR or your manager.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('loans')}
              className={`flex-1 sm:flex-initial px-2 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 ${
                activeTab === 'loans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start">
                <BanknotesIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 shrink-0" />
                <span className="truncate">Loans ({financialData.loans.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('advances')}
              className={`flex-1 sm:flex-initial px-2 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 ${
                activeTab === 'advances'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start">
                <CreditCardIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 shrink-0" />
                <span className="truncate">Advances ({financialData.advances.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('bonuses')}
              className={`flex-1 sm:flex-initial px-2 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 ${
                activeTab === 'bonuses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start">
                <GiftIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 shrink-0" />
                <span className="truncate">Bonuses ({financialData.bonuses.length})</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Loans Tab */}
          {activeTab === 'loans' && (
            financialData.loans.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No loan records found
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3 lg:hidden">
                  {financialData.loans.map((loan) => (
                    <div key={loan.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {loan.loan_type.replace('_', ' ')}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                            loan.status
                          )}`}
                        >
                          {loan.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-sm mb-2">
                        <div>
                          <p className="text-xs text-gray-500">Loan Amount</p>
                          <p className="text-gray-900">Rs.{loan.loan_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Remaining</p>
                          <p className="font-medium text-red-600">Rs.{loan.remaining_amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">
                            {((loan.remaining_amount / loan.loan_amount) * 100).toFixed(1)}% remaining
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Monthly Deduction</p>
                          <p className="text-gray-900">Rs.{loan.monthly_deduction.toLocaleString()}/month</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Period</p>
                          <p className="text-gray-900">{new Date(loan.start_date).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">to {new Date(loan.end_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Loan Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Loan Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remaining
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monthly Deduction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {financialData.loans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {loan.loan_type.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Rs.{loan.loan_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              Rs.{loan.remaining_amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {((loan.remaining_amount / loan.loan_amount) * 100).toFixed(1)}% remaining
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Rs.{loan.monthly_deduction.toLocaleString()}/month
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{new Date(loan.start_date).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">
                              to {new Date(loan.end_date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                loan.status
                              )}`}
                            >
                              {loan.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}

          {/* Advances Tab */}
          {activeTab === 'advances' && (
            financialData.advances.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No advance records found
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3 lg:hidden">
                  {financialData.advances.map((advance) => (
                    <div key={advance.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {advance.advance_type.replace('_', ' ')}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                            advance.status
                          )}`}
                        >
                          {advance.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-sm mb-2">
                        <div>
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="text-gray-900">Rs.{advance.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Remaining</p>
                          <p className="font-medium text-red-600">Rs.{advance.remaining_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Deduction/Month</p>
                          <p className="text-gray-900">Rs.{advance.deduction_per_month.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="text-gray-900">{new Date(advance.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {advance.reason && (
                        <div className="pt-2 border-t border-gray-100 text-sm text-gray-600">
                          {advance.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Advance Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remaining
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deduction/Month
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {financialData.advances.map((advance) => (
                        <tr key={advance.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {advance.advance_type.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Rs.{advance.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              Rs.{advance.remaining_amount.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Rs.{advance.deduction_per_month.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(advance.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                advance.status
                              )}`}
                            >
                              {advance.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs">
                              {advance.reason}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}

          {/* Bonuses Tab */}
          {activeTab === 'bonuses' && (
            financialData.bonuses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No bonus records found
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3 lg:hidden">
                  {financialData.bonuses.map((bonus) => (
                    <div key={bonus.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {bonus.bonus_type.replace('_', ' ')}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                            bonus.status
                          )}`}
                        >
                          {bonus.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-sm mb-2">
                        <div>
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="font-semibold text-green-600">Rs.{bonus.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="text-gray-900">{new Date(bonus.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {bonus.reason && (
                        <div className="pt-2 border-t border-gray-100 text-sm text-gray-600">
                          {bonus.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bonus Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {financialData.bonuses.map((bonus) => (
                        <tr key={bonus.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {bonus.bonus_type.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-green-600">
                              Rs.{bonus.amount.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(bonus.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                bonus.status
                              )}`}
                            >
                              {bonus.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs">
                              {bonus.reason}
                            </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Loans</p>
              <p className="text-2xl font-bold text-gray-800">
                {(financialData.loans || []).filter((l) => l.status?.toLowerCase() === 'active').length}
              </p>
            </div>
            <BanknotesIcon className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Advances</p>
              <p className="text-2xl font-bold text-gray-800">
                {(financialData.advances || []).filter((a) => a.status?.toLowerCase() === 'active').length}
              </p>
            </div>
            <CreditCardIcon className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bonuses</p>
              <p className="text-2xl font-bold text-gray-800">
                Rs.{(financialData.bonuses || [])
                  .reduce((sum, b) => sum + (b.amount || 0), 0)
                  .toLocaleString()}
              </p>
            </div>
            <GiftIcon className="w-12 h-12 text-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFinancialRecords;
