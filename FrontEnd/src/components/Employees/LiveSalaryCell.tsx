import React, { useState, useEffect } from 'react';
import { Spinner, Tooltip, Badge } from 'flowbite-react';
import { HiCurrencyDollar, HiRefresh } from 'react-icons/hi';
import apiService from '../../services/api';

interface LiveSalaryCellProps {
  employeeId: string;
}

interface LivePayrollData {
  summary: {
    net_salary: number;
    completion_percentage: number;
    gross_salary: number;
    total_deductions: number;
  };
  period: {
    start: string;
    end: string;
    days_calculated: number;
    total_days_in_month: number;
  };
  projection?: {
    projected_net_salary: number;
    confidence_level: number;
  };
}

const LiveSalaryCell: React.FC<LiveSalaryCellProps> = ({ employeeId }) => {
  const [salaryData, setSalaryData] = useState<LivePayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveSalary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.apiCall(
        `/api/payroll-runs/live/${employeeId}?projectFullMonth=true`
      );

      if (response.success) {
        setSalaryData(response.data);
      } else {
        setError('Failed to fetch');
      }
    } catch (err) {
      console.error('Error fetching live salary:', err);
      setError('Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchLiveSalary();
    }
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <button
          onClick={fetchLiveSalary}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
        >
          <HiRefresh className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!salaryData) {
    return (
      <div className="text-xs text-gray-400">
        No data
      </div>
    );
  }

  const { summary, period, projection } = salaryData;
  const completionPercentage = Math.round(summary.completion_percentage || 0);
  const currentSalary = summary.net_salary || 0;
  const projectedSalary = projection?.projected_net_salary || 0;

  return (
    <div className="space-y-1">
      {/* Current Salary */}
      <div className="text-sm font-medium text-gray-900 dark:text-white">
        <div className="flex items-center gap-1">
          <HiCurrencyDollar className="h-3 w-3 text-green-500" />
          {currentSalary.toLocaleString()}
        </div>
      </div>

      {/* Progress Badge */}
      <div className="flex items-center gap-1">
        <Badge
          color={completionPercentage >= 75 ? 'green' : completionPercentage >= 50 ? 'yellow' : 'gray'}
          size="xs"
        >
          {completionPercentage}% complete
        </Badge>
      </div>

      {/* Projected Salary (if available) */}
      {projection && (
        <Tooltip
          content={`Projected full month: ${projectedSalary.toLocaleString()} (${projection.confidence_level}% confidence)`}
        >
          <div className="text-xs text-gray-500 cursor-help">
            Est: {projectedSalary.toLocaleString()}
          </div>
        </Tooltip>
      )}

      {/* Period Info */}
      <div className="text-xs text-gray-400">
        {period.days_calculated}/{period.total_days_in_month} days
      </div>
    </div>
  );
};

export default LiveSalaryCell;