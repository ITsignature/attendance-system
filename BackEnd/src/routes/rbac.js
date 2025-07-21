const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { checkPermission, ensureClientAccess } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);

// =============================================
// GET ALL PERMISSIONS
// =============================================
router.get('/permissions', 
  checkPermission('rbac.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const [permissions] = await db.execute(`
      SELECT * FROM permissions
      WHERE is_active = TRUE
      ORDER BY module, action
    `);

    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        permissions: groupedPermissions
      }
    });
  })
);

// =============================================
// GET ROLES
// =============================================
router.get('/roles', 
  checkPermission('rbac.view'),
  ensureClientAccess,
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    // Get roles for current client + system roles
    const [roles] = await db.execute(`
      SELECT 
        r.*,
        COUNT(rp.permission_id) as permission_count,
        COUNT(au.id) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN admin_users au ON r.id = au.role_id AND au.is_active = TRUE
      WHERE (r.client_id = ? OR r.client_id IS NULL)
      AND r.is_active = TRUE
      GROUP BY r.id
      ORDER BY r.is_system_role DESC, r.name
    `, [req.user.clientId]);

    res.status(200).json({
      success: true,
      data: {
        roles
      }
    });
  })
);

// =============================================
// GET ROLE WITH PERMISSIONS
// =============================================
router.get('/roles/:id', 
  checkPermission('rbac.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    // Get role details
    const [roles] = await db.execute(`
      SELECT * FROM roles WHERE id = ?
    `, [req.params.id]);

    if (roles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const role = roles[0];

    // Check access (super admin or same client)
    if (!req.user.isSuperAdmin && role.client_id !== req.user.clientId && role.client_id !== null) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get role permissions
    const [permissions] = await db.execute(`
      SELECT p.*
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.action
    `, [req.params.id]);

    res.status(200).json({
      success: true,
      data: {
        role: {
          ...role,
          permissions
        }
      }
    });
  })
);

// =============================================
// CREATE CUSTOM ROLE
// =============================================
router.post('/roles', [
  checkPermission('rbac.create'),
  ensureClientAccess,
  body('name').trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('access_level').isIn(['basic', 'moderate', 'full']),
  body('permissions').isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const roleId = uuidv4();
  
  // Check for duplicate role name within client
  const [existing] = await db.execute(`
    SELECT id FROM roles WHERE client_id = ? AND name = ?
  `, [req.user.clientId, req.body.name]);

  if (existing.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Role name already exists'
    });
  }

  // Start transaction
  await db.execute('START TRANSACTION');

  try {
    // Create role
    await db.execute(`
      INSERT INTO roles (id, client_id, name, description, access_level, is_system_role, is_editable)
      VALUES (?, ?, ?, ?, ?, FALSE, TRUE)
    `, [roleId, req.user.clientId, req.body.name, req.body.description || null, req.body.access_level]);

    // Add permissions
    if (req.body.permissions && req.body.permissions.length > 0) {
      const permissionValues = req.body.permissions.map(permId => [uuidv4(), roleId, permId, req.user.userId]);
      
      for (const values of permissionValues) {
        await db.execute(`
          INSERT INTO role_permissions (id, role_id, permission_id, granted_by)
          VALUES (?, ?, ?, ?)
        `, values);
      }
    }

    await db.execute('COMMIT');

    // Get created role with permissions
    const [newRole] = await db.execute(`
      SELECT r.*, COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [roleId]);

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        role: newRole[0]
      }
    });

  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}));

module.exports = router;