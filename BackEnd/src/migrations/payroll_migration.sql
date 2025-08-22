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
-- Grant Permissions (adjust as needed)
-- =============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.payroll_records TO 'hrms_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.employee_loans TO 'hrms_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.payroll_components TO 'hrms_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hrms_system.payroll_schedules TO 'hrms_app'@'localhost';
-- GRANT EXECUTE ON PROCEDURE hrms_system.sp_process_employee_payroll TO 'hrms_app'@'localhost';
-- GRANT EXECUTE ON PROCEDURE hrms_system.sp_get_payroll_summary TO 'hrms_app'@'localhost';