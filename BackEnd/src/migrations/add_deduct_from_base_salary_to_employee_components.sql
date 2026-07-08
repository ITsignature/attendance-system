-- Adds the same "Deduct from Base Salary" toggle that payroll_components already has
-- to employee-specific deductions/allowances (and their bulk batches), so a percentage-based
-- entry can be calculated on fixed base salary (e.g. EPF-style) instead of gross salary.

ALTER TABLE `employee_deductions`
  ADD COLUMN `deduct_from_base_salary` tinyint(1) DEFAULT 0 AFTER `is_percentage`;

ALTER TABLE `employee_deduction_batches`
  ADD COLUMN `deduct_from_base_salary` tinyint(1) DEFAULT 0 AFTER `is_percentage`;

ALTER TABLE `employee_allowances`
  ADD COLUMN `deduct_from_base_salary` tinyint(1) DEFAULT 0 AFTER `is_percentage`;

ALTER TABLE `employee_allowance_batches`
  ADD COLUMN `deduct_from_base_salary` tinyint(1) DEFAULT 0 AFTER `is_percentage`;
