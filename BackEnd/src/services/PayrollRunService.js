// =============================================
// PAYROLL RUN SERVICE - INDUSTRY STANDARD BATCH PROCESSING
// =============================================
// This service handles payroll runs (batches) instead of individual records
// Implements industry-standard workflow: Create → Calculate → Review → Approve → Process

const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

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

            // Update status to calculating
            await db.execute(
                'UPDATE payroll_runs SET run_status = "calculating", calculation_started_at = NOW() WHERE id = ?',
                [runId]
            );

            // Get all records in this run
            const [records] = await db.execute(`
                SELECT pr.*, e.base_salary, e.employee_type, e.department_id, e.designation_id, e.client_id
                FROM payroll_records pr
                JOIN employees e ON pr.employee_id = e.id
                WHERE pr.run_id = ? AND pr.calculation_status = 'pending'
            `, [runId]);

            let successCount = 0;
            let errorCount = 0;

            // Calculate each record
            for (const record of records) {
                try {
                    await this.calculateSingleRecord(record);
                    successCount++;
                } catch (error) {
                    console.error(`Error calculating record ${record.id}:`, error.message);
                    console.error('Error details:', error);
                    await this.markRecordError(record.id, error.message);
                    errorCount++;
                }
            }

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

            return {
                success: true,
                data: {
                    run_id: runId,
                    processed_records: successCount,
                    error_records: errorCount,
                    status: finalStatus
                }
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
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
            'SELECT calculation_method FROM payroll_runs WHERE id = ?',
            [record.run_id]
        );
        const calculationMethod = runInfo[0]?.calculation_method || 'advanced';
        
        // Get employee allowances and deductions
        const employeeData = await this.getEmployeePayrollData(record.employee_id, record.client_id, record.run_id);
        
        // Calculate gross salary with all components
        const grossComponents = await this.calculateGrossComponents(record, employeeData);
        const grossSalary = grossComponents.total;
        
        // Calculate deductions based on method
        const deductionComponents = await this.calculateDeductions(grossSalary, calculationMethod, employeeData);
        const totalDeductions = deductionComponents.total;
        
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
        `, [grossSalary, totalDeductions, totalTaxes, grossSalary, grossSalary, netSalary, record.id]);

        // Create detailed component records
        try {
            await this.createPayrollComponents(record.id, {
                grossComponents,
                deductionComponents,
                taxComponents
            }, record.client_id);
        } catch (componentError) {
            console.log(`Component creation failed for record ${record.id}: ${componentError.message}`);
            // Continue with calculation even if component creation fails
        }
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
        
        // Get overtime hours for current period (if runId provided)
        let overtimeHours = 0;
        if (runId) {
            const [overtime] = await db.execute(`
                SELECT SUM(a.overtime_hours) as total_overtime_hours
                FROM attendance a
                JOIN payroll_runs pr ON pr.id = ?
                JOIN payroll_periods pp ON pr.period_id = pp.id
                WHERE a.employee_id = ? 
                  AND DATE(a.date) BETWEEN pp.period_start_date AND pp.period_end_date
            `, [runId, employeeId]);
            
            overtimeHours = overtime[0]?.total_overtime_hours || 0;
        }
        
        return {
            allowances: allowances || [],
            deductions: deductions || [],
            overtimeHours: overtimeHours
        };
    }

    /**
     * Calculate gross salary components
     */
    async calculateGrossComponents(record, employeeData) {
        const baseSalary = parseFloat(record.base_salary) || 0;
        const components = [];
        let total = baseSalary;
        
        // Base salary component
        components.push({
            code: 'BASIC_SAL',
            name: 'Basic Salary', 
            type: 'earning',
            category: 'basic',
            amount: baseSalary
        });
        
        // Add allowances
        for (const allowance of employeeData.allowances) {
            const amount = parseFloat(allowance.amount) || 0;
            total += amount;
            components.push({
                code: allowance.allowance_type.toUpperCase(),
                name: allowance.allowance_type.replace('_', ' '),
                type: 'earning',
                category: 'allowance',
                amount: amount
            });
        }
        
        // Add overtime
        if (employeeData.overtimeHours > 0) {
            const hourlyRate = baseSalary / (22 * 8); // Assuming 22 working days, 8 hours
            const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
            const overtimeAmount = employeeData.overtimeHours * overtimeRate;
            total += overtimeAmount;
            
            components.push({
                code: 'OVERTIME',
                name: 'Overtime Pay',
                type: 'earning',
                category: 'overtime',
                amount: overtimeAmount
            });
        }
        
        return { components, total };
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
        
        // EPF (Employee Provident Fund) - 8%
        const epfAmount = baseSalary * 0.08;
        components.push({
            code: 'EPF',
            name: 'Employee Provident Fund',
            type: 'deduction',
            category: 'statutory',
            amount: epfAmount
        });
        total += epfAmount;
        
        // ETF (Employee Trust Fund) - 3% (employer contribution, but shown for transparency)
        const etfAmount = baseSalary * 0.03;
        components.push({
            code: 'ETF',
            name: 'Employee Trust Fund',
            type: 'deduction', 
            category: 'statutory',
            amount: etfAmount
        });
        total += etfAmount;
        
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

        return Math.round(tax * 100) / 100;
    }

    /**
     * Create detailed payroll components for record
     */
    async createPayrollComponents(recordId, componentData, clientId = 'DEFAULT') {
        const db = getDB();
        const allComponents = [
            ...componentData.grossComponents.components,
            ...componentData.deductionComponents.components, 
            ...componentData.taxComponents.components
        ];

        for (const comp of allComponents) {
            // Get or create component_id
            let componentId;
            try {
                const [existingComponent] = await db.execute(
                    'SELECT id FROM payroll_components WHERE component_name = ? AND client_id = ?', 
                    [comp.name, clientId]
                );
                
                if (existingComponent.length > 0) {
                    componentId = existingComponent[0].id;
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
                }

                // Insert component record
                await db.execute(`
                    INSERT INTO payroll_record_components (
                        id, record_id, component_id, component_code, component_name,
                        component_type, component_category, calculation_method,
                        calculated_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'calculated', ?)
                `, [
                    uuidv4(), recordId, componentId, comp.code, comp.name,
                    comp.type, comp.category, comp.amount
                ]);

            } catch (error) {
                console.warn(`Failed to create component ${comp.code}:`, error.message);
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
}

module.exports = new PayrollRunService();