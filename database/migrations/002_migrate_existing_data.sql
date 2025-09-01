-- =============================================
-- DATA MIGRATION SCRIPT - OLD TO NEW PAYROLL SYSTEM
-- =============================================
-- This script migrates existing individual payroll records 
-- to the new industry-standard payroll run system

-- IMPORTANT: Run this AFTER running 001_payroll_redesign.sql
-- and AFTER testing the new system thoroughly

-- =============================================
-- STEP 1: CREATE DEFAULT PAYROLL PERIODS
-- =============================================

-- Create payroll periods for last 12 months
INSERT INTO payroll_periods (id, client_id, period_number, period_year, period_type, period_start_date, period_end_date, cut_off_date, pay_date, status)
SELECT 
    UUID() as id,
    c.id as client_id,
    MONTH(DATE_SUB(CURDATE(), INTERVAL n.n MONTH)) as period_number,
    YEAR(DATE_SUB(CURDATE(), INTERVAL n.n MONTH)) as period_year,
    'monthly' as period_type,
    DATE_SUB(DATE_SUB(CURDATE(), INTERVAL n.n MONTH), INTERVAL DAY(DATE_SUB(CURDATE(), INTERVAL n.n MONTH)) - 1 DAY) as period_start_date,
    LAST_DAY(DATE_SUB(CURDATE(), INTERVAL n.n MONTH)) as period_end_date,
    DATE_SUB(LAST_DAY(DATE_SUB(CURDATE(), INTERVAL n.n MONTH)), INTERVAL 5 DAY) as cut_off_date,
    DATE_ADD(LAST_DAY(DATE_SUB(CURDATE(), INTERVAL n.n MONTH)), INTERVAL 5 DAY) as pay_date,
    'closed' as status
FROM clients c
CROSS JOIN (
    SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION
    SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
) n
WHERE c.is_active = 1;

-- =============================================
-- STEP 2: MIGRATE EXISTING PAYROLL RECORDS
-- =============================================

-- Create payroll runs for existing records grouped by client, month, and year
INSERT INTO payroll_runs (
    id, client_id, run_number, period_id, run_name, run_type, run_status,
    total_employees, processed_employees, total_gross_amount, total_deductions_amount, total_net_amount,
    calculation_method, created_by, created_at, approved_at, processed_at, completed_at
)
SELECT 
    UUID() as id,
    e.client_id,
    CONCAT('MIGRATED_', YEAR(pr_old.pay_period_start), '_', LPAD(MONTH(pr_old.pay_period_start), 2, '0')) as run_number,
    pp.id as period_id,
    CONCAT('Migrated Payroll - ', DATE_FORMAT(pr_old.pay_period_start, '%M %Y')) as run_name,
    'regular' as run_type,
    CASE 
        WHEN COUNT(CASE WHEN pr_old.payment_status = 'paid' THEN 1 END) = COUNT(*) THEN 'completed'
        WHEN COUNT(CASE WHEN pr_old.payment_status = 'paid' THEN 1 END) > 0 THEN 'processing'
        ELSE 'draft'
    END as run_status,
    COUNT(*) as total_employees,
    COUNT(CASE WHEN pr_old.payment_status = 'paid' THEN 1 END) as processed_employees,
    COALESCE(SUM(pr_old.gross_salary), 0) as total_gross_amount,
    COALESCE(SUM(pr_old.total_deductions), 0) as total_deductions_amount,
    COALESCE(SUM(pr_old.net_salary), 0) as total_net_amount,
    'simple' as calculation_method,
    pr_old.processed_by as created_by,
    MIN(pr_old.created_at) as created_at,
    MIN(CASE WHEN pr_old.payment_status != 'pending' THEN pr_old.updated_at END) as approved_at,
    MIN(CASE WHEN pr_old.payment_status = 'paid' THEN pr_old.updated_at END) as processed_at,
    MAX(CASE WHEN pr_old.payment_status = 'paid' THEN pr_old.updated_at END) as completed_at
FROM payroll_records_old pr_old
JOIN employees e ON pr_old.employee_id = e.id
JOIN payroll_periods pp ON (
    pp.client_id = e.client_id 
    AND YEAR(pr_old.pay_period_start) = pp.period_year 
    AND MONTH(pr_old.pay_period_start) = pp.period_number
    AND pp.period_type = 'monthly'
)
GROUP BY e.client_id, YEAR(pr_old.pay_period_start), MONTH(pr_old.pay_period_start)
ORDER BY e.client_id, pr_old.pay_period_start;

-- =============================================
-- STEP 3: MIGRATE INDIVIDUAL RECORDS TO NEW STRUCTURE
-- =============================================

-- Insert migrated payroll records
INSERT INTO payroll_records (
    id, run_id, employee_id, employee_code, employee_name, department_name, designation_name,
    calculation_status, worked_days, total_earnings, total_deductions, total_taxes,
    gross_salary, taxable_income, net_salary, payment_status, payment_method,
    payment_date, payment_reference, calculated_at, notes, created_at, updated_at
)
SELECT 
    pr_old.id,
    pr_new.id as run_id,
    pr_old.employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    d.name as department_name,
    des.title as designation_name,
    'calculated' as calculation_status,
    22 as worked_days, -- Default assumption
    pr_old.gross_salary as total_earnings,
    pr_old.total_deductions,
    pr_old.tax_deduction as total_taxes,
    pr_old.gross_salary,
    pr_old.gross_salary as taxable_income,
    pr_old.net_salary,
    pr_old.payment_status,
    pr_old.payment_method,
    pr_old.payment_date,
    pr_old.payment_reference,
    pr_old.updated_at as calculated_at,
    pr_old.notes,
    pr_old.created_at,
    pr_old.updated_at
FROM payroll_records_old pr_old
JOIN employees e ON pr_old.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
JOIN payroll_runs pr_new ON (
    pr_new.client_id = e.client_id
    AND pr_new.run_number = CONCAT('MIGRATED_', YEAR(pr_old.pay_period_start), '_', LPAD(MONTH(pr_old.pay_period_start), 2, '0'))
);

-- =============================================
-- STEP 4: CREATE BASIC PAYROLL COMPONENTS FOR MIGRATED RECORDS
-- =============================================

-- Create basic components for each migrated record
INSERT INTO payroll_record_components (
    id, record_id, component_id, component_code, component_name,
    component_type, component_category, calculation_method,
    base_amount, rate, quantity, calculated_amount, created_at
)
SELECT 
    UUID() as id,
    pr.id as record_id,
    (SELECT id FROM payroll_components WHERE code = 'BASIC_SAL' AND client_id = 'DEFAULT' LIMIT 1) as component_id,
    'BASIC_SAL' as component_code,
    'Basic Salary' as component_name,
    'earning' as component_type,
    'basic_salary' as component_category,
    'fixed' as calculation_method,
    pr_old.base_salary as base_amount,
    1.0000 as rate,
    1.00 as quantity,
    pr_old.base_salary as calculated_amount,
    pr.created_at
FROM payroll_records pr
JOIN payroll_records_old pr_old ON pr.id = pr_old.id

UNION ALL

-- Income Tax Component
SELECT 
    UUID() as id,
    pr.id as record_id,
    (SELECT id FROM payroll_components WHERE code = 'INCOME_TAX' AND client_id = 'DEFAULT' LIMIT 1) as component_id,
    'INCOME_TAX' as component_code,
    'Income Tax' as component_name,
    'tax' as component_type,
    'tax_income' as component_category,
    'percentage' as calculation_method,
    pr_old.gross_salary as base_amount,
    (pr_old.tax_deduction / pr_old.gross_salary) as rate,
    1.00 as quantity,
    pr_old.tax_deduction as calculated_amount,
    pr.created_at
FROM payroll_records pr
JOIN payroll_records_old pr_old ON pr.id = pr_old.id
WHERE pr_old.tax_deduction > 0

UNION ALL

-- Provident Fund Component
SELECT 
    UUID() as id,
    pr.id as record_id,
    (SELECT id FROM payroll_components WHERE code = 'EPF' AND client_id = 'DEFAULT' LIMIT 1) as component_id,
    'EPF' as component_code,
    'Employee Provident Fund' as component_name,
    'deduction' as component_type,
    'retirement' as component_category,
    'percentage' as calculation_method,
    pr_old.base_salary as base_amount,
    (pr_old.provident_fund / pr_old.base_salary) as rate,
    1.00 as quantity,
    pr_old.provident_fund as calculated_amount,
    pr.created_at
FROM payroll_records pr
JOIN payroll_records_old pr_old ON pr.id = pr_old.id
WHERE pr_old.provident_fund > 0

UNION ALL

-- Allowances Component (if any)
SELECT 
    UUID() as id,
    pr.id as record_id,
    (SELECT id FROM payroll_components WHERE code = 'TRANSPORT' AND client_id = 'DEFAULT' LIMIT 1) as component_id,
    'ALLOWANCES' as component_code,
    'Allowances' as component_name,
    'earning' as component_type,
    'allowance' as component_category,
    'fixed' as calculation_method,
    pr_old.allowances as base_amount,
    1.0000 as rate,
    1.00 as quantity,
    pr_old.allowances as calculated_amount,
    pr.created_at
FROM payroll_records pr
JOIN payroll_records_old pr_old ON pr.id = pr_old.id
WHERE pr_old.allowances > 0;

-- =============================================
-- STEP 5: CREATE CLIENT-SPECIFIC PAYROLL COMPONENTS
-- =============================================

-- Copy default components for each client
INSERT INTO payroll_components (
    id, client_id, code, name, type, category, calculation_method,
    default_value, is_taxable, is_mandatory, display_order, created_at, updated_at
)
SELECT 
    UUID() as id,
    c.id as client_id,
    pc.code,
    pc.name,
    pc.type,
    pc.category,
    pc.calculation_method,
    pc.default_value,
    pc.is_taxable,
    pc.is_mandatory,
    pc.display_order,
    NOW() as created_at,
    NOW() as updated_at
FROM clients c
CROSS JOIN payroll_components pc
WHERE c.is_active = 1
  AND pc.client_id = 'DEFAULT'
  AND NOT EXISTS (
      SELECT 1 FROM payroll_components existing
      WHERE existing.client_id = c.id 
        AND existing.code = pc.code
  );

-- =============================================
-- STEP 6: UPDATE STATISTICS AND FINAL CLEANUP
-- =============================================

-- Update run statistics for migrated runs
UPDATE payroll_runs pr SET
    total_employees = (
        SELECT COUNT(*) 
        FROM payroll_records pr_rec 
        WHERE pr_rec.run_id = pr.id
    ),
    processed_employees = (
        SELECT COUNT(*) 
        FROM payroll_records pr_rec 
        WHERE pr_rec.run_id = pr.id 
          AND pr_rec.calculation_status = 'calculated'
    ),
    total_gross_amount = (
        SELECT COALESCE(SUM(gross_salary), 0)
        FROM payroll_records pr_rec 
        WHERE pr_rec.run_id = pr.id
          AND pr_rec.calculation_status = 'calculated'
    ),
    total_deductions_amount = (
        SELECT COALESCE(SUM(total_deductions), 0)
        FROM payroll_records pr_rec 
        WHERE pr_rec.run_id = pr.id
          AND pr_rec.calculation_status = 'calculated'
    ),
    total_net_amount = (
        SELECT COALESCE(SUM(net_salary), 0)
        FROM payroll_records pr_rec 
        WHERE pr_rec.run_id = pr.id
          AND pr_rec.calculation_status = 'calculated'
    )
WHERE pr.run_number LIKE 'MIGRATED_%';

-- =============================================
-- STEP 7: CREATE MIGRATION REPORT
-- =============================================

-- Insert migration summary
INSERT INTO migration_log (migration_name, status, records_processed, total_records, started_at, completed_at)
SELECT 
    'data_migration_payroll_records',
    'completed',
    COUNT(*),
    (SELECT COUNT(*) FROM payroll_records_old),
    NOW(),
    NOW()
FROM payroll_records;

-- Create migration report
SELECT 
    'MIGRATION SUMMARY' as section,
    '' as details
    
UNION ALL

SELECT 
    'Original Records',
    CAST(COUNT(*) AS CHAR)
FROM payroll_records_old

UNION ALL

SELECT 
    'Migrated Records', 
    CAST(COUNT(*) AS CHAR)
FROM payroll_records

UNION ALL

SELECT 
    'Payroll Runs Created',
    CAST(COUNT(*) AS CHAR)
FROM payroll_runs
WHERE run_number LIKE 'MIGRATED_%'

UNION ALL

SELECT 
    'Payroll Periods Created',
    CAST(COUNT(*) AS CHAR)
FROM payroll_periods

UNION ALL

SELECT 
    'Component Records Created',
    CAST(COUNT(*) AS CHAR)
FROM payroll_record_components

UNION ALL

SELECT 
    'Clients Migrated',
    CAST(COUNT(DISTINCT client_id) AS CHAR)
FROM payroll_runs
WHERE run_number LIKE 'MIGRATED_%';

-- =============================================
-- OPTIONAL: BACKUP OLD TABLES
-- =============================================

-- Uncomment these lines after verifying migration success
-- RENAME TABLE payroll_records_old TO payroll_records_backup_YYYYMMDD;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these queries to verify migration success:

/*
-- Check if totals match
SELECT 
    'Old System' as system,
    COUNT(*) as records,
    SUM(gross_salary) as total_gross,
    SUM(net_salary) as total_net
FROM payroll_records_old

UNION ALL

SELECT 
    'New System' as system,
    COUNT(*) as records,
    SUM(gross_salary) as total_gross,
    SUM(net_salary) as total_net
FROM payroll_records;

-- Check payroll runs
SELECT 
    client_id,
    COUNT(*) as run_count,
    SUM(total_employees) as total_employees,
    SUM(total_net_amount) as total_amount
FROM payroll_runs
WHERE run_number LIKE 'MIGRATED_%'
GROUP BY client_id;

-- Check components
SELECT 
    component_type,
    COUNT(*) as component_count,
    SUM(calculated_amount) as total_amount
FROM payroll_record_components
GROUP BY component_type;
*/