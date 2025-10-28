-- Fix component_code column length issue
-- The current varchar(20) is too short for some component codes
-- Increase to varchar(30) to accommodate longer codes

USE attendance_management_system;

-- Check current column definition
-- DESCRIBE payroll_record_components;

-- Increase component_code column length
ALTER TABLE payroll_record_components 
MODIFY COLUMN component_code VARCHAR(30) NOT NULL;

-- Verify the change
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'attendance_management_system' 
    AND TABLE_NAME = 'payroll_record_components' 
    AND COLUMN_NAME = 'component_code';

SELECT 'Component code column length increased to VARCHAR(30)' as status;