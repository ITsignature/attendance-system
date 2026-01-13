-- Migration: Add break time columns to employees table
-- Date: 2026-01-13
-- Description: Adds break_start_time and break_end_time columns to support
--              different break schedules for different employees during shifts

-- Add break time columns to employees table
ALTER TABLE `employees`
ADD COLUMN `break_start_time` TIME DEFAULT NULL COMMENT 'Employee break start time' AFTER `out_time`,
ADD COLUMN `break_end_time` TIME DEFAULT NULL COMMENT 'Employee break end time' AFTER `break_start_time`;

-- Note: Break times are optional (NULL allowed)
-- Break times allow companies to track different break schedules for different employees
-- during their work shifts
