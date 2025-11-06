-- Migration: Change payable_duration from DECIMAL(5,2) (hours) to INT (seconds)
-- This provides good precision and eliminates rounding errors without excessive storage

-- Step 1: Add a new column to store seconds
ALTER TABLE attendance
ADD COLUMN payable_duration_sec INT NULL COMMENT 'Payable duration in seconds (for precision)';

-- Step 2: Convert existing hours/minutes to seconds
-- Check if values are already in minutes (> 24) or hours (< 24)
UPDATE attendance
SET payable_duration_sec = CASE
    WHEN payable_duration > 24 THEN ROUND(payable_duration * 60)  -- If stored as minutes, convert minutes to seconds
    ELSE ROUND(payable_duration * 60 * 60)  -- If stored as hours, convert hours to seconds
END
WHERE payable_duration IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE attendance
DROP COLUMN payable_duration;

-- Step 4: Rename new column to old name
ALTER TABLE attendance
CHANGE COLUMN payable_duration_sec payable_duration INT NULL COMMENT 'Payable duration in seconds (for precision)';

-- Step 5: Update the index
ALTER TABLE attendance
DROP INDEX idx_attendance_payable_duration;

ALTER TABLE attendance
ADD INDEX idx_attendance_payable_duration (employee_id, date, payable_duration);

-- Verify the change
SELECT
    employee_id,
    date,
    payable_duration,
    ROUND(payable_duration / 60 / 60, 2) as payable_hours,
    ROUND(payable_duration / 60, 2) as payable_minutes
FROM attendance
WHERE payable_duration IS NOT NULL
ORDER BY date DESC
LIMIT 10;
