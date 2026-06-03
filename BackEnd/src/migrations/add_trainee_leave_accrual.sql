-- Migration: Add Trainee Leave Accrual System
-- Run this migration before starting the application with the new feature.

-- 1. Add 'trainee' to employees.employee_type enum
ALTER TABLE employees
  MODIFY COLUMN employee_type
    ENUM('permanent','contract','intern','consultant','trainee')
    DEFAULT 'permanent';

-- 2. Add accrual columns to leave_types
ALTER TABLE leave_types
  ADD COLUMN is_trainee_only   TINYINT(1)   NOT NULL DEFAULT 0    AFTER notice_period_days,
  ADD COLUMN accrual_per_month DECIMAL(4,2) NOT NULL DEFAULT 0.00 AFTER is_trainee_only;

ALTER TABLE leave_types
  ADD INDEX idx_leave_types_trainee (is_trainee_only);

-- 3. Create accrual balances table
CREATE TABLE IF NOT EXISTS leave_accrual_balances (
  id                  VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  employee_id         VARCHAR(36)   NOT NULL,
  leave_type_id       VARCHAR(36)   NOT NULL,
  cumulative_accrued  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cumulative_used     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  available_balance   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  last_accrual_month  DATE          DEFAULT NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emp_leave_type (employee_id, leave_type_id),
  KEY idx_accrual_employee   (employee_id),
  KEY idx_accrual_leave_type (leave_type_id),
  CONSTRAINT fk_accrual_employee
    FOREIGN KEY (employee_id)   REFERENCES employees(id)   ON DELETE CASCADE,
  CONSTRAINT fk_accrual_leave_type
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
