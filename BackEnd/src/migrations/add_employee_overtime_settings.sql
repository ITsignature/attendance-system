-- Add overtime calculation fields to employees table
ALTER TABLE employees
ADD COLUMN overtime_enabled BOOLEAN DEFAULT true COMMENT 'Enable/disable overtime salary calculation for this employee',
ADD COLUMN pre_shift_overtime_enabled BOOLEAN DEFAULT false COMMENT 'Enable overtime calculation for hours worked before shift start time',
ADD COLUMN post_shift_overtime_enabled BOOLEAN DEFAULT true COMMENT 'Enable overtime calculation for hours worked after shift end time',
ADD COLUMN regular_ot_multiplier DECIMAL(4,2) DEFAULT 1.5 COMMENT 'Regular overtime rate multiplier (e.g., 1.5 for time-and-a-half)',
ADD COLUMN weekend_ot_multiplier DECIMAL(4,2) DEFAULT 2.0 COMMENT 'Weekend overtime rate multiplier',
ADD COLUMN holiday_ot_multiplier DECIMAL(4,2) DEFAULT 2.5 COMMENT 'Holiday overtime rate multiplier';

-- Add comments explaining the logic
ALTER TABLE employees MODIFY COLUMN overtime_enabled BOOLEAN DEFAULT true
COMMENT 'Enable/disable overtime salary calculation for this employee';

ALTER TABLE employees MODIFY COLUMN pre_shift_overtime_enabled BOOLEAN DEFAULT false
COMMENT 'Enable overtime calculation for hours worked before shift start time';

ALTER TABLE employees MODIFY COLUMN post_shift_overtime_enabled BOOLEAN DEFAULT true
COMMENT 'Enable overtime calculation for hours worked after shift end time';

ALTER TABLE employees MODIFY COLUMN regular_ot_multiplier DECIMAL(4,2) DEFAULT 1.5
COMMENT 'Regular overtime rate multiplier (e.g., 1.5 for time-and-a-half)';

ALTER TABLE employees MODIFY COLUMN weekend_ot_multiplier DECIMAL(4,2) DEFAULT 2.0
COMMENT 'Weekend overtime rate multiplier';

ALTER TABLE employees MODIFY COLUMN holiday_ot_multiplier DECIMAL(4,2) DEFAULT 2.5
COMMENT 'Holiday overtime rate multiplier';

-- Update existing employees to have overtime enabled by default
UPDATE employees SET overtime_enabled = true WHERE overtime_enabled IS NULL;
UPDATE employees SET pre_shift_overtime_enabled = false WHERE pre_shift_overtime_enabled IS NULL;
UPDATE employees SET post_shift_overtime_enabled = true WHERE post_shift_overtime_enabled IS NULL;
UPDATE employees SET regular_ot_multiplier = 1.5 WHERE regular_ot_multiplier IS NULL;
UPDATE employees SET weekend_ot_multiplier = 2.0 WHERE weekend_ot_multiplier IS NULL;
UPDATE employees SET holiday_ot_multiplier = 2.5 WHERE holiday_ot_multiplier IS NULL;

-- Add index for performance when filtering by overtime_enabled
CREATE INDEX idx_employees_overtime_enabled ON employees(overtime_enabled);



-- Migration: Add employee-level overtime calculation settings
-- This moves overtime calculation control from company-level to individual employee level
-- Date: 2025-12-15