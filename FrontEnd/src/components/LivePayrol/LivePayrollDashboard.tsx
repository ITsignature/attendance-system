// =============================================
// LIVE PAYROLL DASHBOARD (Optimized Frontend Calculation)
// =============================================
// Calculates payroll in the browser - 100x faster!
// Updates every 30 seconds with live session data

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Card, Alert, Spinner, Button, Badge, Modal } from "flowbite-react";
import { payrollRunApiService } from '../../services/payrollRunService';
import { livePayrollCalculationService, type CalculatedPayroll, type EmployeeData, type UnpaidTimeOffDetail, type TimeVarianceDetail, type AbsentDayDetail, type PaidLeaveDetail } from '../../services/livePayrollCalculationService';
import { HiRefresh, HiClock, HiUsers, HiArrowLeft, HiDownload } from 'react-icons/hi';
import { exportLivePayrollToExcel } from '../../services/payrollExcelExport';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const itemsPerPage = 20;
  const [modalData, setModalData] = useState<{
    show: boolean;
    employee: CalculatedPayroll | null;
    type: 'allowances' | 'deductions' | null;
  }>({ show: false, employee: null, type: null });

  const [payslipModal, setPayslipModal] = useState<{
    show: boolean;
    employee: CalculatedPayroll | null;
  }>({ show: false, employee: null });
  const [payslipDownloading, setPayslipDownloading] = useState(false);
  const payslipContentRef = useRef<HTMLDivElement>(null);

  const [dailyDetailsModal, setDailyDetailsModal] = useState<{
    show: boolean;
    loading: boolean;
    employeeId: string | null;
    employeeName: string | null;
    data: any | null;
  }>({ show: false, loading: false, employeeId: null, employeeName: null, data: null });

  const [shortfallModal, setShortfallModal] = useState<{
    show: boolean;
    employee: CalculatedPayroll | null;
  }>({ show: false, employee: null });

  const openShortfallModal = (e: React.MouseEvent, employee: CalculatedPayroll) => {
    e.stopPropagation();
    setShortfallModal({ show: true, employee });
  };

  const closeShortfallModal = () => {
    setShortfallModal({ show: false, employee: null });
  };

  const [earningsModal, setEarningsModal] = useState<{
    show: boolean;
    employee: CalculatedPayroll | null;
  }>({ show: false, employee: null });

  const openEarningsModal = (e: React.MouseEvent, employee: CalculatedPayroll) => {
    e.stopPropagation();
    setEarningsModal({ show: true, employee });
  };

  const closeEarningsModal = () => {
    setEarningsModal({ show: false, employee: null });
  };

  const formatHours = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExportExcel = async () => {
    if (!rawData || calculatedResults.length === 0) return;
    await exportLivePayrollToExcel(
      calculatedResults,
      rawData.employees,
      { start_date: rawData.period.start_date, end_date: rawData.period.end_date },
      rawData.company || { name: '', address: '' }
    );
  };

  const openModal = (employee: CalculatedPayroll, type: 'allowances' | 'deductions') => {
    setModalData({ show: true, employee, type });
  };

  const closeModal = () => {
    setModalData({ show: false, employee: null, type: null });
  };

  const openPayslipModal = (e: React.MouseEvent, employee: CalculatedPayroll) => {
    e.stopPropagation();
    setPayslipModal({ show: true, employee });
  };

  const closePayslipModal = () => {
    setPayslipModal({ show: false, employee: null });
  };

  const handleDownloadPayslip = async () => {
    const node = payslipContentRef.current;
    const employee = payslipModal.employee;
    if (!node || !employee) return;

    try {
      setPayslipDownloading(true);

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = employee.employee_name.replace(/[^a-z0-9]+/gi, '_');
      const periodLabel = rawData?.period
        ? `${new Date(rawData.period.start_date).toISOString().slice(0, 10)}_${new Date(rawData.period.end_date).toISOString().slice(0, 10)}`
        : new Date().toISOString().slice(0, 10);

      pdf.save(`Payslip_${safeName}_${periodLabel}.pdf`);
    } catch (err) {
      console.error('Error generating payslip PDF:', err);
      setError('Failed to generate payslip PDF');
    } finally {
      setPayslipDownloading(false);
    }
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

      // Fetch raw data from backend (ALL employees in one call)
      const response = await payrollRunApiService.getLivePayrollData(runId);

      const fetchTime = performance.now() - startTime;
      console.log(`✅ Data fetched in ${fetchTime.toFixed(0)}ms`);

      if (response.success && response.data) {
        // Store raw data
        setRawData(response.data);

        // Calculate payroll in browser (INSTANT!)
        const calcStartTime = performance.now();
        const results = livePayrollCalculationService.calculateAllEmployees(
          response.data.employees as EmployeeData[]
        );
        const calcTime = performance.now() - calcStartTime;

        console.log(`⚡ Calculated ${results.length} employees in ${calcTime.toFixed(0)}ms`);
        console.log(`📈 Total time: ${(fetchTime + calcTime).toFixed(0)}ms`);

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

    // Recalculate using existing data (NO API CALL - INSTANT!)
    const results = livePayrollCalculationService.calculateAllEmployees(
      rawData.employees as EmployeeData[]
    );

    const calcTime = performance.now() - startTime;
    console.log(`✅ Recalculated ${results.length} employees in ${calcTime.toFixed(0)}ms`);
    
    console.log("new updates",results)

    setCalculatedResults(results);

    setLastCalculated(new Date());
  }, [rawData]);

  // =============================================
  // LIFECYCLE
  // =============================================
  // Load data on mount
  useEffect(() => {
    loadAndCalculate();
  }, [loadAndCalculate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh triggered');
      recalculate();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, recalculate]);

  // =============================================
  // CALCULATIONS & FORMATTING
  // =============================================

  const formatCurrency = (amount: number | null | undefined) => {
    const value = amount ?? 0;
    return `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTotalStats = () => {
    return {
      totalEmployees: calculatedResults.length,
      totalGross: calculatedResults.reduce((sum, r) => sum + (r.gross_salary ?? 0), 0),
      totalDeductions: calculatedResults.reduce((sum, r) => sum + (r.deductions_total ?? 0), 0),
      totalNet: calculatedResults.reduce((sum, r) => sum + (r.net_salary ?? 0), 0),
      totalAllowances: calculatedResults.reduce((sum, r) => sum + (r.allowances_total ?? 0), 0),
      totalBonuses: calculatedResults.reduce((sum, r) => sum + (r.bonuses_total ?? 0), 0),
      totalShortfall: calculatedResults.reduce((sum, r) => sum + (r.attendance_shortfall ?? 0), 0)
    };
  };

  const stats = getTotalStats();

  // Pagination
  const totalPages = Math.ceil(calculatedResults.length / itemsPerPage);
  const paginatedResults = calculatedResults.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // =============================================
  // RENDER
  // =============================================

  if (loading && !rawData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
        <span className="ml-3 text-lg">Loading payroll data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            color="gray"
            size="sm"
            onClick={() => navigate('/payroll')}
          >
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
          <Button
            color="gray"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button
            color="blue"
            size="sm"
            onClick={recalculate}
          >
            <HiRefresh className="w-4 h-4 mr-2" />
            Recalculate Now
          </Button>
          <Button
            color="purple"
            size="sm"
            onClick={loadAndCalculate}
          >
            Refresh Data
          </Button>
          <Button
            color="green"
            size="sm"
            onClick={handleExportExcel}
            disabled={!rawData || calculatedResults.length === 0}
          >
            <HiDownload className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <HiUsers className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold">{stats.totalEmployees}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Total Gross</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(stats.totalGross)}
            </p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Total Deductions</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(stats.totalDeductions)}
            </p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Total Net</p>
            <p className="text-xl font-bold text-purple-600">
              {formatCurrency(stats.totalNet)}
            </p>
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div>
            <p className="text-sm text-gray-500">💰 Total Allowances</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(stats.totalAllowances)}
            </p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">⚠️ Total Shortfall</p>
            <p className="text-lg font-bold text-orange-600">
              {formatCurrency(stats.totalShortfall)}
            </p>
          </div>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Employee</Table.HeadCell>
              <Table.HeadCell>Base Salary</Table.HeadCell>
              {/* <Table.HeadCell>Expected Base</Table.HeadCell> */}
              <Table.HeadCell>Actual Earned</Table.HeadCell>
              <Table.HeadCell>Shortfall</Table.HeadCell>
              <Table.HeadCell>Allowances</Table.HeadCell>
              <Table.HeadCell>Gross Salary</Table.HeadCell>
              <Table.HeadCell>Deductions</Table.HeadCell>
              <Table.HeadCell>Net Salary</Table.HeadCell>
              <Table.HeadCell>Payslip</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {paginatedResults.length > 0 ? (
                paginatedResults.map(result => {
                  const hasAllowances = (result.allowances_breakdown && result.allowances_breakdown.length > 0) ||
                                       (result.bonuses_breakdown && result.bonuses_breakdown.length > 0);
                  const hasDeductions = (result.deductions_breakdown && result.deductions_breakdown.length > 0) ||
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
                          <div className="text-sm text-gray-500">
                            {result.employee_code}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>{formatCurrency(result.base_salary)}</Table.Cell>
                      {/* <Table.Cell className="text-blue-600">
                        {formatCurrency(result.expected_base_salary)}
                      </Table.Cell> */}
                      <Table.Cell className="text-green-600 font-medium">
                        <button
                          onClick={(e) => openEarningsModal(e, result)}
                          className="text-green-600 hover:text-green-700 hover:underline cursor-pointer font-medium"
                        >
                          {formatCurrency(result.actual_earned_base)}
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        {result.attendance_shortfall > 0 ? (
                          <button
                            onClick={(e) => openShortfallModal(e, result)}
                            className="text-orange-600 hover:text-orange-700 hover:underline cursor-pointer font-medium"
                          >
                            {formatCurrency(result.attendance_shortfall)}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {result.total_earnings > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(result, 'allowances');
                            }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(result, 'deductions');
                            }}
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
                      <Table.Cell>
                        <button
                          onClick={(e) => openPayslipModal(e, result)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-150 whitespace-nowrap shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Payslip
                        </button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={10} className="text-center py-8 text-gray-500">
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
              Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, calculatedResults.length)} of {calculatedResults.length} employees
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                color="gray"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                color="gray"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Info Footer */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          ⚡ <strong>Lightning Fast:</strong> All calculations are performed in your browser in real-time.
          Use the "Recalculate Now" button to refresh data, or enable auto-refresh for updates every 30 seconds.
          This is a preview only - click "Calculate" button in the main dashboard to save to database.
        </p>
      </div>

      {/* Breakdown Modal */}
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
                  {/* Allowances Section */}
                  {modalData.employee.allowances_breakdown && modalData.employee.allowances_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-green-700 mb-3 border-b pb-2">Allowances</h3>
                      <div className="space-y-2">
                        {modalData.employee.allowances_breakdown.map((allowance, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-800">{allowance.name}</span>
                              {allowance.is_percentage && (
                                <Badge color="success" size="xs" className="ml-2">
                                  % of Base
                                </Badge>
                              )}
                            </div>
                            <span className="text-green-700 font-bold text-lg">
                              {formatCurrency(allowance.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-green-200">
                        <span className="font-semibold text-gray-700">Total Allowances:</span>
                        <span className="text-green-700 font-bold text-xl">
                          {formatCurrency(modalData.employee.allowances_total)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bonuses Section */}
                  {modalData.employee.bonuses_breakdown && modalData.employee.bonuses_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-green-700 mb-3 border-b pb-2">Bonuses</h3>
                      <div className="space-y-2">
                        {modalData.employee.bonuses_breakdown.map((bonus, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <span className="font-medium text-gray-800">{bonus.description}</span>
                            <span className="text-green-700 font-bold text-lg">
                              {formatCurrency(bonus.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-green-200">
                        <span className="font-semibold text-gray-700">Total Bonuses:</span>
                        <span className="text-green-700 font-bold text-xl">
                          {formatCurrency(modalData.employee.bonuses_total)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="bg-green-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Grand Total (Allowances + Bonuses):</span>
                      <span className="text-green-700 font-bold text-2xl">
                        {formatCurrency(modalData.employee.total_earnings)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Statutory Deductions */}
                  {modalData.employee.deductions_breakdown && modalData.employee.deductions_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-red-700 mb-3 border-b pb-2">Statutory Deductions</h3>
                      <div className="space-y-2">
                        {modalData.employee.deductions_breakdown.map((deduction, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-800">{deduction.name}</span>
                              <Badge color="failure" size="xs" className="ml-2">
                                {deduction.category.toUpperCase()}
                              </Badge>
                            </div>
                            <span className="text-red-700 font-bold text-lg">
                              {formatCurrency(deduction.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Deductions */}
                  {modalData.employee.financial_deductions_breakdown && modalData.employee.financial_deductions_breakdown.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-red-700 mb-3 border-b pb-2">Financial Deductions</h3>
                      <div className="space-y-2">
                        {modalData.employee.financial_deductions_breakdown.map((deduction, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <div>
                              <Badge color="warning" size="xs">
                                {deduction.type}
                              </Badge>
                            </div>
                            <span className="text-red-700 font-bold text-lg">
                              {formatCurrency(deduction.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="bg-red-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Total Deductions:</span>
                      <span className="text-red-700 font-bold text-2xl">
                        {formatCurrency(modalData.employee.deductions_total)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={closeModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Earnings Breakdown Modal */}
      <Modal show={earningsModal.show} onClose={closeEarningsModal} size="3xl">
        <Modal.Header>
          Earnings Breakdown
          {earningsModal.employee && (
            <div className="text-sm font-normal text-gray-500 mt-1">
              {earningsModal.employee.employee_name} ({earningsModal.employee.employee_code})
            </div>
          )}
        </Modal.Header>
        <Modal.Body className="space-y-6 max-h-[70vh] overflow-y-auto">
          {earningsModal.employee && (() => {
            const emp = earningsModal.employee!;
            const ebs = emp.earnings_by_source;
            const dailyRate = ebs?.non_working_day_credit?.breakdown?.daily_rate ?? 0;

            return (
              <>
                {/* Overtime Section */}
                {emp.overtime_records && emp.overtime_records.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                      Overtime
                      <span className="ml-auto text-red-600 font-medium">{formatCurrency(ebs?.overtime?.earned ?? 0)}</span>
                    </h3>
                    <div className="overflow-x-auto rounded border border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Date</th>
                            <th className="text-left px-3 py-2 font-medium">Day Type</th>
                            <th className="text-right px-3 py-2 font-medium">Pre-shift</th>
                            <th className="text-right px-3 py-2 font-medium">Post-shift</th>
                            <th className="text-right px-3 py-2 font-medium">Total</th>
                            <th className="text-right px-3 py-2 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {emp.overtime_records.filter(rec => rec.amount > 0).map((rec, i) => {
                            const isUnconfiguredSat = rec.date === 'unconfigured-saturday';
                            const isUnconfiguredSun = rec.date === 'unconfigured-sunday';
                            const dateLabel = isUnconfiguredSat
                              ? 'Non-working Saturdays (total)'
                              : isUnconfiguredSun
                              ? 'Non-working Sundays (total)'
                              : formatDate(rec.date);
                            const isAggregated = isUnconfiguredSat || isUnconfiguredSun;
                            return (
                              <tr key={i} className={isAggregated ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}>
                                <td className="px-3 py-2 text-gray-700 font-medium">{dateLabel}</td>
                                <td className="px-3 py-2 capitalize text-gray-600">{rec.day_type.replace(/_/g, ' ')}</td>
                                <td className="px-3 py-2 text-right text-gray-600">
                                  {isAggregated ? <span className="text-gray-300">—</span> : rec.pre_shift_enabled ? `${rec.pre_shift_minutes}m` : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600">
                                  {isAggregated ? <span className="text-gray-300">—</span> : rec.post_shift_enabled ? `${rec.post_shift_minutes}m` : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-gray-700">{rec.total_minutes}m</td>
                                <td className="px-3 py-2 text-right font-semibold text-red-600">{formatCurrency(rec.amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-red-50 border-t border-red-100">
                          <tr>
                            <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-red-700">Total Overtime</td>
                            <td className="px-3 py-2 text-right text-xs font-bold text-red-700">{formatCurrency(ebs?.overtime?.earned ?? 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Paid Time Off Section */}
                {ebs?.paid_leaves && ebs.paid_leaves.earned > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      Paid Time Off
                      <span className="ml-auto text-blue-600 font-medium">{formatCurrency(ebs.paid_leaves.earned)}</span>
                    </h3>
                    {ebs.paid_leaves.details && ebs.paid_leaves.details.length > 0 ? (
                      <div className="space-y-2">
                        {ebs.paid_leaves.details.map((leave, i) => (
                          <div key={i} className="bg-blue-50 rounded-lg p-3 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-700">
                                {leave.start_date === leave.end_date
                                  ? formatDate(leave.start_date)
                                  : `${formatDate(leave.start_date)} — ${formatDate(leave.end_date)}`}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {leave.duration_type === 'full_day' && 'Full Day'}
                                {leave.duration_type === 'half_day' && 'Half Day'}
                                {leave.duration_type === 'short_leave' && leave.short_leave_start && leave.short_leave_end
                                  ? `Short Leave (${leave.short_leave_start} – ${leave.short_leave_end})`
                                  : leave.duration_type === 'short_leave' ? 'Short Leave' : ''}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-gray-500">{formatHours(leave.hours)}</div>
                              <div className="text-sm font-semibold text-blue-700">{formatCurrency(leave.earned)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No leave detail breakdown available.</div>
                    )}
                  </div>
                )}

                {/* Non-Working Days Credit Section */}
                {ebs?.non_working_day_credit && ebs.non_working_day_credit.earned > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                      Non-Working Day Credit
                      <span className="ml-auto text-purple-600 font-medium">{formatCurrency(ebs.non_working_day_credit.earned)}</span>
                    </h3>
                    <div className="space-y-3">
                      {/* Holidays */}
                      {ebs.non_working_day_credit.dates?.holidays && ebs.non_working_day_credit.dates.holidays.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-1.5">
                            Holidays ({ebs.non_working_day_credit.dates.holidays.length})
                            <span className="ml-2 text-purple-600">{formatCurrency(ebs.non_working_day_credit.dates.holidays.length * dailyRate)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ebs.non_working_day_credit.dates.holidays.map((d, i) => (
                              <span key={i} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">{formatDate(d)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Non-working Saturdays */}
                      {ebs.non_working_day_credit.dates?.non_working_saturdays && ebs.non_working_day_credit.dates.non_working_saturdays.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-1.5">
                            Non-Working Saturdays ({ebs.non_working_day_credit.dates.non_working_saturdays.length})
                            <span className="ml-2 text-purple-600">{formatCurrency(ebs.non_working_day_credit.dates.non_working_saturdays.length * dailyRate)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ebs.non_working_day_credit.dates.non_working_saturdays.map((d, i) => (
                              <span key={i} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">{formatDate(d)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Non-working Sundays */}
                      {ebs.non_working_day_credit.dates?.non_working_sundays && ebs.non_working_day_credit.dates.non_working_sundays.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-1.5">
                            Non-Working Sundays ({ebs.non_working_day_credit.dates.non_working_sundays.length})
                            <span className="ml-2 text-purple-600">{formatCurrency(ebs.non_working_day_credit.dates.non_working_sundays.length * dailyRate)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ebs.non_working_day_credit.dates.non_working_sundays.map((d, i) => (
                              <span key={i} className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full font-medium">{formatDate(d)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Attendance (Work Hours) section */}
                {ebs?.attendance && ebs.attendance.earned > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                      Work Hours Earned
                      <span className="ml-auto text-green-600 font-medium">{formatCurrency(ebs.attendance.earned)}</span>
                    </h3>
                    <p className="text-xs text-gray-500">{formatHours(ebs.attendance.hours)} of attended time</p>
                  </div>
                )}
              </>
            );
          })()}
        </Modal.Body>
        <Modal.Footer className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">
            Total Actual Earned:
            <span className="ml-2 text-green-600 text-base">{earningsModal.employee ? formatCurrency(earningsModal.employee.actual_earned_base) : ''}</span>
          </div>
          <Button color="gray" onClick={closeEarningsModal}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Shortfall Breakdown Modal */}
      <Modal show={shortfallModal.show} onClose={closeShortfallModal} size="2xl">
        <Modal.Header>
          Shortfall Breakdown
          {shortfallModal.employee && (
            <div className="text-sm font-normal text-gray-500 mt-1">
              {shortfallModal.employee.employee_name} ({shortfallModal.employee.employee_code})
            </div>
          )}
        </Modal.Header>
        <Modal.Body>
          {shortfallModal.employee?.shortfall_by_cause && (() => {
            const sbc = shortfallModal.employee.shortfall_by_cause!;
            return (
              <div className="space-y-5">

                {/* Time Variance */}
                {sbc.time_variance.deduction > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                      <h3 className="text-base font-semibold text-orange-700">Late Arrivals / Early Departures</h3>
                      <span className="text-orange-700 font-bold">{formatCurrency(sbc.time_variance.deduction)}</span>
                    </div>
                    {sbc.time_variance.details && sbc.time_variance.details.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 text-xs border-b">
                              <th className="pb-2 font-medium">Date</th>
                              <th className="pb-2 font-medium text-right">Expected</th>
                              <th className="pb-2 font-medium text-right">Actual</th>
                              <th className="pb-2 font-medium text-right">Shortfall</th>
                              <th className="pb-2 font-medium text-right">Deduction</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sbc.time_variance.details.map((d: TimeVarianceDetail, i: number) => (
                              <tr key={i} className="py-1.5">
                                <td className="py-1.5 text-gray-700">{formatDate(d.date)}</td>
                                <td className="py-1.5 text-right text-gray-600">{formatHours(d.expected_hours)}</td>
                                <td className="py-1.5 text-right text-gray-600">{formatHours(d.actual_hours)}</td>
                                <td className="py-1.5 text-right text-orange-600 font-medium">{formatHours(d.shortfall_hours)}</td>
                                <td className="py-1.5 text-right text-red-600 font-semibold">{formatCurrency(d.deduction)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No per-day detail available (recalculate to get details).</p>
                    )}
                  </div>
                )}

                {/* Unpaid Time Off */}
                {sbc.unpaid_time_off.deduction > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                      <h3 className="text-base font-semibold text-orange-700">Unpaid Time Off</h3>
                      <span className="text-orange-700 font-bold">{formatCurrency(sbc.unpaid_time_off.deduction)}</span>
                    </div>
                    {sbc.unpaid_time_off.details && sbc.unpaid_time_off.details.length > 0 ? (
                      <div className="space-y-2">
                        {sbc.unpaid_time_off.details.map((d: UnpaidTimeOffDetail, i: number) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-800 text-sm">
                                {d.start_date === d.end_date ? formatDate(d.start_date) : `${formatDate(d.start_date)} – ${formatDate(d.end_date)}`}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {d.duration_type === 'full_day' && 'Full Day'}
                                {d.duration_type === 'half_day' && 'Half Day'}
                                {d.duration_type === 'short_leave' && `Short Leave${d.short_leave_start && d.short_leave_end ? ` (${d.short_leave_start} – ${d.short_leave_end})` : ''}`}
                                {' · '}{formatHours(d.hours)}
                              </div>
                            </div>
                            <span className="text-red-600 font-semibold">{formatCurrency(d.deduction)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No per-leave detail available (recalculate to get details).</p>
                    )}
                  </div>
                )}

                {/* Absent Days */}
                {sbc.absent_days.deduction > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                      <h3 className="text-base font-semibold text-red-700">Absent Days</h3>
                      <span className="text-red-700 font-bold">{formatCurrency(sbc.absent_days.deduction)}</span>
                    </div>
                    {sbc.absent_days.details && sbc.absent_days.details.length > 0 ? (
                      <div className="space-y-2">
                        {sbc.absent_days.details.map((d: AbsentDayDetail, i: number) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <span className="text-gray-800 text-sm font-medium">{formatDate(d.date)}</span>
                            <span className="text-red-600 font-semibold">{formatCurrency(d.deduction)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No per-day detail available (recalculate to get details).</p>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="bg-orange-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gray-800">Total Shortfall:</span>
                    <span className="text-orange-700 font-bold text-xl">{formatCurrency(shortfallModal.employee!.attendance_shortfall)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={closeShortfallModal}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Daily Work Details Modal */}
      <Modal show={dailyDetailsModal.show} onClose={closeDailyDetailsModal} size="4xl">
        <Modal.Header>
          Daily Work Details
          {dailyDetailsModal.employeeName && (
            <div className="text-sm font-normal text-gray-500 mt-1">
              {dailyDetailsModal.employeeName}
            </div>
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
                  <p className="text-xl font-bold text-green-700">{formatCurrency(dailyDetailsModal.data.summary.total_salary_earned)}</p>
                </div>
              </div>

              {/* Daily Records Table */}
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
                      dailyDetailsModal.data.daily_records.map((record: any, index: number) => {
                        const isAbsent = record.record_type === 'absent';
                        const isLeave = record.record_type === 'leave';
                        const isHoliday = record.record_type === 'holiday';
                        const isWeekendOff = record.record_type === 'weekend_off';
                        const isUnscheduledWeekend = record.day_type === 'Saturday (Unscheduled)' || record.day_type === 'Sunday (Unscheduled)';

                        const rowBg = isAbsent ? 'bg-red-50 dark:bg-red-900/10' :
                                      isLeave && record.is_paid_leave ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                                      isLeave && !record.is_paid_leave ? 'bg-orange-50 dark:bg-orange-900/10' :
                                      isHoliday ? 'bg-blue-50 dark:bg-blue-900/10' :
                                      isWeekendOff ? 'bg-gray-50 dark:bg-gray-800/50' : '';

                        const statusColor = record.status === 'present' ? 'success' :
                                            record.status === 'late' ? 'warning' :
                                            record.status === 'absent' ? 'failure' :
                                            record.status === 'paid_leave' ? 'warning' :
                                            record.status === 'unpaid_leave' ? 'pink' :
                                            record.status === 'holiday' ? 'info' :
                                            record.status === 'weekend_off' ? 'gray' : 'gray';

                        const statusLabel = record.status === 'paid_leave' ? 'Paid Leave' :
                                            record.status === 'unpaid_leave' ? 'Unpaid Leave' :
                                            record.status === 'holiday' ? 'Holiday' :
                                            record.status === 'weekend_off' ? 'Weekend Off' :
                                            record.status;

                        return (
                          <Table.Row key={index} className={`hover:brightness-95 ${rowBg}`}>
                            <Table.Cell className="font-medium">
                              {new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </Table.Cell>
                            <Table.Cell>
                              <Badge color={record.day_type === 'Sunday' || record.day_type === 'Sunday (Unscheduled)' ? 'failure' : record.day_type === 'Saturday' || record.day_type === 'Saturday (Unscheduled)' ? 'warning' : 'info'}>
                                {record.day_type}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell className="text-sm">{record.check_in || '-'}</Table.Cell>
                            <Table.Cell className="text-sm">{record.check_out || '-'}</Table.Cell>
                            <Table.Cell className="font-medium">
                              {isAbsent || isWeekendOff ? (
                                <span className="text-gray-400">—</span>
                              ) : isLeave ? (
                                <div>
                                  <span className="text-yellow-700 font-medium">{record.leave_type_name}</span>
                                  <div className="text-xs text-gray-500">{record.is_paid_leave ? 'Paid' : 'Unpaid'}</div>
                                </div>
                              ) : isHoliday ? (
                                <div>
                                  <span className="text-blue-700 font-medium">{record.holiday_name}</span>
                                </div>
                              ) : isUnscheduledWeekend ? (
                                <span className="text-red-600 font-bold">
                                  {record.overtime_minutes.toLocaleString()} mins
                                  <div className="text-xs font-medium">({(record.overtime_minutes / 60).toFixed(2)} hrs)</div>
                                </span>
                              ) : (
                                <>
                                  <span className="text-blue-600">{record.working_minutes.toLocaleString()} mins</span>
                                  <div className="text-xs text-gray-500">({record.working_hours} hrs)</div>
                                  {record.overtime_minutes > 0 && <div className="text-xs text-red-600 font-medium">+{record.overtime_minutes} OT mins</div>}
                                </>
                              )}
                            </Table.Cell>
                            <Table.Cell className="font-bold">
                              {isAbsent ? (
                                <span className="text-red-500">Rs. 0.00</span>
                              ) : isWeekendOff ? (
                                <span className="text-gray-400">—</span>
                              ) : isHoliday ? (
                                <span className="text-blue-600">—</span>
                              ) : isLeave ? (
                                record.is_paid_leave ? (
                                  <span className="text-yellow-700">{formatCurrency(record.daily_salary)}</span>
                                ) : (
                                  <span className="text-orange-600">Rs. 0.00 <span className="text-xs font-normal">(Unpaid)</span></span>
                                )
                              ) : isUnscheduledWeekend ? (
                                <span className="text-red-600">{formatCurrency(record.overtime_amount)}</span>
                              ) : (
                                <>
                                  <span className="text-green-600">{formatCurrency(record.daily_salary)}</span>
                                  {record.overtime_amount > 0 && <div className="text-xs text-red-600 font-medium">+{formatCurrency(record.overtime_amount)} OT</div>}
                                </>
                              )}
                            </Table.Cell>
                            <Table.Cell>
                              <Badge color={statusColor as any}>{statusLabel}</Badge>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })
                    ) : (
                      <Table.Row>
                        <Table.Cell colSpan={7} className="text-center py-8 text-gray-500">
                          No records found for this period.
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
              </div>

              {/* Period Info */}
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
            <div className="text-center py-8 text-gray-500">
              No data available
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={closeDailyDetailsModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ============================================= */}
      {/* PAYSLIP MODAL                                  */}
      {/* ============================================= */}
      <Modal show={payslipModal.show} onClose={closePayslipModal} size="3xl">
        <Modal.Header>
          <div>
            <div className="text-lg font-bold">Live Payroll Preview</div>
            {payslipModal.employee && rawData?.period && (
              <div className="text-sm font-normal text-gray-500 mt-0.5">
                {new Date(rawData.period.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' '}&ndash;{' '}
                {new Date(rawData.period.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </Modal.Header>
        <Modal.Body>
          {payslipModal.employee && (() => {
            const emp = payslipModal.employee;
            const ebs = emp.earnings_by_source;
            const sbc = emp.shortfall_by_cause;
            const attendanceHours = ebs?.attendance?.hours ?? 0;
            const paidLeaveHours = ebs?.paid_leaves?.hours ?? 0;
            const liveSessionHours = ebs?.live_session?.hours ?? 0;
            const hasShortfall = sbc && (
              (sbc.unpaid_time_off?.deduction ?? 0) > 0 ||
              (sbc.time_variance?.deduction ?? 0) > 0 ||
              (sbc.absent_days?.deduction ?? 0) > 0
            );

            return (
              <div ref={payslipContentRef} className="space-y-6 text-sm bg-white p-2">

                {/* Employee Details */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 pb-1 border-b">Employee Details</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    <p><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-800">{emp.employee_name}</span></p>
                    <p><span className="text-gray-500">ID:</span> <span className="font-medium text-gray-800">{emp.employee_code}</span></p>
                    <p><span className="text-gray-500">Department:</span> <span className="font-medium text-gray-800">{emp.department_name}</span></p>
                  </div>
                </div>

                {/* Work Summary */}
                {ebs && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3">Work Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Worked Hours</p>
                        <p className="text-base font-semibold text-gray-800">{attendanceHours.toFixed(2)}</p>
                      </div>
                      {paidLeaveHours > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Paid Leave Hours</p>
                          <p className="text-base font-semibold text-green-600">{paidLeaveHours.toFixed(2)}</p>
                        </div>
                      )}
                      {liveSessionHours > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Live Session Hours</p>
                          <p className="text-base font-semibold text-yellow-600">{liveSessionHours.toFixed(2)}</p>
                        </div>
                      )}
                      {ebs.overtime && ebs.overtime.minutes > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Overtime</p>
                          <p className="text-base font-semibold text-blue-600">{(ebs.overtime.minutes / 60).toFixed(2)} hrs</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Salary Calculation */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 pb-1 border-b">Salary Calculation</h3>
                  <div className="space-y-3">

                    {/* Base Salary */}
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Base Salary (Full Month)</span>
                      <span className="font-medium text-gray-700">{formatCurrency(emp.base_salary)}</span>
                    </div>

                    {/* Shortfall Breakdown */}
                    {hasShortfall && (
                      <div className="ml-4 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                        <div className="font-medium text-orange-800 mb-2 text-xs uppercase tracking-wide">Salary Reduction (Shortfall)</div>
                        <div className="space-y-1.5">
                          {(sbc!.time_variance?.deduction ?? 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block"></span>
                                Late Arrivals &amp; Early Departures ({sbc!.time_variance.hours.toFixed(2)}h)
                              </span>
                              <span className="text-orange-700 font-medium">-{formatCurrency(sbc!.time_variance.deduction)}</span>
                            </div>
                          )}
                          {(sbc!.unpaid_time_off?.deduction ?? 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-orange-500 rounded-full inline-block"></span>
                                Unpaid Leaves ({sbc!.unpaid_time_off.hours.toFixed(2)}h)
                              </span>
                              <span className="text-orange-700 font-medium">-{formatCurrency(sbc!.unpaid_time_off.deduction)}</span>
                            </div>
                          )}
                          {(sbc!.absent_days?.deduction ?? 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-red-500 rounded-full inline-block"></span>
                                Absent Days
                              </span>
                              <span className="text-orange-700 font-medium">-{formatCurrency(sbc!.absent_days.deduction)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actual Base Earned */}
                    <div className="flex justify-between pt-1">
                      <span className="text-gray-600">Base Salary Earned</span>
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{formatCurrency(emp.actual_earned_base - emp.overtime_amount)}</span>
                    </div>

                    {/* Earnings from Work breakdown */}
                    <div className="ml-4 bg-green-50 border border-green-100 p-3 rounded-lg">
                      <div className="font-medium text-green-800 mb-2 text-xs uppercase tracking-wide">Earnings from Work</div>
                      <div className="space-y-1.5">
                        {emp.allowances_breakdown.map((a, i) => (
                          <div key={i} className="flex justify-between text-gray-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                              {a.name}{a.is_percentage ? ' (% of Base)' : ''}
                            </span>
                            <span>+{formatCurrency(a.amount)}</span>
                          </div>
                        ))}
                        {emp.bonuses_breakdown.map((b, i) => (
                          <div key={i} className="flex justify-between text-gray-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-teal-500 rounded-full inline-block"></span>
                              {b.description}
                            </span>
                            <span>+{formatCurrency(b.amount)}</span>
                          </div>
                        ))}
                        {ebs?.overtime && ebs.overtime.earned > 0 && (
                          <div className="flex justify-between text-gray-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                              Overtime ({ebs.overtime.minutes} mins)
                            </span>
                            <span>+{formatCurrency(ebs.overtime.earned)}</span>
                          </div>
                        )}
                        {(emp.allowances_breakdown.length === 0 && emp.bonuses_breakdown.length === 0 && !(ebs?.overtime?.earned)) && (
                          <div className="text-gray-400 italic text-xs">No additional earnings</div>
                        )}
                      </div>
                    </div>

                    {/* Gross Salary */}
                    <div className="flex justify-between pt-2 border-t-2 border-blue-600 font-semibold text-base">
                      <span>Gross Salary</span>
                      <span className="text-blue-600">{formatCurrency(emp.gross_salary)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 pb-1 border-b">Deductions (from Gross Salary)</h3>
                  <div className="space-y-2">
                    {emp.deductions_breakdown.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-600">{d.name} <span className="text-xs text-gray-400 uppercase ml-1">{d.category}</span></span>
                        <span className="font-medium text-red-600">-{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                    {emp.financial_deductions_breakdown.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-600">{d.description}</span>
                        <span className="font-medium text-red-600">-{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                    {(emp.deductions_breakdown.length === 0 && emp.financial_deductions_breakdown.length === 0) && (
                      <div className="text-gray-400 italic">No deductions</div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Total Deductions</span>
                      <span className="text-red-600">-{formatCurrency(emp.deductions_total)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Salary */}
                <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-800">Net Salary</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(emp.net_salary)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">Status:</span>{' '}
                      <span className="capitalize text-blue-600 font-medium">Live Preview</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-medium text-gray-600">Calculated:</span>{' '}
                      {lastCalculated.toLocaleString()}
                    </p>
                  </div>
                </div>

              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="blue"
            onClick={handleDownloadPayslip}
            disabled={payslipDownloading || !payslipModal.employee}
          >
            {payslipDownloading ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <HiDownload className="w-4 h-4 mr-2" />
            )}
            {payslipDownloading ? 'Generating...' : 'Download Payslip'}
          </Button>
          <Button color="gray" onClick={closePayslipModal}>Close</Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default LivePayrollDashboard;
