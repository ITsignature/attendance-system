-- Add termination_date column to employees table
ALTER TABLE employees
ADD COLUMN termination_date DATE DEFAULT NULL COMMENT 'Date when employee was terminated or became inactive' AFTER hire_date;

-- Add index for performance when filtering or joining by termination_date
CREATE INDEX idx_employees_termination_date ON employees(termination_date);

