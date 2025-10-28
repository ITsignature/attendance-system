-- =============================================
-- Migration: Add attendance_affects_salary to payroll_records table
-- Purpose: Store employee's attendance_affects_salary setting at the time of payroll creation
--          for historical accuracy and performance optimization
-- Date: 2025-10-28
-- =============================================

-- Add the field to payroll_records table
ALTER TABLE payroll_records
ADD COLUMN attendance_affects_salary BOOLEAN DEFAULT TRUE
COMMENT 'Snapshot of employee attendance_affects_salary setting at time of payroll run creation. If FALSE, employee receives full salary regardless of attendance.';

-- Add index for faster queries
CREATE INDEX idx_payroll_records_attendance_affects_salary ON payroll_records(attendance_affects_salary);

-- Update existing records to default TRUE (attendance affects salary)
UPDATE payroll_records
SET attendance_affects_salary = TRUE
WHERE attendance_affects_salary IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE payroll_records
MODIFY COLUMN attendance_affects_salary BOOLEAN NOT NULL DEFAULT TRUE;
