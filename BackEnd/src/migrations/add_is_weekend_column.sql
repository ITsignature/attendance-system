-- Add is_weekend column to attendance table
-- This column stores whether the attendance date is a weekend day (Saturday=1, Sunday=1, Others=0)
-- Improves payroll calculation performance by avoiding day-of-week calculations

ALTER TABLE attendance
ADD COLUMN is_weekend TINYINT(1) DEFAULT 0 NOT NULL
COMMENT 'Flag indicating if this attendance date is a weekend (0=Weekday, 1=Weekend)';

-- Add index for performance when filtering by is_weekend
CREATE INDEX idx_attendance_is_weekend ON attendance(employee_id, is_weekend, date);
