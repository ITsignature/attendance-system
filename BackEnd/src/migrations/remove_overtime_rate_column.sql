-- Remove overtime_rate column from attendance table
-- Overtime rates are now managed through company settings

ALTER TABLE attendance DROP COLUMN IF EXISTS overtime_rate;

SELECT 'overtime_rate column removed from attendance table' as status;