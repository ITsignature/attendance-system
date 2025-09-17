-- =============================================
-- EMPLOYEE BONUSES TABLE
-- =============================================
-- Dedicated table for bonus management separate from payroll

CREATE TABLE IF NOT EXISTS `employee_bonuses` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `employee_id` varchar(36) NOT NULL,
  `bonus_type` enum('performance','annual','quarterly','project','spot','retention','referral') DEFAULT 'performance',
  `bonus_amount` decimal(15,2) NOT NULL,
  `description` varchar(255) NOT NULL,
  `bonus_period` varchar(50) DEFAULT NULL COMMENT 'E.g., Q1 2024, Annual 2024',
  `calculation_basis` text DEFAULT NULL COMMENT 'How bonus was calculated',
  `effective_date` date NOT NULL DEFAULT (curdate()),
  `payment_date` date DEFAULT NULL,
  `status` enum('pending','approved','paid','cancelled','rejected') DEFAULT 'pending',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `processed_by` varchar(36) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `payment_method` enum('salary_addition','separate_payment','next_payroll') DEFAULT 'next_payroll',
  `payment_reference` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),

  PRIMARY KEY (`id`),
  KEY `idx_employee_bonuses_employee` (`employee_id`),
  KEY `idx_employee_bonuses_status` (`status`),
  KEY `idx_employee_bonuses_type` (`bonus_type`),
  KEY `idx_employee_bonuses_dates` (`effective_date`, `payment_date`),
  KEY `idx_employee_bonuses_period` (`bonus_period`),

  CONSTRAINT `fk_employee_bonuses_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_employee_bonuses_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employee_bonuses_processor` FOREIGN KEY (`processed_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employee_bonuses_creator` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- ADVANCE PAYMENTS TABLE (Separate from loans)
-- =============================================
-- Dedicated table for advance payments

CREATE TABLE IF NOT EXISTS `employee_advances` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `employee_id` varchar(36) NOT NULL,
  `advance_type` enum('salary','emergency','travel','medical','educational') DEFAULT 'salary',
  `advance_amount` decimal(15,2) NOT NULL,
  `description` varchar(255) NOT NULL,
  `request_date` date NOT NULL DEFAULT (curdate()),
  `required_date` date DEFAULT NULL COMMENT 'When employee needs the money',
  `deduction_start_date` date DEFAULT NULL COMMENT 'When to start salary deductions',
  `deduction_months` int(11) DEFAULT 1 COMMENT 'Over how many months to deduct',
  `monthly_deduction` decimal(15,2) DEFAULT NULL,
  `total_deducted` decimal(15,2) DEFAULT 0.00,
  `remaining_amount` decimal(15,2) DEFAULT NULL,
  `status` enum('pending','approved','paid','completed','cancelled','rejected') DEFAULT 'pending',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `paid_by` varchar(36) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
  `payment_reference` varchar(100) DEFAULT NULL,
  `justification` text DEFAULT NULL COMMENT 'Reason for advance request',
  `attachments` json DEFAULT NULL COMMENT 'Supporting documents',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),

  PRIMARY KEY (`id`),
  KEY `idx_employee_advances_employee` (`employee_id`),
  KEY `idx_employee_advances_status` (`status`),
  KEY `idx_employee_advances_type` (`advance_type`),
  KEY `idx_employee_advances_dates` (`request_date`, `required_date`),

  CONSTRAINT `fk_employee_advances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_employee_advances_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employee_advances_payer` FOREIGN KEY (`paid_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employee_advances_creator` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Additional indexes for common queries
CREATE INDEX idx_bonuses_employee_status ON employee_bonuses(employee_id, status);
CREATE INDEX idx_bonuses_type_period ON employee_bonuses(bonus_type, bonus_period);
CREATE INDEX idx_advances_employee_status ON employee_advances(employee_id, status);
CREATE INDEX idx_advances_deduction_date ON employee_advances(deduction_start_date, status);

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Sample bonus types for reference
INSERT IGNORE INTO employee_bonuses (id, employee_id, bonus_type, bonus_amount, description, bonus_period, status, created_by, notes) VALUES
('sample-bonus-1', 'sample-emp-1', 'performance', 15000.00, 'Q4 Performance Bonus', 'Q4 2024', 'pending', 'admin-user-1', 'Excellent performance rating'),
('sample-bonus-2', 'sample-emp-2', 'annual', 25000.00, 'Annual Bonus 2024', 'Annual 2024', 'approved', 'admin-user-1', 'Company-wide annual bonus');

-- Sample advance types for reference
INSERT IGNORE INTO employee_advances (id, employee_id, advance_type, advance_amount, description, deduction_months, monthly_deduction, status, justification) VALUES
('sample-advance-1', 'sample-emp-1', 'emergency', 50000.00, 'Medical Emergency Advance', 3, 16666.67, 'pending', 'Family medical emergency requiring immediate funds'),
('sample-advance-2', 'sample-emp-2', 'salary', 75000.00, 'Salary Advance', 2, 37500.00, 'approved', 'Personal financial requirement');