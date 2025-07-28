const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

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
  console.log('🔍 Create role request body:', req.body);
  console.log('🔍 User info:', {
    userId: req.user?.userId,
    clientId: req.user?.clientId,
    isSuperAdmin: req.user?.isSuperAdmin
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('🔍 Validation errors:', errors.array());
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

  // Get connection for transaction
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    console.log('✅ Transaction started');

    // Create role
    await connection.execute(`
      INSERT INTO roles (id, client_id, name, description, access_level, is_system_role, is_editable)
      VALUES (?, ?, ?, ?, ?, FALSE, TRUE)
    `, [roleId, req.user.clientId, req.body.name, req.body.description || null, req.body.access_level]);

    console.log('✅ Role created with ID:', roleId);

    // Add permissions if provided
    if (req.body.permissions && req.body.permissions.length > 0) {
      console.log('🔄 Adding permissions:', req.body.permissions);
      
      // First, validate that all permission IDs exist
      const permissionPlaceholders = req.body.permissions.map(() => '?').join(',');
      const [validPermissions] = await connection.execute(`
        SELECT id FROM permissions WHERE id IN (${permissionPlaceholders}) AND is_active = TRUE
      `, req.body.permissions);

      console.log('🔍 Valid permissions found:', validPermissions.length, 'out of', req.body.permissions.length);

      if (validPermissions.length !== req.body.permissions.length) {
        const validIds = validPermissions.map(p => p.id);
        const invalidIds = req.body.permissions.filter(id => !validIds.includes(id));
        throw new Error(`Invalid permission IDs: ${invalidIds.join(', ')}`);
      }

      // Insert each permission individually
      let insertedCount = 0;
      for (const permissionId of req.body.permissions) {
        console.log(`🔄 Inserting permission: ${permissionId}`);
        
        const result = await connection.execute(`
          INSERT INTO role_permissions (id, role_id, permission_id, granted_by, granted_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [uuidv4(), roleId, permissionId, req.user.userId]);
        
        console.log(`✅ Permission inserted, affected rows:`, result[0].affectedRows);
        insertedCount++;
      }
      
      console.log(`✅ Total permissions inserted: ${insertedCount}`);
    } else {
      console.log('ℹ️ No permissions to add');
    }

    await connection.commit();
    console.log('✅ Transaction committed');

    // Get created role with actual permission count
    const [newRole] = await connection.execute(`
      SELECT 
        r.*,
        COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [roleId]);

    // Also get the actual permissions for verification
    const [rolePermissions] = await connection.execute(`
      SELECT 
        p.id,
        p.module,
        p.action,
        p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.action
    `, [roleId]);

    console.log('✅ Role created successfully');
    console.log('📋 Role details:', newRole[0]);
    console.log('🔑 Permissions assigned:', rolePermissions.length);

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        role: {
          ...newRole[0],
          permissions: rolePermissions.map(p => ({
            id: p.id,
            module: p.module,
            action: p.action,
            name: p.name
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in role creation:', error);
    await connection.rollback();
    console.log('🔄 Transaction rolled back');
    throw error;
  } finally {
    connection.release();
    console.log('🔄 Connection released');
  }
}));

// =============================================
// UPDATE ROLE
// =============================================
router.put('/roles/:id', [
  checkPermission('rbac.edit'),
  ensureClientAccess,
  body('name').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('access_level').optional().isIn(['basic', 'moderate', 'full']),
  body('permissions').optional().isArray()
], asyncHandler(async (req, res) => {
  console.log('🔍 Update role request:', req.params.id, req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const roleId = req.params.id;

  // Check if role exists and user has access
  const [existing] = await db.execute(`
    SELECT * FROM roles WHERE id = ?
  `, [roleId]);

  if (existing.length === 0) {
    console.log('🔍 Role not found')
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  const role = existing[0];

  // Check access (super admin or same client)
  if (!req.user.isSuperAdmin && role.client_id !== req.user.clientId && role.client_id !== null) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Can't edit system roles unless you're super admin
  if (role.is_system_role && !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Cannot edit system roles'
    });
  }

  // Get connection for transaction
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Update role basic info
    const allowedFields = ['name', 'description', 'access_level'];
    const updateFields = [];
    const updateValues = [];

    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        updateFields.push(`${field} = ?`);
        updateValues.push(req.body[field]);
      }
    });

    if (updateFields.length > 0) {
      updateFields.push('updated_at = NOW()');
      updateValues.push(roleId);

      const updateQuery = `
        UPDATE roles 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      await connection.execute(updateQuery, updateValues);
      console.log('✅ Role basic info updated');
    }

    // Update permissions if provided
    if (req.body.permissions && Array.isArray(req.body.permissions)) {
      console.log('🔄 Updating permissions:', req.body.permissions);

      // First, validate that all permission IDs exist
      if (req.body.permissions.length > 0) {
        const permissionPlaceholders = req.body.permissions.map(() => '?').join(',');
        const [validPermissions] = await connection.execute(`
          SELECT id FROM permissions WHERE id IN (${permissionPlaceholders}) AND is_active = TRUE
        `, req.body.permissions);

        if (validPermissions.length !== req.body.permissions.length) {
          const validIds = validPermissions.map(p => p.id);
          const invalidIds = req.body.permissions.filter(id => !validIds.includes(id));
          throw new Error(`Invalid permission IDs: ${invalidIds.join(', ')}`);
        }
      }

      // Remove all existing permissions for this role
      await connection.execute(`
        DELETE FROM role_permissions WHERE role_id = ?
      `, [roleId]);
      console.log('🗑️ Existing permissions removed');

      // Add new permissions
      if (req.body.permissions.length > 0) {
        for (const permissionId of req.body.permissions) {
          await connection.execute(`
            INSERT INTO role_permissions (id, role_id, permission_id, granted_by, granted_at)
            VALUES (?, ?, ?, ?, NOW())
          `, [uuidv4(), roleId, permissionId, req.user.userId]);
        }
        console.log(`✅ ${req.body.permissions.length} permissions added`);
      }
    }

    await connection.commit();
    console.log('✅ Transaction committed');

    // Get updated role with permissions
    const [updatedRole] = await connection.execute(`
      SELECT 
        r.*,
        COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [roleId]);

    // Get role permissions
    const [rolePermissions] = await connection.execute(`
      SELECT 
        p.id,
        p.module,
        p.action,
        p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.action
    `, [roleId]);

    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: {
        role: {
          ...updatedRole[0],
          permissions: rolePermissions.map(p => ({
            id: p.id,
            module: p.module,
            action: p.action,
            name: p.name
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error updating role:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// =============================================
// DELETE ROLE
// =============================================
router.delete('/roles/:id', [
  checkPermission('rbac.delete'),
  ensureClientAccess
], asyncHandler(async (req, res) => {
  console.log('🔍 Delete role request:', req.params.id);
  
  const db = getDB();
  const roleId = req.params.id;

  // Check if role exists and user has access
  const [existing] = await db.execute(`
    SELECT * FROM roles WHERE id = ?
  `, [roleId]);

  if (existing.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  const role = existing[0];

  // Check access (super admin or same client)
  if (!req.user.isSuperAdmin && role.client_id !== req.user.clientId && role.client_id !== null) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Can't delete system roles
  if (role.is_system_role) {
    return res.status(403).json({
      success: false,
      message: 'Cannot delete system roles'
    });
  }

  // Check if role is assigned to users
  const [assignedUsers] = await db.execute(`
    SELECT COUNT(*) as user_count FROM admin_users WHERE role_id = ?
  `, [roleId]);

  if (assignedUsers[0].user_count > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete role. It is assigned to ${assignedUsers[0].user_count} user(s). Please reassign users first.`
    });
  }

  // Get connection for transaction
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Delete role permissions first (foreign key constraint)
    await connection.execute(`
      DELETE FROM role_permissions WHERE role_id = ?
    `, [roleId]);
    console.log('🗑️ Role permissions deleted');

    // Delete the role
    await connection.execute(`
      DELETE FROM roles WHERE id = ?
    `, [roleId]);
    console.log('🗑️ Role deleted');

    await connection.commit();
    console.log('✅ Delete transaction committed');

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting role:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// =============================================
// ADMIN USER MANAGEMENT ROUTES
// Add these routes to your rbac.js file
// =============================================

const bcrypt = require('bcryptjs');

// =============================================
// GET ALL ADMIN USERS
// =============================================
router.get('/admin-users', [
  checkPermission('rbac.assign'),
  ensureClientAccess
], asyncHandler(async (req, res) => {
  const db = getDB();
  
  // Build query based on user access
  let query;
  let params;
  
  if (req.user.isSuperAdmin) {
    // Super admin can see users from all clients
    query = `
      SELECT 
        au.id,
        au.name,
        au.email,
        au.department,
        au.last_login_at,
        au.is_super_admin,
        au.is_active,
        au.created_at,
        au.updated_at,
        r.id as role_id,
        r.name as role_name,
        r.access_level,
        c.id as client_id,
        c.name as client_name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      LEFT JOIN clients c ON au.client_id = c.id
      ORDER BY au.created_at DESC
    `;
    params = [];
  } else {
    // Regular users can only see users from their client
    query = `
      SELECT 
        au.id,
        au.name,
        au.email,
        au.department,
        au.last_login_at,
        au.is_super_admin,
        au.is_active,
        au.created_at,
        au.updated_at,
        r.id as role_id,
        r.name as role_name,
        r.access_level,
        c.id as client_id,
        c.name as client_name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      LEFT JOIN clients c ON au.client_id = c.id
      WHERE au.client_id = ?
      ORDER BY au.created_at DESC
    `;
    params = [req.user.clientId];
  }
  
  const [users] = await db.execute(query, params);
  
  res.status(200).json({
    success: true,
    data: {
      users: users.map(user => ({
        ...user,
        // Don't expose sensitive fields
        password_hash: undefined
      }))
    }
  });
}));

// =============================================
// GET SINGLE ADMIN USER
// =============================================
router.get('/admin-users/:id', [
  checkPermission('rbac.assign'),
  ensureClientAccess
], asyncHandler(async (req, res) => {
  const db = getDB();
  const userId = req.params.id;
  
  const [users] = await db.execute(`
    SELECT 
      au.id,
      au.name,
      au.email,
      au.department,
      au.last_login_at,
      au.is_super_admin,
      au.is_active,
      au.created_at,
      au.updated_at,
      r.id as role_id,
      r.name as role_name,
      r.access_level,
      c.id as client_id,
      c.name as client_name
    FROM admin_users au
    JOIN roles r ON au.role_id = r.id
    LEFT JOIN clients c ON au.client_id = c.id
    WHERE au.id = ?
  `, [userId]);

  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = users[0];

  // Check access (super admin or same client)
  if (!req.user.isSuperAdmin && user.client_id !== req.user.clientId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        ...user,
        password_hash: undefined
      }
    }
  });
}));

// =============================================
// CREATE ADMIN USER
// =============================================
router.post('/admin-users', [
  checkPermission('rbac.assign'),
  ensureClientAccess,
  body('name').trim().isLength({ min: 1 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role_id').isUUID(),
  body('department').optional().trim(),
  body('is_active').optional().isBoolean()
], asyncHandler(async (req, res) => {
  console.log('🔍 Create admin user request:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const userId = uuidv4();
  
  // Check if email already exists
  const [existing] = await db.execute(`
    SELECT id FROM admin_users WHERE email = ?
  `, [req.body.email]);

  if (existing.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists'
    });
  }

  // Verify role exists and user has access to assign it
  const [roles] = await db.execute(`
    SELECT * FROM roles WHERE id = ?
  `, [req.body.role_id]);

  if (roles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role ID'
    });
  }

  const role = roles[0];

  // Check if user can assign this role
  if (!req.user.isSuperAdmin) {
    // Non-super admins can only assign roles from their client
    if (role.client_id !== req.user.clientId && role.client_id !== null) {
      return res.status(403).json({
        success: false,
        message: 'Cannot assign roles from other clients'
      });
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(req.body.password, 12);

  // Determine client_id
  let clientId;
  if (req.user.isSuperAdmin && req.body.client_id) {
    clientId = req.body.client_id;
  } else {
    clientId = req.user.clientId;
  }

  const userData = {
    id: userId,
    client_id: clientId,
    name: req.body.name,
    email: req.body.email,
    password_hash: passwordHash,
    role_id: req.body.role_id,
    department: req.body.department || null,
    is_super_admin: req.body.is_super_admin || false,
    is_active: req.body.is_active !== false // Default to true
  };

  try {
    // Insert user
    await db.execute(`
      INSERT INTO admin_users (
        id, client_id, name, email, password_hash, role_id, 
        department, is_super_admin, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(userData));

    // Get created user with role info
    const [newUser] = await db.execute(`
      SELECT 
        au.id,
        au.name,
        au.email,
        au.department,
        au.is_super_admin,
        au.is_active,
        au.created_at,
        r.id as role_id,
        r.name as role_name,
        r.access_level,
        c.id as client_id,
        c.name as client_name
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      LEFT JOIN clients c ON au.client_id = c.id
      WHERE au.id = ?
    `, [userId]);

    console.log('✅ Admin user created successfully');

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        user: newUser[0]
      }
    });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    throw error;
  }
}));

// =============================================
// UPDATE ADMIN USER
// =============================================
router.put('/admin-users/:id', [
  checkPermission('rbac.assign'),
  ensureClientAccess,
  body('name').optional().trim().isLength({ min: 1 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role_id').optional().isUUID(),
  body('department').optional().trim(),
  body('is_active').optional().isBoolean()
], asyncHandler(async (req, res) => {
  console.log('🔍 Update admin user request:', req.params.id, req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const userId = req.params.id;

  // Check if user exists and get current data
  const [existing] = await db.execute(`
    SELECT au.*, c.name as client_name
    FROM admin_users au
    LEFT JOIN clients c ON au.client_id = c.id
    WHERE au.id = ?
  `, [userId]);

  if (existing.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const currentUser = existing[0];

  // Check access (super admin or same client)
  if (!req.user.isSuperAdmin && currentUser.client_id !== req.user.clientId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Can't modify super admin users unless you're also super admin
  if (currentUser.is_super_admin && !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Cannot modify super admin users'
    });
  }

  // Build update query
  const allowedFields = ['name', 'email', 'role_id', 'department', 'is_active'];
  const updateFields = [];
  const updateValues = [];

  allowedFields.forEach(field => {
    if (req.body.hasOwnProperty(field)) {
      updateFields.push(`${field} = ?`);
      updateValues.push(req.body[field]);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields to update'
    });
  }

  // If updating role, verify it exists and is accessible
  if (req.body.role_id) {
    const [roles] = await db.execute(`
      SELECT * FROM roles WHERE id = ?
    `, [req.body.role_id]);

    if (roles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID'
      });
    }

    const role = roles[0];

    // Check if user can assign this role
    if (!req.user.isSuperAdmin) {
      if (role.client_id !== req.user.clientId && role.client_id !== null) {
        return res.status(403).json({
          success: false,
          message: 'Cannot assign roles from other clients'
        });
      }
    }
  }

  // Check email uniqueness if updating email
  if (req.body.email && req.body.email !== currentUser.email) {
    const [emailCheck] = await db.execute(`
      SELECT id FROM admin_users WHERE email = ? AND id != ?
    `, [req.body.email, userId]);

    if (emailCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(userId);

  const updateQuery = `
    UPDATE admin_users 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `;

  await db.execute(updateQuery, updateValues);

  // Get updated user
  const [updatedUser] = await db.execute(`
    SELECT 
      au.id,
      au.name,
      au.email,
      au.department,
      au.is_super_admin,
      au.is_active,
      au.created_at,
      au.updated_at,
      r.id as role_id,
      r.name as role_name,
      r.access_level,
      c.id as client_id,
      c.name as client_name
    FROM admin_users au
    JOIN roles r ON au.role_id = r.id
    LEFT JOIN clients c ON au.client_id = c.id
    WHERE au.id = ?
  `, [userId]);

  console.log('✅ Admin user updated successfully');

  res.status(200).json({
    success: true,
    message: 'Admin user updated successfully',
    data: {
      user: updatedUser[0]
    }
  });
}));

// =============================================
// DELETE ADMIN USER
// =============================================
router.delete('/admin-users/:id', [
  checkPermission('rbac.assign'),
  ensureClientAccess
], asyncHandler(async (req, res) => {
  console.log('🔍 Delete admin user request:', req.params.id);
  
  const db = getDB();
  const userId = req.params.id;

  // Check if user exists
  const [existing] = await db.execute(`
    SELECT * FROM admin_users WHERE id = ?
  `, [userId]);

  if (existing.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = existing[0];

  // Check access (super admin or same client)
  if (!req.user.isSuperAdmin && user.client_id !== req.user.clientId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Can't delete super admin users unless you're also super admin
  if (user.is_super_admin && !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Cannot delete super admin users'
    });
  }

  // Can't delete yourself
  if (userId === req.user.userId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account'
    });
  }

  // Get connection for transaction
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Delete user sessions first
    await connection.execute(`
      DELETE FROM user_sessions WHERE admin_user_id = ?
    `, [userId]);

    // Delete the user
    await connection.execute(`
      DELETE FROM admin_users WHERE id = ?
    `, [userId]);

    await connection.commit();
    console.log('✅ Admin user deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Admin user deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting admin user:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// =============================================
// ASSIGN ROLE TO USER (Alternative endpoint)
// =============================================
router.put('/admin-users/:id/assign-role', [
  checkPermission('rbac.assign'),
  ensureClientAccess,
  body('role_id').isUUID()
], asyncHandler(async (req, res) => {
  console.log('🔍 Assign role request:', req.params.id, req.body.role_id);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const userId = req.params.id;
  const roleId = req.body.role_id;

  // Check if user exists
  const [users] = await db.execute(`
    SELECT * FROM admin_users WHERE id = ?
  `, [userId]);

  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = users[0];

  // Check access
  if (!req.user.isSuperAdmin && user.client_id !== req.user.clientId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Verify role exists and is accessible
  const [roles] = await db.execute(`
    SELECT * FROM roles WHERE id = ?
  `, [roleId]);

  if (roles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role ID'
    });
  }

  const role = roles[0];

  // Check if user can assign this role
  if (!req.user.isSuperAdmin) {
    if (role.client_id !== req.user.clientId && role.client_id !== null) {
      return res.status(403).json({
        success: false,
        message: 'Cannot assign roles from other clients'
      });
    }
  }

  // Update user role
  await db.execute(`
    UPDATE admin_users 
    SET role_id = ?, updated_at = NOW()
    WHERE id = ?
  `, [roleId, userId]);

  // Get updated user with role info
  const [updatedUser] = await db.execute(`
    SELECT 
      au.id,
      au.name,
      au.email,
      au.department,
      au.is_super_admin,
      au.is_active,
      r.id as role_id,
      r.name as role_name,
      r.access_level,
      c.id as client_id,
      c.name as client_name
    FROM admin_users au
    JOIN roles r ON au.role_id = r.id
    LEFT JOIN clients c ON au.client_id = c.id
    WHERE au.id = ?
  `, [userId]);

  console.log('✅ Role assigned successfully');

  res.status(200).json({
    success: true,
    message: 'Role assigned successfully',
    data: {
      user: updatedUser[0]
    }
  });
}));

module.exports = router;