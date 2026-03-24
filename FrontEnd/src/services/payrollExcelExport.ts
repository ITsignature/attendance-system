import * as XLSX from 'xlsx';
import type { CalculatedPayroll } from './livePayrollCalculationService';

interface PeriodInfo {
  start_date: string;
  end_date: string;
}

export function exportLivePayrollToExcel(
  calculatedResults: CalculatedPayroll[],
  rawEmployees: any[],
  periodInfo: PeriodInfo
): void {
  const rawByEmpId = new Map<string, any>(rawEmployees.map(e => [e.employee_id, e]));

  // =========================================
  // Collect all unique dynamic column labels
  // =========================================

  const allowanceNames = [
    ...new Set(calculatedResults.flatMap(r => (r.allowances_breakdown || []).map(a => a.name)))
  ].sort();

  const advanceTypes = [
    ...new Set(
      rawEmployees.flatMap(e =>
        (e.financial?.advanceRecords || []).map((a: any) => a.advance_type || 'Salary Advance')
      )
    )
  ].sort();

  const loanTypes = [
    ...new Set(
      rawEmployees.flatMap(e =>
        (e.financial?.loanRecords || []).map((l: any) => l.loan_type || 'General Loan')
      )
    )
  ].sort();

  const deductionNames = [
    ...new Set(calculatedResults.flatMap(r => (r.deductions_breakdown || []).map(d => d.name)))
  ].sort();

  // =========================================
  // Column position map
  // Fixed cols 0-7:
  //   0: Emp. Code
  //   1: Name
  //   2: Designation
  //   3: DOJ
  //   4: Work Month
  //   5: Expected Base Salary
  //   6: No. of Working Days
  //   7: Normal Hourly Rate
  // OT group: 8-12 (5 sub-cols)
  // Allowances: 13 ... 13+N-1
  // Bonus: 13+N
  // Gross Salary: 13+N+1
  // Unpaid (Hr): 13+N+2
  // Unpaid: 13+N+3
  // Advances: 13+N+4 ... 13+N+3+M
  // Loans: 13+N+4+M ... 13+N+3+M+K
  // Deductions: 13+N+4+M+K ... 13+N+3+M+K+D
  // Total Deductions: 13+N+4+M+K+D
  // Ajt: +1, Net Salary: +2, Remarks: +3, Round Up: +4
  // =========================================

  const OT_START    = 8;
  const ALLOW_START = 13;
  const BONUS_COL   = ALLOW_START + allowanceNames.length;
  const GROSS_SAL   = BONUS_COL + 1;
  const UNPAID_HR   = GROSS_SAL + 1;
  const UNPAID_AMT  = UNPAID_HR + 1;
  const ADV_START   = UNPAID_AMT + 1;
  const LOAN_START  = ADV_START + advanceTypes.length;
  const DED_START   = LOAN_START + loanTypes.length;
  const TOTAL_DED   = DED_START + deductionNames.length;
  const AJT_COL     = TOTAL_DED + 1;
  const NET_SAL     = AJT_COL + 1;
  const REMARKS     = NET_SAL + 1;
  const ROUND_UP    = REMARKS + 1;
  const TOTAL_COLS  = ROUND_UP + 1;

  // =========================================
  // Build two-row header
  // =========================================

  const row1: any[] = new Array(TOTAL_COLS).fill('');
  const row2: any[] = new Array(TOTAL_COLS).fill('');
  const merges: XLSX.Range[] = [];

  const mergeRows = (col: number) =>
    merges.push({ s: { r: 0, c: col }, e: { r: 1, c: col } });

  const mergeGroup = (startCol: number, endCol: number) => {
    if (endCol > startCol) {
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: endCol } });
    } else {
      mergeRows(startCol);
    }
  };

  // Fixed single-cell headers (span both rows)
  const fixedHeaders = [
    'Emp. Code', 'Name', 'Designation', 'DOJ', 'Work Month',
    'Expected Base Salary', 'No. of Working Days', 'Normal Hourly Rate'
  ];
  fixedHeaders.forEach((label, i) => { row1[i] = label; mergeRows(i); });

  // OT group (cols 8-12)
  row1[OT_START] = 'OT';
  mergeGroup(OT_START, OT_START + 4);
  row2[OT_START]     = 'Weekday OT Rate';
  row2[OT_START + 1] = 'OT Hours (Weekday+Sat+Hol)';
  row2[OT_START + 2] = 'Sunday OT Rate';
  row2[OT_START + 3] = 'OT Hours (Sunday)';
  row2[OT_START + 4] = 'OT Amount';

  // Allowances group
  if (allowanceNames.length > 0) {
    row1[ALLOW_START] = 'Allowances';
    mergeGroup(ALLOW_START, ALLOW_START + allowanceNames.length - 1);
    allowanceNames.forEach((name, i) => { row2[ALLOW_START + i] = name; });
  }

  // Bonus
  row1[BONUS_COL] = 'Bonus';
  mergeRows(BONUS_COL);

  // Gross Salary
  row1[GROSS_SAL] = 'Gross Salary';
  mergeRows(GROSS_SAL);

  // Unpaid (Hr)
  row1[UNPAID_HR] = 'Unpaid (Hr)';
  mergeRows(UNPAID_HR);

  // Unpaid
  row1[UNPAID_AMT] = 'Unpaid';
  mergeRows(UNPAID_AMT);

  // Advances group
  if (advanceTypes.length > 0) {
    row1[ADV_START] = 'Advances';
    mergeGroup(ADV_START, ADV_START + advanceTypes.length - 1);
    advanceTypes.forEach((type, i) => { row2[ADV_START + i] = type; });
  }

  // Loans group
  if (loanTypes.length > 0) {
    row1[LOAN_START] = 'Loans';
    mergeGroup(LOAN_START, LOAN_START + loanTypes.length - 1);
    loanTypes.forEach((type, i) => { row2[LOAN_START + i] = type; });
  }

  // Deductions group
  if (deductionNames.length > 0) {
    row1[DED_START] = 'Deductions';
    mergeGroup(DED_START, DED_START + deductionNames.length - 1);
    deductionNames.forEach((name, i) => { row2[DED_START + i] = name; });
  }

  // Total Deductions
  row1[TOTAL_DED] = 'Total Deductions';
  mergeRows(TOTAL_DED);

  // Ajt. / Net Salary / Remarks / Round Up
  row1[AJT_COL]  = 'Ajt.';     mergeRows(AJT_COL);
  row1[NET_SAL]  = 'Net Salary'; mergeRows(NET_SAL);
  row1[REMARKS]  = 'Remarks';   mergeRows(REMARKS);
  row1[ROUND_UP] = 'Round Up';  mergeRows(ROUND_UP);

  // =========================================
  // Build data rows
  // =========================================

  const dataRows: any[][] = calculatedResults.map(result => {
    const raw = rawByEmpId.get(result.employee_id) || {};
    const row: any[] = new Array(TOTAL_COLS).fill('');

    // --- Fixed columns ---
    row[0] = result.employee_code || '';
    row[1] = result.employee_name || '';
    row[2] = raw.designation_name || '';

    // DOJ
    if (raw.hire_date) {
      const d = new Date(raw.hire_date);
      row[3] = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Work Month (months from hire date to period end, inclusive)
    if (raw.hire_date && periodInfo.end_date) {
      const hire = new Date(raw.hire_date);
      const periodEnd = new Date(periodInfo.end_date);
      const months =
        (periodEnd.getFullYear() - hire.getFullYear()) * 12 +
        (periodEnd.getMonth() - hire.getMonth()) + 1;
      row[4] = Math.max(1, months);
    }

    // Expected Base Salary
    row[5] = result.expected_base_salary || 0;

    // No. of Working Days — actual days attended (check_in exists), including today if checked in
    row[6] = raw.actual_worked_days || 0;

    // Normal Hourly Rate
    const weekdayHourlyRate = parseFloat(raw.weekday_hourly_rate) || 0;
    row[7] = weekdayHourlyRate;

    // --- OT columns ---
    const weekdayOTMult  = parseFloat(raw.weekday_ot_multiplier) || 1;
    const sundayOTMult   = parseFloat(raw.sunday_ot_multiplier)  || 1;
    const weekdayOTRate  = round2(weekdayHourlyRate * weekdayOTMult);

    // Sunday OT Rate: prefer sunday_hourly_rate from payroll_records;
    // if zero (sunday not a scheduled working day), fall back to weekday_hourly_rate × sunday multiplier
    const sundayHourlyRateRaw = parseFloat(raw.sunday_hourly_rate) || 0;
    const sundayBaseRate = sundayHourlyRateRaw > 0 ? sundayHourlyRateRaw : weekdayHourlyRate;
    const sundayOTRate   = round2(sundayBaseRate * sundayOTMult);

    const otRecords: any[] = raw.overtime?.records || [];
    const weekdaySatHolMinutes = otRecords
      .filter((r: any) => r.day_type !== 'sunday')
      .reduce((sum: number, r: any) => sum + (r.total_minutes || 0), 0);
    const sundayOTMinutes = otRecords
      .filter((r: any) => r.day_type === 'sunday')
      .reduce((sum: number, r: any) => sum + (r.total_minutes || 0), 0);

    row[OT_START]     = weekdayOTRate;
    row[OT_START + 1] = round2(weekdaySatHolMinutes / 60);
    row[OT_START + 2] = sundayOTRate;
    row[OT_START + 3] = round2(sundayOTMinutes / 60);
    row[OT_START + 4] = result.overtime_amount || 0;

    // --- Allowances ---
    const allowMap: Record<string, number> = {};
    (result.allowances_breakdown || []).forEach(a => {
      allowMap[a.name] = (allowMap[a.name] || 0) + a.amount;
    });
    allowanceNames.forEach((name, i) => {
      row[ALLOW_START + i] = allowMap[name] || 0;
    });

    // --- Bonus ---
    row[BONUS_COL] = result.bonuses_total || 0;

    // --- Gross Salary = Expected Base + OT Amount + All Allowances ---
    row[GROSS_SAL] = round2(
      (result.expected_base_salary || 0) +
      (result.overtime_amount || 0) +
      (result.allowances_total || 0)
    );

    // --- Unpaid (Hr) ---
    const sc = result.shortfall_by_cause;
    let unpaidHours = 0;
    if (sc) {
      unpaidHours += sc.time_variance?.hours || 0;
      unpaidHours += sc.unpaid_time_off?.hours || 0;
      if (weekdayHourlyRate > 0 && sc.absent_days?.deduction) {
        unpaidHours += sc.absent_days.deduction / weekdayHourlyRate;
      }
    }
    row[UNPAID_HR] = round2(unpaidHours);

    // --- Unpaid amount (attendance shortfall) ---
    row[UNPAID_AMT] = result.attendance_shortfall || 0;

    // --- Advances (by type) ---
    const advMap: Record<string, number> = {};
    (raw.financial?.advanceRecords || []).forEach((a: any) => {
      const type = a.advance_type || 'Salary Advance';
      advMap[type] = (advMap[type] || 0) + (parseFloat(a.deduction_amount) || 0);
    });
    advanceTypes.forEach((type, i) => { row[ADV_START + i] = advMap[type] || 0; });

    // --- Loans (by type) ---
    const loanMap: Record<string, number> = {};
    (raw.financial?.loanRecords || []).forEach((l: any) => {
      const type = l.loan_type || 'General Loan';
      loanMap[type] = (loanMap[type] || 0) + (parseFloat(l.deduction_amount) || 0);
    });
    loanTypes.forEach((type, i) => { row[LOAN_START + i] = loanMap[type] || 0; });

    // --- Deductions (EPF, stamp duty, etc.) ---
    const dedMap: Record<string, number> = {};
    (result.deductions_breakdown || []).forEach(d => {
      dedMap[d.name] = (dedMap[d.name] || 0) + d.amount;
    });
    deductionNames.forEach((name, i) => { row[DED_START + i] = dedMap[name] || 0; });

    // --- Total Deductions = deduction components (EPF etc.) + unpaid amount ---
    const statutoryTotal = (result.deductions_breakdown || []).reduce((s, d) => s + d.amount, 0);
    row[TOTAL_DED] = round2(statutoryTotal + (result.attendance_shortfall || 0));

    // --- Ajt. (empty) ---
    row[AJT_COL] = '';

    // --- Net Salary ---
    row[NET_SAL] = result.net_salary || 0;

    // --- Remarks (empty) ---
    row[REMARKS] = '';

    // --- Round Up ---
    row[ROUND_UP] = Math.round(result.net_salary || 0);

    return row;
  });

  // =========================================
  // Assemble worksheet
  // =========================================

  const allRows = [row1, row2, ...dataRows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!merges'] = merges;

  ws['!cols'] = Array.from({ length: TOTAL_COLS }, (_, i) => {
    if (i === 1) return { wch: 22 };
    if (i === 2) return { wch: 18 };
    if (i === 5 || i === GROSS_SAL || i === NET_SAL) return { wch: 18 };
    return { wch: 14 };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

  const filename = `Payroll_${periodInfo.start_date}_to_${periodInfo.end_date}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
