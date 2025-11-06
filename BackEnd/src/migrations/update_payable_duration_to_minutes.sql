-- Migration: Change payable_duration from DECIMAL (hours) to INT (minutes)
-- This provides better precision and avoids rounding errors in payroll calculations

-- Step 1: Add a new column to store minutes
ALTER TABLE attendance
ADD COLUMN payable_duration_minutes INT NULL COMMENT 'Payable duration in minutes (for precision)';

-- Step 2: Convert existing hours to minutes
UPDATE attendance
SET payable_duration_minutes = ROUND(payable_duration * 60)
WHERE payable_duration IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE attendance
DROP COLUMN payable_duration;

-- Step 4: Rename new column to old name
ALTER TABLE attendance
CHANGE COLUMN payable_duration_minutes payable_duration INT NULL COMMENT 'Payable duration in minutes (for precision)';

-- Verify the change
SELECT
    employee_id,
    date,
    payable_duration,
    ROUND(payable_duration / 60, 2) as payable_hours
FROM attendance
WHERE payable_duration IS NOT NULL
LIMIT 5;
