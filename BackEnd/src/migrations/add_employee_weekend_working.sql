-- =============================================
-- ADD EMPLOYEE WEEKEND WORKING CONFIGURATION
-- =============================================
-- This migration adds weekend working configuration to employees table
-- Each employee can have their own weekend working schedule

-- Add weekend working configuration column
ALTER TABLE employees
ADD COLUMN weekend_working_config JSON DEFAULT NULL COMMENT 'JSON object containing weekend working configuration for Saturday and Sunday';

-- Add index for JSON queries (MySQL 5.7+)
ALTER TABLE employees
ADD INDEX idx_employees_weekend_config ((CAST(weekend_working_config->>'$.saturday.working' AS UNSIGNED))),
ADD INDEX idx_employees_weekend_sunday ((CAST(weekend_working_config->>'$.sunday.working' AS UNSIGNED)));

-- =============================================
-- JSON STRUCTURE DOCUMENTATION
-- =============================================
/*
weekend_working_config JSON structure:
{
  "saturday": {
    "working": true,
    "in_time": "08:30",
    "out_time": "13:00",
    "full_day_salary": false
  },
  "sunday": {
    "working": true,
    "in_time": "09:00",
    "out_time": "13:00",
    "full_day_salary": true
  }
}

Fields explanation:
- working: boolean - whether employee works on this day
- in_time: string (TIME format) - start time for this day
- out_time: string (TIME format) - end time for this day
- full_day_salary: boolean - if true, this day gets full weekday salary weight
                            if false, salary is proportional to hours worked

Examples:
- NULL: Employee doesn't work weekends (default)
- {"saturday": {"working": true, "in_time": "09:00", "out_time": "17:00", "full_day_salary": true}}
- {"saturday": {...}, "sunday": {...}} for both days
*/

-- =============================================
-- NO DATA MIGRATION NEEDED
-- =============================================
-- Existing employees will have weekend_working_config = NULL (no weekend work)
-- New employees will configure their weekend working when created
-- This provides a clean slate approach without assumptions

-- =============================================
-- NO HELPER FUNCTIONS NEEDED
-- =============================================
-- Weekend working logic is handled directly in JavaScript/Node.js
-- No need for complex database functions
-- Simple JSON field access in application code


-- =============================================
-- SUCCESS MESSAGE
-- =============================================
SELECT
    'Employee weekend working configuration added successfully!' as message,
    'Column added: weekend_working_config JSON' as schema_change,
    'No migration needed - existing employees start with NULL (no weekend work)' as migration_status,
    'Weekend working logic handled in application code' as implementation_note;