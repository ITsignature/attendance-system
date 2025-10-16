-- Add daily salary and hourly rate columns to payroll_records table
-- These columns store pre-calculated salary rates for the payroll period per employee
-- This optimization eliminates redundant salary rate calculations during payroll calculation

ALTER TABLE payroll_records
ADD COLUMN daily_salary DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated daily salary (base_salary / total_working_days)',
ADD COLUMN weekday_hourly_rate DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated hourly rate for weekdays',
ADD COLUMN saturday_hourly_rate DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated hourly rate for Saturday',
ADD COLUMN sunday_hourly_rate DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated hourly rate for Sunday';

-- Add index for performance
CREATE INDEX idx_payroll_records_salary_rates ON payroll_records(daily_salary, weekday_hourly_rate);
