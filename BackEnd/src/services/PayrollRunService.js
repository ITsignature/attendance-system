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
                e.attendance_affects_salary,
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
                base_salary, attendance_affects_salary,
                weekday_working_days, working_saturdays, working_sundays,
                weekday_daily_hours, saturday_daily_hours, sunday_daily_hours,
                daily_salary, weekday_hourly_rate, saturday_hourly_rate, sunday_hourly_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            recordId, runId, employee.id, employee.employee_code,
            `${employee.first_name} ${employee.last_name}`,
            employee.department_name, employee.designation_name,
            baseSalary, employee.attendance_affects_salary ? 1 : 0,
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

        // =============================================
        // CHECK ATTENDANCE_AFFECTS_SALARY FROM PAYROLL_RECORDS
        // =============================================
        const attendanceAffectsSalary = record.attendance_affects_salary !== 0 && record.attendance_affects_salary !== false;

        if (!attendanceAffectsSalary) {
            console.log(`\n⚙️  ATTENDANCE DOES NOT AFFECT SALARY for ${record.employee_name}`);
            console.log(`   This employee will receive full base salary regardless of attendance.`);
            console.log(`   (Setting stored in payroll_records from employee snapshot at run creation)`);
        }

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

        // =============================================
        // STEP 1: Calculate ACTUAL EARNED BASE SALARY (prorated based on attendance OR full salary)
        // =============================================
        let actualEarnedBaseSalary;
        let attendanceDeduction;

        if (!attendanceAffectsSalary) {
            // Employee gets full salary regardless of attendance
            console.log(`\n💰 Step 1: Using full base salary (attendance not considered)...`);
            actualEarnedBaseSalary = parseFloat(record.base_salary) || 0;
            attendanceDeduction = 0;

            console.log(`   Base Salary (Full): Rs.${actualEarnedBaseSalary.toFixed(2)}`);
            console.log(`   Actual Earned Base: Rs.${actualEarnedBaseSalary.toFixed(2)} (Full salary)`);
            console.log(`   Attendance Shortfall: Rs.0.00 (Not applicable)`);
        } else {
            // Normal attendance-based calculation
            console.log(`\n💰 Step 1: Calculating actual earned base salary (attendance-based)...`);
            const attendanceCalculation = await this.calculateEarnedSalary(
                record.employee_id,
                record.run_id,
                parseFloat(record.base_salary) || 0,
                false  // Do NOT include today's live session for final calculation
            );

            actualEarnedBaseSalary = attendanceCalculation.earned_salary || 0;
            attendanceDeduction = attendanceCalculation.total || 0;

            console.log(`   Base Salary (Full): Rs.${parseFloat(record.base_salary).toFixed(2)}`);
            console.log(`   Actual Earned Base: Rs.${actualEarnedBaseSalary.toFixed(2)}`);
            console.log(`   Attendance Shortfall: Rs.${attendanceDeduction.toFixed(2)}`);
        }

        // =============================================
        // STEP 2: Calculate EPF/ETF on ACTUAL EARNED BASE SALARY ONLY (not on allowances)
        // =============================================
        console.log(`\n💸 Step 2: Calculating statutory deductions (EPF/ETF) on actual earned base...`);
        const deductionComponents = await this.calculateDeductions(actualEarnedBaseSalary, calculationMethod, employeeData);
        console.log(`   EPF/ETF calculated on: Rs.${actualEarnedBaseSalary.toFixed(2)}`);
        console.log(`   Total EPF/ETF: Rs.${deductionComponents.total.toFixed(2)}`);

        // =============================================
        // STEP 3: Calculate allowances and bonuses (FULL amounts, not prorated)
        // =============================================
        console.log(`\n🎁 Step 3: Adding full allowances and bonuses (not prorated)...`);
        const grossComponents = await this.calculateGrossComponents(record, employeeData);

        // Extract allowances (everything except base salary)
        const baseSalary = parseFloat(record.base_salary) || 0;
        const allowancesAmount = grossComponents.additionsTotal > 0 ? grossComponents.additionsTotal : 0;

        console.log(`   Full Allowances: Rs.${allowancesAmount.toFixed(2)}`);
        console.log(`   Financial Bonuses: Rs.${financialAdjustments.bonuses.toFixed(2)}`);

        // =============================================
        // STEP 4: Calculate GROSS SALARY
        // =============================================
        const grossSalary = actualEarnedBaseSalary + allowancesAmount + financialAdjustments.bonuses;
        console.log(`\n📊 Step 4: Gross Salary Calculation:`);
        console.log(`   Actual Earned Base: Rs.${actualEarnedBaseSalary.toFixed(2)}`);
        console.log(`   + Full Allowances: Rs.${allowancesAmount.toFixed(2)}`);
        console.log(`   + Bonuses: Rs.${financialAdjustments.bonuses.toFixed(2)}`);
        console.log(`   = Gross Salary: Rs.${grossSalary.toFixed(2)}`);

        // =============================================
        // STEP 5: Combine all deductions (EPF/ETF + Loans + Advances + Attendance Shortfall)
        // Note: Attendance shortfall is added for informational display purposes
        // =============================================
        console.log(`\n💳 Step 5: Combining all deductions...`);
        const combinedDeductions = {
            components: [
                ...deductionComponents.components
            ],
            total: deductionComponents.total + financialAdjustments.summary.totalDeductions
        };

        // Add EPF/ETF breakdown
        if (deductionComponents.total > 0) {
            console.log(`   EPF/ETF (on Actual Earned Base): Rs.${deductionComponents.total.toFixed(2)}`);
        }

        // Add financial deduction components
        if (financialAdjustments.loanDeductions > 0) {
            combinedDeductions.components.push({
                code: 'LOAN_DED',
                name: 'Loan Deductions',
                type: 'deduction',
                category: 'loan',
                amount: financialAdjustments.loanDeductions,
                details: `${financialAdjustments.records.loans.length} loan(s)`
            });
            console.log(`   Loan Deductions: Rs.${financialAdjustments.loanDeductions.toFixed(2)}`);
        }

        if (financialAdjustments.advanceDeductions > 0) {
            combinedDeductions.components.push({
                code: 'ADVANCE_DED',
                name: 'Advance Deductions',
                type: 'deduction',
                category: 'other',
                amount: financialAdjustments.advanceDeductions,
                details: `${financialAdjustments.records.advances.length} advance(s)`
            });
            console.log(`   Advance Deductions: Rs.${financialAdjustments.advanceDeductions.toFixed(2)}`);
        }

        // Add attendance shortfall for informational display in UI
        if (attendanceDeduction > 0) {
            combinedDeductions.components.push({
                code: 'ATTENDANCE_SHORTFALL',
                name: 'Attendance Shortfall (Info)',
                type: 'deduction',
                category: 'attendance',
                amount: attendanceDeduction,
                details: `Difference between full base (Rs.${baseSalary.toFixed(2)}) and actual earned (Rs.${actualEarnedBaseSalary.toFixed(2)})`
            });
            console.log(`   Attendance Shortfall (Info): Rs.${attendanceDeduction.toFixed(2)}`);
        }

        const totalDeductions = combinedDeductions.total;
        console.log(`   ─────────────────────────────────────────────────────`);
        console.log(`   Total Deductions (EPF/ETF/Loans/Advances): Rs.${totalDeductions.toFixed(2)}`);
        console.log(`   Note: Attendance shortfall shown for info only, not deducted from net salary`);

        // =============================================
        // STEP 6: Calculate NET SALARY
        // =============================================
        // Tax calculation removed - calculate net salary without taxes
        const totalTaxes = 0;
        const taxComponents = { total: 0, components: [] };

        const netSalary = grossSalary - totalDeductions;

        console.log(`\n✅ Step 6: Net Salary Calculation:`);
        console.log(`   Gross Salary: Rs.${grossSalary.toFixed(2)}`);
        console.log(`   - Total Deductions: Rs.${totalDeductions.toFixed(2)}`);
        console.log(`   = NET SALARY: Rs.${netSalary.toFixed(2)}`);

        // Calculate total earnings and deductions from all components for display
        // total_earnings should be ONLY allowances + bonuses (NOT including base salary)
        const totalEarningsFromComponents = allowancesAmount + financialAdjustments.bonuses;
        const totalDeductionsFromComponents = deductionComponents.total + financialAdjustments.loanDeductions + financialAdjustments.advanceDeductions;

        console.log(`\n💾 Database Update:`);
        console.log(`   Total Earnings (Allowances + Bonuses): Rs.${totalEarningsFromComponents.toFixed(2)} (Allowances: ${allowancesAmount.toFixed(2)} + Bonuses: ${financialAdjustments.bonuses.toFixed(2)})`);
        console.log(`   Total Deductions: Rs.${totalDeductionsFromComponents.toFixed(2)} (EPF/ETF: ${deductionComponents.total.toFixed(2)} + Loans: ${financialAdjustments.loanDeductions.toFixed(2)} + Advances: ${financialAdjustments.advanceDeductions.toFixed(2)})`);

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
            Math.round(totalEarningsFromComponents * 100) / 100,
            Math.round(totalDeductionsFromComponents * 100) / 100,
            Math.round(totalTaxes * 100) / 100,
            Math.round(grossSalary * 100) / 100,
            Math.round(grossSalary * 100) / 100,
            Math.round(netSalary * 100) / 100,
            record.id
        ]);

        // Create detailed component records with financial components
        const updatedGrossComponents = {
            components: []
        };

        // 1. Add actual earned base salary as primary earning component
        if (actualEarnedBaseSalary > 0) {
            updatedGrossComponents.components.push({
                code: 'BASE_SALARY',
                name: 'Base Salary',
                type: 'earning',
                category: 'basic',
                amount: actualEarnedBaseSalary,
                details: `Attendance-based (Full: Rs.${baseSalary.toFixed(2)}, Earned: Rs.${actualEarnedBaseSalary.toFixed(2)})`
            });
        }

        // 2. Add all allowances (from grossComponents, excluding any base salary component)
        if (grossComponents.components && grossComponents.components.length > 0) {
            const allowanceComponents = grossComponents.components.filter(c => c.category !== 'basic');
            updatedGrossComponents.components.push(...allowanceComponents);
            console.log(`Added ${allowanceComponents.length} allowance components`);
        }

        // 3. Add financial bonuses
        if (financialAdjustments.bonuses > 0) {
            updatedGrossComponents.components.push({
                code: 'BONUS',
                name: 'Financial Bonuses',
                type: 'earning',
                category: 'bonus',
                amount: financialAdjustments.bonuses,
                details: `${financialAdjustments.records.bonuses.length} bonus(es)`
            });
        }

        console.log(`\n📝 Components to save:`);
        console.log(`   Gross/Earnings components: ${updatedGrossComponents.components.length}`);
        console.log(`   Deduction components: ${combinedDeductions.components.length}`);

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
        console.log(`   Base Salary (Full): Rs.${baseSalary.toFixed(2)}`);
        console.log(`   Actual Earned Base (Attendance-based): Rs.${actualEarnedBaseSalary.toFixed(2)}`);
        console.log(`   Attendance Shortfall: Rs.${attendanceDeduction.toFixed(2)}`);
        console.log(`   ─────────────────────────────────────────────────────────────────────`);
        console.log(`   Full Allowances: Rs.${allowancesAmount.toFixed(2)}`);
        console.log(`   Bonuses: Rs.${financialAdjustments.bonuses.toFixed(2)}`);
        console.log(`   ─────────────────────────────────────────────────────────────────────`);
        console.log(`   GROSS SALARY: Rs.${grossSalary.toFixed(2)}`);
        console.log(`   ─────────────────────────────────────────────────────────────────────`);
        console.log(`   Deductions Breakdown:`);
        console.log(`      - EPF/ETF (on Actual Earned Base): Rs.${deductionComponents.total.toFixed(2)}`);
        console.log(`      - Loan Deductions: Rs.${financialAdjustments.loanDeductions.toFixed(2)}`);
        console.log(`      - Advance Deductions: Rs.${financialAdjustments.advanceDeductions.toFixed(2)}`);
        console.log(`      - Attendance Shortfall (Info): Rs.${attendanceDeduction.toFixed(2)}`);
        console.log(`   Total Actual Deductions (EPF/Loans/Advances): Rs.${totalDeductions.toFixed(2)}`);
        console.log(`   ─────────────────────────────────────────────────────────────────────`);
        console.log(`   NET SALARY: Rs.${netSalary.toFixed(2)}`);
        console.log(`   Note: Attendance shortfall is shown for information only`);
        console.log(`${'='.repeat(70)}\n`);
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
            // payable_duration is now stored in SECONDS, convert to hours
            const payableDurationSeconds = parseFloat(record.payable_duration) || 0;
            const payableDuration = payableDurationSeconds / 3600; // Convert seconds to hours (seconds / 60 / 60)
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
                            // Employee works on this weekend day, calculate hours from weekend-specific in_time and out_time
                            if (dayConfig.in_time && dayConfig.out_time) {
                                const empInTime = new Date(`2000-01-01 ${dayConfig.in_time}`);
                                const empOutTime = new Date(`2000-01-01 ${dayConfig.out_time}`);

                                if (!isNaN(empInTime.getTime()) && !isNaN(empOutTime.getTime())) {
                                    const diffMs = empOutTime.getTime() - empInTime.getTime();
                                    const hours = diffMs / (1000 * 60 * 60);
                                    const dailyHours = Math.max(1, Math.min(16, Math.round(hours * 100) / 100));

                                    console.log(`Employee ${employeeId} ${dayType} hours (working=${dayConfig.working}): ${dayConfig.in_time} - ${dayConfig.out_time} = ${dailyHours} hours`);
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
     * Calculate earned salary based on worked hours (NEW OPTIMIZED APPROACH - FIXED)
     * Calculates expected salary until today vs actual earned salary
     * Deduction = Expected Earned (until today) - Actual Earned (until today)
     *
     * @param {string} employeeId - Employee ID
     * @param {string} runId - Payroll run ID
     * @param {number} baseSalary - Base salary
     * @param {boolean} includeLiveSession - Whether to include today's ongoing session (default: false)
     */
    async calculateEarnedSalary(employeeId, runId, baseSalary, includeLiveSession = false) {
        const db = getDB();

        // Get employee name and code for logging
        const [employeeInfo] = await db.execute(`
            SELECT first_name, last_name, employee_code
            FROM employees
            WHERE id = ?
        `, [employeeId]);

        const employeeName = employeeInfo[0] ? `${employeeInfo[0].first_name} ${employeeInfo[0].last_name}` : 'Unknown';
        const employeeCode = employeeInfo[0]?.employee_code || employeeId;

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

        // Parse period end date in local time to match today's local time
        const periodEndParts = period.period_end_date.split('-');
        const periodEndDateFull = new Date(periodEndParts[0], periodEndParts[1] - 1, periodEndParts[2], 0, 0, 0, 0);

        const calculationEndDate = today < periodEndDateFull ? today : periodEndDateFull;
        const isPartialPeriod = today < periodEndDateFull;

        // Helper functions for date handling (defined early for debug logging)
        const getLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        console.log(`   🔍 DEBUG - Date Calculation:`);
        console.log(`      Today: ${getLocalDateString(today)} (${today.toISOString()})`);
        console.log(`      Period End Date Full: ${getLocalDateString(periodEndDateFull)} (${periodEndDateFull.toISOString()})`);
        console.log(`      Comparison (today < periodEndDateFull): ${today < periodEndDateFull}`);
        console.log(`      Calculation End Date: ${getLocalDateString(calculationEndDate)} (${calculationEndDate.toISOString()})`);

        console.log(`\n💰 CALCULATING ATTENDANCE DEDUCTION ${includeLiveSession ? '(LIVE PREVIEW - Real-time)' : '(FINAL CALCULATION - Completed sessions only)'}`);
        console.log(`   👤 Employee: ${employeeName} (${employeeCode})`);
        console.log(`   📅 Full Period: ${period.period_start_date} to ${period.period_end_date}`);
        console.log(`   📅 Calculation Until: ${getLocalDateString(calculationEndDate)} ${isPartialPeriod ? '(PARTIAL - Until Today)' : '(FULL PERIOD)'}`);
        console.log(`   Base Salary (Full Month): Rs.${baseSalary.toFixed(2)}`);
        console.log(`   Mode: ${includeLiveSession ? '⚡ REAL-TIME (includes ongoing session)' : '✅ FINAL (completed sessions only)'}`);

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

        console.log(`\n   💵 Pre-calculated Rates for ${employeeName} (${employeeCode}):`);
        console.log(`      Daily Salary: Rs.${dailySalary.toFixed(2)}`);
        console.log(`      Weekday Hourly Rate: Rs.${weekdayHourlyRate.toFixed(2)}`);
        console.log(`      Saturday Hourly Rate: Rs.${saturdayHourlyRate.toFixed(2)}`);
        console.log(`      Sunday Hourly Rate: Rs.${sundayHourlyRate.toFixed(2)}`);
        console.log(`\n   📊 Full Period Working Days for ${employeeName} (${employeeCode}):`);
        console.log(`      Weekdays: ${fullPeriodWeekdays}, Saturdays: ${fullPeriodSaturdays}, Sundays: ${fullPeriodSundays}`);

        // Calculate working days for expected hours
        // For FINAL mode: Include today as a full working day
        // For LIVE mode: Use yesterday, then add today's partial hours separately
        const yesterday = new Date(today);  // Use the test-overridden 'today' variable
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        const todayDate = new Date(today);  // Use the test-overridden 'today' variable
        todayDate.setHours(23, 59, 59, 999);

        const calculationDate = includeLiveSession ? yesterday : todayDate;

        let workingDaysForExpected;
        if (isPartialPeriod) {
            // Get employee info for department
            const [empInfo] = await db.execute(`
                SELECT department_id FROM employees WHERE id = ?
            `, [employeeId]);

            const HolidayService = require('./HolidayService');
            workingDaysForExpected = await HolidayService.calculateWorkingDays(
                clientId,
                period.period_start_date,
                calculationDate.toISOString().split('T')[0],
                empInfo[0]?.department_id,
                false,
                employeeId
            );
        } else {
            // Full period - use pre-calculated values
            workingDaysForExpected = {
                working_days: fullPeriodWeekdays + fullPeriodSaturdays + fullPeriodSundays,
                weekend_working_days: fullPeriodSaturdays + fullPeriodSundays,
                working_saturdays: fullPeriodSaturdays,
                working_sundays: fullPeriodSundays
            };
        }

        const weekdaysForExpected = (workingDaysForExpected.working_days - workingDaysForExpected.weekend_working_days) || 0;
        const saturdaysForExpected = workingDaysForExpected.working_saturdays || 0;
        const sundaysForExpected = workingDaysForExpected.working_sundays || 0;

        console.log(`\n   📊 Working Days for Expected Calculation for ${employeeName} (${employeeCode}):`);
        console.log(`      Up to: ${getLocalDateString(calculationDate)} ${includeLiveSession ? '(yesterday, today calculated separately)' : '(including today)'}`);
        console.log(`      Weekdays: ${weekdaysForExpected}, Saturdays: ${saturdaysForExpected}, Sundays: ${sundaysForExpected}`);

        // Calculate EXPECTED hours
        const expectedWeekdayHoursBase = weekdaysForExpected * weekdayDailyHours;
        const expectedSaturdayHoursBase = saturdaysForExpected * saturdayDailyHours;
        const expectedSundayHoursBase = sundaysForExpected * sundayDailyHours;

        // Calculate ACTUAL worked hours from COMPLETED sessions
        // Use calculationEndDate instead of today's date to properly handle past months
        // Helper function to parse date strings in local time
        const parseLocalDate = (dateStr) => {
            const parts = dateStr.split('-');
            return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        };

        const attendanceEndDateStr = getLocalDateString(calculationEndDate);

        // First, get detailed attendance records for logging
        const [detailedAttendance] = await db.execute(`
            SELECT
                date,
                is_weekend,
                check_in_time,
                check_out_time,
                payable_duration,
                CASE
                    WHEN is_weekend BETWEEN 2 AND 6 THEN 'Weekday'
                    WHEN is_weekend = 7 THEN 'Saturday'
                    WHEN is_weekend = 1 THEN 'Sunday'
                END as day_type
            FROM attendance
            WHERE employee_id = ?
            AND date BETWEEN ? AND ?
            AND check_out_time IS NOT NULL
            ORDER BY date ASC
        `, [employeeId, period.period_start_date, attendanceEndDateStr]);

        console.log(`\n   ⏰ Calculating Completed Hours for ${employeeName} (${employeeCode}) - All completed sessions:`);
        console.log(`      Period: ${period.period_start_date} to ${attendanceEndDateStr}`);
        console.log(`      Total completed sessions found: ${detailedAttendance.length}`);

        if (detailedAttendance.length > 0) {
            console.log(`\n      📋 Attendance Breakdown for ${employeeName} (${employeeCode}):`);
            detailedAttendance.forEach((record, index) => {
                // payable_duration is stored in SECONDS
                const durationSeconds = parseFloat(record.payable_duration) || 0;
                const durationHours = (durationSeconds / 3600).toFixed(2);
                console.log(`         ${index + 1}. ${record.date} (${record.day_type}): ${durationSeconds} sec (${durationHours}h)`);
            });
        }

        // Now calculate the aggregated totals
        // NOTE: payable_duration is stored in SECONDS, so we sum them first, then convert to hours
        const [completedSeconds] = await db.execute(`
            SELECT
                SUM(CASE WHEN is_weekend BETWEEN 2 AND 6 THEN payable_duration ELSE 0 END) as weekday_seconds,
                SUM(CASE WHEN is_weekend = 7 THEN payable_duration ELSE 0 END) as saturday_seconds,
                SUM(CASE WHEN is_weekend = 1 THEN payable_duration ELSE 0 END) as sunday_seconds
            FROM attendance
            WHERE employee_id = ?
            AND date BETWEEN ? AND ?
            AND check_out_time IS NOT NULL
        `, [employeeId, period.period_start_date, attendanceEndDateStr]);

        // Convert seconds to hours (seconds / 60 / 60)
        const attendanceWeekdayHours = parseFloat(completedSeconds[0].weekday_seconds || 0) / 3600;
        const attendanceSaturdayHours = parseFloat(completedSeconds[0].saturday_seconds || 0) / 3600;
        const attendanceSundayHours = parseFloat(completedSeconds[0].sunday_seconds || 0) / 3600;

        console.log(`\n      📊 Attendance Hours for ${employeeName} (${employeeCode}):`);
        console.log(`         Weekday: ${attendanceWeekdayHours.toFixed(2)}h`);
        console.log(`         Saturday: ${attendanceSaturdayHours.toFixed(2)}h`);
        console.log(`         Sunday: ${attendanceSundayHours.toFixed(2)}h`);

        // For leave calculations, use today's date (or period end date) instead of attendance end date
        // This ensures that leaves approved for today are included in the calculation
        const leaveEndDateStr = getLocalDateString(calculationEndDate);

        // Fetch approved leave requests that overlap with the payroll period
        const [leaveRequests] = await db.execute(`
            SELECT
                id,
                start_date,
                end_date,
                leave_duration,
                start_time,
                end_time,
                is_paid,
                payable_leave_hours_weekday,
                payable_leave_hours_saturday,
                payable_leave_hours_sunday
            FROM leave_requests
            WHERE employee_id = ?
            AND status = 'approved'
            AND is_paid = TRUE
            AND (
                (start_date BETWEEN ? AND ?) OR
                (end_date BETWEEN ? AND ?) OR
                (start_date <= ? AND end_date >= ?)
            )
        `, [employeeId, period.period_start_date, leaveEndDateStr, period.period_start_date, leaveEndDateStr, period.period_start_date, leaveEndDateStr]);

        console.log(`          ${employeeName} - Leave period: ${period.period_start_date} to ${leaveEndDateStr}, Attendance period: ${period.period_start_date} to ${attendanceEndDateStr},
            leave requeest length: ${leaveRequests.length}, period end date full: ${periodEndDateFull}`);

        // Calculate leave hours that fall within the payroll period
        let leaveWeekdayHours = 0;
        let leaveSaturdayHours = 0;
        let leaveSundayHours = 0;

        if (leaveRequests.length > 0) {
            console.log(`\n      📅 Processing ${leaveRequests.length} approved paid leave request(s) for ${employeeName} (${employeeCode}):`);

            const weekdayDailyHours = parseFloat(rates.weekday_daily_hours) || 8;
            const saturdayDailyHours = parseFloat(rates.saturday_daily_hours) || 0;
            const sundayDailyHours = parseFloat(rates.sunday_daily_hours) || 0;

            // Fetch holidays that overlap with the payroll period to exclude them from leave hours
            const [holidays] = await db.execute(`
                SELECT date
                FROM holidays
                WHERE client_id = ?
                AND date BETWEEN ? AND ?
                AND (applies_to_all = TRUE OR department_ids IS NULL)
            `, [clientId, period.period_start_date, attendanceEndDateStr]);

            const holidayDates = new Set(holidays.map(h => h.date));
            if (holidayDates.size > 0) {
                console.log(`      🎉 Found ${holidayDates.size} holiday(s) in period - will be excluded from leave hours`);
            }

            for (const leave of leaveRequests) {
                const leaveStart = parseLocalDate(leave.start_date);
                const leaveEnd = parseLocalDate(leave.end_date);
                const periodStart = parseLocalDate(period.period_start_date);
                const periodEnd = parseLocalDate(leaveEndDateStr);

                // Calculate the overlap between leave and payroll period
                const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
                const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

                console.log(`         Leave: ${leave.start_date} to ${leave.end_date} (${leave.leave_duration || 'full_day'})`);
                console.log(`         Overlap: ${getLocalDateString(overlapStart)} to ${getLocalDateString(overlapEnd)}`);

                // Iterate through each day in the overlap period
                let currentDate = new Date(overlapStart);
                let tempWeekdayHours = 0;
                let tempSaturdayHours = 0;
                let tempSundayHours = 0;
                let holidaysExcluded = 0;

                while (currentDate <= overlapEnd) {
                    const currentDateStr = getLocalDateString(currentDate);
                    const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

                    // Check if this day is a holiday - if so, skip it (no leave hours needed)
                    if (holidayDates.has(currentDateStr)) {
                        console.log(`         🎉 ${currentDateStr} is a holiday - excluded from leave hours`);
                        holidaysExcluded++;
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }

                    let dailyHours = 0;
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        // Weekday (Monday-Friday)
                        dailyHours = weekdayDailyHours;
                    } else if (dayOfWeek === 6) {
                        // Saturday
                        dailyHours = saturdayDailyHours;
                    } else {
                        // Sunday
                        dailyHours = sundayDailyHours;
                    }

                    // Apply leave duration multiplier
                    if (leave.leave_duration === 'half_day') {
                        dailyHours = dailyHours * 0.5;
                    } else if (leave.leave_duration === 'short_leave' && leave.start_time && leave.end_time) {
                        // Calculate actual hours for short leave
                        const startTime = new Date(`2000-01-01 ${leave.start_time}`);
                        const endTime = new Date(`2000-01-01 ${leave.end_time}`);
                        if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                            const diffMs = endTime.getTime() - startTime.getTime();
                            dailyHours = Math.max(0, Math.min(24, diffMs / (1000 * 60 * 60)));
                        } else {
                            dailyHours = 0;
                        }
                    }

                    // Add to appropriate day type total
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        tempWeekdayHours += dailyHours;
                    } else if (dayOfWeek === 6) {
                        tempSaturdayHours += dailyHours;
                    } else {
                        tempSundayHours += dailyHours;
                    }

                    // Move to next day
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                if (holidaysExcluded > 0) {
                    console.log(`         ✓ Excluded ${holidaysExcluded} holiday(s) from leave hours`);
                }

                console.log(`         Hours in period: Weekday=${tempWeekdayHours.toFixed(2)}h, Saturday=${tempSaturdayHours.toFixed(2)}h, Sunday=${tempSundayHours.toFixed(2)}h`);

                leaveWeekdayHours += tempWeekdayHours;
                leaveSaturdayHours += tempSaturdayHours;
                leaveSundayHours += tempSundayHours;
            }
        }

        console.log(`\n      📅 Total Leave Hours for ${employeeName} (${employeeCode}):`);
        console.log(`         Weekday: ${leaveWeekdayHours.toFixed(2)}h`);
        console.log(`         Saturday: ${leaveSaturdayHours.toFixed(2)}h`);
        console.log(`         Sunday: ${leaveSundayHours.toFixed(2)}h`);

        // Calculate total completed hours (attendance + leave)
        const completedWeekdayHours = attendanceWeekdayHours + leaveWeekdayHours;
        const completedSaturdayHours = attendanceSaturdayHours + leaveSaturdayHours;
        const completedSundayHours = attendanceSundayHours + leaveSundayHours;

        console.log(`\n      📊 Total Actual Earned Hours for ${employeeName} (${employeeCode}):`);
        console.log(`         Weekday: ${completedWeekdayHours.toFixed(2)}h (Attendance: ${attendanceWeekdayHours.toFixed(2)}h + Leave: ${leaveWeekdayHours.toFixed(2)}h)`);
        console.log(`         Saturday: ${completedSaturdayHours.toFixed(2)}h (Attendance: ${attendanceSaturdayHours.toFixed(2)}h + Leave: ${leaveSaturdayHours.toFixed(2)}h)`);
        console.log(`         Sunday: ${completedSundayHours.toFixed(2)}h (Attendance: ${attendanceSundayHours.toFixed(2)}h + Leave: ${leaveSundayHours.toFixed(2)}h)`);

        // Get TODAY's attendance record for real-time calculation (only if includeLiveSession is true)
        let todayExpectedHours = 0;
        let todayActualHours = 0;
        let todayDayType = null;
        let todayIsLive = false;

        // Only include today's live session if today is within the payroll period
        const todayStr = today.toISOString().split('T')[0];
        const isWithinPeriod = todayStr >= period.period_start_date && todayStr <= period.period_end_date;

        if (includeLiveSession && isWithinPeriod) {
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
                console.log(`\n   🔴 LIVE SESSION TODAY for ${employeeName} (${employeeCode}) - ${todayDayType.toUpperCase()}:`);
                console.log(`      Scheduled Start: ${scheduledStart}`);
                console.log(`      Check-in Time: ${checkIn}`);
                console.log(`      Current Time: ${now.toLocaleTimeString('en-US', {hour12: false})}`);
                console.log(`      Expected Hours (scheduled → now): ${todayExpectedHours.toFixed(2)}h`);
                console.log(`      Actual Hours (check-in → now): ${todayActualHours.toFixed(2)}h`);
            }
            }
        } else if (!includeLiveSession) {
            console.log(`\n   ⏰ Live session calculation SKIPPED (final calculation mode)`);
        } else if (!isWithinPeriod) {
            console.log(`\n   ⏰ Live session calculation SKIPPED (today ${todayStr} is outside payroll period ${period.period_start_date} to ${period.period_end_date})`);
        }

        // Calculate TOTAL expected hours
        // For FINAL calculation: Base hours already include today as full day
        // For LIVE preview: Base hours don't include today, we add today's partial hours
        let totalExpectedWeekdayHours = expectedWeekdayHoursBase;
        let totalExpectedSaturdayHours = expectedSaturdayHoursBase;
        let totalExpectedSundayHours = expectedSundayHoursBase;

        // Add today's expected ongoing hours if we're in live preview mode
        if (includeLiveSession && todayDayType === 'weekday') {
            totalExpectedWeekdayHours += todayExpectedHours;
        } else if (includeLiveSession && todayDayType === 'saturday') {
            totalExpectedSaturdayHours += todayExpectedHours;
        } else if (includeLiveSession && todayDayType === 'sunday') {
            totalExpectedSundayHours += todayExpectedHours;
        }

        const totalExpectedHours = totalExpectedWeekdayHours + totalExpectedSaturdayHours + totalExpectedSundayHours;

        // Calculate TOTAL actual hours
        // completedWeekdayHours already includes ALL completed sessions (including today's completed sessions)
        // We only add today's live session hours if includeLiveSession is true
        let totalActualWeekdayHours = completedWeekdayHours;
        let totalActualSaturdayHours = completedSaturdayHours;
        let totalActualSundayHours = completedSundayHours;

        // Only add today's ongoing session hours if we're including live session
        if (includeLiveSession && todayDayType === 'weekday') {
            totalActualWeekdayHours += todayActualHours;
        } else if (includeLiveSession && todayDayType === 'saturday') {
            totalActualSaturdayHours += todayActualHours;
        } else if (includeLiveSession && todayDayType === 'sunday') {
            totalActualSundayHours += todayActualHours;
        }

        const totalActualHours = totalActualWeekdayHours + totalActualSaturdayHours + totalActualSundayHours;

        const modeLabel = includeLiveSession ? 'including live session' : 'completed sessions only';

        console.log(`\n   ⏰ TOTAL EXPECTED Hours for ${employeeName} (${employeeCode}) - ${modeLabel}:`);
        console.log(`      Weekday: ${totalExpectedWeekdayHours.toFixed(2)}h${includeLiveSession && todayDayType === 'weekday' && todayExpectedHours > 0 ? ` (includes ${todayExpectedHours.toFixed(2)}h expected today)` : ''}`);
        console.log(`      Saturday: ${totalExpectedSaturdayHours.toFixed(2)}h${includeLiveSession && todayDayType === 'saturday' && todayExpectedHours > 0 ? ` (includes ${todayExpectedHours.toFixed(2)}h expected today)` : ''}`);
        console.log(`      Sunday: ${totalExpectedSundayHours.toFixed(2)}h${includeLiveSession && todayDayType === 'sunday' && todayExpectedHours > 0 ? ` (includes ${todayExpectedHours.toFixed(2)}h expected today)` : ''}`);
        console.log(`      Total Expected: ${totalExpectedHours.toFixed(2)}h`);

        console.log(`\n   ⏰ TOTAL ACTUAL Hours for ${employeeName} (${employeeCode}) - ${modeLabel}:`);
        console.log(`      Weekday: ${totalActualWeekdayHours.toFixed(2)}h${includeLiveSession && todayDayType === 'weekday' && todayIsLive ? ` (includes ${todayActualHours.toFixed(2)}h live)` : ''}`);
        console.log(`      Saturday: ${totalActualSaturdayHours.toFixed(2)}h${includeLiveSession && todayDayType === 'saturday' && todayIsLive ? ` (includes ${todayActualHours.toFixed(2)}h live)` : ''}`);
        console.log(`      Sunday: ${totalActualSundayHours.toFixed(2)}h${includeLiveSession && todayDayType === 'sunday' && todayIsLive ? ` (includes ${todayActualHours.toFixed(2)}h live)` : ''}`);
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

        console.log(`\n   💵 EXPECTED Earned Salary for ${employeeName} (${employeeCode}) - until NOW:`);
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

        console.log(`\n   💵 ACTUAL Earned Salary for ${employeeName} (${employeeCode}) - including live session:`);
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

        const calcMode = includeLiveSession ? 'REAL-TIME (Live Preview)' : 'FINAL CALCULATION';
        console.log(`\n   📊 ${calcMode} for ${employeeName} (${employeeCode}):`);
        console.log(`      Calculated At: ${currentTimeStr}`);
        console.log(`      Expected Earned: Rs.${totalExpectedEarned.toFixed(2)}`);
        console.log(`      Actual Earned: Rs.${totalActualEarned.toFixed(2)}`);
        console.log(`      ─────────────────────────────────────────────────────`);
        console.log(`      Attendance Deduction: Rs.${deduction.toFixed(2)}`);
        console.log(`      (Formula: Expected - Actual, NOT Base Salary - Actual)`);

        if (deduction === 0) {
            console.log(`      ✅ No deduction - ${employeeName} worked all expected hours!`);
        } else {
            const deductionPercentage = totalExpectedEarned > 0 ? ((deduction / totalExpectedEarned) * 100).toFixed(2) : 0;
            const shortfallHours = totalExpectedHours - totalActualHours;
            console.log(`      📉 Shortfall for ${employeeName}: ${shortfallHours.toFixed(2)} hours (${deductionPercentage}% of expected)`);
        }

        if (includeLiveSession && todayIsLive) {
            console.log(`\n   ⚠️  NOTE: ${employeeName} is currently checked in. This is a LIVE PREVIEW.`);
            console.log(`      Running this calculation again later will produce a different result as time progresses.`);
        } else if (!includeLiveSession) {
            console.log(`\n   ✅ FINAL MODE: Only completed sessions counted (today's ongoing session excluded).`);
        }

        // Calculate earnings breakdown by source (attendance vs paid leaves)
        const attendanceWeekdayEarned = attendanceWeekdayHours * weekdayHourlyRate;
        const attendanceSaturdayEarned = attendanceSaturdayHours * saturdayHourlyRate;
        const attendanceSundayEarned = attendanceSundayHours * sundayHourlyRate;
        const totalAttendanceEarned = attendanceWeekdayEarned + attendanceSaturdayEarned + attendanceSundayEarned;

        const leaveWeekdayEarned = leaveWeekdayHours * weekdayHourlyRate;
        const leaveSaturdayEarned = leaveSaturdayHours * saturdayHourlyRate;
        const leaveSundayEarned = leaveSundayHours * sundayHourlyRate;
        const totalLeaveEarned = leaveWeekdayEarned + leaveSaturdayEarned + leaveSundayEarned;

        // Add today's live session earnings to attendance if applicable
        let liveSessionEarned = 0;
        if (includeLiveSession && todayIsLive) {
            if (todayDayType === 'weekday') {
                liveSessionEarned = todayActualHours * weekdayHourlyRate;
            } else if (todayDayType === 'saturday') {
                liveSessionEarned = todayActualHours * saturdayHourlyRate;
            } else if (todayDayType === 'sunday') {
                liveSessionEarned = todayActualHours * sundayHourlyRate;
            }
        }

        // ============================================
        // CALCULATE SHORTFALL BREAKDOWN
        // ============================================

        // 1. Get unpaid leaves deduction
        const [unpaidLeaves] = await db.execute(`
            SELECT
                start_date,
                end_date,
                leave_duration,
                start_time,
                end_time
            FROM leave_requests
            WHERE employee_id = ?
            AND status = 'approved'
            AND is_paid = FALSE
            AND (
                (start_date BETWEEN ? AND ?) OR
                (end_date BETWEEN ? AND ?) OR
                (start_date <= ? AND end_date >= ?)
            )
        `, [employeeId, period.period_start_date, leaveEndDateStr, period.period_start_date, leaveEndDateStr, period.period_start_date, leaveEndDateStr]);

        let unpaidLeaveWeekdayHours = 0;
        let unpaidLeaveSaturdayHours = 0;
        let unpaidLeaveSundayHours = 0;

        if (unpaidLeaves.length > 0) {
            console.log(`\n      📅 Processing ${unpaidLeaves.length} unpaid leave request(s) for ${employeeName} (${employeeCode}):`);

            for (const leave of unpaidLeaves) {
                const leaveStart = parseLocalDate(leave.start_date);
                const leaveEnd = parseLocalDate(leave.end_date);
                const periodStart = parseLocalDate(period.period_start_date);
                const periodEnd = parseLocalDate(leaveEndDateStr);

                const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
                const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

                let currentDate = new Date(overlapStart);

                while (currentDate <= overlapEnd) {
                    const dayOfWeek = currentDate.getDay();
                    let dailyHours = 0;

                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        dailyHours = weekdayDailyHours;
                    } else if (dayOfWeek === 6) {
                        dailyHours = saturdayDailyHours;
                    } else {
                        dailyHours = sundayDailyHours;
                    }

                    if (leave.leave_duration === 'half_day') {
                        dailyHours = dailyHours * 0.5;
                    } else if (leave.leave_duration === 'short_leave' && leave.start_time && leave.end_time) {
                        const startTime = new Date(`2000-01-01 ${leave.start_time}`);
                        const endTime = new Date(`2000-01-01 ${leave.end_time}`);
                        if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                            const diffMs = endTime.getTime() - startTime.getTime();
                            dailyHours = Math.max(0, Math.min(24, diffMs / (1000 * 60 * 60)));
                        } else {
                            dailyHours = 0;
                        }
                    }

                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        unpaidLeaveWeekdayHours += dailyHours;
                    } else if (dayOfWeek === 6) {
                        unpaidLeaveSaturdayHours += dailyHours;
                    } else {
                        unpaidLeaveSundayHours += dailyHours;
                    }

                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        }

        const unpaidLeaveDeduction = (unpaidLeaveWeekdayHours * weekdayHourlyRate) +
                                     (unpaidLeaveSaturdayHours * saturdayHourlyRate) +
                                     (unpaidLeaveSundayHours * sundayHourlyRate);

        console.log(`\n      📅 Unpaid Leave Deduction for ${employeeName} (${employeeCode}): Rs.${unpaidLeaveDeduction.toFixed(2)}`);

        // 2. Calculate time variance (late arrivals + early departures)
        // This is the shortfall from attended days where hours < expected
        const [attendanceWithSchedule] = await db.execute(`
            SELECT
                date,
                scheduled_in_time,
                scheduled_out_time,
                check_in_time,
                check_out_time,
                payable_duration,
                is_weekend
            FROM attendance
            WHERE employee_id = ?
            AND date BETWEEN ? AND ?
            AND check_out_time IS NOT NULL
        `, [employeeId, period.period_start_date, attendanceEndDateStr]);

        let timeVarianceWeekdayHours = 0;
        let timeVarianceSaturdayHours = 0;
        let timeVarianceSundayHours = 0;

        for (const record of attendanceWithSchedule) {
            const dayOfWeek = new Date(record.date).getDay();
            let expectedDailyHours = 0;

            if (record.is_weekend >= 2 && record.is_weekend <= 6) {
                expectedDailyHours = weekdayDailyHours;
            } else if (record.is_weekend === 7) {
                expectedDailyHours = saturdayDailyHours;
            } else if (record.is_weekend === 1) {
                expectedDailyHours = sundayDailyHours;
            }

            // payable_duration is stored in MINUTES, convert to hours
            const actualMinutes = parseFloat(record.payable_duration) || 0;
            const actualHours = actualMinutes / 60;
            const shortfall = Math.max(0, expectedDailyHours - actualHours);

            if (record.is_weekend >= 2 && record.is_weekend <= 6) {
                timeVarianceWeekdayHours += shortfall;
            } else if (record.is_weekend === 7) {
                timeVarianceSaturdayHours += shortfall;
            } else if (record.is_weekend === 1) {
                timeVarianceSundayHours += shortfall;
            }
        }

        const timeVarianceDeduction = (timeVarianceWeekdayHours * weekdayHourlyRate) +
                                      (timeVarianceSaturdayHours * saturdayHourlyRate) +
                                      (timeVarianceSundayHours * sundayHourlyRate);

        console.log(`\n      ⏰ Time Variance Deduction for ${employeeName} (${employeeCode}): Rs.${timeVarianceDeduction.toFixed(2)}`);

        // 3. Calculate absent days deduction
        // This is what's left: total shortfall - unpaid leaves - time variance
        const absentDaysDeduction = Math.max(0, deduction - unpaidLeaveDeduction - timeVarianceDeduction);

        console.log(`\n      ❌ Absent Days Deduction for ${employeeName} (${employeeCode}): Rs.${absentDaysDeduction.toFixed(2)}`);
        console.log(`      Total Shortfall Breakdown: Unpaid Leaves (${unpaidLeaveDeduction.toFixed(2)}) + Time Variance (${timeVarianceDeduction.toFixed(2)}) + Absent Days (${absentDaysDeduction.toFixed(2)}) = ${deduction.toFixed(2)}`);

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
            },
            earnings_by_source: {
                attendance: {
                    hours: attendanceWeekdayHours + attendanceSaturdayHours + attendanceSundayHours,
                    earned: totalAttendanceEarned,
                    breakdown: {
                        weekday: { hours: attendanceWeekdayHours, earned: attendanceWeekdayEarned },
                        saturday: { hours: attendanceSaturdayHours, earned: attendanceSaturdayEarned },
                        sunday: { hours: attendanceSundayHours, earned: attendanceSundayEarned }
                    }
                },
                paid_leaves: {
                    hours: leaveWeekdayHours + leaveSaturdayHours + leaveSundayHours,
                    earned: totalLeaveEarned,
                    breakdown: {
                        weekday: { hours: leaveWeekdayHours, earned: leaveWeekdayEarned },
                        saturday: { hours: leaveSaturdayHours, earned: leaveSaturdayEarned },
                        sunday: { hours: leaveSundayHours, earned: leaveSundayEarned }
                    }
                },
                live_session: {
                    hours: todayIsLive ? todayActualHours : 0,
                    earned: liveSessionEarned
                }
            },
            shortfall_by_cause: {
                unpaid_time_off: {
                    hours: unpaidLeaveWeekdayHours + unpaidLeaveSaturdayHours + unpaidLeaveSundayHours,
                    deduction: unpaidLeaveDeduction
                },
                time_variance: {
                    hours: timeVarianceWeekdayHours + timeVarianceSaturdayHours + timeVarianceSundayHours,
                    deduction: timeVarianceDeduction
                },
                absent_days: {
                    deduction: absentDaysDeduction
                }
            }
        };
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

        // First get the payroll period to calculate expected base salary
        const [periodInfo] = await db.execute(`
            SELECT pp.period_start_date, pp.period_end_date
            FROM payroll_runs run
            JOIN payroll_periods pp ON run.period_id = pp.id
            WHERE run.id = ? AND run.client_id = ?
        `, [runId, clientId]);

        if (periodInfo.length === 0) {
            throw new Error('Payroll run not found');
        }

        const periodStart = new Date(periodInfo[0].period_start_date);
        const periodEnd = new Date(periodInfo[0].period_end_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        // Calculate until today or period end, whichever is earlier
        const calculationEndDate = today < periodEnd ? today : periodEnd;

        const [records] = await db.execute(`
            SELECT
                pr.id, pr.employee_id, pr.employee_code, pr.employee_name,
                pr.department_name, pr.designation_name, pr.calculation_status,
                pr.worked_days, pr.worked_hours, pr.overtime_hours, pr.leave_days,
                pr.total_earnings, pr.total_deductions, pr.total_taxes,
                pr.gross_salary, pr.taxable_income, pr.net_salary,
                pr.payment_status, pr.payment_method, pr.payment_date,
                pr.calculated_at, pr.notes,
                pr.base_salary, pr.attendance_affects_salary,
                ? as period_start_date,
                ? as calculation_end_date
            FROM payroll_records pr
            JOIN payroll_runs run ON pr.run_id = run.id
            WHERE pr.run_id = ? AND run.client_id = ?
            ORDER BY pr.employee_code
        `, [periodStart.toISOString().split('T')[0], calculationEndDate.toISOString().split('T')[0], runId, clientId]);

        if (records.length === 0) {
            throw new Error('No payroll records found for this run');
        }

        // Now calculate expected base salary and actual earned for each employee
        const enrichedRecords = await Promise.all(records.map(async (record) => {
            try {
                // Check if attendance affects salary for this employee
                const attendanceAffectsSalary = record.attendance_affects_salary ? true : false;
                let attendanceCalc;

                if (!attendanceAffectsSalary) {
                    // Employee gets full salary regardless of attendance
                    const baseSalary = parseFloat(record.base_salary) || 0;
                    attendanceCalc = {
                        expected_salary: baseSalary,
                        earned_salary: baseSalary,
                        total: 0,
                        earnings_by_source: null,
                        shortfall_by_cause: null
                    };
                } else {
                    // Calculate expected base salary until now
                    attendanceCalc = await this.calculateEarnedSalary(
                        record.employee_id,
                        runId,
                        parseFloat(record.base_salary) || 0
                    );
                }

                return {
                    ...record,
                    expected_base_salary: attendanceCalc.expected_salary || 0,
                    actual_earned_base: attendanceCalc.earned_salary || 0,
                    attendance_shortfall: attendanceCalc.total || 0,
                    earnings_by_source: attendanceCalc.earnings_by_source || null,
                    shortfall_by_cause: attendanceCalc.shortfall_by_cause || null
                };
            } catch (error) {
                console.error(`Error calculating attendance for employee ${record.employee_id}:`, error);
                return {
                    ...record,
                    expected_base_salary: 0,
                    actual_earned_base: 0,
                    attendance_shortfall: 0,
                    earnings_by_source: null,
                    shortfall_by_cause: null
                };
            }
        }));

        return enrichedRecords;
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

    /**
     * Get all raw data needed for frontend payroll calculation (live preview)
     * OPTIMIZED: Fetches ALL data in bulk queries for maximum performance
     */
    async getLivePayrollData(runId, clientId) {
        const db = getDB();
        const startTime = Date.now();

        // Start logging for live preview
        payrollLogger.startLogging(runId, 'live-preview');

        console.log(`📊 [OPTIMIZED] Fetching live payroll data for run: ${runId}`);

        try {
            // Get payroll run and period info
            const [runInfo] = await db.execute(`
                SELECT
                    pr.id as run_id,
                    pr.run_name,
                    pr.run_number,
                    pr.calculation_method,
                    pp.id as period_id,
                    pp.period_start_date,
                    pp.period_end_date,
                    pp.pay_date
                FROM payroll_runs pr
                JOIN payroll_periods pp ON pr.period_id = pp.id
                WHERE pr.id = ? AND pr.client_id = ?
            `, [runId, clientId]);

            if (runInfo.length === 0) {
                throw new Error('Payroll run not found');
            }

            const period = runInfo[0];
            console.log(`📅 Payroll period: ${period.period_start_date} to ${period.period_end_date}`);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const calculationEndDate = today < new Date(period.period_end_date) ? today : new Date(period.period_end_date);

            // Get all employees in this payroll run
            const [employees] = await db.execute(`
                SELECT
                    pr.id as record_id,
                    pr.employee_id,
                    pr.employee_code,
                    pr.employee_name,
                    pr.department_name,
                    pr.designation_name,
                    pr.attendance_affects_salary,
                    e.base_salary,
                    e.department_id
                FROM payroll_records pr
                JOIN employees e ON pr.employee_id = e.id
                WHERE pr.run_id = ?
                ORDER BY pr.employee_code
            `, [runId]);

            console.log(`👥 Processing ${employees.length} employees...`);

            const employeeIds = employees.map(e => e.employee_id);

            // ========================================
            // BULK FETCH #1: All Allowances
            // ========================================
            const [allAllowances] = await db.execute(`
                SELECT
                    ea.employee_id,
                    ea.id,
                    ea.allowance_type,
                    ea.allowance_name,
                    ea.amount,
                    ea.is_percentage,
                    ea.is_taxable
                FROM employee_allowances ea
                WHERE ea.employee_id IN (${employeeIds.map(() => '?').join(',')})
                  AND ea.client_id = ?
                  AND ea.is_active = 1
                  AND (ea.effective_to IS NULL OR ea.effective_to >= ?)
                  AND ea.effective_from <= CURDATE()
            `, [...employeeIds, clientId, calculationEndDate]);

            console.log('allowances: ',allAllowances);

            // ========================================
            // BULK FETCH #1: All Deductions
            // ========================================
            const [allDeductions] = await db.execute(`
                SELECT
                    ed.employee_id,
                    ed.id,
                    ed.deduction_type,
                    ed.deduction_name,
                    ed.amount,
                    ed.is_percentage,
                    ed.is_recurring,
                    ed.remaining_installments
                FROM employee_deductions ed
                WHERE ed.employee_id IN (${employeeIds.map(() => '?').join(',')})
                  AND ed.client_id = ?
                  AND ed.is_active = 1
                  AND (ed.effective_to IS NULL OR ed.effective_to >= ?)
                  AND ed.effective_from <= CURDATE()
            `, [...employeeIds, clientId, calculationEndDate]);

            console.log('deductions: ',allDeductions);

            // ========================================
            // BULK FETCH #2: Payroll Components
            // ========================================
            const [payrollComponents] = await db.execute(`
                SELECT
                    pc.id,
                    pc.component_name,
                    pc.component_type,
                    pc.category,
                    pc.calculation_type,
                    pc.calculation_value
                FROM payroll_components pc
                WHERE pc.client_id = ? AND pc.is_active = 1 AND pc.component_type = 'deduction'
            `, [clientId]);

            // ========================================
            // BULK FETCH #3: All Financial Records
            // ========================================
            const FinancialRecordsIntegration = require('./FinancialRecordsIntegration');

            // Fetch loans - match based on start_date falling in the period
            const [allLoans] = await db.execute(`
                SELECT
                    employee_id,
                    id,
                    loan_type,
                    loan_amount,
                    monthly_deduction,
                    remaining_amount,
                    start_date,
                    end_date,
                    notes
                FROM employee_loans
                WHERE employee_id IN (${employeeIds.map(() => '?').join(',')})
                  AND status = 'active'
                  AND start_date BETWEEN ? AND ?
            `, [...employeeIds, period.period_start_date, period.period_end_date]);

            console.log(`📊 Found ${allLoans.length} active loans...`);
            console.log('Loans are ${allLoans.map(l => l.id).join(', ')}');

            // Fetch advances - match based on required_date falling in the period
            const [allAdvances] = await db.execute(`
                SELECT
                    employee_id,
                    id,
                    advance_type,
                    advance_amount,
                    description,
                    monthly_deduction,
                    remaining_amount,
                    deduction_start_date,
                    required_date,
                    justification
                FROM employee_advances
                WHERE employee_id IN (${employeeIds.map(() => '?').join(',')})
                  AND status IN ('approved', 'paid')
                  AND required_date BETWEEN ? AND ?
                  AND remaining_amount > 0
            `, [...employeeIds, period.period_start_date, period.period_end_date]);

            // In PayrollRunService.js → getLivePayrollData()
                console.log(`📅 Fetching advances for period: ${period.period_start_date} to ${period.period_end_date}`);
                console.log(`📊 Found ${allAdvances.length} advances`);
                console.log(`Advances data:`, allAdvances.map(a => ({
                    id: a.id,
                    employee_id: a.employee_id,
                    required_date: a.required_date,
                    deduction_start_date: a.deduction_start_date,
                    status: a.status,
                    remaining_amount: a.remaining_amount
                })));

            // Fetch bonuses
            const [allBonuses] = await db.execute(`
                SELECT
                    employee_id,
                    id,
                    bonus_type,
                    bonus_amount,
                    description,
                    effective_date,
                    bonus_period
                FROM employee_bonuses
                WHERE employee_id IN (${employeeIds.map(() => '?').join(',')})
                  AND status = 'approved'
                  AND effective_date BETWEEN ? AND ?
                  AND payment_method = 'next_payroll'
            `, [...employeeIds, period.period_start_date, period.period_end_date]);

            console.log(`📊 Found ${allBonuses.length} active bonuses...`);

            // Group data by employee_id for fast lookup
            const allowancesByEmployee = {};
            const deductionsByEmployee = {};
            const loansByEmployee = {};
            const advancesByEmployee = {};
            const bonusesByEmployee = {};

            allAllowances.forEach(a => {
                if (!allowancesByEmployee[a.employee_id]) allowancesByEmployee[a.employee_id] = [];
                allowancesByEmployee[a.employee_id].push(a);
            });

            allDeductions.forEach(d => {
                if (!deductionsByEmployee[d.employee_id]) deductionsByEmployee[d.employee_id] = [];
                deductionsByEmployee[d.employee_id].push(d);
            });

            allLoans.forEach(l => {
                if (!loansByEmployee[l.employee_id]) loansByEmployee[l.employee_id] = [];
                // Only include if should deduct in this period
                const shouldDeduct = FinancialRecordsIntegration.shouldDeductInPeriod(
                    l.start_date,
                    { start: period.period_start_date, end: period.period_end_date }
                );
                if (shouldDeduct && l.remaining_amount > 0) {
                    const deductionAmount = Math.min(l.monthly_deduction, l.remaining_amount);
                    loansByEmployee[l.employee_id].push({ ...l, deduction_amount: deductionAmount });
                }
            });

            allAdvances.forEach(a => {
                if (!advancesByEmployee[a.employee_id]) advancesByEmployee[a.employee_id] = [];
                const shouldDeduct = FinancialRecordsIntegration.shouldDeductInPeriod(
                    a.required_date,
                    { start: period.period_start_date, end: period.period_end_date }
                );
                if (shouldDeduct && a.remaining_amount > 0) {
                    const deductionAmount = Math.min(a.monthly_deduction, a.remaining_amount);
                    advancesByEmployee[a.employee_id].push({ ...a, deduction_amount: deductionAmount });
                }
            });

            allBonuses.forEach(b => {
                if (!bonusesByEmployee[b.employee_id]) bonusesByEmployee[b.employee_id] = [];
                bonusesByEmployee[b.employee_id].push({ ...b, addition_amount: b.bonus_amount });
            });

            // ========================================
            // Process each employee with pre-fetched data
            // ========================================
            const employeeDataPromises = employees.map(async (emp) => {
                // Check if attendance affects salary for this employee
                const attendanceAffectsSalary = emp.attendance_affects_salary ? true : false;
                let attendanceData;

                if (!attendanceAffectsSalary) {
                    // Employee gets full salary regardless of attendance
                    const baseSalary = parseFloat(emp.base_salary) || 0;
                    attendanceData = {
                        expected_salary: baseSalary,
                        earned_salary: baseSalary,
                        total: 0
                    };
                } else {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const periodEnd = new Date(period.period_end_date);
                    periodEnd.setHours(23, 59, 59, 999);

                    const isCurrentPeriod = today <= periodEnd;
                    // Get attendance data (this still needs individual calculation)
                    attendanceData = await this.calculateEarnedSalary(
                        emp.employee_id,
                        runId,
                        parseFloat(emp.base_salary) || 0,
                        isCurrentPeriod  // Include today's live session for real-time preview
                    );
                }

                // Use pre-fetched data
                const employeeAllowances = allowancesByEmployee[emp.employee_id] || [];
                const employeeDeductions = deductionsByEmployee[emp.employee_id] || [];
                const employeeLoans = loansByEmployee[emp.employee_id] || [];
                const employeeAdvances = advancesByEmployee[emp.employee_id] || [];
                const employeeBonuses = bonusesByEmployee[emp.employee_id] || [];

                // Add description field to loans if missing (use notes field)
                employeeLoans.forEach(loan => {
                    if (!loan.description && loan.notes) {
                        loan.description = loan.notes;
                    } else if (!loan.description) {
                        loan.description = `${loan.loan_type || 'Loan'}`;
                    }
                });

                // Calculate financial totals
                const loanDeductions = employeeLoans.reduce((sum, l) => sum + (l.deduction_amount || 0), 0);
                const advanceDeductions = employeeAdvances.reduce((sum, a) => sum + (a.deduction_amount || 0), 0);
                const bonusTotal = employeeBonuses.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

                // Filter applicable payroll components for this employee
                const applicableComponents = await this.filterApplicableComponents(payrollComponents, emp.employee_id, clientId);
                const applicableDeductions = applicableComponents.filter(c => c.component_type === 'deduction');

                // Convert payroll component deductions to standard format
                const componentDeductions = applicableDeductions.map(comp => ({
                    id: comp.id,
                    component_name: comp.component_name,
                    calculation_type: comp.calculation_type,
                    calculation_value: comp.calculation_value,
                    category: comp.category
                }));

                // Convert employee-specific deductions to standard format
                const specificDeductions = employeeDeductions.map(ded => ({
                    id: ded.id,
                    component_name: ded.deduction_name,
                    calculation_type: ded.is_percentage ? 'percentage' : 'fixed',
                    calculation_value: ded.amount,
                    category: 'employee_specific'
                }));

                // Combine both types of deductions
                const combinedDeductions = [...componentDeductions, ...specificDeductions];

                return {
                    ...emp,
                    attendance: {
                        expected_salary: attendanceData.expected_salary || 0,
                        earned_salary: attendanceData.earned_salary || 0,
                        shortfall: attendanceData.total || 0,
                        components: attendanceData.components || [],
                        earnings_by_source: attendanceData.earnings_by_source || null,
                        shortfall_by_cause: attendanceData.shortfall_by_cause || null
                    },
                    allowances: employeeAllowances,
                    deductions: combinedDeductions,
                    financial: {
                        loans: loanDeductions,
                        advances: advanceDeductions,
                        bonuses: bonusTotal,
                        loanRecords: employeeLoans,
                        advanceRecords: employeeAdvances,
                        bonusRecords: employeeBonuses
                    }
                };
            });

            const enrichedEmployees = await Promise.all(employeeDataPromises);

            const totalTime = Date.now() - startTime;
            console.log(`\n⚡ PERFORMANCE: Loaded ${enrichedEmployees.length} employees in ${totalTime}ms (${(totalTime / enrichedEmployees.length).toFixed(0)}ms per employee)`);

            const result = {
                period: {
                    start_date: period.period_start_date,
                    end_date: period.period_end_date,
                    calculation_end_date: calculationEndDate.toISOString().split('T')[0],
                    pay_date: period.pay_date
                },
                run: {
                    id: period.run_id,
                    name: runInfo[0].run_name,
                    number: runInfo[0].run_number,
                    calculation_method: runInfo[0].calculation_method
                },
                employees: enrichedEmployees
            };

            // Stop logging and save to file
            const logFilePath = await payrollLogger.stopLogging();
            console.log(`📁 Logs saved to: ${logFilePath}`);

            return result;

        } catch (error) {
            console.error(`❌ Live payroll data fetch failed:`, error);

            // Stop logging even on error and save error logs
            await payrollLogger.stopLogging();

            throw error;
        }
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

    /**
     * Get employee daily work details (working minutes and salary per day)
     * for the payroll run period
     */
    async getEmployeeDailyWorkDetails(runId, employeeId, clientId) {
        const db = getDB();

        console.log(`📊 Fetching daily work details for employee: ${employeeId} in run: ${runId}`);

        try {
            // Get payroll period info
            const [periodInfo] = await db.execute(`
                SELECT
                    pp.period_start_date,
                    pp.period_end_date,
                    pr.id as run_id,
                    pr.client_id
                FROM payroll_runs pr
                JOIN payroll_periods pp ON pr.period_id = pp.id
                WHERE pr.id = ? AND pr.client_id = ?
            `, [runId, clientId]);

            if (periodInfo.length === 0) {
                throw new Error('Payroll run not found');
            }

            const period = periodInfo[0];

            // Get employee details and hourly rates from payroll_records
            const [employeeInfo] = await db.execute(`
                SELECT
                    pr.employee_code,
                    pr.employee_name,
                    pr.base_salary,
                    pr.weekday_hourly_rate,
                    pr.saturday_hourly_rate,
                    pr.sunday_hourly_rate,
                    e.in_time as weekday_in_time,
                    e.out_time as weekday_out_time
                FROM payroll_records pr
                JOIN employees e ON pr.employee_id = e.id
                WHERE pr.run_id = ? AND pr.employee_id = ?
            `, [runId, employeeId]);

            if (employeeInfo.length === 0) {
                throw new Error('Employee not found in this payroll run');
            }

            const employee = employeeInfo[0];
            const weekdayHourlyRate = parseFloat(employee.weekday_hourly_rate) || 0;
            const saturdayHourlyRate = parseFloat(employee.saturday_hourly_rate) || 0;
            const sundayHourlyRate = parseFloat(employee.sunday_hourly_rate) || 0;

            // Get daily attendance records for the period
            const [attendanceRecords] = await db.execute(`
                SELECT
                    DATE(a.date) as work_date,
                    a.check_in_time,
                    a.check_out_time,
                    COALESCE(a.payable_duration, 0) as payable_duration,
                    COALESCE(a.total_hours, 0) as total_hours,
                    a.status,
                    a.is_weekend,
                    DAYOFWEEK(a.date) as day_of_week
                FROM attendance a
                WHERE a.employee_id = ?
                  AND DATE(a.date) BETWEEN ? AND ?
                ORDER BY a.date ASC
            `, [employeeId, period.period_start_date, period.period_end_date]);

            // Calculate daily salary based on hours worked and day type
            const dailyDetails = attendanceRecords.map(record => {
                // payable_duration is now stored in SECONDS
                const payableDurationSeconds = parseFloat(record.payable_duration) || 0;

                // Convert seconds to hours and minutes
                const totalHours = payableDurationSeconds / 3600; // seconds to hours
                const totalMinutes = Math.round(payableDurationSeconds / 60); // seconds to minutes

                // Determine hourly rate based on day type
                let hourlyRate = weekdayHourlyRate;
                let dayType = 'Weekday';

                // is_weekend: 1 = Sunday, 7 = Saturday, 0 or null = Weekday
                if (record.is_weekend === 1) {
                    hourlyRate = sundayHourlyRate;
                    dayType = 'Sunday';
                } else if (record.is_weekend === 7) {
                    hourlyRate = saturdayHourlyRate;
                    dayType = 'Saturday';
                }

                // Calculate daily salary
                const dailySalary = totalHours * hourlyRate;

                return {
                    date: record.work_date,
                    day_type: dayType,
                    check_in: record.check_in_time,
                    check_out: record.check_out_time,
                    working_minutes: totalMinutes,
                    working_hours: parseFloat(totalHours.toFixed(2)),
                    hourly_rate: parseFloat(hourlyRate.toFixed(2)),
                    daily_salary: parseFloat(dailySalary.toFixed(2)),
                    status: record.status
                };
            });

            // Calculate totals
            const totalMinutes = dailyDetails.reduce((sum, day) => sum + day.working_minutes, 0);
            const totalSalary = dailyDetails.reduce((sum, day) => sum + day.daily_salary, 0);

            return {
                employee: {
                    id: employeeId,
                    code: employee.employee_code,
                    name: employee.employee_name,
                    base_salary: parseFloat(employee.base_salary)
                },
                period: {
                    start_date: period.period_start_date,
                    end_date: period.period_end_date
                },
                daily_records: dailyDetails,
                summary: {
                    total_working_days: dailyDetails.length,
                    total_working_minutes: totalMinutes,
                    total_working_hours: parseFloat((totalMinutes / 60).toFixed(2)),
                    total_salary_earned: parseFloat(totalSalary.toFixed(2))
                }
            };

        } catch (error) {
            console.error('Error fetching employee daily work details:', error);
            throw error;
        }
    }
}

module.exports = new PayrollRunService();