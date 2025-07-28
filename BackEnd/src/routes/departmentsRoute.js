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
  checkPermission('employees.view'),
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

module.exports = router;