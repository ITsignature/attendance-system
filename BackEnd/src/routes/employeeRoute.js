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

router.put('/:id', 
  checkPermission('employees.edit'),
  checkResourceOwnership('employee'),
  [
    // Your existing validations - KEEP ALL OF THESE
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
    body('marital_status').optional().isIn(['single', 'married', 'divorced', 'widowed']).withMessage('Invalid marital status'),
    
    // ADD NEW WORK SCHEDULE VALIDATIONS
    body('in_time').optional().isTime().withMessage('Valid in time is required'),
    body('out_time').optional().isTime().withMessage('Valid out time is required'),
    body('follows_company_schedule').optional().isBoolean().withMessage('follows_company_schedule must be true or false')
  ],
  asyncHandler(async (req, res) => {
    // Check validation errors first
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
    
    // Handle work schedule logic
    if (req.body.in_time || req.body.out_time || req.body.hasOwnProperty('follows_company_schedule')) {
      let finalInTime = req.body.in_time;
      let finalOutTime = req.body.out_time;
      const followsCompanySchedule = req.body.follows_company_schedule;

      // If switching to company schedule, fetch latest company times
      if (followsCompanySchedule) {
        console.log('🕒 Employee switching to company schedule, fetching latest times...');
        
        const [companySchedule] = await db.execute(`
          SELECT setting_key, setting_value
          FROM system_settings 
          WHERE setting_key IN ('work_start_time', 'work_end_time') 
          AND client_id = ? 
          ORDER BY CASE WHEN client_id IS NULL THEN 1 ELSE 0 END, client_id DESC
        `, [req.user.clientId]);

        const scheduleMap = {};
        companySchedule.forEach(setting => {
          try {
            scheduleMap[setting.setting_key] = JSON.parse(setting.setting_value);
          } catch (e) {
            scheduleMap[setting.setting_key] = setting.setting_value;
          }
        });

        finalInTime = scheduleMap.work_start_time || '09:00';
        finalOutTime = scheduleMap.work_end_time || '17:00';

        console.log('🕒 Updated to company schedule times:', { finalInTime, finalOutTime });
      }

      // Validate time logic if both times are provided or resolved
      if (finalInTime && finalOutTime) {
        const inTime = new Date(`2000-01-01T${finalInTime}`);
        const outTime = new Date(`2000-01-01T${finalOutTime}`);
        
        if (outTime <= inTime) {
          return res.status(400).json({
            success: false,
            message: 'Out time must be after in time',
            field: 'out_time'
          });
        }
      }

      // Update the request body with resolved times
      if (followsCompanySchedule !== undefined) {
        req.body.in_time = finalInTime;
        req.body.out_time = finalOutTime;
        req.body.follows_company_schedule = followsCompanySchedule;
      }
    }

    // Build update query for all fields (including your existing ones + new schedule fields)
    const allowedFields = [
      // Personal Information
      'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender',
      'address', 'city', 'state', 'zip_code', 'nationality', 'marital_status',
      
      // Professional Information
      'employee_code', 'department_id', 'designation_id', 'manager_id', 
      'hire_date', 'employment_status', 'employee_type', 'base_salary',
      
      // Emergency Contact
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
      
      // Work Schedule - NEW FIELDS
      'in_time', 'out_time', 'follows_company_schedule'
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

    updateFields.push('updated_at = NOW()');
    updateValues.push(employeeId);

    const updateQuery = `
      UPDATE employees 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND client_id = ?
    `;

    // Add client_id to ensure user can only update their own employees
    updateValues.push(req.user.clientId);

    const [result] = await db.execute(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Fetch updated employee with all related data
    const [updatedEmployee] = await db.execute(`
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
      WHERE e.id = ? AND e.client_id = ?
    `, [employeeId, req.user.clientId]);

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: {
        employee: updatedEmployee[0]
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
router.post('/', 
  checkPermission('employees.create'),
  [
    // Personal Information Validations
    body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
    body('phone').trim().isLength({ min: 10 }).withMessage('Phone number must be at least 10 digits'),
    body('date_of_birth').isISO8601().withMessage('Please enter a valid date of birth'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
    
    // Professional Information Validations  
    body('employee_code').trim().isLength({ min: 1 }).withMessage('Employee code is required'),
    body('department_id').isUUID().withMessage('Invalid department ID'),
    body('designation_id').isUUID().withMessage('Invalid designation ID'),
     body('manager_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid manager ID'),
    body('hire_date').isISO8601().withMessage('Please enter a valid hire date'),
    body('employment_status').isIn(['active', 'inactive']).withMessage('Invalid employment status'),
    body('employee_type').isIn(['permanent', 'contract', 'intern', 'consultant']).withMessage('Invalid employee type'),
    body('base_salary').optional().isNumeric().withMessage('Base salary must be a number'),
    
    // Emergency Contact Validations
    body('emergency_contact_name').trim().isLength({ min: 1 }).withMessage('Emergency contact name is required'),  
    body('emergency_contact_phone').trim().isLength({ min: 10 }).withMessage('Emergency contact phone is required'),
    body('emergency_contact_relation').trim().isLength({ min: 1 }).withMessage('Emergency contact relation is required'),
    
    // Work Schedule Validations - NEW
    body('in_time').isTime().withMessage('Valid in time is required'),
    body('out_time').isTime().withMessage('Valid out time is required'),
    body('follows_company_schedule').isBoolean().optional()
  ],
  asyncHandler(async (req, res) => {

    console.log(req.body);
    // Check validation errors first
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

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
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        
        // Work Schedule Information - NEW
        in_time, out_time, follows_company_schedule = true
      } = req.body;

      // Validation for time fields
      if (in_time && out_time) {
        const inTime = new Date(`2000-01-01T${in_time}`);
        const outTime = new Date(`2000-01-01T${out_time}`);
        
        if (outTime <= inTime) {
          return res.status(400).json({
            success: false,
            message: 'Out time must be after in time',
            field: 'out_time'
          });
        }
      }

      // If employee follows company schedule, ensure we have the latest company times
      let finalInTime = in_time;
      let finalOutTime = out_time;

      if (follows_company_schedule) {
        console.log('🕒 Employee follows company schedule, fetching latest company times...');
        
        // Fetch current company work schedule
        const [companySchedule] = await db.execute(`
          SELECT setting_key, setting_value
          FROM system_settings 
          WHERE setting_key IN ('work_start_time', 'work_end_time') 
          AND client_id = ? 
          ORDER BY CASE WHEN client_id IS NULL THEN 1 ELSE 0 END, client_id DESC
        `, [req.user.clientId]);

        // Parse company schedule
        const scheduleMap = {};
        companySchedule.forEach(setting => {
          try {
            scheduleMap[setting.setting_key] = JSON.parse(setting.setting_value);
          } catch (e) {
            scheduleMap[setting.setting_key] = setting.setting_value;
          }
        });


        console.log('🕒 Fetched company schedule times:', scheduleMap);

        // Use company times if available, otherwise use provided times as fallback
        finalInTime = scheduleMap.work_start_time || in_time || '09:00';
        finalOutTime = scheduleMap.work_end_time || out_time || '17:00';

        console.log('🕒 Using company schedule times:', { finalInTime, finalOutTime });
      } else {
        console.log('🕒 Using custom employee times:', { finalInTime, finalOutTime });
      }

      // Check for duplicate employee code
      console.log('🔍 Checking for duplicate employee code...');
      const [existingId] = await db.execute(`
        SELECT id FROM employees 
        WHERE client_id = ? AND employee_code = ?
      `, [req.user.clientId, employee_code]);

      if (existingId.length > 0) {
        console.log('❌ Duplicate employee code found');
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
        console.log('❌ Duplicate email found');
        return res.status(400).json({
          success: false,
          message: 'Email already exists',
          field: 'email'
        });
      }

      // Verify department exists
      const [deptCheck] = await db.execute(`
        SELECT id FROM departments WHERE id = ? AND client_id = ? AND is_active = TRUE
      `, [department_id, req.user.clientId]);

      if (deptCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department selected',
          field: 'department_id'
        });
      }

      // Verify designation exists and belongs to department
      const [desigCheck] = await db.execute(`
        SELECT id FROM designations 
        WHERE id = ? AND department_id = ? AND client_id = ? AND is_active = TRUE
      `, [designation_id, department_id, req.user.clientId]);

      if (desigCheck.length === 0) {
        console.log('❌ Designation not found or does not belong to department');
        return res.status(400).json({
          success: false,
          message: 'Selected designation not found or does not belong to the selected department',
          field: 'designation_id'
        });
      }

      // Generate UUID for employee (using your existing method)
      const { v4: uuidv4 } = require('uuid');
      const employeeUuid = uuidv4();
      
      console.log('🔍 Generated employee UUID:', employeeUuid);

      // Insert employee with work schedule fields - UPDATED QUERY
      console.log('💾 Inserting employee into database...');
      await db.execute(`
        INSERT INTO employees (
          id, client_id, employee_code, first_name, last_name, email, phone,
          date_of_birth, gender, address, city, state, zip_code, nationality, marital_status,
          hire_date, department_id, designation_id, manager_id, employee_type, 
          employment_status, base_salary,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          in_time, out_time, follows_company_schedule,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        employeeUuid, req.user.clientId, employee_code, first_name, last_name, email, phone,
        date_of_birth, gender, address || null, city || null, state || null, zip_code || null, 
        nationality || null, marital_status || null, hire_date, department_id, designation_id, 
        manager_id || null, employee_type, employment_status, base_salary || null,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        finalInTime, finalOutTime, follows_company_schedule
      ]);

      // Get created employee with relations (same as your existing code)
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
      console.error('Full error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage && error.sqlMessage.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'Email address already exists',
            field: 'email'
          });
        } else if (error.sqlMessage && error.sqlMessage.includes('employee_code')) {
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
// BACKEND VALIDATION UPDATES
// File: routes/employeeRoute.js
// =============================================

// BEFORE - Current Required Validations:
/*
body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
body('date_of_birth').isISO8601().withMessage('Please enter a valid date of birth'),
body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
body('department_id').isUUID().withMessage('Invalid department ID'),
body('designation_id').isUUID().withMessage('Invalid designation ID'),
body('hire_date').isISO8601().withMessage('Please enter a valid hire date'),
body('emergency_contact_name').trim().isLength({ min: 1 }).withMessage('Emergency contact name is required'),
body('emergency_contact_phone').trim().isLength({ min: 10 }).withMessage('Emergency contact phone is required'),
body('emergency_contact_relation').trim().isLength({ min: 1 }).withMessage('Emergency contact relation is required'),
body('in_time').isTime().withMessage('Valid in time is required'),
body('out_time').isTime().withMessage('Valid out time is required'),
*/

// AFTER - Updated Optional Validations:
router.post('/', 
  checkPermission('employees.create'),
  [
    // Personal Information Validations - REQUIRED
    body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
    body('phone').trim().isLength({ min: 10 }).withMessage('Phone number must be at least 10 digits'),
    body('employee_code').trim().isLength({ min: 1 }).withMessage('Employee code is required'),
    
    // Personal Information Validations - NOW OPTIONAL
    body('last_name')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 1 })
      .withMessage('Last name cannot be empty if provided'),
    
    body('date_of_birth')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Please enter a valid date of birth'),
    
    body('gender')
      .optional({ values: 'falsy' })
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other'),
    
    // Professional Information Validations - NOW OPTIONAL
    body('department_id')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage('Invalid department ID format'),
    
    body('designation_id')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage('Invalid designation ID format'),
    
    body('hire_date')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Please enter a valid hire date'),
    
    // Emergency Contact Validations - NOW OPTIONAL
    body('emergency_contact_name')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 1 })
      .withMessage('Emergency contact name cannot be empty if provided'),
    
    body('emergency_contact_phone')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 10 })
      .withMessage('Emergency contact phone must be at least 10 digits if provided'),
    
    body('emergency_contact_relation')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 1 })
      .withMessage('Emergency contact relation cannot be empty if provided'),
    
    // Work Schedule Validations - NOW OPTIONAL
    body('in_time')
      .optional({ values: 'falsy' })
      .isTime()
      .withMessage('Valid in time format required if provided'),
    
    body('out_time')
      .optional({ values: 'falsy' })
      .isTime()
      .withMessage('Valid out time format required if provided'),
    
    // Still Required
    body('employment_status').isIn(['active', 'inactive']).withMessage('Invalid employment status'),
    body('employee_type').isIn(['permanent', 'contract', 'intern', 'consultant']).withMessage('Invalid employee type'),
    body('base_salary').optional().isNumeric().withMessage('Base salary must be a number'),
    body('follows_company_schedule').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    // Validation logic updates
    const {
      first_name, last_name, email, phone, date_of_birth, gender,
      address, city, state, zip_code, nationality, marital_status,
      employee_code, department_id, designation_id, manager_id, 
      hire_date, employee_type, employment_status, base_salary,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      in_time, out_time, follows_company_schedule
    } = req.body;

    // Only validate department if provided
    if (department_id) {
      const [deptCheck] = await db.execute(
        'SELECT id FROM departments WHERE id = ? AND client_id = ? AND is_active = TRUE',
        [department_id, req.user.clientId]
      );

      if (deptCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department selected',
          field: 'department_id'
        });
      }
    }

    // Only validate designation if provided
    if (designation_id) {
      if (!department_id) {
        return res.status(400).json({
          success: false,
          message: 'Department is required when designation is specified',
          field: 'department_id'
        });
      }

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
    }

    // Validate work times if both provided
    if (in_time && out_time) {
      const inTime = new Date(`2000-01-01T${in_time}`);
      const outTime = new Date(`2000-01-01T${out_time}`);
      
      if (outTime <= inTime) {
        return res.status(400).json({
          success: false,
          message: 'Out time must be after in time',
          field: 'out_time'
        });
      }
    }

    // Updated INSERT query with NULL handling
    await db.execute(`
      INSERT INTO employees (
        id, client_id, employee_code, first_name, last_name, email, phone,
        date_of_birth, gender, address, city, state, zip_code, nationality, marital_status,
        hire_date, department_id, designation_id, manager_id, employee_type, 
        employment_status, base_salary,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        in_time, out_time, follows_company_schedule,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      employeeUuid, req.user.clientId, employee_code, first_name, 
      last_name || null,  // Optional
      email, phone,
      date_of_birth || null,  // Optional
      gender || null,  // Optional
      address || null, city || null, state || null, zip_code || null, 
      nationality || null, marital_status || null,
      hire_date || null,  // Optional
      department_id || null,  // Optional
      designation_id || null,  // Optional
      manager_id || null, employee_type, employment_status, base_salary || null,
      emergency_contact_name || null,  // Optional
      emergency_contact_phone || null,  // Optional
      emergency_contact_relation || null,  // Optional
      in_time || null,  // Optional
      out_time || null,  // Optional
      follows_company_schedule !== undefined ? follows_company_schedule : true
    ]);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employeeId: employeeUuid }
    });
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
    const ids = req.body.employee_ids; // Expecting an array of employee IDs

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

// =============================================
// UTILITY FUNCTION FOR ATTENDANCE SYSTEM
// =============================================

// You can also add this helper function to get employee work hours
const getEmployeeWorkHours = async (employeeId, clientId, db) => {
  const [employee] = await db.execute(`
    SELECT in_time, out_time, follows_company_schedule
    FROM employees 
    WHERE id = ? AND client_id = ?
  `, [employeeId, clientId]);
  
  if (employee.length === 0) {
    throw new Error('Employee not found');
  }
  
  const emp = employee[0];
  
  // Always return the stored times (which are already resolved)
  return {
    start_time: emp.in_time,
    end_time: emp.out_time,
    follows_company_schedule: emp.follows_company_schedule
  };
};


module.exports = { router, getEmployeeWorkHours };