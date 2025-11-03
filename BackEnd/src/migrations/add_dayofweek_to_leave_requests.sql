-- Migration: Add dayofweek column to leave_requests table
-- Purpose: Store day-of-week breakdown when leave request is created
-- Date: 2025-10-30

-- Add dayofweek column to store day-of-week breakdown (populated on creation)
ALTER TABLE leave_requests
ADD COLUMN dayofweek JSON COMMENT 'Day-of-week breakdown: {"1": 0, "2": 1, ...} where 1=Sunday, 2=Monday, ..., 7=Saturday';

-- Comments:
-- This column will be populated when a leave request is CREATED
-- It stores the count of each day of week in the leave period
-- Example: 5-day leave (Monday-Friday) = {"1": 0, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 0}
-- Example: 3-day leave (Thu-Sat) = {"1": 0, "2": 0, "3": 0, "4": 1, "5": 1, "6": 0, "7": 1}
--
-- This breakdown will be used during approval to calculate payable_leave_hours efficiently
