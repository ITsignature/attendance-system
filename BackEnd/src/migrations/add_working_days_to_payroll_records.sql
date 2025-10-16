-- Add working days columns to payroll_records table
-- These columns store pre-calculated working days for the payroll period per employee
-- This optimization eliminates redundant HolidayService.calculateWorkingDays() calls during payroll calculation

ALTER TABLE payroll_records
ADD COLUMN weekday_working_days DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated weekday (Mon-Fri) working days excluding holidays',
ADD COLUMN working_saturdays DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated Saturday working days for this employee',
ADD COLUMN working_sundays DECIMAL(10, 2) DEFAULT NULL COMMENT 'Pre-calculated Sunday working days for this employee';

-- Add index for performance on queries filtering by these columns
CREATE INDEX idx_payroll_records_working_days ON payroll_records(weekday_working_days, working_saturdays, working_sundays);
