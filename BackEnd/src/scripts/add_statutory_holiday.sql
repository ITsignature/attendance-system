-- =============================================
-- ADD STATUTORY HOLIDAY FLAG
-- =============================================

-- Adds an is_statutory column to the holidays table so holidays can be
-- separately marked as statutory (government-mandated), independent of
-- the existing is_optional (Mandatory/Optional) flag.

ALTER TABLE `holidays`
  ADD COLUMN `is_statutory` tinyint(1) DEFAULT 0 AFTER `is_optional`;

-- =============================================
-- VERIFICATION QUERY
-- =============================================
-- Run this to verify the column was added correctly:
-- SELECT id, name, date, is_optional, is_statutory FROM holidays ORDER BY date;
