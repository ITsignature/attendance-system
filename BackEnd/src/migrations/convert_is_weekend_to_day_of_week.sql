-- Convert is_weekend column from boolean to day_of_week integer
-- This allows us to distinguish between Saturday (7) and Sunday (1), and all weekdays (2-6)
-- DAYOFWEEK values: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday

-- Step 1: Modify the column type from TINYINT(1) to TINYINT(1) UNSIGNED (still compatible)
-- We'll use the same column but change its meaning

-- Step 2: Update existing data to store day_of_week instead of is_weekend boolean
-- Calculate day_of_week from the date column for all existing records
UPDATE attendance
SET is_weekend = DAYOFWEEK(date)
WHERE date IS NOT NULL;

-- Step 3: Update column comment to reflect new usage
ALTER TABLE attendance
MODIFY COLUMN is_weekend TINYINT(1) UNSIGNED NOT NULL DEFAULT 0
COMMENT 'Day of week: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday';

-- Step 4: Verify the conversion (optional, for logging)
-- SELECT
--     date,
--     is_weekend as day_of_week,
--     CASE
--         WHEN is_weekend = 1 THEN 'Sunday'
--         WHEN is_weekend = 2 THEN 'Monday'
--         WHEN is_weekend = 3 THEN 'Tuesday'
--         WHEN is_weekend = 4 THEN 'Wednesday'
--         WHEN is_weekend = 5 THEN 'Thursday'
--         WHEN is_weekend = 6 THEN 'Friday'
--         WHEN is_weekend = 7 THEN 'Saturday'
--     END as day_name
-- FROM attendance
-- ORDER BY date DESC
-- LIMIT 20;
