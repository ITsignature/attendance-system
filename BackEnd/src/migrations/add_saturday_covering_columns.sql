-- Add saturday covering columns to attendance table
ALTER TABLE `attendance`
  ADD COLUMN `extra_time_from_payable_duration` INT DEFAULT 0 COMMENT 'Accumulated extra seconds worked beyond 8hrs this month (resets per month via row context)',
  ADD COLUMN `saturday_covering_seconds` INT DEFAULT 0 COMMENT 'Running total of seconds contributed toward covering Saturday obligation this month',
  ADD COLUMN `saturday_covering_is_completed` TINYINT(1) DEFAULT 0 COMMENT 'Whether Saturday obligation for this month is fully covered',
  ADD COLUMN `is_auto_covered` TINYINT(1) DEFAULT 0 COMMENT 'Whether this attendance record was auto-created by the saturday covering system';

-- Add saturday_covering_enabled flag to employees table
ALTER TABLE `employees`
  ADD COLUMN `saturday_covering_enabled` TINYINT(1) DEFAULT 0 COMMENT 'Whether this employee uses the weekday extra time to cover Saturday obligation';

-- Index for fast prev-record lookup in computeSaturdayCovering (runs on every checkout)
ALTER TABLE `attendance`
  ADD KEY `idx_sat_covering_lookup` (`employee_id`, `date`, `is_auto_covered`, `check_out_time`);
