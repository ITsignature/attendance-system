const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const HolidayService = require('./HolidayService');
const { SettingsHelper } = require('../utils/settingsHelper');
const FinancialRecordsIntegration = require('./FinancialRecordsIntegration');
const payrollLogger = require('../utils/payrollLogger');

class PayrollRunService {
    
    // =============================================
    // PAYROLL RUN MANAGEMENT
    // =============================================
    
    /**
     * Create a new payroll run for a period
     */
    async createPayrollRun(clientId, userId, data) {
        const {
            period_id,
            run_name,
            run_type = 'regular',
            calculation_method = 'advanced',
            employee_filters = {},
            notes = null
        } = data;

        const db = getDB();
        const runId = uuidv4();

        try {
            await db.execute('START TRANSACTION');

            // Generate run number
            const [periodInfo] = await db.execute(
                'SELECT period_year, period_number, period_type FROM payroll_periods WHERE id = ? AND client_id = ?',
                [period_id, clientId]
            );

            if (periodInfo.length === 0) {
                throw new Error('Payroll period not found');
            }

            const period = periodInfo[0];
            const run_number = `${period.period_type.toUpperCase()}_${period.period_year}_${String(period.period_number).padStart(2, '0')}_${run_type.toUpperCase()}`;

            // Auto-generate run_name if not provided
            const finalRunName = run_name || `${period.period_type} Payroll - ${period.period_year}/${String(period.period_number).padStart(2, '0')}`;

            // Check for duplicate run number
            const [existing] = await db.execute(
                'SELECT id FROM payroll_runs WHERE client_id = ? AND run_number = ?',
                [clientId, run_number]
            );

            if (existing.length > 0) {
                throw new Error('Payroll run already exists for this period and type');
            }

            // Create payroll run
            await db.execute(`
                INSERT INTO payroll_runs (
                    id, client_id, run_number, period_id, run_name, run_type,
                    run_status, calculation_method, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
            `, [runId, clientId, run_number, period_id, finalRunName, run_type, calculation_method, notes, userId]);

            // Get eligible employees based on filters
            const employees = await this.getEligibleEmployees(clientId, period_id, employee_filters);

            // Create draft payroll records for eligible employees
            for (const employee of employees) {
                await this.createDraftPayrollRecord(runId, employee);
            }

            // Update run statistics
            await this.updateRunStatistics(runId);

            await db.execute('COMMIT');

            return {
                success: true,
                data: {
                    run_id: runId,
                    run_number,
                    total_employees: employees.length,
                    status: 'draft'
                }
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }

    // =============================================
    // DAILY INCREMENTAL CALCULATION METHODS
    // =============================================

    /**
     * Calculate payroll for a SINGLE DAY only (incremental calculation)
     * Reuses existing calculation methods for consistency
     */
    // async calculateSingleDay(employeeId, runId, targetDate, clientId) {
    //     const db = getDB();

    //     try {
    //         // Get period info and employee base salary
    //         const [periodInfo] = await db.execute(`
    //             SELECT pp.*, pr.calculation_method, e.base_salary, e.department_id, e.in_time, e.out_time
    //             FROM payroll_runs pr
    //             JOIN payroll_periods pp ON pr.period_id = pp.id
    //             JOIN employees e ON e.id = ?
    //             WHERE pr.id = ? AND pr.client_id = ?
    //         `, [employeeId, runId, clientId]);

    //         if (periodInfo.length === 0) {
    //             throw new Error('Payroll run or employee not found');
    //         }

    //         const period = periodInfo[0];
    //         const baseSalary = parseFloat(period.base_salary);
    //         const departmentId = period.department_id;

    //         // Calculate total working days in FULL MONTH for per-day rate (consistent across all days)
    //         const fullMonthWorkingDaysCalc = await HolidayService.calculateWorkingDays(
    //             clientId,
    //             period.period_start_date,
    //             period.period_end_date,
    //             departmentId,
    //             false,
    //             employeeId
    //         );

    //         const effectiveWorkingDays = await this.calculateEffectiveWorkingDays(
    //             fullMonthWorkingDaysCalc,
    //             employeeId,
    //             period.period_start_date,
    //             period.period_end_date
    //         );

    //         const perDaySalary = baseSalary / effectiveWorkingDays;

    //         // Calculate employee daily hours from scheduled times
    //         // Priority: 1) Attendance records, 2) Employee profile times, 3) Default 8 hours
    //         let employeeDailyHours = await this.getEmployeeDailyHoursForDate(employeeId, targetDate, null);

    //         // If attendance lookup didn't find scheduled times, try employee's profile in_time/out_time
    //         if (!employeeDailyHours && period.in_time && period.out_time) {
    //             const inTime = new Date(`1970-01-01T${period.in_time}`);
    //             const outTime = new Date(`1970-01-01T${period.out_time}`);
    //             employeeDailyHours = (outTime - inTime) / (1000 * 60 * 60);
    //         }

    //         // Final fallback to 8 hours if nothing found
    //         if (!employeeDailyHours) {
    //             employeeDailyHours = 8;
    //         }

    //         const hourlyRate = perDaySalary / employeeDailyHours;

    //         // Get attendance for this specific day
    //         const [attendanceRecords] = await db.execute(`
    //             SELECT
    //                 date,
    //                 check_in_time,
    //                 check_out_time,
    //                 total_hours,
    //                 total_work_duration,
    //                 overtime_hours,
    //                 break_duration,
    //                 is_late,
    //                 is_early_leave,
    //                 late_minutes,
    //                 early_leave_minutes,
    //                 status,
    //                 scheduled_in_time,
    //                 scheduled_out_time
    //             FROM attendance
    //             WHERE employee_id = ?
    //               AND DATE(date) = ?
    //         `, [employeeId, targetDate]);

    //         // Create mock working hours object for existing methods
    //         const workingHours = { hours_per_day: employeeDailyHours };

    //         // Use existing calculateAttendanceSummary method
    //         const attendanceSummary = await this.calculateAttendanceSummary(
    //             attendanceRecords,
    //             workingHours,
    //             employeeId,
    //             db,
    //             runId
    //         );

    //         // Get approved leaves for this day
    //         const [leaves] = await db.execute(`
    //             SELECT leave_type, is_paid, deduction_percentage
    //             FROM leave_requests
    //             WHERE employee_id = ?
    //               AND status = 'approved'
    //               AND ? BETWEEN start_date AND end_date
    //         `, [employeeId, targetDate]);

    //         const dailyLeaves = leaves.map(l => ({
    //             leave_type: l.leave_type,
    //             is_paid: l.is_paid,
    //             deduction_percentage: l.deduction_percentage,
    //             days: 1
    //         }));

    //         // Calculate earnings for this day
    //         let dailyEarnings = attendanceSummary.summary.totalWorkedHours * hourlyRate;

    //         // Use existing calculateAttendanceDeductions method for consistency
    //         const deductionResult = await this.calculateAttendanceDeductions(
    //             employeeId,
    //             runId,
    //             baseSalary,
    //             attendanceSummary,
    //             dailyLeaves
    //         );

    //         const dailyDeductions = deductionResult.total;
    //         const dailyNetSalary = dailyEarnings - dailyDeductions;

    //         console.log(`📊 Day ${targetDate}: Worked=${attendanceSummary.summary.totalWorkedHours}h, Earnings=Rs.${dailyEarnings.toFixed(2)}, Deductions=Rs.${dailyDeductions.toFixed(2)}, Net=Rs.${dailyNetSalary.toFixed(2)}`);

    //         return {
    //             worked_hours: attendanceSummary.summary.totalWorkedHours,
    //             earnings: dailyEarnings,
    //             deductions: dailyDeductions,
    //             net_salary: dailyNetSalary,
    //             target_date: targetDate,
    //             deduction_components: deductionResult.components
    //         };

    //     } catch (error) {
    //         console.error(`❌ Error calculating single day for employee ${employeeId} on ${targetDate}:`, error);
    //         throw error;
    //     }
    // }

    // /**
    //  * Calculate daily increment and update cumulative totals
    //  */
    // async calculateDailyIncrement(runId, employeeId, clientId) {
    //     const db = getDB();
    //     const today = new Date().toISOString().split('T')[0];

    //     try {
    //         // Get current payroll record state
    //         const [records] = await db.execute(`
    //             SELECT
    //                 last_processed_date,
    //                 net_salary,
    //                 total_earnings,
    //                 total_deductions,
    //                 worked_hours,
    //                 calculation_status
    //             FROM payroll_records
    //             WHERE run_id = ? AND employee_id = ?
    //         `, [runId, employeeId]);

    //         if (records.length === 0) {
    //             throw new Error('Payroll record not found');
    //         }

    //         const record = records[0];
    //         const lastProcessedDate = record.last_processed_date;

    //         // Check if already processed today
    //         if (lastProcessedDate === today) {
    //             console.log(`✅ Employee ${employeeId} already processed for ${today}`);
    //             return {
    //                 success: true,
    //                 message: 'Already processed today',
    //                 skipped: true
    //             };
    //         }

    //         // Determine which date to process
    //         // If never processed before, start from period start
    //         // If processed before, process the next day after last_processed_date
    //         let dateToProcess;
    //         if (!lastProcessedDate) {
    //             // First time processing - get period start date
    //             const [periodInfo] = await db.execute(`
    //                 SELECT pp.period_start_date
    //                 FROM payroll_runs pr
    //                 JOIN payroll_periods pp ON pr.period_id = pp.id
    //                 WHERE pr.id = ?
    //             `, [runId]);
    //             dateToProcess = periodInfo[0].period_start_date;
    //         } else {
    //             // Process next day after last processed
    //             const nextDate = new Date(lastProcessedDate);
    //             nextDate.setDate(nextDate.getDate() + 1);
    //             dateToProcess = nextDate.toISOString().split('T')[0];
    //         }

    //         // Make sure we don't process future dates
    //         if (dateToProcess > today) {
    //             console.log(`✅ No new days to process for employee ${employeeId}`);
    //             return {
    //                 success: true,
    //                 message: 'No new days to process',
    //                 skipped: true
    //             };
    //         }

    //         // Calculate only today's data
    //         const todayData = await this.calculateSingleDay(employeeId, runId, dateToProcess, clientId);

    //         // Update cumulative totals by ADDING today's values
    //         await db.execute(`
    //             UPDATE payroll_records SET
    //                 net_salary = COALESCE(net_salary, 0) + ?,
    //                 total_earnings = COALESCE(total_earnings, 0) + ?,
    //                 total_deductions = COALESCE(total_deductions, 0) + ?,
    //                 worked_hours = COALESCE(worked_hours, 0) + ?,
    //                 last_processed_date = ?,
    //                 calculated_at = NOW(),
    //                 calculation_status = 'calculated'
    //             WHERE run_id = ? AND employee_id = ?
    //         `, [
    //             todayData.net_salary,
    //             todayData.earnings,
    //             todayData.deductions,
    //             todayData.worked_hours,
    //             dateToProcess,
    //             runId,
    //             employeeId
    //         ]);

    //         console.log(`✅ Processed ${dateToProcess} for employee ${employeeId}:`, {
    //             earnings: todayData.earnings,
    //             deductions: todayData.deductions,
    //             net_salary: todayData.net_salary
    //         });

    //         return {
    //             success: true,
    //             processed_date: dateToProcess,
    //             daily_data: todayData
    //         };

    //     } catch (error) {
    //         console.error(`❌ Error in daily increment calculation:`, error);
    //         throw error;
    //     }
    // }

    // /**
    //  * Check if a date is a weekend for an employee
    //  */
    // async isWeekendDate(date, employeeId) {
    //     const targetDate = new Date(date);
    //     const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday

    //     // Get employee's weekend configuration
    //     const db = getDB();
    //     const [employee] = await db.execute(
    //         'SELECT department_id FROM employees WHERE id = ?',
    //         [employeeId]
    //     );

    //     if (employee.length === 0) return false;

    //     // Default weekends (Saturday and Sunday)
    //     const defaultWeekends = [0, 6];

    //     // You can enhance this to check department-specific weekend configurations
    //     return defaultWeekends.includes(dayOfWeek);
    // }

    /**
     * Calculate payroll for entire run
     */
    async calculatePayrollRun(runId, clientId, userId) {
        const db = getDB();

        // Start logging for this payroll calculation
        payrollLogger.startLogging(runId);
        console.log(`🚀 Starting payroll calculation for run: ${runId}`);
        console.log(`👤 Client ID: ${clientId}, User ID: ${userId}`);

        try {
            await db.execute('START TRANSACTION');

            // Verify run exists and is in correct status
            const [run] = await db.execute(
                'SELECT * FROM payroll_runs WHERE id = ? AND client_id = ? AND run_status IN ("draft", "calculating")',
                [runId, clientId]
            );

            if (run.length === 0) {
                throw new Error('Payroll run not found or cannot be calculated');
            }

            console.log(`✅ Payroll run verified: ${run[0].run_name} (${run[0].run_number})`);

            // Update status to calculating
            await db.execute(
                'UPDATE payroll_runs SET run_status = "calculating", calculation_started_at = NOW() WHERE id = ?',
                [runId]
            );
            console.log(`📊 Status updated to 'calculating'`);

            // Get all records in this run
            const [records] = await db.execute(`
                SELECT pr.*, e.base_salary, e.employee_type, e.department_id, e.designation_id, e.client_id
                FROM payroll_records pr
                JOIN employees e ON pr.employee_id = e.id
                WHERE pr.run_id = ? AND pr.calculation_status = 'pending'
            `, [runId]);

            let successCount = 0;
            let errorCount = 0;

            console.log(`👥 Processing ${records.length} employee records:`);
            console.log('=' .repeat(60));

            // Calculate each record
            for (const record of records) {
                console.log(`\n🧮 Processing: ${record.employee_name} (${record.employee_code})`);
                console.log(`📋 Record ID: ${record.id}`);

                try {
                    await this.calculateSingleRecord(record);
                    successCount++;
                    console.log(`✅ ${record.employee_name}: Calculation completed successfully`);
                } catch (error) {
                    console.error(`❌ ${record.employee_name}: Calculation failed`);
                    console.error(`Error calculating record ${record.id}:`, error.message);
                    console.error('Error details:', error);
                    await this.markRecordError(record.id, error.message);
                    errorCount++;
                }

                // Progress indicator
                const processed = successCount + errorCount;
                const progress = ((processed / records.length) * 100).toFixed(1);
                console.log(`📊 Progress: ${processed}/${records.length} (${progress}%)`);
            }

            console.log('\n' + '=' .repeat(60));
            console.log(`📈 Processing Summary: ${successCount} successful, ${errorCount} failed`);

            // Update run statistics and status
            await this.updateRunStatistics(runId);
            
            const finalStatus = errorCount > 0 ? 'calculated' : 'calculated'; // Can add 'partial' status if needed
            await db.execute(
                'UPDATE payroll_runs SET run_status = ?, calculation_completed_at = NOW(), processed_employees = ? WHERE id = ?',
                [finalStatus, successCount, runId]
            );

            // Log calculation completion
            await this.logAuditEvent(runId, null, 'calculate', userId, {
                success_count: successCount,
                error_count: errorCount
            });

            await db.execute('COMMIT');

            console.log(`🎉 Payroll calculation completed successfully!`);
            console.log(`📊 Final Summary: ${successCount} processed, ${errorCount} errors`);

            // Stop logging and save to file
            const logFilePath = await payrollLogger.stopLogging();

            return {
                success: true,
                data: {
                    run_id: runId,
                    processed_records: successCount,
                    error_records: errorCount,
                    status: finalStatus,
                    log_file_path: logFilePath // Include log file path in response
                }
            };

        } catch (error) {
            console.error(`❌ Payroll calculation failed:`, error);

            // Stop logging even on error and save error logs
            const logFilePath = await payrollLogger.stopLogging();

            await db.execute('ROLLBACK');

            // Add log file path to error for debugging
            const enhancedError = new Error(error.message);
            enhancedError.logFilePath = logFilePath;
            enhancedError.originalError = error;

            throw enhancedError;
        }
    }

    /**
     * Process payments for calculated payroll run
     */
    async processPayrollRun(runId, clientId, userId, paymentData = {}) {
        const {
            payment_method = 'bank_transfer',
            payment_date = new Date().toISOString().split('T')[0],
            batch_reference = null
        } = paymentData;

        const db = getDB();
        
        try {
            await db.execute('START TRANSACTION');

            // Verify run is calculated
            const [run] = await db.execute(
                'SELECT run_status FROM payroll_runs WHERE id = ? AND client_id = ? AND run_status = "calculated"',
                [runId, clientId]
            );

            if (run.length === 0) {
                throw new Error('Payroll run not found or not calculated for processing');
            }

            // Update run status to processing
            await db.execute(
                'UPDATE payroll_runs SET run_status = "processing", processed_by = ?, processed_at = NOW() WHERE id = ?',
                [userId, runId]
            );

            // Update all payroll records payment status
            const [updateResult] = await db.execute(`
                UPDATE payroll_records 
                SET payment_status = 'paid', 
                    payment_method = ?, 
                    payment_date = ?, 
                    payment_reference = ?
                WHERE run_id = ? AND calculation_status = 'calculated'
            `, [payment_method, payment_date, batch_reference, runId]);

            // Mark run as completed
            await db.execute(
                'UPDATE payroll_runs SET run_status = "completed", completed_at = NOW() WHERE id = ?',
                [runId]
            );

            // Log processing
            await this.logAuditEvent(runId, null, 'process', userId, {
                payment_method,
                payment_date,
                batch_reference,
                records_processed: updateResult.affectedRows
            });

            await db.execute('COMMIT');

            return {
                success: true,
                data: {
                    run_id: runId,
                    records_processed: updateResult.affectedRows,
                    payment_date,
                    status: 'completed'
                }
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Cancel payroll run (Delete completely from system)
     */
    async cancelPayrollRun(runId, clientId, userId, cancellationReason = '') {
        const db = getDB();
        
        try {
            await db.execute('START TRANSACTION');

            // Verify run exists and can be cancelled
            const [run] = await db.execute(
                'SELECT run_status FROM payroll_runs WHERE id = ? AND client_id = ?',
                [runId, clientId]
            );

            if (run.length === 0) {
                throw new Error('Payroll run not found');
            }

            // Check if run can be cancelled
            const cancellableStatuses = ['draft', 'calculated'];
            if (!cancellableStatuses.includes(run[0].run_status)) {
                throw new Error(`Cannot cancel payroll run in ${run[0].run_status} status. Only draft or calculated status runs can be cancelled.`);
            }

            // Log cancellation before deletion
            await this.logAuditEvent(runId, null, 'cancel', userId, {
                cancellation_reason: cancellationReason,
                previous_status: run[0].run_status,
                action: 'deleted'
            });

            // Delete related records in proper order to avoid foreign key constraints
            
            // 1. Delete payroll record components (depends on payroll_records)
            await db.execute(
                'DELETE prc FROM payroll_record_components prc INNER JOIN payroll_records pr ON prc.record_id = pr.id WHERE pr.run_id = ?',
                [runId]
            );

            // 2. Delete payroll records
            await db.execute(
                'DELETE FROM payroll_records WHERE run_id = ?',
                [runId]
            );

            // 3. Delete payroll reports (if table exists - currently not implemented)
            // await db.execute(
            //     'DELETE FROM payroll_reports WHERE run_id = ?',
            //     [runId]
            // );

            // 4. Delete audit logs (optional - you may want to keep these for compliance)
            // Note: Uncomment if you want to delete audit logs as well
            // await db.execute(
            //     'DELETE FROM payroll_audit_log WHERE run_id = ?',
            //     [runId]
            // );

            // 5. Finally delete the payroll run itself
            await db.execute(
                'DELETE FROM payroll_runs WHERE id = ?',
                [runId]
            );

            await db.execute('COMMIT');

            return {
                success: true,
                data: {
                    run_id: runId,
                    status: 'deleted',
                    cancelled_by: userId,
                    cancellation_reason: cancellationReason,
                    message: 'Payroll run has been permanently removed from the system'
                }
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }

    // =============================================
    // HELPER METHODS
    // =============================================

    /**
     * Get eligible employees for payroll run
     */
    async getEligibleEmployees(clientId, periodId, filters = {}) {
        const db = getDB();
        
        let whereConditions = ['e.client_id = ?', 'e.employment_status = "active"'];
        let queryParams = [clientId];

        // Apply filters
        if (filters.department_id) {
            whereConditions.push('e.department_id = ?');
            queryParams.push(filters.department_id);
        }

        if (filters.employee_ids && filters.employee_ids.length > 0) {
            const placeholders = filters.employee_ids.map(() => '?').join(',');
            whereConditions.push(`e.id IN (${placeholders})`);
            queryParams.push(...filters.employee_ids);
        }

        if (filters.employee_type) {
            whereConditions.push('e.employee_type = ?');
            queryParams.push(filters.employee_type);
        }

        const [employees] = await db.execute(`
            SELECT 
                e.id, e.employee_code, e.first_name, e.last_name, e.base_salary,
                e.department_id, e.designation_id, e.employee_type,
                d.name as department_name,
                des.title as designation_name
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations des ON e.designation_id = des.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY e.employee_code
        `, queryParams);

        return employees;
    }

    /**
     * Create draft payroll record for employee with pre-calculated working days and daily hours
     */
    async createDraftPayrollRecord(runId, employee) {
        const db = getDB();
        const recordId = uuidv4();

        // Get payroll period information and working hours settings
        const [periodInfo] = await db.execute(`
            SELECT pp.period_start_date, pp.period_end_date, pr.client_id
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE pr.id = ?
        `, [runId]);

        if (periodInfo.length === 0) {
            throw new Error('Payroll run or period not found');
        }

        const period = periodInfo[0];
        const clientId = period.client_id;

        // Get default working hours from system settings
        let defaultHoursPerDay = 8;
        try {
            const SettingsHelper = require('../utils/settingsHelper').SettingsHelper;
            const settingsHelper = new SettingsHelper(clientId);
            const hoursPerDay = await settingsHelper.getSetting('working_hours_per_day');
            defaultHoursPerDay = hoursPerDay ? Number(hoursPerDay) : 8;
        } catch (error) {
            console.log('Error loading working hours from system settings, using default 8 hours:', error.message);
        }

        // Calculate working days for this employee for the payroll period
        const HolidayService = require('./HolidayService');
        const workingDaysCalc = await HolidayService.calculateWorkingDays(
            clientId,
            period.period_start_date,
            period.period_end_date,
            employee.department_id,
            false, // includeOptionalHolidays
            employee.id // employeeId for individual weekend config
        );

        // Calculate weekday working days (exclude weekend working days)
        const weekdayWorkingDays = workingDaysCalc.working_days - workingDaysCalc.weekend_working_days;
        const workingSaturdays = workingDaysCalc.working_saturdays || 0;
        const workingSundays = workingDaysCalc.working_sundays || 0;

        // Pre-calculate daily hours for weekdays, Saturday, and Sunday
        const weekdayDailyHours = await this.getEmployeeDailyHoursForDayType(
            employee.id,
            defaultHoursPerDay,
            period.period_start_date,
            period.period_end_date,
            'weekday'
        );

        const saturdayDailyHours = await this.getEmployeeDailyHoursForDayType(
            employee.id,
            defaultHoursPerDay,
            period.period_start_date,
            period.period_end_date,
            'saturday'
        );

        const sundayDailyHours = await this.getEmployeeDailyHoursForDayType(
            employee.id,
            defaultHoursPerDay,
            period.period_start_date,
            period.period_end_date,
            'sunday'
        );

        // Calculate daily salary and hourly rates
        const baseSalary = parseFloat(employee.base_salary) || 0;
        const totalWorkingDays = weekdayWorkingDays + workingSaturdays + workingSundays;

        // Calculate daily salary (same for all days)
        const dailySalary = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;

        // Calculate hourly rates for each day type
        const weekdayHourlyRate = weekdayDailyHours > 0 ? dailySalary / weekdayDailyHours : 0;
        const saturdayHourlyRate = saturdayDailyHours > 0 ? dailySalary / saturdayDailyHours : 0;
        const sundayHourlyRate = sundayDailyHours > 0 ? dailySalary / sundayDailyHours : 0;

        console.log(`📊 Pre-calculated values for ${employee.first_name} ${employee.last_name}:`);
        console.log(`   Working Days - Weekdays: ${weekdayWorkingDays}, Saturdays: ${workingSaturdays}, Sundays: ${workingSundays}, Total: ${totalWorkingDays}`);
        console.log(`   Daily Hours - Weekdays: ${weekdayDailyHours}h, Saturday: ${saturdayDailyHours}h, Sunday: ${sundayDailyHours}h`);
        console.log(`   Base Salary: Rs. ${baseSalary.toLocaleString()}`);
        console.log(`   Daily Salary: Rs. ${dailySalary.toFixed(2)} (${baseSalary} ÷ ${totalWorkingDays})`);
        console.log(`   Hourly Rates - Weekday: Rs. ${weekdayHourlyRate.toFixed(2)}, Saturday: Rs. ${saturdayHourlyRate.toFixed(2)}, Sunday: Rs. ${sundayHourlyRate.toFixed(2)}`);

        await db.execute(`
            INSERT INTO payroll_records (
                id, run_id, employee_id, employee_code, employee_name,
                department_name, designation_name, calculation_status,
                base_salary,
                weekday_working_days, working_saturdays, working_sundays,
                weekday_daily_hours, saturday_daily_hours, sunday_daily_hours,
                daily_salary, weekday_hourly_rate, saturday_hourly_rate, sunday_hourly_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            recordId, runId, employee.id, employee.employee_code,
            `${employee.first_name} ${employee.last_name}`,
            employee.department_name, employee.designation_name,
            baseSalary,
            weekdayWorkingDays, workingSaturdays, workingSundays,
            weekdayDailyHours, saturdayDailyHours, sundayDailyHours,
            dailySalary, weekdayHourlyRate, saturdayHourlyRate, sundayHourlyRate
        ]);

        return recordId;
    }

    /**
     * Calculate single payroll record with proper method selection
     *
     * NEW OPTIMIZED APPROACH (October 2025):
     * - Pre-calculated values (working days, daily hours, salary rates) are retrieved from payroll_records
     * - Attendance deduction = earned_salary calculated as: worked_hours × hourly_rate (by day type)
     * - No more "expected hours" calculation
     * - No more "shortfall" calculation
     * - Simple formula: deduction = base_salary - earned_salary
     * - HolidayService.calculateWorkingDays() is NO LONGER called during calculation (called once during run creation)
     */
    async calculateSingleRecord(record) {
        const db = getDB();

        console.log(`\n${'='.repeat(70)}`);
        console.log(`🧮 CALCULATING PAYROLL: ${record.employee_name} (${record.employee_code})`);
        console.log(`${'='.repeat(70)}`);

        // Get the calculation method from the run
        const [runInfo] = await db.execute(
            'SELECT calculation_method, period_id FROM payroll_runs WHERE id = ?',
            [record.run_id]
        );
        const calculationMethod = runInfo[0]?.calculation_method || 'advanced';
        const periodId = runInfo[0]?.period_id;

        // Get payroll period information for financial records processing
        const [periodInfo] = await db.execute(
            'SELECT period_start_date, period_end_date FROM payroll_periods WHERE id = ?',
            [periodId]
        );
        const payrollPeriod = {
            start: periodInfo[0]?.period_start_date,
            end: periodInfo[0]?.period_end_date
        };

        // Get employee allowances and deductions
        const employeeData = await this.getEmployeePayrollData(record.employee_id, record.client_id, record.run_id);

        // NOTE: We no longer need getAttendanceSummary() or approvedLeaves since we're using the new optimized
        // calculateEarnedSalary() method which directly queries worked hours from attendance table
        // Old method (calculateAttendanceDeductions) used these, but it's no longer called

        // =============================================
        // PROCESS FINANCIAL RECORDS (LOANS, ADVANCES, BONUSES)
        // =============================================
        console.log(`\n🔄 Processing financial records...`);
        const financialAdjustments = await FinancialRecordsIntegration.processFinancialRecords(
            record.employee_id,
            payrollPeriod,
            record.run_id
        );

        // Calculate gross salary with all components
        console.log(`\n💰 Calculating gross salary components...`);
        const grossComponents = await this.calculateGrossComponents(record, employeeData);
        let grossSalary = grossComponents.total; // Base + Allowances + Overtime

        // Add financial bonuses to gross salary
        if (financialAdjustments.bonuses > 0) {
            grossSalary += financialAdjustments.bonuses;
            console.log(`   ✅ Added financial bonuses: Rs.${financialAdjustments.bonuses.toFixed(2)} to gross salary`);
        }

        // Calculate attendance-based deductions using NEW OPTIMIZED METHOD
        const attendanceDeductions = await this.calculateEarnedSalary(
            record.employee_id,
            record.run_id,
            parseFloat(record.base_salary) || 0
        );

        // Calculate regular deductions based on method
        const deductionComponents = await this.calculateDeductions(grossSalary, calculationMethod, employeeData);
        console.log(`Regular deductions for ${record.employee_name}:`, deductionComponents);

        // Combine all deductions: regular + attendance + financial
        const combinedDeductions = {
            components: [
                ...deductionComponents.components,
                ...attendanceDeductions.components
            ],
            total: deductionComponents.total + attendanceDeductions.total + financialAdjustments.summary.totalDeductions
        };

        // Add financial deduction components
        if (financialAdjustments.loanDeductions > 0) {
            combinedDeductions.components.push({
                code: 'LOAN_DED',
                name: 'Loan Deductions',
                type: 'deduction',
                category: 'loan', // Use existing enum value
                amount: financialAdjustments.loanDeductions,
                details: `${financialAdjustments.records.loans.length} loan(s)`
            });
        }

        if (financialAdjustments.advanceDeductions > 0) {
            combinedDeductions.components.push({
                code: 'ADVANCE_DED',
                name: 'Advance Deductions',
                type: 'deduction',
                category: 'other', // Use existing enum value
                amount: financialAdjustments.advanceDeductions,
                details: `${financialAdjustments.records.advances.length} advance(s)`
            });
        }

        console.log(`Combined deductions for ${record.employee_name}:`, combinedDeductions);
        const totalDeductions = combinedDeductions.total;

        // Tax calculation removed - calculate net salary without taxes
        const totalTaxes = 0;
        const taxComponents = { total: 0, components: [] };

        const netSalary = grossSalary - totalDeductions;

        // Update record with calculated amounts
        await db.execute(`
            UPDATE payroll_records SET
                total_earnings = ?,
                total_deductions = ?,
                total_taxes = ?,
                gross_salary = ?,
                taxable_income = ?,
                net_salary = ?,
                calculation_status = 'calculated',
                calculated_at = NOW()
            WHERE id = ?
        `, [
            Math.round((grossComponents.additionsTotal + financialAdjustments.bonuses) * 100) / 100,
            Math.round(totalDeductions * 100) / 100,
            Math.round(totalTaxes * 100) / 100,
            Math.round(grossSalary * 100) / 100,
            Math.round(grossSalary * 100) / 100,
            Math.round(netSalary * 100) / 100,
            record.id
        ]);

        // Create detailed component records with financial components
        const updatedGrossComponents = {
            components: [...grossComponents.components]
        };

        // Add bonus components to gross
        if (financialAdjustments.bonuses > 0) {
            updatedGrossComponents.components.push({
                code: 'BONUS',
                name: 'Financial Bonuses',
                type: 'earning',
                category: 'bonus', // Use existing enum value
                amount: financialAdjustments.bonuses,
                details: `${financialAdjustments.records.bonuses.length} bonus(es)`
            });
        }

        try {
            await this.createPayrollComponents(record.id, {
                grossComponents: { components: updatedGrossComponents.components },
                deductionComponents: combinedDeductions,
                taxComponents
            }, record.client_id);
        } catch (componentError) {
            console.log(`Component creation failed for record ${record.id}: ${componentError.message}`);
            console.log(`Combined deductions structure:`, JSON.stringify(combinedDeductions, null, 2));
            // Continue with calculation even if component creation fails
        }

        // =============================================
        // UPDATE FINANCIAL RECORDS BALANCES
        // =============================================
        try {
            await FinancialRecordsIntegration.updateFinancialBalances(
                record.employee_id,
                financialAdjustments,
                record.run_id
            );
            console.log(`✅ Financial balances updated successfully`);
        } catch (error) {
            console.error(`❌ Error updating financial balances:`, error.message);
            // Log but don't fail the payroll calculation
        }

        // =============================================
        // CALCULATION SUMMARY
        // =============================================
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 PAYROLL CALCULATION SUMMARY: ${record.employee_name}`);
        console.log(`${'='.repeat(70)}`);
        console.log(`   Gross Salary: Rs.${grossSalary.toFixed(2)}`);
        console.log(`   Total Deductions: Rs.${totalDeductions.toFixed(2)}`);
        console.log(`      - Attendance Deduction: Rs.${attendanceDeductions.total.toFixed(2)}`);
        console.log(`      - Other Deductions: Rs.${(totalDeductions - attendanceDeductions.total).toFixed(2)}`);
        console.log(`   ─────────────────────────────────────────────────────────────────────`);
        console.log(`   NET SALARY: Rs.${netSalary.toFixed(2)}`);
        console.log(`${'='.repeat(70)}\n`);
    }

    /**
     * Get attendance summary for employee during payroll period
     */
    async getAttendanceSummary(employeeId, runId) {
        const db = getDB();

        // Calculate up to today instead of full period
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        const [attendanceData] = await db.execute(`
            SELECT
                a.date,
                a.check_in_time,
                a.check_out_time,
                a.total_hours,
                a.overtime_hours,
                a.break_duration,
                a.status,
                a.notes,
                a.scheduled_in_time,
                a.scheduled_out_time,
                a.payable_duration,
                a.is_weekend
            FROM attendance a
            JOIN payroll_runs pr ON pr.id = ?
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE a.employee_id = ?
              AND DATE(a.date) BETWEEN pp.period_start_date AND LEAST(pp.period_end_date, CURDATE())
            ORDER BY a.date
        `, [runId, employeeId]);

        console.log(`🔍 Fetched ${attendanceData.length} attendance records for employee ${employeeId}`);
        if (attendanceData.length === 0) {
            console.log(`⚠️  ATTENTION: Employee ${employeeId} has NO attendance records in this payroll period!`);
        }

        // Get client ID for settings lookup
        const [employeeInfo] = await db.execute(`
            SELECT client_id FROM employees WHERE id = ?
        `, [employeeId]);
        
        const clientId = employeeInfo[0]?.client_id;
        
        // Get working hours configuration from system settings
        let workingHours = {
            hours_per_day: 8,
            late_threshold: 15,
            full_day_minimum_hours: 7,
            half_day_minimum_hours: 4,
            short_leave_minimum_hours: 1,
            start_time: '09:00:00',
            end_time: '17:00:00'
        };

        if (clientId) {
            try {
                const settingsHelper = new SettingsHelper(clientId);
                
                // Get settings from system_settings table
                const hoursPerDay = await settingsHelper.getSetting('working_hours_per_day') || 8;
                const startTime = await settingsHelper.getSetting('work_start_time') || '09:00:00';
                const endTime = await settingsHelper.getSetting('work_end_time') || '17:00:00';
                const lateThreshold = await settingsHelper.getSetting('late_threshold_minutes') || 15;
                const fullDayHours = await settingsHelper.getSetting('full_day_minimum_hours') || 7;
                const halfDayHours = await settingsHelper.getSetting('half_day_minimum_hours') || 4;
                const shortLeaveHours = await settingsHelper.getSetting('short_leave_minimum_hours') || 1;
                
                workingHours = {
                    hours_per_day: Number(hoursPerDay),
                    late_threshold: Number(lateThreshold),
                    full_day_minimum_hours: Number(fullDayHours),
                    half_day_minimum_hours: Number(halfDayHours),
                    short_leave_minimum_hours: Number(shortLeaveHours),
                    start_time: startTime,
                    end_time: endTime
                };
                
                console.log(`✅ Loaded working hours from system settings: ${hoursPerDay} hours/day`);
            } catch (error) {
                console.log('Error loading working hours from system settings, using defaults:', error.message);
            }
        }

        // Get pre-calculated values from payroll_records
        const [payrollRecord] = await db.execute(`
            SELECT
                weekday_working_days, working_saturdays, working_sundays,
                weekday_daily_hours, saturday_daily_hours, sunday_daily_hours
            FROM payroll_records
            WHERE run_id = ? AND employee_id = ?
            LIMIT 1
        `, [runId, employeeId]);

        const preCalculatedValues = payrollRecord && payrollRecord[0] ? payrollRecord[0] : null;

        return {
            attendanceRecords: attendanceData,
            workingHours: workingHours,
            summary: await this.calculateAttendanceSummary(attendanceData, workingHours, employeeId, db, runId, preCalculatedValues)
        };
    }

    /**
     * Get approved leaves for employee during payroll period
     */
    async getApprovedLeaves(employeeId, runId) {
        const db = getDB();

        // Only get leaves up to today
        const [leaves] = await db.execute(`
            SELECT
                lr.start_date,
                lr.end_date,
                lr.days_requested,
                lr.reason,
                lt.name as leave_type_name,
                lt.is_paid
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            JOIN payroll_runs pr ON pr.id = ?
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE lr.employee_id = ?
              AND lr.status = 'approved'
              AND lr.start_date <= CURDATE()
              AND (
                (lr.start_date BETWEEN pp.period_start_date AND LEAST(pp.period_end_date, CURDATE()))
                OR (lr.end_date BETWEEN pp.period_start_date AND LEAST(pp.period_end_date, CURDATE()))
                OR (lr.start_date <= pp.period_start_date AND lr.end_date >= pp.period_start_date)
              )
        `, [runId, employeeId]);

        return leaves;
    }

    /**
     * Calculate attendance summary statistics
     * Aggregates worked hours, overtime, attendance counts, and late minutes
     */
    async calculateAttendanceSummary(attendanceRecords, workingHours, employeeId, db, runId = null, preCalculatedValues = null) {
        const summary = {
            totalWorkDays: attendanceRecords.length,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            halfDays: 0,
            onLeaveDays: 0,
            totalWorkedHours: 0,
            totalOvertimeHours: 0,
            lateMinutes: 0
        };

        // Aggregate data from pre-calculated attendance records
        for (const record of attendanceRecords) {
            const payableDuration = parseFloat(record.payable_duration) || 0;
            const overtimeHours = parseFloat(record.overtime_hours) || 0;

            // Sum up worked hours and overtime
            summary.totalWorkedHours += payableDuration;
            summary.totalOvertimeHours += overtimeHours;

            // Count attendance status
            switch (record.status) {
                case 'present':
                    summary.presentDays++;
                    break;
                case 'absent':
                    summary.absentDays++;
                    break;
                case 'late':
                    summary.lateDays++;
                    summary.presentDays++;
                    // Calculate late minutes
                    if (record.check_in_time && workingHours.start_time) {
                        const lateMinutes = this.calculateLateMinutes(record.check_in_time, workingHours.start_time);
                        summary.lateMinutes += lateMinutes;
                    }
                    break;
                case 'half_day':
                    summary.halfDays++;
                    break;
                case 'on_leave':
                    summary.onLeaveDays++;
                    break;
            }
        }

        // Round the final sum for precision
        summary.totalWorkedHours = Math.round(summary.totalWorkedHours * 10000) / 10000;

        return summary;
    }

    /**
     * Calculate late minutes
     */
    calculateLateMinutes(checkInTime, expectedStartTime) {
        try {
            const checkIn = new Date(`2000-01-01 ${checkInTime}`);
            const expectedStart = new Date(`2000-01-01 ${expectedStartTime}`);
            
            if (checkIn > expectedStart) {
                const diffMs = checkIn.getTime() - expectedStart.getTime();
                return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
            }
            return 0;
        } catch (error) {
            console.error('Error calculating late minutes:', error);
            return 0;
        }
    }

    /**
     * Get employee-specific daily working hours for a specific day type (weekday, saturday, sunday)
     * @param {string} employeeId - Employee ID
     * @param {number} defaultHours - Default company hours per day
     * @param {string} periodStartDate - Period start date
     * @param {string} periodEndDate - Period end date
     * @param {string} dayType - Type of day: 'weekday', 'saturday', 'sunday'
     * @returns {Promise<number>} Daily working hours for the specific day type
     */
    async getEmployeeDailyHoursForDayType(employeeId, defaultHours, periodStartDate, periodEndDate, dayType) {
        const db = getDB();

        try {
            let dayOfWeekCondition;

            switch (dayType) {
                case 'weekday':
                    // Monday to Friday (DAYOFWEEK 2-6)
                    dayOfWeekCondition = 'AND DAYOFWEEK(date) BETWEEN 2 AND 6';
                    break;
                case 'saturday':
                    // Saturday (DAYOFWEEK 7)
                    dayOfWeekCondition = 'AND DAYOFWEEK(date) = 7';
                    break;
                case 'sunday':
                    // Sunday (DAYOFWEEK 1)
                    dayOfWeekCondition = 'AND DAYOFWEEK(date) = 1';
                    break;
                default:
                    dayOfWeekCondition = '';
            }

            // PRIORITY 1: Try to get scheduled hours from attendance for the specific day type
            const query = `
                SELECT scheduled_in_time, scheduled_out_time
                FROM attendance
                WHERE employee_id = ?
                AND date BETWEEN ? AND ?
                ${dayOfWeekCondition}
                AND scheduled_in_time IS NOT NULL
                AND scheduled_out_time IS NOT NULL
                ORDER BY date DESC
                LIMIT 1
            `;

            const [attendance] = await db.execute(query, [employeeId, periodStartDate, periodEndDate]);

            if (attendance[0]) {
                // Calculate hours from scheduled times in attendance record
                const scheduledInTime = new Date(`2000-01-01 ${attendance[0].scheduled_in_time}`);
                const scheduledOutTime = new Date(`2000-01-01 ${attendance[0].scheduled_out_time}`);

                if (!isNaN(scheduledInTime.getTime()) && !isNaN(scheduledOutTime.getTime())) {
                    const diffMs = scheduledOutTime.getTime() - scheduledInTime.getTime();
                    const hours = diffMs / (1000 * 60 * 60);
                    const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));

                    console.log(`Employee ${employeeId} ${dayType} hours from attendance: ${attendance[0].scheduled_in_time} - ${attendance[0].scheduled_out_time} = ${dailyHours} hours`);
                    return dailyHours;
                }
            }

            // PRIORITY 2: Fallback to employee table
            const [employee] = await db.execute(`
                SELECT in_time, out_time, weekend_working_config
                FROM employees
                WHERE id = ?
            `, [employeeId]);

            if (!employee || !employee[0]) {
                console.log(`Employee ${employeeId} not found, using default: ${defaultHours}h`);
                return defaultHours;
            }

            const emp = employee[0];

            // For WEEKDAY: Use employee's in_time and out_time
            if (dayType === 'weekday') {
                if (emp.in_time && emp.out_time) {
                    const empInTime = new Date(`2000-01-01 ${emp.in_time}`);
                    const empOutTime = new Date(`2000-01-01 ${emp.out_time}`);

                    if (!isNaN(empInTime.getTime()) && !isNaN(empOutTime.getTime())) {
                        const diffMs = empOutTime.getTime() - empInTime.getTime();
                        const hours = diffMs / (1000 * 60 * 60);
                        const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));

                        console.log(`Employee ${employeeId} weekday hours from employee table: ${emp.in_time} - ${emp.out_time} = ${dailyHours} hours`);
                        return dailyHours;
                    }
                }

                // Final fallback for weekday
                console.log(`Employee ${employeeId} weekday hours using default: ${defaultHours}h`);
                return defaultHours;
            }

            // For SATURDAY or SUNDAY: Check weekend_working_config
            if (dayType === 'saturday' || dayType === 'sunday') {
                // Check if weekend_working_config exists
                if (emp.weekend_working_config) {
                    try {
                        const weekendConfig = JSON.parse(emp.weekend_working_config);
                        const dayConfig = weekendConfig[dayType]; // saturday or sunday

                        if (dayConfig && dayConfig.working === true) {
                            // Employee works on this weekend day, calculate hours from in_time and out_time
                            if (emp.in_time && emp.out_time) {
                                const empInTime = new Date(`2000-01-01 ${emp.in_time}`);
                                const empOutTime = new Date(`2000-01-01 ${emp.out_time}`);

                                if (!isNaN(empInTime.getTime()) && !isNaN(empOutTime.getTime())) {
                                    const diffMs = empOutTime.getTime() - empInTime.getTime();
                                    const hours = diffMs / (1000 * 60 * 60);
                                    const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));

                                    console.log(`Employee ${employeeId} ${dayType} hours (working=${dayConfig.working}): ${emp.in_time} - ${emp.out_time} = ${dailyHours} hours`);
                                    return dailyHours;
                                }
                            }
                        } else {
                            // Employee doesn't work on this weekend day
                            console.log(`Employee ${employeeId} ${dayType} - not working (working=false), returning 0 hours`);
                            return 0;
                        }
                    } catch (parseError) {
                        console.warn(`Failed to parse weekend_working_config for employee ${employeeId}:`, parseError);
                    }
                }

                // If no weekend_working_config, assume not working on weekends
                console.log(`Employee ${employeeId} ${dayType} - no weekend config, returning 0 hours`);
                return 0;
            }

            // Should never reach here
            return defaultHours;

        } catch (error) {
            console.error(`Error getting employee daily hours for ${employeeId} (${dayType}):`, error);
            return defaultHours;
        }
    }

    /**
     * Get employee-specific daily working hours
     * @param {string} employeeId - Employee ID
     * @param {number} defaultHours - Default company hours per day
     * @returns {Promise<number>} Daily working hours for the employee
     */
    async getEmployeeDailyHours(employeeId, defaultHours, periodStartDate = null, periodEndDate = null) {
        const db = getDB();
        
        try {
            let query, params;
            
            if (periodStartDate && periodEndDate) {
                // First try to get scheduled hours from weekdays (Monday-Friday) within the payroll period
                query = `
                    SELECT scheduled_in_time, scheduled_out_time
                    FROM attendance
                    WHERE employee_id = ?
                    AND date BETWEEN ? AND ?
                    AND DAYOFWEEK(date) BETWEEN 2 AND 6
                    AND scheduled_in_time IS NOT NULL
                    AND scheduled_out_time IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 1
                `;
                params = [employeeId, periodStartDate, periodEndDate];
            } else {
                // First try to get scheduled hours from weekdays (Monday-Friday)
                query = `
                    SELECT scheduled_in_time, scheduled_out_time
                    FROM attendance
                    WHERE employee_id = ?
                    AND DAYOFWEEK(date) BETWEEN 2 AND 6
                    AND scheduled_in_time IS NOT NULL
                    AND scheduled_out_time IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 1
                `;
                params = [employeeId];
            }
            
            let [attendance] = await db.execute(query, params);

            // If no weekday records found, fallback to any day
            if (!attendance[0]) {
                if (periodStartDate && periodEndDate) {
                    query = `
                        SELECT scheduled_in_time, scheduled_out_time
                        FROM attendance
                        WHERE employee_id = ?
                        AND date BETWEEN ? AND ?
                        AND scheduled_in_time IS NOT NULL
                        AND scheduled_out_time IS NOT NULL
                        ORDER BY date DESC
                        LIMIT 1
                    `;
                    params = [employeeId, periodStartDate, periodEndDate];
                } else {
                    query = `
                        SELECT scheduled_in_time, scheduled_out_time
                        FROM attendance
                        WHERE employee_id = ?
                        AND scheduled_in_time IS NOT NULL
                        AND scheduled_out_time IS NOT NULL
                        ORDER BY date DESC
                        LIMIT 1
                    `;
                    params = [employeeId];
                }

                [attendance] = await db.execute(query, params);

                if (!attendance[0]) {
                    // No attendance records found, try to get from employee table
                    const [employee] = await db.execute(`
                        SELECT in_time, out_time
                        FROM employees
                        WHERE id = ?
                        AND in_time IS NOT NULL
                        AND out_time IS NOT NULL
                    `, [employeeId]);

                    if (employee && employee[0] && employee[0].in_time && employee[0].out_time) {
                        const empInTime = new Date(`2000-01-01 ${employee[0].in_time}`);
                        const empOutTime = new Date(`2000-01-01 ${employee[0].out_time}`);

                        if (!isNaN(empInTime.getTime()) && !isNaN(empOutTime.getTime())) {
                            const diffMs = empOutTime.getTime() - empInTime.getTime();
                            const hours = diffMs / (1000 * 60 * 60);
                            const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));

                            console.log(`Employee ${employeeId} daily hours from employee table: ${employee[0].in_time} - ${employee[0].out_time} = ${dailyHours} hours`);
                            return dailyHours;
                        }
                    }

                    // If employee table also doesn't have schedule, use default
                    const periodInfo = periodStartDate && periodEndDate ? ` for period ${periodStartDate} to ${periodEndDate}` : '';
                    console.log(`Employee ${employeeId} has no scheduled times in attendance or employee table${periodInfo}, using default: ${defaultHours}h`);
                    return defaultHours;
                }
            }
            
            // Calculate hours from scheduled times in attendance record
            const scheduledInTime = new Date(`2000-01-01 ${attendance[0].scheduled_in_time}`);
            const scheduledOutTime = new Date(`2000-01-01 ${attendance[0].scheduled_out_time}`);
            
            if (isNaN(scheduledInTime.getTime()) || isNaN(scheduledOutTime.getTime())) {
                console.log(`Employee ${employeeId} has invalid scheduled time format, using default: ${defaultHours}h`);
                return defaultHours;
            }
            
            const diffMs = scheduledOutTime.getTime() - scheduledInTime.getTime();
            const hours = diffMs / (1000 * 60 * 60);
            
            // Ensure reasonable working hours (between 1 and 16 hours) and round to 2 decimal places
            const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));
            
            const periodInfo = periodStartDate && periodEndDate ? ` (from period ${periodStartDate} to ${periodEndDate})` : '';
            console.log(`Employee ${employeeId} scheduled hours from attendance${periodInfo}: ${attendance[0].scheduled_in_time} - ${attendance[0].scheduled_out_time} = ${dailyHours} hours`);
            return dailyHours;
            
        } catch (error) {
            console.error(`Error getting employee daily hours for ${employeeId}:`, error);
            return defaultHours; // Fallback to company default
        }
    }

    /**
     * Get employee daily hours for a specific target date
     * More efficient than getEmployeeDailyHours when querying a single day
     */
    // async getEmployeeDailyHoursForDate(employeeId, targetDate, defaultHours = 8) {
    //     const db = getDB();

    //     try {
    //         // First, check if the specific target date has scheduled times
    //         let query = `
    //             SELECT scheduled_in_time, scheduled_out_time
    //             FROM attendance
    //             WHERE employee_id = ?
    //             AND date = ?
    //             AND scheduled_in_time IS NOT NULL
    //             AND scheduled_out_time IS NOT NULL
    //             LIMIT 1
    //         `;
    //         let params = [employeeId, targetDate];
    //         let [attendance] = await db.execute(query, params);

    //         // If not found for the specific date, try to get from any recent weekday
    //         if (!attendance[0]) {
    //             query = `
    //                 SELECT scheduled_in_time, scheduled_out_time
    //                 FROM attendance
    //                 WHERE employee_id = ?
    //                 AND DAYOFWEEK(date) BETWEEN 2 AND 6
    //                 AND scheduled_in_time IS NOT NULL
    //                 AND scheduled_out_time IS NOT NULL
    //                 ORDER BY date DESC
    //                 LIMIT 1
    //             `;
    //             params = [employeeId];
    //             [attendance] = await db.execute(query, params);

    //             // If still no weekday records, fallback to any day
    //             if (!attendance[0]) {
    //                 query = `
    //                     SELECT scheduled_in_time, scheduled_out_time
    //                     FROM attendance
    //                     WHERE employee_id = ?
    //                     AND scheduled_in_time IS NOT NULL
    //                     AND scheduled_out_time IS NOT NULL
    //                     ORDER BY date DESC
    //                     LIMIT 1
    //                 `;
    //                 params = [employeeId];
    //                 [attendance] = await db.execute(query, params);

    //                 if (!attendance[0]) {
    //                     console.log(`Employee ${employeeId} has no attendance records with scheduled times for ${targetDate}, using default: ${defaultHours}h`);
    //                     return defaultHours;
    //                 }
    //             }
    //         }

    //         // Calculate hours from scheduled times in attendance record
    //         const scheduledInTime = new Date(`2000-01-01 ${attendance[0].scheduled_in_time}`);
    //         const scheduledOutTime = new Date(`2000-01-01 ${attendance[0].scheduled_out_time}`);

    //         if (isNaN(scheduledInTime.getTime()) || isNaN(scheduledOutTime.getTime())) {
    //             console.log(`Employee ${employeeId} has invalid scheduled time format for ${targetDate}, using default: ${defaultHours}h`);
    //             return defaultHours;
    //         }

    //         const diffMs = scheduledOutTime.getTime() - scheduledInTime.getTime();
    //         const hours = diffMs / (1000 * 60 * 60);

    //         // Ensure reasonable working hours (between 1 and 16 hours) and round to 2 decimal places
    //         const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));

    //         console.log(`Employee ${employeeId} scheduled hours for ${targetDate}: ${attendance[0].scheduled_in_time} - ${attendance[0].scheduled_out_time} = ${dailyHours} hours`);
    //         return dailyHours;

    //     } catch (error) {
    //         console.error(`Error getting employee daily hours for ${employeeId} on ${targetDate}:`, error);
    //         return defaultHours;
    //     }
    // }

    /**
     * Calculate payroll hours (capped at employee's daily hours if overtime not paid)
     * @param {number} actualWorkedHours - Total hours worked
     * @param {number} dailyHours - Employee's daily working hours limit
     * @param {string} employeeId - Employee ID for logging
     * @returns {Promise<number>} Payroll hours to be used for salary calculation
     */
    async calculatePayrollHours(actualWorkedHours, dailyHours, employeeId) {
        // Return actual worked hours without capping
        return actualWorkedHours;
    }

    /**
     * Calculate earned salary based on worked hours (NEW OPTIMIZED APPROACH - FIXED)
     * Calculates expected salary until today vs actual earned salary
     * Deduction = Expected Earned (until today) - Actual Earned (until today)
     */
    async calculateEarnedSalary(employeeId, runId, baseSalary) {
        const db = getDB();

        // Get payroll period info and client info
        const [periodInfo] = await db.execute(`
            SELECT pp.period_start_date, pp.period_end_date, pr.client_id
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE pr.id = ?
        `, [runId]);

        if (periodInfo.length === 0) {
            throw new Error('Period information not found');
        }

        const period = periodInfo[0];
        const clientId = period.client_id;

        // Use today's date if we're still in the period, otherwise use period end date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const periodEndDateFull = new Date(period.period_end_date);
        const calculationEndDate = today < periodEndDateFull ? today : periodEndDateFull;
        const isPartialPeriod = today < periodEndDateFull;

        console.log(`\n💰 CALCULATING ATTENDANCE DEDUCTION (CORRECTED APPROACH)`);
        console.log(`   Employee ID: ${employeeId}`);
        console.log(`   📅 Full Period: ${period.period_start_date} to ${period.period_end_date}`);
        console.log(`   📅 Calculation Until: ${calculationEndDate.toISOString().split('T')[0]} ${isPartialPeriod ? '(PARTIAL - Until Today)' : '(FULL PERIOD)'}`);
        console.log(`   Base Salary (Full Month): Rs.${baseSalary.toFixed(2)}`);

        // Get pre-calculated hourly rates and working days from payroll_records
        const [payrollRecord] = await db.execute(`
            SELECT
                weekday_hourly_rate, saturday_hourly_rate, sunday_hourly_rate,
                daily_salary,
                weekday_working_days, working_saturdays, working_sundays,
                weekday_daily_hours, saturday_daily_hours, sunday_daily_hours
            FROM payroll_records
            WHERE run_id = ? AND employee_id = ?
            LIMIT 1
        `, [runId, employeeId]);

        if (!payrollRecord || !payrollRecord[0]) {
            throw new Error('Payroll record not found for employee');
        }

        const rates = payrollRecord[0];
        const weekdayHourlyRate = parseFloat(rates.weekday_hourly_rate) || 0;
        const saturdayHourlyRate = parseFloat(rates.saturday_hourly_rate) || 0;
        const sundayHourlyRate = parseFloat(rates.sunday_hourly_rate) || 0;
        const dailySalary = parseFloat(rates.daily_salary) || 0;

        // Working days for FULL period
        const fullPeriodWeekdays = parseFloat(rates.weekday_working_days) || 0;
        const fullPeriodSaturdays = parseFloat(rates.working_saturdays) || 0;
        const fullPeriodSundays = parseFloat(rates.working_sundays) || 0;

        // Daily hours by day type
        const weekdayDailyHours = parseFloat(rates.weekday_daily_hours) || 0;
        const saturdayDailyHours = parseFloat(rates.saturday_daily_hours) || 0;
        const sundayDailyHours = parseFloat(rates.sunday_daily_hours) || 0;

        console.log(`\n   💵 Pre-calculated Rates (from payroll_records):`);
        console.log(`      Daily Salary: Rs.${dailySalary.toFixed(2)}`);
        console.log(`      Weekday Hourly Rate: Rs.${weekdayHourlyRate.toFixed(2)}`);
        console.log(`      Saturday Hourly Rate: Rs.${saturdayHourlyRate.toFixed(2)}`);
        console.log(`      Sunday Hourly Rate: Rs.${sundayHourlyRate.toFixed(2)}`);
        console.log(`\n   📊 Full Period Working Days:`);
        console.log(`      Weekdays: ${fullPeriodWeekdays}, Saturdays: ${fullPeriodSaturdays}, Sundays: ${fullPeriodSundays}`);

        // Calculate working days UNTIL YESTERDAY (not including today)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        let workingDaysUntilYesterday;
        if (isPartialPeriod) {
            // Get employee info for department
            const [empInfo] = await db.execute(`
                SELECT department_id FROM employees WHERE id = ?
            `, [employeeId]);

            const HolidayService = require('./HolidayService');
            workingDaysUntilYesterday = await HolidayService.calculateWorkingDays(
                clientId,
                period.period_start_date,
                yesterday.toISOString().split('T')[0],
                empInfo[0]?.department_id,
                false,
                employeeId
            );
        } else {
            // Full period - use pre-calculated values
            workingDaysUntilYesterday = {
                working_days: fullPeriodWeekdays + fullPeriodSaturdays + fullPeriodSundays,
                weekend_working_days: fullPeriodSaturdays + fullPeriodSundays,
                working_saturdays: fullPeriodSaturdays,
                working_sundays: fullPeriodSundays
            };
        }

        const weekdaysUntilYesterday = (workingDaysUntilYesterday.working_days - workingDaysUntilYesterday.weekend_working_days) || 0;
        const saturdaysUntilYesterday = workingDaysUntilYesterday.working_saturdays || 0;
        const sundaysUntilYesterday = workingDaysUntilYesterday.working_sundays || 0;

        console.log(`\n   📊 Working Days Until Yesterday:`);
        console.log(`      Weekdays: ${weekdaysUntilYesterday}, Saturdays: ${saturdaysUntilYesterday}, Sundays: ${sundaysUntilYesterday}`);

        // Calculate EXPECTED hours from completed days (until yesterday)
        const expectedWeekdayHoursYesterday = weekdaysUntilYesterday * weekdayDailyHours;
        const expectedSaturdayHoursYesterday = saturdaysUntilYesterday * saturdayDailyHours;
        const expectedSundayHoursYesterday = sundaysUntilYesterday * sundayDailyHours;

        // Calculate ACTUAL worked hours from COMPLETED sessions (until yesterday)
        const [completedHours] = await db.execute(`
            SELECT
                SUM(CASE WHEN is_weekend BETWEEN 2 AND 6 THEN payable_duration ELSE 0 END) as weekday_hours,
                SUM(CASE WHEN is_weekend = 7 THEN payable_duration ELSE 0 END) as saturday_hours,
                SUM(CASE WHEN is_weekend = 1 THEN payable_duration ELSE 0 END) as sunday_hours
            FROM attendance
            WHERE employee_id = ?
            AND date BETWEEN ? AND ?
            AND check_out_time IS NOT NULL
        `, [employeeId, period.period_start_date, yesterday.toISOString().split('T')[0]]);

        const completedWeekdayHours = parseFloat(completedHours[0].weekday_hours) || 0;
        const completedSaturdayHours = parseFloat(completedHours[0].saturday_hours) || 0;
        const completedSundayHours = parseFloat(completedHours[0].sunday_hours) || 0;

        console.log(`\n   ⏰ Completed Hours (Until Yesterday):`);
        console.log(`      Weekday: ${completedWeekdayHours.toFixed(2)}h`);
        console.log(`      Saturday: ${completedSaturdayHours.toFixed(2)}h`);
        console.log(`      Sunday: ${completedSundayHours.toFixed(2)}h`);

        // Get TODAY's attendance record for real-time calculation
        const [todayAttendance] = await db.execute(`
            SELECT
                scheduled_in_time,
                check_in_time,
                is_weekend
            FROM attendance
            WHERE employee_id = ?
            AND date = CURDATE()
            LIMIT 1
        `, [employeeId]);

        let todayExpectedHours = 0;
        let todayActualHours = 0;
        let todayDayType = null;
        let todayIsLive = false;

        if (todayAttendance.length > 0) {
            const scheduledStart = todayAttendance[0].scheduled_in_time;
            const checkIn = todayAttendance[0].check_in_time;
            const isWeekend = todayAttendance[0].is_weekend;

            // Determine day type
            if (isWeekend >= 2 && isWeekend <= 6) todayDayType = 'weekday';
            else if (isWeekend === 7) todayDayType = 'saturday';
            else if (isWeekend === 1) todayDayType = 'sunday';

            const now = new Date();

            // Calculate expected hours today: scheduled start → NOW
            if (scheduledStart) {
                const [h, m, s] = scheduledStart.split(':').map(Number);
                const schedStartTime = new Date();
                schedStartTime.setHours(h, m, s || 0, 0);

                if (now > schedStartTime) {
                    todayExpectedHours = (now.getTime() - schedStartTime.getTime()) / (1000 * 60 * 60);
                }
            }

            // Calculate actual hours today: check-in → NOW (if checked in and not checked out)
            if (checkIn) {
                const [h, m, s] = checkIn.split(':').map(Number);
                const checkInTime = new Date();
                checkInTime.setHours(h, m, s || 0, 0);

                if (now > checkInTime) {
                    todayActualHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
                    todayIsLive = true;
                }
            }

            if (todayIsLive) {
                console.log(`\n   🔴 LIVE SESSION TODAY (${todayDayType.toUpperCase()}):`);
                console.log(`      Scheduled Start: ${scheduledStart}`);
                console.log(`      Check-in Time: ${checkIn}`);
                console.log(`      Current Time: ${now.toLocaleTimeString('en-US', {hour12: false})}`);
                console.log(`      Expected Hours (scheduled → now): ${todayExpectedHours.toFixed(2)}h`);
                console.log(`      Actual Hours (check-in → now): ${todayActualHours.toFixed(2)}h`);
            }
        }

        // Calculate TOTAL expected hours (yesterday + today)
        let totalExpectedWeekdayHours = expectedWeekdayHoursYesterday;
        let totalExpectedSaturdayHours = expectedSaturdayHoursYesterday;
        let totalExpectedSundayHours = expectedSundayHoursYesterday;

        if (todayDayType === 'weekday') {
            totalExpectedWeekdayHours += todayExpectedHours;
        } else if (todayDayType === 'saturday') {
            totalExpectedSaturdayHours += todayExpectedHours;
        } else if (todayDayType === 'sunday') {
            totalExpectedSundayHours += todayExpectedHours;
        }

        const totalExpectedHours = totalExpectedWeekdayHours + totalExpectedSaturdayHours + totalExpectedSundayHours;

        // Calculate TOTAL actual hours (completed + today's live session)
        let totalActualWeekdayHours = completedWeekdayHours;
        let totalActualSaturdayHours = completedSaturdayHours;
        let totalActualSundayHours = completedSundayHours;

        if (todayDayType === 'weekday') {
            totalActualWeekdayHours += todayActualHours;
        } else if (todayDayType === 'saturday') {
            totalActualSaturdayHours += todayActualHours;
        } else if (todayDayType === 'sunday') {
            totalActualSundayHours += todayActualHours;
        }

        const totalActualHours = totalActualWeekdayHours + totalActualSaturdayHours + totalActualSundayHours;

        console.log(`\n   ⏰ TOTAL EXPECTED Hours (until NOW):`);
        console.log(`      Weekday: ${totalExpectedWeekdayHours.toFixed(2)}h`);
        console.log(`      Saturday: ${totalExpectedSaturdayHours.toFixed(2)}h`);
        console.log(`      Sunday: ${totalExpectedSundayHours.toFixed(2)}h`);
        console.log(`      Total Expected: ${totalExpectedHours.toFixed(2)}h`);

        console.log(`\n   ⏰ TOTAL ACTUAL Hours (including live session):`);
        console.log(`      Weekday: ${totalActualWeekdayHours.toFixed(2)}h${todayDayType === 'weekday' && todayIsLive ? ` (includes ${todayActualHours.toFixed(2)}h live)` : ''}`);
        console.log(`      Saturday: ${totalActualSaturdayHours.toFixed(2)}h${todayDayType === 'saturday' && todayIsLive ? ` (includes ${todayActualHours.toFixed(2)}h live)` : ''}`);
        console.log(`      Sunday: ${totalActualSundayHours.toFixed(2)}h${todayDayType === 'sunday' && todayIsLive ? ` (includes ${todayActualHours.toFixed(2)}h live)` : ''}`);
        console.log(`      Total Actual: ${totalActualHours.toFixed(2)}h`);

        // Use the total hours for salary calculation
        const actualWeekdayHours = totalActualWeekdayHours;
        const actualSaturdayHours = totalActualSaturdayHours;
        const actualSundayHours = totalActualSundayHours;
        const expectedWeekdayHours = totalExpectedWeekdayHours;
        const expectedSaturdayHours = totalExpectedSaturdayHours;
        const expectedSundayHours = totalExpectedSundayHours;

        // Calculate EXPECTED earned salary
        const expectedWeekdayEarned = expectedWeekdayHours * weekdayHourlyRate;
        const expectedSaturdayEarned = expectedSaturdayHours * saturdayHourlyRate;
        const expectedSundayEarned = expectedSundayHours * sundayHourlyRate;
        const totalExpectedEarned = expectedWeekdayEarned + expectedSaturdayEarned + expectedSundayEarned;

        console.log(`\n   💵 EXPECTED Earned Salary (until NOW):`);
        console.log(`      Weekday: ${expectedWeekdayHours.toFixed(2)}h × Rs.${weekdayHourlyRate.toFixed(2)} = Rs.${expectedWeekdayEarned.toFixed(2)}`);
        console.log(`      Saturday: ${expectedSaturdayHours.toFixed(2)}h × Rs.${saturdayHourlyRate.toFixed(2)} = Rs.${expectedSaturdayEarned.toFixed(2)}`);
        console.log(`      Sunday: ${expectedSundayHours.toFixed(2)}h × Rs.${sundayHourlyRate.toFixed(2)} = Rs.${expectedSundayEarned.toFixed(2)}`);
        console.log(`      ─────────────────────────────────────────────────────`);
        console.log(`      Total Expected Earned: Rs.${totalExpectedEarned.toFixed(2)}`);

        // Calculate ACTUAL earned salary
        const actualWeekdayEarned = actualWeekdayHours * weekdayHourlyRate;
        const actualSaturdayEarned = actualSaturdayHours * saturdayHourlyRate;
        const actualSundayEarned = actualSundayHours * sundayHourlyRate;
        const totalActualEarned = actualWeekdayEarned + actualSaturdayEarned + actualSundayEarned;

        console.log(`\n   💵 ACTUAL Earned Salary (including live session):`);
        console.log(`      Weekday: ${actualWeekdayHours.toFixed(2)}h × Rs.${weekdayHourlyRate.toFixed(2)} = Rs.${actualWeekdayEarned.toFixed(2)}`);
        console.log(`      Saturday: ${actualSaturdayHours.toFixed(2)}h × Rs.${saturdayHourlyRate.toFixed(2)} = Rs.${actualSaturdayEarned.toFixed(2)}`);
        console.log(`      Sunday: ${actualSundayHours.toFixed(2)}h × Rs.${sundayHourlyRate.toFixed(2)} = Rs.${actualSundayEarned.toFixed(2)}`);
        console.log(`      ─────────────────────────────────────────────────────`);
        console.log(`      Total Actual Earned: Rs.${totalActualEarned.toFixed(2)}`);

        // Calculate deduction: EXPECTED EARNED (until NOW) - ACTUAL EARNED (until NOW)
        // This is the CORRECT way - only deduct for the period that has passed
        const deduction = Math.max(0, totalExpectedEarned - totalActualEarned);

        const currentTimeStr = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        console.log(`\n   📊 FINAL CALCULATION (REAL-TIME):`);
        console.log(`      Calculated At: ${currentTimeStr}`);
        console.log(`      Expected Earned (until NOW): Rs.${totalExpectedEarned.toFixed(2)}`);
        console.log(`      Actual Earned (until NOW): Rs.${totalActualEarned.toFixed(2)}`);
        console.log(`      ─────────────────────────────────────────────────────`);
        console.log(`      Attendance Deduction: Rs.${deduction.toFixed(2)}`);
        console.log(`      (Formula: Expected - Actual, NOT Base Salary - Actual)`);

        if (deduction === 0) {
            console.log(`      ✅ No deduction - Employee worked all expected hours!`);
        } else {
            const deductionPercentage = totalExpectedEarned > 0 ? ((deduction / totalExpectedEarned) * 100).toFixed(2) : 0;
            const shortfallHours = totalExpectedHours - totalActualHours;
            console.log(`      📉 Shortfall: ${shortfallHours.toFixed(2)} hours (${deductionPercentage}% of expected)`);
        }

        if (todayIsLive) {
            console.log(`\n   ⚠️  NOTE: Employee is currently checked in. Running this calculation`);
            console.log(`      again later will produce a different result as time progresses.`);
        }

        return {
            total: deduction,
            components: [{
                code: 'ATTENDANCE_DED',
                name: 'Attendance Deduction',
                type: 'deduction',
                category: 'attendance',
                amount: deduction,
                details: `Shortfall: ${(totalExpectedHours - totalActualHours).toFixed(2)}h of ${totalExpectedHours.toFixed(2)}h expected (calculated at ${currentTimeStr})`
            }],
            earned_salary: totalActualEarned,
            expected_salary: totalExpectedEarned,
            has_live_session: todayIsLive,
            live_session_hours: todayIsLive ? todayActualHours : 0,
            breakdown: {
                weekday: {
                    expected_hours: expectedWeekdayHours,
                    actual_hours: actualWeekdayHours,
                    rate: weekdayHourlyRate,
                    earned: actualWeekdayEarned,
                    expected_earned: expectedWeekdayEarned
                },
                saturday: {
                    expected_hours: expectedSaturdayHours,
                    actual_hours: actualSaturdayHours,
                    rate: saturdayHourlyRate,
                    earned: actualSaturdayEarned,
                    expected_earned: expectedSaturdayEarned
                },
                sunday: {
                    expected_hours: expectedSundayHours,
                    actual_hours: actualSundayHours,
                    rate: sundayHourlyRate,
                    earned: actualSundayEarned,
                    expected_earned: expectedSundayEarned
                }
            }
        };
    }

    /**
     * Calculate attendance-based salary deductions (OLD APPROACH - KEEPING FOR FALLBACK)
     */
    async calculateAttendanceDeductions(employeeId, runId, baseSalary, attendanceSummary, approvedLeaves) {
        const db = getDB();
        
        // Get payroll period info for working days calculation
        const [periodInfo] = await db.execute(`
            SELECT pp.period_start_date, pp.period_end_date
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE pr.id = ?
        `, [runId]);

        if (periodInfo.length === 0) {
            throw new Error('Period information not found');
        }

        const period = periodInfo[0];

        // Use today's date if we're still in the period, otherwise use period end date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const periodEndDateFull = new Date(period.period_end_date);
        const calculationEndDate = today < periodEndDateFull ? today : periodEndDateFull;

        console.log(`🗓️  PAYROLL PERIOD: ${period.period_start_date} to ${calculationEndDate.toISOString().split('T')[0]} (today or period end)`);

        // Get employee's department for holiday calculation
        const [employeeInfo] = await db.execute(`
            SELECT department_id, client_id FROM employees WHERE id = ?
        `, [employeeId]);

        const departmentId = employeeInfo[0]?.department_id || null;
        const clientId = employeeInfo[0]?.client_id;

        // IMPORTANT: Calculate working days for FULL MONTH for per-day salary calculation
        const fullMonthWorkingDaysCalc = await HolidayService.calculateWorkingDays(
            clientId,
            period.period_start_date,
            period.period_end_date, // Full period end date
            departmentId,
            false,
            employeeId
        );

        // Calculate working days UP TO TODAY for expected hours calculation
        const workingDaysCalculation = await HolidayService.calculateWorkingDays(
            clientId,
            period.period_start_date,// Today or period end
            calculationEndDate, // Today or period end
            departmentId,
            false, // includeOptionalHolidays
            employeeId // Pass employeeId for individual weekend config
        );

        const workingDaysInMonth = workingDaysCalculation.working_days;

        console.log(`📊 CALCULATED WORKING DAYS UP TO TODAY: ${workingDaysInMonth} days (excluding weekends & holidays)`);
        console.log(`📊 FULL MONTH WORKING DAYS: ${fullMonthWorkingDaysCalc.working_days} days (for salary rate calculation)`);

        // Calculate effective working days considering weekend salary weights (USE FULL MONTH)
        const effectiveWorkingDays = await this.calculateEffectiveWorkingDays(
            fullMonthWorkingDaysCalc, // Use full month for per-day salary calculation
            employeeId,
            period.period_start_date,
            period.period_end_date
        );

        console.log(`🏗️  WEEKEND WORKING BREAKDOWN (FULL MONTH):`, {
            standard_working_days: fullMonthWorkingDaysCalc.working_days - fullMonthWorkingDaysCalc.weekend_working_days,
            weekend_working_days: fullMonthWorkingDaysCalc.weekend_working_days,
            weekend_full_day_weight: fullMonthWorkingDaysCalc.weekend_full_day_weight,
            weekend_proportional_days: fullMonthWorkingDaysCalc.weekend_proportional_days,
            effective_working_days: effectiveWorkingDays
        });

        // Calculate per-day and per-minute salary rates using effective working days (FULL MONTH)
        const perDaySalary = baseSalary / effectiveWorkingDays;
        const employeeDailyHours = await this.getEmployeeDailyHours(employeeId, attendanceSummary.workingHours.hours_per_day, period.period_start_date, period.period_end_date);
        const perMinuteSalary = perDaySalary / (employeeDailyHours * 60);

        // Calculate hourly rate for shortfall logging
        const hourlyRate = perDaySalary / employeeDailyHours;

        // 🔍 CONSOLE LOG: Employee Shortfall & Rate Information
        console.log('\n📊 PAYROLL CALCULATION - EMPLOYEE SHORTFALL ANALYSIS');
        console.log('=' .repeat(60));
        console.log(`👤 Employee ID: ${employeeId}`);
        console.log(`💰 Base Salary: ${baseSalary.toLocaleString()}`);
        console.log(`📅 FULL MONTH Working Days: ${fullMonthWorkingDaysCalc.working_days} days (for rate calculation)`);
        console.log(`📅 UP TO TODAY Working Days: ${workingDaysInMonth} days (for expected hours)`);
        console.log(`🎯 Effective Working Days (with weekend weights): ${effectiveWorkingDays}`);
        console.log(`⏰ Employee Daily Hours: ${employeeDailyHours}h/day`);
        console.log(`💵 Per-Day Salary: ${perDaySalary.toFixed(2)} (${baseSalary} ÷ ${effectiveWorkingDays})`);
        console.log(`⏱️  Hourly Rate: ${hourlyRate.toFixed(2)} (${perDaySalary.toFixed(2)} ÷ ${employeeDailyHours})`);
        console.log('');
        console.log('📈 ATTENDANCE SUMMARY:');
        console.log(`   Worked Hours: ${attendanceSummary.summary.totalWorkedHours}`);
        console.log('=' .repeat(60));

        const deductions = {
            absentDeduction: 0,
            lateDeduction: 0,
            unpaidLeaveDeduction: 0,
            weekendProportionalDeduction: 0,
            weekendAbsentDeduction: 0,
            components: []
        };

        // 1. Absent days deduction (only for days not covered by paid leave)
        const unpaidAbsentDays = this.calculateUnpaidAbsentDays(attendanceSummary, approvedLeaves);
        if (unpaidAbsentDays > 0) {
            deductions.absentDeduction = unpaidAbsentDays * perDaySalary;
            deductions.components.push({
                code: 'ABSENT_DEDUCTION',
                name: 'Absent Days Deduction',
                type: 'deduction',
                category: 'other', // Use existing enum value
                amount: deductions.absentDeduction,
                details: `${unpaidAbsentDays} days × ${perDaySalary.toFixed(2)}`
            });
        }

        // 2. Weekend working deductions (only for proportional days)
        const weekendDeductions = await this.calculateWeekendDeductions(
            employeeId,
            workingDaysCalculation,
            attendanceSummary,
            period.period_start_date,
            calculationEndDate,
            perDaySalary,
            employeeDailyHours
        );

        deductions.weekendProportionalDeduction = weekendDeductions.totalDeduction;
        if (weekendDeductions.components.length > 0) {
            deductions.components.push(...weekendDeductions.components);
        }

        // 3. Late arrival deduction (per minute)
        if (attendanceSummary.summary.lateMinutes > 0) {
            deductions.lateDeduction = attendanceSummary.summary.lateMinutes * perMinuteSalary;
            deductions.components.push({
                code: 'LATE_DEDUCTION',
                name: 'Late Arrival Deduction',
                type: 'deduction',
                category: 'other', // Use existing enum value
                amount: deductions.lateDeduction,
                details: `${attendanceSummary.summary.lateMinutes} minutes × ${perMinuteSalary.toFixed(4)}`
            });
        }

        // 3. Unpaid leave deduction
        const unpaidLeaveDays = this.calculateUnpaidLeaveDays(approvedLeaves);
        if (unpaidLeaveDays > 0) {
            deductions.unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary;
            deductions.components.push({
                code: 'UNPAID_LEAVE_DED', // 🔧 FIX: Shortened to fit varchar(20) limit
                name: 'Unpaid Leave Deduction',
                type: 'deduction',
                category: 'other', // Use existing enum value
                amount: deductions.unpaidLeaveDeduction,
                details: `${unpaidLeaveDays} days × ${perDaySalary.toFixed(2)}`
            });
        }

        // 5. Weekend absent days deduction (for employees scheduled to work weekends)
        const weekendAbsentDays = await this.calculateWeekendAbsentDays(
            employeeId,
            period.period_start_date,
            calculationEndDate
        );
        if (weekendAbsentDays > 0) {
            // For weekend absent days, use per-day salary (same rate as weekday absences)
            deductions.weekendAbsentDeduction = weekendAbsentDays * perDaySalary;
            deductions.components.push({
                code: 'WEEKEND_ABSENT_DED',
                name: 'Weekend Absent Days',
                type: 'deduction',
                category: 'other',
                amount: deductions.weekendAbsentDeduction,
                details: `${weekendAbsentDays} weekend days × ${perDaySalary.toFixed(2)}`
            });
        }

        deductions.total = deductions.absentDeduction + deductions.lateDeduction +
                          deductions.shortfallDeduction + deductions.unpaidLeaveDeduction +
                          deductions.weekendProportionalDeduction + deductions.weekendAbsentDeduction;

        return deductions;
    }

    /**
     * Calculate effective working days considering weekend salary weights
     */
    async calculateEffectiveWorkingDays(workingDaysCalculation, employeeId, startDate, endDate) {
        const db = getDB();

        // Get employee weekend configuration
        const [employeeData] = await db.execute(`
            SELECT weekend_working_config FROM employees WHERE id = ?
        `, [employeeId]);

        let employeeWeekendConfig = null;
        if (employeeData.length > 0 && employeeData[0].weekend_working_config) {
            try {
                employeeWeekendConfig = JSON.parse(employeeData[0].weekend_working_config);
            } catch (e) {
                console.warn(`Invalid weekend_working_config JSON for employee ${employeeId}:`, e);
            }
        }

        // Calculate effective working days
        let effectiveWorkingDays = workingDaysCalculation.working_days - workingDaysCalculation.weekend_working_days;

        // Add weekend working days with proper weights
        effectiveWorkingDays += workingDaysCalculation.weekend_full_day_weight; // Full weight weekend days
        effectiveWorkingDays += workingDaysCalculation.weekend_proportional_days; // Proportional weekend days still count as working days

        return effectiveWorkingDays;
    }

    /**
     * Calculate weekend-specific attendance deductions
     */
    async calculateWeekendDeductions(employeeId, workingDaysCalculation, attendanceSummary, startDate, endDate, perDaySalary, employeeDailyHours) {
        const db = getDB();

        // Get employee weekend configuration
        const [employeeData] = await db.execute(`
            SELECT weekend_working_config FROM employees WHERE id = ?
        `, [employeeId]);

        let employeeWeekendConfig = null;
        if (employeeData.length > 0 && employeeData[0].weekend_working_config) {
            try {
                employeeWeekendConfig = JSON.parse(employeeData[0].weekend_working_config);
            } catch (e) {
                console.warn(`Invalid weekend_working_config JSON for employee ${employeeId}:`, e);
            }
        }

        const deductions = {
            totalDeduction: 0,
            components: []
        };

        // Collect all weekend shortfall data for consolidated display
        let totalWeekendShortfallHours = 0;
        let totalWeekendShortfallDeduction = 0;
        const shortfallDetails = [];

        // If no weekend config, return empty (no weekend work configured)
        if (!employeeWeekendConfig) {
            return deductions;
        }

        // Get actual weekend attendance for shortfall calculation
        const [weekendAttendance] = await db.execute(`
            SELECT
                date,
                DAYOFWEEK(date) as day_of_week,
                check_in_time,
                check_out_time,
                total_hours,
                status,
                scheduled_in_time,
                scheduled_out_time
            FROM attendance
            WHERE employee_id = ?
                AND date BETWEEN ? AND ?
                AND DAYOFWEEK(date) IN (1, 7)  -- Sunday = 1, Saturday = 7
        `, [employeeId, startDate, endDate]);

        for (const attendance of weekendAttendance) {
            const dayOfWeek = attendance.day_of_week === 7 ? 6 : 0; // Convert MySQL DAYOFWEEK to JS (Saturday=6, Sunday=0)
            let weekendDayConfig = null;

            // Check if this weekend day is configured for work (regardless of full_day_salary setting)
            if (dayOfWeek === 6 && employeeWeekendConfig.saturday?.working) {
                weekendDayConfig = employeeWeekendConfig.saturday;
            } else if (dayOfWeek === 0 && employeeWeekendConfig.sunday?.working) {
                weekendDayConfig = employeeWeekendConfig.sunday;
            }

            if (weekendDayConfig) {
                // Calculate scheduled hours for this weekend day
                const inTime = weekendDayConfig.in_time;
                const outTime = weekendDayConfig.out_time;
                const scheduledHours = this.calculateScheduledHours(inTime, outTime);

                // Calculate actual payable hours using overlap logic (same as weekdays)
                let actualPayableHours = 0;
                let calculationInfo = '';

                if (attendance.check_in_time && attendance.check_out_time) {
                    // Create Date objects for time comparison
                    const scheduledInTime = new Date(`2000-01-01 ${inTime}`);
                    const scheduledOutTime = new Date(`2000-01-01 ${outTime}`);
                    const actualInTime = new Date(`2000-01-01 ${attendance.check_in_time}`);
                    const actualOutTime = new Date(`2000-01-01 ${attendance.check_out_time}`);

                    if (!isNaN(scheduledInTime.getTime()) && !isNaN(scheduledOutTime.getTime()) &&
                        !isNaN(actualInTime.getTime()) && !isNaN(actualOutTime.getTime())) {

                        // Calculate overlap between actual work time and scheduled time
                        const overlapStart = new Date(Math.max(actualInTime.getTime(), scheduledInTime.getTime()));
                        const overlapEnd = new Date(Math.min(actualOutTime.getTime(), scheduledOutTime.getTime()));

                        if (overlapEnd > overlapStart) {
                            const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                            actualPayableHours = Math.max(0, overlapMs / (1000 * 60 * 60));

                            const overlapStartTime = overlapStart.toTimeString().substring(0, 5);
                            const overlapEndTime = overlapEnd.toTimeString().substring(0, 5);
                            calculationInfo = `OVERLAP ${overlapStartTime}-${overlapEndTime} = ${actualPayableHours.toFixed(3)}h`;
                        } else {
                            actualPayableHours = 0;
                            calculationInfo = 'NO OVERLAP with scheduled time';
                        }
                    } else {
                        calculationInfo = 'Invalid time format';
                    }
                } else {
                    calculationInfo = 'Missing check-in/out times';
                }

                // Calculate shortfall based on overlap hours, not total_hours
                const shortfallHours = Math.max(0, scheduledHours - actualPayableHours);

                if (shortfallHours > 0) {
                    // Calculate hourly rate based on weekend day's scheduled hours
                    const weekendDayHourlyRate = perDaySalary / scheduledHours;
                    const shortfallDeduction = shortfallHours * weekendDayHourlyRate;

                    // Collect shortfall data for consolidated display
                    totalWeekendShortfallHours += shortfallHours;
                    totalWeekendShortfallDeduction += shortfallDeduction;
                    shortfallDetails.push(`${attendance.date} (${dayOfWeek === 6 ? 'Saturday' : 'Sunday'}): ${shortfallHours.toFixed(2)}h`);

                    deductions.totalDeduction += shortfallDeduction;

                    console.log(`🏗️  Weekend Shortfall: ${attendance.date} (${dayOfWeek === 6 ? 'Saturday' : 'Sunday'})`);
                    console.log(`   Scheduled: ${inTime} - ${outTime} = ${scheduledHours}h`);
                    console.log(`   Actual: ${attendance.check_in_time || 'N/A'} - ${attendance.check_out_time || 'N/A'}`);
                    console.log(`   Calculation: ${calculationInfo}`);
                    console.log(`   Payable Hours: ${actualPayableHours.toFixed(3)}h`);
                    console.log(`   Shortfall: ${shortfallHours.toFixed(3)}h`);
                    console.log(`   Hourly Rate: ${weekendDayHourlyRate.toFixed(2)} (Day Salary ${perDaySalary} ÷ ${scheduledHours}h)`);
                    console.log(`   Deduction: ${shortfallDeduction.toFixed(2)}`);
                } else {
                    console.log(`✅ Weekend Day Met: ${attendance.date} (${dayOfWeek === 6 ? 'Saturday' : 'Sunday'})`);
                    console.log(`   Scheduled: ${scheduledHours}h, Payable: ${actualPayableHours.toFixed(3)}h - No shortfall`);
                }
            }
        }

        // Add consolidated weekend shortfall component if there are any shortfalls
        if (totalWeekendShortfallDeduction > 0) {
            deductions.components.push({
                code: 'WEEKEND_SHORTFALL',
                name: 'Weekend Shortfall Deduction',
                type: 'deduction',
                category: 'other',
                amount: totalWeekendShortfallDeduction,
                details: `Total ${totalWeekendShortfallHours.toFixed(2)}h shortfall - ${shortfallDetails.join(', ')}`
            });
        }

        return deductions;
    }

    /**
     * Calculate scheduled hours between two time strings
     */
    calculateScheduledHours(inTime, outTime) {
        const [inHour, inMinute] = inTime.split(':').map(Number);
        const [outHour, outMinute] = outTime.split(':').map(Number);

        const inMinutes = inHour * 60 + inMinute;
        const outMinutes = outHour * 60 + outMinute;

        return (outMinutes - inMinutes) / 60;
    }

    /**
     * Calculate working days in a period (excluding weekends and holidays)
     */
    async calculateWorkingDaysInPeriod(startDate, endDate, clientId, departmentId = null, employeeId = null) {
        try {
            // Use HolidayService for accurate working days calculation
            const calculation = await HolidayService.calculateWorkingDays(
                clientId,
                startDate,
                endDate,
                departmentId,
                false, // includeOptionalHolidays
                employeeId // Pass employeeId for individual weekend config
            );
            
            console.log(`🏢 HOLIDAY SERVICE RESULT:`, {
                total_days: calculation.total_days,
                working_days: calculation.working_days,
                weekend_days: calculation.weekend_days,
                weekend_working_days: calculation.weekend_working_days,
                weekend_full_day_weight: calculation.weekend_full_day_weight,
                weekend_proportional_days: calculation.weekend_proportional_days,
                holiday_count: calculation.holiday_count,
                holidays: calculation.holidays?.map(h => h.name).join(', ') || 'None'
            });
            
            return calculation.working_days;
        } catch (error) {
            console.error('Error calculating working days with holidays:', error);
            // Fallback to old method without holidays
            return this.calculateWorkingDaysWithoutHolidays(startDate, endDate);
        }
    }

    /**
     * Fallback method: Calculate working days excluding only weekends
     */
    calculateWorkingDaysWithoutHolidays(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let workingDays = 0;
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            // Exclude Saturday (6) and Sunday (0)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
        }
        
        return workingDays;
    }

    /**
     * Calculate unpaid absent days (absent days not covered by paid leave)
     */
    calculateUnpaidAbsentDays(attendanceSummary, approvedLeaves) {
        // This is a simplified calculation
        // In reality, you'd need to check each absent day against approved leaves
        const absentDays = attendanceSummary.summary.absentDays;
        const paidLeaveDays = approvedLeaves.filter(leave => leave.is_paid).length;
        
        return Math.max(0, absentDays - paidLeaveDays);
    }

    /**
     * Calculate unpaid leave days
     */
    calculateUnpaidLeaveDays(approvedLeaves) {
        return approvedLeaves
            .filter(leave => !leave.is_paid)
            .reduce((total, leave) => total + leave.days_requested, 0);
    }

    /**
     * Calculate weekend absent days (days where employee was scheduled to work but has no attendance record)
     */
    async calculateWeekendAbsentDays(employeeId, periodStartDate, periodEndDate) {
        const db = getDB();

        try {
            // Get employee's weekend working configuration
            const [employee] = await db.execute(`
                SELECT weekend_working_config FROM employees WHERE id = ?
            `, [employeeId]);

            if (!employee[0] || !employee[0].weekend_working_config) {
                return 0; // No weekend work configured
            }

            let employeeWeekendConfig;
            try {
                employeeWeekendConfig = JSON.parse(employee[0].weekend_working_config);
            } catch (e) {
                console.warn(`Invalid weekend_working_config JSON for employee ${employeeId}:`, e);
                return 0;
            }

            // Generate all weekend dates in the period where employee should work
            // Only count weekends up to today
            const scheduledWeekendDates = [];
            const startDate = new Date(periodStartDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const periodEndDateFull = new Date(periodEndDate);
            const endDate = today < periodEndDateFull ? today : periodEndDateFull;

            console.log(`📅 Checking weekend absences from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (today or period end)`);

            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
                const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

                // Check if employee is scheduled to work on this weekend day
                if (dayOfWeek === 6 && employeeWeekendConfig.saturday?.working) { // Saturday
                    scheduledWeekendDates.push(new Date(date).toISOString().split('T')[0]);
                } else if (dayOfWeek === 0 && employeeWeekendConfig.sunday?.working) { // Sunday
                    scheduledWeekendDates.push(new Date(date).toISOString().split('T')[0]);
                }
            }

            if (scheduledWeekendDates.length === 0) {
                return 0; // No weekend days scheduled
            }

            // Get attendance records for these weekend dates
            const placeholders = scheduledWeekendDates.map(() => '?').join(',');
            const [attendanceRecords] = await db.execute(`
                SELECT DATE(date) as attendance_date
                FROM attendance
                WHERE employee_id = ?
                AND DATE(date) IN (${placeholders})
            `, [employeeId, ...scheduledWeekendDates]);

            // Find dates with no attendance records
            const attendedDates = attendanceRecords.map(record => record.attendance_date);
            const absentWeekendDates = scheduledWeekendDates.filter(date =>
                !attendedDates.some(attendedDate =>
                    attendedDate === date ||
                    (attendedDate instanceof Date ? attendedDate.toISOString().split('T')[0] : attendedDate) === date
                )
            );

            console.log(`📅 Weekend absence check for employee ${employeeId}:`);
            console.log(`   Scheduled weekend dates: ${scheduledWeekendDates.length} days`);
            console.log(`   Attended weekend dates: ${attendedDates.length} days`);
            console.log(`   Absent weekend dates: ${absentWeekendDates.length} days`);

            return absentWeekendDates.length;

        } catch (error) {
            console.error('Error calculating weekend absent days:', error);
            return 0;
        }
    }

    /**
     * Get employee payroll configuration data
     */
    async getEmployeePayrollData(employeeId, clientId, runId = null) {
        const db = getDB();

        // =============================================
        // FETCH CONFIGURED PAYROLL COMPONENTS
        // =============================================

        // Get active payroll components that apply to this employee
        const [payrollComponents] = await db.execute(`
            SELECT
                pc.id,
                pc.component_name,
                pc.component_type,
                pc.category,
                pc.calculation_type,
                pc.calculation_value,
                pc.calculation_formula,
                pc.is_taxable,
                pc.is_mandatory,
                pc.applies_to,
                pc.applies_to_ids
            FROM payroll_components pc
            WHERE pc.client_id = ? AND pc.is_active = 1
        `, [clientId]);

        // Filter components based on applies_to logic
        const applicableComponents = await this.filterApplicableComponents(payrollComponents, employeeId, clientId);

        // Get employee-specific allowances (manual assignments)
        const [employeeAllowances] = await db.execute(`
            SELECT
                ea.id,
                ea.allowance_type,
                ea.allowance_name,
                ea.amount,
                ea.is_percentage,
                ea.is_taxable,
                ea.effective_from,
                ea.effective_to
            FROM employee_allowances ea
            WHERE ea.employee_id = ? AND ea.client_id = ? AND ea.is_active = 1
            AND (ea.effective_to IS NULL OR ea.effective_to >= CURDATE())
            AND ea.effective_from <= CURDATE()
        `, [employeeId, clientId]);

        // Get employee-specific deductions (manual assignments)
        const [employeeDeductions] = await db.execute(`
            SELECT
                ed.id,
                ed.deduction_type,
                ed.deduction_name,
                ed.amount,
                ed.is_percentage,
                ed.is_recurring,
                ed.remaining_installments,
                ed.effective_from,
                ed.effective_to
            FROM employee_deductions ed
            WHERE ed.employee_id = ? AND ed.client_id = ? AND ed.is_active = 1
            AND (ed.effective_to IS NULL OR ed.effective_to >= CURDATE())
            AND ed.effective_from <= CURDATE()
            AND (ed.is_recurring = 0 OR ed.remaining_installments > 0 OR ed.remaining_installments IS NULL)
        `, [employeeId, clientId]);
        
        // Get overtime hours for current period with holiday multipliers (if runId provided)
        let overtimeHours = 0;
        let overtimeDetails = [];
        
        if (runId) {
            const [overtime] = await db.execute(`
                SELECT 
                    a.date,
                    a.overtime_hours,
                    SUM(a.overtime_hours) OVER() as total_overtime_hours
                FROM attendance a
                JOIN payroll_runs pr ON pr.id = ?
                JOIN payroll_periods pp ON pr.period_id = pp.id
                WHERE a.employee_id = ? 
                  AND DATE(a.date) BETWEEN pp.period_start_date AND pp.period_end_date
                  AND a.overtime_hours > 0
                ORDER BY a.date
            `, [runId, employeeId]);
            
            overtimeHours = overtime[0]?.total_overtime_hours || 0;
            
            // Calculate holiday multipliers for each overtime day
            try {
                // Get employee department for holiday calculation
                const [employee] = await db.execute(`
                    SELECT department_id FROM employees WHERE id = ?
                `, [employeeId]);
                
                const departmentId = employee[0]?.department_id || null;
                
                for (const record of overtime) {
                    if (record.overtime_hours > 0) {
                        const dateStr = typeof record.date === 'string' ? record.date : record.date.toISOString().split('T')[0];
                        
                        // Check if this date is a holiday
                        const holidayMultiplier = await HolidayService.getHolidayOvertimeMultiplier(
                            clientId, 
                            dateStr, 
                            departmentId
                        );
                        
                        // Get regular overtime multiplier from settings (not hardcoded!)
                        const regularOvertimeRate = await this.getRegularOvertimeMultiplier(clientId);
                        
                        overtimeDetails.push({
                            date: dateStr,
                            hours: parseFloat(record.overtime_hours),
                            holiday_multiplier: holidayMultiplier || regularOvertimeRate, // Dynamic weekday multiplier
                            is_holiday: !!holidayMultiplier
                        });
                    }
                }
            } catch (error) {
                console.error('Error calculating holiday overtime multipliers:', error);
                // Fallback - treat all as regular overtime
                overtimeDetails = [];
            }
        }
        
        return {
            // Legacy format for backward compatibility
            allowances: employeeAllowances || [],
            deductions: employeeDeductions || [],

            // New enhanced format with configured components
            configuredComponents: {
                earnings: applicableComponents.filter(c => c.component_type === 'earning'),
                deductions: applicableComponents.filter(c => c.component_type === 'deduction')
            },
            employeeAllowances: employeeAllowances || [],
            employeeDeductions: employeeDeductions || [],

            overtimeHours: overtimeHours,
            overtimeDetails: overtimeDetails
        };
    }

    /**
     * Filter payroll components based on applies_to logic
     */
    async filterApplicableComponents(payrollComponents, employeeId, clientId) {
        if (!payrollComponents || payrollComponents.length === 0) {
            return [];
        }

        const db = getDB();
        const applicableComponents = [];

        // Get employee details for filtering
        const [employee] = await db.execute(`
            SELECT
                e.id,
                e.department_id,
                e.designation_id,
                d.name,
                des.title as designation_title
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations des ON e.designation_id = des.id
            WHERE e.id = ? AND e.client_id = ?
        `, [employeeId, clientId]);

        if (employee.length === 0) {
            console.warn(`Employee ${employeeId} not found for component filtering`);
            return [];
        }

        const emp = employee[0];

        for (const component of payrollComponents) {
            let isApplicable = false;

            switch (component.applies_to) {
                case 'all':
                    isApplicable = true;
                    break;

                case 'department':
                    if (component.applies_to_ids && emp.department_id) {
                        const departmentIds = JSON.parse(component.applies_to_ids || '[]');
                        isApplicable = departmentIds.includes(emp.department_id); 
                    }
                    break;

                case 'designation':
                    if (component.applies_to_ids && emp.designation_id) {
                        const designationIds = JSON.parse(component.applies_to_ids || '[]');
                        isApplicable = designationIds.includes(emp.designation_id);
                    }
                    break;

                case 'individual':
                    if (component.applies_to_ids) {
                        const employeeIds = JSON.parse(component.applies_to_ids || '[]');
                        isApplicable = employeeIds.includes(employeeId);
                    }
                    break;

                default:
                    console.warn(`Unknown applies_to value: ${component.applies_to}`);
                    break;
            }

            if (isApplicable) {
                applicableComponents.push({
                    ...component,
                    // Add metadata for debugging
                    _applied_via: component.applies_to,
                    _employee_department: emp.department_name,
                    _employee_designation: emp.designation_title
                });
            }
        }

        console.log(`🔍 Component filtering for employee ${employeeId}:`);
        console.log(`   Total components: ${payrollComponents.length}`);
        console.log(`   Applicable components: ${applicableComponents.length}`);
        console.log(`   Employee dept: ${emp.department_name}, designation: ${emp.designation_title}`);

        return applicableComponents;
    }

    /**
     * Calculate the amount for a configured payroll component
     */
    async calculateComponentAmount(component, baseSalary, employeeRecord = null) {
        const calculationType = component.calculation_type;
        let amount = 0;

        console.log(`🧮 Calculating component: ${component.component_name} (${calculationType})`);

        switch (calculationType) {
            case 'fixed':
                amount = parseFloat(component.calculation_value) || 0;
                console.log(`   Fixed amount: ${amount}`);
                break;

            case 'percentage':
                const percentage = parseFloat(component.calculation_value) || 0;
                amount = (baseSalary * percentage) / 100;
                console.log(`   Percentage: ${percentage}% of ${baseSalary} = ${amount}`);
                break;

            case 'formula':
                if (component.calculation_formula) {
                    try {
                        amount = await this.evaluatePayrollFormula(
                            component.calculation_formula,
                            baseSalary,
                            employeeRecord
                        );
                        console.log(`   Formula result: ${amount}`);
                    } catch (error) {
                        console.error(`   Formula evaluation failed: ${error.message}`);
                        console.error(`   Formula: ${component.calculation_formula}`);
                        amount = 0; // Default to 0 if formula fails
                    }
                } else {
                    console.warn(`   No formula provided for component: ${component.component_name}`);
                    amount = 0;
                }
                break;

            default:
                console.warn(`   Unknown calculation type: ${calculationType}`);
                amount = 0;
                break;
        }

        // Ensure amount is positive for earnings, allow negative for deductions
        if (component.component_type === 'earning' && amount < 0) {
            console.warn(`   Negative earning amount corrected to 0 for: ${component.component_name}`);
            amount = 0;
        }

        return Math.round(amount * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Evaluate a payroll formula with safety checks
     */
    async evaluatePayrollFormula(formula, baseSalary, employeeRecord) {
        // Simple formula evaluator with basic variables
        // Security note: This is a basic implementation. In production, consider using a proper formula parser

        const variables = {
            BASE_SALARY: baseSalary,
            base_salary: baseSalary,
            // Add more variables as needed
        };

        // Replace variables in formula
        let processedFormula = formula;
        for (const [key, value] of Object.entries(variables)) {
            processedFormula = processedFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
        }

        console.log(`   Original formula: ${formula}`);
        console.log(`   Processed formula: ${processedFormula}`);

        // Basic safety check - only allow numbers, operators, and parentheses
        if (!/^[\d\s+\-*/.()]+$/.test(processedFormula)) {
            throw new Error('Formula contains invalid characters');
        }

        try {
            // Use Function constructor for safer evaluation than eval
            const result = new Function(`return ${processedFormula}`)();
            if (isNaN(result) || !isFinite(result)) {
                throw new Error('Formula evaluation resulted in invalid number');
            }
            return result;
        } catch (error) {
            throw new Error(`Formula evaluation failed: ${error.message}`);
        }
    }

    /**
     * Calculate gross salary components
     */
    async calculateGrossComponents(record, employeeData) {
        const baseSalary = parseFloat(record.base_salary) || 0;
        const components = [];
        let total = baseSalary; // Start with base salary
        let additionsTotal = 0; // Track additions separately

        console.log(`💰 GROSS CALCULATION for ${record.employee_name}:`);
        console.log(`   Base Salary: ${baseSalary}`);

        // =============================================
        // 1. ADD CONFIGURED EARNING COMPONENTS
        // =============================================
        if (employeeData.configuredComponents && employeeData.configuredComponents.earnings) {
            console.log(`   📋 Processing ${employeeData.configuredComponents.earnings.length} configured earning components`);

            for (const component of employeeData.configuredComponents.earnings) {
                const calculatedAmount = await this.calculateComponentAmount(component, baseSalary, record);

                if (calculatedAmount > 0) {
                    total += calculatedAmount;
                    additionsTotal += calculatedAmount;
                    components.push({
                        code: component.component_name.replace(/\s+/g, '_').toUpperCase(),
                        name: component.component_name,
                        type: 'earning',
                        category: component.category,
                        amount: calculatedAmount,
                        is_taxable: component.is_taxable,
                        calculation_type: component.calculation_type,
                        _component_id: component.id
                    });

                    console.log(`   ✅ ${component.component_name}: ${calculatedAmount} (${component.calculation_type})`);
                }
            }
        }

        // =============================================
        // 2. ADD EMPLOYEE-SPECIFIC ALLOWANCES
        // =============================================
        if (employeeData.employeeAllowances && employeeData.employeeAllowances.length > 0) {
            console.log(`   📝 Processing ${employeeData.employeeAllowances.length} employee-specific allowances`);

            for (const allowance of employeeData.employeeAllowances) {
                let amount = parseFloat(allowance.amount) || 0;

                // Handle percentage-based allowances
                if (allowance.is_percentage) {
                    amount = (baseSalary * amount) / 100;
                }

                if (amount > 0) {
                    total += amount;
                    additionsTotal += amount;
                    components.push({
                        code: allowance.allowance_type.toUpperCase(),
                        name: allowance.allowance_name || allowance.allowance_type.replace('_', ' '),
                        type: 'earning',
                        category: 'allowance',
                        amount: amount,
                        is_taxable: allowance.is_taxable,
                        _allowance_id: allowance.id
                    });

                    console.log(`   ✅ ${allowance.allowance_name}: ${amount} ${allowance.is_percentage ? '(%)' : ''}`);
                }
            }
        }

        // =============================================
        // 3. LEGACY ALLOWANCES (for backward compatibility)
        // =============================================
        if (employeeData.allowances && employeeData.allowances.length > 0) {
            console.log(`   🔄 Processing ${employeeData.allowances.length} legacy allowances`);

            for (const allowance of employeeData.allowances) {
                const amount = parseFloat(allowance.amount) || 0;
                if (amount > 0) {
                    total += amount;
                    additionsTotal += amount;
                    components.push({
                        code: allowance.allowance_type.toUpperCase(),
                        name: allowance.allowance_type.replace('_', ' '),
                        type: 'earning',
                        category: 'allowance',
                        amount: amount,
                        _legacy: true
                    });

                    console.log(`   ✅ Legacy ${allowance.allowance_type}: ${amount}`);
                }
            }
        }
        
        // Add overtime (this is an addition) - with holiday awareness
        // First check if overtime is enabled in settings
        const overtimeEnabled = await this.isOvertimeEnabled(record.client_id);
        if (employeeData.overtimeHours > 0 && overtimeEnabled) {
            // Get employee-specific daily hours for accurate hourly rate
            const employeeDailyHours = await this.getEmployeeDailyHours(record.employee_id, 8, record.period_start_date, record.period_end_date);
            const workingDaysInMonth = await this.calculateWorkingDaysInPeriod(
                record.period_start_date || '2024-01-01', 
                record.period_end_date || '2024-01-31', 
                record.client_id,
                record.department_id
            );
            const hourlyRate = baseSalary / (workingDaysInMonth * employeeDailyHours);
            let overtimeAmount = 0;
            
            console.log(`⏰ OVERTIME CALCULATION: Employee ${record.employee_id}`);
            console.log(`   Base Salary: ${baseSalary}`);
            console.log(`   Working Days: ${workingDaysInMonth}`);
            console.log(`   Employee Daily Hours: ${employeeDailyHours}h`);
            console.log(`   Hourly Rate: ${hourlyRate.toFixed(2)} (${baseSalary} ÷ (${workingDaysInMonth} × ${employeeDailyHours}))`);
            
            // Try to calculate overtime with holiday multipliers
            try {
                if (employeeData.overtimeDetails && Array.isArray(employeeData.overtimeDetails)) {
                    // Detailed overtime with holiday multipliers
                    for (const overtime of employeeData.overtimeDetails) {
                        // Get dynamic multiplier from settings (not hardcoded!)
                        const defaultMultiplier = await this.getRegularOvertimeMultiplier(record.client_id);
                        const multiplier = overtime.holiday_multiplier || defaultMultiplier;
                        overtimeAmount += (overtime.hours || 0) * hourlyRate * multiplier;
                    }
                } else {
                    // Fallback to standard calculation with dynamic rate
                    const fallbackMultiplier = await this.getRegularOvertimeMultiplier(record.client_id);
                    overtimeAmount = employeeData.overtimeHours * hourlyRate * fallbackMultiplier;
                }
            } catch (error) {
                console.error('Error calculating holiday overtime:', error);
                // Fallback to standard calculation with dynamic rate
                const emergencyFallbackMultiplier = await this.getRegularOvertimeMultiplier(record.client_id);
                overtimeAmount = employeeData.overtimeHours * hourlyRate * emergencyFallbackMultiplier;
                console.log(`   Fallback Calculation: ${employeeData.overtimeHours}h × ${hourlyRate.toFixed(2)} × ${emergencyFallbackMultiplier} = ${overtimeAmount.toFixed(2)}`);
            }
            
            console.log(`   Total Overtime Hours: ${employeeData.overtimeHours}h`);
            console.log(`   Total Overtime Amount: ${overtimeAmount.toFixed(2)}`);
            console.log('');
            
            total += overtimeAmount;
            additionsTotal += overtimeAmount;
            
            components.push({
                code: 'OVERTIME',
                name: 'Overtime Pay',
                type: 'earning',
                category: 'earning',
                amount: overtimeAmount
            });
        }
        
        return { 
            components, 
            total,
            additionsTotal: additionsTotal // Keep raw precision, round only at final storage
        };
    }

    /**
     * Calculate tax components based on method
     */
    async calculateTaxes(grossSalary, calculationMethod, employeeData) {
        const components = [];
        let total = 0;
        
        let taxAmount;
        if (calculationMethod === 'advanced') {
            // Progressive tax calculation
            taxAmount = this.calculateProgressiveTax(grossSalary);
        } else {
            // Simple flat tax
            taxAmount = grossSalary * 0.15;
        }
        
        if (taxAmount > 0) {
            components.push({
                code: 'INCOME_TAX',
                name: 'Income Tax',
                type: 'tax',
                category: 'tax',
                amount: taxAmount
            });
            total += taxAmount;
        }
        
        return { components, total };
    }

    /**
     * Calculate deduction components
     */
    async calculateDeductions(grossSalary, calculationMethod, employeeData) {
        const baseSalary = parseFloat(grossSalary) || 0;
        const components = [];
        let total = 0;

        console.log(`💸 DEDUCTION CALCULATION:`);
        console.log(`   Gross Salary: ${grossSalary}`);

        // =============================================
        // 1. CONFIGURED DEDUCTION COMPONENTS
        // =============================================
        if (employeeData.configuredComponents && employeeData.configuredComponents.deductions) {
            console.log(`   📋 Processing ${employeeData.configuredComponents.deductions.length} configured deduction components`);

            for (const component of employeeData.configuredComponents.deductions) {
                const calculatedAmount = await this.calculateComponentAmount(component, grossSalary, null);

                if (calculatedAmount > 0) {
                    components.push({
                        code: component.component_name.replace(/\s+/g, '_').toUpperCase(),
                        name: component.component_name,
                        type: 'deduction',
                        category: component.category,
                        amount: calculatedAmount,
                        is_taxable: component.is_taxable,
                        calculation_type: component.calculation_type,
                        _component_id: component.id
                    });
                    total += calculatedAmount;

                    console.log(`   ✅ ${component.component_name}: ${calculatedAmount} (${component.calculation_type})`);
                }
            }
        }

        // =============================================
        // 2. EMPLOYEE-SPECIFIC DEDUCTIONS
        // =============================================
        if (employeeData.employeeDeductions && employeeData.employeeDeductions.length > 0) {
            console.log(`   📝 Processing ${employeeData.employeeDeductions.length} employee-specific deductions`);

            for (const deduction of employeeData.employeeDeductions) {
                let amount = parseFloat(deduction.amount) || 0;

                // Handle percentage-based deductions
                if (deduction.is_percentage) {
                    amount = (grossSalary * amount) / 100;
                }

                if (amount > 0) {
                    components.push({
                        code: deduction.deduction_type.toUpperCase(),
                        name: deduction.deduction_name || deduction.deduction_type.replace('_', ' '),
                        type: 'deduction',
                        category: 'custom',
                        amount: amount,
                        is_recurring: deduction.is_recurring,
                        remaining_installments: deduction.remaining_installments,
                        _deduction_id: deduction.id
                    });
                    total += amount;

                    console.log(`   ✅ ${deduction.deduction_name}: ${amount} ${deduction.is_percentage ? '(%)' : ''}`);

                    // Update remaining installments if it's a recurring deduction
                    if (deduction.is_recurring && deduction.remaining_installments > 0) {
                        await this.updateDeductionInstallments(deduction.id, deduction.remaining_installments - 1);
                    }
                }
            }
        }

        // =============================================
        // 3. LEGACY DEDUCTIONS (for backward compatibility)
        // =============================================
        if (employeeData.deductions && employeeData.deductions.length > 0) {
            console.log(`   🔄 Processing ${employeeData.deductions.length} legacy deductions`);

            for (const deduction of employeeData.deductions) {
                let amount;
                if (deduction.is_percentage) {
                    amount = grossSalary * (parseFloat(deduction.amount) / 100);
                } else {
                    amount = parseFloat(deduction.amount) || 0;
                }

                if (amount > 0) {
                    components.push({
                        code: deduction.deduction_type.toUpperCase(),
                        name: deduction.deduction_type.replace('_', ' '),
                        type: 'deduction',
                        category: 'custom',
                        amount: amount,
                        _legacy: true
                    });
                    total += amount;

                    console.log(`   ✅ Legacy ${deduction.deduction_type}: ${amount}`);
                }
            }
        }

        // =============================================
        // 4. FALLBACK: DEFAULT EPF IF NO CONFIGURED COMPONENTS
        // =============================================
        const hasEPFComponent = components.some(c =>
            c.name.toLowerCase().includes('epf') ||
            c.name.toLowerCase().includes('provident fund')
        );

        if (!hasEPFComponent && (!employeeData.configuredComponents ||
            employeeData.configuredComponents.deductions.length === 0)) {

            console.log(`   🔧 Adding fallback EPF deduction (8%)`);

            // EPF (Employee Provident Fund) - 8% EMPLOYEE CONTRIBUTION
            const epfAmount = baseSalary * 0.08;
            components.push({
                code: 'EPF',
                name: 'Employee Provident Fund (8%)',
                type: 'deduction',
                category: 'other',
                amount: epfAmount,
                _fallback: true
            });
            total += epfAmount;

            console.log(`   ✅ Fallback EPF: ${epfAmount}`);
        }

        console.log(`   📊 Total Deductions: ${total}`);

        return { components, total };
    }

    /**
     * Update remaining installments for recurring deductions
     */
    async updateDeductionInstallments(deductionId, remainingInstallments) {
        try {
            const db = getDB();
            await db.execute(`
                UPDATE employee_deductions
                SET remaining_installments = ?,
                    updated_at = NOW()
                WHERE id = ?
            `, [remainingInstallments, deductionId]);

            // Mark as inactive if no installments remaining
            if (remainingInstallments <= 0) {
                await db.execute(`
                    UPDATE employee_deductions
                    SET is_active = 0,
                        updated_at = NOW()
                    WHERE id = ?
                `, [deductionId]);

                console.log(`   📝 Deduction ${deductionId} marked as inactive (installments completed)`);
            }
        } catch (error) {
            console.error(`Error updating deduction installments:`, error);
        }
    }

    /**
     * Progressive tax calculation (Sri Lankan tax slabs)
     */
    calculateProgressiveTax(grossSalary) {
        const taxSlabs = [
            { min: 0, max: 100000, rate: 0 },           // 0% up to 100K
            { min: 100000, max: 200000, rate: 0.06 },   // 6% from 100K-200K  
            { min: 200000, max: 300000, rate: 0.12 },   // 12% from 200K-300K
            { min: 300000, max: 500000, rate: 0.18 },   // 18% from 300K-500K
            { min: 500000, max: 750000, rate: 0.24 },   // 24% from 500K-750K
            { min: 750000, max: Infinity, rate: 0.36 }  // 36% above 750K
        ];

        let tax = 0;
        let remainingSalary = grossSalary;

        for (const slab of taxSlabs) {
            if (remainingSalary <= 0) break;
            
            const taxableInSlab = Math.min(remainingSalary, slab.max - slab.min);
            tax += taxableInSlab * slab.rate;
            remainingSalary -= taxableInSlab;
        }

        return tax; // Return raw precision, round at final storage
    }

    /**
     * Create detailed payroll components for record
     */
    async createPayrollComponents(recordId, componentData, clientId = 'DEFAULT') {
        const db = getDB();
        
        console.log(`Creating components for record ${recordId}:`, {
            grossComponentsCount: componentData.grossComponents?.components?.length || 0,
            deductionComponentsCount: componentData.deductionComponents?.components?.length || 0,
            taxComponentsCount: componentData.taxComponents?.components?.length || 0
        });
        
        const allComponents = [
            ...(componentData.grossComponents?.components || []),
            ...(componentData.deductionComponents?.components || []), 
            ...(componentData.taxComponents?.components || [])
        ];

        for (const comp of allComponents) {
            console.log(`Processing component:`, { name: comp.name, type: comp.type, amount: comp.amount });
            
            // Get or create component_id
            let componentId;
            try {
                const [existingComponent] = await db.execute(
                    'SELECT id FROM payroll_components WHERE component_name = ? AND client_id = ?', 
                    [comp.name, clientId]
                );
                
                if (existingComponent.length > 0) {
                    componentId = existingComponent[0].id;
                    console.log(`Using existing component ID: ${componentId}`);
                } else {
                    componentId = uuidv4();
                    await db.execute(`
                        INSERT INTO payroll_components (
                            id, client_id, component_name, component_type, category, 
                            calculation_type, is_taxable, is_mandatory
                        ) VALUES (?, ?, ?, ?, ?, 'fixed', ?, ?)
                    `, [
                        componentId, clientId, comp.name, comp.type, comp.category,
                        comp.type === 'earning', comp.category === 'statutory'
                    ]);
                    console.log(`Created new component ID: ${componentId}`);
                }

                // Insert component record
                const recordComponentId = uuidv4();
                await db.execute(`
                    INSERT INTO payroll_record_components (
                        id, record_id, component_id, component_code, component_name,
                        component_type, component_category, calculation_method,
                        calculated_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'calculated', ?)
                `, [
                    recordComponentId, recordId, componentId, comp.code, comp.name,
                    comp.type, comp.category, comp.amount
                ]);
                
                console.log(`Created payroll_record_component: ${recordComponentId} for ${comp.name}`);

            } catch (error) {
                console.error(`Failed to create component ${comp.code || comp.name}:`, error.message);
                console.error(`Component data:`, comp);
                console.error(`Full error:`, error);
                
                // Try alternative insertion with different approach
                console.log(`Attempting alternative insertion for component: ${comp.name}`);
            }
        }
    }

    /**
     * Create basic payroll components for record (Legacy - kept for compatibility)
     */
    async createBasicComponents(recordId, amounts, clientId = 'DEFAULT') {
        const db = getDB();
        console.log(`Creating components for record ID: ${recordId}`);
        const components = [
            { code: 'BASIC_SAL', type: 'earning', amount: amounts.baseSalary },
            { code: 'INCOME_TAX', type: 'tax', amount: amounts.taxDeduction },
            { code: 'EPF', type: 'deduction', amount: amounts.providentFund }
        ];

        for (const comp of components) {
            console.log(`Inserting component: ${comp.code} for record ${recordId}`);
            
            // Get or create component_id for the component code
            let componentId;
            try {
                // First try to find existing component
                const [existingComponent] = await db.execute(
                    'SELECT id FROM payroll_components WHERE component_name = ? AND client_id = ?', 
                    [comp.code.replace('_', ' '), clientId]
                );
                
                if (existingComponent.length > 0) {
                    componentId = existingComponent[0].id;
                } else {
                    // Create a new component if it doesn't exist
                    componentId = uuidv4();
                    await db.execute(`
                        INSERT INTO payroll_components (
                            id, client_id, component_name, component_type, category, 
                            calculation_type, is_taxable, is_mandatory
                        ) VALUES (?, ?, ?, ?, ?, 'fixed', ?, ?)
                    `, [
                        componentId, clientId, comp.code.replace('_', ' '), 
                        comp.type === 'tax' ? 'deduction' : comp.type, 
                        comp.type === 'tax' ? 'tax' : comp.type === 'earning' ? 'basic' : 'other', 
                        comp.type === 'earning', 
                        comp.code === 'BASIC_SAL' || comp.code === 'INCOME_TAX' || comp.code === 'EPF'
                    ]);
                }
            } catch (componentError) {
                console.log(`Error handling component ${comp.code}:`, componentError.message);
                // Use a fallback componentId or skip this component
                componentId = uuidv4();
            }

            // Temporarily skip component insertion until table structure is confirmed
            try {
                await db.execute(`
                    INSERT INTO payroll_record_components (
                        id, record_id, component_id, component_code, component_name,
                        component_type, component_category, calculation_method,
                        calculated_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fixed', ?)
                `, [
                    uuidv4(), recordId, componentId, comp.code, comp.code.replace('_', ' '),
                    comp.type, comp.type, comp.amount
                ]);
            } catch (insertError) {
                console.log(`Failed to insert component ${comp.code}:`, insertError.message);
                // Component insertion failed, but continue with calculation
            }
        }
    }

    /**
     * Mark record as having calculation error
     */
    async markRecordError(recordId, errorMessage) {
        const db = getDB();
        await db.execute(
            'UPDATE payroll_records SET calculation_status = "error", calculation_errors = JSON_OBJECT("error", ?) WHERE id = ?',
            [errorMessage, recordId]
        );
    }

    /**
     * Update run statistics (totals, counts)
     */
    async updateRunStatistics(runId) {
        const db = getDB();
        
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_employees,
                COUNT(CASE WHEN calculation_status = 'calculated' THEN 1 END) as processed_employees,
                COALESCE(SUM(CASE WHEN calculation_status = 'calculated' THEN gross_salary END), 0) as total_gross_amount,
                COALESCE(SUM(CASE WHEN calculation_status = 'calculated' THEN total_deductions END), 0) as total_deductions_amount,
                COALESCE(SUM(CASE WHEN calculation_status = 'calculated' THEN net_salary END), 0) as total_net_amount
            FROM payroll_records 
            WHERE run_id = ?
        `, [runId]);

        const stat = stats[0];
        await db.execute(`
            UPDATE payroll_runs SET
                total_employees = ?,
                processed_employees = ?,
                total_gross_amount = ?,
                total_deductions_amount = ?,
                total_net_amount = ?
            WHERE id = ?
        `, [
            stat.total_employees,
            stat.processed_employees,
            stat.total_gross_amount,
            stat.total_deductions_amount,
            stat.total_net_amount,
            runId
        ]);
    }

    /**
     * Check if overtime calculation is enabled in settings
     * @param {string} clientId - Client ID
     * @returns {Promise<boolean>} Whether overtime is enabled
     */
    async isOvertimeEnabled(clientId) {
        const db = getDB();

        try {
            const [setting] = await db.execute(`
                SELECT setting_value
                FROM system_settings
                WHERE client_id = ? AND setting_key = 'enable_overtime_calculation'
                LIMIT 1
            `, [clientId]);

            if (setting.length > 0) {
                const enabled = JSON.parse(setting[0].setting_value);
                console.log(`⚙️  Overtime enabled setting: ${enabled}`);
                return enabled === true || enabled === 'true' || enabled === 1;
            }

            // Default to disabled if no setting found
            console.log(`⚠️  No overtime enable setting found for client ${clientId}, defaulting to disabled`);
            return false;

        } catch (error) {
            console.error('Error checking overtime enabled setting:', error);
            return false; // Safe default - disable overtime if error
        }
    }

    /**
     * Get regular overtime multiplier from settings (NO HARDCODING!)
     * @param {string} clientId - Client ID
     * @returns {Promise<number>} Regular overtime multiplier
     */
    async getRegularOvertimeMultiplier(clientId) {
        const db = getDB();
        
        try {
            // First try to get from overtime_rate_multiplier setting
            const [basicRate] = await db.execute(`
                SELECT setting_value 
                FROM system_settings 
                WHERE client_id = ? AND setting_key = 'overtime_rate_multiplier'
                LIMIT 1
            `, [clientId]);
            
            if (basicRate.length > 0) {
                const rate = parseFloat(JSON.parse(basicRate[0].setting_value));
                // console.log(`   Using overtime_rate_multiplier from settings: ${rate}x`); // Too verbose for payroll calculation
                return rate;
            }
            
            // Fallback to working_hours_config if available
            const [workingHoursConfig] = await db.execute(`
                SELECT setting_value 
                FROM system_settings 
                WHERE client_id = ? AND setting_key = 'working_hours_config'
                LIMIT 1
            `, [clientId]);
            
            if (workingHoursConfig.length > 0) {
                const config = JSON.parse(workingHoursConfig[0].setting_value);
                if (config.weekend_hours_multiplier) {
                    // console.log(`   Using weekend_hours_multiplier from working_hours_config: ${config.weekend_hours_multiplier}x`); // Too verbose
                    return parseFloat(config.weekend_hours_multiplier);
                }
            }
            
            // Ultimate fallback - but log it as a warning
            console.warn(`⚠️  No overtime multiplier found in settings for client ${clientId}, using default 1.5x`);
            return 1.5;
            
        } catch (error) {
            console.error('Error getting regular overtime multiplier:', error);
            console.warn(`⚠️  Error accessing settings, using fallback 1.5x multiplier`);
            return 1.5; // Safe fallback
        }
    }

    /**
     * Log audit events for compliance
     */
    async logAuditEvent(runId, recordId, action, userId, metadata = {}) {
        const db = getDB();
        
        await db.execute(`
            INSERT INTO payroll_audit_log (
                id, run_id, action, user_id,
                new_value, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        `, [
            uuidv4(), runId, action, userId, 
            JSON.stringify(metadata)
        ]);
    }

    // =============================================
    // QUERY METHODS
    // =============================================

    /**
     * Get payroll run with details
     */
    async getPayrollRun(runId, clientId) {
        const db = getDB();
        
        const [run] = await db.execute(`
            SELECT
                pr.*, pp.period_start_date, pp.period_end_date, pp.pay_date,
                'System User' as created_by_name,
                'System User' as processed_by_name
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE pr.id = ? AND pr.client_id = ?
        `, [runId, clientId]);

        if (run.length === 0) {
            throw new Error('Payroll run not found');
        }

        return run[0];
    }

    /**
     * Get payroll runs list with pagination
     */
    async getPayrollRuns(clientId, filters = {}) {
        const db = getDB();
        const {
            status,
            period_id,
            run_type,
            limit = 20,
            offset = 0
        } = filters;

        let whereConditions = ['pr.client_id = ?'];
        let queryParams = [clientId];

        if (status) {
            whereConditions.push('pr.run_status = ?');
            queryParams.push(status);
        }

        if (period_id) {
            whereConditions.push('pr.period_id = ?');
            queryParams.push(period_id);
        }

        if (run_type) {
            whereConditions.push('pr.run_type = ?');
            queryParams.push(run_type);
        }

        const [runs] = await db.execute(`
            SELECT
                pr.id, pr.run_number, pr.run_name, pr.run_type, pr.run_status,
                pr.total_employees, pr.processed_employees,
                pr.total_gross_amount, pr.total_net_amount,
                pr.created_at, pr.completed_at,
                pp.period_start_date, pp.period_end_date,
                'System User' as created_by_name
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            -- LEFT JOIN admin_users au ON pr.created_by = au.id
            -- LEFT JOIN employees creator ON au.employee_id = creator.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY pr.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), parseInt(offset)]);

        // Get total count
        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total
            FROM payroll_runs pr
            WHERE ${whereConditions.join(' AND ')}
        `, queryParams);

        return {
            runs,
            pagination: {
                total: countResult[0].total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(countResult[0].total / limit)
            }
        };
    }

    /**
     * Get individual employee records for a payroll run
     */
    async getPayrollRecords(runId, clientId) {
        const db = getDB();
        
        const [records] = await db.execute(`
            SELECT 
                pr.id, pr.employee_id, pr.employee_code, pr.employee_name,
                pr.department_name, pr.designation_name, pr.calculation_status,
                pr.worked_days, pr.worked_hours, pr.overtime_hours, pr.leave_days,
                pr.total_earnings, pr.total_deductions, pr.total_taxes,
                pr.gross_salary, pr.taxable_income, pr.net_salary,
                pr.payment_status, pr.payment_method, pr.payment_date,
                pr.calculated_at, pr.notes,
                e.base_salary
            FROM payroll_records pr
            JOIN payroll_runs run ON pr.run_id = run.id
            LEFT JOIN employees e ON pr.employee_id = e.id
            WHERE pr.run_id = ? AND run.client_id = ?
            ORDER BY pr.employee_code
        `, [runId, clientId]);

        if (records.length === 0) {
            throw new Error('No payroll records found for this run');
        }

        return records;
    }

    /**
     * Get component breakdown for a specific payroll record
     */
    async getRecordComponents(recordId, clientId) {
        const db = getDB();
        
        console.log(`Getting components for record ${recordId}, client ${clientId}`);
        
        const [components] = await db.execute(`
            SELECT 
                prc.id,
                prc.component_code,
                prc.component_name,
                prc.component_type,
                prc.component_category,
                prc.calculation_method,
                prc.calculated_amount,
                pr.employee_name
            FROM payroll_record_components prc
            JOIN payroll_records pr ON prc.record_id = pr.id
            JOIN payroll_runs run ON pr.run_id = run.id
            WHERE prc.record_id = ? AND run.client_id = ?
            ORDER BY prc.component_type DESC, prc.component_category, prc.component_name
        `, [recordId, clientId]);
        
        console.log(`Found ${components.length} components for record ${recordId}`);
        console.log('Components:', components.map(c => ({ name: c.component_name, type: c.component_type, amount: c.calculated_amount })));

        if (components.length === 0) {
            // Check if the record exists
            const [record] = await db.execute(`
                SELECT pr.id 
                FROM payroll_records pr
                JOIN payroll_runs run ON pr.run_id = run.id
                WHERE pr.id = ? AND run.client_id = ?
            `, [recordId, clientId]);
            
            if (record.length === 0) {
                throw new Error('Payroll record not found');
            }
        }

        return components;
    }

    // =============================================
    // AUTO-CREATE PAYROLL RUNS
    // =============================================

    /**
     * Auto-create payroll runs for all clients for the current month
     * This is designed to be called by a cron job at the start of each month
     */
    async autoCreateMonthlyPayrollRuns() {
        const db = getDB();
        const results = {
            success: [],
            skipped: [],
            errors: []
        };

        try {
            // Get current month and year
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

            console.log(`🤖 AUTO-CREATE: Starting auto-create for ${currentYear}-${String(currentMonth).padStart(2, '0')}`);

            // Get all active clients
            const [clients] = await db.execute(`
                SELECT id, name FROM clients WHERE is_active = 1
            `);

            console.log(`📊 Found ${clients.length} active clients`);

            for (const client of clients) {
                try {
                    // Check if a payroll period exists for current month
                    const [periods] = await db.execute(`
                        SELECT id, period_start_date, period_end_date, period_type, period_number
                        FROM payroll_periods
                        WHERE client_id = ?
                          AND period_year = ?
                          AND period_number = ?
                          AND period_type = 'monthly'
                          AND status = 'active'
                        ORDER BY created_at DESC
                        LIMIT 1
                    `, [client.id, currentYear, currentMonth]);

                    if (periods.length === 0) {
                        results.skipped.push({
                            client_id: client.id,
                            client_name: client.name,
                            reason: `No active payroll period found for ${currentYear}-${String(currentMonth).padStart(2, '0')}`
                        });
                        console.log(`⏭️  SKIPPED ${client.name}: No payroll period for current month`);
                        continue;
                    }

                    const period = periods[0];

                    // Check if payroll run already exists for this period
                    const [existingRuns] = await db.execute(`
                        SELECT id, run_number FROM payroll_runs
                        WHERE client_id = ?
                          AND period_id = ?
                          AND run_type = 'regular'
                    `, [client.id, period.id]);

                    if (existingRuns.length > 0) {
                        results.skipped.push({
                            client_id: client.id,
                            client_name: client.name,
                            reason: `Payroll run already exists: ${existingRuns[0].run_number}`
                        });
                        console.log(`⏭️  SKIPPED ${client.name}: Run already exists (${existingRuns[0].run_number})`);
                        continue;
                    }

                    // Get a valid admin user ID for this client (use first available admin)
                    const [adminUsers] = await db.execute(`
                        SELECT id FROM admin_users
                        WHERE client_id = ?
                        ORDER BY created_at ASC
                        LIMIT 1
                    `, [client.id]);

                    if (adminUsers.length === 0) {
                        results.errors.push({
                            client_id: client.id,
                            client_name: client.name,
                            error: 'No admin user found for client'
                        });
                        console.log(`⏭️  SKIPPED ${client.name}: No admin user found`);
                        continue;
                    }

                    const systemUserId = adminUsers[0].id;

                    // Create payroll run automatically
                    const createResult = await this.createPayrollRun(client.id, systemUserId, {
                        period_id: period.id,
                        run_name: null, // Will auto-generate
                        run_type: 'regular',
                        calculation_method: 'advanced',
                        employee_filters: {}, // All employees
                        notes: 'Automatically created by system on ' + now.toISOString().split('T')[0]
                    });

                    results.success.push({
                        client_id: client.id,
                        client_name: client.name,
                        run_id: createResult.data.run_id,
                        run_number: createResult.data.run_number,
                        total_employees: createResult.data.total_employees
                    });

                    console.log(`✅ CREATED ${client.name}: ${createResult.data.run_number} (${createResult.data.total_employees} employees)`);

                } catch (clientError) {
                    results.errors.push({
                        client_id: client.id,
                        client_name: client.name,
                        error: clientError.message
                    });
                    console.error(`❌ ERROR ${client.name}:`, clientError.message);
                }
            }

            console.log(`\n📈 AUTO-CREATE SUMMARY:`);
            console.log(`   ✅ Created: ${results.success.length}`);
            console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
            console.log(`   ❌ Errors: ${results.errors.length}`);

            return {
                success: true,
                summary: {
                    created: results.success.length,
                    skipped: results.skipped.length,
                    errors: results.errors.length
                },
                details: results
            };

        } catch (error) {
            console.error('❌ AUTO-CREATE FAILED:', error);
            throw error;
        }
    }
}

module.exports = new PayrollRunService();