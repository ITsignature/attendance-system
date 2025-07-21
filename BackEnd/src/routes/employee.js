const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { checkPermission, ensureClientAccess, checkResourceOwnership } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Apply authentication and client access to all routes
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// GET ALL EMPLOYEES
// =============================================
router.get('/', 
  checkPermission('employees.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    // Query parameters for filtering and pagination
    const {
      page = 1,
      limit = 10,
      search = '',
      department = '',
      designation = '',
      status = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build WHERE clause
    let whereClause = 'WHERE e.client_id = ?';
    let queryParams = [req.user.clientId];
    
    if (search) {
      whereClause += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_code LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (department) {
      whereClause += ' AND d.name = ?';
      queryParams.push(department);
    }
    
    if (designation) {
      whereClause += ' AND des.title = ?';
      queryParams.push(designation);
    }
    
    if (status) {
      whereClause += ' AND e.employment_status = ?';
      queryParams.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      ${whereClause}
    `;
    
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get employees with pagination
    const query = `
      SELECT 
        e.*,
        CONCAT(e.first_name, ' ', e.last_name) as full_name,
        d.name as department_name,
        des.title as designation_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) as years_of_service
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employees m ON e.manager_id = m.id
      ${whereClause}
      ORDER BY e.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    const [employees] = await db.execute(query, queryParams);

    res.status(200).json({
      success: true,
      data: {
        employees,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          recordsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// =============================================
// GET SINGLE EMPLOYEE
// =============================================
router.get('/:id', 
  checkPermission('employees.view'),
  checkResourceOwnership('employee'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const [employees] = await db.execute(`
      SELECT 
        e.*,
        CONCAT(e.first_name, ' ', e.last_name) as full_name,
        d.name as department_name,
        des.title as designation_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE()) as years_of_service
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = ? AND e.client_id = ?
    `, [req.params.id, req.user.clientId]);

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get recent attendance summary
    const [attendanceSummary] = await db.execute(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        AVG(total_hours) as avg_hours
      FROM attendance
      WHERE employee_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `, [req.params.id]);

    res.status(200).json({
      success: true,
      data: {
        employee: employees[0],
        attendanceSummary: attendanceSummary[0]
      }
    });
  })
);

// =============================================
// CREATE EMPLOYEE
// =============================================
router.post('/', [
  checkPermission('employees.create'),
  body('first_name').trim().isLength({ min: 1 }),
  body('last_name').trim().isLength({ min: 1 }),
  body('email').isEmail().normalizeEmail(),
  body('employee_code').trim().isLength({ min: 1 }),
  body('hire_date').isISO8601(),
  body('department_id').optional().isUUID(),
  body('designation_id').optional().isUUID(),
  body('base_salary').optional().isNumeric()
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
  const employeeId = uuidv4();
  
  const employeeData = {
    id: employeeId,
    client_id: req.user.clientId,
    employee_code: req.body.employee_code,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    email: req.body.email,
    phone: req.body.phone || null,
    date_of_birth: req.body.date_of_birth || null,
    gender: req.body.gender || null,
    address: req.body.address || null,
    city: req.body.city || null,
    state: req.body.state || null,
    zip_code: req.body.zip_code || null,
    nationality: req.body.nationality || null,
    marital_status: req.body.marital_status || null,
    hire_date: req.body.hire_date,
    department_id: req.body.department_id || null,
    designation_id: req.body.designation_id || null,
    manager_id: req.body.manager_id || null,
    employee_type: req.body.employee_type || 'permanent',
    work_location: req.body.work_location || 'office',
    employment_status: 'active',
    base_salary: req.body.base_salary || null,
    emergency_contact_name: req.body.emergency_contact_name || null,
    emergency_contact_phone: req.body.emergency_contact_phone || null,
    emergency_contact_relation: req.body.emergency_contact_relation || null
  };

  try {
    // Check for duplicate employee code within client
    const [existing] = await db.execute(`
      SELECT id FROM employees WHERE client_id = ? AND employee_code = ?
    `, [req.user.clientId, employeeData.employee_code]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Employee code already exists'
      });
    }

    // Insert employee
    const insertQuery = `
      INSERT INTO employees (
        id, client_id, employee_code, first_name, last_name, email, phone,
        date_of_birth, gender, address, city, state, zip_code, nationality,
        marital_status, hire_date, department_id, designation_id, manager_id,
        employee_type, work_location, employment_status, base_salary,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(insertQuery, Object.values(employeeData));

    // Get created employee with relations
    const [newEmployee] = await db.execute(`
      SELECT 
        e.*,
        CONCAT(e.first_name, ' ', e.last_name) as full_name,
        d.name as department_name,
        des.title as designation_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.id = ?
    `, [employeeId]);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        employee: newEmployee[0]
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
// DELETE EMPLOYEE
// =============================================
router.delete('/:id', 
  checkPermission('employees.delete'),
  checkResourceOwnership('employee'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const [result] = await db.execute(`
      UPDATE employees 
      SET employment_status = 'terminated', updated_at = NOW()
      WHERE id = ? AND client_id = ?
    `, [req.params.id, req.user.clientId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee terminated successfully'
    });
  })
);

module.exports = router;