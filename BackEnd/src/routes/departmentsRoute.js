const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

router.use(authenticate);
router.use(ensureClientAccess);

// GET all departments
router.get('/',
  checkPermission('departments.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const [departments] = await db.execute(`
      SELECT 
        id,
        name,
        description,
        manager_id,
        (SELECT CONCAT(first_name, ' ', last_name) FROM employees WHERE id = d.manager_id) as manager_name,
        (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status != 'terminated') as employee_count,
        created_at,
        updated_at
      FROM departments d
      WHERE client_id = ? AND is_active = TRUE
      ORDER BY name ASC
    `, [req.user.clientId]);

    res.status(200).json({
      success: true,
      data: {
        departments
      }
    });
  })
);

// GET all departments **and** their employees
router.get('/with-employees',
  checkPermission('departments.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;

    // 1️⃣  Departments (same query you already have)
    const [departments] = await db.execute(
      `
        SELECT
          d.id,
          d.name,
          d.description,
          d.manager_id,
          (
            SELECT CONCAT(first_name, ' ', last_name)
            FROM employees
            WHERE id = d.manager_id
          ) AS manager_name,
          (
            SELECT COUNT(*)
            FROM employees
            WHERE department_id = d.id
              AND employment_status != 'terminated'
          ) AS employee_count,
          d.created_at,
          d.updated_at
        FROM departments d
        WHERE d.client_id = ?
          AND d.is_active = TRUE
        ORDER BY d.name ASC
      `,
      [clientId]
    );

    // 2️⃣  Employees (joined so we can expose department name, too)
    const [employees] = await db.execute(
      `
      SELECT
      e.id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.designation_id,
      des.title AS designation_name,
      e.employment_status,
      e.profile_image,
      e.department_id,
      d.name              AS department_name
    FROM employees e
    /* department join */
    JOIN departments d
      ON d.id = e.department_id
    /* designation join */
    JOIN designations des
      ON des.id = e.designation_id
    WHERE e.client_id = ?
      AND d.is_active = TRUE
      AND e.employment_status <> 'terminated'
    ORDER BY e.first_name, e.last_name
      `,
      [clientId]
    );

    // 3️⃣  Respond
    res.status(200).json({
      success: true,
      data: {
        departments, // array of departments
        employees,   // flat array of employees with department_name included
      },
    });
  })
);

// POST /departments – Add a new department
router.post(
  '/',
  checkPermission('departments.create'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    const { name, description = null, manager_id = null, budget = null } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: "Department name is required." });
    }

    // Check for duplicate department name within the same client
    const [existing] = await db.execute(
      `SELECT id FROM departments WHERE client_id = ? AND name = ? LIMIT 1`,
      [clientId, name]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Department with the same name already exists.",
      });
    }

    const [result] = await db.execute(
      `INSERT INTO departments (id, client_id, name, description, manager_id, budget, is_active, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
      [clientId, name, description, manager_id, budget]
    );

    res.status(201).json({
      success: true,
      message: "Department added successfully.",
      departmentId: result.insertId,
    });
  })
);

// PUT /departments/:id – Update a department
router.put(
  '/:id',
  checkPermission('departments.edit'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const departmentId = req.params.id;
    const clientId = req.user.clientId;
    const { name, description, manager_id, budget } = req.body;

    // Verify department exists and belongs to this client
    const [existing] = await db.execute(
      `SELECT id FROM departments WHERE id = ? AND client_id = ? AND is_active = TRUE LIMIT 1`,
      [departmentId, clientId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.',
      });
    }

    // Check for duplicate name (excluding current department)
    if (name) {
      const [duplicate] = await db.execute(
        `SELECT id FROM departments WHERE client_id = ? AND name = ? AND id != ? LIMIT 1`,
        [clientId, name, departmentId]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Department with the same name already exists.',
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (manager_id !== undefined) {
      updates.push('manager_id = ?');
      values.push(manager_id);
    }
    if (budget !== undefined) {
      updates.push('budget = ?');
      values.push(budget);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.',
      });
    }

    updates.push('updated_at = NOW()');
    values.push(departmentId, clientId);

    await db.execute(
      `UPDATE departments SET ${updates.join(', ')} WHERE id = ? AND client_id = ?`,
      values
    );

    res.status(200).json({
      success: true,
      message: 'Department updated successfully.',
    });
  })
);

router.get(
  '/with-designations',
  checkPermission('departments.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;

    // Get all active departments
    const [departments] = await db.execute(
      `
      SELECT
        d.id,
        d.name,
        d.description,
        d.manager_id,
        (
          SELECT CONCAT(first_name, ' ', last_name)
          FROM employees
          WHERE id = d.manager_id
        ) AS manager_name,
        (
          SELECT COUNT(*)
          FROM employees
          WHERE department_id = d.id
            AND employment_status != 'terminated'
        ) AS employee_count,
        d.created_at,
        d.updated_at
      FROM departments d
      WHERE d.client_id = ?
        AND d.is_active = TRUE
      ORDER BY d.name ASC
      `,
      [clientId]
    );

    // Get designations with department reference
const [designations] = await db.execute(
  `
    SELECT
      des.id,
      des.title AS designation_name,
      des.responsibilities,
      des.department_id
    FROM designations des
    JOIN departments d ON d.id = des.department_id
    WHERE d.client_id = ?
      AND d.is_active = TRUE
      AND des.is_active = TRUE
    ORDER BY des.title ASC
  `,
  [req.user.clientId]
);

    res.status(200).json({
      success: true,
      data: {
        departments,
        designations,
      },
    });
  })
);

// routes/departments.js
router.delete(
  '/:id',
  checkPermission('departments.delete'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const departmentId = req.params.id;
    const clientId = req.user.clientId;

    // 1️⃣ Verify department exists and is active
    const [existing] = await db.execute(
      `SELECT id FROM departments WHERE id = ? AND client_id = ? AND is_active = 1 LIMIT 1`,
      [departmentId, clientId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found or already inactive.',
      });
    }

    // 2️⃣ Check if any active employees belong to it
    const [empCount] = await db.execute(
      `SELECT COUNT(*) as count FROM employees WHERE department_id = ? AND client_id = ? AND employment_status != 'terminated'`,
      [departmentId, clientId]
    );

    if (empCount[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete department — it has active employees.',
      });
    }

    // 3️⃣ Soft-delete department
    await db.execute(
      `UPDATE departments SET is_active = 0, updated_at = NOW() WHERE id = ? AND client_id = ?`,
      [departmentId, clientId]
    );

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully (soft delete).',
    });
  })
);

module.exports = router;