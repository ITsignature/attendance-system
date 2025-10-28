-- Add base_salary column to payroll_records table
-- This column stores the employee's base salary at the time of payroll run creation
-- This ensures payroll records reflect the salary at that specific point in time

ALTER TABLE payroll_records
ADD COLUMN base_salary DECIMAL(12, 2) DEFAULT NULL COMMENT 'Employee base salary at the time of payroll run creation';

-- Add index for performance
CREATE INDEX idx_payroll_records_base_salary ON payroll_records(base_salary);
