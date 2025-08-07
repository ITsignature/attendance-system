const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess, checkResourceOwnership } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// UTILITY FUNCTIONS FOR DUAL STATUS DETERMINATION
// =============================================

/**
 * Get employee work schedule from database
 */
const getEmployeeSchedule = async (employeeId, clientId, db) => {
  const [employee] = await db.execute(`
    SELECT 
      e.in_time, 
      e.out_time, 
      e.follows_company_schedule,
      CONCAT(e.first_name, ' ', e.last_name) as employee_name
    FROM employees e 
    WHERE e.id = ? AND e.client_id = ? AND e.employment_status = 'active'
  `, [employeeId, clientId]);
  
  if (employee.length === 0) {
    throw new Error('Employee not found or inactive');
  }
  
  const emp = employee[0];
  
  // Get late threshold from settings
  const [thresholdSetting] = await db.execute(`
    SELECT setting_value
    FROM system_settings 
    WHERE setting_key = 'late_threshold_minutes' 
    AND client_id = ? 
    ORDER BY CASE WHEN client_id IS NULL THEN 1 ELSE 0 END, client_id DESC
    LIMIT 1
  `, [clientId]);

  const lateThresholdMinutes = thresholdSetting.length > 0 
    ? parseInt(JSON.parse(thresholdSetting[0].setting_value)) || 15 
    : 15;

  return {
    start_time: emp.in_time || '09:00',
    end_time: emp.out_time || '17:00',
    late_threshold_minutes: lateThresholdMinutes,
    employee_name: emp.employee_name,
    follows_company_schedule: emp.follows_company_schedule
  };
};

/**
 * Get work duration thresholds from settings
 */
const getWorkDurationSettings = async (clientId, db) => {
  const [settings] = await db.execute(`
    SELECT setting_key, setting_value
    FROM system_settings 
    WHERE setting_key IN ('full_day_minimum_hours', 'half_day_minimum_hours', 'short_leave_minimum_hours', 'working_hours_per_day') 
    AND client_id = ? 
    ORDER BY CASE WHEN client_id IS NULL THEN 1 ELSE 0 END, client_id DESC
  `, [clientId]);

  const settingsMap = {};
  settings.forEach(setting => {
    try {
      settingsMap[setting.setting_key] = parseFloat(JSON.parse(setting.setting_value));
    } catch (e) {
      settingsMap[setting.setting_key] = parseFloat(setting.setting_value);
    }
  });

  return {
    full_day_minimum_hours: settingsMap.full_day_minimum_hours || 7,
    half_day_minimum_hours: settingsMap.half_day_minimum_hours || 4,
    short_leave_minimum_hours: settingsMap.short_leave_minimum_hours || 1,
    working_hours_per_day: settingsMap.working_hours_per_day || 8
  };
};

/**
 * Helper function to normalize time format for consistent parsing
 */
const normalizeTimeFormat = (timeString) => {
  if (!timeString) return null;
  
  // Remove any extra whitespace
  timeString = timeString.trim();
  
  // If already has seconds (HH:MM:SS), extract just HH:MM
  if (timeString.includes(':') && timeString.split(':').length === 3) {
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
  }
  
  // If it's just HH:MM, return as is
  if (timeString.includes(':') && timeString.split(':').length === 2) {
    return timeString;
  }
  
  // If no colons, assume it's invalid
  return null;
};

/**
 * Determine arrival status based on check-in time and employee schedule
 */
const determineArrivalStatus = (checkInTime, schedule, requestedArrivalStatus = null) => {
  console.log('🔍 ARRIVAL STATUS DEBUG:');
  console.log('  Raw checkInTime:', checkInTime);
  console.log('  Raw schedule.start_time:', schedule.start_time);
  console.log('  late_threshold_minutes:', schedule.late_threshold_minutes);
  
  // If manually provided, use it (except for auto-calculated ones)
  if (requestedArrivalStatus && ['absent'].includes(requestedArrivalStatus)) {
    return requestedArrivalStatus;
  }
  
  // If no check-in time, consider absent
  if (!checkInTime) {
    return 'absent';
  }
  
  // FIXED: Normalize both time formats to HH:MM
  const normalizedCheckIn = normalizeTimeFormat(checkInTime);
  const normalizedScheduledStart = normalizeTimeFormat(schedule.start_time);
  
  console.log('  Normalized checkInTime:', normalizedCheckIn);
  console.log('  Normalized scheduledStart:', normalizedScheduledStart);
  
  if (!normalizedCheckIn || !normalizedScheduledStart) {
    console.log('  ❌ Invalid time format detected');
    return 'late'; // Default to late if we can't parse times
  }
  
  // Parse times with consistent format
  const scheduledStart = new Date(`2000-01-01T${normalizedScheduledStart}:00`);
  const actualCheckIn = new Date(`2000-01-01T${normalizedCheckIn}:00`);
  
  console.log('  scheduledStart Date object:', scheduledStart);
  console.log('  actualCheckIn Date object:', actualCheckIn);
  
  // Calculate if late (in minutes)
  const timeDiffMs = actualCheckIn - scheduledStart;
  const timeDiffMinutes = timeDiffMs / (1000 * 60);
  
  console.log('  timeDiffMs:', timeDiffMs);
  console.log('  timeDiffMinutes:', timeDiffMinutes);
  console.log('  late_threshold_minutes:', schedule.late_threshold_minutes);
  
  // Determine arrival status
  if (timeDiffMinutes <= 0) {
    console.log('  ✅ Result: on_time (early or exact)');
    return 'on_time'; // On time or early
  } else if (timeDiffMinutes <= schedule.late_threshold_minutes) {
    console.log('  ✅ Result: on_time (within threshold)');
    return 'on_time'; // Within acceptable threshold
  } else {
    console.log('  ❌ Result: late');
    return 'late'; // Arrived after threshold
  }
};
/**
 * Determine work duration based on hours worked and settings
 */
const determineWorkDuration = (totalHours, durationSettings, requestedWorkDuration = null) => {
  // If manually set to on_leave, always respect it (requires approval)
  if (requestedWorkDuration === 'on_leave') {
    return 'on_leave';
  }
  
  // Auto-calculate based on hours worked
  if (totalHours === null || totalHours === 0) {
    return 'absent'; // No work done
  }
  
  if (totalHours < durationSettings.half_day_minimum_hours) {
    return 'absent'; // Less than minimum threshold
  } else if (totalHours  < durationSettings.half_day_minimum_hours) {
    return 'short_leave'; // 1-4 hours
  } else if (totalHours < durationSettings.full_day_minimum_hours) {
    return 'half_day'; // 4-7 hours  
  } else {
    return 'full_day'; // 7+ hours
  }
};

/**
 * Calculate work hours and overtime based on system settings
 */
const calculateWorkHours = async (checkInTime, checkOutTime, breakDuration = 0, clientId, db) => {
  if (!checkInTime || !checkOutTime) {
    return { totalHours: null, overtimeHours: 0, standardHours: 8 };
  }
  
  const checkIn = new Date(`2000-01-01T${checkInTime}:00`);
  const checkOut = new Date(`2000-01-01T${checkOutTime}:00`);
  
  const diffMs = checkOut - checkIn;
  const diffHrs = diffMs / (1000 * 60 * 60);
  
  // Subtract break duration
  const totalHours = Math.max(0, diffHrs - (breakDuration || 0));
  
  // Get working hours per day from settings
  const durationSettings = await getWorkDurationSettings(clientId, db);
  const standardHours = durationSettings.working_hours_per_day;
  
  // Calculate overtime based on configured working hours
  const overtimeHours = Math.max(0, totalHours - standardHours);
  
  return {
    totalHours: parseFloat(totalHours.toFixed(2)),
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    standardHours: standardHours
  };
};

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
      arrival_status = '',
      work_duration = '',
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
    
    if (arrival_status) {
      whereClause += ' AND a.arrival_status = ?';
      queryParams.push(arrival_status);
    }
    
    if (work_duration) {
      whereClause += ' AND a.work_duration = ?';
      queryParams.push(work_duration);
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

    // Get attendance records with employee schedule info
    const query = `
      SELECT 
        a.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code,
        e.in_time as scheduled_in_time,
        e.out_time as scheduled_out_time,
        e.follows_company_schedule,
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
// CREATE ATTENDANCE RECORD WITH DUAL AUTO STATUS
// =============================================
router.post('/', [
  checkPermission('attendance.edit'),
  body('employee_id').isUUID(),
  body('date').isISO8601(),
  body('check_in_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('check_out_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('arrival_status').optional().isIn(['on_time', 'late', 'absent']),
  body('work_duration').optional().isIn(['full_day', 'half_day', 'short_leave', 'on_leave']),
  body('break_duration').optional().isFloat({ min: 0, max: 24 }),
  body('work_type').optional().isIn(['office', 'remote', 'hybrid']),
  body('notes').optional().isLength({ max: 500 })
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
  
  try {
    // Get employee schedule
    const schedule = await getEmployeeSchedule(req.body.employee_id, req.user.clientId, db);
    
    // Get work duration settings
    const durationSettings = await getWorkDurationSettings(req.user.clientId, db);
    
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

    // Calculate work hours first
    const { totalHours, overtimeHours, standardHours } = await calculateWorkHours(
      req.body.check_in_time,
      req.body.check_out_time,
      req.body.break_duration,
      req.user.clientId,
      db
    );

    // Auto-determine arrival status
    const autoArrivalStatus = determineArrivalStatus(
      req.body.check_in_time,
      schedule,
      req.body.arrival_status
    );

    // Auto-determine work duration
    const autoWorkDuration = determineWorkDuration(
      totalHours,
      durationSettings,
      req.body.work_duration
    );

    const attendanceData = {
      id: attendanceId,
      employee_id: req.body.employee_id,
      date: req.body.date,
      check_in_time: req.body.check_in_time || null,
      check_out_time: req.body.check_out_time || null,
      total_hours: totalHours,
      overtime_hours: overtimeHours,
      break_duration: req.body.break_duration || 0,
      arrival_status: autoArrivalStatus,
      work_duration: autoWorkDuration,
      work_type: req.body.work_type || 'office',
      notes: req.body.notes || null,
      created_by: req.user.userId
    };

    const insertQuery = `
      INSERT INTO attendance (
        id, employee_id, date, check_in_time, check_out_time, total_hours,
        overtime_hours, break_duration, arrival_status, work_duration, work_type, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(insertQuery, Object.values(attendanceData));

    // Get created record with employee info
    const [newRecord] = await db.execute(`
      SELECT 
        a.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code,
        e.in_time as scheduled_in_time,
        e.out_time as scheduled_out_time
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ?
    `, [attendanceId]);

    // Determine what was auto-calculated
    const arrivalAutoCalculated = !req.body.arrival_status || req.body.arrival_status !== autoArrivalStatus;
    const durationAutoCalculated = !req.body.work_duration || req.body.work_duration !== autoWorkDuration;

    res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      data: {
        attendance: newRecord[0],
        calculation_info: {
          // Schedule info
          scheduled_start: schedule.start_time,
          scheduled_end: schedule.end_time,
          late_threshold_minutes: schedule.late_threshold_minutes,
          standard_working_hours: standardHours,
          
          // Duration thresholds
          duration_thresholds: durationSettings,
          
          // Auto-calculation flags
          arrival_status_auto_determined: arrivalAutoCalculated,
          work_duration_auto_determined: durationAutoCalculated,
          
          follows_company_schedule: schedule.follows_company_schedule
        }
      }
    });

  } catch (error) {
    console.error('Error creating attendance record:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create attendance record'
    });
  }
}));

// =============================================
// UPDATE ATTENDANCE RECORD WITH DUAL AUTO STATUS
// =============================================
router.put('/:id', [
  checkPermission('attendance.edit'),
  checkResourceOwnership('attendance'),
  body('check_in_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('check_out_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('arrival_status').optional().isIn(['on_time', 'late', 'absent']),
  body('work_duration').optional().isIn(['full_day', 'half_day', 'short_leave', 'on_leave']),
  body('break_duration').optional().isFloat({ min: 0, max: 24 }),
  body('work_type').optional().isIn(['office', 'remote', 'hybrid']),
  body('notes').optional().isLength({ max: 500 })
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

  try {
    // Get current record
    const [currentRecord] = await db.execute(`
      SELECT a.*, e.client_id, e.id as employee_id
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
    
    // Get employee schedule and duration settings
    const schedule = await getEmployeeSchedule(current.employee_id, req.user.clientId, db);
    const durationSettings = await getWorkDurationSettings(req.user.clientId, db);

    // Build update query
    const allowedFields = ['check_in_time', 'check_out_time', 'break_duration', 'arrival_status', 'work_duration', 'work_type', 'notes'];
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

    // Get updated times
    const newCheckIn = req.body.check_in_time || current.check_in_time;
    const newCheckOut = req.body.check_out_time || current.check_out_time;
    const newBreakDuration = req.body.break_duration || current.break_duration;

    // Recalculate work hours
    const { totalHours, overtimeHours, standardHours } = await calculateWorkHours(
      newCheckIn, 
      newCheckOut, 
      newBreakDuration,
      req.user.clientId,
      db
    );

    // Auto-determine statuses if not manually provided or if times changed
    let finalArrivalStatus = req.body.arrival_status;
    let finalWorkDuration = req.body.work_duration;
    let arrivalAutoCalculated = false;
    let durationAutoCalculated = false;

    // Auto-calculate arrival status if not manually set or if check-in time changed
    if (!finalArrivalStatus || req.body.check_in_time) {
      finalArrivalStatus = determineArrivalStatus(newCheckIn, schedule, req.body.arrival_status);
      arrivalAutoCalculated = true;
      
      // Update arrival status in the update fields
      const arrivalIndex = updateFields.findIndex(field => field.includes('arrival_status'));
      if (arrivalIndex >= 0) {
        updateValues[arrivalIndex] = finalArrivalStatus;
      } else {
        updateFields.push('arrival_status = ?');
        updateValues.push(finalArrivalStatus);
      }
    }

    // Auto-calculate work duration if not manually set to on_leave or if times changed
    if (!finalWorkDuration || (finalWorkDuration !== 'on_leave' && (req.body.check_in_time || req.body.check_out_time || req.body.break_duration))) {
      finalWorkDuration = determineWorkDuration(totalHours, durationSettings, req.body.work_duration);
      durationAutoCalculated = true;
      
      // Update work duration in the update fields
      const durationIndex = updateFields.findIndex(field => field.includes('work_duration'));
      if (durationIndex >= 0) {
        updateValues[durationIndex] = finalWorkDuration;
      } else {
        updateFields.push('work_duration = ?');
        updateValues.push(finalWorkDuration);
      }
    }

    // Update work hours if changed
    if (totalHours !== null) {
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
        e.employee_code,
        e.in_time as scheduled_in_time,
        e.out_time as scheduled_out_time
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ?
    `, [attendanceId]);

    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      data: {
        attendance: updatedRecord[0],
        calculation_info: {
          scheduled_start: schedule.start_time,
          scheduled_end: schedule.end_time,
          late_threshold_minutes: schedule.late_threshold_minutes,
          standard_working_hours: standardHours,
          duration_thresholds: durationSettings,
          arrival_status_auto_determined: arrivalAutoCalculated,
          work_duration_auto_determined: durationAutoCalculated,
          follows_company_schedule: schedule.follows_company_schedule
        }
      }
    });

  } catch (error) {
    console.error('Error updating attendance record:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update attendance record'
    });
  }
}));

// =============================================
// BULK STATUS UPDATE ENDPOINT (DUAL STATUS)
// =============================================
router.post('/bulk-update-status', [
  checkPermission('attendance.edit'),
  body('date').isISO8601(),
  body('employee_ids').isArray().withMessage('employee_ids must be an array'),
  body('employee_ids.*').isUUID(),
  body('update_arrival').optional().isBoolean(),
  body('update_duration').optional().isBoolean()
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
  const { date, employee_ids, update_arrival = true, update_duration = true } = req.body;
  const results = [];

  try {
    for (const employeeId of employee_ids) {
      try {
        // Get employee schedule and duration settings
        const schedule = await getEmployeeSchedule(employeeId, req.user.clientId, db);
        const durationSettings = await getWorkDurationSettings(req.user.clientId, db);
        
        // Check if attendance record exists
        const [existing] = await db.execute(`
          SELECT * FROM attendance WHERE employee_id = ? AND date = ?
        `, [employeeId, date]);

        if (existing.length > 0) {
          const record = existing[0];
          const updates = [];
          const updateValues = [];
          
          let arrivalUpdated = false;
          let durationUpdated = false;
          
          // Auto-determine arrival status if requested
          if (update_arrival) {
            const autoArrivalStatus = determineArrivalStatus(
              record.check_in_time,
              schedule
            );

            if (record.arrival_status !== autoArrivalStatus) {
              updates.push('arrival_status = ?');
              updateValues.push(autoArrivalStatus);
              arrivalUpdated = true;
            }
          }
          
          // Auto-determine work duration if requested
          if (update_duration) {
            const autoWorkDuration = determineWorkDuration(
              record.total_hours,
              durationSettings,
              record.work_duration === 'on_leave' ? 'on_leave' : null
            );

            if (record.work_duration !== autoWorkDuration) {
              updates.push('work_duration = ?');
              updateValues.push(autoWorkDuration);
              durationUpdated = true;
            }
          }

          // Update if any changes
          if (updates.length > 0) {
            updates.push('updated_by = ?', 'updated_at = NOW()');
            updateValues.push(req.user.userId, record.id);
            
            await db.execute(`
              UPDATE attendance 
              SET ${updates.join(', ')}
              WHERE id = ?
            `, updateValues);

            results.push({
              employee_id: employeeId,
              employee_name: schedule.employee_name,
              arrival_updated: arrivalUpdated,
              duration_updated: durationUpdated,
              updated: true
            });
          } else {
            results.push({
              employee_id: employeeId,
              employee_name: schedule.employee_name,
              updated: false,
              message: 'Status already correct'
            });
          }
        } else {
          results.push({
            employee_id: employeeId,
            employee_name: schedule.employee_name,
            updated: false,
            message: 'No attendance record found for this date'
          });
        }
      } catch (error) {
        results.push({
          employee_id: employeeId,
          updated: false,
          error: error.message
        });
      }
    }

    const updatedCount = results.filter(r => r.updated).length;

    res.status(200).json({
      success: true,
      message: `Bulk status update completed. ${updatedCount} records updated.`,
      data: {
        results,
        summary: {
          total_processed: employee_ids.length,
          updated: updatedCount,
          skipped: employee_ids.length - updatedCount
        }
      }
    });

  } catch (error) {
    console.error('Error in bulk status update:', error);
    return res.status(500).json({
      success: false,
      message: 'Bulk update failed',
      error: error.message
    });
  }
}));

// =============================================
// DELETE ATTENDANCE RECORD
// =============================================
router.delete('/:id', [
  checkPermission('attendance.delete'),
  checkResourceOwnership('attendance')
], asyncHandler(async (req, res) => {
  const db = getDB();
  const attendanceId = req.params.id;

  const [result] = await db.execute(`
    DELETE FROM attendance WHERE id = ?
  `, [attendanceId]);

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: 'Attendance record not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Attendance record deleted successfully'
  });
}));

// =============================================
// GET EMPLOYEE SCHEDULE INFO
// =============================================
router.get('/employee-schedule/:employeeId', 
  checkPermission('attendance.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { employeeId } = req.params;

    try {
      const schedule = await getEmployeeSchedule(employeeId, req.user.clientId, db);
      const durationSettings = await getWorkDurationSettings(req.user.clientId, db);
      
      res.status(200).json({
        success: true,
        data: {
          schedule,
          duration_settings: durationSettings
        }
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
  })
);

module.exports = router;