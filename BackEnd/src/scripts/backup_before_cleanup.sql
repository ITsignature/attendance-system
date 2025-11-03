-- =====================================================
-- BACKUP SCRIPT (Optional)
-- Creates backup of payroll_records_old_backup before cleanup
-- =====================================================
-- Run this BEFORE running cleanup_unused_tables.sql
-- if you want to keep old payroll data
--
-- Note: attendance_master and users are NOT being deleted
-- =====================================================

-- Backup old payroll records (in case you need data later)

CREATE TABLE IF NOT EXISTS `backup_payroll_records_old` AS
SELECT * FROM `payroll_records_old_backup`;

-- Check backup row count
SELECT
    'payroll_records_old_backup' AS table_name,
    (SELECT COUNT(*) FROM payroll_records_old_backup) AS original_count,
    (SELECT COUNT(*) FROM backup_payroll_records_old) AS backup_count;

SELECT 'Backup completed! You can now run cleanup_unused_tables.sql' AS status;
