const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const HolidayService = require('./HolidayService');
const SettingsHelper = require('../utils/settingsHelper');
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
            `, [runId, clientId, run_number, period_id, run_name, run_type, calculation_method, notes, userId]);

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
     * Approve payroll run (workflow step)
     */
    async approvePayrollRun(runId, clientId, approverId, approvalData) {
        const {
            approval_level, // 'review' or 'approve'
            comments = null
        } = approvalData;

        const db = getDB();
        
        try {
            await db.execute('START TRANSACTION');

            // Verify run status
            const [run] = await db.execute(
                'SELECT run_status FROM payroll_runs WHERE id = ? AND client_id = ?',
                [runId, clientId]
            );

            if (run.length === 0) {
                throw new Error('Payroll run not found');
            }

            const validStatusMap = {
                'review': ['calculated'],
                'approve': ['review']
            };

            if (!validStatusMap[approval_level].includes(run[0].run_status)) {
                throw new Error(`Cannot ${approval_level} payroll run in ${run[0].run_status} status`);
            }

            // Record approval
            await db.execute(`
                INSERT INTO payroll_approvals (
                    id, run_id, approval_level, approver_id, 
                    approval_status, approval_date, comments
                ) VALUES (?, ?, ?, ?, 'approved', NOW(), ?)
            `, [uuidv4(), runId, approval_level, approverId, comments]);

            // Update run status and approver
            const statusMap = {
                'review': 'review',
                'approve': 'approved'
            };
            
            const approverField = approval_level === 'review' ? 'reviewed_by' : 'approved_by';
            const dateField = approval_level === 'review' ? 'reviewed_at' : 'approved_at';

            await db.execute(`
                UPDATE payroll_runs 
                SET run_status = ?, ${approverField} = ?, ${dateField} = NOW() 
                WHERE id = ?
            `, [statusMap[approval_level], approverId, runId]);

            // Log approval
            await this.logAuditEvent(runId, null, approval_level, approverId, {
                comments,
                approval_level
            });

            await db.execute('COMMIT');

            return {
                success: true,
                data: {
                    run_id: runId,
                    status: statusMap[approval_level],
                    approved_by: approverId
                }
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Process payments for approved payroll run
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

            // Verify run is approved
            const [run] = await db.execute(
                'SELECT run_status FROM payroll_runs WHERE id = ? AND client_id = ? AND run_status = "approved"',
                [runId, clientId]
            );

            if (run.length === 0) {
                throw new Error('Payroll run not found or not approved for processing');
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
            const cancellableStatuses = ['draft', 'calculated', 'review'];
            if (!cancellableStatuses.includes(run[0].run_status)) {
                throw new Error(`Cannot cancel payroll run in ${run[0].run_status} status. Only draft, calculated, or review status runs can be cancelled.`);
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

            // 3. Delete approval steps (depends on approval_workflows)
            await db.execute(
                'DELETE aps FROM approval_steps aps INNER JOIN approval_workflows aw ON aps.workflow_id = aw.id WHERE aw.run_id = ?',
                [runId]
            );

            // 4. Delete approval workflows
            await db.execute(
                'DELETE FROM approval_workflows WHERE run_id = ?',
                [runId]
            );

            // 5. Delete payroll approvals
            await db.execute(
                'DELETE FROM payroll_approvals WHERE run_id = ?',
                [runId]
            );

            // 6. Delete payroll reports (if table exists - currently not implemented)
            // await db.execute(
            //     'DELETE FROM payroll_reports WHERE run_id = ?',
            //     [runId]
            // );

            // 7. Delete audit logs (optional - you may want to keep these for compliance)
            // Note: Uncomment if you want to delete audit logs as well
            // await db.execute(
            //     'DELETE FROM payroll_audit_log WHERE run_id = ?',
            //     [runId]
            // );

            // 8. Finally delete the payroll run itself
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
     * Create draft payroll record for employee
     */
    async createDraftPayrollRecord(runId, employee) {
        const db = getDB();
        const recordId = uuidv4();

        await db.execute(`
            INSERT INTO payroll_records (
                id, run_id, employee_id, employee_code, employee_name,
                department_name, designation_name, calculation_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            recordId, runId, employee.id, employee.employee_code,
            `${employee.first_name} ${employee.last_name}`,
            employee.department_name, employee.designation_name
        ]);

        return recordId;
    }

    /**
     * Calculate single payroll record with proper method selection
     */
    async calculateSingleRecord(record) {
        const db = getDB();

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

        // Get attendance summary and leave data for attendance-based calculations
        const attendanceSummary = await this.getAttendanceSummary(record.employee_id, record.run_id);
        const approvedLeaves = await this.getApprovedLeaves(record.employee_id, record.run_id);

        // =============================================
        // PROCESS FINANCIAL RECORDS (LOANS, ADVANCES, BONUSES)
        // =============================================
        console.log(`🔄 Processing financial records for employee ${record.employee_id}...`);
        const financialAdjustments = await FinancialRecordsIntegration.processFinancialRecords(
            record.employee_id,
            payrollPeriod,
            record.run_id
        );

        // Calculate gross salary with all components
        const grossComponents = await this.calculateGrossComponents(record, employeeData);
        let grossSalary = grossComponents.total; // Base + Allowances + Overtime

        // Add financial bonuses to gross salary
        if (financialAdjustments.bonuses > 0) {
            grossSalary += financialAdjustments.bonuses;
            console.log(`💰 Added financial bonuses: LKR ${financialAdjustments.bonuses} to gross salary`);
        }

        // Calculate attendance-based deductions BEFORE other deductions
        const attendanceDeductions = await this.calculateAttendanceDeductions(
            record.employee_id,
            record.run_id,
            parseFloat(record.base_salary) || 0,
            attendanceSummary,
            approvedLeaves
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

        // Calculate taxes based on method
        const taxComponents = await this.calculateTaxes(grossSalary, calculationMethod, employeeData);
        const totalTaxes = taxComponents.total;

        const netSalary = grossSalary - totalDeductions - totalTaxes;

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
            console.log(`✅ Financial balances updated for employee ${record.employee_id}`);
        } catch (error) {
            console.error(`❌ Error updating financial balances for employee ${record.employee_id}:`, error);
            // Log but don't fail the payroll calculation
        }
    }

    /**
     * Get attendance summary for employee during payroll period
     */
    async getAttendanceSummary(employeeId, runId) {
        const db = getDB();
        
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
                a.scheduled_out_time
            FROM attendance a
            JOIN payroll_runs pr ON pr.id = ?
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE a.employee_id = ? 
              AND DATE(a.date) BETWEEN pp.period_start_date AND pp.period_end_date
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

        return {
            attendanceRecords: attendanceData,
            workingHours: workingHours,
            summary: await this.calculateAttendanceSummary(attendanceData, workingHours, employeeId, db, runId)
        };
    }

    /**
     * Get approved leaves for employee during payroll period
     */
    async getApprovedLeaves(employeeId, runId) {
        const db = getDB();
        
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
              AND (
                (lr.start_date BETWEEN pp.period_start_date AND pp.period_end_date)
                OR (lr.end_date BETWEEN pp.period_start_date AND pp.period_end_date)
                OR (lr.start_date <= pp.period_start_date AND lr.end_date >= pp.period_end_date)
              )
        `, [runId, employeeId]);

        return leaves;
    }

    /**
     * Calculate attendance summary statistics
     */
    async calculateAttendanceSummary(attendanceRecords, workingHours, employeeId, db, runId = null) {
        const summary = {
            totalWorkDays: attendanceRecords.length,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            halfDays: 0,
            onLeaveDays: 0,
            totalWorkedHours: 0,
            totalOvertimeHours: 0,
            expectedHours: 0,
            lateMinutes: 0,
            shortfallHours: 0
        };

        // Calculate expected working days and hours using actual payroll period
        try {
            // Get employee info for holiday calculation
            const [employee] = await db.execute(`
                SELECT department_id, client_id FROM employees WHERE id = ?
            `, [employeeId]);
            
            const departmentId = employee[0]?.department_id || null;
            const clientId = employee[0]?.client_id;
            
            // Get actual payroll period dates using runId
            if (!runId) {
                throw new Error('runId is required for accurate expected hours calculation');
            }
            
            const [periodInfo] = await db.execute(`
                SELECT pp.period_start_date, pp.period_end_date
                FROM payroll_runs pr
                JOIN payroll_periods pp ON pr.period_id = pp.id
                WHERE pr.id = ?
            `, [runId]);
            
            if (periodInfo.length === 0) {
                throw new Error('Could not find payroll period for this run');
            }
            
            const period = periodInfo[0];
            const periodStartDate = period.period_start_date;
            const periodEndDate = period.period_end_date;
            
            // Calculate expected hours using simple working days calculation
            const workingDays = await this.calculateWorkingDaysInPeriod(
                periodStartDate,
                periodEndDate,
                clientId,
                departmentId
            );
            const employeeDailyHours = await this.getEmployeeDailyHours(employeeId, workingHours.hours_per_day, periodStartDate, periodEndDate);
            summary.expectedHours = workingDays * employeeDailyHours;

            console.log(`✅ Expected hours calculation: ${workingDays} days × ${employeeDailyHours}h = ${summary.expectedHours}h`);
        } catch (error) {
            console.error('Error calculating expected working days with holidays:', error);
            // Fallback to simple calculation using attendance date range
            const dates = attendanceRecords.map(r => r.date).sort();
            const periodStartDate = dates[0];
            const periodEndDate = dates[dates.length - 1];
            
            // Use simple calculation for fallback too
            const fallbackWorkingDays = await this.calculateWorkingDaysInPeriod(
                periodStartDate,
                periodEndDate,
                clientId,
                departmentId
            );
            const fallbackEmployeeDailyHours = await this.getEmployeeDailyHours(employeeId, workingHours.hours_per_day, periodStartDate, periodEndDate);
            summary.expectedHours = fallbackWorkingDays * fallbackEmployeeDailyHours;

            console.log(`⚠️ Fallback calculation: ${fallbackWorkingDays} days × ${fallbackEmployeeDailyHours}h = ${summary.expectedHours}h`);
        }

        // Check if overtime is enabled for this client
        const overtimeEnabled = await this.isOvertimeEnabled(attendanceRecords[0]?.client_id);
        
        console.log(`\n📊 DAILY WORKED HOURS BREAKDOWN for Employee ${employeeId}:`);
        console.log(`⚙️  Overtime Enabled: ${overtimeEnabled ? 'YES' : 'NO'}`);
        console.log('=' .repeat(80));
        
        for (const record of attendanceRecords) {
            const actualWorkedHours = parseFloat(record.total_hours) || 0;
            const overtimeHours = parseFloat(record.overtime_hours) || 0;
            
            let workedHoursToCount = actualWorkedHours;
            let cappingInfo = '';
            
            // If overtime is disabled, calculate payable hours based on actual work time overlap with scheduled hours
            if (!overtimeEnabled) {
                let scheduledInTime = null;
                let scheduledOutTime = null;
                let scheduleSource = '';

                if (record.scheduled_in_time && record.scheduled_out_time) {
                    // Use attendance table scheduled times
                    scheduledInTime = new Date(`2000-01-01 ${record.scheduled_in_time}`);
                    scheduledOutTime = new Date(`2000-01-01 ${record.scheduled_out_time}`);
                    scheduleSource = 'attendance table';
                } else {
                    cappingInfo = ` (no scheduled times available)`;
                }

                // Calculate overlap between actual work time and scheduled work time
                if (scheduledInTime && scheduledOutTime && record.check_in_time && record.check_out_time &&
                    !isNaN(scheduledInTime.getTime()) && !isNaN(scheduledOutTime.getTime())) {

                    const actualInTime = new Date(`2000-01-01 ${record.check_in_time}`);
                    const actualOutTime = new Date(`2000-01-01 ${record.check_out_time}`);

                    if (!isNaN(actualInTime.getTime()) && !isNaN(actualOutTime.getTime())) {
                        // Calculate the overlap between actual work time and scheduled time
                        const overlapStart = new Date(Math.max(actualInTime.getTime(), scheduledInTime.getTime()));
                        const overlapEnd = new Date(Math.min(actualOutTime.getTime(), scheduledOutTime.getTime()));

                        if (overlapEnd > overlapStart) {
                            const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                            const overlapHours = Math.max(0, overlapMs / (1000 * 60 * 60)); // No rounding here
                            workedHoursToCount = overlapHours;

                            const overlapStartTime = overlapStart.toTimeString().substring(0, 5);
                            const overlapEndTime = overlapEnd.toTimeString().substring(0, 5);
                            cappingInfo = ` → OVERLAP ${overlapStartTime}-${overlapEndTime} = ${overlapHours.toFixed(3)}h (${scheduleSource})`;
                        } else {
                            // No overlap between actual work time and scheduled time
                            workedHoursToCount = 0;
                            cappingInfo = ` → NO OVERLAP with scheduled time (${scheduleSource})`;
                        }
                    } else {
                        cappingInfo = ` (invalid actual check-in/out times)`;
                    }
                } else {
                    cappingInfo = ` (missing times for overlap calculation)`;
                }
            } else {
                cappingInfo = ` (overtime allowed)`;
            }
            
            // Log each day's contribution
            console.log(`📅 ${record.date}: ${actualWorkedHours}h worked → ${workedHoursToCount}h counted${cappingInfo}`);
            
            summary.totalWorkedHours += workedHoursToCount;
            summary.totalOvertimeHours += overtimeHours;

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

        // Round the final sum to 4 decimal places for higher precision, then to 2 for display
        summary.totalWorkedHours = Math.round(summary.totalWorkedHours * 10000) / 10000;

        // Log the final total calculation
        console.log('=' .repeat(80));
        console.log(`📊 TOTAL WORKED HOURS CALCULATION:`);
        console.log(`   Sum of all daily counted hours (rounded): ${summary.totalWorkedHours}h`);
        console.log(`   Expected hours: ${summary.expectedHours}h`);
        console.log(`   Shortfall: ${Math.max(0, summary.expectedHours - summary.totalWorkedHours).toFixed(2)}h`);
        console.log('=' .repeat(80));

        // Calculate shortfall hours (expected - actual worked)
        summary.shortfallHours = Math.max(0, summary.expectedHours - summary.totalWorkedHours);

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
                // Get scheduled hours from attendance records within the payroll period
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
                // Fallback to most recent record if no period specified
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
            
            const [attendance] = await db.execute(query, params);
            
            if (!attendance[0]) {
                const periodInfo = periodStartDate && periodEndDate ? ` for period ${periodStartDate} to ${periodEndDate}` : '';
                console.log(`Employee ${employeeId} has no attendance records with scheduled times${periodInfo}, using default: ${defaultHours}h`);
                return defaultHours;
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
     * Calculate attendance-based salary deductions
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
        
        // Get employee's department for holiday calculation
        const [employeeInfo] = await db.execute(`
            SELECT department_id, client_id FROM employees WHERE id = ?
        `, [employeeId]);
        
        const departmentId = employeeInfo[0]?.department_id || null;
        const clientId = employeeInfo[0]?.client_id;
        
        console.log(`🗓️  PAYROLL PERIOD: ${period.period_start_date} to ${period.period_end_date}`);
        
        const workingDaysCalculation = await HolidayService.calculateWorkingDays(
            clientId,
            period.period_start_date,
            period.period_end_date,
            departmentId,
            false, // includeOptionalHolidays
            employeeId // Pass employeeId for individual weekend config
        );

        const workingDaysInMonth = workingDaysCalculation.working_days;
        
        console.log(`📊 CALCULATED WORKING DAYS: ${workingDaysInMonth} days (excluding weekends & holidays)`);
        
        // Calculate effective working days considering weekend salary weights
        const effectiveWorkingDays = await this.calculateEffectiveWorkingDays(
            workingDaysCalculation,
            employeeId,
            period.period_start_date,
            period.period_end_date
        );

        console.log(`🏗️  WEEKEND WORKING BREAKDOWN:`, {
            standard_working_days: workingDaysCalculation.working_days - workingDaysCalculation.weekend_working_days,
            weekend_working_days: workingDaysCalculation.weekend_working_days,
            weekend_full_day_weight: workingDaysCalculation.weekend_full_day_weight,
            weekend_proportional_days: workingDaysCalculation.weekend_proportional_days,
            effective_working_days: effectiveWorkingDays
        });

        // Calculate per-day and per-minute salary rates using effective working days
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
        console.log(`📅 Working Days: ${workingDaysInMonth} (Raw: ${workingDaysCalculation.working_days})`);
        console.log(`🎯 Effective Working Days (with weekend weights): ${effectiveWorkingDays}`);
        console.log(`⏰ Employee Daily Hours: ${employeeDailyHours}h/day`);
        console.log(`💵 Per-Day Salary: ${perDaySalary.toFixed(2)}`);
        console.log(`⏱️  Hourly Rate: ${hourlyRate.toFixed(2)}`);
        console.log('');
        console.log('📈 ATTENDANCE SUMMARY:');
        console.log(`   Expected Hours: ${attendanceSummary.summary.expectedHours}`);
        console.log(`   📋 CALCULATION CHECK: ${effectiveWorkingDays} days × ${employeeDailyHours}h = ${(effectiveWorkingDays * employeeDailyHours).toFixed(2)}h`);
        console.log(`   ❗ DISCREPANCY: ${attendanceSummary.summary.expectedHours !== (effectiveWorkingDays * employeeDailyHours) ? 'YES - Values don\'t match!' : 'NO - Values match'}`);
        console.log(`   Worked Hours: ${attendanceSummary.summary.totalWorkedHours}`);
        console.log(`   ⚠️  Shortfall Hours: ${attendanceSummary.summary.shortfallHours}`);
        
        if (attendanceSummary.summary.shortfallHours > 0) {
            const shortfallDeduction = attendanceSummary.summary.shortfallHours * hourlyRate;
            console.log(`   💸 Shortfall Deduction: ${attendanceSummary.summary.shortfallHours}h × ${hourlyRate.toFixed(2)} = ${shortfallDeduction.toFixed(2)}`);
        } else {
            console.log(`   ✅ No Shortfall - Employee met required hours`);
        }
        console.log('=' .repeat(60));

        const deductions = {
            absentDeduction: 0,
            lateDeduction: 0,
            shortfallDeduction: 0,
            unpaidLeaveDeduction: 0,
            weekendProportionalDeduction: 0,
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
            period.period_end_date,
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

        // 3. Hour shortfall deduction (if total worked hours is less than expected)
        if (attendanceSummary.summary.shortfallHours > 0) {
            // Use already calculated employee-specific daily hours for accurate hourly rate
            const hourlyRate = perDaySalary / employeeDailyHours;
            deductions.shortfallDeduction = attendanceSummary.summary.shortfallHours * hourlyRate;
            deductions.components.push({
                code: 'SHORTFALL_DED', // 🔧 FIX: Shortened to be safe with varchar(20) limit
                name: 'Working Hours Shortfall',
                type: 'deduction',
                category: 'other', // Use existing enum value
                amount: deductions.shortfallDeduction,
                details: `${attendanceSummary.summary.shortfallHours} hours × ${hourlyRate.toFixed(2)}`
            });
        }

        // 4. Unpaid leave deduction
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

        deductions.total = deductions.absentDeduction + deductions.lateDeduction +
                          deductions.shortfallDeduction + deductions.unpaidLeaveDeduction +
                          deductions.weekendProportionalDeduction;

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

        // If no weekend config or no proportional days, return empty
        if (!employeeWeekendConfig || workingDaysCalculation.weekend_proportional_days === 0) {
            return deductions;
        }

        // Get actual weekend attendance for proportional calculation
        const [weekendAttendance] = await db.execute(`
            SELECT
                date,
                DAYOFWEEK(date) as day_of_week,
                actual_in_time,
                actual_out_time,
                total_hours,
                status
            FROM attendance
            WHERE employee_id = ?
                AND date BETWEEN ? AND ?
                AND DAYOFWEEK(date) IN (1, 7)  -- Sunday = 1, Saturday = 7
        `, [employeeId, startDate, endDate]);

        for (const attendance of weekendAttendance) {
            const dayOfWeek = attendance.day_of_week === 7 ? 6 : 0; // Convert MySQL DAYOFWEEK to JS (Saturday=6, Sunday=0)
            let weekendDayConfig = null;

            if (dayOfWeek === 6 && employeeWeekendConfig.saturday?.working && !employeeWeekendConfig.saturday?.full_day_salary) {
                weekendDayConfig = employeeWeekendConfig.saturday;
            } else if (dayOfWeek === 0 && employeeWeekendConfig.sunday?.working && !employeeWeekendConfig.sunday?.full_day_salary) {
                weekendDayConfig = employeeWeekendConfig.sunday;
            }

            if (weekendDayConfig) {
                // Calculate scheduled hours for this weekend day
                const inTime = weekendDayConfig.in_time;
                const outTime = weekendDayConfig.out_time;
                const scheduledHours = this.calculateScheduledHours(inTime, outTime);

                // Calculate shortfall
                const actualHours = attendance.total_hours || 0;
                const shortfallHours = Math.max(0, scheduledHours - actualHours);

                if (shortfallHours > 0) {
                    const hourlyRate = perDaySalary / employeeDailyHours;
                    const shortfallDeduction = shortfallHours * hourlyRate;

                    deductions.totalDeduction += shortfallDeduction;
                    deductions.components.push({
                        code: 'WEEKEND_SHORTFALL',
                        name: `${dayOfWeek === 6 ? 'Saturday' : 'Sunday'} Shortfall Deduction`,
                        type: 'deduction',
                        category: 'other',
                        amount: shortfallDeduction,
                        details: `${attendance.date}: ${shortfallHours}h shortfall × ${hourlyRate.toFixed(2)}`
                    });
                }
            }
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
     * Get employee payroll configuration data
     */
    async getEmployeePayrollData(employeeId, clientId, runId = null) {
        const db = getDB();
        
        // Get employee allowances
        const [allowances] = await db.execute(`
            SELECT allowance_type, amount 
            FROM employee_allowances 
            WHERE employee_id = ? AND client_id = ? AND is_active = 1
        `, [employeeId, clientId]);
        
        // Get employee deductions  
        const [deductions] = await db.execute(`
            SELECT deduction_type, amount, is_percentage
            FROM employee_deductions 
            WHERE employee_id = ? AND client_id = ? AND is_active = 1
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
            allowances: allowances || [],
            deductions: deductions || [],
            overtimeHours: overtimeHours,
            overtimeDetails: overtimeDetails
        };
    }

    /**
     * Calculate gross salary components
     */
    async calculateGrossComponents(record, employeeData) {
        const baseSalary = parseFloat(record.base_salary) || 0;
        const components = [];
        let total = baseSalary; // Start with base salary
        let additionsTotal = 0; // Track additions separately
        
        // Add allowances (these are additions)
        for (const allowance of employeeData.allowances) {
            const amount = parseFloat(allowance.amount) || 0;
            total += amount;
            additionsTotal += amount;
            components.push({
                code: allowance.allowance_type.toUpperCase(),
                name: allowance.allowance_type.replace('_', ' '),
                type: 'earning',
                category: 'allowance',
                amount: amount
            });
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
        
        // EPF (Employee Provident Fund) - 8% EMPLOYEE CONTRIBUTION
        const epfAmount = baseSalary * 0.08;
        components.push({
            code: 'EPF',
            name: 'Employee Provident Fund (8%)',
            type: 'deduction',
            category: 'other', // Use existing enum value instead of 'statutory'
            amount: epfAmount
        });
        total += epfAmount;

        // ETF (Employee Trust Fund) - 3% EMPLOYER CONTRIBUTION ONLY
        // ❌ REMOVED: ETF should NOT be deducted from employee salary
        // ETF is paid entirely by the employer (3%) and not deducted from employee
        console.log(`ℹ️  ETF Note: 3% employer contribution (LKR ${(baseSalary * 0.03).toFixed(2)}) - NOT deducted from employee`);
        
        // Add custom employee deductions
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
                    amount: amount
                });
                total += amount;
            }
        }
        
        return { components, total };
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
                console.log(`   Using overtime_rate_multiplier from settings: ${rate}x`);
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
                    console.log(`   Using weekend_hours_multiplier from working_hours_config: ${config.weekend_hours_multiplier}x`);
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
                'System User' as reviewed_by_name,
                'System User' as approved_by_name,
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
                pr.created_at, pr.approved_at, pr.completed_at,
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
}

module.exports = new PayrollRunService();