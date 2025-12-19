-- Migration: Add pre_shift_overtime_seconds and post_shift_overtime_seconds to attendance table
-- Date: 2025-12-19
-- Description: Adds columns to track actual overtime seconds worked before/after scheduled times
--              Changes overtime_hours column meaning from "multiplied OT" to "actual OT without multiplier"

-- Add new columns for pre-shift and post-shift overtime in seconds
ALTER TABLE attendance
ADD COLUMN pre_shift_overtime_seconds INT DEFAULT 0 COMMENT 'Actual seconds worked before scheduled start time as overtime',
ADD COLUMN post_shift_overtime_seconds INT DEFAULT 0 COMMENT 'Actual seconds worked after scheduled end time as overtime';

-- Note: The existing overtime_hours column will now store ACTUAL overtime hours WITHOUT multiplier
-- Multipliers will be applied during payroll calculation, not when saving attendance
-- This allows for:
-- 1. Retroactive overtime enabling (data is preserved even when OT was disabled)
-- 2. Multiplier rate changes (can recalculate pay without losing actual hours)
-- 3. Flexible pre/post-shift OT configuration

-- Example data after this migration:
-- pre_shift_overtime_seconds: 3600 (employee arrived 1 hour early)
-- post_shift_overtime_seconds: 7200 (employee left 2 hours late)
-- overtime_hours: 3.00 (total actual OT: 1 + 2 = 3 hours, NO multiplier applied)
