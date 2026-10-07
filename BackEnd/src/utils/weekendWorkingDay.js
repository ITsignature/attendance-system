// Decides whether a specific Saturday/Sunday is a configured working day for an employee.
// Mirrors isConfiguredWorkingDay in PayrollRunService.calculateEarnedSalary so leave day
// counting and payroll agree on which weekend days are working vs non-working.
//
//   employeeConfig - parsed employees.weekend_working_config (or null)
//   companyConfig  - parsed system_settings 'default_weekend_working_config' (or null)
//   dayType        - 'saturday' | 'sunday'
//   dateStr        - 'YYYY-MM-DD'
function isConfiguredWorkingDay(employeeConfig, companyConfig, dayType, dateStr) {
  if (!employeeConfig) return false; // no config at all -> not a working day
  const dayConfig = employeeConfig[dayType];
  if (!dayConfig?.working) return false; // day type missing or not marked working

  const [y, m, d] = dateStr.split('-').map(Number);
  const yearMonth = `${y}-${String(m).padStart(2, '0')}`;
  const nth = Math.ceil(d / 7);
  const monthPattern = (schedule) => {
    const pattern = schedule[yearMonth];
    return Array.isArray(pattern) && pattern.includes(nth);
  };

  const monthlySchedule = dayConfig.monthly_schedule;
  if (monthlySchedule === undefined) return true; // absent -> all occurrences working
  if (monthlySchedule === null) {
    // null = use company default schedule
    if (!companyConfig) return true;
    const companySchedule = companyConfig[dayType]?.monthly_schedule;
    if (!companySchedule) return true;
    return monthPattern(companySchedule);
  }
  if (Object.keys(monthlySchedule).length === 0) return true; // empty -> all working
  return monthPattern(monthlySchedule);
}

module.exports = { isConfiguredWorkingDay };
