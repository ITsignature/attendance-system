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
    const { employee_code } = req.query;
    
    if (!employee_code) {
      return res.status(400).json({
        success: false,
        message: 'Employee code is required'
      });
    }
    
    const [existing] = await db.execute(`
      SELECT id FROM employees 
      WHERE client_id = ? AND employee_code = ?
    `, [req.user.clientId, employee_code]);

    res.status(200).json({
      success: true,
      data: {
        available: existing.length === 0,
        employee_code
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
// UPDATE EMPLOYEE
// =============================================
router.put('/:id', [
  checkPermission('employees.edit'),
  checkResourceOwnership('employee'),
  // Validation middleware
  body('first_name').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('last_name').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
  body('phone').optional().trim().isLength({ min: 10 }).withMessage('Phone number must be at least 10 digits'),
  body('date_of_birth').optional().isISO8601().withMessage('Please enter a valid date'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('employee_code').optional().trim().isLength({ min: 1 }).withMessage('Employee code cannot be empty'),
  body('department_id').optional().isUUID().withMessage('Invalid department ID'),
  body('designation_id').optional().isUUID().withMessage('Invalid designation ID'),
  body('manager_id').optional().isUUID().withMessage('Invalid manager ID'),
  body('hire_date').optional().isISO8601().withMessage('Please enter a valid hire date'),
  body('employment_status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']).withMessage('Invalid employment status'),
  body('employee_type').optional().isIn(['full_time', 'part_time', 'contract', 'intern']).withMessage('Invalid employee type'),
  body('base_salary').optional().isNumeric().withMessage('Base salary must be a number'),
  body('marital_status').optional().isIn(['single', 'married', 'divorced', 'widowed']).withMessage('Invalid marital status')
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const employeeId = req.params.id;

    console.log('🔄 Updating employee:', employeeId);
    console.log('📝 Update data:', JSON.stringify(req.body, null, 2));

    // Get current employee record
    const [currentEmployee] = await db.execute(`
      SELECT e.*, c.id as client_id
      FROM employees e
      JOIN clients c ON e.client_id = c.id
      WHERE e.id = ? AND e.client_id = ?
    `, [employeeId, req.user.clientId]);

    if (currentEmployee.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const current = currentEmployee[0];

    // Check for duplicate employee_code if being updated
    if (req.body.employee_code && req.body.employee_code !== current.employee_code) {
      const [existingCode] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND employee_code = ? AND id != ?
      `, [req.user.clientId, req.body.employee_code, employeeId]);

      if (existingCode.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Employee code already exists',
          field: 'employee_code'
        });
      }
    }

    // Check for duplicate email if being updated
    if (req.body.email && req.body.email !== current.email) {
      const [existingEmail] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND email = ? AND id != ?
      `, [req.user.clientId, req.body.email, employeeId]);

      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email address already exists',
          field: 'email'
        });
      }
    }

    // Validate foreign key references if provided
    if (req.body.department_id) {
      const [department] = await db.execute(`
        SELECT id FROM departments WHERE id = ? AND client_id = ?
      `, [req.body.department_id, req.user.clientId]);

      if (department.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department selected',
          field: 'department_id'
        });
      }
    }

    if (req.body.designation_id) {
      const [designation] = await db.execute(`
        SELECT id FROM designations WHERE id = ?
      `, [req.body.designation_id]);

      if (designation.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid designation selected',
          field: 'designation_id'
        });
      }
    }

    if (req.body.manager_id) {
      const [manager] = await db.execute(`
        SELECT id FROM employees WHERE id = ? AND client_id = ? AND id != ?
      `, [req.body.manager_id, req.user.clientId, employeeId]);

      if (manager.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid manager selected',
          field: 'manager_id'
        });
      }
    }

    // Build dynamic update query
    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender',
      'address', 'city', 'state', 'zip_code', 'nationality', 'marital_status',
      'employee_code', 'department_id', 'designation_id', 'manager_id',
      'hire_date', 'employment_status', 'employee_type', 'base_salary',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'
    ];

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

    // Add updated_at timestamp
    updateFields.push('updated_at = NOW()');
    updateValues.push(employeeId);

    const updateQuery = `
      UPDATE employees 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND client_id = ?
    `;

    updateValues.push(req.user.clientId);

    // Execute the update
    const [updateResult] = await db.execute(updateQuery, updateValues);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or no changes made'
      });
    }

    // Get updated employee record with related data
    const [updatedEmployee] = await db.execute(`
      SELECT 
        e.*,
        CONCAT(e.first_name, ' ', e.last_name) as full_name,
        d.name as department_name,
        des.title as designation_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        c.name as client_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.id = ?
    `, [employeeId]);

    console.log('✅ Employee updated successfully');

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: {
        employee: updatedEmployee[0]
      }
    });

  } catch (error) {
    console.error('💥 Update employee error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.sqlMessage.includes('email')) {
        return res.status(400).json({
          success: false,
          message: 'Email address already exists',
          field: 'email'
        });
      } else if (error.sqlMessage.includes('employee_code')) {
        return res.status(400).json({
          success: false,
          message: 'Employee code already exists',
          field: 'employee_code'
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

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

router.post('/', 
  checkPermission('employees.create'),
  asyncHandler(async (req, res) => {
    try {
      const db = getDB();
      
      console.log('📝 Received request body:', JSON.stringify(req.body, null, 2));
      
      const {
        // Personal Information
        first_name, last_name, email, phone, date_of_birth, gender,
        address, city, state, zip_code, nationality, marital_status,
        
        // Professional Information
        employee_code, department_id, designation_id, manager_id,
        hire_date, employment_status = 'active', employee_type,
        base_salary,
        
        // Emergency Contact
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      } = req.body;

      console.log('🔍 Extracted employee_type:', employee_type);
      console.log('🔍 Extracted department_id:', department_id);
      console.log('🔍 Extracted designation_id:', designation_id);

      // Validation
      const requiredFields = {
        first_name, last_name, email, phone, date_of_birth, gender,
        employee_code, department_id, designation_id, hire_date, employee_type,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      };

      console.log('✅ Required fields check:', requiredFields);

      for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || value.toString().trim() === '') {
          console.log(`❌ Missing required field: ${field} = "${value}"`);
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
        console.log('❌ Invalid email format:', email);
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
          field: 'email'
        });
      }

      // Check for duplicate employee code
      console.log('🔍 Checking for duplicate employee code...');
      const [existingId] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND employee_code = ?
      `, [req.user.clientId, employee_code]);

      if (existingId.length > 0) {
        console.log('❌ Duplicate employee ID found:', employee_code);
        return res.status(400).json({
          success: false,
          message: 'Employee code already exists',
          field: 'employee_code'
        });
      }

      // Check for duplicate email
      console.log('🔍 Checking for duplicate email...');
      const [existingEmail] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND email = ?
      `, [req.user.clientId, email]);

      if (existingEmail.length > 0) {
        console.log('❌ Duplicate email found:', email);
        return res.status(400).json({
          success: false,
          message: 'Email address already exists',
          field: 'email'
        });
      }

      // Verify department exists
      console.log('🔍 Verifying department exists:', department_id);
      const [deptCheck] = await db.execute(`
        SELECT id FROM departments 
        WHERE id = ? AND client_id = ? AND is_active = TRUE
      `, [department_id, req.user.clientId]);

      if (deptCheck.length === 0) {
        console.log('❌ Department not found or inactive:', department_id);
        return res.status(400).json({
          success: false,
          message: 'Selected department not found',
          field: 'department_id'
        });
      }

      // Verify designation exists and belongs to department
      console.log('🔍 Verifying designation exists:', designation_id);
      const [desigCheck] = await db.execute(`
        SELECT id FROM designations 
        WHERE id = ? AND department_id = ? AND client_id = ? AND is_active = TRUE
      `, [designation_id, department_id, req.user.clientId]);

      if (desigCheck.length === 0) {
        console.log('❌ Designation not found or does not belong to department');
        console.log('   Designation ID:', designation_id);
        console.log('   Department ID:', department_id);
        return res.status(400).json({
          success: false,
          message: 'Selected designation not found or does not belong to the selected department',
          field: 'designation_id'
        });
      }

      // Generate UUID for employee
      const { v4: uuidv4 } = require('uuid');
      const employeeUuid = uuidv4();
      
      console.log('🔍 Generated employee UUID:', employeeUuid);

      // Prepare employee data
      const employeeData = [
        employeeUuid, req.user.clientId, employee_code, first_name, last_name, email, phone,
        date_of_birth, gender, address || null, city || null, state || null, zip_code || null, 
        nationality || null, marital_status || null, hire_date, department_id, designation_id, 
        manager_id || null, employment_status, employee_type, base_salary || null,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation
      ];

      console.log('🔍 Employee data array:', employeeData);

      // Insert employee
      const insertQuery = `
        INSERT INTO employees (
          id, client_id, employee_code, first_name, last_name, email, phone,
          date_of_birth, gender, address, city, state, zip_code, nationality,
          marital_status, hire_date, department_id, designation_id, manager_id,
          employment_status, employee_type, base_salary,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      console.log('🔍 Executing insert query...');
      await db.execute(insertQuery, employeeData);
      console.log('✅ Employee inserted successfully');

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

      console.log('✅ Employee creation successful');
      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: {
          employee: newEmployee[0]
        }
      });

    } catch (error) {
      console.error('💥 Create employee error details:');
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error errno:', error.errno);
      console.error('Error sqlState:', error.sqlState);
      console.error('Error sqlMessage:', error.sqlMessage);
      console.error('Full error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'Email address already exists',
            field: 'email'
          });
        } else if (error.sqlMessage.includes('employee_code')) {
          return res.status(400).json({
            success: false,
            message: 'Employee code already exists',
            field: 'employee_code'
          });
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create employee',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// =============================================
// DELETE EMPLOYEE
// =============================================
// router.delete('/:id', 
//   checkPermission('employees.delete'),
//   checkResourceOwnership('employee'),
//   asyncHandler(async (req, res) => {
//     const db = getDB();
    
//     const [result] = await db.execute(`
//       UPDATE employees 
//       SET employment_status = 'terminated', updated_at = NOW()
//       WHERE id = ? AND client_id = ?
//     `, [req.params.id, req.user.clientId]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Employee not found'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Employee terminated successfully'
//     });
//   })
// );

router.post('/bulk-delete',
  checkPermission('employees.delete'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const ids = req.body.ids; // Expecting an array of employee IDs

    console.log("check cli",req.body)
    console.log("check cli",req.user.clientId);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty array of employee IDs is required.'
      });
    }

    // Construct placeholders for the IN clause
    const placeholders = ids.map(() => '?').join(', ');

    // Append client_id for all rows
    const params = [...ids, req.user.clientId];

    const [result] = await db.execute(`
      UPDATE employees 
      SET employment_status = 'terminated', updated_at = NOW()
      WHERE id IN (${placeholders}) AND client_id = ?
    `, params);

    res.status(200).json({
      success: true,
      message: `Terminated ${result.affectedRows} employee(s).`
    });
  })
);


module.exports = router;