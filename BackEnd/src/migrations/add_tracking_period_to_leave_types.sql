-- Migration: Add tracking_period and max_days_per_month to leave_types table
-- Description: Add columns to support monthly or yearly tracking for leave types
-- Date: 2026-01-28

-- Add tracking_period column (defaults to 'yearly' for backward compatibility)
ALTER TABLE leave_types
ADD COLUMN tracking_period ENUM('monthly', 'yearly') DEFAULT 'yearly'
COMMENT 'Whether to track leave limits monthly or yearly';

-- Add max_days_per_month column (defaults to 0)
ALTER TABLE leave_types
ADD COLUMN max_days_per_month INT DEFAULT 0
COMMENT 'Maximum days per month (used when tracking_period is monthly)';

-- Update existing leave types: if they have max_days_per_year > 0, set tracking_period to 'yearly'
UPDATE leave_types
SET tracking_period = 'yearly'
WHERE max_days_per_year > 0;
