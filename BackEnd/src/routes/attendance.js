const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { checkPermission, ensureClientAccess, checkResourceOwnership } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// GET ATTENDANCE RECORDS
// =============================================
router.get('/', 
  checkPermission('attendance.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const {
      page = 1,
      limit = 10,
      employeeId = '',
      startDate = '',
      endDate = '',
      status = '',
      sortBy = 'date',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE e.client_id = ?';
    let queryParams = [req.user.clientId];
    
    if (employeeId) {
      whereClause += ' AND a.employee_id = ?';
      queryParams.push(employeeId);
    }
    
    if (startDate) {
      whereClause += ' AND a.date >= ?';
      queryParams.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND a.date <= ?';
      queryParams.push(endDate);
    }
    
    if (status) {
      whereClause += ' AND a.status = ?';
      queryParams.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      ${whereClause}
    `;
    
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get attendance records
    const query = `
      SELECT 
        a.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code,
        d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY a.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    const [attendance] = await db.execute(query, queryParams);

    res.status(200).json({
      success: true,
      data: {
        attendance,
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
// CREATE ATTENDANCE RECORD
// =============================================
router.post('/', [
  checkPermission('attendance.edit'),
  body('employee_id').isUUID(),
  body('date').isISO8601(),
  body('check_in_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('check_out_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('status').isIn(['present', 'absent', 'late', 'half_day', 'on_leave'])
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
  const attendanceId = uuidv4();
  
  // Verify employee belongs to client
  const [employees] = await db.execute(`
    SELECT id FROM employees WHERE id = ? AND client_id = ?
  `, [req.body.employee_id, req.user.clientId]);

  if (employees.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Check for duplicate attendance record
  const [existing] = await db.execute(`
    SELECT id FROM attendance WHERE employee_id = ? AND date = ?
  `, [req.body.employee_id, req.body.date]);

  if (existing.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Attendance record already exists for this date'
    });
  }

  // Calculate total hours if both check-in and check-out are provided
  let totalHours = null;
  let overtimeHours = 0;

  if (req.body.check_in_time && req.body.check_out_time) {
    const checkIn = new Date(`2000-01-01 ${req.body.check_in_time}`);
    const checkOut = new Date(`2000-01-01 ${req.body.check_out_time}`);
    const diffMs = checkOut - checkIn;
    const diffHrs = diffMs / (1000 * 60 * 60);
    
    totalHours = Math.max(0, diffHrs);
    
    // Calculate overtime (assuming 8 hours standard)
    const standardHours = 8;
    overtimeHours = Math.max(0, totalHours - standardHours);
  }

  const attendanceData = {
    id: attendanceId,
    employee_id: req.body.employee_id,
    date: req.body.date,
    check_in_time: req.body.check_in_time || null,
    check_out_time: req.body.check_out_time || null,
    total_hours: totalHours,
    overtime_hours: overtimeHours,
    break_duration: req.body.break_duration || 0,
    status: req.body.status,
    work_type: req.body.work_type || 'office',
    notes: req.body.notes || null,
    created_by: req.user.userId
  };

  const insertQuery = `
    INSERT INTO attendance (
      id, employee_id, date, check_in_time, check_out_time, total_hours,
      overtime_hours, break_duration, status, work_type, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(insertQuery, Object.values(attendanceData));

  // Get created record with employee info
  const [newRecord] = await db.execute(`
    SELECT 
      a.*,
      CONCAT(e.first_name, ' ', e.last_name) as employee_name,
      e.employee_code
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
  `, [attendanceId]);

  res.status(201).json({
    success: true,
    message: 'Attendance record created successfully',
    data: {
      attendance: newRecord[0]
    }
  });
}));

// =============================================
// UPDATE ATTENDANCE RECORD
// =============================================
router.put('/:id', [
  checkPermission('attendance.edit'),
  checkResourceOwnership('attendance'),
  body('check_in_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('check_out_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('status').optional().isIn(['present', 'absent', 'late', 'half_day', 'on_leave'])
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
  const attendanceId = req.params.id;

  // Get current record
  const [currentRecord] = await db.execute(`
    SELECT a.*, e.client_id
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
  `, [attendanceId]);

  if (currentRecord.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Attendance record not found'
    });
  }

  const current = currentRecord[0];

  // Build update query
  const allowedFields = ['check_in_time', 'check_out_time', 'break_duration', 'status', 'work_type', 'notes'];
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

  // Recalculate total hours if times are being updated
  const newCheckIn = req.body.check_in_time || current.check_in_time;
  const newCheckOut = req.body.check_out_time || current.check_out_time;

  if (newCheckIn && newCheckOut) {
    const checkIn = new Date(`2000-01-01 ${newCheckIn}`);
    const checkOut = new Date(`2000-01-01 ${newCheckOut}`);
    const diffMs = checkOut - checkIn;
    const diffHrs = diffMs / (1000 * 60 * 60);
    
    const totalHours = Math.max(0, diffHrs);
    const overtimeHours = Math.max(0, totalHours - 8);

    updateFields.push('total_hours = ?', 'overtime_hours = ?');
    updateValues.push(totalHours, overtimeHours);
  }

  updateFields.push('updated_by = ?', 'updated_at = NOW()');
  updateValues.push(req.user.userId, attendanceId);

  const updateQuery = `
    UPDATE attendance 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `;

  await db.execute(updateQuery, updateValues);

  // Get updated record
  const [updatedRecord] = await db.execute(`
    SELECT 
      a.*,
      CONCAT(e.first_name, ' ', e.last_name) as employee_name,
      e.employee_code
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
  `, [attendanceId]);

  res.status(200).json({
    success: true,
    message: 'Attendance record updated successfully',
    data: {
      attendance: updatedRecord[0]
    }
  });
}));

module.exports = router;
