import React from 'react';
import type { CalculatedPayroll } from '../../services/livePayrollCalculationService';

interface PeriodInfo {
  start_date: string;
  end_date: string;
}

export const isGemsQualityLanka = (
  clientId?: string | null,
  clientName?: string | null,
  companyName?: string | null
): boolean => {
  const GEMS_CLIENT_ID = '77d09c86-0d4d-11f1-a5e0-0050565d0e2b'.toLowerCase();

  if (clientId && clientId.trim().toLowerCase() === GEMS_CLIENT_ID) return true;
  if (clientName && clientName.toLowerCase().includes('gems quality')) return true;
  if (companyName && companyName.toLowerCase().includes('gems quality')) return true;

  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.clientId && user.clientId.trim().toLowerCase() === GEMS_CLIENT_ID) return true;
      if (user.clientName && user.clientName.toLowerCase().includes('gems quality')) return true;
    }
  } catch {}

  return false;
};

interface PayslipCardProps {
  employee: CalculatedPayroll;
  period?: PeriodInfo | null;
  lastCalculated?: Date;
  /** Multiplies every font-size/spacing value (1 = natural size). Used by bulk export to
   *  shrink dense payslips to fit a fixed grid cell via real reflow (not CSS transform:
   *  scale, which html2canvas rasterizes incorrectly). */
  fontScale?: number;
  /** Company name from system settings, shown as the card title. */
  companyName?: string;
  /** Company address from system settings. */
  companyAddress?: string;
  /** Company logo (Data URL or image path) from system settings. */
  companyLogo?: string;
  /** Explicit override for Gems Quality Lanka custom format */
  isGemsQuality?: boolean;
  /** Configured payroll components to identify earning components (e.g. test) */
  payrollComponents?: Array<{ id?: string; component_name?: string; component_type?: string }>;
}

const formatCurrency = (amount: number | null | undefined) => {
  const value = amount ?? 0;
  return `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Mirrors the "PAYSLIP MODAL" content in LivePayrollDashboard.tsx (same sections/order).
//
// IMPORTANT rendering constraints (learned the hard way from html2canvas rasterization bugs):
// - Never size a flex row via `line-height` alone - html2canvas resolves flex-row height from
//   font metrics rather than the box's real computed height, so consecutive rows compress
//   into each other (boxes overlapping the row above, dividers clipping the last item).
// - Do NOT set `min-height` on rows without `box-sizing: border-box`.
// - Set explicit font-size on every text node - html2canvas doesn't always inherit font-size
//   properly across deeply-nested flex children.
// - Background colors on cards must be explicit hex codes (#ffffff), not CSS variables or `bg-white`.
// - Dividers: always use a dedicated `<div style={{ height: '1px', background: ... }} />` on its
//   own line, not to the parent box.
const PayslipCard: React.FC<PayslipCardProps> = ({ employee: emp, period, lastCalculated, fontScale = 1, companyName, companyAddress, companyLogo, isGemsQuality, payrollComponents }) => {
  // px(10) => `${10 * BASE_SCALE * fontScale}px`, applied to every size value below so the
  // whole card reflows proportionally instead of being post-scaled with CSS transform.
  const BASE_SCALE = 1.2;
  const px = (n: number) => `${n * BASE_SCALE * fontScale}px`;

  const isGems = isGemsQuality !== undefined ? isGemsQuality : isGemsQualityLanka(null, null, companyName);

  if (isGems) {
    const ebs = emp.earnings_by_source;

    const formatMonthYear = (p?: PeriodInfo | null) => {
      if (p?.start_date) {
        const d = new Date(p.start_date);
        if (!isNaN(d.getTime())) {
          const month = d.toLocaleDateString('en-US', { month: 'short' });
          const year = d.toLocaleDateString('en-US', { year: '2-digit' });
          return `${month}-${year}`;
        }
      }
      const now = new Date();
      return `${now.toLocaleDateString('en-US', { month: 'short' })}-${now.toLocaleDateString('en-US', { year: '2-digit' })}`;
    };

    const formatCellAmount = (val: number | null | undefined, showDashIfZero: boolean = true) => {
      if (val === null || val === undefined || (showDashIfZero && (val === 0 || Math.abs(val) < 0.005))) {
        return '-';
      }
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatPaymentCategory = (cat?: string) => {
      if (!cat) return 'Fixed Allowance';
      const lower = cat.toLowerCase();
      if (lower === 'allowance') return 'Fixed Allowance';
      if (lower === 'one_time_allowance') return 'One Time Allowance';
      if (lower === 'performance_incentive') return 'Performance Incentive';
      if (lower === 'salary_adjustment') return 'Salary Adjustment';
      return cat
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    // Earnings list
    const earningsList: Array<{ label: string; amount: number }> = [];
    earningsList.push({
      label: 'Basic Salary',
      amount: emp.base_salary || emp.expected_base_salary || 0,
    });

    const categoryMap = new Map<string, number>();
    const componentEarnings: Array<{ label: string; amount: number }> = [];

    const earningCompNames = new Set(
      (payrollComponents || [])
        .filter((c) => c.component_type === 'earning')
        .map((c) => c.component_name?.toLowerCase().trim())
        .filter(Boolean)
    );

    if (emp.allowances_breakdown && emp.allowances_breakdown.length > 0) {
      emp.allowances_breakdown.forEach((a) => {
        const isComp =
          (a as any).is_component === true ||
          a.payment_category === 'payroll_component' ||
          (a.id && (payrollComponents || []).some((c) => c.component_type === 'earning' && c.id === a.id)) ||
          (a.name && earningCompNames.has(a.name.toLowerCase().trim()));

        if (isComp) {
          componentEarnings.push({
            label: a.name,
            amount: a.amount || 0,
          });
        } else {
          const cat = a.payment_category || 'allowance';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + (a.amount || 0));
        }
      });
    } else if ((emp.allowances_total || 0) > 0) {
      categoryMap.set('allowance', emp.allowances_total);
    }

    categoryMap.forEach((amount, catKey) => {
      earningsList.push({
        label: formatPaymentCategory(catKey),
        amount,
      });
    });

    if (categoryMap.size === 0) {
      earningsList.push({
        label: 'Allowance',
        amount: 0,
      });
    }

    componentEarnings.forEach((item) => {
      earningsList.push(item);
    });

    if (emp.bonuses_breakdown && emp.bonuses_breakdown.length > 0) {
      emp.bonuses_breakdown.forEach((b) => {
        earningsList.push({
          label: b.description || 'Bonus',
          amount: b.amount || 0,
        });
      });
    }

    earningsList.push({
      label: 'Overtime Payment',
      amount: emp.overtime_amount || (ebs?.overtime?.earned || 0),
    });

    const totalAddition = Math.round(earningsList.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

    // Deductions list
    const deductionsList: Array<{ label: string; amount: number }> = [];
    const sc = emp.shortfall_by_cause;
    const noPayVal = sc
      ? ((sc.unpaid_time_off?.deduction || 0) + (sc.absent_days?.deduction || 0))
      : (emp.attendance_shortfall > 0 ? emp.attendance_shortfall : 0);

    deductionsList.push({
      label: 'No Pay',
      amount: noPayVal,
    });

    if (emp.financial_deductions_breakdown && emp.financial_deductions_breakdown.length > 0) {
      emp.financial_deductions_breakdown.forEach((fd) => {
        deductionsList.push({
          label: fd.description || (fd.type === 'advance' ? 'Salary Advance' : 'Loan Deduction'),
          amount: fd.amount || 0,
        });
      });
    }

    const hasApitInDeductions = emp.deductions_breakdown?.some(
      (d) => d.category?.toLowerCase() === 'tax' || d.name?.toLowerCase().includes('apit')
    );
    if (!hasApitInDeductions && (emp.apit || 0) > 0) {
      deductionsList.push({
        label: 'APIT',
        amount: emp.apit || 0,
      });
    }

    if (emp.deductions_breakdown && emp.deductions_breakdown.length > 0) {
      emp.deductions_breakdown.forEach((d) => {
        deductionsList.push({
          label: d.name,
          amount: d.amount || 0,
        });
      });
    }

    const lateEarlyVal = sc?.time_variance?.deduction || 0;
    deductionsList.push({
      label: 'Late / Early deduction',
      amount: lateEarlyVal,
    });

    const totalDeduction = Math.round(deductionsList.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

    const employeeEpfDeductions = (emp.deductions_breakdown || []).filter(
      (d) => d.category?.toLowerCase() === 'epf' || d.name?.toLowerCase().includes('epf')
    );
    const employeeEpfValue =
      employeeEpfDeductions.length > 0
        ? employeeEpfDeductions.reduce((sum, d) => sum + d.amount, 0)
        : (emp.epf_employee || 0);

    const epfBase = employeeEpfValue > 0
      ? (Math.abs(employeeEpfValue - ((emp.base_salary || 0) * 0.08)) < 1 ? (emp.base_salary || 0) : (employeeEpfValue / 0.08))
      : (emp.base_salary || 0);

    const epf12Val = employeeEpfValue > 0
      ? Math.round((epfBase / 100 * 12) * 100) / 100
      : (emp.base_salary ? Math.round((emp.base_salary / 100 * 12) * 100) / 100 : 0);

    const totalEpfVal = Math.round((epf12Val + employeeEpfValue) * 100) / 100;

    const etf3Val = employeeEpfValue > 0
      ? (emp.etf_employer ? emp.etf_employer : Math.round((epfBase / 100 * 3) * 100) / 100)
      : (emp.etf_employer ? emp.etf_employer : (emp.base_salary ? Math.round((emp.base_salary / 100 * 3) * 100) / 100 : 0));

    // Trainees are not entitled to EPF/ETF, so the statutory section is hidden for them
    const showStatutory = emp.employee_type !== 'trainee';

    const netSalary = totalAddition - totalDeduction;
    const maxRows = Math.max(earningsList.length, deductionsList.length);

    return (
      <div style={{ backgroundColor: '#ffffff', padding: `${px(12)} ${px(14)}`, fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: '#000000', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', paddingBottom: px(3) }}>
          {companyLogo && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: px(6) }}>
              <img
                src={companyLogo}
                alt="Company Logo"
                style={{ maxHeight: px(45), maxWidth: px(180), objectFit: 'contain' }}
                crossOrigin="anonymous"
              />
            </div>
          )}
          <div style={{ fontSize: px(12), fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px', margin: `${px(2)} 0` }}>
            {companyName || 'Company Name'}
          </div>
          {companyAddress && (
            <div style={{ fontSize: px(9), fontWeight: 600, color: '#111827', textTransform: 'uppercase', whiteSpace: 'pre-line', marginTop: px(2) }}>
              {companyAddress}
            </div>
          )}
          <div style={{ fontSize: px(10), fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '1px', marginTop: px(3) }}>
            SALARY SLIP
          </div>
          <div style={{ width: '100%', borderBottom: `${px(1.5)} solid #000000`, marginTop: px(6), marginBottom: px(10) }} />
        </div>

        {/* Table 1: Employee Information */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: 0, fontSize: px(8.5), lineHeight: '1.3' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #000000' }}>
              <td style={{ width: '45%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000' }}>Employee ID</td>
              <td style={{ width: '55%', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}` }}>{emp.employee_code || '-'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #000000' }}>
              <td style={{ width: '45%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000' }}>Employee Name</td>
              <td style={{ width: '55%', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}` }}>{emp.employee_name || '-'}</td>
            </tr>
            {showStatutory && (
            <tr style={{ borderBottom: '1px solid #000000' }}>
              <td style={{ width: '45%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000' }}>EPF No</td>
              <td style={{ width: '55%', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}` }}>{(emp as any).epf_no || (emp as any).epf_number || emp.employee_code || '-'}</td>
            </tr>
            )}
            <tr style={{ borderBottom: '1px solid #000000' }}>
              <td style={{ width: '45%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000' }}>Designation</td>
              <td style={{ width: '55%', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}` }}>{emp.designation_name || (emp as any).designation_title || (emp as any).designation || emp.department_name || '-'}</td>
            </tr>
            <tr>
              <td style={{ width: '45%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000' }}>Month &amp; Year</td>
              <td style={{ width: '55%', fontWeight: 700, textAlign: 'center', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}` }}>{formatMonthYear(period)}</td>
            </tr>
          </tbody>
        </table>

        {/* Table 2: Earnings & Deductions */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', borderTop: 'none', fontSize: px(8.5), lineHeight: '1.3' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000000' }}>
              <th colSpan={2} style={{ width: '50%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, borderRight: '1px solid #000000' }}>
                Earnings
              </th>
              <th colSpan={2} style={{ width: '50%', backgroundColor: '#e5e7eb', fontWeight: 700, textAlign: 'center', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}` }}>
                Deduction
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, idx) => {
              const earn = earningsList[idx];
              const ded = deductionsList[idx];
              const earnLen = earningsList.length;
              const dedLen = deductionsList.length;

              let renderEarnCells: React.ReactNode = null;
              if (idx < earnLen) {
                renderEarnCells = (
                  <>
                    <td style={{ width: '32%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000', borderBottom: '1px solid #000000', verticalAlign: 'middle' }}>
                      {earn?.label || ''}
                    </td>
                    <td style={{ width: '18%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, textAlign: 'right', borderRight: '1px solid #000000', borderBottom: '1px solid #000000', verticalAlign: 'middle' }}>
                      {earn ? formatCellAmount(earn.amount, false) : ''}
                    </td>
                  </>
                );
              } else if (idx === earnLen && dedLen > earnLen) {
                renderEarnCells = (
                  <td
                    colSpan={2}
                    rowSpan={dedLen - earnLen}
                    style={{ width: '50%', borderRight: '1px solid #000000', backgroundColor: '#ffffff' }}
                  />
                );
              }

              let renderDedCells: React.ReactNode = null;
              if (idx < dedLen) {
                renderDedCells = (
                  <>
                    <td style={{ width: '32%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000', borderBottom: '1px solid #000000', verticalAlign: 'middle' }}>
                      {ded?.label || ''}
                    </td>
                    <td style={{ width: '18%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, textAlign: 'right', borderBottom: '1px solid #000000', verticalAlign: 'middle' }}>
                      {ded ? formatCellAmount(ded.amount, true) : ''}
                    </td>
                  </>
                );
              } else if (idx === dedLen && earnLen > dedLen) {
                renderDedCells = (
                  <td
                    colSpan={2}
                    rowSpan={earnLen - dedLen}
                    style={{ width: '50%', backgroundColor: '#ffffff' }}
                  />
                );
              }

              return (
                <tr key={idx} style={{ minHeight: px(16) }}>
                  {renderEarnCells}
                  {renderDedCells}
                </tr>
              );
            })}

            {/* Total Row */}
            <tr style={{ borderBottom: '1px solid #000000', borderTop: '1px solid #000000', backgroundColor: '#e5e7eb', fontWeight: 700 }}>
              <td style={{ width: '32%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, borderRight: '1px solid #000000' }}>Total Addition</td>
              <td style={{ width: '18%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, textAlign: 'right', borderRight: '1px solid #000000' }}>
                {formatCellAmount(totalAddition, false)}
              </td>
              <td style={{ width: '32%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, borderRight: '1px solid #000000' }}>Total Deduction</td>
              <td style={{ width: '18%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, textAlign: 'right' }}>
                {formatCellAmount(totalDeduction, false)}
              </td>
            </tr>

            {/* Statutory Contributions */}
            {showStatutory && (<>
            <tr>
              <td style={{ width: '32%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000', borderBottom: '1px solid #000000' }}>EPF 12%</td>
              <td style={{ width: '18%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, textAlign: 'right', borderRight: '1px solid #000000', borderBottom: '1px solid #000000' }}>
                {formatCellAmount(epf12Val, false)}
              </td>
              <td colSpan={2} rowSpan={3} style={{ width: '50%', backgroundColor: '#ffffff', borderBottom: '1px solid #000000' }}></td>
            </tr>
            <tr>
              <td style={{ width: '32%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000', borderBottom: '1px solid #000000' }}>Total EPF</td>
              <td style={{ width: '18%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, textAlign: 'right', borderRight: '1px solid #000000', borderBottom: '1px solid #000000' }}>
                {formatCellAmount(totalEpfVal, false)}
              </td>
            </tr>
            <tr>
              <td style={{ width: '32%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, borderRight: '1px solid #000000', borderBottom: '1px solid #000000' }}>ETF 3%</td>
              <td style={{ width: '18%', padding: `${px(3.5)} ${px(5)} ${px(5.5)} ${px(5)}`, textAlign: 'right', borderRight: '1px solid #000000', borderBottom: '1px solid #000000' }}>
                {formatCellAmount(etf3Val, false)}
              </td>
            </tr>
            </>)}

            {/* Net Salary Row */}
            <tr style={{ borderBottom: '1px solid #000000', backgroundColor: '#e5e7eb', fontWeight: 700 }}>
              <td colSpan={2} style={{ width: '50%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, textAlign: 'center', borderRight: '1px solid #000000' }}>
                Net Salary
              </td>
              <td style={{ width: '32%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, textAlign: 'center', borderRight: '1px solid #000000' }}>
                LKR
              </td>
              <td style={{ width: '18%', padding: `${px(4)} ${px(5)} ${px(6)} ${px(5)}`, textAlign: 'right' }}>
                {formatCellAmount(netSalary, false)}
              </td>
            </tr>

            {/* Extra Box Height */}
            <tr style={{ height: px(24) }}>
              <td colSpan={4} style={{ backgroundColor: '#ffffff' }}>&nbsp;</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: px(24), paddingLeft: px(10), paddingRight: px(10), marginTop: px(6) }}>
          <div style={{ width: px(110), textAlign: 'center' }}>
            <div style={{ borderBottom: `${px(1.5)} dotted #374151`, width: '100%', marginBottom: px(4) }} />
            <div style={{ fontWeight: 600, color: '#111827', fontSize: px(8), whiteSpace: 'nowrap' }}>Preparer Signature</div>
          </div>
          <div style={{ width: px(110), textAlign: 'center' }}>
            <div style={{ borderBottom: `${px(1.5)} dotted #374151`, width: '100%', marginBottom: px(4) }} />
            <div style={{ fontWeight: 600, color: '#111827', fontSize: px(8), whiteSpace: 'nowrap' }}>Employee Signature</div>
          </div>
        </div>
      </div>
    );
  }

  const ebs = emp.earnings_by_source;
  const attendanceHours = ebs?.attendance?.hours ?? 0;
  const paidLeaveHours = ebs?.paid_leaves?.hours ?? 0;
  const liveSessionHours = ebs?.live_session?.hours ?? 0;

  const HRule: React.FC<{ color?: string; thickness?: number; marginTop?: number; marginBottom?: number }> = ({
    color = '#e5e7eb', thickness = 1, marginTop = 0, marginBottom = 0,
  }) => (
    <div style={{ height: `${thickness}px`, backgroundColor: color, marginTop: px(marginTop), marginBottom: px(marginBottom), flexShrink: 0 }} />
  );

  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    color: '#374151',
    fontSize: px(11),
    minHeight: px(16),
    display: 'flex',
    alignItems: 'center',
  };

  // A label/value row with an explicit height (not line-height dependent) so it can never
  // be compressed or overlapped by whatever renders immediately after it.
  const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode; color?: string; bold?: boolean; minH?: number }> = ({
    label, value, color = '#374151', bold = false, minH = 16,
  }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: px(minH) }}>
      <span style={{ color: '#4b5563' }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );

  // Bullet row used inside the shortfall / earnings boxes. The bullet is a real text
  // glyph ("●") rather than a CSS circle span - a glyph sits on the same text baseline
  // as its label by construction, so html2canvas can never render it on its own line
  // (which it did with CSS circles inside inline-flex wrappers).
  const BulletRow: React.FC<{ dotColor: string; label: React.ReactNode; value: React.ReactNode; valueColor: string; minH?: number }> = ({
    dotColor, label, value, valueColor, minH = 14,
  }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: px(minH), color: '#374151' }}>
      <span>
        <span style={{ color: dotColor, fontSize: px(8), marginRight: px(4) }}>●</span>
        {label}
      </span>
      <span style={{ color: valueColor, fontWeight: 600 }}>{value}</span>
    </div>
  );

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: px(8),
        padding: px(14),
        fontSize: px(10),
        fontFamily: "'Manrope', system-ui, sans-serif",
        color: '#111827',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: px(8) }}>
        {companyLogo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: px(3) }}>
            <img
              src={companyLogo}
              alt="Company Logo"
              style={{ maxHeight: px(26), maxWidth: px(140), objectFit: 'contain' }}
              crossOrigin="anonymous"
            />
          </div>
        )}
        <div style={{ fontSize: px(12), fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {companyName || 'Company Name'}
        </div>
        {companyAddress && (
          <div style={{ fontSize: px(7.5), fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginTop: px(1), whiteSpace: 'pre-line' }}>
            {companyAddress}
          </div>
        )}
        <div style={{ fontSize: px(9), fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '1px', marginTop: px(2) }}>
          SALARY SLIP
        </div>
        {period && (
          <div style={{ fontSize: px(7.5), color: '#6b7280', marginTop: px(1) }}>
            {new Date(period.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' '}&ndash;{' '}
            {new Date(period.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
        <HRule color="#000000" thickness={1.5} marginTop={5} marginBottom={7} />
      </div>

      {/* Employee Details */}
      <div style={{ marginBottom: px(10) }}>
        <div style={sectionTitleStyle}>Employee Details</div>
        <HRule marginTop={4} marginBottom={6} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', minHeight: px(15), marginBottom: px(2) }}>
          <span style={{ color: '#6b7280', marginRight: px(4) }}>Name:</span>
          <span style={{ color: '#1f2937', fontWeight: 600, marginRight: px(16) }}>{emp.employee_name}</span>
          <span style={{ color: '#6b7280', marginRight: px(4) }}>ID:</span>
          <span style={{ color: '#1f2937', fontWeight: 600 }}>{emp.employee_code}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: px(15) }}>
          <span style={{ color: '#6b7280', marginRight: px(4) }}>Department:</span>
          <span style={{ color: '#1f2937', fontWeight: 600 }}>{emp.department_name}</span>
        </div>
      </div>

      {/* Work Summary */}
      {ebs && (
        <div style={{ backgroundColor: '#f9fafb', borderRadius: px(8), padding: `${px(8)} ${px(10)}`, marginBottom: px(10) }}>
          <div style={{ fontWeight: 700, color: '#374151', fontSize: px(10), minHeight: px(13), display: 'flex', alignItems: 'center', marginBottom: px(6) }}>Work Summary</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '33%', marginBottom: px(4) }}>
              <div style={{ fontSize: px(8.5), lineHeight: px(11), color: '#6b7280' }}>Worked Hours</div>
              <div style={{ fontSize: px(11), lineHeight: px(14), fontWeight: 700, color: '#1f2937' }}>{attendanceHours.toFixed(2)}</div>
            </div>
            {paidLeaveHours > 0 && (
              <div style={{ minWidth: '33%', marginBottom: px(4) }}>
                <div style={{ fontSize: px(8.5), lineHeight: px(11), color: '#6b7280' }}>Paid Leave Hours</div>
                <div style={{ fontSize: px(11), lineHeight: px(14), fontWeight: 700, color: '#16a34a' }}>{paidLeaveHours.toFixed(2)}</div>
              </div>
            )}
            {liveSessionHours > 0 && (
              <div style={{ minWidth: '33%', marginBottom: px(4) }}>
                <div style={{ fontSize: px(8.5), lineHeight: px(11), color: '#6b7280' }}>Live Session Hours</div>
                <div style={{ fontSize: px(11), lineHeight: px(14), fontWeight: 700, color: '#ca8a04' }}>{liveSessionHours.toFixed(2)}</div>
              </div>
            )}
            {ebs.overtime && ebs.overtime.minutes > 0 && (
              <div style={{ minWidth: '33%', marginBottom: px(4) }}>
                <div style={{ fontSize: px(8.5), lineHeight: px(11), color: '#6b7280' }}>Overtime</div>
                <div style={{ fontSize: px(11), lineHeight: px(14), fontWeight: 700, color: '#2563eb' }}>{(ebs.overtime.minutes / 60).toFixed(2)} hrs</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Salary Calculation */}
      <div style={{ marginBottom: px(10) }}>
        <div style={sectionTitleStyle}>Salary Calculation</div>
        <HRule marginTop={4} marginBottom={8} />

        <div style={{ marginBottom: px(6) }}>
          <Row
            label={`Work Hours Earned (${attendanceHours.toFixed(2)}h)`}
            value={formatCurrency((ebs?.attendance?.earned ?? 0) + (ebs?.non_working_day_credit?.earned ?? 0))}
            bold
          />
        </div>

        {ebs && (ebs.paid_leaves?.earned ?? 0) > 0 && (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: px(8), padding: `${px(6)} ${px(8)}`, marginBottom: px(8) }}>
            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: px(8), minHeight: px(11), display: 'flex', alignItems: 'center', marginBottom: px(4), textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Base Salary Earned From
            </div>
            <BulletRow
              dotColor="#3b82f6"
              label={`Paid Leave (${paidLeaveHours.toFixed(2)}h)`}
              value={`+${formatCurrency(ebs.paid_leaves.earned)}`}
              valueColor="#1d4ed8"
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: px(18), marginBottom: px(6) }}>
          <span style={{ color: '#4b5563' }}>Base Salary Earned</span>
          <span
            style={{
              color: '#1d4ed8',
              fontWeight: 700,
              backgroundColor: '#eff6ff',
              padding: `${px(2)} ${px(6)}`,
              borderRadius: px(4),
            }}
          >
            {formatCurrency(emp.actual_earned_base - emp.overtime_amount)}
          </span>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: px(8), padding: `${px(6)} ${px(8)}`, marginBottom: px(8) }}>
          <div style={{ fontWeight: 700, color: '#166534', fontSize: px(8), minHeight: px(11), display: 'flex', alignItems: 'center', marginBottom: px(4), textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Earnings from Work
          </div>
          {emp.allowances_breakdown.map((a, i) => (
            <BulletRow
              key={i}
              dotColor="#22c55e"
              label={<>{a.name}{a.is_percentage ? ' (% of Base)' : ''}</>}
              value={`+${formatCurrency(a.amount)}`}
              valueColor="#374151"
            />
          ))}
          {emp.bonuses_breakdown.map((b, i) => (
            <BulletRow key={i} dotColor="#14b8a6" label={b.description} value={`+${formatCurrency(b.amount)}`} valueColor="#374151" />
          ))}
          {ebs?.overtime && ebs.overtime.earned > 0 && (
            <BulletRow
              dotColor="#3b82f6"
              label={`Overtime (${ebs.overtime.minutes} mins)`}
              value={`+${formatCurrency(ebs.overtime.earned)}`}
              valueColor="#374151"
            />
          )}
          {(emp.allowances_breakdown.length === 0 && emp.bonuses_breakdown.length === 0 && !(ebs?.overtime?.earned)) && (
            <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: px(8), minHeight: px(11), display: 'flex', alignItems: 'center' }}>No additional earnings</div>
          )}
        </div>

        <HRule color="#2563eb" thickness={2} marginBottom={6} />
        <Row label="Gross Salary" value={formatCurrency(emp.gross_salary)} color="#2563eb" bold minH={16} />
      </div>

      {/* Deductions */}
      <div style={{ marginBottom: px(10) }}>
        <div style={sectionTitleStyle}>Deductions (from Gross Salary)</div>
        <HRule marginTop={4} marginBottom={6} />
        {emp.deductions_breakdown.map((d, i) => (
          <div key={i} style={{ marginBottom: px(3) }}>
            <Row
              label={<>{d.name} <span style={{ fontSize: px(7.5), color: '#9ca3af', textTransform: 'uppercase', marginLeft: px(4) }}>{d.category}</span></>}
              value={`-${formatCurrency(d.amount)}`}
              color="#dc2626"
            />
          </div>
        ))}
        {emp.financial_deductions_breakdown.map((d, i) => (
          <div key={i} style={{ marginBottom: px(3) }}>
            <Row label={d.description} value={`-${formatCurrency(d.amount)}`} color="#dc2626" />
          </div>
        ))}
        {(emp.deductions_breakdown.length === 0 && emp.financial_deductions_breakdown.length === 0) && (
          <div style={{ color: '#9ca3af', fontStyle: 'italic', minHeight: px(14), display: 'flex', alignItems: 'center', marginBottom: px(3) }}>No deductions</div>
        )}
        <HRule marginTop={2} marginBottom={6} />
        <Row label="Total Deductions" value={`-${formatCurrency(emp.deductions_total)}`} color="#dc2626" bold />
      </div>

      {/* Net Salary */}
      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: px(10), padding: `${px(10)} ${px(12)}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: px(19) }}>
          <span style={{ fontSize: px(12), fontWeight: 700, color: '#1f2937' }}>Net Salary</span>
          <span style={{ fontSize: px(16), fontWeight: 700, color: '#2563eb' }}>{formatCurrency(emp.net_salary)}</span>
        </div>
        <HRule color="#bfdbfe" marginTop={6} marginBottom={6} />
        <div style={{ fontSize: px(8), color: '#6b7280', minHeight: px(11), display: 'flex', alignItems: 'center', marginBottom: px(2) }}>
          <span style={{ fontWeight: 600, color: '#4b5563' }}>Status:&nbsp;</span>
          <span style={{ color: '#2563eb', fontWeight: 600, textTransform: 'capitalize' }}>Live Preview</span>
        </div>
        {lastCalculated && (
          <div style={{ fontSize: px(8), color: '#6b7280', minHeight: px(11), display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#4b5563' }}>Calculated:&nbsp;</span>
            {lastCalculated.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PayslipCard;
