-- Migration: Populate fingerprint_id for it-signature client employees
-- Date: 2025-11-03
-- Purpose: Extract final digits from employee_code and set as fingerprint_id

-- Update fingerprint_id by extracting trailing digits from employee_code
-- Example: EMP000008 -> 8, EMP000016 -> 16
UPDATE employees e
JOIN clients c ON e.client_id = c.id
SET e.fingerprint_id = CAST(
    REGEXP_REPLACE(e.employee_code, '^[^0-9]*0*', '') AS UNSIGNED
)
WHERE c.name = 'it-signature'
  AND e.employee_code IS NOT NULL
  AND e.employee_code REGEXP '[0-9]+$';

Verification query (run after update to check results)
SELECT
  employee_code,
  fingerprint_id,
  CONCAT(first_name, ' ', last_name) as employee_name
FROM employees e
JOIN clients c ON e.client_id = c.id
WHERE c.name = 'it-signature'
ORDER BY fingerprint_id;
