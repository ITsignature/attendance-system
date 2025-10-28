const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

router.use(authenticate);
router.use(ensureClientAccess);

// GET all designations
router.get('/', 
  checkPermission('employees.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { department_id } = req.query;
    
    let whereClause = 'WHERE des.client_id = ? AND des.is_active = 1';
    let queryParams = [req.user.clientId];
    
    if (department_id) {
      whereClause += ' AND des.department_id = ?';
      queryParams.push(department_id);
    }
    
    const [designations] = await db.execute(`
      SELECT 
        des.id,
        des.title,
        des.department_id,
        d.name as department_name,
        des.min_salary,
        des.max_salary,
        (SELECT COUNT(*) FROM employees WHERE designation_id = des.id AND employment_status != 'terminated') as employee_count,
        des.created_at,
        des.updated_at
      FROM designations des
      LEFT JOIN departments d ON des.department_id = d.id
      ${whereClause}
      ORDER BY d.name ASC, des.title ASC
    `, queryParams);

    res.status(200).json({
      success: true,
      data: {
        designations
      }
    });
  })
);

// CREATE designation
router.post(
  '/',
  checkPermission('employees.create'),
  asyncHandler(async (req, res) => {
    const { title, department_id, responsibilities = null } = req.body;
    const db = getDB();
    const clientId = req.user.clientId;

    // 1. Validate required fields
    if (!title || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Title and department_id are required.',
      });
    }

    // 2. Ensure department exists and belongs to this client
    const [deptCheck] = await db.execute(
      'SELECT id FROM departments WHERE id = ? AND client_id = ? AND is_active = TRUE',
      [department_id, clientId]
    );
    if (deptCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.',
      });
    }

    // 3. Check for duplicate designation title per client and department
    const [existing] = await db.execute(
      `SELECT id FROM designations
       WHERE client_id = ? AND department_id = ? AND title = ? AND is_active = TRUE
       LIMIT 1`,
      [clientId, department_id, title]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A designation with this title already exists in this department.',
      });
    }

    // 4. Insert new designation
    const [result] = await db.execute(
      `
      INSERT INTO designations (
        id, client_id, title, department_id,
        responsibilities, is_active, created_at, updated_at
      ) VALUES (
        UUID(), ?, ?, ?, ?, TRUE, NOW(), NOW()
      )
      `,
      [clientId, title, department_id, responsibilities]
    );

    res.status(201).json({
      success: true,
      message: 'Designation created successfully.',
      data: {
        designationId: result.insertId || null,
      },
    });
  })
);




// routes/designations.js
router.delete(
  '/:id',
  checkPermission('employees.delete'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const designationId = req.params.id;
    const clientId = req.user.clientId;

    // 1️⃣ Check if designation exists and belongs to this client
    const [existing] = await db.execute(
      `SELECT id FROM designations WHERE id = ? AND client_id = ? AND is_active = TRUE LIMIT 1`,
      [designationId, clientId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found or already inactive.',
      });
    }

    // 2️⃣ Check if any employees are using this designation
    const [inUse] = await db.execute(
      `SELECT COUNT(*) AS count FROM employees WHERE designation_id = ? AND client_id = ?`,
      [designationId, clientId]
    );

    if (inUse[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete designation. It is assigned to one or more employees.',
      });
    }

    // 3️⃣ Soft-delete the designation
    await db.execute(
      `UPDATE designations SET is_active = FALSE, updated_at = NOW() WHERE id = ? AND client_id = ?`,
      [designationId, clientId]
    );

    res.status(200).json({
      success: true,
      message: 'Designation deleted (soft) successfully.',
    });
  })
);


module.exports = router;