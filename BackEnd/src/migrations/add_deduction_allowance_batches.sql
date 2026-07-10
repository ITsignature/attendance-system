-- Bulk-create support for employee deductions/allowances.
-- Previously "bulk create" just looped the single-create endpoint N times, producing
-- N independent, unlinked rows. This adds a parent "batch" table per type holding the
-- shared values (one editable record), while employee_deductions/employee_allowances
-- keep one row per employee (so PayrollRunService's per-employee installment/active-flag
-- logic keeps working unchanged) tagged with the batch they belong to via batch_id.

CREATE TABLE `employee_deduction_batches` (
  `id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `deduction_type` varchar(50) NOT NULL,
  `deduction_name` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `is_percentage` tinyint(1) DEFAULT 0,
  `is_recurring` tinyint(1) DEFAULT 1,
  `remaining_installments` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_deduction_batches_client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `employee_allowance_batches` (
  `id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `allowance_type` varchar(50) NOT NULL,
  `allowance_name` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `is_percentage` tinyint(1) DEFAULT 0,
  `is_taxable` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_allowance_batches_client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `employee_deductions`
  ADD COLUMN `batch_id` varchar(36) DEFAULT NULL AFTER `client_id`,
  ADD KEY `idx_deductions_batch` (`batch_id`),
  ADD CONSTRAINT `fk_deductions_batch` FOREIGN KEY (`batch_id`) REFERENCES `employee_deduction_batches` (`id`) ON DELETE SET NULL;

ALTER TABLE `employee_allowances`
  ADD COLUMN `batch_id` varchar(36) DEFAULT NULL AFTER `client_id`,
  ADD KEY `idx_allowances_batch` (`batch_id`),
  ADD CONSTRAINT `fk_allowances_batch` FOREIGN KEY (`batch_id`) REFERENCES `employee_allowance_batches` (`id`) ON DELETE SET NULL;
