-- Migration: Add fingerprint_id column to employees table
-- Date: 2025-10-31
-- Purpose: Enable fingerprint device integration for attendance marking

-- Add fingerprint_id column
ALTER TABLE employees
ADD COLUMN fingerprint_id INT NULL UNIQUE
COMMENT 'Fingerprint device ID for attendance marking'
AFTER employee_code;

-- Create index for faster lookups
CREATE INDEX idx_employees_fingerprint_id ON employees(fingerprint_id);

-- Add comment to explain usage
ALTER TABLE employees
MODIFY COLUMN fingerprint_id INT NULL UNIQUE
COMMENT 'Maps to fingerprint scanner ID. Must match the ID stored in AS608 fingerprint device.';
