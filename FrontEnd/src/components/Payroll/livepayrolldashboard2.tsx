// =============================================
// LIVE PAYROLL DASHBOARD (Optimized Frontend Calculation)
// =============================================
// Calculates payroll in the browser - 100x faster!
// Updates every 30 seconds with live session data

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Card, Alert, Spinner, Button, Badge, Modal } from "flowbite-react";
import ReactApexChart from 'react-apexcharts';
import { payrollRunApiService } from '../../services/payrollRunService';
import { livePayrollCalculationService, type CalculatedPayroll, type EmployeeData } from '../../services/livePayrollCalculationService';
import { HiRefresh, HiClock, HiUsers, HiArrowLeft } from 'react-icons/hi';

type TabId = 'overview' | 'employees' | 'departments' | 'advances' | 'warnings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'employees', label: 'Employees' },
  { id: 'departments', label: 'Departments' },
  { id: 'advances', label: 'Advance & Loans' },
  { id: 'warnings', label: 'Warnings' },
];

const LivePayrollDashboard: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculatedResults, setCalculatedResults] = useState<CalculatedPayroll[]>([]);
  const [lastCalculated, setLastCalculated] = useState<Date>(new Date());
  const [rawData, setRawData] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const itemsPerPage = 20;

  const [modalData, setModalData] = useState<{
    show: boolean;
    employee: CalculatedPayroll | null;
    type: 'allowances' | 'deductions' | null;
  }>({ show: false, employee: null, type: null });

  const [dailyDetailsModal, setDailyDetailsModal] = useState<{
    show: boolean;
    loading: boolean;
    employeeId: string | null;
    employeeName: string | null;
    data: any | null;
  }>({ show: false, loading: false, employeeId: null, employeeName: null, data: null });

  const openModal = (employee: CalculatedPayroll, type: 'allowances' | 'deductions') => {
    setModalData({ show: true, employee, type });
  };

  const closeModal = () => {
    setModalData({ show: false, employee: null, type: null });
  };

  const openDailyDetailsModal = async (employeeId: string, employeeName: string) => {
    setDailyDetailsModal({ show: true, loading: true, employeeId, employeeName, data: null });

    try {
      if (!runId) return;
      const response = await payrollRunApiService.getEmployeeDailyDetails(runId, employeeId);

      if (response.success && response.data) {
        setDailyDetailsModal(prev => ({ ...prev, loading: false, data: response.data }));
      } else {
        setDailyDetailsModal(prev => ({ ...prev, loading: false }));
        setError(response.message || 'Failed to load daily details');
      }
    } catch (err: any) {
      console.error('Error loading daily details:', err);
      setDailyDetailsModal(prev => ({ ...prev, loading: false }));
      setError(err.message || 'Failed to load daily details');
    }
  };

  const closeDailyDetailsModal = () => {
    setDailyDetailsModal({ show: false, loading: false, employeeId: null, employeeName: null, data: null });
  };

  // =============================================
  // LOAD DATA & CALCULATE
  // =============================================

  const loadAndCalculate = useCallback(async () => {
    if (!runId) {
      setError('No payroll run ID provided');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📊 Fetching live payroll data...');
      const startTime = performance.now();

      const response = await payrollRunApiService.getLivePayrollData(runId);

      const fetchTime = performance.now() - startTime;
      console.log(`✅ Data fetched in ${fetchTime.toFixed(0)}ms`);

      if (response.success && response.data) {
        setRawData(response.data);

        const calcStartTime = performance.now();
        const results = livePayrollCalculationService.calculateAllEmployees(
          response.data.employees as EmployeeData[]
        );
        const calcTime = performance.now() - calcStartTime;

        console.log(`⚡ Calculated ${results.length} employees in ${calcTime.toFixed(0)}ms`);
        setCalculatedResults(results);
        setLastCalculated(new Date());
      } else {
        setError(response.message || 'Failed to load payroll data');
      }
    } catch (err: any) {
      console.error('Error loading payroll data:', err);
      setError(err.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  // =============================================
  // RECALCULATE (using existing data - NO API CALL)
  // =============================================

  const recalculate = useCallback(() => {
    if (!rawData) return;

    console.log('⚡ Recalculating...');
    const startTime = performance.now();

    const results = livePayrollCalculationService.calculateAllEmployees(
      rawData.employees as EmployeeData[]
    );

    const calcTime = performance.now() - startTime;
    console.log(`✅ Recalculated ${results.length} employees in ${calcTime.toFixed(0)}ms`);

    setCalculatedResults(results);
    setLastCalculated(new Date());
  }, [rawData]);

  // =============================================
  // LIFECYCLE
  // =============================================

  useEffect(() => {
    loadAndCalculate();
  }, [loadAndCalculate]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh triggered');
      recalculate();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, recalculate]);

  // =============================================
  // FORMATTING & STATS
  // =============================================

  const formatCurrency = (amount: number | null | undefined) => {
    const value = amount ?? 0;
    return `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTotalStats = () => ({
    totalEmployees: calculatedResults.length,
    totalGross: calculatedResults.reduce((sum, r) => sum + (r.gross_salary ?? 0), 0),
    totalDeductions: calculatedResults.reduce((sum, r) => sum + (r.deductions_total ?? 0), 0),
    totalNet: calculatedResults.reduce((sum, r) => sum + (r.net_salary ?? 0), 0),
    totalAllowances: calculatedResults.reduce((sum, r) => sum + (r.allowances_total ?? 0), 0),
    totalBonuses: calculatedResults.reduce((sum, r) => sum + (r.bonuses_total ?? 0), 0),
    totalShortfall: calculatedResults.reduce((sum, r) => sum + (r.attendance_shortfall ?? 0), 0),
  });

  const stats = getTotalStats();

  // Pagination (Employees tab)
  const totalPages = Math.ceil(calculatedResults.length / itemsPerPage);
  const paginatedResults = calculatedResults.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // =============================================
  // CHART DATA HELPERS
  // =============================================

  const getDepartmentStats = () => {
    const map: Record<string, number> = {};
    calculatedResults.forEach(r => {
      const dept = r.department_name || 'Unassigned';
      map[dept] = (map[dept] ?? 0) + (r.net_salary ?? 0);
    });
    return Object.entries(map).map(([name, net]) => ({ name, net }));
  };

  const getAdvancePerEmployee = () =>
    calculatedResults
      .map(r => ({
        name: r.employee_name,
        amount: (r.financial_deductions_breakdown ?? [])
          .filter(d => d.type === 'advance')
          .reduce((s, d) => s + (d.amount ?? 0), 0),
      }))
      .filter(e => e.amount > 0);

  const getLoanPerEmployee = () =>
    calculatedResults
      .map(r => ({
        name: r.employee_name,
        amount: (r.financial_deductions_breakdown ?? [])
          .filter(d => d.type === 'loan')
          .reduce((s, d) => s + (d.amount ?? 0), 0),
      }))
      .filter(e => e.amount > 0);

  const getShortfallEmployees = () =>
    calculatedResults
      .filter(r => (r.attendance_shortfall ?? 0) > 0)
      .sort((a, b) => (b.attendance_shortfall ?? 0) - (a.attendance_shortfall ?? 0));

  // =============================================
  // LOADING STATE
  // =============================================

  if (loading && !rawData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
        <span className="ml-3 text-lg">Loading payroll data...</span>
      </div>
    );
  }

  // =============================================
  // CHART CONFIGS
  // =============================================

  const deptData = getDepartmentStats();
  const advanceData = getAdvancePerEmployee();
  const loanData = getLoanPerEmployee();
  const shortfallEmployees = getShortfallEmployees();

  const deptBarOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, horizontal: false } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: deptData.map(d => d.name),
      labels: { style: { fontSize: '12px' } },
    },
    yaxis: {
      labels: {
        formatter: (val) => `Rs. ${(val / 1000).toFixed(0)}k`,
      },
    },
    colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#4f46e5'],
    fill: { opacity: 1 },
    tooltip: {
      y: { formatter: (val) => formatCurrency(val) },
    },
    grid: { borderColor: '#f1f5f9' },
  };

  const deptBarSeries = [{ name: 'Net Salary', data: deptData.map(d => Math.round(d.net)) }];

  const donutOptions: ApexCharts.ApexOptions = {
    chart: { type: 'donut' },
    labels: ['Earnings', 'Deductions', 'Allowances'],
    colors: ['#22c55e', '#ef4444', '#f59e0b'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: true, formatter: (val) => `${Number(val).toFixed(1)}%` },
    tooltip: {
      y: { formatter: (val) => formatCurrency(val) },
    },
    plotOptions: { pie: { donut: { size: '65%' } } },
  };

  const donutSeries = [
    Math.round(stats.totalGross),
    Math.round(stats.totalDeductions),
    Math.round(stats.totalAllowances),
  ];

  const advanceBarOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: advanceData.map(e => e.name.split(' ')[0]),
      labels: { style: { fontSize: '11px' } },
    },
    yaxis: {
      labels: { formatter: (val) => `Rs. ${(val / 1000).toFixed(0)}k` },
    },
    colors: ['#3b82f6'],
    tooltip: { y: { formatter: (val) => formatCurrency(val) } },
    grid: { borderColor: '#f1f5f9' },
  };

  const advanceBarSeries = [{ name: 'Advance', data: advanceData.map(e => Math.round(e.amount)) }];

  const loanBarOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: loanData.map(e => e.name.split(' ')[0]),
      labels: { style: { fontSize: '11px' } },
    },
    yaxis: {
      labels: { formatter: (val) => `Rs. ${(val / 1000).toFixed(0)}k` },
    },
    colors: ['#f59e0b'],
    tooltip: { y: { formatter: (val) => formatCurrency(val) } },
    grid: { borderColor: '#f1f5f9' },
  };

  const loanBarSeries = [{ name: 'Loan Repayment', data: loanData.map(e => Math.round(e.amount)) }];

  const shortfallBarOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: shortfallEmployees.map(e => e.employee_name.split(' ')[0]),
      labels: { style: { fontSize: '11px' } },
    },
    yaxis: {
      labels: { formatter: (val) => `Rs. ${(val / 1000).toFixed(0)}k` },
    },
    colors: ['#ef4444'],
    tooltip: { y: { formatter: (val) => formatCurrency(val) } },
    grid: { borderColor: '#f1f5f9' },
  };

  const shortfallBarSeries = [{
    name: 'Shortfall',
    data: shortfallEmployees.map(e => Math.round(e.attendance_shortfall ?? 0)),
  }];

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button color="gray" size="sm" onClick={() => navigate('/payroll')}>
            <HiArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Live Payroll Preview
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              <HiClock className="inline w-4 h-4 mr-1" />
              Last calculated: {lastCalculated.toLocaleTimeString()}
              {autoRefresh ? (
                <span className="ml-2 text-green-600">(Auto-refresh: ON)</span>
              ) : (
                <span className="ml-2 text-gray-500">(Auto-refresh: OFF)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button color="gray" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button color="blue" size="sm" onClick={recalculate}>
            <HiRefresh className="w-4 h-4 mr-2" />
            Recalculate Now
          </Button>
          <Button color="purple" size="sm" onClick={loadAndCalculate}>
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ============================
          OVERVIEW TAB
          ============================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top stat cards — row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-purple-500">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Net Salary</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(stats.totalNet)}</p>
              <p className="text-xs text-gray-400 mt-1">This payroll period</p>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Earnings</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalGross)}</p>
              <p className="text-xs text-gray-400 mt-1">Gross salary</p>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Deductions</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(stats.totalDeductions)}</p>
              <p className="text-xs text-gray-400 mt-1">EPF, ETF & others</p>
            </Card>
          </div>

          {/* Top stat cards — row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-yellow-500">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Allowances</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(stats.totalAllowances)}</p>
              <p className="text-xs text-gray-400 mt-1">Allowances + bonuses</p>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employees</p>
              <div className="flex items-center gap-3 mt-1">
                <HiUsers className="w-8 h-8 text-blue-400" />
                <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">Active this period</p>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Shortfall</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(stats.totalShortfall)}</p>
              <p className="text-xs text-gray-400 mt-1">Attendance deductions</p>
            </Card>
          </div>

          {/* Charts row 1: Department bar + Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Net Salary by Department</h3>
              <p className="text-xs text-gray-400 mb-3">Distributed across departments this period</p>
              {deptData.length > 0 ? (
                <ReactApexChart
                  options={deptBarOptions}
                  series={deptBarSeries}
                  type="bar"
                  height={220}
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No department data</div>
              )}
            </Card>
            <Card className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Earnings vs Deductions</h3>
              <p className="text-xs text-gray-400 mb-3">Total split this period</p>
              {stats.totalGross > 0 ? (
                <ReactApexChart
                  options={donutOptions}
                  series={donutSeries}
                  type="donut"
                  height={220}
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
              )}
            </Card>
          </div>

          {/* Charts row 2: Advance + Loans + Shortfall */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Advance — Per Employee</h3>
              <p className="text-xs text-gray-400 mb-3">Individual amounts</p>
              {advanceData.length > 0 ? (
                <ReactApexChart
                  options={advanceBarOptions}
                  series={advanceBarSeries}
                  type="bar"
                  height={200}
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No advances this period</div>
              )}
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Loan Repayments</h3>
              <p className="text-xs text-gray-400 mb-3">Monthly installments</p>
              {loanData.length > 0 ? (
                <ReactApexChart
                  options={loanBarOptions}
                  series={loanBarSeries}
                  type="bar"
                  height={200}
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No loan repayments this period</div>
              )}
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Shortfall by Employee</h3>
              <p className="text-xs text-gray-400 mb-3">Attendance deductions</p>
              {shortfallEmployees.length > 0 ? (
                <ReactApexChart
                  options={shortfallBarOptions}
                  series={shortfallBarSeries}
                  type="bar"
                  height={200}
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-green-600 text-sm font-medium">
                  ✓ All employees on track
                </div>
              )}
            </Card>
          </div>

          {/* Info Footer */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              ⚡ <strong>Lightning Fast:</strong> All calculations are performed in your browser in real-time.
              Use the "Recalculate Now" button to refresh data, or enable auto-refresh for updates every 30 seconds.
              This is a preview only - click "Calculate" button in the main dashboard to save to database.
            </p>
          </div>
        </div>
      )}

      {/* ============================
          EMPLOYEES TAB
          ============================ */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <Table.Head>
                  <Table.HeadCell>Employee</Table.HeadCell>
                  <Table.HeadCell>Base Salary</Table.HeadCell>
                  <Table.HeadCell>Expected Base</Table.HeadCell>
                  <Table.HeadCell>Actual Earned</Table.HeadCell>
                  <Table.HeadCell>Shortfall</Table.HeadCell>
                  <Table.HeadCell>Allowances</Table.HeadCell>
                  <Table.HeadCell>Gross Salary</Table.HeadCell>
                  <Table.HeadCell>Deductions</Table.HeadCell>
                  <Table.HeadCell>Net Salary</Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {paginatedResults.length > 0 ? (
                    paginatedResults.map(result => {
                      const hasAllowances =
                        (result.allowances_breakdown && result.allowances_breakdown.length > 0) ||
                        (result.bonuses_breakdown && result.bonuses_breakdown.length > 0);
                      const hasDeductions =
                        (result.deductions_breakdown && result.deductions_breakdown.length > 0) ||
                        (result.financial_deductions_breakdown && result.financial_deductions_breakdown.length > 0);

                      return (
                        <Table.Row
                          key={result.employee_id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                          onClick={() => openDailyDetailsModal(result.employee_id, result.employee_name)}
                        >
                          <Table.Cell>
                            <div>
                              <div className="font-medium">{result.employee_name}</div>
                              <div className="text-sm text-gray-500">{result.employee_code}</div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>{formatCurrency(result.base_salary)}</Table.Cell>
                          <Table.Cell className="text-blue-600">
                            {formatCurrency(result.expected_base_salary)}
                          </Table.Cell>
                          <Table.Cell className="text-green-600 font-medium">
                            <div className="relative group inline-block">
                              <span className="cursor-help">{formatCurrency(result.actual_earned_base)}</span>
                              {result.earnings_by_source && (
                                <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block w-64 p-3 bg-white border border-gray-200 text-xs rounded-lg shadow-xl">
                                  <div className="font-semibold mb-2 text-gray-800 border-b border-gray-200 pb-1.5">Earnings Breakdown</div>
                                  <div className="space-y-1.5">
                                    {result.earnings_by_source.attendance.earned > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Work Hours:</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(result.earnings_by_source.attendance.earned)}</span>
                                      </div>
                                    )}
                                    {result.earnings_by_source.paid_leaves.earned > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Paid Time Off:</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(result.earnings_by_source.paid_leaves.earned)}</span>
                                      </div>
                                    )}
                                    {result.earnings_by_source.live_session.earned > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Active Session:</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(result.earnings_by_source.live_session.earned)}</span>
                                      </div>
                                    )}
                                    {result.earnings_by_source.overtime && result.earnings_by_source.overtime.earned > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Overtime ({result.earnings_by_source.overtime.minutes}min):</span>
                                        <span className="font-medium text-red-600">{formatCurrency(result.earnings_by_source.overtime.earned)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {result.attendance_shortfall > 0 ? (
                              <div className="relative group inline-block">
                                <span className="text-orange-600 font-medium cursor-help">
                                  {formatCurrency(result.attendance_shortfall)}
                                </span>
                                {result.shortfall_by_cause && (
                                  <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block w-64 p-3 bg-white border border-gray-200 text-xs rounded-lg shadow-xl">
                                    <div className="font-semibold mb-2 text-gray-800 border-b border-gray-200 pb-1.5">Shortfall Breakdown</div>
                                    <div className="space-y-1.5">
                                      {result.shortfall_by_cause.unpaid_time_off.deduction > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Unpaid Time Off:</span>
                                          <span className="font-medium text-gray-900">{formatCurrency(result.shortfall_by_cause.unpaid_time_off.deduction)}</span>
                                        </div>
                                      )}
                                      {result.shortfall_by_cause.time_variance.deduction > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Time Variance:</span>
                                          <span className="font-medium text-gray-900">{formatCurrency(result.shortfall_by_cause.time_variance.deduction)}</span>
                                        </div>
                                      )}
                                      {result.shortfall_by_cause.absent_days.deduction > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Absent Days:</span>
                                          <span className="font-medium text-gray-900">{formatCurrency(result.shortfall_by_cause.absent_days.deduction)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {result.total_earnings > 0 ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); openModal(result, 'allowances'); }}
                                className="text-green-600 hover:text-green-700 hover:underline cursor-pointer font-medium"
                                disabled={!hasAllowances}
                              >
                                {formatCurrency(result.total_earnings)}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </Table.Cell>
                          <Table.Cell className="font-medium text-blue-600">
                            {formatCurrency(result.gross_salary)}
                          </Table.Cell>
                          <Table.Cell>
                            {result.deductions_total > 0 ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); openModal(result, 'deductions'); }}
                                className="text-red-600 hover:text-red-700 hover:underline cursor-pointer font-medium"
                                disabled={!hasDeductions}
                              >
                                {formatCurrency(result.deductions_total)}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </Table.Cell>
                          <Table.Cell className="font-bold text-purple-600">
                            {formatCurrency(result.net_salary)}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={9} className="text-center py-8 text-gray-500">
                        No employee records found.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Showing {(page - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(page * itemsPerPage, calculatedResults.length)} of{' '}
                  {calculatedResults.length} employees
                </div>
                <div className="flex gap-2">
                  <Button size="sm" color="gray" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">Page {page} of {totalPages}</span>
                  <Button size="sm" color="gray" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============================
          PLACEHOLDER TABS
          ============================ */}
      {(activeTab === 'departments' || activeTab === 'advances' || activeTab === 'warnings') && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🚧</div>
            <h3 className="text-lg font-semibold text-gray-500">Coming Soon</h3>
            <p className="text-sm mt-1">
              The{' '}
              <span className="font-medium text-gray-600">
                {TABS.find(t => t.id === activeTab)?.label}
              </span>{' '}
              tab is under development.
            </p>
          </div>
        </Card>
      )}

      {/* ============================
          BREAKDOWN MODAL
          ============================ */}
      <Modal show={modalData.show} onClose={closeModal} size="2xl">
        <Modal.Header>
          {modalData.type === 'allowances' ? 'Allowances & Bonuses' : 'Deductions'} Breakdown
          {modalData.employee && (
            <div className="text-sm font-normal text-gray-500 mt-1">
              {modalData.employee.employee_name} ({modalData.employee.employee_code})
            </div>
          )}
        </Modal.Header>
        <Modal.Body>
          {modalData.employee && (
            <div className="space-y-6">
              {modalData.type === 'allowances' ? (
                <>
                  {modalData.employee.allowances_breakdown && modalData.employee.allowances_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-green-700 mb-3 border-b pb-2">Allowances</h3>
                      <div className="space-y-2">
                        {modalData.employee.allowances_breakdown.map((allowance, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-800">{allowance.name}</span>
                              {allowance.is_percentage && (
                                <Badge color="success" size="xs" className="ml-2">% of Base</Badge>
                              )}
                            </div>
                            <span className="text-green-700 font-bold text-lg">{formatCurrency(allowance.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-green-200">
                        <span className="font-semibold text-gray-700">Total Allowances:</span>
                        <span className="text-green-700 font-bold text-xl">{formatCurrency(modalData.employee.allowances_total)}</span>
                      </div>
                    </div>
                  )}

                  {modalData.employee.bonuses_breakdown && modalData.employee.bonuses_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-green-700 mb-3 border-b pb-2">Bonuses</h3>
                      <div className="space-y-2">
                        {modalData.employee.bonuses_breakdown.map((bonus, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <span className="font-medium text-gray-800">{bonus.description}</span>
                            <span className="text-green-700 font-bold text-lg">{formatCurrency(bonus.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-green-200">
                        <span className="font-semibold text-gray-700">Total Bonuses:</span>
                        <span className="text-green-700 font-bold text-xl">{formatCurrency(modalData.employee.bonuses_total)}</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-green-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Grand Total (Allowances + Bonuses):</span>
                      <span className="text-green-700 font-bold text-2xl">{formatCurrency(modalData.employee.total_earnings)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {modalData.employee.deductions_breakdown && modalData.employee.deductions_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-red-700 mb-3 border-b pb-2">Statutory Deductions</h3>
                      <div className="space-y-2">
                        {modalData.employee.deductions_breakdown.map((deduction, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-800">{deduction.name}</span>
                              <Badge color="failure" size="xs" className="ml-2">{deduction.category.toUpperCase()}</Badge>
                            </div>
                            <span className="text-red-700 font-bold text-lg">{formatCurrency(deduction.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {modalData.employee.financial_deductions_breakdown && modalData.employee.financial_deductions_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-red-700 mb-3 border-b pb-2">Financial Deductions</h3>
                      <div className="space-y-2">
                        {modalData.employee.financial_deductions_breakdown.map((deduction, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <div>
                              <Badge color="warning" size="xs">{deduction.type}</Badge>
                            </div>
                            <span className="text-red-700 font-bold text-lg">{formatCurrency(deduction.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-red-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Total Deductions:</span>
                      <span className="text-red-700 font-bold text-2xl">{formatCurrency(modalData.employee.deductions_total)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={closeModal}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* ============================
          DAILY WORK DETAILS MODAL
          ============================ */}
      <Modal show={dailyDetailsModal.show} onClose={closeDailyDetailsModal} size="4xl">
        <Modal.Header>
          Daily Work Details
          {dailyDetailsModal.employeeName && (
            <div className="text-sm font-normal text-gray-500 mt-1">{dailyDetailsModal.employeeName}</div>
          )}
        </Modal.Header>
        <Modal.Body>
          {dailyDetailsModal.loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="xl" />
              <span className="ml-3 text-lg">Loading daily details...</span>
            </div>
          ) : dailyDetailsModal.data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Total Working Days</p>
                  <p className="text-xl font-bold text-blue-700">{dailyDetailsModal.data.summary.total_working_days}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Minutes</p>
                  <p className="text-xl font-bold text-blue-700">
                    {dailyDetailsModal.data.summary.total_working_minutes.toLocaleString()} mins
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-xl font-bold text-blue-700">
                    {dailyDetailsModal.data.summary.total_working_hours.toFixed(2)} hrs
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Salary Earned</p>
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(dailyDetailsModal.data.summary.total_salary_earned)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <Table>
                  <Table.Head>
                    <Table.HeadCell>Date</Table.HeadCell>
                    <Table.HeadCell>Day Type</Table.HeadCell>
                    <Table.HeadCell>Check In</Table.HeadCell>
                    <Table.HeadCell>Check Out</Table.HeadCell>
                    <Table.HeadCell>Working Minutes</Table.HeadCell>
                    <Table.HeadCell>Daily Salary</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {dailyDetailsModal.data.daily_records.length > 0 ? (
                      dailyDetailsModal.data.daily_records.map((record: any, index: number) => (
                        <Table.Row key={index} className="hover:bg-gray-50">
                          <Table.Cell className="font-medium">
                            {new Date(record.date).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              color={
                                record.day_type === 'Sunday' ? 'failure' :
                                record.day_type === 'Saturday' ? 'warning' : 'info'
                              }
                            >
                              {record.day_type}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell className="text-sm">{record.check_in || '-'}</Table.Cell>
                          <Table.Cell className="text-sm">{record.check_out || '-'}</Table.Cell>
                          <Table.Cell className="text-blue-600 font-medium">
                            {record.working_minutes.toLocaleString()} mins
                            <div className="text-xs text-gray-500">({record.working_hours} hrs)</div>
                            {record.overtime_minutes > 0 && (
                              <div className="text-xs text-red-600 font-medium">+{record.overtime_minutes} OT mins</div>
                            )}
                          </Table.Cell>
                          <Table.Cell className="text-green-600 font-bold">
                            {formatCurrency(record.daily_salary)}
                            {record.overtime_amount > 0 && (
                              <div className="text-xs text-red-600 font-medium">+{formatCurrency(record.overtime_amount)} OT</div>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              color={
                                record.status === 'present' ? 'success' :
                                record.status === 'late' ? 'warning' :
                                record.status === 'absent' ? 'failure' : 'info'
                              }
                            >
                              {record.status}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    ) : (
                      <Table.Row>
                        <Table.Cell colSpan={7} className="text-center py-8 text-gray-500">
                          No attendance records found for this period.
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
              </div>

              <div className="text-sm text-gray-600 border-t pt-4">
                <p className="flex items-center gap-2">
                  <strong>Payroll Period:</strong>{' '}
                  {new Date(dailyDetailsModal.data.period.start_date).toLocaleDateString()} -{' '}
                  {new Date(dailyDetailsModal.data.period.end_date).toLocaleDateString()}
                  {dailyDetailsModal.data.period.uses_custom_cycle && (
                    <Badge color="warning" size="sm">Custom Cycle</Badge>
                  )}
                </p>
                <p className="mt-1">
                  <strong>Base Salary:</strong> {formatCurrency(dailyDetailsModal.data.employee.base_salary)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No data available</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={closeDailyDetailsModal}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LivePayrollDashboard;
