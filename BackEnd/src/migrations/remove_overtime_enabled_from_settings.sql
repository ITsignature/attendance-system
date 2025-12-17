-- Migration: Remove employee-specific settings from system_settings
-- These settings are now managed at employee level instead of company level
-- Date: 2025-12-15

-- Remove overtime_enabled, overtime_rate_multiplier, and working_hours_config from system_settings
-- These are now managed at individual employee level in the employees table
DELETE FROM system_settings WHERE setting_key IN ('overtime_enabled', 'overtime_rate_multiplier', 'working_hours_config');
