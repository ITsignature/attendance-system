-- =============================================
-- PAYROLL SYSTEM ENHANCEMENTS
-- =============================================
-- Migration to add employee allowances, deductions, and overtime tracking
-- Run this after the main payroll_migration.sql

-- =============================================
-- EMPLOYEE ALLOWANCES TABLE (With Proper Foreign Keys)
-- =============================================

-- First create the table without foreign keys
CREATE TABLE IF NOT EXISTS employee_allowances (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36) NOT NULL,
    allowance_type VARCHAR(50) NOT NULL, -- 'house_allowance', 'transport_allowance', 'medical_allowance', etc.
    allowance_name VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    is_percentage BOOLEAN DEFAULT FALSE, -- FALSE = fixed amount, TRUE = percentage of base salary
    is_taxable BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_emp_allowances_client_employee (client_id, employee_id),
    INDEX idx_emp_allowances_active (is_active, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Now add foreign keys with proper error handling
-- Check if employees table exists and add foreign key
SET @sql = 'ALTER TABLE employee_allowances ADD CONSTRAINT fk_allowances_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE';
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'employees');
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'employee_allowances' AND constraint_name = 'fk_allowances_employee');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, @sql, 'SELECT "employees table not found or constraint already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- EMPLOYEE DEDUCTIONS TABLE (With Proper Foreign Keys)
-- =============================================

-- First create the table without foreign keys
CREATE TABLE IF NOT EXISTS employee_deductions (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36) NOT NULL,
    deduction_type VARCHAR(50) NOT NULL, -- 'loan_deduction', 'insurance', 'advance_salary', etc.
    deduction_name VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    is_percentage BOOLEAN DEFAULT FALSE, -- FALSE = fixed amount, TRUE = percentage of gross salary
    is_recurring BOOLEAN DEFAULT TRUE, -- TRUE = every payroll, FALSE = one-time
    remaining_installments INT NULL, -- For loan deductions
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_emp_deductions_client_employee (client_id, employee_id),
    INDEX idx_emp_deductions_active (is_active, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add foreign key for employee_deductions
SET @sql = 'ALTER TABLE employee_deductions ADD CONSTRAINT fk_deductions_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE';
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'employees');
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'employee_deductions' AND constraint_name = 'fk_deductions_employee');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, @sql, 'SELECT "employees table not found or constraint already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- ATTENDANCE ENHANCEMENT (Fixed Table Name)
-- =============================================

-- Add overtime tracking columns to existing attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(4,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(4,2) DEFAULT 1.5 COMMENT '1.5x for regular overtime, 2.0x for holidays';

-- =============================================
-- PAYROLL COMPONENTS ENHANCEMENT
-- =============================================

-- Add category column to payroll_components for better organization
ALTER TABLE payroll_components 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other' AFTER component_type,
ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT FALSE AFTER is_taxable;

-- Update existing components with proper categories
UPDATE payroll_components SET category = 'basic' WHERE component_name LIKE '%Basic%' OR component_name LIKE '%Salary%';
UPDATE payroll_components SET category = 'allowance' WHERE component_name LIKE '%Allowance%';
UPDATE payroll_components SET category = 'statutory' WHERE component_name LIKE '%EPF%' OR component_name LIKE '%ETF%';
UPDATE payroll_components SET category = 'tax' WHERE component_name LIKE '%Tax%';

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- First, let's get some actual employee IDs to work with
-- Sample allowances for existing employees
INSERT IGNORE INTO employee_allowances (
    id, client_id, employee_id, allowance_type, allowance_name, 
    amount, is_percentage, is_taxable, effective_from, created_by
) 
SELECT 
    UUID() as id,
    'DEFAULT' as client_id,
    e.id as employee_id,
    'house_allowance' as allowance_type,
    'House Allowance' as allowance_name,
    5000.00 as amount,
    FALSE as is_percentage,
    TRUE as is_taxable,
    '2024-01-01' as effective_from,
    NULL as created_by
FROM employees e LIMIT 3;

INSERT IGNORE INTO employee_allowances (
    id, client_id, employee_id, allowance_type, allowance_name, 
    amount, is_percentage, is_taxable, effective_from, created_by
)
SELECT 
    UUID() as id,
    'DEFAULT' as client_id,
    e.id as employee_id,
    'transport_allowance' as allowance_type,
    'Transport Allowance' as allowance_name,
    3000.00 as amount,
    FALSE as is_percentage,
    TRUE as is_taxable,
    '2024-01-01' as effective_from,
    NULL as created_by
FROM employees e LIMIT 3;

-- Sample deductions
INSERT IGNORE INTO employee_deductions (
    id, client_id, employee_id, deduction_type, deduction_name, 
    amount, is_percentage, effective_from, created_by
)
SELECT 
    UUID() as id,
    'DEFAULT' as client_id,
    e.id as employee_id,
    'insurance' as deduction_type,
    'Health Insurance' as deduction_name,
    1500.00 as amount,
    FALSE as is_percentage,
    '2024-01-01' as effective_from,
    NULL as created_by
FROM employees e LIMIT 2;

-- =============================================
-- VIEWS FOR EASY DATA ACCESS
-- =============================================

-- View to get employee's total monthly allowances
CREATE OR REPLACE VIEW employee_monthly_allowances AS
SELECT 
    ea.client_id,
    ea.employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    SUM(CASE WHEN ea.is_percentage THEN (e.base_salary * ea.amount / 100) ELSE ea.amount END) as total_allowances,
    COUNT(ea.id) as allowance_count
FROM employee_allowances ea
JOIN employees e ON ea.employee_id = e.id
WHERE ea.is_active = 1
    AND (ea.effective_from <= CURDATE())
    AND (ea.effective_to IS NULL OR ea.effective_to >= CURDATE())
GROUP BY ea.client_id, ea.employee_id;

-- View to get employee's total monthly deductions
CREATE OR REPLACE VIEW employee_monthly_deductions AS
SELECT 
    ed.client_id,
    ed.employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    SUM(CASE WHEN ed.is_percentage THEN (e.base_salary * ed.amount / 100) ELSE ed.amount END) as total_deductions,
    COUNT(ed.id) as deduction_count
FROM employee_deductions ed
JOIN employees e ON ed.employee_id = e.id
WHERE ed.is_active = 1
    AND (ed.effective_from <= CURDATE())
    AND (ed.effective_to IS NULL OR ed.effective_to >= CURDATE())
GROUP BY ed.client_id, ed.employee_id;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Payroll performance indexes
CREATE INDEX IF NOT EXISTS idx_payroll_records_calculation ON payroll_records(calculation_status, run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status_date ON payroll_runs(run_status, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_overtime ON attendance(employee_id, date, overtime_hours);

-- =============================================
-- TRIGGERS FOR AUDIT TRAIL
-- =============================================

-- Trigger to update deduction installments
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS update_deduction_installments
    AFTER INSERT ON payroll_record_components
    FOR EACH ROW
BEGIN
    -- Decrease remaining installments for loan deductions
    IF NEW.component_type = 'deduction' AND NEW.component_code LIKE '%LOAN%' THEN
        UPDATE employee_deductions 
        SET remaining_installments = remaining_installments - 1
        WHERE employee_id = (
            SELECT pr.employee_id 
            FROM payroll_records pr 
            WHERE pr.id = NEW.record_id
        )
        AND deduction_type = 'loan_deduction'
        AND remaining_installments > 0;
        
        -- Deactivate deduction if installments are complete
        UPDATE employee_deductions 
        SET is_active = FALSE
        WHERE employee_id = (
            SELECT pr.employee_id 
            FROM payroll_records pr 
            WHERE pr.id = NEW.record_id
        )
        AND deduction_type = 'loan_deduction'
        AND remaining_installments <= 0;
    END IF;
END$$

DELIMITER ;

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

SELECT 'Payroll enhancements migration completed successfully!' as status;  