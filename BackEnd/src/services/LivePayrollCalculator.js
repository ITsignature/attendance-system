const { getDB } = require('../config/database');
const PayrollService = require('./payrollService');
const moment = require('moment');

class LivePayrollCalculator {
    constructor() {
        this.db = getDB();
        this.payrollService = new PayrollService(this.db);
    }

    // =============================================
    // REAL-TIME PAYROLL CALCULATION
    // =============================================

    /**
     * Calculate live payroll for an employee up to current date or specified date
     * @param {string} clientId - Client ID
     * @param {string} employeeId - Employee ID
     * @param {string} calculateUpTo - Date to calculate up to (default: today)
     * @param {boolean} projectFullMonth - Whether to project full month salary
     */
    async calculateLivePayroll(clientId, employeeId, calculateUpTo = null, projectFullMonth = false) {
        try {
            const endDate = calculateUpTo ? moment(calculateUpTo) : moment();
            const startOfMonth = moment(endDate).startOf('month');
            const endOfMonth = moment(endDate).endOf('month');

            console.log(`🔄 Calculating live payroll for employee ${employeeId} from ${startOfMonth.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

            // Get employee details
            const employee = await this.getEmployeeDetails(clientId, employeeId);
            if (!employee) {
                throw new Error('Employee not found');
            }

            // Get attendance data for the period
            const attendanceData = await this.getAttendanceData(clientId, employeeId, startOfMonth.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

            // Get payroll settings
            const settings = await this.getPayrollSettings(clientId);

            // Calculate earnings
            const earnings = await this.calculateEarnings(employee, attendanceData, settings, startOfMonth, endDate);

            // Calculate deductions
            const deductions = await this.calculateDeductions(employee, earnings, settings);

            // Calculate net salary
            const netSalary = earnings.total - deductions.total;

            // Project full month if requested
            let projectedData = null;
            if (projectFullMonth && endDate.date() < endOfMonth.date()) {
                projectedData = await this.projectFullMonthSalary(employee, attendanceData, settings, startOfMonth, endOfMonth);
            }

            return {
                employee: {
                    id: employee.employee_id,
                    name: employee.full_name,
                    designation: employee.designation,
                    base_salary: employee.base_salary
                },
                period: {
                    start: startOfMonth.format('YYYY-MM-DD'),
                    end: endDate.format('YYYY-MM-DD'),
                    days_calculated: endDate.diff(startOfMonth, 'days') + 1,
                    total_days_in_month: endOfMonth.date()
                },
                attendance: {
                    days_worked: attendanceData.daysWorked,
                    total_hours: attendanceData.totalHours,
                    overtime_hours: attendanceData.overtimeHours,
                    leave_days: attendanceData.leaveDays,
                    absent_days: attendanceData.absentDays
                },
                earnings: {
                    base_salary_prorated: earnings.baseSalary,
                    overtime_pay: earnings.overtime,
                    allowances: earnings.allowances,
                    bonuses: earnings.bonuses,
                    total: earnings.total
                },
                deductions: {
                    tax: deductions.tax,
                    provident_fund: deductions.providentFund,
                    insurance: deductions.insurance,
                    loans: deductions.loans,
                    other: deductions.other,
                    total: deductions.total
                },
                summary: {
                    gross_salary: earnings.total,
                    total_deductions: deductions.total,
                    net_salary: netSalary,
                    completion_percentage: Math.round((endDate.diff(startOfMonth, 'days') + 1) / endOfMonth.date() * 100)
                },
                projection: projectedData,
                calculated_at: moment().toISOString()
            };

        } catch (error) {
            console.error('❌ Error calculating live payroll:', error);
            throw error;
        }
    }

    /**
     * Calculate payroll for custom date range
     */
    async calculateDateRangePayroll(clientId, employeeId, startDate, endDate) {
        try {
            const start = moment(startDate);
            const end = moment(endDate);

            console.log(`📅 Calculating date range payroll for employee ${employeeId} from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);

            // Get employee details
            const employee = await this.getEmployeeDetails(clientId, employeeId);
            if (!employee) {
                throw new Error('Employee not found');
            }

            // Get attendance data for the custom range
            const attendanceData = await this.getAttendanceData(clientId, employeeId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));

            // Get payroll settings
            const settings = await this.getPayrollSettings(clientId);

            // Calculate pro-rated salary for the date range
            const totalDaysInMonth = start.daysInMonth();
            const daysInRange = end.diff(start, 'days') + 1;
            const prorationFactor = daysInRange / totalDaysInMonth;

            // Calculate earnings
            const earnings = await this.calculateEarnings(employee, attendanceData, settings, start, end, prorationFactor);

            // Calculate deductions
            const deductions = await this.calculateDeductions(employee, earnings, settings, prorationFactor);

            // Calculate net salary
            const netSalary = earnings.total - deductions.total;

            return {
                employee: {
                    id: employee.employee_id,
                    name: employee.full_name,
                    designation: employee.designation,
                    base_salary: employee.base_salary
                },
                period: {
                    start: start.format('YYYY-MM-DD'),
                    end: end.format('YYYY-MM-DD'),
                    days_in_range: daysInRange,
                    proration_factor: prorationFactor
                },
                attendance: {
                    days_worked: attendanceData.daysWorked,
                    total_hours: attendanceData.totalHours,
                    overtime_hours: attendanceData.overtimeHours,
                    leave_days: attendanceData.leaveDays,
                    absent_days: attendanceData.absentDays
                },
                earnings: {
                    base_salary_prorated: earnings.baseSalary,
                    overtime_pay: earnings.overtime,
                    allowances: earnings.allowances,
                    bonuses: earnings.bonuses,
                    total: earnings.total
                },
                deductions: {
                    tax: deductions.tax,
                    provident_fund: deductions.providentFund,
                    insurance: deductions.insurance,
                    loans: deductions.loans,
                    other: deductions.other,
                    total: deductions.total
                },
                summary: {
                    gross_salary: earnings.total,
                    total_deductions: deductions.total,
                    net_salary: netSalary
                },
                calculated_at: moment().toISOString()
            };

        } catch (error) {
            console.error('❌ Error calculating date range payroll:', error);
            throw error;
        }
    }

    // =============================================
    // HELPER METHODS
    // =============================================

    async getEmployeeDetails(clientId, employeeId) {
        const [rows] = await this.db.execute(`
            SELECT
                employee_id,
                employee_code,
                full_name,
                designation,
                department,
                base_salary,
                employment_type,
                hire_date,
                status
            FROM employees
            WHERE client_id = ? AND employee_id = ? AND status = 'active'
        `, [clientId, employeeId]);

        return rows[0] || null;
    }

    async getAttendanceData(clientId, employeeId, startDate, endDate) {
        // Get attendance records
        const [attendanceRows] = await this.db.execute(`
            SELECT
                DATE(date) as work_date,
                check_in_time,
                check_out_time,
                work_duration,
                overtime_hours,
                arrival_status,
                departure_status,
                status
            FROM attendance
            WHERE client_id = ? AND employee_id = ?
            AND DATE(date) BETWEEN ? AND ?
            ORDER BY date
        `, [clientId, employeeId, startDate, endDate]);

        // Get leave records
        const [leaveRows] = await this.db.execute(`
            SELECT
                DATE(start_date) as leave_date,
                leave_type,
                status
            FROM leave_requests
            WHERE client_id = ? AND employee_id = ?
            AND status = 'approved'
            AND (
                (start_date BETWEEN ? AND ?) OR
                (end_date BETWEEN ? AND ?) OR
                (start_date <= ? AND end_date >= ?)
            )
        `, [clientId, employeeId, startDate, endDate, startDate, endDate, startDate, endDate]);

        // Process attendance data
        let daysWorked = 0;
        let totalHours = 0;
        let overtimeHours = 0;
        let leaveDays = leaveRows.length;

        // Count working days and calculate hours
        attendanceRows.forEach(record => {
            if (record.status === 'present') {
                daysWorked++;
                totalHours += record.work_duration || 0;
                overtimeHours += record.overtime_hours || 0;
            }
        });

        // Calculate absent days (total days - worked days - leave days - weekends)
        const totalDays = moment(endDate).diff(moment(startDate), 'days') + 1;
        const weekends = this.calculateWeekends(startDate, endDate);
        const absentDays = Math.max(0, totalDays - daysWorked - leaveDays - weekends);

        return {
            daysWorked,
            totalHours,
            overtimeHours,
            leaveDays,
            absentDays,
            attendanceRecords: attendanceRows
        };
    }

    async getPayrollSettings(clientId) {
        const [rows] = await this.db.execute(`
            SELECT setting_key, setting_value
            FROM client_settings
            WHERE client_id = ? AND setting_key LIKE 'payroll_%'
        `, [clientId]);

        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = JSON.parse(row.setting_value);
        });

        // Default settings if not found
        return {
            working_hours_per_day: settings.payroll_working_hours_per_day || 8,
            overtime_rate: settings.payroll_overtime_rate || 1.5,
            tax_rate: settings.payroll_tax_rate || 0.15,
            pf_rate: settings.payroll_pf_rate || 0.08,
            ...settings
        };
    }

    async calculateEarnings(employee, attendanceData, settings, startDate, endDate, prorationFactor = null) {
        const totalDaysInMonth = startDate.daysInMonth();
        const daysInPeriod = endDate.diff(startDate, 'days') + 1;
        const factor = prorationFactor || (daysInPeriod / totalDaysInMonth);

        // Base salary (pro-rated)
        const baseSalary = Math.round(employee.base_salary * factor * 100) / 100;

        // Overtime calculation
        const overtimePay = attendanceData.overtimeHours * (employee.base_salary / (totalDaysInMonth * settings.working_hours_per_day)) * settings.overtime_rate;

        // Get allowances for the employee
        const allowances = await this.getEmployeeAllowances(employee.employee_id, factor);

        // Get bonuses for the period
        const bonuses = await this.getEmployeeBonuses(employee.employee_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

        const total = baseSalary + overtimePay + allowances.total + bonuses.total;

        return {
            baseSalary: Math.round(baseSalary * 100) / 100,
            overtime: Math.round(overtimePay * 100) / 100,
            allowances: allowances.total,
            bonuses: bonuses.total,
            total: Math.round(total * 100) / 100
        };
    }

    async calculateDeductions(employee, earnings, settings, prorationFactor = 1) {
        // Tax calculation
        const tax = this.payrollService.calculateProgressiveTax(earnings.total);

        // Provident Fund
        const providentFund = Math.round(earnings.baseSalary * settings.pf_rate * 100) / 100;

        // Insurance (if applicable)
        const insurance = await this.getEmployeeInsuranceDeduction(employee.employee_id, prorationFactor);

        // Loan deductions
        const loans = await this.getEmployeeLoanDeductions(employee.employee_id, prorationFactor);

        // Other deductions
        const other = await this.getOtherDeductions(employee.employee_id, prorationFactor);

        const total = tax + providentFund + insurance + loans + other;

        return {
            tax: Math.round(tax * 100) / 100,
            providentFund: Math.round(providentFund * 100) / 100,
            insurance: Math.round(insurance * 100) / 100,
            loans: Math.round(loans * 100) / 100,
            other: Math.round(other * 100) / 100,
            total: Math.round(total * 100) / 100
        };
    }

    async projectFullMonthSalary(employee, attendanceData, settings, startOfMonth, endOfMonth) {
        // Calculate average daily performance
        const daysCalculated = moment().diff(startOfMonth, 'days') + 1;
        const avgHoursPerDay = attendanceData.totalHours / Math.max(1, attendanceData.daysWorked);
        const avgOvertimePerDay = attendanceData.overtimeHours / daysCalculated;

        // Project for remaining days
        const remainingDays = endOfMonth.diff(moment(), 'days');
        const workingDaysRemaining = Math.max(0, remainingDays - this.calculateWeekends(moment().add(1, 'day').format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD')));

        // Projected totals
        const projectedTotalHours = attendanceData.totalHours + (workingDaysRemaining * avgHoursPerDay);
        const projectedOvertimeHours = attendanceData.overtimeHours + (workingDaysRemaining * avgOvertimePerDay);
        const projectedDaysWorked = attendanceData.daysWorked + workingDaysRemaining;

        // Calculate projected earnings
        const projectedEarnings = await this.calculateEarnings(
            employee,
            {
                ...attendanceData,
                totalHours: projectedTotalHours,
                overtimeHours: projectedOvertimeHours,
                daysWorked: projectedDaysWorked
            },
            settings,
            startOfMonth,
            endOfMonth
        );

        const projectedDeductions = await this.calculateDeductions(employee, projectedEarnings, settings);
        const projectedNetSalary = projectedEarnings.total - projectedDeductions.total;

        return {
            projected_days_worked: projectedDaysWorked,
            projected_total_hours: Math.round(projectedTotalHours * 100) / 100,
            projected_overtime_hours: Math.round(projectedOvertimeHours * 100) / 100,
            projected_gross_salary: projectedEarnings.total,
            projected_total_deductions: projectedDeductions.total,
            projected_net_salary: Math.round(projectedNetSalary * 100) / 100,
            confidence_level: Math.min(95, Math.max(50, (daysCalculated / endOfMonth.date()) * 100))
        };
    }

    // Utility methods
    calculateWeekends(startDate, endDate) {
        let weekends = 0;
        let current = moment(startDate);
        const end = moment(endDate);

        while (current <= end) {
            if (current.day() === 0 || current.day() === 6) { // Sunday or Saturday
                weekends++;
            }
            current.add(1, 'day');
        }

        return weekends;
    }

    // Placeholder methods for allowances, bonuses, and deductions
    async getEmployeeAllowances(employeeId, prorationFactor) {
        // TODO: Implement allowances calculation
        return { total: 0 };
    }

    async getEmployeeBonuses(employeeId, startDate, endDate) {
        // TODO: Implement bonuses calculation
        return { total: 0 };
    }

    async getEmployeeInsuranceDeduction(employeeId, prorationFactor) {
        // TODO: Implement insurance deduction
        return 0;
    }

    async getEmployeeLoanDeductions(employeeId, prorationFactor) {
        // TODO: Implement loan deduction
        return 0;
    }

    async getOtherDeductions(employeeId, prorationFactor) {
        // TODO: Implement other deductions
        return 0;
    }
}

module.exports = LivePayrollCalculator;