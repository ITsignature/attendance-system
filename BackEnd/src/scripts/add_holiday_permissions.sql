-- =============================================
-- ADD HOLIDAY PERMISSIONS
-- =============================================

-- Insert holiday permissions
INSERT INTO permissions (id, module, action, name, description) VALUES
(UUID(), 'holidays', 'view', 'View Holidays', 'View holiday calendar and list'),
(UUID(), 'holidays', 'create', 'Create Holidays', 'Add new holidays to the calendar'),
(UUID(), 'holidays', 'edit', 'Edit Holidays', 'Modify existing holidays'),
(UUID(), 'holidays', 'delete', 'Delete Holidays', 'Remove holidays from the calendar')
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- UPDATE EXISTING ROLES WITH HOLIDAY PERMISSIONS
-- =============================================

-- Get permission IDs for holiday permissions
SET @holidays_view = (SELECT id FROM permissions WHERE module = 'holidays' AND action = 'view');
SET @holidays_create = (SELECT id FROM permissions WHERE module = 'holidays' AND action = 'create');
SET @holidays_edit = (SELECT id FROM permissions WHERE module = 'holidays' AND action = 'edit');
SET @holidays_delete = (SELECT id FROM permissions WHERE module = 'holidays' AND action = 'delete');

-- Assign holiday permissions to system roles

-- Super Admin: All holiday permissions
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
(UUID(), 'super-admin', @holidays_view),
(UUID(), 'super-admin', @holidays_create),
(UUID(), 'super-admin', @holidays_edit),
(UUID(), 'super-admin', @holidays_delete);

-- HR Admin: All holiday permissions
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
(UUID(), 'hr-admin', @holidays_view),
(UUID(), 'hr-admin', @holidays_create),
(UUID(), 'hr-admin', @holidays_edit),
(UUID(), 'hr-admin', @holidays_delete);

-- Manager: View only
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
(UUID(), 'manager', @holidays_view);

-- Employee Basic: View only
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
(UUID(), 'employee-basic', @holidays_view);

-- =============================================
-- VERIFICATION QUERY
-- =============================================
-- Run this to verify permissions were added correctly:
-- SELECT r.name as role_name, p.module, p.action, p.name as permission_name
-- FROM roles r
-- JOIN role_permissions rp ON r.id = rp.role_id
-- JOIN permissions p ON rp.permission_id = p.id
-- WHERE p.module = 'holidays'
-- ORDER BY r.name, p.action;