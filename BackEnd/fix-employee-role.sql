-- =============================================
-- FIX EMPLOYEE ROLE
-- =============================================
-- This script fixes the role for employee users
-- who were created with the wrong role

-- 1. Check current status
SELECT
  au.id,
  au.email,
  au.name,
  r.name as current_role,
  au.employee_id,
  au.is_active
FROM admin_users au
LEFT JOIN roles r ON au.role_id = r.id
WHERE au.email = 'keerthina@gmail.com';

-- 2. Get the Employee role ID
SET @employee_role_id = (SELECT id FROM roles WHERE name = 'Employee' AND is_system_role = 1 LIMIT 1);

-- Display the Employee role ID
SELECT
  'Employee Role ID:' as info,
  @employee_role_id as role_id,
  name,
  description
FROM roles
WHERE id = @employee_role_id;

-- 3. Update the user's role to Employee
UPDATE admin_users
SET role_id = @employee_role_id
WHERE email = 'keerthina@gmail.com';

-- 4. Verify the update
SELECT
  '=== AFTER UPDATE ===' as status,
  au.id,
  au.email,
  au.name,
  r.name as role_name,
  au.employee_id,
  au.is_active
FROM admin_users au
LEFT JOIN roles r ON au.role_id = r.id
WHERE au.email = 'keerthina@gmail.com';

-- 5. Check permissions assigned to Employee role
SELECT
  '=== EMPLOYEE PERMISSIONS ===' as info,
  p.module,
  p.action,
  CONCAT(p.module, '.', p.action) as permission_string,
  p.name as permission_name
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id = @employee_role_id
ORDER BY p.module, p.action;
