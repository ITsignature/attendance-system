-- =============================================
-- PAYROLL SYSTEM REDESIGN - INDUSTRY STANDARD SCHEMA
-- =============================================
-- This migration transforms the payroll system from individual records 
-- to industry-standard batch processing with runs and approval workflows

-- =============================================
-- 1. PAYROLL CALENDAR & PERIODS
-- =============================================
CREATE TABLE payroll_periods (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(36) NOT NULL,
    period_number INT NOT NULL,
    period_year YEAR NOT NULL,
    period_type ENUM('weekly', 'bi-weekly', 'monthly', 'quarterly') DEFAULT 'monthly',
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    cut_off_date DATE NOT NULL,
    pay_date DATE NOT NULL,
    status ENUM('active', 'closed', 'archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_period (client_id, period_year, period_number, period_type),
    INDEX idx_period_dates (period_start_date, period_end_date),
    INDEX idx_pay_date (pay_date)
);

-- =============================================
-- 2. PAYROLL RUNS (BATCH PROCESSING)
-- =============================================
CREATE TABLE payroll_runs (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(36) NOT NULL,
    run_number VARCHAR(50) NOT NULL,
    period_id VARCHAR(36) NOT NULL,
    run_name VARCHAR(100) NOT NULL,
    run_type ENUM('regular', 'bonus', 'correction', 'off-cycle') DEFAULT 'regular',
    run_status ENUM('draft', 'calculating', 'calculated', 'review', 'approved', 'processing', 'completed', 'cancelled') DEFAULT 'draft',
    
    -- Run Statistics
    total_employees INT DEFAULT 0,
    processed_employees INT DEFAULT 0,
    total_gross_amount DECIMAL(15,2) DEFAULT 0.00,
    total_deductions_amount DECIMAL(15,2) DEFAULT 0.00,
    total_net_amount DECIMAL(15,2) DEFAULT 0.00,
    
    -- Processing Info
    calculation_started_at TIMESTAMP NULL,
    calculation_completed_at TIMESTAMP NULL,
    
    -- Approval Workflow
    created_by VARCHAR(36) NOT NULL,
    reviewed_by VARCHAR(36) NULL,
    approved_by VARCHAR(36) NULL,
    processed_by VARCHAR(36) NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    approved_at TIMESTAMP NULL,
    processed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Metadata
    calculation_method ENUM('simple', 'advanced') DEFAULT 'advanced',
    notes TEXT,
    processing_errors JSON,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES admin_users(id),
    FOREIGN KEY (reviewed_by) REFERENCES admin_users(id),
    FOREIGN KEY (approved_by) REFERENCES admin_users(id),
    FOREIGN KEY (processed_by) REFERENCES admin_users(id),
    
    UNIQUE KEY unique_run_number (client_id, run_number),
    INDEX idx_run_status (run_status),
    INDEX idx_period (period_id),
    INDEX idx_created_by (created_by)
);

-- =============================================
-- 3. ENHANCED PAYROLL COMPONENTS
-- =============================================
CREATE TABLE payroll_components (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(36) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('earning', 'deduction', 'tax', 'benefit') NOT NULL,
    category VARCHAR(50) NOT NULL, -- basic_salary, overtime, allowance, tax_income, tax_payroll, insurance, etc.
    calculation_method ENUM('fixed', 'percentage', 'formula', 'imported') DEFAULT 'fixed',
    calculation_base VARCHAR(50) NULL, -- what to calculate percentage from
    default_value DECIMAL(10,4) DEFAULT 0.0000,
    is_taxable BOOLEAN DEFAULT TRUE,
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_component_code (client_id, code),
    INDEX idx_type_category (type, category)
);

-- Insert default payroll components for new system
INSERT INTO payroll_components (id, client_id, code, name, type, category, calculation_method, is_taxable, is_mandatory, display_order) VALUES
-- EARNINGS
(UUID(), 'DEFAULT', 'BASIC_SAL', 'Basic Salary', 'earning', 'basic_salary', 'fixed', TRUE, TRUE, 1),
(UUID(), 'DEFAULT', 'OT_REGULAR', 'Regular Overtime', 'earning', 'overtime', 'formula', TRUE, FALSE, 2),
(UUID(), 'DEFAULT', 'OT_HOLIDAY', 'Holiday Overtime', 'earning', 'overtime', 'formula', TRUE, FALSE, 3),
(UUID(), 'DEFAULT', 'TRANSPORT', 'Transport Allowance', 'earning', 'allowance', 'fixed', FALSE, FALSE, 4),
(UUID(), 'DEFAULT', 'MEDICAL', 'Medical Allowance', 'earning', 'allowance', 'fixed', FALSE, FALSE, 5),
(UUID(), 'DEFAULT', 'BONUS', 'Performance Bonus', 'earning', 'bonus', 'fixed', TRUE, FALSE, 6),

-- TAXES
(UUID(), 'DEFAULT', 'INCOME_TAX', 'Income Tax', 'tax', 'tax_income', 'formula', FALSE, TRUE, 10),
(UUID(), 'DEFAULT', 'PAYROLL_TAX', 'Payroll Tax', 'tax', 'tax_payroll', 'percentage', FALSE, TRUE, 11),

-- DEDUCTIONS
(UUID(), 'DEFAULT', 'EPF', 'Employee Provident Fund', 'deduction', 'retirement', 'percentage', FALSE, TRUE, 15),
(UUID(), 'DEFAULT', 'HEALTH_INS', 'Health Insurance', 'deduction', 'insurance', 'fixed', FALSE, FALSE, 16),
(UUID(), 'DEFAULT', 'LOAN_DED', 'Loan Deduction', 'deduction', 'loan', 'fixed', FALSE, FALSE, 17);

-- =============================================
-- 4. REDESIGNED PAYROLL RECORDS (Run-based)
-- =============================================
-- Rename existing table and create new structure
RENAME TABLE payroll_records TO payroll_records_old;

CREATE TABLE payroll_records (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36) NOT NULL,
    
    -- Employee Info (denormalized for performance)
    employee_code VARCHAR(50) NOT NULL,
    employee_name VARCHAR(200) NOT NULL,
    department_name VARCHAR(100),
    designation_name VARCHAR(100),
    
    -- Calculation Status
    calculation_status ENUM('pending', 'calculating', 'calculated', 'error', 'excluded') DEFAULT 'pending',
    calculation_errors JSON,
    
    -- Time Data
    worked_days DECIMAL(5,2) DEFAULT 0.00,
    worked_hours DECIMAL(8,2) DEFAULT 0.00,
    overtime_hours DECIMAL(8,2) DEFAULT 0.00,
    leave_days DECIMAL(5,2) DEFAULT 0.00,
    
    -- Calculated Amounts (summary)
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    total_deductions DECIMAL(12,2) DEFAULT 0.00,
    total_taxes DECIMAL(12,2) DEFAULT 0.00,
    total_benefits DECIMAL(12,2) DEFAULT 0.00,
    gross_salary DECIMAL(12,2) DEFAULT 0.00,
    taxable_income DECIMAL(12,2) DEFAULT 0.00,
    net_salary DECIMAL(12,2) DEFAULT 0.00,
    
    -- Payment Information
    payment_status ENUM('pending', 'paid', 'failed', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('bank_transfer', 'cash', 'cheque') DEFAULT 'bank_transfer',
    payment_date DATE NULL,
    payment_reference VARCHAR(100),
    
    -- Approval Status
    approved_by VARCHAR(36) NULL,
    approved_at TIMESTAMP NULL,
    
    -- Timestamps
    calculated_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Notes
    notes TEXT,
    
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES admin_users(id),
    
    UNIQUE KEY unique_run_employee (run_id, employee_id),
    INDEX idx_calculation_status (calculation_status),
    INDEX idx_payment_status (payment_status),
    INDEX idx_employee (employee_id)
);

-- =============================================
-- 5. PAYROLL RECORD COMPONENTS (Detailed breakdown)
-- =============================================
CREATE TABLE payroll_record_components (
    id VARCHAR(36) PRIMARY KEY,
    record_id VARCHAR(36) NOT NULL,
    component_id VARCHAR(36) NOT NULL,
    
    -- Component Info (denormalized)
    component_code VARCHAR(20) NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    component_type ENUM('earning', 'deduction', 'tax', 'benefit') NOT NULL,
    component_category VARCHAR(50) NOT NULL,
    
    -- Calculation Details
    calculation_method VARCHAR(20) NOT NULL,
    base_amount DECIMAL(12,2) DEFAULT 0.00,
    rate DECIMAL(10,4) DEFAULT 0.0000,
    quantity DECIMAL(10,2) DEFAULT 1.00,
    calculated_amount DECIMAL(12,2) NOT NULL,
    
    -- Override Information
    is_overridden BOOLEAN DEFAULT FALSE,
    original_amount DECIMAL(12,2) NULL,
    override_reason VARCHAR(255),
    overridden_by VARCHAR(36) NULL,
    overridden_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (record_id) REFERENCES payroll_records(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES payroll_components(id) ON DELETE RESTRICT,
    FOREIGN KEY (overridden_by) REFERENCES admin_users(id),
    
    UNIQUE KEY unique_record_component (record_id, component_id),
    INDEX idx_component_type (component_type),
    INDEX idx_component_category (component_category)
);

-- =============================================
-- 6. APPROVAL WORKFLOW TRACKING
-- =============================================
CREATE TABLE payroll_approvals (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    approval_level ENUM('review', 'approve', 'process') NOT NULL,
    approver_id VARCHAR(36) NOT NULL,
    approval_status ENUM('pending', 'approved', 'rejected') NOT NULL,
    approval_date TIMESTAMP NOT NULL,
    comments TEXT,
    
    -- Previous/Next approvers for workflow
    previous_approval_id VARCHAR(36) NULL,
    next_approval_id VARCHAR(36) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES admin_users(id),
    FOREIGN KEY (previous_approval_id) REFERENCES payroll_approvals(id),
    FOREIGN KEY (next_approval_id) REFERENCES payroll_approvals(id),
    
    INDEX idx_run_level (run_id, approval_level),
    INDEX idx_approver (approver_id),
    INDEX idx_status (approval_status)
);

-- =============================================
-- 7. AUDIT & COMPLIANCE TRACKING
-- =============================================
CREATE TABLE payroll_audit_log (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    record_id VARCHAR(36) NULL,
    action ENUM('create', 'calculate', 'modify', 'approve', 'reject', 'process', 'cancel') NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- What changed
    field_name VARCHAR(100) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (record_id) REFERENCES payroll_records(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES admin_users(id),
    
    INDEX idx_run_action (run_id, action),
    INDEX idx_user_action (user_id, action),
    INDEX idx_created_at (created_at)
);

-- =============================================
-- 8. PAYROLL REPORTS & EXPORTS
-- =============================================
CREATE TABLE payroll_reports (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    report_type ENUM('payroll_register', 'tax_report', 'bank_file', 'compliance_report', 'summary_report') NOT NULL,
    report_format ENUM('pdf', 'excel', 'csv', 'xml', 'json') NOT NULL,
    report_name VARCHAR(200) NOT NULL,
    
    -- Report Data
    file_path VARCHAR(500),
    file_size BIGINT,
    report_data JSON,
    
    -- Generation Info
    generated_by VARCHAR(36) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parameters JSON,
    
    -- Access Control
    is_confidential BOOLEAN DEFAULT TRUE,
    access_level ENUM('public', 'internal', 'restricted', 'confidential') DEFAULT 'confidential',
    
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES admin_users(id),
    
    INDEX idx_run_type (run_id, report_type),
    INDEX idx_generated_at (generated_at)
);

-- =============================================
-- DATA MIGRATION PREPARATION
-- =============================================
-- Create temporary migration tracking
CREATE TABLE migration_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(100) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    records_processed INT DEFAULT 0,
    total_records INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL
);

-- Log this migration
INSERT INTO migration_log (migration_name, status, started_at) 
VALUES ('payroll_redesign_schema', 'completed', NOW());