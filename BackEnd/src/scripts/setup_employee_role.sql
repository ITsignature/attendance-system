-- =============================================
-- EMPLOYEE ROLE SETUP SCRIPT
-- =============================================
-- This script creates the "Employee" role and assigns appropriate permissions
-- for the employee-facing portal interface.
--
-- Employee Portal Features:
-- 1. View own profile (read-only)
-- 2. View own attendance (read-only)
-- 3. View own payroll/payslips (read-only)
-- 4. View and apply for leaves (apply only, not approve/reject)
-- 5. View own financial records (read-only, no create/edit/delete)
-- =============================================

-- Create Employee role (if not exists)
INSERT INTO roles (
  id,
  client_id,
  name,
  description,
  access_level,
  is_system_role,
  is_editable,
  is_active
) VALUES (
  UUID(),
  NULL,  -- NULL for system-wide role
  'Employee',
  'Standard employee role with read-only access to own data and ability to apply for leaves',
  'basic',
  1,  -- System role, cannot be deleted
  0,  -- Not editable
  1   -- Active
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  access_level = VALUES(access_level);

-- Get the Employee role ID
SET @employee_role_id = (SELECT id FROM roles WHERE name = 'Employee' AND is_system_role = 1 LIMIT 1);

-- =============================================
-- EMPLOYEE PERMISSIONS
-- =============================================

-- 1. Profile viewing permission (if not exists)
INSERT INTO permissions (id, module, action, name, description, is_active)
VALUES (
  UUID(),
  'employee_profile',
  'view_own',
  'View Own Profile',
  'Permission to view own employee profile details',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- 2. Attendance viewing permission
INSERT INTO permissions (id, module, action, name, description, is_active)
VALUES (
  UUID(),
  'employee_attendance',
  'view_own',
  'View Own Attendance',
  'Permission to view own attendance records',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- 3. Payroll viewing permission
INSERT INTO permissions (id, module, action, name, description, is_active)
VALUES (
  UUID(),
  'employee_payroll',
  'view_own',
  'View Own Payroll',
  'Permission to view own payroll history and payslips',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- 4. Leave viewing permission
INSERT INTO permissions (id, module, action, name, description, is_active)
VALUES (
  UUID(),
  'employee_leaves',
  'view_own',
  'View Own Leaves',
  'Permission to view own leave requests',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- 5. Leave application permission
INSERT INTO permissions (id, module, action, name, description, is_active)
VALUES (
  UUID(),
  'employee_leaves',
  'apply',
  'Apply for Leave',
  'Permission to apply for new leave requests',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- 6. Financial records viewing permission
INSERT INTO permissions (id, module, action, name, description, is_active)
VALUES (
  UUID(),
  'employee_financial',
  'view_own',
  'View Own Financial Records',
  'Permission to view own loans, advances, and bonuses',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- =============================================
-- ASSIGN PERMISSIONS TO EMPLOYEE ROLE
-- =============================================

-- Clear existing permissions for Employee role to avoid duplicates
DELETE FROM role_permissions WHERE role_id = @employee_role_id;

-- Assign all employee permissions
INSERT INTO role_permissions (id, role_id, permission_id, granted_at, granted_by)
SELECT
  UUID(),
  @employee_role_id,
  p.id,
  NOW(),
  NULL  -- System assigned
FROM permissions p
WHERE p.module IN ('employee_profile', 'employee_attendance', 'employee_payroll', 'employee_leaves', 'employee_financial')
  AND p.is_active = 1;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify role was created
SELECT
  'Employee Role Created:' as status,
  id,
  name,
  description,
  access_level,
  is_system_role
FROM roles
WHERE name = 'Employee';

-- Verify permissions were created
SELECT
  'Permissions Created:' as status,
  COUNT(*) as permission_count
FROM permissions
WHERE module IN ('employee_profile', 'employee_attendance', 'employee_payroll', 'employee_leaves', 'employee_financial');

-- Verify role-permission assignments
SELECT
  'Role-Permission Assignments:' as status,
  COUNT(*) as assignment_count
FROM role_permissions
WHERE role_id = @employee_role_id;

-- Show all permissions assigned to Employee role
SELECT
  r.name as role_name,
  p.module,
  p.action,
  p.name as permission_name,
  p.description
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Employee'
ORDER BY p.module, p.action;

-- =============================================
-- INSTRUCTIONS FOR CREATING EMPLOYEE USERS
-- =============================================

/*
To create an employee user account:

1. First, ensure the employee record exists in the employees table
2. Create an admin_user linked to that employee:

INSERT INTO admin_users (
  id,
  client_id,
  employee_id,
  name,
  email,
  password_hash,
  role_id,
  department,
  is_super_admin,
  is_active
) VALUES (
  UUID(),
  '<client_id>',  -- The client this employee belongs to
  '<employee_id>',  -- Link to employees table
  '<employee_name>',
  '<employee_email>',
  '<bcrypt_hashed_password>',  -- Use bcrypt to hash the password
  (SELECT id FROM roles WHERE name = 'Employee' LIMIT 1),  -- Employee role
  '<department_name>',
  0,  -- NOT super admin
  1   -- Active
);

Example:
INSERT INTO admin_users (
  id,
  client_id,
  employee_id,
  name,
  email,
  password_hash,
  role_id,
  department,
  is_super_admin,
  is_active
) VALUES (
  UUID(),
  'abc123-client-id',
  'def456-employee-id',
  'John Doe',
  'john.doe@company.com',
  '$2a$12$someHashedPasswordHere',
  (SELECT id FROM roles WHERE name = 'Employee' LIMIT 1),
  'Engineering',
  0,
  1
);

3. The employee can now log in using their email and password
4. They will only have access to the employee portal endpoints:
   - GET /api/employee-portal/profile
   - GET /api/employee-portal/attendance
   - GET /api/employee-portal/payroll/history
   - GET /api/employee-portal/payroll/:id
   - GET /api/employee-portal/leaves/types
   - GET /api/employee-portal/leaves/balance
   - GET /api/employee-portal/leaves/my-requests
   - POST /api/employee-portal/leaves/apply
   - GET /api/employee-portal/financial-records
*/
