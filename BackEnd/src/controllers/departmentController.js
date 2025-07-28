const { getDB } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

const departmentController = {
  getAllDepartments: asyncHandler(async (req, res) => {
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
  }),

  createDepartment: asyncHandler(async (req, res) => {
    const { name, description, manager_id } = req.body;
    const db = getDB();
    
    const [result] = await db.execute(
      'INSERT INTO departments (name, description, manager_id, client_id) VALUES (?, ?, ?, ?)',
      [name, description, manager_id, req.user.clientId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: {
        departmentId: result.insertId
      }
    });
  }),

  updateDepartment: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, manager_id } = req.body;
    const db = getDB();
    
    await db.execute(
      'UPDATE departments SET name = ?, description = ?, manager_id = ? WHERE id = ? AND client_id = ?',
      [name, description, manager_id, id, req.user.clientId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Department updated successfully'
    });
  }),

  deleteDepartment: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    
    await db.execute(
      'UPDATE departments SET is_active = FALSE WHERE id = ? AND client_id = ?',
      [id, req.user.clientId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  })
};

module.exports = departmentController;