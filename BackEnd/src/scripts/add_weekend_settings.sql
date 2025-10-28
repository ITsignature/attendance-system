-- =============================================
-- ADD WEEKEND CONFIGURATION SETTINGS
-- =============================================

-- Insert weekend configuration settings for each client
-- This will allow clients to configure whether weekends are working days

INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, description, is_public) 
SELECT 
    UUID() as id,
    c.id as client_id,
    'weekend_working_days' as setting_key,
    JSON_OBJECT(
        'saturday_working', false,
        'sunday_working', false,
        'custom_weekend_days', JSON_ARRAY()
    ) as setting_value,
    'object' as setting_type,
    'Configure which weekend days are considered working days. saturday_working and sunday_working control if Saturday/Sunday are work days. custom_weekend_days allows defining specific non-standard weekend days.' as description,
    false as is_public
FROM clients c
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- Insert working hours configuration (related to weekend settings)
INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, description, is_public) 
SELECT 
    UUID() as id,
    c.id as client_id,
    'working_hours_config' as setting_key,
    JSON_OBJECT(
        'standard_hours_per_day', 8,
        'weekend_hours_multiplier', 1.5,
        'holiday_hours_multiplier', 2.5,
        'start_time', '09:00',
        'end_time', '17:00',
        'break_duration_minutes', 60
    ) as setting_value,
    'object' as setting_type,
    'Configure working hours and overtime multipliers. weekend_hours_multiplier applies when weekend days are worked, holiday_hours_multiplier for holiday work.' as description,
    false as is_public
FROM clients c
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- VERIFICATION QUERY
-- =============================================
-- Run this to verify settings were added correctly:
-- SELECT c.name as client_name, s.setting_key, s.setting_value, s.description
-- FROM system_settings s
-- JOIN clients c ON s.client_id = c.id
-- WHERE s.setting_key IN ('weekend_working_days', 'working_hours_config')
-- ORDER BY c.name, s.setting_key;