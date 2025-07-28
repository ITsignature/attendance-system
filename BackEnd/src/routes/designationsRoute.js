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
    
    let whereClause = 'WHERE des.client_id = ? AND des.is_active = TRUE';
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
router.post('/', 
  checkPermission('employees.create'),
  asyncHandler(async (req, res) => {
    const { title, department_id, salary_range_min, salary_range_max } = req.body;
    const db = getDB();
    
    // Validation
    if (!title || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Title and department_id are required'
      });
    }
    
    // Check if department exists
    const [deptCheck] = await db.execute(
      'SELECT id FROM departments WHERE id = ? AND client_id = ?',
      [department_id, req.user.clientId]
    );
    
    if (deptCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Insert new designation
    const [result] = await db.execute(`
      INSERT INTO designations (title, department_id, min_salary, max_salary, client_id, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `, [title, department_id, salary_range_min || null, salary_range_max || null, req.user.clientId]);
    
    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: {
        designationId: result.insertId
      }
    });
  })
);

module.exports = router;