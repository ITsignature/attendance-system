-- =============================================
-- LINK EMPLOYEE TO ADMIN USER
-- =============================================
-- This script links the admin_user to the employee record
-- by matching their email addresses

-- 1. Check current status
SELECT
  'BEFORE UPDATE' as status,
  au.id as admin_user_id,
  au.email,
  au.name,
  au.employee_id as current_employee_id,
  e.id as actual_employee_id,
  e.first_name,
  e.last_name,
  r.name as role_name
FROM admin_users au
LEFT JOIN employees e ON au.email = e.email
LEFT JOIN roles r ON au.role_id = r.id
WHERE au.email = 'keerthina@gmail.com';

-- 2. Update the admin_user to link to the employee
UPDATE admin_users au
JOIN employees e ON au.email = e.email
SET au.employee_id = e.id
WHERE au.email = 'keerthina@gmail.com'
  AND au.employee_id IS NULL;

-- 3. Verify the update
SELECT
  'AFTER UPDATE' as status,
  au.id as admin_user_id,
  au.email,
  au.name,
  au.employee_id,
  e.id as employee_id_from_table,
  e.first_name,
  e.last_name,
  e.employee_code,
  r.name as role_name,
  CASE
    WHEN au.employee_id IS NOT NULL THEN '✓ Linked'
    ELSE '✗ Not Linked'
  END as link_status
FROM admin_users au
LEFT JOIN employees e ON au.employee_id = e.id
LEFT JOIN roles r ON au.role_id = r.id
WHERE au.email = 'keerthina@gmail.com';

-- 4. If the employee doesn't exist, show this
SELECT
  'EMPLOYEE CHECK' as info,
  COUNT(*) as employee_exists
FROM employees
WHERE email = 'keerthina@gmail.com';

-- If count is 0, you need to create the employee first!
