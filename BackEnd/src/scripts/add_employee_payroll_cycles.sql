-- =====================================================
-- Migration: Add Employee-Specific Payroll Cycles
-- Version: 1.0
-- Date: 2026-01-25
-- Description: Allows employees to have custom payroll cycle dates
--              (e.g., 23rd Jan to 23rd Feb instead of 1st to end of month)
-- =====================================================

-- Step 1: Add payroll cycle configuration columns to employees table
ALTER TABLE employees
ADD COLUMN payroll_cycle_override ENUM('default', 'custom') DEFAULT 'default'
    COMMENT 'Whether employee uses default or custom payroll cycle'
    AFTER attendance_affects_salary;

ALTER TABLE employees
ADD COLUMN payroll_cycle_day INT DEFAULT NULL
    COMMENT 'Day of month when payroll cycle starts (1-31). NULL = use client default from payroll_periods'
    AFTER payroll_cycle_override;

ALTER TABLE employees
ADD COLUMN payroll_cycle_effective_from DATE DEFAULT NULL
    COMMENT 'Date when custom cycle becomes effective (for smooth transitions)'
    AFTER payroll_cycle_day;

-- Step 2: Add index for performance on payroll cycle queries
CREATE INDEX idx_employees_payroll_cycle
ON employees(payroll_cycle_override, payroll_cycle_day);

-- Step 3: Add employee-specific period tracking columns to payroll_records table
ALTER TABLE payroll_records
ADD COLUMN employee_period_start_date DATE DEFAULT NULL
    COMMENT 'Actual period start date used for this employee (may differ from run period for custom cycles)'
    AFTER run_id;

ALTER TABLE payroll_records
ADD COLUMN employee_period_end_date DATE DEFAULT NULL
    COMMENT 'Actual period end date used for this employee (may differ from run period for custom cycles)'
    AFTER employee_period_start_date;

ALTER TABLE payroll_records
ADD COLUMN uses_custom_cycle TINYINT(1) DEFAULT 0
    COMMENT 'Flag indicating if this employee used custom cycle (1) or default (0) for this run'
    AFTER employee_period_end_date;

-- Step 4: Add index for payroll_records custom cycle queries
CREATE INDEX idx_payroll_records_custom_cycle
ON payroll_records(uses_custom_cycle, employee_period_start_date, employee_period_end_date);

-- Step 5: Backfill existing payroll_records with period dates from payroll_periods
-- This ensures all historical records have employee_period_* dates for reporting
UPDATE payroll_records pr
JOIN payroll_runs prun ON pr.run_id = prun.id
JOIN payroll_periods pp ON prun.period_id = pp.id
SET
    pr.employee_period_start_date = pp.period_start_date,
    pr.employee_period_end_date = pp.period_end_date,
    pr.uses_custom_cycle = 0
WHERE pr.employee_period_start_date IS NULL;

-- Step 6: Verify migration
SELECT
    'Migration completed successfully' AS status,
    COUNT(*) AS total_employees,
    SUM(CASE WHEN payroll_cycle_override = 'custom' THEN 1 ELSE 0 END) AS custom_cycle_employees,
    SUM(CASE WHEN payroll_cycle_override = 'default' THEN 1 ELSE 0 END) AS default_cycle_employees
FROM employees;

SELECT
    'Payroll records backfilled' AS status,
    COUNT(*) AS total_records,
    SUM(CASE WHEN uses_custom_cycle = 1 THEN 1 ELSE 0 END) AS custom_cycle_records,
    SUM(CASE WHEN uses_custom_cycle = 0 THEN 1 ELSE 0 END) AS default_cycle_records,
    SUM(CASE WHEN employee_period_start_date IS NOT NULL THEN 1 ELSE 0 END) AS records_with_dates
FROM payroll_records;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- Uncomment and run if you need to rollback this migration
/*
DROP INDEX idx_payroll_records_custom_cycle ON payroll_records;
ALTER TABLE payroll_records DROP COLUMN uses_custom_cycle;
ALTER TABLE payroll_records DROP COLUMN employee_period_end_date;
ALTER TABLE payroll_records DROP COLUMN employee_period_start_date;

DROP INDEX idx_employees_payroll_cycle ON employees;
ALTER TABLE employees DROP COLUMN payroll_cycle_effective_from;
ALTER TABLE employees DROP COLUMN payroll_cycle_day;
ALTER TABLE employees DROP COLUMN payroll_cycle_override;

COMMIT;
*/
