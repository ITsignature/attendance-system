const { getDB } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

const designationController = {
  getAllDesignations: asyncHandler(async (req, res) => {
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
        des.description,
        des.department_id,
        d.name as department_name,
        des.level,
        des.salary_range_min,
        des.salary_range_max,
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
  }),

  createDesignation: asyncHandler(async (req, res) => {
    const { title, description, department_id, level, salary_range_min, salary_range_max } = req.body;
    const db = getDB();
    
    const [result] = await db.execute(
      'INSERT INTO designations (title, description, department_id, level, salary_range_min, salary_range_max, client_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, department_id, level, salary_range_min, salary_range_max, req.user.clientId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: {
        designationId: result.insertId
      }
    });
  }),

  updateDesignation: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, department_id, level, salary_range_min, salary_range_max } = req.body;
    const db = getDB();
    
    await db.execute(
      'UPDATE designations SET title = ?, description = ?, department_id = ?, level = ?, salary_range_min = ?, salary_range_max = ? WHERE id = ? AND client_id = ?',
      [title, description, department_id, level, salary_range_min, salary_range_max, id, req.user.clientId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Designation updated successfully'
    });
  }),

  deleteDesignation: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    
    await db.execute(
      'UPDATE designations SET is_active = FALSE WHERE id = ? AND client_id = ?',
      [id, req.user.clientId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Designation deleted successfully'
    });
  })
};

module.exports = designationController;