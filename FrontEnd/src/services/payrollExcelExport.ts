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

function styleSubHeader(cell: ExcelJS.Cell) {
  cell.fill  = argbFill(C.subHdr);
  cell.font  = { bold: true, color: { argb: C.subHdrText }, size: 9, name: 'Calibri' };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBorder(cell, 'thin');
}

function styleDataCell(cell: ExcelJS.Cell, isAlt: boolean, isNumber = false) {
  if (isAlt) cell.fill = argbFill(C.altRow);
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

// ── Helper ────────────────────────────────────────────────────────────────────
function round2(n: number) { return Math.round(n * 100) / 100; }

// ── Main export ───────────────────────────────────────────────────────────────
export async function exportLivePayrollToExcel(
  calculatedResults: CalculatedPayroll[],
  rawEmployees: any[],
  periodInfo: PeriodInfo,
  company: CompanyInfo = { name: '', address: '' }
): Promise<void> {

  const rawByEmpId = new Map<string, any>(rawEmployees.map(e => [e.employee_id, e]));

  // ── Collect dynamic column labels ─────────────────────────────────────────
  const allowanceNames = [...new Set(
    calculatedResults.flatMap(r => (r.allowances_breakdown || []).map(a => a.name))
  )].sort();

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
  // OT: 9-13  (5 cols)
  // Allow: 14..14+N-1
  // Bonus: 14+N
  // Gross: 14+N+1
  // Unpaid(Hr): 14+N+2
  // Unpaid: 14+N+3
  // Advances: 14+N+4 .. +4+M-1
  // Loans: 14+N+4+M .. +3+M+K
  // Ded: 14+N+4+M+K .. +3+M+K+D
  // TotalDed: 14+N+4+M+K+D
  // Ajt: +1  Net: +2  Remarks: +3  RoundUp: +4
  // gap gap  CoExp: +7 +8 +9

  const N = allowanceNames.length;
  const M = advanceTypes.length;
  const K = loanTypes.length;
  const D = deductionNames.length;

  const OT_S    = 9;
  const AL_S    = 14;
  const BONUS   = AL_S + N;
  const GROSS   = BONUS + 1;
  const UNP_HR  = GROSS + 1;
  const UNP_AMT = UNP_HR + 1;
  const ADV_S   = UNP_AMT + 1;
  const LOAN_S  = ADV_S + M;
  const DED_S   = LOAN_S + K;
  const TOT_DED = DED_S + D;
  const AJT     = TOT_DED + 1;
  const NET     = AJT + 1;
  const REMK    = NET + 1;
  const ROUND   = REMK + 1;
  const COEX_S  = ROUND + 3;   // 2 gap cols then company expenses
  const LAST    = COEX_S + 2;  // last col index (1-based)
  const TOTAL_COLS = LAST;

  // ── Build data rows (arrays) ──────────────────────────────────────────────
  type DataRow = (number | string)[];

  const dataRows: DataRow[] = calculatedResults.map(result => {
    const raw = rawByEmpId.get(result.employee_id) || {};
    const row: DataRow = new Array(TOTAL_COLS).fill('');

    row[0] = result.employee_code || '';
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
    row[5] = result.expected_base_salary || 0;
    row[6] = raw.actual_worked_days || 0;

    const whRate = parseFloat(raw.weekday_hourly_rate) || 0;
    row[7] = whRate;

    const wkOTRate = round2(whRate * (parseFloat(raw.weekday_ot_multiplier) || 1));
    const sunBase  = (parseFloat(raw.sunday_hourly_rate) || 0) > 0
                     ? parseFloat(raw.sunday_hourly_rate)
                     : whRate;
    const sunOTRate = round2(sunBase * (parseFloat(raw.sunday_ot_multiplier) || 1));
    const otRecs: any[] = raw.overtime?.records || [];
    const wkSatHolMin = otRecs.filter((r:any)=>r.day_type!=='sunday').reduce((s:number,r:any)=>s+(r.total_minutes||0),0);
    const sunMin      = otRecs.filter((r:any)=>r.day_type==='sunday').reduce((s:number,r:any)=>s+(r.total_minutes||0),0);

    row[OT_S-1]   = wkOTRate;
    row[OT_S]     = round2(wkSatHolMin/60);
    row[OT_S+1]   = sunOTRate;
    row[OT_S+2]   = round2(sunMin/60);
    row[OT_S+3]   = result.overtime_amount || 0;

    const allowMap: Record<string,number> = {};
    (result.allowances_breakdown||[]).forEach(a => { allowMap[a.name]=(allowMap[a.name]||0)+a.amount; });
    allowanceNames.forEach((nm,i) => { row[AL_S-1+i] = allowMap[nm]||0; });

    row[BONUS-1]  = result.bonuses_total || 0;
    row[GROSS-1]  = round2((result.expected_base_salary||0)+(result.overtime_amount||0)+(result.allowances_total||0));

    const sc = result.shortfall_by_cause;
    let unpHr = 0;
    if (sc) {
      unpHr += sc.time_variance?.hours||0;
      unpHr += sc.unpaid_time_off?.hours||0;
      if (whRate>0 && sc.absent_days?.deduction) unpHr += sc.absent_days.deduction/whRate;
    }
    row[UNP_HR-1]  = round2(unpHr);
    row[UNP_AMT-1] = result.attendance_shortfall || 0;

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

    const expBase = result.expected_base_salary||0;
    const epf12   = round2(expBase/100*12);
    const etf3    = round2(expBase/100*3);
    row[COEX_S-1]   = epf12;
    row[COEX_S]     = etf3;
    row[COEX_S+1]   = round2(epf12+etf3);

    return row;
  });

  // ── Totals row ────────────────────────────────────────────────────────────
  const numSumCols = new Set([
    6, GROSS, UNP_AMT, BONUS, NET, TOT_DED,
    OT_S+4,  // OT Amount (not OT hours)
    ...allowanceNames.map((_,i)=>AL_S+i),
    ...advanceTypes.map((_,i)=>ADV_S+i),
    ...loanTypes.map((_,i)=>LOAN_S+i),
    ...deductionNames.map((_,i)=>DED_S+i),
    COEX_S, COEX_S+1, COEX_S+2
  ].map(c=>c-1)); // convert to 0-based for array

  const totalsRow: DataRow = new Array(TOTAL_COLS).fill('');
  numSumCols.forEach(col => {
    totalsRow[col] = round2(dataRows.reduce((s,r)=>s+(typeof r[col]==='number'?r[col]:0),0));
  });

  // ── Create workbook ───────────────────────────────────────────────────────
  const wb  = new ExcelJS.Workbook();
  wb.creator = 'IT Signature HRMS';
  const ws  = wb.addWorksheet('Payroll', { views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }] });

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
  addGroupHeader(OT_S, OT_S+4, 'OT', C.hdrOT);
  if (N > 0) addGroupHeader(AL_S, AL_S+N-1, 'Allowances', C.hdrAllow);
  addGroupHeader(BONUS, BONUS, 'Bonus', C.hdrAllow);
  addGroupHeader(GROSS, GROSS, 'Gross Salary', C.hdrAllow);
  addGroupHeader(UNP_HR, UNP_AMT, 'Unpaid', C.hdrUnpaid);
  if (M > 0) addGroupHeader(ADV_S, ADV_S+M-1, 'Advances', C.hdrAdv);
  if (K > 0) addGroupHeader(LOAN_S, LOAN_S+K-1, 'Loans', C.hdrLoan);
  if (D > 0) addGroupHeader(DED_S, DED_S+D-1, 'Deductions', C.hdrDed);
  addGroupHeader(TOT_DED, TOT_DED, 'Total Deductions', C.hdrDed);
  addGroupHeader(AJT, ROUND, 'Summary', C.hdrNet);
  addGroupHeader(COEX_S, COEX_S+2, 'Company Expenses', C.hdrCoExp);

  // ── Sub-header row (row 5) ────────────────────────────────────────────────
  const subRow = ws.addRow([]); // row 5
  subRow.height = 32;

  const subHeaders: [number, string][] = [
    [1, 'Emp. Code'], [2, 'Name'], [3, 'Designation'], [4, 'DOJ'],
    [5, 'Work Month'], [6, 'Expected Base Salary'], [7, 'No. of Working Days'], [8, 'Normal Hourly Rate'],
    [OT_S,   'Weekday OT Rate'], [OT_S+1, 'OT Hours\n(Wkday+Sat+Hol)'],
    [OT_S+2, 'Sunday OT Rate'], [OT_S+3, 'OT Hours\n(Sunday)'], [OT_S+4, 'OT Amount'],
    ...allowanceNames.map((nm, i): [number,string] => [AL_S+i, nm]),
    [BONUS, 'Bonus'], [GROSS, 'Gross Salary'],
    [UNP_HR, 'Unpaid (Hr)'], [UNP_AMT, 'Unpaid'],
    ...advanceTypes.map((t, i): [number,string] => [ADV_S+i, t]),
    ...loanTypes.map((t, i): [number,string] => [LOAN_S+i, t]),
    ...deductionNames.map((nm, i): [number,string] => [DED_S+i, nm]),
    [TOT_DED, 'Total Deductions'], [AJT, 'Ajt.'], [NET, 'Net Salary'],
    [REMK, 'Remarks'], [ROUND, 'Round Up'],
    [COEX_S, 'EPF 12%'], [COEX_S+1, 'ETF 3%'], [COEX_S+2, 'Total Expenses'],
  ];

  subHeaders.forEach(([col, label]) => {
    const cell = subRow.getCell(col);
    cell.value = label;
    styleSubHeader(cell);
  });

  // ── Data rows (rows 6+) ───────────────────────────────────────────────────
  const numberCols = new Set<number>([
    6, 7, 8,
    OT_S, OT_S+1, OT_S+2, OT_S+3, OT_S+4,
    ...allowanceNames.map((_,i)=>AL_S+i),
    BONUS, GROSS, UNP_HR, UNP_AMT,
    ...advanceTypes.map((_,i)=>ADV_S+i),
    ...loanTypes.map((_,i)=>LOAN_S+i),
    ...deductionNames.map((_,i)=>DED_S+i),
    TOT_DED, NET, ROUND,
    COEX_S, COEX_S+1, COEX_S+2,
  ]);

  dataRows.forEach((data, idx) => {
    const wsRow = ws.addRow(data as any[]);
    wsRow.height = 16;
    const isAlt = idx % 2 === 1;
    for (let c = 1; c <= TOTAL_COLS; c++) {
      if (c === ROUND + 1 || c === ROUND + 2) continue; // gap cols — no border/fill
      styleDataCell(wsRow.getCell(c), isAlt, numberCols.has(c));
    }
  });

  // ── Totals row ────────────────────────────────────────────────────────────
  const totWsRow = ws.addRow(totalsRow as any[]);
  totWsRow.height = 18;
  for (let c = 1; c <= TOTAL_COLS; c++) {
    if (c === ROUND + 1 || c === ROUND + 2) continue; // gap cols — no border/fill
    styleTotalsCell(totWsRow.getCell(c), numberCols.has(c));
  }

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
