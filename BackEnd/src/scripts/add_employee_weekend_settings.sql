-- =============================================
-- ADD EMPLOYEE WEEKEND SETTINGS COLUMN
-- =============================================

-- Add weekend_settings column to employees table
-- This allows individual employees to override company weekend settings
ALTER TABLE employees
ADD COLUMN weekend_settings JSON DEFAULT NULL
COMMENT 'Employee-specific weekend working day settings that override company settings';

-- Add index for better performance when querying weekend settings
CREATE INDEX idx_employees_weekend_settings ON employees (weekend_settings);

-- =============================================
-- UPDATE EXISTING EMPLOYEES (OPTIONAL)
-- =============================================
-- If you want to set default weekend settings for existing employees, uncomment below:
-- This will set all existing employees to use company defaults (null = use company settings)

-- UPDATE employees
-- SET weekend_settings = NULL
-- WHERE weekend_settings IS NULL;

-- =============================================
-- EXAMPLE USAGE
-- =============================================
-- To set an employee to work on weekends (both Saturday and Sunday):
-- UPDATE employees
-- SET weekend_settings = JSON_OBJECT(
--     'saturday_working', true,
--     'sunday_working', true,
--     'custom_weekend_days', JSON_ARRAY()
-- )
-- WHERE employee_code = 'EMP001';

-- To set an employee to NOT work on weekends (override company if company has weekend work):
-- UPDATE employees
-- SET weekend_settings = JSON_OBJECT(
--     'saturday_working', false,
--     'sunday_working', false,
--     'custom_weekend_days', JSON_ARRAY()
-- )
-- WHERE employee_code = 'EMP002';

-- To set an employee to work on specific custom days (e.g., Wednesday as weekend):
-- UPDATE employees
-- SET weekend_settings = JSON_OBJECT(
--     'saturday_working', false,
--     'sunday_working', false,
--     'custom_weekend_days', JSON_ARRAY(3)
-- )
-- WHERE employee_code = 'EMP003';

-- To remove employee override and use company settings:
-- UPDATE employees
-- SET weekend_settings = NULL
-- WHERE employee_code = 'EMP001';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Check employees with custom weekend settings:
-- SELECT
--     employee_code,
--     CONCAT(first_name, ' ', last_name) as full_name,
--     weekend_settings
-- FROM employees
-- WHERE weekend_settings IS NOT NULL;

-- Check all employees weekend configuration (including company fallback):
-- SELECT
--     e.employee_code,
--     CONCAT(e.first_name, ' ', e.last_name) as full_name,
--     e.weekend_settings as employee_weekend_settings,
--     s.setting_value as company_weekend_settings
-- FROM employees e
-- LEFT JOIN system_settings s ON e.client_id = s.client_id
--     AND s.setting_key = 'weekend_working_days'
-- ORDER BY e.employee_code;