import ExcelJS from 'exceljs';
import type { CalculatedPayroll } from './livePayrollCalculationService';

interface PeriodInfo { start_date: string; end_date: string; }
interface CompanyInfo { name: string; address: string; }

const MONTH_NAMES = [
  'JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'
];

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  white:      'FFFFFFFF',
  titleText:  'FF1F3864',   // dark navy
  hdrInfo:    'FF2E75B6',   // blue  – info cols
  hdrOT:      'FFED7D31',   // orange – OT
  hdrAllow:   'FF70AD47',   // green  – Allowances / Bonus / Gross
  hdrUnpaid:  'FFFF0000',   // red    – Unpaid
  hdrAdv:     'FF9E480E',   // brown  – Advances
  hdrLoan:    'FF7030A0',   // purple – Loans
  hdrDed:     'FFC00000',   // dark red – Deductions
  hdrNet:     'FF375623',   // dark green – Net / Ajt
  hdrCoExp:   'FF833C00',   // dark orange – Company Expenses
  subHdr:     'FFF2F2F2',   // very light gray for sub-header row fill
  subHdrText: 'FF1F3864',   // same navy for sub-header text
  altRow:     'FFF7F9FC',   // alternating row tint
  totals:     'FFFFF2CC',   // light yellow totals row
  totalsText: 'FF1F3864',
};

function argbFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyBorder(cell: ExcelJS.Cell, style: ExcelJS.BorderStyle = 'thin') {
  const b: Partial<ExcelJS.Border> = { style };
  cell.border = { top: b, left: b, bottom: b, right: b };
}

function styleGroupHeader(cell: ExcelJS.Cell, bgArgb: string) {
  cell.fill  = argbFill(bgArgb);
  cell.font  = { bold: true, color: { argb: C.white }, size: 10, name: 'Calibri' };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBorder(cell, 'medium');
}

function styleSubHeader(cell: ExcelJS.Cell, tintArgb?: string) {
  cell.fill  = argbFill(tintArgb || C.subHdr);
  cell.font  = { bold: true, color: { argb: C.subHdrText }, size: 9, name: 'Calibri' };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBorder(cell, 'thin');
}

function styleDataCell(cell: ExcelJS.Cell, isAlt: boolean, isNumber = false, tintArgb?: string) {
  if (tintArgb) cell.fill = argbFill(tintArgb);
  else if (isAlt) cell.fill = argbFill(C.altRow);
  cell.font = { size: 9, name: 'Calibri' };
  cell.alignment = {
    horizontal: isNumber ? 'right' : 'center',
    vertical: 'middle'
  };
  applyBorder(cell, 'thin');
  if (isNumber && typeof cell.value === 'number') {
    cell.numFmt = '#,##0.00';
  }
}

function styleTotalsCell(cell: ExcelJS.Cell, isNumber = false) {
  cell.fill = argbFill(C.totals);
  cell.font = { bold: true, color: { argb: C.totalsText }, size: 9, name: 'Calibri' };
  cell.alignment = { horizontal: isNumber ? 'right' : 'center', vertical: 'middle' };
  applyBorder(cell, 'medium');
  if (isNumber && typeof cell.value === 'number') {
    cell.numFmt = '#,##0.00';
  }
}

// ── OT column groups ──────────────────────────────────────────────────────────
// One group per OT day type, each with its own colour (header = strong, tint = sub-header/data
// cells) so the groups are easy to tell apart. A group is only added to a sheet when at least one
// employee on that sheet has hours for it. Extra time has no rate column (paid at weekday OT rate).
interface OtGroupDef {
  dayType: string;
  title: string;      // group header (row 4)
  subLabel: string;   // prefix of the sub-headers (row 5): "<subLabel> Rate / Hours / Amount"
  hasRate: boolean;
  header: string;
  tint: string;
}
const OT_GROUPS: OtGroupDef[] = [
  { dayType: 'weekday',           title: 'Weekday OT',              subLabel: 'Weekday OT',                hasRate: true,  header: 'FFED7D31', tint: 'FFFCE4D6' },
  { dayType: 'saturday',          title: 'Saturday OT',             subLabel: 'Sat OT',                    hasRate: true,  header: 'FF00897B', tint: 'FFD5EFEB' },
  { dayType: 'sunday',            title: 'Sunday OT',               subLabel: 'Sun OT',                    hasRate: true,  header: 'FFC2185B', tint: 'FFF8D7E6' },
  { dayType: 'holiday',           title: 'Holiday OT',              subLabel: 'Holiday OT',                hasRate: true,  header: 'FFBF8F00', tint: 'FFFFF0C2' },
  { dayType: 'statutory_holiday', title: 'Statutory Holiday OT',    subLabel: 'Statutory Holiday\nOT',     hasRate: true,  header: 'FF3F51B5', tint: 'FFDCE0F5' },
  { dayType: 'extra_time',        title: 'Sat Covering Extra Time', subLabel: 'Sat Covering Extra\nTime',  hasRate: false, header: 'FF607D8B', tint: 'FFE0E7EB' },
];
const OT_TOTAL_STYLE = { header: 'FF843C0C', tint: 'FFEBD5C5' };

// ── Helper ────────────────────────────────────────────────────────────────────
function round2(n: number) { return Math.round(n * 100) / 100; }

const isTrainee = (r: CalculatedPayroll) => r.employee_type === 'trainee';

// ── Build a single worksheet for one employee group ─────────────────────────
function addPayrollSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  calculatedResults: CalculatedPayroll[],
  rawEmployees: any[],
  periodInfo: PeriodInfo,
  company: CompanyInfo,
  codePrefix: string,
  includeCompanyExpenses: boolean = true
): void {

  const rawByEmpId = new Map<string, any>(rawEmployees.map(e => [e.employee_id, e]));

  // ── Collect dynamic column labels ─────────────────────────────────────────
  // Allowances are grouped into the 3 fixed payment categories rather than by
  // individual allowance name.
  const PAYMENT_CATEGORIES: { key: string; label: string }[] = [
    { key: 'allowance',             label: 'Fixed Allowance' },
    { key: 'one_time_allowance',    label: 'One Time Allowance' },
    { key: 'performance_incentive', label: 'Performance Incentive' },
    { key: 'salary_adjustment',     label: 'Salary Adjustment' }
  ];
  const allowanceNames = PAYMENT_CATEGORIES.map(c => c.label);

  const advanceTypes = [...new Set(
    rawEmployees.flatMap(e =>
      (e.financial?.advanceRecords || []).map((a: any) => a.advance_type || 'Salary Advance')
    )
  )].sort();

  const loanTypes = [...new Set(
    rawEmployees.flatMap(e =>
      (e.financial?.loanRecords || []).map((l: any) => l.loan_type || 'General Loan')
    )
  )].sort();

  const deductionNames = [...new Set(
    calculatedResults.flatMap(r => (r.deductions_breakdown || []).map(d => d.name))
  )].sort();

  // ── Column positions (1-based for ExcelJS) ────────────────────────────────
  // cols: 1=EmpCode 2=Name 3=Desig 4=DOJ 5=WorkMonth 6=ExpBase 7=WorkDays 8=NormRate
  // OT: from col 9. One group per OT day type that has hours on this sheet, each [Rate,] Hours, Amount
  //     (extra time has no Rate), followed by a single Total OT Amount column.
  // Then Allowances, Bonus, Gross, NoPay, Late/Early, Advances, Loans, Deductions, TotalDed,
  // Ajt, Net, Remarks, RoundUp, gap gap, Company Expenses.

  const N = allowanceNames.length;
  const M = advanceTypes.length;
  const K = loanTypes.length;
  const D = deductionNames.length;

  const OT_S    = 9;

  const otMinutesFor = (raw: any, dt: string): number =>
    ((raw?.overtime?.records || []) as any[])
      .filter((r: any) => r.day_type === dt)
      .reduce((sum: number, r: any) => sum + (r.total_minutes || 0), 0);

  // Hide an OT group when nobody on this sheet has hours for it
  const activeOtGroups = OT_GROUPS.filter(g =>
    calculatedResults.some(r => otMinutesFor(rawByEmpId.get(r.employee_id), g.dayType) > 0)
  );

  let nextOtCol = OT_S;
  const otCols = activeOtGroups.map(group => {
    const rate = group.hasRate ? nextOtCol++ : null;
    const hrs  = nextOtCol++;
    const amt  = nextOtCol++;
    return { group, rate, hrs, amt };
  });
  const OT_TOTAL = nextOtCol;

  // Tint used for the sub-header and data cells of each OT column
  const otTint = new Map<number, string>();
  otCols.forEach(({ group, rate, hrs, amt }) => {
    [rate, hrs, amt].forEach(c => { if (c !== null) otTint.set(c, group.tint); });
  });
  otTint.set(OT_TOTAL, OT_TOTAL_STYLE.tint);

  const AL_S    = OT_TOTAL + 1;
  const BONUS   = AL_S + N;
  const GROSS   = BONUS + 1;
  const NOPAY       = GROSS + 1;
  const LATE_EARLY  = NOPAY + 1;
  const ADV_S       = LATE_EARLY + 1;
  const LOAN_S  = ADV_S + M;
  const DED_S   = LOAN_S + K;
  const TOT_DED = DED_S + D;
  const AJT     = TOT_DED + 1;
  const NET     = AJT + 1;
  const REMK    = NET + 1;
  const ROUND   = REMK + 1;
  const COEX_S  = ROUND + 3;   // 2 gap cols then company expenses
  // Trainees are not entitled to EPF/ETF, so their sheet ends at the Round Up column
  const LAST    = includeCompanyExpenses ? COEX_S + 2 : ROUND;  // last col index (1-based)
  const TOTAL_COLS = LAST;

  // ── Build data rows (arrays) ──────────────────────────────────────────────
  type DataRow = (number | string)[];

  const sortedResults = [...calculatedResults].sort((a, b) => {
    const codeA = String(a.employee_code || '');
    const codeB = String(b.employee_code || '');
    const numA = Number(codeA);
    const numB = Number(codeB);
    const aIsNum = !isNaN(numA) && codeA.trim() !== '';
    const bIsNum = !isNaN(numB) && codeB.trim() !== '';
    if (aIsNum && bIsNum) return numA - numB;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const dataRows: DataRow[] = sortedResults.map((result, idx) => {
    const raw = rawByEmpId.get(result.employee_id) || {};
    const row: DataRow = new Array(TOTAL_COLS).fill('');

    // For prefixed sheets (e.g. trainees), show a sequential display code
    // (TR1, TR2, ...) instead of the employee's real employee_code.
    row[0] = codePrefix ? `${codePrefix}${idx + 1}` : (result.employee_code || '');
    row[1] = result.employee_name || '';
    row[2] = raw.designation_name || '';

    if (raw.hire_date) {
      const d = new Date(raw.hire_date);
      row[3] = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    if (raw.hire_date && periodInfo.end_date) {
      const hire = new Date(raw.hire_date);
      const pe   = new Date(periodInfo.end_date);
      row[4] = Math.max(1, (pe.getFullYear()-hire.getFullYear())*12+(pe.getMonth()-hire.getMonth())+1);
    }
    row[5] = result.base_salary || 0;
    row[6] = raw.actual_worked_days || 0;

    const whRate = parseFloat(raw.weekday_hourly_rate) || 0;
    row[7] = whRate;

    const satBase = (parseFloat(raw.saturday_hourly_rate) || 0) > 0
                     ? parseFloat(raw.saturday_hourly_rate)
                     : whRate;
    const sunBase  = (parseFloat(raw.sunday_hourly_rate) || 0) > 0
                     ? parseFloat(raw.sunday_hourly_rate)
                     : whRate;

    const wkOTRate   = round2(whRate  * (parseFloat(raw.weekday_ot_multiplier) || 1));
    const satOTRate  = round2(satBase * (parseFloat(raw.saturday_ot_multiplier) || 1));
    const sunOTRate  = round2(sunBase * (parseFloat(raw.sunday_ot_multiplier) || 1));
    const holOTRate  = round2(whRate  * (parseFloat(raw.holiday_ot_multiplier) || 1));
    const statOTRate = round2(whRate  * (parseFloat(raw.statutory_holiday_ot_multiplier) || 1));

    const otRecs: any[] = raw.overtime?.records || [];
    const minutesFor = (dt: string) => otMinutesFor(raw, dt);
    const amountFor = (dt: string) =>
      otRecs.filter((r: any) => r.day_type === dt).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    const otRates: Record<string, number> = {
      weekday: wkOTRate, saturday: satOTRate, sunday: sunOTRate, holiday: holOTRate, statutory_holiday: statOTRate
    };
    otCols.forEach(({ group, rate, hrs, amt }) => {
      if (rate !== null) row[rate-1] = otRates[group.dayType];
      row[hrs-1] = round2(minutesFor(group.dayType)/60);
      row[amt-1] = round2(amountFor(group.dayType));
    });
    row[OT_TOTAL-1] = round2(otRecs.reduce((sum: number, r: any) => sum + (r.amount || 0), 0));

    const allowMap: Record<string,number> = {};
    (result.allowances_breakdown||[]).forEach(a => {
      const cat = a.payment_category || 'allowance';
      allowMap[cat] = (allowMap[cat]||0) + a.amount;
    });
    PAYMENT_CATEGORIES.forEach((c,i) => { row[AL_S-1+i] = allowMap[c.key]||0; });

    row[BONUS-1]  = result.bonuses_total || 0;
    row[GROSS-1]  = round2((result.base_salary||0)+(result.overtime_amount||0)+(result.allowances_total||0));

    const sc = result.shortfall_by_cause;
    const noPay     = (sc?.absent_days?.deduction||0) + (sc?.unpaid_time_off?.deduction||0);
    const lateEarly = sc?.time_variance?.deduction||0;
    row[NOPAY-1]      = round2(noPay);
    row[LATE_EARLY-1] = round2(lateEarly);

    const advMap: Record<string,number> = {};
    (raw.financial?.advanceRecords||[]).forEach((a:any)=>{
      const t=a.advance_type||'Salary Advance';
      advMap[t]=(advMap[t]||0)+(parseFloat(a.deduction_amount)||0);
    });
    advanceTypes.forEach((t,i)=>{ row[ADV_S-1+i]=advMap[t]||0; });

    const loanMap: Record<string,number> = {};
    (raw.financial?.loanRecords||[]).forEach((l:any)=>{
      const t=l.loan_type||'General Loan';
      loanMap[t]=(loanMap[t]||0)+(parseFloat(l.deduction_amount)||0);
    });
    loanTypes.forEach((t,i)=>{ row[LOAN_S-1+i]=loanMap[t]||0; });

    const dedMap: Record<string,number> = {};
    (result.deductions_breakdown||[]).forEach(d=>{ dedMap[d.name]=(dedMap[d.name]||0)+d.amount; });
    deductionNames.forEach((nm,i)=>{ row[DED_S-1+i]=dedMap[nm]||0; });

    const statTot = (result.deductions_breakdown||[]).reduce((s,d)=>s+d.amount,0);
    row[TOT_DED-1] = round2(statTot+(result.attendance_shortfall||0));
    row[AJT-1]     = '';
    row[NET-1]      = result.net_salary || 0;
    row[REMK-1]    = '';
    row[ROUND-1]   = Math.round(result.net_salary||0);

    if (!includeCompanyExpenses) return row;

    const employeeEpfDeductions = (result.deductions_breakdown || []).filter(
      (d: any) => d.category?.toLowerCase() === 'epf' || d.name?.toLowerCase().includes('epf')
    );
    const employeeEpfValue =
      employeeEpfDeductions.length > 0
        ? employeeEpfDeductions.reduce((sum: number, d: any) => sum + d.amount, 0)
        : (result.epf_employee || 0);

    const expBase = employeeEpfValue > 0
      ? (Math.abs(employeeEpfValue - ((result.base_salary || 0) * 0.08)) < 1 ? (result.base_salary || 0) : (employeeEpfValue / 0.08))
      : (result.base_salary || 0);

    const epf12   = round2(expBase / 100 * 12);
    const etf3    = round2(expBase / 100 * 3);
    row[COEX_S-1]   = epf12;
    row[COEX_S]     = etf3;
    row[COEX_S+1]   = round2(epf12 + etf3);

    return row;
  });

  // ── Totals row ────────────────────────────────────────────────────────────
  const numSumCols = new Set([
    6, GROSS, NOPAY, LATE_EARLY, BONUS, NET, TOT_DED,
    ...otCols.map(c => c.amt), OT_TOTAL,  // OT amounts (not OT hours/rates)
    ...allowanceNames.map((_,i)=>AL_S+i),
    ...advanceTypes.map((_,i)=>ADV_S+i),
    ...loanTypes.map((_,i)=>LOAN_S+i),
    ...deductionNames.map((_,i)=>DED_S+i),
    ...(includeCompanyExpenses ? [COEX_S, COEX_S+1, COEX_S+2] : [])
  ].map(c=>c-1)); // convert to 0-based for array

  const totalsRow: DataRow = new Array(TOTAL_COLS).fill('');
  numSumCols.forEach(col => {
    totalsRow[col] = round2(dataRows.reduce((s,r)=>s+(typeof r[col]==='number'?r[col]:0),0));
  });

  // ── Create worksheet ──────────────────────────────────────────────────────
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }] });

  // Column widths (1-based index = position in array)
  const colWidths = Array.from({ length: TOTAL_COLS }, (_,i): ExcelJS.Column => {
    const c = i + 1;
    if (c===1)  return { width: 12, key: `c${c}` } as any;
    if (c===2)  return { width: 22, key: `c${c}` } as any;
    if (c===3)  return { width: 17, key: `c${c}` } as any;
    if (c===4)  return { width: 11, key: `c${c}` } as any;
    if (c===6 || c===GROSS || c===NET) return { width: 16, key: `c${c}` } as any;
    if (c===ROUND+1 || c===ROUND+2) return { width: 4, key: `c${c}` } as any; // gap cols
    return { width: 13, key: `c${c}` } as any;
  });
  ws.columns = colWidths;

  // Row height defaults
  ws.properties.defaultRowHeight = 18;

  // ── Title rows ────────────────────────────────────────────────────────────
  const periodEnd  = new Date(periodInfo.end_date);
  const monthLabel = `${MONTH_NAMES[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`;
  const companyLine = [company.name, company.address].filter(Boolean).join('   ');

  const r1 = ws.addRow([companyLine]); // row 1
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  r1.height = 22;
  const c1 = r1.getCell(1);
  c1.font      = { bold: true, size: 13, color: { argb: C.titleText }, name: 'Calibri' };
  c1.alignment = { horizontal: 'center', vertical: 'middle' };

  const r2 = ws.addRow([`PAYROLL SUMMARY - ${monthLabel}`]); // row 2
  ws.mergeCells(2, 1, 2, TOTAL_COLS);
  r2.height = 18;
  const c2 = r2.getCell(1);
  c2.font      = { bold: true, size: 11, color: { argb: C.titleText }, name: 'Calibri' };
  c2.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.addRow([]); // row 3 — blank spacer

  // ── Group header row (row 4) ──────────────────────────────────────────────
  const grpRow = ws.addRow([]); // row 4
  grpRow.height = 22;

  function addGroupHeader(startCol: number, endCol: number, label: string, color: string) {
    grpRow.getCell(startCol).value = label;
    if (endCol > startCol) ws.mergeCells(4, startCol, 4, endCol);
    for (let c = startCol; c <= endCol; c++) styleGroupHeader(grpRow.getCell(c), color);
  }

  addGroupHeader(1, 8, '', C.hdrInfo);       // fixed info — label set per sub-header
  grpRow.getCell(1).value = 'Employee Info';
  otCols.forEach(({ group, rate, amt }) => addGroupHeader(rate ?? (amt - 1), amt, group.title, group.header));
  addGroupHeader(OT_TOTAL, OT_TOTAL, 'Total OT', OT_TOTAL_STYLE.header);
  if (N > 0) addGroupHeader(AL_S, AL_S+N-1, 'Allowances', C.hdrAllow);
  addGroupHeader(BONUS, BONUS, 'Bonus', C.hdrAllow);
  addGroupHeader(GROSS, GROSS, 'Gross Salary', C.hdrAllow);
  addGroupHeader(NOPAY, LATE_EARLY, 'Unpaid', C.hdrUnpaid);
  if (M > 0) addGroupHeader(ADV_S, ADV_S+M-1, 'Advances', C.hdrAdv);
  if (K > 0) addGroupHeader(LOAN_S, LOAN_S+K-1, 'Loans', C.hdrLoan);
  if (D > 0) addGroupHeader(DED_S, DED_S+D-1, 'Deductions', C.hdrDed);
  addGroupHeader(TOT_DED, TOT_DED, 'Total Deductions', C.hdrDed);
  addGroupHeader(AJT, ROUND, 'Summary', C.hdrNet);
  if (includeCompanyExpenses) addGroupHeader(COEX_S, COEX_S+2, 'Company Expenses', C.hdrCoExp);

  // ── Sub-header row (row 5) ────────────────────────────────────────────────
  const subRow = ws.addRow([]); // row 5
  subRow.height = 32;

  const subHeaders: [number, string][] = [
    [1, 'Emp. Code'], [2, 'Name'], [3, 'Designation'], [4, 'DOJ'],
    [5, 'Work Month'], [6, 'Base Salary'], [7, 'No. of Working Days'], [8, 'Normal Hourly Rate'],
    ...otCols.flatMap(({ group, rate, hrs, amt }): [number, string][] => [
      ...(rate !== null ? [[rate, `${group.subLabel} Rate`] as [number, string]] : []),
      [hrs, `${group.subLabel} Hours`],
      [amt, `${group.subLabel} Amount`],
    ]),
    [OT_TOTAL, 'Total OT\nAmount'],
    ...allowanceNames.map((nm, i): [number,string] => [AL_S+i, nm]),
    [BONUS, 'Bonus'], [GROSS, 'Gross Salary'],
    [NOPAY, 'NoPay'], [LATE_EARLY, 'Late/Early Deductions'],
    ...advanceTypes.map((t, i): [number,string] => [ADV_S+i, t]),
    ...loanTypes.map((t, i): [number,string] => [LOAN_S+i, t]),
    ...deductionNames.map((nm, i): [number,string] => [DED_S+i, nm]),
    [TOT_DED, 'Total Deductions'], [AJT, 'Ajt.'], [NET, 'Net Salary'],
    [REMK, 'Remarks'], [ROUND, 'Round Up'],
    ...(includeCompanyExpenses
      ? [[COEX_S, 'EPF 12%'], [COEX_S+1, 'ETF 3%'], [COEX_S+2, 'Total Expenses']] as [number,string][]
      : []),
  ];

  subHeaders.forEach(([col, label]) => {
    const cell = subRow.getCell(col);
    cell.value = label;
    styleSubHeader(cell, otTint.get(col));
  });

  // ── Data rows (rows 6+) ───────────────────────────────────────────────────
  const numberCols = new Set<number>([
    6, 7, 8,
    ...otCols.flatMap(({ rate, hrs, amt }) => [...(rate !== null ? [rate] : []), hrs, amt]),
    OT_TOTAL,
    ...allowanceNames.map((_,i)=>AL_S+i),
    BONUS, GROSS, NOPAY, LATE_EARLY,
    ...advanceTypes.map((_,i)=>ADV_S+i),
    ...loanTypes.map((_,i)=>LOAN_S+i),
    ...deductionNames.map((_,i)=>DED_S+i),
    TOT_DED, NET, ROUND,
    ...(includeCompanyExpenses ? [COEX_S, COEX_S+1, COEX_S+2] : []),
  ]);

  dataRows.forEach((data, idx) => {
    const wsRow = ws.addRow(data as any[]);
    wsRow.height = 16;
    const isAlt = idx % 2 === 1;
    for (let c = 1; c <= TOTAL_COLS; c++) {
      if (c === ROUND + 1 || c === ROUND + 2) continue; // gap cols — no border/fill
      styleDataCell(wsRow.getCell(c), isAlt, numberCols.has(c), otTint.get(c));
    }
  });

  // ── Totals row ────────────────────────────────────────────────────────────
  const totWsRow = ws.addRow(totalsRow as any[]);
  totWsRow.height = 18;
  for (let c = 1; c <= TOTAL_COLS; c++) {
    if (c === ROUND + 1 || c === ROUND + 2) continue; // gap cols — no border/fill
    styleTotalsCell(totWsRow.getCell(c), numberCols.has(c));
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function exportLivePayrollToExcel(
  calculatedResults: CalculatedPayroll[],
  rawEmployees: any[],
  periodInfo: PeriodInfo,
  company: CompanyInfo = { name: '', address: '' }
): Promise<void> {

  const nonTrainees = calculatedResults.filter(r => !isTrainee(r));
  const trainees = calculatedResults.filter(r => isTrainee(r));

  const nonTraineeIds = new Set(nonTrainees.map(r => r.employee_id));
  const traineeIds = new Set(trainees.map(r => r.employee_id));
  const rawNonTrainees = rawEmployees.filter(e => nonTraineeIds.has(e.employee_id));
  const rawTrainees = rawEmployees.filter(e => traineeIds.has(e.employee_id));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IT Signature HRMS';

  addPayrollSheet(wb, 'Employees', nonTrainees, rawNonTrainees, periodInfo, company, '');
  addPayrollSheet(wb, 'Trainees', trainees, rawTrainees, periodInfo, company, 'TR', false);

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `Payroll_${periodInfo.start_date}_to_${periodInfo.end_date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
  