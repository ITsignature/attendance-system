const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

const router = express.Router();

// All routes require super admin access
router.use(authenticate);
router.use(requireSuperAdmin);

// =============================================
// GET ALL CLIENTS
// =============================================
router.get('/',
  asyncHandler(async (req, res) => {
    const db = getDB();

    const [clients] = await db.execute(`
      SELECT
        c.*,
        COUNT(DISTINCT au.id) as admin_count,
        COUNT(DISTINCT e.id) as employee_count
      FROM clients c
      LEFT JOIN admin_users au ON c.id = au.client_id
      LEFT JOIN employees e ON c.id = e.client_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.status(200).json({
      success: true,
      data: clients
    });
  })
);

// =============================================
// GET SINGLE CLIENT
// =============================================
router.get('/:id',
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { id } = req.params;

    const [clients] = await db.execute(`
      SELECT * FROM clients WHERE id = ?
    `, [id]);

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get admin users for this client
    const [adminUsers] = await db.execute(`
      SELECT
        au.id,
        au.name,
        au.email,
        au.department,
        au.is_active,
        au.last_login_at,
        r.name as role_name
      FROM admin_users au
      LEFT JOIN roles r ON au.role_id = r.id
      WHERE au.client_id = ?
      ORDER BY au.created_at DESC
    `, [id]);

    res.status(200).json({
      success: true,
      data: {
        ...clients[0],
        adminUsers
      }
    });
  })
);

// =============================================
// CREATE NEW CLIENT
// =============================================
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Client name is required'),
    body('contact_email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('subscription_plan').isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan'),
    body('subscription_expires_at').optional().isISO8601().withMessage('Invalid date format')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const {
      name,
      description,
      contact_email,
      phone,
      address,
      subscription_plan,
      subscription_expires_at
    } = req.body;

    const clientId = uuidv4();

    await db.execute(`
      INSERT INTO clients (
        id, name, description, contact_email, phone, address,
        subscription_plan, subscription_expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [
      clientId,
      name,
      description || null,
      contact_email,
      phone || null,
      address || null,
      subscription_plan,
      subscription_expires_at || null
    ]);

    const [newClient] = await db.execute(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    );

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: newClient[0]
    });
  })
);

// =============================================
// UPDATE CLIENT
// =============================================
router.put('/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('contact_email').optional().isEmail(),
    body('subscription_plan').optional().isIn(['basic', 'premium', 'enterprise']),
    body('is_active').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { id } = req.params;
    const updates = req.body;

    // Check if client exists
    const [existing] = await db.execute(
      'SELECT id FROM clients WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Build dynamic update query
    const allowedFields = [
      'name', 'description', 'contact_email', 'phone', 'address',
      'subscription_plan', 'subscription_expires_at', 'is_active'
    ];

    const updateFields = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id);

    await db.execute(
      `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    const [updatedClient] = await db.execute(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: updatedClient[0]
    });
  })
);

// =============================================
// DELETE CLIENT (Soft delete - set is_active to FALSE)
// =============================================
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { id } = req.params;

    const [existing] = await db.execute(
      'SELECT id FROM clients WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    await db.execute(
      'UPDATE clients SET is_active = FALSE WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Client deactivated successfully'
    });
  })
);

// =============================================
// CREATE ADMIN USER FOR CLIENT
// =============================================
router.post('/:clientId/admin-users',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('department').optional().trim(),
    body('role_id').notEmpty().withMessage('Role is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { clientId } = req.params;
    const { name, email, password, department, role_id } = req.body;

    // Check if client exists
    const [client] = await db.execute(
      'SELECT id FROM clients WHERE id = ?',
      [clientId]
    );

    if (client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if email already exists
    const [existingUser] = await db.execute(
      'SELECT id FROM admin_users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if role exists
    const [role] = await db.execute(
      'SELECT id FROM roles WHERE id = ?',
      [role_id]
    );

    if (role.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await db.execute(`
      INSERT INTO admin_users (
        id, client_id, name, email, password_hash, role_id, department,
        is_super_admin, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, TRUE)
    `, [
      userId,
      clientId,
      name,
      email,
      hashedPassword,
      role_id,
      department || null
    ]);

    const [newUser] = await db.execute(`
      SELECT
        au.id,
        au.name,
        au.email,
        au.client_id,
        au.department,
        au.is_active,
        r.name as role_name
      FROM admin_users au
      LEFT JOIN roles r ON au.role_id = r.id
      WHERE au.id = ?
    `, [userId]);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: newUser[0]
    });
  })
);

// =============================================
// GET AVAILABLE ROLES FOR CLIENT
// =============================================
router.get('/:clientId/roles',
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { clientId } = req.params;

    // Get system roles and client-specific roles
    const [roles] = await db.execute(`
      SELECT
        id,
        name,
        description,
        access_level,
        is_system_role
      FROM roles
      WHERE (is_system_role = TRUE OR client_id = ?)
        AND is_active = TRUE
      ORDER BY is_system_role DESC, name ASC
    `, [clientId]);

    res.status(200).json({
      success: true,
      data: roles
    });
  })
);

module.exports = router;
