-- Migration: Add payable_leave_hours column to leave_requests table
-- Purpose: Store pre-calculated payable hours for paid leaves to optimize payroll calculation
-- Date: 2025-10-30

-- Add payable_leave_hours column to store total hours covered by this leave
ALTER TABLE leave_requests
ADD COLUMN payable_leave_hours DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total payable hours for this leave (calculated when approved)';

-- Add index for faster payroll queries
CREATE INDEX idx_leave_requests_payable_hours ON leave_requests(employee_id, status, payable_leave_hours);

-- Comments:
-- This column will be populated when a paid leave is approved
-- It will store the sum of daily hours across all days in the leave period
-- For example: 3-day leave with 8h/day = 24.00 hours
-- For multi-day leaves spanning different day types (weekday/weekend),
-- we sum the appropriate hours based on employee's schedule
