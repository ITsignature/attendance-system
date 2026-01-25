const { getDB } = require('../config/database');

/**
 * 
 *
 * Handles employee-specific payroll cycle calculations.
 * Supports custom payroll cycles where employees can have salaries
 * calculated from specific days of the month (e.g., 23rd to 23rd).
 *
 * Example:
 * - Employee with cycle day 23:
 *   - January 2026 salary: 23rd Jan 2026 → 23rd Feb 2026
 *   - February 2026 salary: 23rd Feb 2026 → 23rd Mar 2026
 *
 * @class PayrollCycleService
 */
class PayrollCycleService {

    /**
     * Calculate employee's payroll period based on their configuration
     *
     * This method determines whether an employee uses the default client-level
     * payroll period or a custom cycle based on their individual settings.
     *
     * @param {string} employeeId - Employee UUID
     * @param {Date} runPeriodStart - Period start from payroll_periods table
     * @param {Date} runPeriodEnd - Period end from payroll_periods table
     * @returns {Promise<Object>} { startDate: Date, endDate: Date, usesCustomCycle: boolean }
     * @throws {Error} If employee not found or invalid configuration
     */
    static async calculateEmployeePeriod(employeeId, runPeriodStart, runPeriodEnd) {
        const db = getDB();

        // Get employee payroll cycle configuration
        const [employees] = await db.execute(`
            SELECT payroll_cycle_override, payroll_cycle_day,
                   payroll_cycle_effective_from,
                   first_name, last_name, employee_code
            FROM employees
            WHERE id = ?
        `, [employeeId]);

        if (!employees || employees.length === 0) {
            throw new Error(`Employee not found: ${employeeId}`);
        }

        const employee = employees[0];
        const employeeName = `${employee.first_name} ${employee.last_name}`;

        // If employee uses default cycle, return original period dates
        if (employee.payroll_cycle_override === 'default' || !employee.payroll_cycle_day) {
            console.log(`   📅 ${employeeName}: Using default cycle (${this.formatDate(runPeriodStart)} to ${this.formatDate(runPeriodEnd)})`);
            return {
                startDate: runPeriodStart,
                endDate: runPeriodEnd,
                usesCustomCycle: false
            };
        }

        // Check if custom cycle is effective yet
        const effectiveFrom = employee.payroll_cycle_effective_from;
        if (effectiveFrom && new Date(effectiveFrom) > new Date(runPeriodEnd)) {
            console.log(`   📅 ${employeeName}: Custom cycle not yet effective (starts ${this.formatDate(effectiveFrom)}), using default`);
            return {
                startDate: runPeriodStart,
                endDate: runPeriodEnd,
                usesCustomCycle: false
            };
        }

        // Calculate custom cycle dates
        const cycleDay = employee.payroll_cycle_day;
        const customPeriod = this.calculateCustomPeriod(runPeriodStart, runPeriodEnd, cycleDay);

        console.log(`   📅 ${employeeName}: Using custom cycle day ${cycleDay} (${this.formatDate(customPeriod.startDate)} to ${this.formatDate(customPeriod.endDate)})`);

        return {
            startDate: customPeriod.startDate,
            endDate: customPeriod.endDate,
            usesCustomCycle: true
        };
    }

    /**
     * Calculate custom payroll period based on cycle day
     *
     * For an employee with cycle day 19:
     * - If payroll period is "December 2025" (2025-12-01 to 2025-12-31)
     *   → Custom period: 19th Dec 2025 to 18th Jan 2026
     *
     * - If payroll period is "January 2026" (2026-01-01 to 2026-01-31)
     *   → Custom period: 19th Jan 2026 to 18th Feb 2026
     *
     * The period STARTS on the cycle day and ENDS on (cycle day - 1) of next month.
     * This ensures no overlap between consecutive periods.
     *
     * @param {Date} runPeriodStart - Original period start (e.g., 2025-12-01)
     * @param {Date} runPeriodEnd - Original period end (e.g., 2025-12-31)
     * @param {number} cycleDay - Day of month (1-31)
     * @returns {Object} { startDate: Date, endDate: Date }
     */
    static calculateCustomPeriod(runPeriodStart, runPeriodEnd, cycleDay) {
        const periodStart = new Date(runPeriodStart);

        // Get the month and year from the period start
        // We use period start to determine which month's salary we're calculating
        const year = periodStart.getFullYear();
        const month = periodStart.getMonth(); // 0-11 (0 = January, 1 = February, etc.)

        console.log(`🔍 DEBUG calculateCustomPeriod:`);
        console.log(`   Input: runPeriodStart=${runPeriodStart}, cycleDay=${cycleDay}`);
        console.log(`   Extracted: year=${year}, month=${month} (${month + 1} in 1-indexed)`);

        // Start date: cycleDay of the current month
        // Example: For Feb 2026 period, start = 23rd Feb 2026
        const startDate = new Date(year, month, cycleDay);

        console.log(`   Initial startDate created: new Date(${year}, ${month}, ${cycleDay})`);
        console.log(`   Result: ${startDate.toISOString()} = ${this.formatDate(startDate)}`);
        console.log(`   startDate.getMonth() = ${startDate.getMonth()}, expected = ${month}`);

        // Handle edge case: if cycleDay doesn't exist in month (e.g., Feb 31)
        // JavaScript Date automatically rolls over, so we need to check
        if (startDate.getMonth() !== month) {
            console.log(`   ⚠️ Month rollover detected! Expected month ${month}, got ${startDate.getMonth()}`);
            // Month rolled over, meaning day doesn't exist
            // Use last day of the intended month
            startDate.setDate(0); // Go back to last day of previous month result
            console.log(`   Adjusted startDate to last day: ${this.formatDate(startDate)}`);
        }

        // End date: (cycleDay - 1) of next month
        // Example: For Feb 2026 period with cycle day 19:
        //   - Start: 19th Feb 2026
        //   - End: 18th Mar 2026 (one day before next cycle starts)
        // This ensures no overlap: Feb cycle = 19 Feb to 18 Mar, Mar cycle = 19 Mar to 18 Apr
        const endDate = new Date(year, month + 1, cycleDay - 1);

        console.log(`   Initial endDate created: new Date(${year}, ${month + 1}, ${cycleDay - 1})`);
        console.log(`   Result: ${endDate.toISOString()} = ${this.formatDate(endDate)}`);
        console.log(`   endDate.getMonth() = ${endDate.getMonth()}, expected = ${(month + 1) % 12}`);

        // Handle edge case for end date too
        const expectedEndMonth = (month + 1) % 12;
        if (endDate.getMonth() !== expectedEndMonth) {
            console.log(`   ⚠️ End month rollover detected! Expected month ${expectedEndMonth}, got ${endDate.getMonth()}`);
            // Reset to correct month and use last day
            endDate.setMonth(expectedEndMonth);
            endDate.setDate(0); // Last day of previous month (which is our target month)
            console.log(`   Adjusted endDate to last day: ${this.formatDate(endDate)}`);
        }

        console.log(`   ✅ Final Result: ${this.formatDate(startDate)} to ${this.formatDate(endDate)}`);

        return {
            startDate,
            endDate
        };
    }

    /**
     * Get all unique payroll periods in a run (for reporting)
     *
     * Groups employees by their actual period dates. Useful for:
     * - Displaying which employees have custom cycles
     * - Generating reports grouped by period
     * - Audit and compliance reporting
     *
     * @param {string} runId - Payroll run UUID
     * @returns {Promise<Array>} Array of unique period groups with employee lists
     *
     * Example return:
     * [
     *   {
     *     startDate: '2026-02-01',
     *     endDate: '2026-02-28',
     *     usesCustomCycle: false,
     *     employees: [{ id, code, name }, ...]
     *   },
     *   {
     *     startDate: '2026-02-23',
     *     endDate: '2026-03-23',
     *     usesCustomCycle: true,
     *     employees: [{ id, code, name }, ...]
     *   }
     * ]
     */
    static async getUniquePeriodGroups(runId) {
        const db = getDB();

        const [employees] = await db.execute(`
            SELECT pr.employee_id, pr.employee_code, pr.employee_name,
                   pr.employee_period_start_date,
                   pr.employee_period_end_date,
                   pr.uses_custom_cycle
            FROM payroll_records pr
            WHERE pr.run_id = ?
            ORDER BY pr.uses_custom_cycle DESC, pr.employee_period_start_date
        `, [runId]);

        // Group employees by unique date ranges
        const periodMap = new Map();

        employees.forEach(emp => {
            const key = `${emp.employee_period_start_date}_${emp.employee_period_end_date}`;

            if (!periodMap.has(key)) {
                periodMap.set(key, {
                    startDate: emp.employee_period_start_date,
                    endDate: emp.employee_period_end_date,
                    usesCustomCycle: emp.uses_custom_cycle === 1,
                    employeeCount: 0,
                    employees: []
                });
            }

            const group = periodMap.get(key);
            group.employeeCount++;
            group.employees.push({
                id: emp.employee_id,
                code: emp.employee_code,
                name: emp.employee_name
            });
        });

        return Array.from(periodMap.values());
    }

    /**
     * Get summary statistics for custom cycles in a payroll run
     *
     * @param {string} runId - Payroll run UUID
     * @returns {Promise<Object>} Statistics about custom cycles in the run
     */
    static async getRunCycleSummary(runId) {
        const db = getDB();

        const [summary] = await db.execute(`
            SELECT
                COUNT(*) as total_employees,
                SUM(CASE WHEN uses_custom_cycle = 1 THEN 1 ELSE 0 END) as custom_cycle_count,
                SUM(CASE WHEN uses_custom_cycle = 0 THEN 1 ELSE 0 END) as default_cycle_count,
                COUNT(DISTINCT employee_period_start_date) as unique_start_dates,
                COUNT(DISTINCT employee_period_end_date) as unique_end_dates
            FROM payroll_records
            WHERE run_id = ?
        `, [runId]);

        return summary[0];
    }

    /**
     * Helper: Format date as YYYY-MM-DD string
     * @param {Date|string} date
     * @returns {string}
     */
    static formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

module.exports = PayrollCycleService;
