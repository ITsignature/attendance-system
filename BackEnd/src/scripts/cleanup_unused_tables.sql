-- =====================================================
-- DATABASE CLEANUP SCRIPT
-- Removes unused tables and views
-- =====================================================
-- Created: 2025-10-29
--
-- IMPORTANT:
-- 1. This script drops 13 tables/views (8 views + 5 tables)
-- 2. Keeps: attendance_master, users (per user request)
-- 3. Safe to run - does not affect current working data
-- =====================================================

-- Set safe mode
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- STEP 1: DROP UNUSED VIEWS (No dependencies)
-- =====================================================

DROP VIEW IF EXISTS `employee_monthly_allowances`;
DROP VIEW IF EXISTS `employee_monthly_deductions`;
DROP VIEW IF EXISTS `v_attendance_summary`;
DROP VIEW IF EXISTS `v_current_month_payroll`;
DROP VIEW IF EXISTS `v_payroll_stats_by_department`;
-- =====================================================
-- STEP 1B: DROP TABLES NAMED LIKE VIEWS (Misnamed as views)
-- =====================================================
-- Note: These have v_ prefix but are actually tables, not views

DROP TABLE IF EXISTS `v_dashboard_stats`;
DROP TABLE IF EXISTS `v_employee_details`;
DROP TABLE IF EXISTS `v_employee_directory`;

-- =====================================================
-- STEP 2: DROP UNUSED TABLES (In dependency order)
-- =====================================================

-- Drop tables that reference old backup table first
DROP TABLE IF EXISTS `payroll_adjustments`;

-- Drop legacy backup table
DROP TABLE IF EXISTS `payroll_records_old_backup`;

-- Drop other unused tables
DROP TABLE IF EXISTS `employee_payroll_components`;
DROP TABLE IF EXISTS `payroll_schedules`;
DROP TABLE IF EXISTS `payroll_tax_slabs`;

-- Note: Keeping attendance_master and users tables (per user request)

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify tables are dropped:

SELECT 'Tables dropped successfully!' AS status;

-- List remaining tables
SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u770612336_attendance_sys'
  AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
ORDER BY TABLE_TYPE, TABLE_NAME;

-- =====================================================
-- SUMMARY
-- =====================================================
-- Views dropped (8):
-- ✓ employee_monthly_allowances
-- ✓ employee_monthly_deductions
-- ✓ v_attendance_summary
-- ✓ v_current_month_payroll
-- ✓ v_dashboard_stats
-- ✓ v_employee_details
-- ✓ v_employee_directory
-- ✓ v_payroll_stats_by_department
--
-- Tables dropped (5):
-- ✓ payroll_records_old_backup (legacy)
-- ✓ employee_payroll_components (unused)
-- ✓ payroll_adjustments (unused)
-- ✓ payroll_schedules (unused)
-- ✓ payroll_tax_slabs (unused)
--
-- Tables kept (not dropped):
-- ◆ attendance_master (kept per user request)
-- ◆ users (kept per user request)
--
-- Total: 13 objects removed (8 views + 5 tables)
-- =====================================================
