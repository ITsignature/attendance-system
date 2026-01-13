-- Migration: Add phone column to admin_users table for mobile login support
-- Date: 2026-01-12
-- Description: Adds phone column to support authentication via mobile number
--              Email and mobile number can both be used for login

-- Add phone column to admin_users table
ALTER TABLE `admin_users`
ADD COLUMN `phone` varchar(20) DEFAULT NULL AFTER `email`,
ADD UNIQUE KEY `unique_phone` (`phone`);

-- Optional: Update comment to reflect new login capabilities
ALTER TABLE `admin_users`
COMMENT = 'Admin users table with support for email or mobile login';

-- Note: During transition period, phone is optional (NULL allowed)
-- To make phone required later, run:
-- ALTER TABLE `admin_users` MODIFY COLUMN `phone` varchar(20) NOT NULL;
