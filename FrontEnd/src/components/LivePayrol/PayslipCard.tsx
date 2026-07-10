import React from 'react';
import type { CalculatedPayroll } from '../../services/livePayrollCalculationService';

interface PeriodInfo {
  start_date: string;
  end_date: string;
}

interface PayslipCardProps {
  employee: CalculatedPayroll;
  period?: PeriodInfo | null;
  lastCalculated?: Date;
  /** Multiplies every font-size/spacing value (1 = natural size). Used by bulk export to
   *  shrink dense payslips to fit a fixed grid cell via real reflow (not CSS transform:
   *  scale, which html2canvas rasterizes incorrectly). */
  fontScale?: number;
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
//   Every row below uses an explicit `minHeight` + `alignItems: center` instead.
// - Never attach separator borders (`borderTop`/`borderBottom`) directly to a text-bearing
//   flex row - render them as a standalone `<HRule>` block so their position can't drift.
// - Bullet dots are wrapped with the text in an `inline-flex` span so they align to their
//   own line, not to the parent box.
const PayslipCard: React.FC<PayslipCardProps> = ({ employee: emp, period, lastCalculated, fontScale = 1 }) => {
  const ebs = emp.earnings_by_source;
  const sbc = emp.shortfall_by_cause;
  const attendanceHours = ebs?.attendance?.hours ?? 0;
  const paidLeaveHours = ebs?.paid_leaves?.hours ?? 0;
  const liveSessionHours = ebs?.live_session?.hours ?? 0;
  const hasShortfall = !!sbc && (
    (sbc.unpaid_time_off?.deduction ?? 0) > 0 ||
    (sbc.time_variance?.deduction ?? 0) > 0 ||
    (sbc.absent_days?.deduction ?? 0) > 0
  );

  // px(10) => `${10 * BASE_SCALE * fontScale}px`, applied to every size value below so the
  // whole card reflows proportionally instead of being post-scaled with CSS transform.
  // BASE_SCALE bumps the overall type size; the bulk export's iterative fit loop will
  // shrink fontScale automatically if a dense card no longer fits its grid cell.
  const BASE_SCALE = 1.2;
  const px = (n: number) => `${n * BASE_SCALE * fontScale}px`;

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
      <div style={{ marginBottom: px(10) }}>
        <div style={{ fontSize: px(13), fontWeight: 700, color: '#111827', minHeight: px(16), display: 'flex', alignItems: 'center' }}>Live Payroll Preview</div>
        {period && (
          <div style={{ fontSize: px(9), color: '#6b7280', marginTop: px(2), minHeight: px(13), display: 'flex', alignItems: 'center' }}>
            {new Date(period.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {' '}&ndash;{' '}
            {new Date(period.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}
        <HRule color="#d1d5db" marginTop={8} />
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
          <Row label="Base Salary (Full Month)" value={formatCurrency(emp.base_salary)} bold />
        </div>

        {hasShortfall && (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: px(8), padding: `${px(6)} ${px(8)}`, marginBottom: px(8) }}>
            <div style={{ fontWeight: 700, color: '#9a3412', fontSize: px(8), minHeight: px(11), display: 'flex', alignItems: 'center', marginBottom: px(4), textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Salary Reduction (Shortfall)
            </div>
            {(sbc!.time_variance?.deduction ?? 0) > 0 && (
              <BulletRow
                dotColor="#eab308"
                label={<>Late Arrivals &amp; Early Departures ({sbc!.time_variance.hours.toFixed(2)}h)</>}
                value={`-${formatCurrency(sbc!.time_variance.deduction)}`}
                valueColor="#c2410c"
              />
            )}
            {(sbc!.unpaid_time_off?.deduction ?? 0) > 0 && (
              <BulletRow
                dotColor="#f97316"
                label={<>Unpaid Leaves ({sbc!.unpaid_time_off.hours.toFixed(2)}h)</>}
                value={`-${formatCurrency(sbc!.unpaid_time_off.deduction)}`}
                valueColor="#c2410c"
              />
            )}
            {(sbc!.absent_days?.deduction ?? 0) > 0 && (
              <BulletRow
                dotColor="#ef4444"
                label="Absent Days"
                value={`-${formatCurrency(sbc!.absent_days.deduction)}`}
                valueColor="#c2410c"
              />
            )}
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
