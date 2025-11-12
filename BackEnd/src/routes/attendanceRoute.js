const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess, checkResourceOwnership } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const AttendanceStatusService = require('../services/AttendanceStatusService');

const router = express.Router();

// =============================================
// PUBLIC ENDPOINTS (No Authentication Required)
// =============================================

// FINGERPRINT ATTENDANCE ENDPOINT - Must be BEFORE authentication middleware
/**
 * This endpoint receives fingerprint check-in/check-out from fp.php
 * No authentication required as it's called from the fingerprint device
 *
 * Request body:
 * - fingerprint_id: Integer (matches employees.fingerprint_id)
 * - client_id: UUID (optional, if multiple clients use same fingerprint device)
 */
router.post('/fingerprint', [
  body('fingerprint_id').isInt().withMessage('fingerprint_id must be an integer'),
  body('client_id').optional().isUUID().withMessage('client_id must be a valid UUID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
      status: 'error'
    });
  }

  const db = getDB();
  const { fingerprint_id, client_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

  try {
    // Map fingerprint ID to employee in new system
    let query = `
      SELECT
        e.id as employee_id,
        e.client_id,
        e.in_time,
        e.out_time,
        e.fingerprint_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code
      FROM employees e
      WHERE e.fingerprint_id = ?
      AND e.employment_status = 'active'
    `;

    const queryParams = [fingerprint_id];

    // If client_id provided, filter by it
    if (client_id) {
      query += ' AND e.client_id = ?';
      queryParams.push(client_id);
    }

    query += ' LIMIT 1';

    const [employee] = await db.execute(query, queryParams);

    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive. Fingerprint ID: ' + fingerprint_id,
        status: 'error'
      });
    }

    const emp = employee[0];
    const employeeId = emp.employee_id;
    const clientId = emp.client_id;

    console.log(`\n🔐 FINGERPRINT ATTENDANCE - ${emp.employee_name} (${emp.employee_code})`);
    console.log(`   Fingerprint ID: ${fingerprint_id}`);
    console.log(`   Date: ${today}`);
    console.log(`   Time: ${currentTime}`);

    // Check if attendance already exists for today
    const [existing] = await db.execute(`
      SELECT id, check_in_time, check_out_time
      FROM attendance
      WHERE employee_id = ? AND date = ?
    `, [employeeId, today]);

    if (existing.length === 0) {
      // ===== CHECK-IN =====
      console.log(`   Action: CHECK-IN`);

      const schedule = await getEmployeeSchedule(employeeId, clientId, db, today);
      const attendanceId = uuidv4();

      // Get day of week
      const attendanceDate = new Date(today);
      const jsDayOfWeek = attendanceDate.getDay();
      const isWeekend = jsDayOfWeek === 0 ? 1 : jsDayOfWeek + 1;

      // Determine arrival status at check-in time
      const arrivalStatus = determineArrivalStatus(currentTime, schedule, null);

      console.log(`   Arrival Status: ${arrivalStatus}`);

      await db.execute(`
        INSERT INTO attendance (
          id, employee_id, date, check_in_time, check_out_time,
          total_hours, overtime_hours, break_duration,
          arrival_status, work_duration, work_type,
          scheduled_in_time, scheduled_out_time, is_weekend
        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, 0, ?, NULL, 'office', ?, ?, ?)
      `, [
        attendanceId,
        employeeId,
        today,
        currentTime,
        arrivalStatus,
        schedule.start_time,
        schedule.end_time,
        isWeekend
      ]);

      console.log(`   ✅ Check-in successful at ${currentTime}`);

      return res.status(201).json({
        success: true,
        message: `Welcome ${emp.employee_name}!`,
        status: 'success',
        action: 'check_in',
        data: {
          employee_name: emp.employee_name,
          employee_code: emp.employee_code,
          check_in_time: currentTime,
          scheduled_in_time: schedule.start_time,
          arrival_status: arrivalStatus,
          date: today
        }
      });

    } else {
      // ===== CHECK-OUT =====
      const record = existing[0];

      if (record.check_out_time) {
        console.log(`   ⚠️  Already checked out at ${record.check_out_time}`);
        return res.status(400).json({
          success: false,
          message: 'You have already checked out today',
          status: 'info',
          data: {
            employee_name: emp.employee_name,
            check_in_time: record.check_in_time,
            check_out_time: record.check_out_time
          }
        });
      }

      console.log(`   Action: CHECK-OUT`);

      // Get schedule and settings
      const schedule = await getEmployeeSchedule(employeeId, clientId, db, today);
      const durationSettings = await getWorkDurationSettings(clientId, db);

      // Calculate work hours
      const { totalHours, overtimeHours } = await calculateWorkHours(
        record.check_in_time,
        currentTime,
        0, // no break for fingerprint attendance
        clientId,
        db,
        schedule
      );

      // Calculate payable duration
      const payableDuration = calculatePayableDuration(
        record.check_in_time,
        currentTime,
        schedule.start_time,
        schedule.end_time,
        0
      );

      // Get department for status determination
      const [employeeInfo] = await db.execute(`
        SELECT department_id FROM employees WHERE id = ?
      `, [employeeId]);
      const departmentId = employeeInfo[0]?.department_id || null;

      // Determine statuses
      const statusService = new AttendanceStatusService(clientId);
      const arrivalResult = await statusService.determineArrivalStatus(
        record.check_in_time,
        schedule,
        today,
        departmentId,
        null
      );
      const durationResult = await statusService.determineWorkDuration(
        totalHours,
        durationSettings,
        today,
        departmentId,
        null
      );
      const overtimeInfo = await statusService.getOvertimeMultiplier(today, departmentId);
      const enhancedOvertimeHours = overtimeHours * overtimeInfo.multiplier;

      // Update attendance record
      await db.execute(`
        UPDATE attendance
        SET
          check_out_time = ?,
          total_hours = ?,
          overtime_hours = ?,
          payable_duration = ?,
          arrival_status = ?,
          work_duration = ?
        WHERE id = ?
      `, [
        currentTime,
        totalHours,
        enhancedOvertimeHours,
        payableDuration,
        arrivalResult.status,
        durationResult.status,
        record.id
      ]);

      console.log(`   ✅ Check-out successful at ${currentTime}`);
      console.log(`   Total Hours: ${totalHours}h, Overtime: ${enhancedOvertimeHours}h`);

      return res.status(200).json({
        success: true,
        message: `Goodbye ${emp.employee_name}!`,
        status: 'success',
        action: 'check_out',
        data: {
          employee_name: emp.employee_name,
          employee_code: emp.employee_code,
          check_in_time: record.check_in_time,
          check_out_time: currentTime,
          total_hours: totalHours,
          overtime_hours: enhancedOvertimeHours,
          arrival_status: arrivalResult.status,
          work_duration: durationResult.status,
          date: today
        }
      });
    }

  } catch (error) {
    console.error('❌ Fingerprint attendance error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process attendance',
      status: 'error',
      error: error.message
    });
  }
}));

// =============================================
// APPLY AUTHENTICATION TO ALL ROUTES BELOW
// =============================================
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// UTILITY FUNCTIONS FOR DUAL STATUS DETERMINATION
// =============================================

/**
 * Generate enhanced notes with working day context
 */
const generateEnhancedNotes = (originalNotes, workingDayInfo, overtimeInfo) => {
  const notes = [];
  
  if (originalNotes) {
    notes.push(originalNotes);
  }

  if (!workingDayInfo.isWorking) {
    if (workingDayInfo.reason === 'holiday') {
      notes.push(`Worked on holiday: ${workingDayInfo.details}`);
    } else if (workingDayInfo.reason === 'weekend_off') {
      notes.push(`Worked on weekend: ${workingDayInfo.details}`);
    }
  }

  if (overtimeInfo.multiplier > 1.0) {
    notes.push(`${overtimeInfo.reason} (${overtimeInfo.multiplier}x multiplier applied)`);
  }

  return notes.length > 0 ? notes.join(' | ') : null;
};
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;
/**
 * Get employee work schedule from database
 */
const getEmployeeSchedule = async (employeeId, clientId, db, date = null) => {
  const [employee] = await db.execute(`
    SELECT
      e.in_time,
      e.out_time,
      e.follows_company_schedule,
      e.weekend_working_config,
      CONCAT(e.first_name, ' ', e.last_name) as employee_name
    FROM employees e
    WHERE e.id = ? AND e.client_id = ? AND e.employment_status = 'active'
  `, [employeeId, clientId]);

  if (employee.length === 0) {
    throw new Error('Employee not found or inactive');
  }

  const emp = employee[0];

  // Parse weekend working config if present
  let weekendConfig = null;
  if (emp.weekend_working_config) {
    try {
      weekendConfig = JSON.parse(emp.weekend_working_config);
    } catch (e) {
      console.warn('Failed to parse weekend_working_config for employee:', employeeId, e);
    }
  }

  // Check if date is provided and if it's a weekend working day
  if (date && weekendConfig) {
    const dayOfWeek = new Date(date).getDay(); // 0=Sunday, 6=Saturday

    // Saturday working day
    if (dayOfWeek === 6 && weekendConfig.saturday?.working) {
      return {
        start_time: weekendConfig.saturday.in_time,
        end_time: weekendConfig.saturday.out_time,
        late_threshold_minutes: 0, // You can adjust this as needed
        employee_name: emp.employee_name,
        follows_company_schedule: false, // Weekend schedules are custom
        is_weekend_working: true,
        weekend_day: 'saturday',
        full_day_salary: weekendConfig.saturday.full_day_salary
      };
    }

    // Sunday working day
    if (dayOfWeek === 0 && weekendConfig.sunday?.working) {
      return {
        start_time: weekendConfig.sunday.in_time,
        end_time: weekendConfig.sunday.out_time,
        late_threshold_minutes: 0, // You can adjust this as needed
        employee_name: emp.employee_name,
        follows_company_schedule: false, // Weekend schedules are custom
        is_weekend_working: true,
        weekend_day: 'sunday',
        full_day_salary: weekendConfig.sunday.full_day_salary
      };
    }

    // Non-working weekend day
    if ((dayOfWeek === 6 || dayOfWeek === 0) &&
        !(weekendConfig.saturday?.working && dayOfWeek === 6) &&
        !(weekendConfig.sunday?.working && dayOfWeek === 0)) {
      throw new Error('Employee does not work on this weekend day');
    }
  }
  
  // Get late threshold from settings
  const [thresholdSetting] = await db.execute(`
    SELECT setting_value
    FROM system_settings 
    WHERE setting_key = 'late_threshold_minutes' 
    AND client_id = ? 
    LIMIT 1
  `, [clientId]);

  console.log("thresholdSetting",thresholdSetting);

 const lateThresholdMinutes = thresholdSetting.length > 0
  ? Number(JSON.parse(thresholdSetting[0].setting_value)) ?? 0
  : 0;

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
    WHERE setting_key IN ('working_hours_per_day', 'half_day_minimum_hours', 'short_leave_minimum_hours', 'working_hours_per_day') 
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
 * Calculate payable duration based on overlap between scheduled and actual hours
 * Works for both weekdays and weekends (uses the stored scheduled times)
 * Returns SECONDS for precision without excessive storage
 */
const calculatePayableDuration = (checkInTime, checkOutTime, scheduledInTime, scheduledOutTime, breakDuration = 0) => {
  // Normalize all times to HH:MM:SS format
  const normalizeToFullTime = (t) => {
    if (!t) return null;
    const [h = '', m = '', s = '00'] = t.split(':');
    const HH = h.padStart(2, '0');
    const MM = m.padStart(2, '0');
    const SS = s.padStart(2, '0');
    return /^\d\d:\d\d:\d\d$/.test(`${HH}:${MM}:${SS}`) ? `${HH}:${MM}:${SS}` : null;
  };

  const checkIn = normalizeToFullTime(checkInTime);
  const checkOut = normalizeToFullTime(checkOutTime);
  const schedIn = normalizeToFullTime(scheduledInTime);
  const schedOut = normalizeToFullTime(scheduledOutTime);

  // If any required time is missing, return null
  if (!checkIn || !checkOut || !schedIn || !schedOut) {
    return null;
  }

  // Convert to Date objects for calculation
  const actualIn = new Date(`2000-01-01T${checkIn}`);
  const actualOut = new Date(`2000-01-01T${checkOut}`);
  const scheduledIn = new Date(`2000-01-01T${schedIn}`);
  const scheduledOut = new Date(`2000-01-01T${schedOut}`);

  // Validate dates
  if (isNaN(actualIn) || isNaN(actualOut) || isNaN(scheduledIn) || isNaN(scheduledOut)) {
    return null;
  }

  // Calculate overlap between scheduled and actual times
  const overlapStart = actualIn > scheduledIn ? actualIn : scheduledIn;
  const overlapEnd = actualOut < scheduledOut ? actualOut : scheduledOut;

  // If no overlap, payable is 0
  if (overlapEnd <= overlapStart) {
    return 0;
  }

  // Calculate overlap in SECONDS (good precision, reasonable storage)
  const overlapMs = overlapEnd - overlapStart;
  const overlapSeconds = Math.round(overlapMs / 1000); // Convert ms to seconds

  // Subtract break duration (convert break from hours to seconds)
  const breakSeconds = Math.round((breakDuration || 0) * 60 * 60); // hours to seconds
  const payableDurationSeconds = Math.max(0, overlapSeconds - breakSeconds);

  return payableDurationSeconds; // Return as INTEGER seconds
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
const determineWorkDuration = (
  totalHours,
  durationSettings,
  requestedWorkDuration = null
) => {
  /* 1️⃣ explicit override wins */
  if (requestedWorkDuration) {
    return requestedWorkDuration;           // "on_leave", "half_day", etc.
  }

  /* 2️⃣ nothing worked — absent */
  if (totalHours === null || totalHours === 0) {
    return 'absent';
  }

  /* 3️⃣ enough hours for a full day */
  if (totalHours >= durationSettings.full_day_minimum_hours) {
    return 'full_day';
  }

  /* 4️⃣ leave blank for admin to decide */
  return null;
};

/**
 * Calculate work hours and overtime based on system settings
 */
/**
 *  Calculate worked / overtime hours.
 *  - Accepts HH:MM or HH:MM:SS strings
 *  - Uses the employee’s own schedule if available, otherwise the company default
 *  - Break duration is **hours** (decimal, e.g. 1.5 = 90 min)
 *  - Everything returned as *numbers*, rounded to 2 dp.
 */
const calculateWorkHours = async (
  checkInTime,
  checkOutTime,
  breakDuration = 0,
  clientId,
  db,
  employeeSchedule = null   // { start_time:'HH:MM:SS', end_time:'HH:MM:SS' } or null
) => {
  /* ───────── time normaliser ──────── */
  const normalise = (t) => {
    if (!t) return null;
    const [h = '', m = '', s = '00'] = t.split(':');
    const HH = h.padStart(2, '0');
    const MM = m.padStart(2, '0');
    const SS = s.padStart(2, '0');
    return /^\d\d:\d\d:\d\d$/.test(`${HH}:${MM}:${SS}`) ? `${HH}:${MM}:${SS}` : null;
  };

  const inNorm  = normalise(checkInTime);
  const outNorm = normalise(checkOutTime);

  if (!inNorm || !outNorm) {
    return { totalHours: null, overtimeHours: 0, standardHours: null };
  }

  const inDate  = new Date(`2000-01-01T${inNorm}`);
  const outDate = new Date(`2000-01-01T${outNorm}`);

  if (isNaN(inDate) || isNaN(outDate) || outDate <= inDate) {
    return { totalHours: null, overtimeHours: 0, standardHours: null };
  }

  /* raw hours minus break */
  const rawHrs  = (outDate - inDate) / 3.6e6;   // ms ➜ h
  const worked  = Math.max(0, rawHrs - (breakDuration || 0));

  /* what counts as “standard” today? */
  let standard = null;

  if (employeeSchedule?.start_time && employeeSchedule?.end_time) {
    const sIn  = new Date(`2000-01-01T${normalise(employeeSchedule.start_time)}`);
    const sOut = new Date(`2000-01-01T${normalise(employeeSchedule.end_time)}`);
    if (!isNaN(sIn) && !isNaN(sOut) && sOut > sIn) {
      standard = (sOut - sIn) / 3.6e6 - (breakDuration || 0); // subtract same break
    }
  }

  /* fall back to company-wide setting */
  if (standard === null) {
    const { working_hours_per_day } = await getWorkDurationSettings(clientId, db);
    standard = working_hours_per_day;
  }

  /* finally, overtime */
  const ot = Math.max(0, worked - standard);

  return {
    totalHours    : +worked.toFixed(2),      //  number
    overtimeHours : +ot.toFixed(2),          //  number
    standardHours : +standard.toFixed(2)     //  number
  };
};

// =============================================
// CREATE ATTENDANCE RECORD WITH DUAL AUTO STATUS
// =============================================
  router.post('/', [
    checkPermission('attendance.create'),
    body('employee_id').isUUID(),
    body('date').isISO8601(),
    body('check_in_time').optional( { values: 'falsy' } ).matches(timeRegex),
    body('check_out_time').optional( { values: 'falsy' } ).matches(timeRegex),
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
      // Get employee schedule (pass date for weekend working detection)
      const schedule = await getEmployeeSchedule(req.body.employee_id, req.user.clientId, db, req.body.date);
      
      console.log("schedule", schedule);

      // Get work duration settings
      const durationSettings = await getWorkDurationSettings(req.user.clientId, db);
      
      console.log("durationSettings", durationSettings);

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
        db,
        schedule
      );

      console.log("totalHours", totalHours, "overtimeHours", overtimeHours, "standardHours", standardHours);

      // Get employee department for working day calculation
      const [employeeInfo] = await db.execute(`
        SELECT department_id FROM employees WHERE id = ? AND client_id = ?
      `, [req.body.employee_id, req.user.clientId]);
      
      const departmentId = employeeInfo[0]?.department_id || null;

      // Use enhanced attendance status service
      const statusService = new AttendanceStatusService(req.user.clientId);
      
      const arrivalResult = await statusService.determineArrivalStatus(
        req.body.check_in_time,
        schedule,
        req.body.date,
        departmentId,
        req.body.arrival_status
      );

      const durationResult = await statusService.determineWorkDuration(
        totalHours,
        durationSettings,
        req.body.date,
        departmentId,
        req.body.work_duration
      );

      const overtimeInfo = await statusService.getOvertimeMultiplier(req.body.date, departmentId);

      console.log("Enhanced arrival status:", arrivalResult);
      console.log("Enhanced duration status:", durationResult);
      console.log("Overtime multiplier:", overtimeInfo);

      // Calculate enhanced overtime hours with multiplier
      const enhancedOvertimeHours = overtimeHours * overtimeInfo.multiplier;

      // Calculate payable duration
      const payableDuration = calculatePayableDuration(
        req.body.check_in_time,
        req.body.check_out_time,
        schedule.start_time,
        schedule.end_time,
        req.body.break_duration || 0
      );

      // Get day of week for the attendance date
      // MySQL DAYOFWEEK: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
      // JavaScript getDay: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
      const attendanceDate = new Date(req.body.date);
      const jsDayOfWeek = attendanceDate.getDay(); // JavaScript day (0-6)
      const isWeekend = jsDayOfWeek === 0 ? 1 : jsDayOfWeek + 1; // Convert to MySQL DAYOFWEEK (1-7)

      const attendanceData = {
        id: attendanceId,
        employee_id: req.body.employee_id,
        date: req.body.date,
        check_in_time: req.body.check_in_time || null,
        check_out_time: req.body.check_out_time || null,
        total_hours: totalHours,
        overtime_hours: enhancedOvertimeHours, // Use enhanced overtime with multiplier
        break_duration: req.body.break_duration || 0,
        arrival_status: arrivalResult.status,
        work_duration: durationResult.status,
        work_type: req.body.work_type || 'office',
        notes: generateEnhancedNotes(req.body.notes, arrivalResult.workingDayInfo, overtimeInfo),
        created_by: req.user.userId,
        scheduled_in_time: schedule.start_time || null,
        scheduled_out_time: schedule.end_time || null,
        payable_duration: payableDuration,
        is_weekend: isWeekend
      };

      console.log("attendanceData", attendanceData);

      const insertQuery = `
        INSERT INTO attendance (
          id, employee_id, date, check_in_time, check_out_time, total_hours,
          overtime_hours, break_duration, arrival_status, work_duration, work_type, notes, created_by, scheduled_in_time, scheduled_out_time, payable_duration, is_weekend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      console.log("newRecord", res.data);

    } catch (error) {
      console.error('Error creating attendance record:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create attendance record'
      });
    }
  }));

// =============================================
// GET ATTENDANCE RECORDS
// =============================================
router.get('/', 
  checkPermission('attendance.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const {
      page = 1,
      limit = 50,
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
    CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
    e.employee_code,
    e.in_time AS scheduled_in_time,
    e.out_time AS scheduled_out_time,
    e.follows_company_schedule,
    d.name AS department_name
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
// UPDATE ATTENDANCE RECORD WITH DUAL AUTO STATUS
// =============================================
// router.put('/:id', [
//   checkPermission('attendance.edit'),
//   checkResourceOwnership('attendance'),
//   body('check_in_time').optional({ checkFalsy: true }).matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
//   body('check_out_time').optional({ checkFalsy: true }).matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
//   body('arrival_status').optional().isIn(['on_time', 'late', 'absent']),
//   body('work_duration').optional().isIn(['full_day', 'half_day', 'short_leave', 'on_leave']),
//   body('break_duration').optional().isFloat({ min: 0, max: 24 }),
//   body('work_type').optional().isIn(['office', 'remote', 'hybrid']),
//   body('notes').optional().isLength({ max: 500 })
// ], asyncHandler(async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({
//       success: false,
//       message: 'Validation failed',
//       errors: errors.array()
//     });
//   }

//   const db = getDB();
//   const attendanceId = req.params.id;

//   try {
//     // Get current record
//     const [currentRecord] = await db.execute(`
//       SELECT a.*, e.client_id, e.id as employee_id
//       FROM attendance a
//       JOIN employees e ON a.employee_id = e.id
//       WHERE a.id = ?
//     `, [attendanceId]);

//     if (currentRecord.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Attendance record not found'
//       });
//     }

//     const current = currentRecord[0];
    
//     // Get employee schedule and duration settings
//     const schedule = await getEmployeeSchedule(current.employee_id, req.user.clientId, db);
//     const durationSettings = await getWorkDurationSettings(req.user.clientId, db);

//     // Build update query
//     const allowedFields = ['check_in_time', 'check_out_time', 'break_duration', 'arrival_status', 'work_duration', 'work_type', 'notes'];
//     const updateFields = [];
//     const updateValues = [];

//     allowedFields.forEach(field => {
//       if (req.body.hasOwnProperty(field)) { 
//         updateFields.push(`${field} = ?`);
//         updateValues.push(req.body[field]);
//       }
//     });

//     if (updateFields.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid fields to update'
//       });
//     }

//     // Get updated times
//     const newCheckIn = req.body.check_in_time || current.check_in_time;
//     const newCheckOut = req.body.check_out_time || current.check_out_time;
//     const newBreakDuration = req.body.break_duration || current.break_duration;

//     // Recalculate work hours
//     const { totalHours, overtimeHours, standardHours } = await calculateWorkHours(
//       newCheckIn, 
//       newCheckOut, 
//       newBreakDuration,
//       req.user.clientId,
//       db
//     );

//     // Auto-determine statuses if not manually provided or if times changed
//     let finalArrivalStatus = req.body.arrival_status;
//     let finalWorkDuration = req.body.work_duration;
//     let arrivalAutoCalculated = false;
//     let durationAutoCalculated = false;

//     // Auto-calculate arrival status if not manually set or if check-in time changed
//     if (!finalArrivalStatus || req.body.check_in_time) {
//       finalArrivalStatus = determineArrivalStatus(newCheckIn, schedule, req.body.arrival_status);
//       arrivalAutoCalculated = true;
      
//       // Update arrival status in the update fields
//       const arrivalIndex = updateFields.findIndex(field => field.includes('arrival_status'));
//       if (arrivalIndex >= 0) {
//         updateValues[arrivalIndex] = finalArrivalStatus;
//       } else {
//         updateFields.push('arrival_status = ?');
//         updateValues.push(finalArrivalStatus);
//       }
//     }

//     // Auto-calculate work duration if not manually set to on_leave or if times changed
//     if (!finalWorkDuration || (finalWorkDuration !== 'on_leave' && (req.body.check_in_time || req.body.check_out_time || req.body.break_duration))) {
//       finalWorkDuration = determineWorkDuration(totalHours, durationSettings, req.body.work_duration);
//       durationAutoCalculated = true;
      
//       // Update work duration in the update fields
//       const durationIndex = updateFields.findIndex(field => field.includes('work_duration'));
//       if (durationIndex >= 0) {
//         updateValues[durationIndex] = finalWorkDuration;
//       } else {
//         updateFields.push('work_duration = ?');
//         updateValues.push(finalWorkDuration);
//       }
//     }

//     // Update work hours if changed
//     if (totalHours !== null) {
//       updateFields.push('total_hours = ?', 'overtime_hours = ?');
//       updateValues.push(totalHours, overtimeHours);
//     }

//     updateFields.push('updated_by = ?', 'updated_at = NOW()');
//     updateValues.push(req.user.userId, attendanceId);

//     const updateQuery = `
//       UPDATE attendance 
//       SET ${updateFields.join(', ')}
//       WHERE id = ?
//     `;

//     await db.execute(updateQuery, updateValues);

//     // Get updated record
//     const [updatedRecord] = await db.execute(`
//       SELECT 
//         a.*,
//         CONCAT(e.first_name, ' ', e.last_name) as employee_name,
//         e.employee_code,
//         e.in_time as scheduled_in_time,
//         e.out_time as scheduled_out_time
//       FROM attendance a
//       JOIN employees e ON a.employee_id = e.id
//       WHERE a.id = ?
//     `, [attendanceId]);

//     res.status(200).json({
//       success: true,
//       message: 'Attendance record updated successfully',
//       data: {
//         attendance: updatedRecord[0],
//         calculation_info: {
//           scheduled_start: schedule.start_time,
//           scheduled_end: schedule.end_time,
//           late_threshold_minutes: schedule.late_threshold_minutes,
//           standard_working_hours: standardHours,
//           duration_thresholds: durationSettings,
//           arrival_status_auto_determined: arrivalAutoCalculated,
//           work_duration_auto_determined: durationAutoCalculated,
//           follows_company_schedule: schedule.follows_company_schedule
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Error updating attendance record:', error);
//     return res.status(400).json({
//       success: false,
//       message: error.message || 'Failed to update attendance record'
//     });
//   }
// }));

// =============================================
// BULK PATCH ATTENDANCE RECORDS (MULTIPLE EMPLOYEES, DATE RANGE)
// =============================================
router.patch('/bulk', [
  checkPermission('attendance.edit'),
  body('start_date').isISO8601().withMessage('Invalid start_date format'),
  body('end_date').isISO8601().withMessage('Invalid end_date format'),
  body('employee_ids').isArray().withMessage('employee_ids must be an array'),
  body('employee_ids.*').isUUID(),

  // Optional fields to update (same as single PATCH)
  body('check_in_time')
    .optional({ checkFalsy: true })
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
  body('check_out_time')
    .optional({ checkFalsy: true })
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
  body('arrival_status')
    .optional({ checkFalsy: true })
    .isIn(['on_time', 'late', 'absent']),
  body('work_duration')
    .optional({ checkFalsy: true })
    .isIn(['full_day', 'half_day', 'short_leave', 'on_leave']),
  body('break_duration').optional().isFloat({ min: 0, max: 24 }),
  body('work_type').optional().isIn(['office', 'remote', 'hybrid']),
  body('notes').optional().isLength({ max: 500 })
], asyncHandler(async (req, res) => {
  /* ───────── 1. basic validation ───────── */
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const { start_date, end_date, employee_ids } = req.body;

  // Validate date range
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (startDate > endDate) {
    return res.status(400).json({
      success: false,
      message: 'start_date must be before or equal to end_date'
    });
  }

  // Generate all dates in range
  const dates = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`📊 Bulk PATCH for ${employee_ids.length} employees across ${dates.length} dates`);

  const results = [];
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    for (const dateStr of dates) {
      for (const employeeId of employee_ids) {
        totalProcessed++;

        try {
          /* ───────── 2. fetch current attendance record ───────── */
          const [attendanceRows] = await db.execute(
            `SELECT a.*, e.client_id
               FROM attendance a
               JOIN employees e ON a.employee_id = e.id
              WHERE a.employee_id = ? AND a.date = ? AND e.client_id = ?`,
            [employeeId, dateStr, req.user.clientId]
          );

          console.log(`🔍 Looking for attendance: employee=${employeeId}, date=${dateStr}, client=${req.user.clientId}, found=${attendanceRows.length}`);

          if (attendanceRows.length === 0) {
            results.push({
              date: dateStr,
              employee_id: employeeId,
              updated: false,
              message: 'No attendance record found for this date'
            });
            totalSkipped++;
            continue;
          }

          const current = attendanceRows[0];

          /* ───────── 3. get schedule & settings ───────── */
          const schedule = await getEmployeeSchedule(employeeId, req.user.clientId, db, dateStr);
          const durationSettings = await getWorkDurationSettings(req.user.clientId, db);

          /* ───────── 4. figure out effective values after merge ───────── */
          const eff = {
            check_in_time: req.body.check_in_time ?? current.check_in_time,
            check_out_time: req.body.check_out_time ?? current.check_out_time,
            break_duration: req.body.break_duration ?? current.break_duration,
          };

          // Recalculate hours/overtime
          const { totalHours, overtimeHours } = await calculateWorkHours(
            eff.check_in_time,
            eff.check_out_time,
            eff.break_duration,
            req.user.clientId,
            db,
            schedule
          );

          /* ───────── 5. determine arrival status ───────── */
          const arrivalStatus = req.body.arrival_status !== undefined && req.body.arrival_status !== ''
            ? req.body.arrival_status
            : determineArrivalStatus(eff.check_in_time, schedule, undefined);

          /* ───────── 6. determine work duration (check for approved leave) ───────── */
          const [leaveRows] = await db.execute(
            `SELECT leave_duration
               FROM leave_requests
              WHERE employee_id = ?
                AND DATE(?) BETWEEN DATE(start_date) AND DATE(end_date)
                AND status = 'approved'
              LIMIT 1`,
            [employeeId, dateStr]
          );

          const leaveRow = leaveRows[0] || null;
          let workDuration;

          if (leaveRow) {
            workDuration = leaveRow.leave_duration;
          } else {
            workDuration =
              (req.body.work_duration !== undefined && req.body.work_duration !== '')
                ? req.body.work_duration
                : determineWorkDuration(totalHours, durationSettings, undefined);
          }

          /* ───────── 7. calculate payable duration ───────── */
          const payableDuration = calculatePayableDuration(
            eff.check_in_time,
            eff.check_out_time,
            current.scheduled_in_time,
            current.scheduled_out_time,
            eff.break_duration
          );

          /* ───────── 8. build UPDATE SET list (only changed columns) ───────── */
          const cols = [];
          const vals = [];

          const maybePush = (col, newVal, oldVal) => {
            if (newVal !== undefined && newVal !== oldVal) {
              cols.push(`${col} = ?`);
              vals.push(newVal);
            }
          };

          maybePush('check_in_time', eff.check_in_time, current.check_in_time);
          maybePush('check_out_time', eff.check_out_time, current.check_out_time);
          maybePush('break_duration', eff.break_duration, current.break_duration);
          maybePush('arrival_status', arrivalStatus, current.arrival_status);
          maybePush('work_duration', workDuration, current.work_duration);
          maybePush('total_hours', totalHours, current.total_hours);
          maybePush('overtime_hours', overtimeHours, current.overtime_hours);
          maybePush('payable_duration', payableDuration, current.payable_duration);

          ['work_type', 'notes'].forEach((k) =>
            maybePush(k, req.body[k], current[k])
          );

          if (cols.length === 0) {
            results.push({
              date: dateStr,
              employee_id: employeeId,
              updated: false,
              message: 'No fields to update'
            });
            totalSkipped++;
            continue;
          }

          cols.push('updated_by = ?', 'updated_at = NOW()');
          vals.push(req.user.userId, current.id);

          /* ───────── 9. execute update ───────── */
          await db.execute(
            `UPDATE attendance SET ${cols.join(', ')} WHERE id = ?`,
            vals
          );

          results.push({
            date: dateStr,
            employee_id: employeeId,
            employee_name: schedule.employee_name,
            updated: true,
            fields_updated: cols.length - 2 // exclude updated_by and updated_at
          });
          totalUpdated++;

        } catch (error) {
          results.push({
            date: dateStr,
            employee_id: employeeId,
            updated: false,
            error: error.message
          });
          totalSkipped++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk update completed. ${totalUpdated} records updated across ${dates.length} date(s).`,
      data: {
        results,
        summary: {
          total_dates: dates.length,
          total_employees: employee_ids.length,
          total_processed: totalProcessed,
          updated: totalUpdated,
          skipped: totalSkipped
        }
      }
    });

  } catch (error) {
    console.error('Error in bulk PATCH:', error);
    return res.status(500).json({
      success: false,
      message: 'Bulk update failed',
      error: error.message
    });
  }
}));

// PATCH /api/attendance/:id  – recalc arrival_status & hours when times change
router.patch('/:id',
  [
    checkPermission('attendance.edit'),
    checkResourceOwnership('attendance'),

    body('check_in_time')
      .optional({ checkFalsy: true })
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),

    body('check_out_time')
      .optional({ checkFalsy: true })
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),

    body('arrival_status')
      .optional({ checkFalsy: true })
      .isIn(['on_time', 'late', 'absent']),

    body('work_duration')
      .optional({ checkFalsy: true })
      .isIn(['full_day', 'half_day', 'short_leave', 'on_leave']),

    body('break_duration').optional().isFloat({ min: 0, max: 24 }),
    body('work_type').optional().isIn(['office', 'remote', 'hybrid']),
    body('notes').optional().isLength({ max: 500 })
  ],
  asyncHandler(async (req, res) => {
    /* ───────── 1. basic validation ───────── */
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

    /* ───────── 2. fetch current row & employee schedule ───────── */
    const [[current]] = await db.execute(
      `SELECT a.*, e.client_id
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ?`, [attendanceId]
    );
    if (!current) {
      return res.status(404).json({ success:false, message:'Record not found' });
    }

    console.log('🔍 Debug - Current record:', current);
    
    const schedule         = await getEmployeeSchedule(current.employee_id, req.user.clientId, db, current.date);
    const durationSettings = await getWorkDurationSettings(req.user.clientId, db);

    /* ───────── 3. figure out the “effective” values after merge ───────── */
    const eff = {           // effective values after patch
      check_in_time  : req.body.check_in_time  ?? current.check_in_time,
      check_out_time : req.body.check_out_time ?? current.check_out_time,
      break_duration : req.body.break_duration ?? current.break_duration,
    };

    // recalc hours/overtime
    const { totalHours, overtimeHours } = await calculateWorkHours(
      eff.check_in_time,
      eff.check_out_time,
      eff.break_duration,
      req.user.clientId,
      db,
      schedule

    );

    console.log('totalHours', totalHours);
    console.log('overtimeHours', overtimeHours);

    /* arrival_status:
       - use req.body.arrival_status if provided & non-empty
       - else recalc whenever check_in_time changed OR arrival_status not in body
    */
    const arrivalStatus = req.body.arrival_status !== undefined && req.body.arrival_status !== ''
      ? req.body.arrival_status
      : determineArrivalStatus(
          eff.check_in_time,
          schedule,
          undefined               // force auto
        );

        console.log('req.body', req.body);

const [rows] = await db.execute(
  `SELECT leave_duration
     FROM leave_requests
    WHERE employee_id = ?
      AND DATE(?) BETWEEN DATE(start_date) AND DATE(end_date)
      AND status = 'approved'
    LIMIT 1`,
  [current.employee_id, current.date] // 'YYYY-MM-DD'
);

const leaveRow = rows[0] || null;

// Decide final workDuration:
// if an approved leave exists → use its leave_type directly;
// else use your existing precedence (explicit body value > auto).
let workDuration;

if (leaveRow) {
  workDuration = leaveRow.leave_type
} else {
  workDuration =
    (req.body.work_duration !== undefined && req.body.work_duration !== '')
      ? req.body.work_duration
      : determineWorkDuration(totalHours, durationSettings, undefined);
}

// (optional) log
console.log('final workDuration:', workDuration);

    /* ───────── 4. calculate payable duration ───────── */
    const payableDuration = calculatePayableDuration(
      eff.check_in_time,
      eff.check_out_time,
      current.scheduled_in_time,
      current.scheduled_out_time,
      eff.break_duration
    );

    /* ───────── 5. build UPDATE SET list (only cols that changed) ───────── */
    const cols = [];
    const vals = [];

    const maybePush = (col, newVal, oldVal) => {
      if (newVal !== undefined && newVal !== oldVal) {
        cols.push(`${col} = ?`);
        vals.push(newVal);
      }
    };

    maybePush('check_in_time',  eff.check_in_time,  current.check_in_time);
    maybePush('check_out_time', eff.check_out_time, current.check_out_time);
    maybePush('break_duration', eff.break_duration, current.break_duration);
    maybePush('arrival_status', arrivalStatus,      current.arrival_status);
    maybePush('work_duration',  workDuration,       current.work_duration);

    maybePush('total_hours',    totalHours,         current.total_hours);
    maybePush('overtime_hours', overtimeHours,      current.overtime_hours);
    maybePush('payable_duration', payableDuration,  current.payable_duration);

    ['work_type', 'notes'].forEach((k) =>
      maybePush(k, req.body[k], current[k])
    );

    if (cols.length === 0) {
      return res.status(400).json({ success:false, message:'No fields to update' });
    }

    cols.push('updated_by = ?', 'updated_at = NOW()');
    vals.push(req.user.userId, attendanceId);

    /* ───────── 5. execute update ───────── */
    await db.execute(
      `UPDATE attendance SET ${cols.join(', ')} WHERE id = ?`,
      vals
    );

    /* ───────── 6. return the fresh record ───────── */
    const [[updated]] = await db.execute(
      `SELECT a.*,
              CONCAT(e.first_name,' ',e.last_name) AS employee_name,
              e.employee_code
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ?`, [attendanceId]
    );

    res.json({ success:true, message:'Attendance updated', data:updated });
  })
);

// =============================================
// BULK STATUS UPDATE ENDPOINT (DUAL STATUS)
// =============================================
router.post('/bulk-update-status', [
  checkPermission('attendance.edit'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('start_date').optional().isISO8601().withMessage('Invalid start_date format'),
  body('end_date').optional().isISO8601().withMessage('Invalid end_date format'),
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
  const { date, start_date, end_date, employee_ids, update_arrival = true, update_duration = true } = req.body;

  // Validate date parameters
  if (!date && (!start_date || !end_date)) {
    return res.status(400).json({
      success: false,
      message: 'Either provide "date" for single day OR "start_date" and "end_date" for date range'
    });
  }

  // Generate date array
  const dates = [];
  if (date) {
    // Single date mode
    dates.push(date);
  } else {
    // Date range mode
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'start_date must be before or equal to end_date'
      });
    }

    // Generate all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  console.log(`📊 Bulk update for ${employee_ids.length} employees across ${dates.length} dates`);

  const results = [];
  let totalProcessed = 0;
  let totalUpdated = 0;

  try {
    for (const currentDate of dates) {
      for (const employeeId of employee_ids) {
        totalProcessed++;
      try {
        // Get employee schedule and duration settings
        const schedule = await getEmployeeSchedule(employeeId, req.user.clientId, db, currentDate);
        const durationSettings = await getWorkDurationSettings(req.user.clientId, db);

        // Check if attendance record exists
        const [existing] = await db.execute(`
          SELECT * FROM attendance WHERE employee_id = ? AND date = ?
        `, [employeeId, currentDate]);

        if (existing.length > 0) {
          const record = existing[0];
          const updates = [];
          const updateValues = [];
          
          let arrivalUpdated = false;
          let durationUpdated = false;
          
          // First recalculate work hours using the same logic as PATCH endpoint
          const { totalHours, overtimeHours } = await calculateWorkHours(
            record.check_in_time,
            record.check_out_time,
            record.break_duration,
            req.user.clientId,
            db,
            schedule
          );
          
          // Get employee department
          const [employeeInfo] = await db.execute(`
            SELECT department_id FROM employees WHERE id = ? AND client_id = ?
          `, [employeeId, req.user.clientId]);
          
          const departmentId = employeeInfo[0]?.department_id || null;
          
          // Use enhanced attendance status service
          const statusService = new AttendanceStatusService(req.user.clientId);

          // Auto-determine arrival status if requested
          if (update_arrival) {
            const arrivalResult = await statusService.determineArrivalStatus(
              record.check_in_time,
              schedule,
              record.date,
              departmentId,
              null // Force recalculation for bulk update
            );

            if (record.arrival_status !== arrivalResult.status) {
              updates.push('arrival_status = ?');
              updateValues.push(arrivalResult.status);
              arrivalUpdated = true;
            }
          }
          
          // Auto-determine work duration if requested
          if (update_duration) {
            const durationResult = await statusService.determineWorkDuration(
              totalHours, // Use recalculated hours
              durationSettings,
              record.date,
              departmentId,
              null // Force recalculation for bulk update
            );

            if (record.work_duration !== durationResult.status) {
              updates.push('work_duration = ?');
              updateValues.push(durationResult.status);
              durationUpdated = true;
            }
          }

          // Update calculated hours if they changed
          if (record.total_hours !== totalHours) {
            updates.push('total_hours = ?');
            updateValues.push(totalHours);
          }

          if (record.overtime_hours !== overtimeHours) {
            updates.push('overtime_hours = ?');
            updateValues.push(overtimeHours);
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
              date: currentDate,
              employee_id: employeeId,
              employee_name: schedule.employee_name,
              arrival_updated: arrivalUpdated,
              duration_updated: durationUpdated,
              updated: true
            });
            totalUpdated++;
          } else {
            results.push({
              date: currentDate,
              employee_id: employeeId,
              employee_name: schedule.employee_name,
              updated: false,
              message: 'Status already correct'
            });
          }
        } else {
          results.push({
            date: currentDate,
            employee_id: employeeId,
            employee_name: schedule.employee_name,
            updated: false,
            message: 'No attendance record found for this date'
          });
        }
      } catch (error) {
        results.push({
          date: currentDate,
          employee_id: employeeId,
          updated: false,
          error: error.message
        });
      }
      }
    }

    const updatedCount = results.filter(r => r.updated).length;

    res.status(200).json({
      success: true,
      message: `Bulk status update completed. ${updatedCount} records updated across ${dates.length} date(s).`,
      data: {
        results,
        summary: {
          total_dates: dates.length,
          total_employees: employee_ids.length,
          total_processed: totalProcessed,
          updated: totalUpdated,
          skipped: totalProcessed - totalUpdated
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
// BULK UPDATE SCHEDULED TIMES
// =============================================
router.post('/bulk-update-scheduled-times', [
  checkPermission('attendance.edit'),
  body('start_date').isISO8601().withMessage('Invalid start_date format'),
  body('end_date').isISO8601().withMessage('Invalid end_date format'),
  body('employee_ids').isArray().withMessage('employee_ids must be an array'),
  body('employee_ids.*').isUUID()
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
  const { start_date, end_date, employee_ids } = req.body;

  // Validate date range
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (startDate > endDate) {
    return res.status(400).json({
      success: false,
      message: 'start_date must be before or equal to end_date'
    });
  }

  // Generate all dates in range
  const dates = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`📅 Bulk scheduled times update for ${employee_ids.length} employees across ${dates.length} dates`);

  const results = [];
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    for (const dateStr of dates) {
      for (const employeeId of employee_ids) {
        totalProcessed++;

        try {
          // Get employee schedule for this specific date (handles weekend working days)
          const schedule = await getEmployeeSchedule(employeeId, req.user.clientId, db, dateStr);

          // Check if attendance record exists
          const [existing] = await db.execute(`
            SELECT id, scheduled_in_time, scheduled_out_time
            FROM attendance
            WHERE employee_id = ? AND date = ?
          `, [employeeId, dateStr]);

          if (existing.length > 0) {
            const record = existing[0];
            const newScheduledIn = schedule.start_time || null;
            const newScheduledOut = schedule.end_time || null;

            // Check if update is needed
            if (record.scheduled_in_time !== newScheduledIn || record.scheduled_out_time !== newScheduledOut) {
              await db.execute(`
                UPDATE attendance
                SET scheduled_in_time = ?,
                    scheduled_out_time = ?,
                    updated_by = ?,
                    updated_at = NOW()
                WHERE id = ?
              `, [newScheduledIn, newScheduledOut, req.user.userId, record.id]);

              results.push({
                date: dateStr,
                employee_id: employeeId,
                employee_name: schedule.employee_name,
                old_scheduled_in: record.scheduled_in_time,
                old_scheduled_out: record.scheduled_out_time,
                new_scheduled_in: newScheduledIn,
                new_scheduled_out: newScheduledOut,
                updated: true
              });
              totalUpdated++;
            } else {
              results.push({
                date: dateStr,
                employee_id: employeeId,
                employee_name: schedule.employee_name,
                scheduled_in: newScheduledIn,
                scheduled_out: newScheduledOut,
                updated: false,
                message: 'Scheduled times already correct'
              });
              totalSkipped++;
            }
          } else {
            results.push({
              date: dateStr,
              employee_id: employeeId,
              employee_name: schedule.employee_name,
              updated: false,
              message: 'No attendance record found for this date'
            });
            totalSkipped++;
          }
        } catch (error) {
          results.push({
            date: dateStr,
            employee_id: employeeId,
            updated: false,
            error: error.message
          });
          totalSkipped++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk scheduled times update completed. ${totalUpdated} records updated across ${dates.length} date(s).`,
      data: {
        results,
        summary: {
          total_dates: dates.length,
          total_employees: employee_ids.length,
          total_processed: totalProcessed,
          updated: totalUpdated,
          skipped: totalSkipped
        }
      }
    });

  } catch (error) {
    console.error('Error in bulk scheduled times update:', error);
    return res.status(500).json({
      success: false,
      message: 'Bulk scheduled times update failed',
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