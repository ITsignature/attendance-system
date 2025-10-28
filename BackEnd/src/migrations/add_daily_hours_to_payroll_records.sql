-- Add daily hours columns to payroll_records table
-- These columns store pre-calculated daily working hours for the employee
-- This optimization eliminates redundant getEmployeeDailyHours() calls during payroll calculation

ALTER TABLE payroll_records
ADD COLUMN weekday_daily_hours DECIMAL(5, 2) DEFAULT NULL COMMENT 'Pre-calculated daily hours for weekdays (Mon-Fri)',
ADD COLUMN saturday_daily_hours DECIMAL(5, 2) DEFAULT NULL COMMENT 'Pre-calculated daily hours for Saturday',
ADD COLUMN sunday_daily_hours DECIMAL(5, 2) DEFAULT NULL COMMENT 'Pre-calculated daily hours for Sunday';

-- Add index for performance on queries filtering by these columns
CREATE INDEX idx_payroll_records_daily_hours ON payroll_records(weekday_daily_hours, saturday_daily_hours, sunday_daily_hours);
