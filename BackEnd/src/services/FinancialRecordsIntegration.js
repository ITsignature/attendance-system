// =============================================
// FINANCIAL RECORDS INTEGRATION SERVICE
// =============================================
// Integrates loans, advances, and bonuses with PayrollRun system
// Handles real-time salary adjustments during payroll calculation

const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class FinancialRecordsIntegration {

    // =============================================
    // MAIN INTEGRATION METHOD
    // =============================================

    /**
     * Process all financial records for an employee during payroll calculation
     * @param {string} employeeId - Employee UUID
     * @param {Object} payrollPeriod - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     * @param {string} runId - Payroll run ID for audit trail
     * @returns {Object} Financial adjustments to apply to salary
     */
    async processFinancialRecords(employeeId, payrollPeriod, runId) {
        try {
            console.log(`🔄 Processing financial records for employee ${employeeId} in period ${payrollPeriod.start} to ${payrollPeriod.end}`);

            // Get all active financial records
            const loans = await this.getActiveLoans(employeeId, payrollPeriod);
            const advances = await this.getActiveAdvances(employeeId, payrollPeriod);
            const bonuses = await this.getApprovedBonuses(employeeId, payrollPeriod);

            // Calculate adjustments
            const loanDeductions = await this.calculateLoanDeductions(loans, payrollPeriod);
            const advanceDeductions = await this.calculateAdvanceDeductions(advances, payrollPeriod);
            const bonusAdditions = await this.calculateBonusAdditions(bonuses, payrollPeriod);

            const adjustments = {
                loanDeductions: loanDeductions.totalAmount,
                advanceDeductions: advanceDeductions.totalAmount,
                bonuses: bonusAdditions.totalAmount,
                records: {
                    loans: loanDeductions.records,
                    advances: advanceDeductions.records,
                    bonuses: bonusAdditions.records
                },
                summary: {
                    totalDeductions: loanDeductions.totalAmount + advanceDeductions.totalAmount,
                    totalAdditions: bonusAdditions.totalAmount,
                    netAdjustment: bonusAdditions.totalAmount - (loanDeductions.totalAmount + advanceDeductions.totalAmount)
                }
            };

            console.log(`✅ Financial adjustments calculated:`, {
                loans: loanDeductions.totalAmount,
                advances: advanceDeductions.totalAmount,
                bonuses: bonusAdditions.totalAmount,
                netAdjustment: adjustments.summary.netAdjustment
            });

            return adjustments;

        } catch (error) {
            console.error('❌ Error processing financial records:', error);
            throw new Error(`Financial records processing failed: ${error.message}`);
        }
    }

    // =============================================
    // LOAN PROCESSING
    // =============================================

    /**
     * Get active loans for employee in the given period
     */
    async getActiveLoans(employeeId, payrollPeriod) {
        const db = getDB();

        const [loans] = await db.execute(`
            SELECT
                id,
                loan_type,
                loan_amount,
                interest_rate,
                tenure_months,
                monthly_deduction,
                total_paid,
                remaining_amount,
                start_date,
                end_date,
                status,
                notes
            FROM employee_loans
            WHERE employee_id = ?
              AND status = 'active'
              AND start_date <= ?
              AND (end_date IS NULL OR end_date >= ?)
            ORDER BY start_date ASC
        `, [employeeId, payrollPeriod.end, payrollPeriod.start]);

        console.log(`📊 Found ${loans.length} active loans for employee ${employeeId}`);
        return loans;
    }

    /**
     * Calculate total loan deductions for the period
     */
    async calculateLoanDeductions(loans, payrollPeriod) {
        let totalAmount = 0;
        const processedRecords = [];

        for (const loan of loans) {
            // Check if this loan should have deduction in this period
            const shouldDeduct = this.shouldDeductInPeriod(loan.start_date, payrollPeriod);

            if (shouldDeduct && loan.remaining_amount > 0) {
                // Calculate deduction amount (minimum of monthly_deduction and remaining_amount)
                const deductionAmount = Math.min(loan.monthly_deduction, loan.remaining_amount);

                totalAmount += deductionAmount;
                processedRecords.push({
                    ...loan,
                    deduction_amount: deductionAmount,
                    processing_period: payrollPeriod
                });

                console.log(`💰 Loan ${loan.id}: Deducting LKR ${deductionAmount} (Remaining: LKR ${loan.remaining_amount})`);
            }
        }

        return {
            totalAmount,
            records: processedRecords
        };
    }

    // =============================================
    // ADVANCE PROCESSING
    // =============================================

    /**
     * Get active advances for employee in the given period
     */
    async getActiveAdvances(employeeId, payrollPeriod) {
        const db = getDB();

        const [advances] = await db.execute(`
            SELECT
                id,
                advance_type,
                advance_amount,
                description,
                deduction_start_date,
                deduction_months,
                monthly_deduction,
                total_deducted,
                remaining_amount,
                status,
                justification,
                notes
            FROM employee_advances
            WHERE employee_id = ?
              AND status IN ('approved', 'paid')
              AND deduction_start_date <= ?
              AND remaining_amount > 0
            ORDER BY deduction_start_date ASC
        `, [employeeId, payrollPeriod.end]);

        console.log(`📊 Found ${advances.length} active advances for employee ${employeeId}`);
        return advances;
    }

    /**
     * Calculate total advance deductions for the period
     */
    async calculateAdvanceDeductions(advances, payrollPeriod) {
        let totalAmount = 0;
        const processedRecords = [];

        for (const advance of advances) {
            // Check if deduction should happen in this period
            const shouldDeduct = this.shouldDeductInPeriod(advance.deduction_start_date, payrollPeriod);

            if (shouldDeduct && advance.remaining_amount > 0) {
                // Calculate deduction amount
                const deductionAmount = Math.min(advance.monthly_deduction, advance.remaining_amount);

                totalAmount += deductionAmount;
                processedRecords.push({
                    ...advance,
                    deduction_amount: deductionAmount,
                    processing_period: payrollPeriod
                });

                console.log(`💸 Advance ${advance.id}: Deducting LKR ${deductionAmount} (Remaining: LKR ${advance.remaining_amount})`);
            }
        }

        return {
            totalAmount,
            records: processedRecords
        };
    }

    // =============================================
    // BONUS PROCESSING
    // =============================================

    /**
     * Get approved bonuses for employee in the given period
     */
    async getApprovedBonuses(employeeId, payrollPeriod) {
        const db = getDB();

        const [bonuses] = await db.execute(`
            SELECT
                id,
                bonus_type,
                bonus_amount,
                description,
                bonus_period,
                effective_date,
                payment_method,
                status,
                calculation_basis,
                notes
            FROM employee_bonuses
            WHERE employee_id = ?
              AND status = 'approved'
              AND effective_date >= ?
              AND effective_date <= ?
              AND payment_method = 'next_payroll'
            ORDER BY effective_date ASC
        `, [employeeId, payrollPeriod.start, payrollPeriod.end]);

        console.log(`📊 Found ${bonuses.length} approved bonuses for employee ${employeeId}`);
        return bonuses;
    }

    /**
     * Calculate total bonus additions for the period
     */
    async calculateBonusAdditions(bonuses, payrollPeriod) {
        let totalAmount = 0;
        const processedRecords = [];

        for (const bonus of bonuses) {
            totalAmount += bonus.bonus_amount;
            processedRecords.push({
                ...bonus,
                addition_amount: bonus.bonus_amount,
                processing_period: payrollPeriod
            });

            console.log(`🎁 Bonus ${bonus.id}: Adding LKR ${bonus.bonus_amount} (${bonus.bonus_type})`);
        }

        return {
            totalAmount,
            records: processedRecords
        };
    }

    // =============================================
    // BALANCE UPDATE METHODS
    // =============================================

    /**
     * Update financial record balances after payroll processing
     * @param {string} employeeId - Employee UUID
     * @param {Object} adjustments - Processed financial adjustments
     * @param {string} runId - Payroll run ID for audit trail
     */
    async updateFinancialBalances(employeeId, adjustments, runId) {
        const db = getDB();

        try {
            await db.execute('START TRANSACTION');

            // Update loan balances
            for (const loan of adjustments.records.loans) {
                const newRemainingAmount = loan.remaining_amount - loan.deduction_amount;
                const newTotalPaid = loan.total_paid + loan.deduction_amount;
                const newStatus = newRemainingAmount <= 0 ? 'completed' : 'active';

                await db.execute(`
                    UPDATE employee_loans
                    SET remaining_amount = ?,
                        total_paid = ?,
                        status = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [newRemainingAmount, newTotalPaid, newStatus, loan.id]);

                console.log(`✅ Updated loan ${loan.id}: Remaining LKR ${newRemainingAmount}, Status: ${newStatus}`);
            }

            // Update advance balances
            for (const advance of adjustments.records.advances) {
                const newRemainingAmount = advance.remaining_amount - advance.deduction_amount;
                const newTotalDeducted = advance.total_deducted + advance.deduction_amount;
                const newStatus = newRemainingAmount <= 0 ? 'completed' : 'paid';

                await db.execute(`
                    UPDATE employee_advances
                    SET remaining_amount = ?,
                        total_deducted = ?,
                        status = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [newRemainingAmount, newTotalDeducted, newStatus, advance.id]);

                console.log(`✅ Updated advance ${advance.id}: Remaining LKR ${newRemainingAmount}, Status: ${newStatus}`);
            }

            // Update bonus status to 'paid'
            for (const bonus of adjustments.records.bonuses) {
                await db.execute(`
                    UPDATE employee_bonuses
                    SET status = 'paid',
                        payment_date = CURDATE(),
                        processed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                `, [bonus.id]);

                console.log(`✅ Updated bonus ${bonus.id}: Status changed to 'paid'`);
            }

            // Create audit log for financial adjustments
            await this.createFinancialAuditLog(employeeId, runId, adjustments);

            await db.execute('COMMIT');
            console.log(`✅ Financial balances updated successfully for employee ${employeeId}`);

        } catch (error) {
            await db.execute('ROLLBACK');
            console.error('❌ Error updating financial balances:', error);
            throw error;
        }
    }

    // =============================================
    // UTILITY METHODS
    // =============================================

    /**
     * Check if deduction should happen in the given payroll period
     */
    shouldDeductInPeriod(startDate, payrollPeriod) {
        const start = new Date(startDate);
        const periodStart = new Date(payrollPeriod.start);
        const periodEnd = new Date(payrollPeriod.end);

        return start <= periodEnd;
    }

    /**
     * Create audit log for financial adjustments
     */
    async createFinancialAuditLog(employeeId, runId, adjustments) {
        const db = getDB();
        const logId = uuidv4();

        await db.execute(`
            INSERT INTO payroll_audit_logs (
                id, run_id, employee_id, action, details, created_at
            ) VALUES (?, ?, ?, 'financial_adjustment', ?, NOW())
        `, [
            logId,
            runId,
            employeeId,
            JSON.stringify({
                loan_deductions: adjustments.loanDeductions,
                advance_deductions: adjustments.advanceDeductions,
                bonuses: adjustments.bonuses,
                net_adjustment: adjustments.summary.netAdjustment,
                processed_records: {
                    loans: adjustments.records.loans.length,
                    advances: adjustments.records.advances.length,
                    bonuses: adjustments.records.bonuses.length
                }
            })
        ]);
    }

    /**
     * Get financial summary for an employee (for reporting)
     */
    async getEmployeeFinancialSummary(employeeId) {
        const db = getDB();

        const [summary] = await db.execute(`
            SELECT
                (SELECT COUNT(*) FROM employee_loans WHERE employee_id = ? AND status = 'active') as active_loans,
                (SELECT COALESCE(SUM(remaining_amount), 0) FROM employee_loans WHERE employee_id = ? AND status = 'active') as total_loan_balance,
                (SELECT COUNT(*) FROM employee_advances WHERE employee_id = ? AND status IN ('approved', 'paid') AND remaining_amount > 0) as active_advances,
                (SELECT COALESCE(SUM(remaining_amount), 0) FROM employee_advances WHERE employee_id = ? AND status IN ('approved', 'paid') AND remaining_amount > 0) as total_advance_balance,
                (SELECT COUNT(*) FROM employee_bonuses WHERE employee_id = ? AND status = 'approved') as pending_bonuses,
                (SELECT COALESCE(SUM(bonus_amount), 0) FROM employee_bonuses WHERE employee_id = ? AND status = 'approved') as total_pending_bonuses
        `, [employeeId, employeeId, employeeId, employeeId, employeeId, employeeId]);

        return summary[0] || {};
    }
}

// Export singleton instance
module.exports = new FinancialRecordsIntegration();