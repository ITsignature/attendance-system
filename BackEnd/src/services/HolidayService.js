const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { SettingsHelper } = require('../utils/settingsHelper');

class HolidayService {
    
    // =============================================
    // HOLIDAY CALCULATION UTILITIES
    // =============================================
    
    /**
     * Get holidays for a specific date range and client
     * @param {string} clientId - Client ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} departmentId - Optional department ID filter
     * @returns {Promise<Array>} Array of holidays
     */
    async getHolidaysInPeriod(clientId, startDate, endDate, departmentId = null) {
        const db = getDB();
        
        let whereClause = `
            WHERE h.client_id = ? 
            AND h.date BETWEEN ? AND ?
        `;
        let params = [clientId, startDate, endDate];
        
        // Add department filter if specified (simplified for MariaDB compatibility)
        if (departmentId) {
            whereClause += ` 
                AND (h.applies_to_all = TRUE OR h.department_ids IS NULL)
            `;
        } else {
            // If no department specified, get only holidays that apply to all
            whereClause += ` AND h.applies_to_all = TRUE`;
        }
        
        const [holidays] = await db.execute(`
            SELECT 
                h.id,
                h.name,
                h.date,
                h.description,
                h.is_optional,
                h.applies_to_all,
                h.department_ids
            FROM holidays h
            ${whereClause}
            ORDER BY h.date ASC
        `, params);
        
        return holidays.map(holiday => ({
            ...holiday,
            department_ids: holiday.department_ids ? JSON.parse(holiday.department_ids) : null
        }));
    }
    
    /**
     * Calculate working days in a period excluding weekends and holidays
     * @param {string} clientId - Client ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} departmentId - Optional department ID
     * @param {boolean} includeOptionalHolidays - Whether to include optional holidays
     * @returns {Promise<Object>} Working days calculation result
     */
    async calculateWorkingDays(clientId, startDate, endDate, departmentId = null, includeOptionalHolidays = false) {
        const holidays = await this.getHolidaysInPeriod(clientId, startDate, endDate, departmentId);
        const settingsHelper = new SettingsHelper(clientId);
        
        // Filter holidays based on optional flag
        const relevantHolidays = holidays.filter(holiday => 
            includeOptionalHolidays ? true : !holiday.is_optional
        );
        
        const holidayDates = relevantHolidays.map(h => {
            // If h.date is already a string, use it directly, otherwise convert Date to string
            return typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
        });
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        let workingDays = 0;
        let totalDays = 0;
        let weekendDays = 0;
        let holidayCount = 0;
        let weekendWorkingDays = 0;
        
        const currentDate = new Date(start);
        while (currentDate <= end) {
            totalDays++;
            const dayOfWeek = currentDate.getDay();
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Check if it's a holiday first
            if (holidayDates.includes(dateStr)) {
                holidayCount++;
            }
            // Check if it's a weekend
            else if (dayOfWeek === 0 || dayOfWeek === 6) {
                weekendDays++;
                // Check if weekend days are configured as working days (with employee-specific override)
                const isWeekendWorking = await settingsHelper.isWeekendWorkingDay(dayOfWeek);
                if (isWeekendWorking) {
                if (isWeekendWorking) {
                    workingDays++;
                    weekendWorkingDays++;
                }
            }
            // It's a regular working day
            else {
                workingDays++;
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return {
            start_date: startDate,
            end_date: endDate,
            total_days: totalDays,
            working_days: workingDays,
            weekend_days: weekendDays,
            weekend_working_days: weekendWorkingDays,
            holiday_count: holidayCount,
            holidays: relevantHolidays.map(h => ({
                date: typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0],
                name: h.name,
                is_optional: h.is_optional
            }))
        };
    }
    
    /**
     * Check if a specific date is a holiday
     * @param {string} clientId - Client ID
     * @param {string} date - Date to check (YYYY-MM-DD)
     * @param {string} departmentId - Optional department ID
     * @returns {Promise<Object|null>} Holiday object if date is a holiday, null otherwise
     */
    async isHoliday(clientId, date, departmentId = null) {
        const db = getDB();
        
        let whereClause = `
            WHERE h.client_id = ? 
            AND h.date = ?
        `;
        let params = [clientId, date];
        
        if (departmentId) {
            whereClause += ` 
                AND (h.applies_to_all = TRUE OR h.department_ids IS NULL)
            `;
        } else {
            whereClause += ` AND h.applies_to_all = TRUE`;
        }
        
        const [holidays] = await db.execute(`
            SELECT 
                h.id,
                h.name,
                h.date,
                h.description,
                h.is_optional,
                h.applies_to_all
            FROM holidays h
            ${whereClause}
            LIMIT 1
        `, params);
        
        return holidays.length > 0 ? holidays[0] : null;
    }
    
    /**
     * Get holiday multiplier for overtime calculations
     * @param {string} clientId - Client ID
     * @param {string} date - Date to check (YYYY-MM-DD)
     * @param {string} departmentId - Optional department ID
     * @returns {Promise<number>} Overtime multiplier (default 2.5 for holidays)
     */
    async getHolidayOvertimeMultiplier(clientId, date, departmentId = null) {
        const holiday = await this.isHoliday(clientId, date, departmentId);
        
        if (holiday) {
            // You can extend this to have different multipliers based on holiday type
            return holiday.is_optional ? 2.0 : 2.5; // Optional holidays = 2x, mandatory = 2.5x
        }
        
        return null; // Not a holiday
    }
    
    // =============================================
    // PAYROLL INTEGRATION METHODS
    // =============================================
    
    /**
     * Calculate working days for payroll period with proper holiday exclusion
     * @param {string} clientId - Client ID
     * @param {string} startDate - Period start date
     * @param {string} endDate - Period end date
     * @param {Array} employees - Optional array of employees with department info
     * @returns {Promise<Object>} Working days calculation for payroll
     */
    async calculatePayrollWorkingDays(clientId, startDate, endDate, employees = []) {
        const db = getDB();
        
        // If no specific employees, calculate for all departments
        if (employees.length === 0) {
            return await this.calculateWorkingDays(clientId, startDate, endDate);
        }
        
        // Calculate working days per department
        const departmentCalculations = new Map();
        
        for (const employee of employees) {
            const deptId = employee.department_id || 'default';
            
            if (!departmentCalculations.has(deptId)) {
                const calculation = await this.calculateWorkingDays(
                    clientId, 
                    startDate, 
                    endDate, 
                    employee.department_id
                );
                departmentCalculations.set(deptId, calculation);
            }
        }
        
        // Return consolidated result
        const calculations = Array.from(departmentCalculations.values());
        
        return {
            start_date: startDate,
            end_date: endDate,
            department_calculations: Object.fromEntries(departmentCalculations),
            // Use the calculation with minimum working days (most restrictive)
            consolidated: calculations.reduce((min, calc) => 
                calc.working_days < min.working_days ? calc : min
            )
        };
    }
    
    /**
     * Get attendance adjustment factors based on holidays
     * @param {string} clientId - Client ID
     * @param {Array} attendanceDates - Array of attendance date strings
     * @param {string} departmentId - Optional department ID
     * @returns {Promise<Object>} Attendance adjustment factors
     */
    async getAttendanceAdjustments(clientId, attendanceDates, departmentId = null) {
        if (!attendanceDates || attendanceDates.length === 0) {
            return { holiday_adjustments: [], total_holiday_days: 0 };
        }
        
        const startDate = attendanceDates[0];
        const endDate = attendanceDates[attendanceDates.length - 1];
        
        const holidays = await this.getHolidaysInPeriod(clientId, startDate, endDate, departmentId);
        
        const adjustments = [];
        let totalHolidayDays = 0;
        
        for (const date of attendanceDates) {
            const holiday = holidays.find(h => 
                h.date.toISOString().split('T')[0] === date
            );
            
            if (holiday) {
                adjustments.push({
                    date,
                    holiday_name: holiday.name,
                    is_optional: holiday.is_optional,
                    adjustment_type: 'holiday_credit',
                    description: `Credit for ${holiday.name}`
                });
                totalHolidayDays++;
            }
        }
        
        return {
            holiday_adjustments: adjustments,
            total_holiday_days: totalHolidayDays
        };
    }
    
    // =============================================
    // BULK OPERATIONS
    // =============================================
    
    /**
     * Bulk import holidays from predefined lists (e.g., Sri Lankan holidays)
     * @param {string} clientId - Client ID
     * @param {Array} holidayList - Array of holiday objects
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async bulkImportHolidays(clientId, holidayList, options = {}) {
        const db = getDB();
        const {
            update_existing = false,
            department_ids = null,
            applies_to_all = true
        } = options;
        
        try {
            await db.execute('START TRANSACTION');
            
            const results = {
                created: [],
                updated: [],
                skipped: [],
                errors: []
            };
            
            for (const holiday of holidayList) {
                try {
                    const {
                        name,
                        date,
                        description = null,
                        is_optional = false
                    } = holiday;
                    
                    // Check if holiday exists
                    const [existing] = await db.execute(`
                        SELECT id, name FROM holidays 
                        WHERE client_id = ? AND date = ?
                    `, [clientId, date]);
                    
                    if (existing.length > 0) {
                        if (update_existing) {
                            // Update existing holiday
                            await db.execute(`
                                UPDATE holidays SET
                                    name = ?,
                                    description = ?,
                                    is_optional = ?,
                                    applies_to_all = ?,
                                    department_ids = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [
                                name, description, is_optional, applies_to_all,
                                department_ids ? JSON.stringify(department_ids) : null,
                                existing[0].id
                            ]);
                            
                            results.updated.push({
                                id: existing[0].id,
                                name,
                                date,
                                previous_name: existing[0].name
                            });
                        } else {
                            results.skipped.push({
                                name,
                                date,
                                reason: `Holiday already exists: ${existing[0].name}`
                            });
                        }
                    } else {
                        // Create new holiday
                        const holidayId = uuidv4();
                        await db.execute(`
                            INSERT INTO holidays (
                                id, client_id, name, date, description, 
                                is_optional, applies_to_all, department_ids
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            holidayId, clientId, name, date, description,
                            is_optional, applies_to_all,
                            department_ids ? JSON.stringify(department_ids) : null
                        ]);
                        
                        results.created.push({
                            id: holidayId,
                            name,
                            date
                        });
                    }
                    
                } catch (error) {
                    results.errors.push({
                        name: holiday.name,
                        date: holiday.date,
                        error: error.message
                    });
                }
            }
            
            await db.execute('COMMIT');
            
            return {
                success: true,
                total_processed: holidayList.length,
                created_count: results.created.length,
                updated_count: results.updated.length,
                skipped_count: results.skipped.length,
                error_count: results.errors.length,
                details: results
            };
            
        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }
    
    /**
     * Generate Sri Lankan holidays for a specific year
     * @param {number} year - Year to generate holidays for
     * @returns {Array} Array of Sri Lankan holiday objects
     */
    generateSriLankanHolidays(year) {
        // This is a simplified version - in production you'd use a proper calendar library
        const holidays = [
            { name: "New Year's Day", date: `${year}-01-01`, is_optional: false },
            { name: "Tamil Thai Pongal Day", date: `${year}-01-14`, is_optional: false },
            { name: "Independence Day", date: `${year}-02-04`, is_optional: false },
            { name: "Sinhala & Tamil New Year Day", date: `${year}-04-14`, is_optional: false },
            { name: "Day prior to Sinhala & Tamil New Year", date: `${year}-04-13`, is_optional: false },
            { name: "May Day (International Workers' Day)", date: `${year}-05-01`, is_optional: false },
            { name: "Christmas Day", date: `${year}-12-25`, is_optional: false }
        ];
        
        // Add Poya days (simplified - use proper lunar calendar in production)
        const poyaDays = [
            { name: "Duruthu Full Moon Poya Day", date: `${year}-01-13` },
            { name: "Navam Full Moon Poya Day", date: `${year}-02-12` },
            { name: "Medin Full Moon Poya Day", date: `${year}-03-13` },
            { name: "Bak Full Moon Poya Day", date: `${year}-04-12` },
            { name: "Vesak Full Moon Poya Day", date: `${year}-05-12` },
            { name: "Poson Full Moon Poya Day", date: `${year}-06-10` },
            { name: "Esala Full Moon Poya Day", date: `${year}-07-10` },
            { name: "Nikini Full Moon Poya Day", date: `${year}-08-08` },
            { name: "Binara Full Moon Poya Day", date: `${year}-09-07` },
            { name: "Vap Full Moon Poya Day", date: `${year}-10-06` },
            { name: "Ill Full Moon Poya Day", date: `${year}-11-05` },
            { name: "Unduvap Full Moon Poya Day", date: `${year}-12-04` }
        ];
        
        poyaDays.forEach(poya => {
            holidays.push({
                ...poya,
                is_optional: false,
                description: "Full Moon Poya Day"
            });
        });
        
        return holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
}

module.exports = new HolidayService();