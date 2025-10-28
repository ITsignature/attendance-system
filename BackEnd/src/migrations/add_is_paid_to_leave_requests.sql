-- Add is_paid column to leave_requests table
-- This allows admins to override whether a leave is paid or unpaid on per-request basis

ALTER TABLE leave_requests
ADD COLUMN is_paid BOOLEAN DEFAULT TRUE COMMENT 'Whether this specific leave request is paid' AFTER days_requested;

-- Add index for quick filtering
ALTER TABLE leave_requests
ADD INDEX idx_leave_requests_is_paid (is_paid);
