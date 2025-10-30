-- Migration: Split payable_leave_hours into weekday/saturday/sunday columns
-- Purpose: Store paid leave hours separately by day type for easier payroll calculation
-- Date: 2025-10-30

-- Rename existing column to payable_leave_hours_weekday
ALTER TABLE leave_requests
CHANGE COLUMN payable_leave_hours payable_leave_hours_weekday DECIMAL(10,2) DEFAULT 0.00
COMMENT 'Payable hours for weekdays (Mon-Fri) covered by this leave';

-- Add columns for Saturday and Sunday
ALTER TABLE leave_requests
ADD COLUMN payable_leave_hours_saturday DECIMAL(10,2) DEFAULT 0.00
COMMENT 'Payable hours for Saturdays covered by this leave';

ALTER TABLE leave_requests
ADD COLUMN payable_leave_hours_sunday DECIMAL(10,2) DEFAULT 0.00
COMMENT 'Payable hours for Sundays covered by this leave';

-- Update index to include all three columns
DROP INDEX IF EXISTS idx_leave_requests_payable_hours ON leave_requests;
CREATE INDEX idx_leave_requests_payable_hours ON leave_requests(
    employee_id,
    status,
    payable_leave_hours_weekday,
    payable_leave_hours_saturday,
    payable_leave_hours_sunday
);

-- Comments:
-- payable_leave_hours_weekday: Hours for Monday-Friday
-- payable_leave_hours_saturday: Hours for Saturday
-- payable_leave_hours_sunday: Hours for Sunday
--
-- Example: 3-day leave (Thu-Sat) for employee with 8h weekday, 4.5h Saturday:
--   payable_leave_hours_weekday = 16.00 (Thu + Fri = 2 days × 8h)
--   payable_leave_hours_saturday = 4.50 (1 day × 4.5h)
--   payable_leave_hours_sunday = 0.00
