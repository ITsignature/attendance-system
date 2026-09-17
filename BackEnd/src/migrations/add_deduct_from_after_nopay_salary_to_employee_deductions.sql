-- Adds a "Deduct from After No-Pay Salary" toggle to employee-specific deductions
-- (and their bulk batches), so a percentage-based deduction (e.g. EPF) can be calculated
-- on the earned base salary AFTER no-pay/absent-day deductions, instead of on the full
-- contracted base salary (deduct_from_base_salary) or gross salary (default).

ALTER TABLE `employee_deductions`
  ADD COLUMN `deduct_from_after_nopay_salary` tinyint(1) DEFAULT 0 AFTER `deduct_from_base_salary`;

ALTER TABLE `employee_deduction_batches`
  ADD COLUMN `deduct_from_after_nopay_salary` tinyint(1) DEFAULT 0 AFTER `deduct_from_base_salary`;
