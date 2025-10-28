-- Add payable_duration column to attendance table
-- This column stores pre-calculated payable hours for each attendance record
-- Improves payroll calculation performance by avoiding recalculation every month

ALTER TABLE attendance
ADD COLUMN payable_duration DECIMAL(5,2) DEFAULT NULL
COMMENT 'Pre-calculated payable hours based on overlap of scheduled and actual hours';

-- Add index for performance when summing payable_duration during payroll
CREATE INDEX idx_attendance_payable_duration ON attendance(employee_id, date, payable_duration);
