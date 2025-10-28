-- =============================================
-- FIX PAYROLL COMPONENTS CATEGORY ENUM
-- =============================================
-- Add 'financial', 'attendance', and 'statutory' to category enum

-- Add missing enum values to payroll_components.category
ALTER TABLE `payroll_components`
MODIFY `category` enum(
    'basic',
    'allowance',
    'bonus',
    'tax',
    'insurance',
    'loan',
    'other',
    'financial',    -- For loans, advances, bonuses from financial records
    'attendance',   -- For attendance-based deductions
    'statutory'     -- For EPF, ETF, etc.
) NOT NULL;

-- Verify the change
SHOW COLUMNS FROM payroll_components WHERE Field = 'category';