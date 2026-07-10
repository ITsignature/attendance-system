-- Add APIT (Advance Personal Income Tax) flag to employees table
-- APIT is calculated per the Sri Lanka Summarized Tax Table (Regular Profits from Employment)
-- Only employees with this flag enabled will have APIT deducted in payroll

ALTER TABLE employees
ADD COLUMN apit_enabled BOOLEAN DEFAULT false COMMENT 'Enable APIT (Advance Personal Income Tax) deduction for this employee';

-- Ensure existing employees default to disabled (opt-in)
UPDATE employees SET apit_enabled = false WHERE apit_enabled IS NULL;

-- Index for filtering by APIT-enabled employees
CREATE INDEX idx_employees_apit_enabled ON employees(apit_enabled);
