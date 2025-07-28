const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess, checkResourceOwnership } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

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
// GET EMPLOYEE STATISTICS
// =============================================
router.get('/stats', 
  authenticate,
  checkPermission('employees.view'),
  asyncHandler(async (req, res) => {
    try {
      const db = getDB();
      
      // Get total counts (excluding terminated employees)
      const [totalCount] = await db.execute(`
        SELECT COUNT(*) as total 
        FROM employees 
        WHERE client_id = ? AND employment_status != 'terminated'
      `, [req.user.clientId]);

      // Get counts by employment status (excluding terminated)
      const [statusCounts] = await db.execute(`
        SELECT 
          employment_status,
          COUNT(*) as count
        FROM employees 
        WHERE client_id = ? AND employment_status != 'terminated'
        GROUP BY employment_status
      `, [req.user.clientId]);

      // Get counts by employment type (excluding terminated)
      const [typeCounts] = await db.execute(`
        SELECT 
          employee_type,
          COUNT(*) as count
        FROM employees 
        WHERE client_id = ? AND employment_status != 'terminated'
        GROUP BY employee_type
      `, [req.user.clientId]);

      // Get counts by department (excluding terminated)
      const [departmentCounts] = await db.execute(`
        SELECT 
          d.name as department,
          COUNT(e.id) as count
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id 
          AND e.client_id = ? 
          AND e.employment_status != 'terminated'
        WHERE d.client_id = ?
        GROUP BY d.id, d.name
        ORDER BY count DESC
      `, [req.user.clientId, req.user.clientId]);

      // Process the data into the expected format
      const stats = {
        total: totalCount[0].total,
        active: 0,
        inactive: 0,
        permanent: 0,
        contract: 0,
        intern: 0,
        by_department: departmentCounts.map(dept => ({
          department: dept.department,
          count: dept.count
        }))
      };

      // Fill in status counts
      statusCounts.forEach(status => {
        stats[status.employment_status] = status.count;
      });

      // Fill in type counts
      typeCounts.forEach(type => {
        stats[type.employee_type] = type.count;
      });

      res.status(200).json({
        success: true,
        message: 'Employee statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      console.error('Get employee stats error:', error);
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve employee statistics'
      });
    }
  })
);

// GET managers
router.get('/managers', 
  checkPermission('employees.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { department_id } = req.query;
    
    let whereClause = 'WHERE e.client_id = ? AND e.employment_status = "active"';
    let queryParams = [req.user.clientId];
    
    if (department_id) {
      whereClause += ' AND e.department_id = ?';
      queryParams.push(department_id);
    }
    
    const [managers] = await db.execute(`
      SELECT 
        e.id,
        CONCAT(e.first_name, ' ', e.last_name) as full_name,
        e.employee_code,
        d.name as department_name,
        des.title as designation_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      ${whereClause}
      ORDER BY e.first_name ASC, e.last_name ASC
    `, queryParams);

    res.status(200).json({
      success: true,
      data: {
        managers
      }
    });
  })
);

// Check employee ID availability
router.get('/check-id', 
  checkPermission('employees.create'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { employee_id } = req.query;
    
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }
    
    const [existing] = await db.execute(`
      SELECT id FROM employees 
      WHERE client_id = ? AND employee_id = ?
    `, [req.user.clientId, employee_id]);

    res.status(200).json({
      success: true,
      data: {
        available: existing.length === 0,
        employee_id
      }
    });
  })
);

// Check email availability
router.get('/check-email', 
  checkPermission('employees.create'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const [existing] = await db.execute(`
      SELECT id FROM employees 
      WHERE client_id = ? AND email = ?
    `, [req.user.clientId, email]);

    res.status(200).json({
      success: true,
      data: {
        available: existing.length === 0,
        email
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
// Enhanced CREATE EMPLOYEE route
router.post('/', 
  checkPermission('employees.create'),
  asyncHandler(async (req, res) => {
    try {
      const db = getDB();
      const {
        // Personal Information
        first_name, last_name, email, phone, date_of_birth, gender,
        address, city, state, zip_code, nationality, marital_status,
        
        // Professional Information
        employee_id, department_id, designation_id, manager_id,
        hire_date, employment_status = 'active', employee_type,
        salary,
        
        // Emergency Contact
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      } = req.body;

      // Validation
      const requiredFields = {
        first_name, last_name, email, phone, date_of_birth, gender,
        employee_id, department_id, designation_id, hire_date, employee_type,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      };

      for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || value.toString().trim() === '') {
          return res.status(400).json({
            success: false,
            message: `${field.replace('_', ' ')} is required`,
            field
          });
        }
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
          field: 'email'
        });
      }

      // Check for duplicate employee ID
      const [existingId] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND employee_id = ?
      `, [req.user.clientId, employee_id]);

      if (existingId.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists',
          field: 'employee_id'
        });
      }

      // Check for duplicate email
      const [existingEmail] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND email = ?
      `, [req.user.clientId, email]);

      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email address already exists',
          field: 'email'
        });
      }

      // Verify department exists
      const [deptCheck] = await db.execute(`
        SELECT id FROM departments 
        WHERE id = ? AND client_id = ? AND is_active = TRUE
      `, [department_id, req.user.clientId]);

      if (deptCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected department not found',
          field: 'department_id'
        });
      }

      // Verify designation exists and belongs to department
      const [desigCheck] = await db.execute(`
        SELECT id FROM designations 
        WHERE id = ? AND department_id = ? AND client_id = ? AND is_active = TRUE
      `, [designation_id, department_id, req.user.clientId]);

      if (desigCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected designation not found or does not belong to the selected department',
          field: 'designation_id'
        });
      }

      // Generate UUID for employee
      const { v4: uuidv4 } = require('uuid');
      const employeeUuid = uuidv4();

      // Insert employee
      const insertQuery = `
        INSERT INTO employees (
          id, client_id, employee_id, first_name, last_name, email, phone,
          date_of_birth, gender, address, city, state, zip_code, nationality,
          marital_status, hire_date, department_id, designation_id, manager_id,
          employment_status, employee_type, salary,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const employeeData = [
        employeeUuid, req.user.clientId, employee_id, first_name, last_name, email, phone,
        date_of_birth, gender, address || null, city || null, state || null, zip_code || null, 
        nationality || null, marital_status || null, hire_date, department_id, designation_id, 
        manager_id || null, employment_status, employee_type, salary || null,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      ];

      await db.execute(insertQuery, employeeData);

      // Get created employee with relations
      const [newEmployee] = await db.execute(`
        SELECT 
          e.*,
          CONCAT(e.first_name, ' ', e.last_name) as full_name,
          d.name as department_name,
          des.title as designation_title,
          CONCAT(m.first_name, ' ', m.last_name) as manager_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN employees m ON e.manager_id = m.id
        WHERE e.id = ?
      `, [employeeUuid]);

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: {
          employee: newEmployee[0]
        }
      });

    } catch (error) {
      console.error('Create employee error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'Email address already exists',
            field: 'email'
          });
        } else if (error.sqlMessage.includes('employee_id')) {
          return res.status(400).json({
            success: false,
            message: 'Employee ID already exists',
            field: 'employee_id'
          });
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create employee'
      });
    }
  })
);

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