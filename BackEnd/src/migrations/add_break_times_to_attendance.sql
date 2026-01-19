-- Migration: Add break time columns to attendance table
-- Date: 2026-01-13
-- Description: Adds break_start_time and break_end_time columns to support
--              recording actual break times taken by employees during shifts

-- Add break time columns to attendance table
ALTER TABLE `attendance`
ADD COLUMN `break_start_time` TIME DEFAULT NULL COMMENT 'Actual break start time during shift' AFTER `break_duration`,
ADD COLUMN `break_end_time` TIME DEFAULT NULL COMMENT 'Actual break end time during shift' AFTER `break_start_time`;

-- Note: Break times are optional (NULL allowed)
-- These columns store the actual break times taken by employees
-- Only populated for employees who have configured break schedules in their shifts
