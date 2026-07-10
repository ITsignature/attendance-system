-- Add employee-level statutory holiday overtime multiplier
-- Distinct from holiday_ot_multiplier, which applies to regular (non-statutory) holidays
ALTER TABLE employees
ADD COLUMN statutory_holiday_ot_multiplier DECIMAL(4,2) DEFAULT NULL COMMENT 'Statutory holiday overtime rate multiplier' AFTER holiday_ot_multiplier;
