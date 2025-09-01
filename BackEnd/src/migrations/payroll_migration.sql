-- =============================================
-- PAYROLL MODULE DATABASE MIGRATION
-- =============================================

-- Note: This migration adds missing payroll-related tables
-- that may not be in your current schema

-- =============================================
-- Employee Loans Table (for loan deductions)
-- =============================================
CREATE TABLE IF NOT EXISTS `employee_loans` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `loan_type` enum('personal','advance','emergency','housing','education') DEFAULT 'personal',
  `loan_amount` decimal(15,2) NOT NULL,
  `interest_rate` decimal(5,2) DEFAULT 0.00,
  `tenure_months` int(11) NOT NULL,
  `monthly_deduction` decimal(15,2) NOT NULL,
  `total_paid` decimal(15,2) DEFAULT 0.00,
  `remaining_amount` decimal(15,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('active','completed','defaulted','cancelled') DEFAULT 'active',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_employee_loans_employee` (`employee_id`),
  KEY `idx_employee_loans_status` (`status`),
  KEY `idx_employee_loans_dates` (`start_date`, `end_date`),
  CONSTRAINT `fk_employee_loans_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_employee_loans_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- Payroll Schedules Table (for automated processing)
-- =============================================
CREATE TABLE IF NOT EXISTS `payroll_schedules` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `schedule_name` varchar(100) NOT NULL,
  `frequency` enum('weekly','bi-weekly','monthly','quarterly') DEFAULT 'monthly',
  `day_of_month` int(11) DEFAULT NULL COMMENT 'Day of month for monthly frequency',
  `day_of_week` int(11) DEFAULT NULL COMMENT 'Day of week for weekly frequency (0-6)',
  `processing_time` time DEFAULT '09:00:00',
  `default_values` longtext DEFAULT NULL CHECK (json_valid(`default_values`)),
  `is_active` tinyint(1) DEFAULT 1,
  `last_processed_date` date DEFAULT NULL,
  `last_result` longtext DEFAULT NULL CHECK (json_valid(`last_result`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_schedules_client` (`client_id`),
  KEY `idx_payroll_schedules_active` (`is_active`),
  CONSTRAINT `fk_payroll_schedules_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- Payroll Components Table (for configurable salary components)
-- =============================================
CREATE TABLE IF NOT EXISTS `payroll_components` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `component_name` varchar(100) NOT NULL,
  `component_type` enum('earning','deduction') NOT NULL,
  `category` enum('basic','allowance','bonus','tax','insurance','loan','other') NOT NULL,
  `calculation_type` enum('fixed','percentage','formula') DEFAULT 'fixed',
  `calculation_value` decimal(15,2) DEFAULT NULL,
  `calculation_formula` text DEFAULT NULL,
  `is_taxable` tinyint(1) DEFAULT 1,
  `is_mandatory` tinyint(1) DEFAULT 0,
  `applies_to` enum('all','department','designation','individual') DEFAULT 'all',
  `applies_to_ids` longtext DEFAULT NULL CHECK (json_valid(`applies_to_ids`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_components_client` (`client_id`),
  KEY `idx_payroll_components_type` (`component_type`),
  CONSTRAINT `fk_payroll_components_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- Employee Payroll Components (assignment of components to employees)
-- =============================================
CREATE TABLE IF NOT EXISTS `employee_payroll_components` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `component_id` varchar(36) NOT NULL,
  `custom_value` decimal(15,2) DEFAULT NULL COMMENT 'Override component default value',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_employee_component` (`employee_id`, `component_id`, `effective_from`),
  KEY `idx_emp_payroll_comp_employee` (`employee_id`),
  KEY `idx_emp_payroll_comp_component` (`component_id`),
  KEY `idx_emp_payroll_comp_dates` (`effective_from`, `effective_to`),
  CONSTRAINT `fk_emp_payroll_comp_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_emp_payroll_comp_component` FOREIGN KEY (`component_id`) REFERENCES `payroll_components` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- Payroll Tax Slabs (for progressive tax calculation)
-- =============================================
CREATE TABLE IF NOT EXISTS `payroll_tax_slabs` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `slab_name` varchar(100) NOT NULL,
  `min_amount` decimal(15,2) NOT NULL,
  `max_amount` decimal(15,2) DEFAULT NULL,
  `tax_rate` decimal(5,4) NOT NULL COMMENT 'Tax rate as decimal (e.g., 0.15 for 15%)',
  `fixed_amount` decimal(15,2) DEFAULT 0.00 COMMENT 'Fixed tax amount for this slab',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tax_slabs_client` (`client_id`),
  KEY `idx_tax_slabs_amounts` (`min_amount`, `max_amount`),
  KEY `idx_tax_slabs_dates` (`effective_from`, `effective_to`),
  CONSTRAINT `fk_tax_slabs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- Payroll Adjustments (for one-time adjustments)
-- =============================================
CREATE TABLE IF NOT EXISTS `payroll_adjustments` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `payroll_record_id` varchar(36) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `adjustment_type` enum('addition','deduction') NOT NULL,
  `adjustment_reason` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `applicable_month` date NOT NULL,
  `is_processed` tinyint(1) DEFAULT 0,
  `processed_at` timestamp NULL DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_adj_employee` (`employee_id`),
  KEY `idx_payroll_adj_month` (`applicable_month`),
  KEY `idx_payroll_adj_processed` (`is_processed`),
  CONSTRAINT `fk_payroll_adj_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_adj_record` FOREIGN KEY (`payroll_record_id`) REFERENCES `payroll_records` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payroll_adj_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payroll_adj_creator` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- Add missing columns to employees table (if not exists)
-- =============================================
ALTER TABLE `employees` 
  ADD COLUMN IF NOT EXISTS `base_salary` decimal(15,2) DEFAULT 0.00 AFTER `employment_status`,
  ADD COLUMN IF NOT EXISTS `bank_account_number` varchar(50) DEFAULT NULL AFTER `base_salary`,
  ADD COLUMN IF NOT EXISTS `bank_name` varchar(100) DEFAULT NULL AFTER `bank_account_number`,
  ADD COLUMN IF NOT EXISTS `bank_branch` varchar(100) DEFAULT NULL AFTER `bank_name`,
  ADD COLUMN IF NOT EXISTS `bank_routing_number` varchar(50) DEFAULT NULL AFTER `bank_branch`,
  ADD COLUMN IF NOT EXISTS `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer' AFTER `bank_routing_number`;

-- =============================================
-- Add indexes for better performance
-- =============================================
ALTER TABLE `payroll_records`
  ADD INDEX IF NOT EXISTS `idx_payroll_payment_status` (`payment_status`),
  ADD INDEX IF NOT EXISTS `idx_payroll_payment_date` (`payment_date`),
  ADD INDEX IF NOT EXISTS `idx_payroll_period` (`pay_period_start`, `pay_period_end`),
  ADD INDEX IF NOT EXISTS `idx_payroll_employee_period` (`employee_id`, `pay_period_start`, `pay_period_end`);

-- =============================================
-- Create Views for Reporting
-- =============================================

-- View for current month payroll summary
CREATE OR REPLACE VIEW `v_current_month_payroll` AS
SELECT 
  pr.id,
  pr.employee_id,
  CONCAT(e.first_name, ' ', e.last_name) as employee_name,
  e.employee_code,
  d.name as department,
  des.title as designation,
  pr.gross_salary,
  pr.total_deductions,
  pr.net_salary,
  pr.payment_status,
  pr.payment_date,
  e.client_id
FROM payroll_records pr
JOIN employees e ON pr.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
WHERE YEAR(pr.pay_period_start) = YEAR(CURDATE())
  AND MONTH(pr.pay_period_start) = MONTH(CURDATE());

-- View for payroll statistics by department
CREATE OR REPLACE VIEW `v_payroll_stats_by_department` AS
SELECT 
  e.client_id,
  d.id as department_id,
  d.name as department_name,
  COUNT(DISTINCT pr.employee_id) as employee_count,
  AVG(pr.base_salary) as avg_base_salary,
  AVG(pr.gross_salary) as avg_gross_salary,
  AVG(pr.net_salary) as avg_net_salary,
  SUM(pr.net_salary) as total_net_salary,
  YEAR(pr.pay_period_start) as year,
  MONTH(pr.pay_period_start) as month
FROM payroll_records pr
JOIN employees e ON pr.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
GROUP BY e.client_id, d.id, d.name, YEAR(pr.pay_period_start), MONTH(pr.pay_period_start);

-- =============================================
-- Sample Data for Testing (Optional)
-- =============================================

-- Insert sample payroll components
INSERT IGNORE INTO `payroll_components` (`id`, `client_id`, `component_name`, `component_type`, `category`, `calculation_type`, `calculation_value`, `is_taxable`, `is_mandatory`) VALUES
(uuid(), (SELECT id FROM clients LIMIT 1), 'House Rent Allowance', 'earning', 'allowance', 'percentage', 40.00, 0, 0),
(uuid(), (SELECT id FROM clients LIMIT 1), 'Transport Allowance', 'earning', 'allowance', 'fixed', 5000.00, 1, 0),
(uuid(), (SELECT id FROM clients LIMIT 1), 'Medical Allowance', 'earning', 'allowance', 'fixed', 3000.00, 0, 0),
(uuid(), (SELECT id FROM clients LIMIT 1), 'Income Tax', 'deduction', 'tax', 'percentage', 15.00, 0, 1),
(uuid(), (SELECT id FROM clients LIMIT 1), 'Employee Provident Fund', 'deduction', 'other', 'percentage', 8.00, 0, 1),
(uuid(), (SELECT id FROM clients LIMIT 1), 'Health Insurance', 'deduction', 'insurance', 'fixed', 2000.00, 0, 0);

-- =============================================
-- Stored Procedures for Common Operations
-- =============================================

DELIMITER $$

-- Procedure to calculate and process payroll for an employee
CREATE PROCEDURE IF NOT EXISTS `sp_process_employee_payroll`(
  IN p_employee_id VARCHAR(36),
  IN p_pay_period_start DATE,
  IN p_pay_period_end DATE,
  IN p_processed_by VARCHAR(36)
)
BEGIN
  DECLARE v_base_salary DECIMAL(15,2);
  DECLARE v_total_earnings DECIMAL(15,2) DEFAULT 0;
  DECLARE v_total_deductions DECIMAL(15,2) DEFAULT 0;
  DECLARE v_gross_salary DECIMAL(15,2);
  DECLARE v_net_salary DECIMAL(15,2);
  
  -- Get base salary
  SELECT base_salary INTO v_base_salary
  FROM employees
  WHERE id = p_employee_id;
  
  -- Calculate earnings (simplified)
  SET v_total_earnings = v_base_salary;
  
  -- Calculate deductions (simplified - 15% tax + 8% PF)
  SET v_total_deductions = v_base_salary * 0.23;
  
  -- Calculate gross and net
  SET v_gross_salary = v_total_earnings;
  SET v_net_salary = v_gross_salary - v_total_deductions;
  
  -- Insert payroll record
  INSERT INTO payroll_records (
    id, employee_id, pay_period_start, pay_period_end,
    base_salary, gross_salary, total_deductions, net_salary,
    payment_status, processed_by, processed_at
  ) VALUES (
    uuid(), p_employee_id, p_pay_period_start, p_pay_period_end,
    v_base_salary, v_gross_salary, v_total_deductions, v_net_salary,
    'pending', p_processed_by, NOW()
  );
END$

-- Procedure to get payroll summary for a client
CREATE PROCEDURE IF NOT EXISTS `sp_get_payroll_summary`(
  IN p_client_id VARCHAR(36),
  IN p_year INT,
  IN p_month INT
)
BEGIN
  SELECT 
    COUNT(DISTINCT pr.employee_id) as total_employees,
    SUM(pr.gross_salary) as total_gross,
    SUM(pr.total_deductions) as total_deductions,
    SUM(pr.net_salary) as total_net,
    AVG(pr.net_salary) as average_net,
    COUNT(CASE WHEN pr.payment_status = 'paid' THEN 1 END) as paid_count,
    COUNT(CASE WHEN pr.payment_status = 'pending' THEN 1 END) as pending_count
  FROM payroll_records pr
  JOIN employees e ON pr.employee_id = e.id
  WHERE e.client_id = p_client_id
    AND YEAR(pr.pay_period_start) = p_year
    AND MONTH(pr.pay_period_start) = p_month;
END$

DELIMITER ;

-- =============================================
-- Triggers for Audit and Validation
-- =============================================

DELIMITER $

-- Trigger to validate payroll record before insert
CREATE TRIGGER IF NOT EXISTS `trg_payroll_before_insert`
BEFORE INSERT ON `payroll_records`
FOR EACH ROW
BEGIN
  -- Ensure net salary is not negative
  IF NEW.net_salary < 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Net salary cannot be negative';
  END IF;
  
  -- Ensure dates are valid
  IF NEW.pay_period_end <= NEW.pay_period_start THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Pay period end date must be after start date';
  END IF;
END$

-- Trigger to update employee loan balance after payroll processing
CREATE TRIGGER IF NOT EXISTS `trg_payroll_after_update`
AFTER UPDATE ON `payroll_records`
FOR EACH ROW
BEGIN
  -- If payment status changed to 'paid', update loan balances
  IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
    UPDATE employee_loans 
    SET 
      total_paid = total_paid + NEW.loan_deduction,
      remaining_amount = remaining_amount - NEW.loan_deduction,
      status = CASE 
        WHEN remaining_amount - NEW.loan_deduction <= 0 THEN 'completed'
        ELSE status 
      END
    WHERE employee_id = NEW.employee_id 
      AND status = 'active';
  END IF;
END$

DELIMITER ;

-- =============================================
-- INDUSTRY STANDARD PAYROLL RUN TABLES
-- =============================================

-- Payroll Periods Table (required for payroll runs)
CREATE TABLE IF NOT EXISTS `payroll_periods` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `client_id` varchar(36) NOT NULL,
  `period_number` int NOT NULL,
  `period_year` year NOT NULL,
  `period_type` enum('weekly','bi-weekly','monthly','quarterly') DEFAULT 'monthly',
  `period_start_date` date NOT NULL,
  `period_end_date` date NOT NULL,
  `cut_off_date` date NOT NULL,
  `pay_date` date NOT NULL,
  `status` enum('active','closed','archived') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period` (`client_id`,`period_year`,`period_number`,`period_type`),
  KEY `idx_period_dates` (`period_start_date`,`period_end_date`),
  KEY `idx_pay_date` (`pay_date`),
  CONSTRAINT `fk_payroll_periods_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Payroll Runs Table (batch processing)
CREATE TABLE IF NOT EXISTS `payroll_runs` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `client_id` varchar(36) NOT NULL,
  `run_number` varchar(50) NOT NULL,
  `period_id` varchar(36) NOT NULL,
  `run_name` varchar(100) NOT NULL,
  `run_type` enum('regular','bonus','correction','off-cycle') DEFAULT 'regular',
  `run_status` enum('draft','calculating','calculated','review','approved','processing','completed','cancelled') DEFAULT 'draft',
  `total_employees` int DEFAULT 0,
  `processed_employees` int DEFAULT 0,
  `total_gross_amount` decimal(15,2) DEFAULT 0.00,
  `total_deductions_amount` decimal(15,2) DEFAULT 0.00,
  `total_net_amount` decimal(15,2) DEFAULT 0.00,
  `calculation_started_at` timestamp NULL DEFAULT NULL,
  `calculation_completed_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `reviewed_by` varchar(36) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `processed_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `calculation_method` enum('simple','advanced') DEFAULT 'advanced',
  `notes` text,
  `processing_errors` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_run_number` (`client_id`,`run_number`),
  KEY `idx_run_status` (`run_status`),
  KEY `idx_period` (`period_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_payroll_runs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_runs_period` FOREIGN KEY (`period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_payroll_runs_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`),
  CONSTRAINT `fk_payroll_runs_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `admin_users` (`id`),
  CONSTRAINT `fk_payroll_runs_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`),
  CONSTRAINT `fk_payroll_runs_processed_by` FOREIGN KEY (`processed_by`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Approval Workflows Table  
CREATE TABLE IF NOT EXISTS `approval_workflows` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `run_id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `status` enum('active','completed','rejected') DEFAULT 'active',
  `current_level` int DEFAULT 1,
  `total_levels` int DEFAULT 3,
  `initiated_by` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_run_id` (`run_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_approval_workflows_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_approval_workflows_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_approval_workflows_initiator` FOREIGN KEY (`initiated_by`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Approval Steps Table
CREATE TABLE IF NOT EXISTS `approval_steps` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `workflow_id` varchar(36) NOT NULL,
  `step_level` int NOT NULL,
  `step_name` varchar(50) NOT NULL,
  `step_title` varchar(100) NOT NULL,
  `required_role` varchar(100) NOT NULL,
  `status` enum('pending','active','approved','rejected') DEFAULT 'pending',
  `timeout_hours` int DEFAULT 24,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_id` (`workflow_id`),
  KEY `idx_status` (`status`),
  KEY `idx_step_level` (`step_level`),
  CONSTRAINT `fk_approval_steps_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_approval_steps_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Enhanced Payroll Approvals Table
CREATE TABLE IF NOT EXISTS `payroll_approvals` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `run_id` varchar(36) NOT NULL,
  `approval_level` varchar(50) NOT NULL,
  `approver_id` varchar(36) NOT NULL,
  `approval_status` enum('pending','approved','rejected') NOT NULL,
  `approval_date` timestamp NOT NULL,
  `comments` text,
  PRIMARY KEY (`id`),
  KEY `idx_run_level` (`run_id`,`approval_level`),
  KEY `idx_approver` (`approver_id`),
  KEY `idx_status` (`approval_status`),
  CONSTRAINT `fk_payroll_approvals_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_approvals_approver` FOREIGN KEY (`approver_id`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Payroll Audit Log Table
CREATE TABLE IF NOT EXISTS `payroll_audit_log` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `run_id` varchar(36) NOT NULL,
  `action` varchar(50) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `new_value` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_run_action` (`run_id`,`action`),
  KEY `idx_user_action` (`user_id`,`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_payroll_audit_log_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_audit_log_user` FOREIGN KEY (`user_id`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create new payroll records table for the run-based system
-- (Rename existing table first if it exists)
RENAME TABLE payroll_records TO payroll_records_old_backup;

CREATE TABLE IF NOT EXISTS `payroll_records` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `run_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_code` varchar(50) NOT NULL,
  `employee_name` varchar(200) NOT NULL,
  `department_name` varchar(100) DEFAULT NULL,
  `designation_name` varchar(100) DEFAULT NULL,
  `calculation_status` enum('pending','calculating','calculated','error','excluded') DEFAULT 'pending',
  `calculation_errors` json DEFAULT NULL,
  `worked_days` decimal(5,2) DEFAULT 0.00,
  `worked_hours` decimal(8,2) DEFAULT 0.00,
  `overtime_hours` decimal(8,2) DEFAULT 0.00,
  `leave_days` decimal(5,2) DEFAULT 0.00,
  `total_earnings` decimal(12,2) DEFAULT 0.00,
  `total_deductions` decimal(12,2) DEFAULT 0.00,
  `total_taxes` decimal(12,2) DEFAULT 0.00,
  `total_benefits` decimal(12,2) DEFAULT 0.00,
  `gross_salary` decimal(12,2) DEFAULT 0.00,
  `taxable_income` decimal(12,2) DEFAULT 0.00,
  `net_salary` decimal(12,2) DEFAULT 0.00,
  `payment_status` enum('pending','paid','failed','cancelled') DEFAULT 'pending',
  `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
  `payment_date` date DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `calculated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `notes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_run_employee` (`run_id`,`employee_id`),
  KEY `idx_calculation_status` (`calculation_status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_employee` (`employee_id`),
  CONSTRAINT `fk_payroll_records_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_records_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_records_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create payroll record components table
CREATE TABLE IF NOT EXISTS `payroll_record_components` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `record_id` varchar(36) NOT NULL,
  `component_id` varchar(36) DEFAULT NULL,
  `component_code` varchar(20) NOT NULL,
  `component_name` varchar(100) NOT NULL,
  `component_type` enum('earning','deduction','tax','benefit') NOT NULL,
  `component_category` varchar(50) NOT NULL,
  `calculation_method` varchar(20) NOT NULL,
  `base_amount` decimal(12,2) DEFAULT 0.00,
  `rate` decimal(10,4) DEFAULT 0.0000,
  `quantity` decimal(10,2) DEFAULT 1.00,
  `calculated_amount` decimal(12,2) NOT NULL,
  `is_overridden` tinyint(1) DEFAULT 0,
  `original_amount` decimal(12,2) DEFAULT NULL,
  `override_reason` varchar(255) DEFAULT NULL,
  `overridden_by` varchar(36) DEFAULT NULL,
  `overridden_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_record_id` (`record_id`),
  KEY `idx_component_type` (`component_type`),
  KEY `idx_component_category` (`component_category`),
  CONSTRAINT `fk_payroll_record_components_record` FOREIGN KEY (`record_id`) REFERENCES `payroll_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payroll_record_components_overridden_by` FOREIGN KEY (`overridden_by`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert sample payroll periods for testing
INSERT IGNORE INTO `payroll_periods` (`id`, `client_id`, `period_number`, `period_year`, `period_start_date`, `period_end_date`, `cut_off_date`, `pay_date`) 
SELECT 
    UUID() as id,
    c.id as client_id,
    MONTH(CURDATE()) as period_number,
    YEAR(CURDATE()) as period_year,
    DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE()) - 1 DAY) as period_start_date,
    LAST_DAY(CURDATE()) as period_end_date,
    DATE_SUB(LAST_DAY(CURDATE()), INTERVAL 5 DAY) as cut_off_date,
    DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 5 DAY) as pay_date
FROM clients c 
WHERE c.is_active = 1;

-- =============================================
-- Grant Permissions (adjust as needed)
-- =============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.payroll_records TO 'hrms_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.employee_loans TO 'hrms_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.payroll_components TO 'hrms_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.payroll_schedules TO 'hrms_app'@'localhost';
-- GRANT EXECUTE ON PROCEDURE hrms_system.sp_process_employee_payroll TO 'hrms_app'@'localhost';
-- GRANT EXECUTE ON PROCEDURE hrms_system.sp_get_payroll_summary TO 'hrms_app'@'localhost';
