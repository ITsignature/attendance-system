// Shared leave day-counting rules, used by admin leave creation/edit/approval and the employee
// portal. A calendar day counts toward a full-day leave only if it is NOT a holiday and is either
// a weekday (Mon-Fri) or a Saturday/Sunday that is a working day for the employee (see
// weekendWorkingDay.js, which mirrors payroll).
const { isConfiguredWorkingDay } = require('./weekendWorkingDay');

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Normalise anything the DB driver may hand back (string, Date) to 'YYYY-MM-DD'
const normalizeDate = (value) => {
  if (value instanceof Date) return toDateStr(value);
  return String(value).split('T')[0].split(' ')[0];
};

// Loads what's needed to classify days in [startDate, endDate] for one employee.
async function loadLeaveDayContext(db, clientId, employeeId, startDate, endDate) {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  // Distinct holiday dates (a date listed twice must still only count once)
  const [holidayRows] = await db.execute(`
    SELECT DISTINCT DATE_FORMAT(date, '%Y-%m-%d') AS hdate
    FROM holidays
    WHERE client_id = ?
    AND date BETWEEN ? AND ?
    AND (applies_to_all = TRUE OR department_ids IS NULL)
  `, [clientId, start, end]);
  const holidays = new Set(holidayRows.map(h => h.hdate));

  let companyConfig = null;
  try {
    const [companyRow] = await db.execute(`
      SELECT setting_value FROM system_settings
      WHERE client_id = ? AND setting_key = 'default_weekend_working_config'
      LIMIT 1
    `, [clientId]);
    if (companyRow[0]?.setting_value) companyConfig = JSON.parse(companyRow[0].setting_value);
  } catch (e) { companyConfig = null; }

  let employeeConfig = null;
  const [empRows] = await db.execute(
    'SELECT weekend_working_config FROM employees WHERE id = ?', [employeeId]
  );
  if (empRows.length > 0 && empRows[0].weekend_working_config) {
    try { employeeConfig = JSON.parse(empRows[0].weekend_working_config); } catch (e) {}
  }

  return { holidays, companyConfig, employeeConfig };
}

// Is this specific date a day the employee would normally work (and not a holiday)?
function isLeaveCountedDay(ctx, dateStr) {
  if (ctx.holidays.has(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sunday, 6=Saturday
  if (dow === 6) return isConfiguredWorkingDay(ctx.employeeConfig, ctx.companyConfig, 'saturday', dateStr);
  if (dow === 0) return isConfiguredWorkingDay(ctx.employeeConfig, ctx.companyConfig, 'sunday', dateStr);
  return true;
}

// Every counted day in the range as { date, dow } (dow: 0=Sunday .. 6=Saturday)
function listLeaveCountedDays(ctx, startDate, endDate) {
  const days = [];
  const [sy, sm, sd] = normalizeDate(startDate).split('-').map(Number);
  const [ey, em, ed] = normalizeDate(endDate).split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cur <= last) {
    const dateStr = toDateStr(cur);
    if (isLeaveCountedDay(ctx, dateStr)) days.push({ date: dateStr, dow: cur.getDay() });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Days a full-day leave consumes: calendar days minus holidays and non-working weekend days.
async function calculateFullDayLeaveDays(db, clientId, employeeId, startDate, endDate) {
  const ctx = await loadLeaveDayContext(db, clientId, employeeId, startDate, endDate);
  const days = listLeaveCountedDays(ctx, startDate, endDate).length;
  console.log(`📅 Auto-calculated days for full_day leave: ${normalizeDate(startDate)} to ${normalizeDate(endDate)} = ${days} days (${ctx.holidays.size} holiday date(s) in range)`);
  return days;
}

// Safety net: re-count days_requested for an employee's pending/approved full-day leaves using
// the schedule and holidays in force right now, so a weekend-config/holiday change after a leave
// was created (or approved) never leaves a stale count behind in balances and limits.
// Only leaves ending on or after the 1st of the current month are touched, so closed months
// never shift. Pass onlyId to refresh a single request (used on approval).
// Returns a Map of request id -> new days for every request whose count changed.
async function refreshFullDayLeaveDays(db, clientId, employeeId, { onlyId = null } = {}) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

  const [rows] = await db.execute(`
    SELECT id, leave_type_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
           DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, days_requested, balance_deducted
    FROM leave_requests
    WHERE employee_id = ?
      AND status IN ('pending', 'approved')
      AND leave_duration = 'full_day'
      AND end_date >= ?
      ${onlyId ? 'AND id = ?' : ''}
  `, onlyId ? [employeeId, monthStart, onlyId] : [employeeId, monthStart]);

  const changed = new Map();
  for (const row of rows) {
    const newDays = await calculateFullDayLeaveDays(db, clientId, employeeId, row.start_date, row.end_date);
    const oldDays = parseFloat(row.days_requested);
    if (Math.abs(newDays - oldDays) < 0.001) continue;

    await db.execute('UPDATE leave_requests SET days_requested = ? WHERE id = ?', [newDays, row.id]);

    // Already deducted from an accrual balance on approval: move the balance by the difference
    if (row.balance_deducted) {
      const delta = newDays - oldDays;
      await db.execute(`
        UPDATE leave_accrual_balances
        SET cumulative_used   = cumulative_used   + ?,
            available_balance = available_balance - ?
        WHERE employee_id = ? AND leave_type_id = ?
      `, [delta, delta, employeeId, row.leave_type_id]);
    }

    console.log(`🔄 Leave ${row.id} (${row.start_date} to ${row.end_date}): days_requested ${oldDays} -> ${newDays} (schedule/holidays changed since it was saved)`);
    changed.set(row.id, newDays);
  }
  return changed;
}

module.exports = {
  loadLeaveDayContext,
  listLeaveCountedDays,
  isLeaveCountedDay,
  calculateFullDayLeaveDays,
  refreshFullDayLeaveDays
};
