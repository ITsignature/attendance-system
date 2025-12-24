-- Insert admin user for Eduzon client
-- This script creates an admin user for the Eduzon client with hr-admin role
-- Password: "admin123" (hashed with bcrypt, cost factor 12)
-- ⚠️ IMPORTANT: Change the password after first login!

-- Get the Eduzon client ID
SET @eduzon_client_id = (SELECT id FROM clients WHERE name = 'Eduzon' LIMIT 1);

-- Create or get hr-admin role for Eduzon
SET @role_id = (SELECT id FROM roles WHERE client_id = @eduzon_client_id AND name = 'hr-admin' LIMIT 1);

-- If no hr-admin role exists, create one
INSERT INTO roles (id, client_id, name, description, access_level, is_system_role, is_active)
SELECT UUID(), @eduzon_client_id, 'hr-admin', 'HR Administrator role for Eduzon', 'full', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE client_id = @eduzon_client_id AND name = 'hr-admin');

-- Get the role ID again
SET @role_id = (SELECT id FROM roles WHERE client_id = @eduzon_client_id AND name = 'hr-admin' LIMIT 1);

-- Create admin user
-- Password hash for "admin123" (bcrypt cost 12)
-- You should change this password after first login
INSERT INTO admin_users (
  id,
  client_id,
  name,
  email,
  password_hash,
  role_id,
  is_super_admin,
  is_active
) VALUES (
  UUID(),
  @eduzon_client_id,
  'Eduzon Admin',
  'admin@eduzon.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWZvxaS6',
  @role_id,
  FALSE,
  TRUE
);

-- Verify the insert
SELECT
  au.id,
  au.name,
  au.email,
  c.name as client_name,
  r.name as role_name,
  au.is_active
FROM admin_users au
JOIN clients c ON au.client_id = c.id
LEFT JOIN roles r ON au.role_id = r.id
WHERE c.name = 'Eduzon';

-- Display credentials
SELECT '==========================================';
SELECT 'Eduzon Admin User Created Successfully!';
SELECT '==========================================';
SELECT 'Email: admin@eduzon.com';
SELECT 'Password: admin123';
SELECT '⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!';
SELECT '==========================================';
