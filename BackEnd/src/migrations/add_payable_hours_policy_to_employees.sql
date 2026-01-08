-- Migration: Add payable_hours_policy to employees table
-- This controls whether employees can compensate late arrival with late departure for payable hours

ALTER TABLE employees
ADD COLUMN payable_hours_policy ENUM('strict_schedule', 'actual_worked')
DEFAULT 'strict_schedule'
COMMENT 'Payable hours policy: strict_schedule (cap to scheduled hours) or actual_worked (allow time shifting if total duration met)';

-- Description of policies:
-- 'strict_schedule': Pay is capped to scheduled hours. Late arrival/early departure results in lost hours.
--                    Example: Schedule 9AM-5PM, Actual 10AM-6PM → Paid 9AM-5PM only (7 hours, lost 1 hour)
--
-- 'actual_worked': Pay for actual hours worked if they complete scheduled duration (time shifting allowed).
--                  Example: Schedule 9AM-5PM, Actual 10AM-6PM → Paid full 8 hours (arrived late but stayed late)
