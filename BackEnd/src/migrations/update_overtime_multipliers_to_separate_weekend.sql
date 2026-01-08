-- Migration: Update overtime multipliers to separate Saturday/Sunday and rename regular to weekday
-- Date: 2025-12-19
-- Description: Replaces weekend_ot_multiplier with saturday_ot_multiplier and sunday_ot_multiplier
--              Renames regular_ot_multiplier to weekday_ot_multiplier

-- Drop the old weekend_ot_multiplier column
ALTER TABLE employees
DROP COLUMN IF EXISTS weekend_ot_multiplier;

-- Rename regular_ot_multiplier to weekday_ot_multiplier
ALTER TABLE employees
CHANGE COLUMN regular_ot_multiplier weekday_ot_multiplier DECIMAL(4,2) DEFAULT NULL COMMENT 'Weekday overtime rate multiplier (Monday-Friday)';

-- Add separate Saturday and Sunday multipliers
ALTER TABLE employees
ADD COLUMN saturday_ot_multiplier DECIMAL(4,2) DEFAULT NULL COMMENT 'Saturday overtime rate multiplier',
ADD COLUMN sunday_ot_multiplier DECIMAL(4,2) DEFAULT NULL COMMENT 'Sunday overtime rate multiplier';

-- Final column structure will be:
-- overtime_enabled (BOOLEAN)
-- pre_shift_overtime_enabled (BOOLEAN)
-- post_shift_overtime_enabled (BOOLEAN)
-- weekday_ot_multiplier (DECIMAL) - Monday to Friday
-- saturday_ot_multiplier (DECIMAL) - Saturday only
-- sunday_ot_multiplier (DECIMAL) - Sunday only
-- holiday_ot_multiplier (DECIMAL) - Holidays
