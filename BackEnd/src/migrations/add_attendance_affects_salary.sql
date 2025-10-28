-- =============================================
-- Migration: Add attendance_affects_salary field to employees table
-- Purpose: Allow certain employees to receive full salary regardless of attendance
-- Date: 2025-10-28
-- =============================================

-- Add the field to employees table
ALTER TABLE employees
ADD COLUMN attendance_affects_salary BOOLEAN DEFAULT TRUE
COMMENT 'If FALSE, employee receives full salary regardless of attendance';

-- Add index for faster queries
CREATE INDEX idx_employees_attendance_affects_salary ON employees(attendance_affects_salary);

-- Update comment for clarity
ALTER TABLE employees
MODIFY COLUMN attendance_affects_salary BOOLEAN DEFAULT TRUE
COMMENT 'If TRUE (default), salary is calculated based on attendance. If FALSE, full salary is paid regardless of attendance.';

-- Example: Set specific employees to not have attendance affect salary (uncomment and modify as needed)
-- UPDATE employees SET attendance_affects_salary = FALSE WHERE employee_code IN ('EMP001', 'EMP002');
-- UPDATE employees SET attendance_affects_salary = FALSE WHERE designation_id IN (SELECT id FROM designations WHERE title = 'CEO');
