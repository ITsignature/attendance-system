-- Migration: Add break tracking functionality
-- Date: 2026-01-22
-- Description: Adds support for flexible break time tracking with multiple breaks per day

-- Add break tracking fields to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS allowed_break_duration DECIMAL(4,2) DEFAULT 0.00
  COMMENT 'Total break duration allowed per shift in hours (e.g., 0.50 = 30 mins, 1.00 = 1 hour)',
ADD COLUMN IF NOT EXISTS track_break_times BOOLEAN DEFAULT FALSE
  COMMENT 'Enable break time tracking and salary deduction for this employee';

-- Add break summary fields to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS total_break_duration DECIMAL(4,2) DEFAULT 0.00
  COMMENT 'Total break time taken in hours',
ADD COLUMN IF NOT EXISTS excess_break_duration DECIMAL(4,2) DEFAULT 0.00
  COMMENT 'Break time exceeding allowed duration (for salary deduction)';

-- Create break_logs table for tracking multiple breaks per day
CREATE TABLE IF NOT EXISTS break_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  attendance_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  break_start_time TIME NOT NULL,
  break_end_time TIME NULL COMMENT 'NULL means break is still active',
  break_duration DECIMAL(4,2) DEFAULT 0.00 COMMENT 'Duration in hours',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_attendance_breaks (attendance_id),
  INDEX idx_employee_breaks (employee_id),
  INDEX idx_break_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for faster auto-process queries
CREATE INDEX IF NOT EXISTS idx_attendance_auto_checkout
  ON attendance(date, scheduled_out_time, check_out_time);

-- Add comments to existing columns for clarity
ALTER TABLE attendance
  MODIFY COLUMN break_start_time TIME DEFAULT NULL
    COMMENT 'DEPRECATED: Use break_logs table for break tracking',
  MODIFY COLUMN break_end_time TIME DEFAULT NULL
    COMMENT 'DEPRECATED: Use break_logs table for break tracking';
