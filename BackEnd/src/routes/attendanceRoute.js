const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess, checkResourceOwnership } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const AttendanceStatusService = require('../services/AttendanceStatusService');
const smsService = require('../services/smsService');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// File logger for debugging fingerprint endpoint
const logToFile = (message) => {
  const logDir = path.join(__dirname, '..', 'logs');
  const logFile = path.join(logDir, 'fingerprint-debug.log');

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  fs.appendFileSync(logFile, logMessage);
};

// Time validation regex - supports HH:MM and HH:MM:SS formats
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;

// =============================================
// PUBLIC ENDPOINTS (No Authentication Required)
// =============================================

// FINGERPRINT ATTENDANCE ENDPOINT - Must be BEFORE authentication middleware
/**
 * GET /api/attendance/fingerprint
 * This endpoint receives fingerprint check-in/check-out from fp.php
 * No authentication required as it's called from the fingerprint device
 *
 * Query parameters (in order):
 * - client_id: UUID (optional, if multiple clients use same fingerprint device)
 * - fingerprint_id: Integer (matches employees.fingerprint_id)
 *
 * Example: GET /api/attendance/fingerprint?client_id=uuid-here&fingerprint_id=123
 * Or without client_id: GET /api/attendance/fingerprint?fingerprint_id=123
 */
router.get('/fingerprint', [
  query('client_id').optional().isString().trim().notEmpty().withMessage('client_id must be a non-empty string'),
  query('fingerprint_id').isInt().withMessage('fingerprint_id must be an integer')
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
  const { fingerprint_id, client_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

  try {
    // Map fingerprint ID to employee in new system
    let query = `
      SELECT
        e.id as employee_id,
        e.client_id,
        e.in_time,
        e.out_time,
        e.fingerprint_id,
        e.phone,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code,
        c.name as client_name
      FROM employees e
      LEFT JOIN clients c ON e.client_id = c.id
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

      // Get employee department for status determination
      const [employeeInfo] = await db.execute(`SELECT department_id FROM employees WHERE id = ?`, [employeeId]);
      const departmentId = employeeInfo[0]?.department_id || null;

      // Determine arrival status at check-in time using AttendanceStatusService
      const statusService = new AttendanceStatusService(clientId);
      const arrivalResult = await statusService.determineArrivalStatus(currentTime, schedule, today, departmentId, null, employeeId);
      const arrivalStatus = arrivalResult.status;

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

      // Send check-in SMS notification
      if (emp.phone && emp.client_name) {
        const lateBy = smsService.calculateLateTime(currentTime, schedule.start_time);

        smsService.sendCheckInSMS({
          employeeName: emp.employee_name,
          companyName: emp.client_name,
          phoneNumber: emp.phone,
          date: today,
          time: currentTime,
          isLate: !!lateBy,
          lateBy: lateBy || '',
          clientId: clientId
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`   📱 Check-in SMS sent to ${emp.phone}`);
          } else {
            console.log(`   ⚠️  Check-in SMS failed: ${smsResult.error}`);
          }
        }).catch(err => {
          console.error(`   ❌ SMS error:`, err.message);
        });
      }

      return res.status(200).json({
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
      // ===== CHECK-OUT OR DUPLICATE CHECK-IN =====
      const record = existing[0];

      const debugHeader = `\n========== CHECKOUT VALIDATION DEBUG ==========`;
      console.log(debugHeader);
      logToFile(debugHeader);

      const recordLog = `   Existing record found: ${JSON.stringify(record, null, 2)}`;
      console.log(recordLog);
      logToFile(recordLog);

      if (record.check_out_time) {
        const alreadyCheckedOut = `   ⚠️  Already checked out at ${record.check_out_time}`;
        console.log(alreadyCheckedOut);
        logToFile(alreadyCheckedOut);

        const debugFooter = `========== END CHECKOUT VALIDATION ==========\n`;
        console.log(debugFooter);
        logToFile(debugFooter);

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

      const proceedingLog = `   No checkout time found - proceeding with validation`;
      console.log(proceedingLog);
      logToFile(proceedingLog);

      // Get employee's schedule (handles weekdays & weekends automatically)
      const schedule = await getEmployeeSchedule(employeeId, clientId, db, today);
      const scheduleLog = `   Schedule retrieved: ${JSON.stringify(schedule, null, 2)}`;
      console.log(scheduleLog);
      logToFile(scheduleLog);

      // Helper function to normalize time to HH:MM:SS format
      const normalizeTime = (timeStr) => {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        const hh = parts[0]?.padStart(2, '0') || '00';
        const mm = parts[1]?.padStart(2, '0') || '00';
        const ss = parts[2]?.padStart(2, '0') || '00';
        return `${hh}:${mm}:${ss}`;
      };

      // Calculate employee's scheduled work duration in hours
      let scheduledHours = 8; // Default to 8 hours
      let minimumWorkHours = 4; // Default to 4 hours
      let schedOut = null; // Declare schedOut outside the block
      let normalizedSchedEnd = null; // Declare normalizedSchedEnd outside the block

      // Only calculate scheduled hours if schedule times exist (not volunteer work)
      if (schedule.start_time && schedule.end_time) {
        const normalizedSchedStart = normalizeTime(schedule.start_time);
        normalizedSchedEnd = normalizeTime(schedule.end_time);

        const log1 = `   Normalized schedule start: ${normalizedSchedStart}`;
        console.log(log1);
        logToFile(log1);

        const log2 = `   Normalized schedule end: ${normalizedSchedEnd}`;
        console.log(log2);
        logToFile(log2);

        const schedIn = new Date(`2000-01-01T${normalizedSchedStart}`);
        schedOut = new Date(`2000-01-01T${normalizedSchedEnd}`);
        scheduledHours = (schedOut - schedIn) / (1000 * 60 * 60);

        const log3 = `   Scheduled hours: ${scheduledHours}h`;
        console.log(log3);
        logToFile(log3);

        // Minimum work time = half of scheduled hours (e.g., 9h schedule → 4.5h minimum)
        minimumWorkHours = scheduledHours / 2;
      } else if (schedule.is_non_working_day) {
        // Volunteer work on non-working day - no minimum hours required
        const log1 = `   Volunteer work detected - no scheduled hours`;
        console.log(log1);
        logToFile(log1);

        minimumWorkHours = 0; // No minimum for volunteer work
      }
      const log4 = `   Minimum work hours required: ${minimumWorkHours}h`;
      console.log(log4);
      logToFile(log4);

      // Calculate actual time worked since check-in
      const normalizedCheckIn = normalizeTime(record.check_in_time);
      const normalizedCurrentTime = normalizeTime(currentTime);

      const log5 = `   Normalized check-in time: ${normalizedCheckIn}`;
      console.log(log5);
      logToFile(log5);

      const log6 = `   Normalized current time: ${normalizedCurrentTime}`;
      console.log(log6);
      logToFile(log6);

      const checkInDate = new Date(`2000-01-01T${normalizedCheckIn}`);
      const currentDate = new Date(`2000-01-01T${normalizedCurrentTime}`);

      const log7 = `   Check-in Date object: ${checkInDate}`;
      console.log(log7);
      logToFile(log7);

      const log8 = `   Current Date object: ${currentDate}`;
      console.log(log8);
      logToFile(log8);

      const hoursWorked = (currentDate - checkInDate) / (1000 * 60 * 60);
      const log9 = `   Hours worked: ${hoursWorked}h`;
      console.log(log9);
      logToFile(log9);

      // Validate date calculations
      if (isNaN(hoursWorked) || isNaN(minimumWorkHours)) {
        const errorLog1 = `   ❌ Invalid time calculation detected`;
        const errorLog2 = `   Check-in: ${record.check_in_time}, Current: ${currentTime}`;
        const errorLog3 = `========== END CHECKOUT VALIDATION ==========\n`;

        console.log(errorLog1);
        logToFile(errorLog1);
        console.log(errorLog2);
        logToFile(errorLog2);
        console.log(errorLog3);
        logToFile(errorLog3);

        return res.status(400).json({
          success: false,
          message: 'Invalid time format detected',
          status: 'error'
        });
      }

      const comparisonLog = `\n   COMPARISON: ${hoursWorked}h < ${minimumWorkHours}h = ${hoursWorked < minimumWorkHours}`;
      console.log(comparisonLog);
      logToFile(comparisonLog);

      // Check if current time is past scheduled end time
      const isPastScheduledEndTime = schedOut ? currentDate >= schedOut : false;
      const endTimeLog = `   Current time (${normalizedCurrentTime}) >= Scheduled end (${schedOut ? schedOut.toTimeString().split(' ')[0] : 'N/A'}) = ${isPastScheduledEndTime}`;
      console.log(endTimeLog);
      logToFile(endTimeLog);

      // Check if enough time passed for valid checkout
      // Allow checkout if EITHER:
      // 1. Worked minimum hours OR
      // 2. Current time is past scheduled end time
      if (hoursWorked < minimumWorkHours && !isPastScheduledEndTime) {
        const earlyLog1 = `   ⚠️  Duplicate scan ignored - Too early for checkout`;
        const earlyLog2 = `   Hours worked: ${hoursWorked.toFixed(2)}h < Minimum required: ${minimumWorkHours.toFixed(2)}h`;
        const earlyLog3 = `   Current time is before scheduled end time`;
        const earlyLog4 = `   RETURNING EARLY - NO DATABASE UPDATE`;
        const earlyLog5 = `========== END CHECKOUT VALIDATION ==========\n`;

        console.log(earlyLog1);
        logToFile(earlyLog1);
        console.log(earlyLog2);
        logToFile(earlyLog2);
        console.log(earlyLog3);
        logToFile(earlyLog3);
        console.log(earlyLog4);
        logToFile(earlyLog4);
        console.log(earlyLog5);
        logToFile(earlyLog5);
        return res.status(200).json({
          success: false,
          message: 'Already marked attendance for today',
          status: 'info',
          data: {
            employee_name: emp.employee_name,
            employee_code: emp.employee_code,
            check_in_time: record.check_in_time,
            current_time: currentTime,
            hours_since_checkin: parseFloat(hoursWorked.toFixed(2)),
            minimum_hours_required: parseFloat(minimumWorkHours.toFixed(2)),
            scheduled_hours: parseFloat(scheduledHours.toFixed(2)),
            scheduled_end_time: normalizedSchedEnd || 'N/A'
          }
        });
      }

      const passLog1 = `\n   ✅ VALIDATION PASSED - Proceeding with checkout`;
      const passLog2 = `   Action: CHECK-OUT (Valid - ${hoursWorked.toFixed(2)}h worked)`;
      const passLog3 = `========== END CHECKOUT VALIDATION ==========\n`;

      console.log(passLog1);
      logToFile(passLog1);
      console.log(passLog2);
      logToFile(passLog2);
      console.log(passLog3);
      logToFile(passLog3);

      // Get duration settings
      const durationSettings = await getWorkDurationSettings(clientId, db);

      // Calculate work hours (now returns actual OT without multiplier)
      const { totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds } = await calculateWorkHours(
        record.check_in_time,
        currentTime,
        0, // no break for fingerprint attendance
        clientId,
        db,
        schedule
      );

      // Calculate payable duration
      const payableDuration = await calculatePayableDuration(
        record.check_in_time,
        currentTime,
        schedule.start_time,
        schedule.end_time,
        0,
        record.employee_id,
        db
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
        null,
        employeeId
      );
      const durationResult = await statusService.determineWorkDuration(
        totalHours,
        durationSettings,
        today,
        departmentId,
        null,
        employeeId
      );

      // Update attendance record (store ACTUAL OT hours, NO multiplier)
      await db.execute(`
        UPDATE attendance
        SET
          check_out_time = ?,
          total_hours = ?,
          overtime_hours = ?,
          pre_shift_overtime_seconds = ?,
          post_shift_overtime_seconds = ?,
          payable_duration = ?,
          arrival_status = ?,
          work_duration = ?
        WHERE id = ?
      `, [
        currentTime,
        totalHours,
        overtimeHours,  // ACTUAL hours without multiplier
        preShiftOvertimeSeconds,
        postShiftOvertimeSeconds,
        payableDuration,
        arrivalResult.status,
        durationResult.status,
        record.id
      ]);

      console.log(`   ✅ Check-out successful at ${currentTime}`);
      console.log(`   Total Hours: ${totalHours}h, Overtime: ${overtimeHours}h (actual, no multiplier)`);

      // Send check-out SMS notification
      if (emp.phone && emp.client_name) {
        const workingHours = smsService.calculateWorkingHours(record.check_in_time, currentTime);

        smsService.sendCheckOutSMS({
          employeeName: emp.employee_name,
          companyName: emp.client_name,
          phoneNumber: emp.phone,
          date: today,
          time: currentTime,
          workingHours: workingHours,
          clientId: clientId
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`   📱 Check-out SMS sent to ${emp.phone}`);
          } else {
            console.log(`   ⚠️  Check-out SMS failed: ${smsResult.error}`);
          }
        }).catch(err => {
          console.error(`   ❌ SMS error:`, err.message);
        });
      }

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
          overtime_hours: overtimeHours,
          pre_shift_overtime_seconds: preShiftOvertimeSeconds,
          post_shift_overtime_seconds: postShiftOvertimeSeconds,
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

// MANUAL ATTENDANCE SYNC FROM OTHER SYSTEM
/**
 * This endpoint receives manual attendance records from the old system (attendance.php)
 * No authentication required - similar to fingerprint endpoint
 *
 * Request body:
 * - fingerprint_id: Integer (to identify employee)
 * - date: Date string (YYYY-MM-DD)
 * - check_in_time: Time string (HH:MM:SS or HH:MM)
 * - check_out_time: Time string (optional, HH:MM:SS or HH:MM)
 * - operation: String ('insert' or 'update')
 * - client_id: UUID (optional)
 */
router.post('/manual-sync', [
  body('fingerprint_id').isInt().withMessage('fingerprint_id must be an integer'),
  body('date').isISO8601().withMessage('date must be in YYYY-MM-DD format'),
  body('check_in_time').matches(timeRegex).withMessage('check_in_time must be in HH:MM or HH:MM:SS format'),
  body('check_out_time').optional({ values: 'falsy' }).matches(timeRegex).withMessage('check_out_time must be in HH:MM or HH:MM:SS format'),
  body('operation').isIn(['insert', 'update']).withMessage('operation must be either insert or update'),
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
  const { fingerprint_id, date, check_in_time, check_out_time, operation, client_id } = req.body;

  try {
    // Map fingerprint ID to employee
    let query = `
      SELECT
        e.id as employee_id,
        e.client_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code
      FROM employees e
      WHERE e.fingerprint_id = ?
      AND e.employment_status = 'active'
    `;

    const queryParams = [fingerprint_id];

    if (client_id) {
      query += ' AND e.client_id = ?';
      queryParams.push(client_id);
    }

    query += ' LIMIT 1';

    const [employee] = await db.execute(query, queryParams);

    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found. Fingerprint ID: ' + fingerprint_id,
        status: 'error'
      });
    }

    const emp = employee[0];
    const employeeId = emp.employee_id;
    const clientId = emp.client_id;

    console.log(`\n📝 MANUAL SYNC - ${emp.employee_name} | ${operation.toUpperCase()} | ${date}`);

    if (operation === 'insert') {
      // Check if attendance already exists
      const [existing] = await db.execute(`
        SELECT id FROM attendance WHERE employee_id = ? AND date = ?
      `, [employeeId, date]);

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Attendance already exists',
          status: 'error'
        });
      }

      const schedule = await getEmployeeSchedule(employeeId, clientId, db, date);
      const attendanceId = uuidv4();
      const attendanceDate = new Date(date);
      const jsDayOfWeek = attendanceDate.getDay();
      const isWeekend = jsDayOfWeek === 0 ? 1 : jsDayOfWeek + 1;

      let totalHours = null;
      let overtimeHours = 0;
      let preShiftOvertimeSeconds = 0;
      let postShiftOvertimeSeconds = 0;

      if (check_out_time) {
        const calculated = await calculateWorkHours(check_in_time, check_out_time, 0, clientId, db, schedule);
        totalHours = calculated.totalHours;
        overtimeHours = calculated.overtimeHours;  // Actual OT without multiplier
        preShiftOvertimeSeconds = calculated.preShiftOvertimeSeconds;
        postShiftOvertimeSeconds = calculated.postShiftOvertimeSeconds;
      }

      const [employeeInfo] = await db.execute(`SELECT department_id FROM employees WHERE id = ?`, [employeeId]);
      const departmentId = employeeInfo[0]?.department_id || null;

      const statusService = new AttendanceStatusService(clientId);
      const arrivalResult = await statusService.determineArrivalStatus(check_in_time, schedule, date, departmentId, null, employeeId);

      const durationSettings = await getWorkDurationSettings(clientId, db);
      const durationResult = await statusService.determineWorkDuration(totalHours, durationSettings, date, departmentId, null, employeeId);

      await db.execute(`
        INSERT INTO attendance (
          id, employee_id, date, check_in_time, check_out_time,
          total_hours, overtime_hours, pre_shift_overtime_seconds, post_shift_overtime_seconds, break_duration,
          arrival_status, work_duration, work_type,
          scheduled_in_time, scheduled_out_time, is_weekend, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'office', ?, ?, ?, ?)
      `, [
        attendanceId, employeeId, date, check_in_time, check_out_time,
        totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds, arrivalResult.status,
        durationResult.status, schedule.start_time, schedule.end_time,
        isWeekend, 'Synced from old system'
      ]);

      console.log(`   ✅ Inserted successfully`);

      return res.status(201).json({
        success: true,
        message: `Attendance recorded for ${emp.employee_name}`,
        status: 'success',
        operation: 'insert',
        data: {
          employee_name: emp.employee_name,
          date: date,
          check_in_time: check_in_time,
          check_out_time: check_out_time,
          arrival_status: arrivalResult.status,
          work_duration: durationResult.status
        }
      });

    } else if (operation === 'update') {
      const [existing] = await db.execute(`
        SELECT id, check_in_time FROM attendance WHERE employee_id = ? AND date = ?
      `, [employeeId, date]);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found',
          status: 'error'
        });
      }

      const record = existing[0];
      const schedule = await getEmployeeSchedule(employeeId, clientId, db, date);
      const { totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds } = await calculateWorkHours(record.check_in_time, check_out_time, 0, clientId, db, schedule);

      const [employeeInfo] = await db.execute(`SELECT department_id FROM employees WHERE id = ?`, [employeeId]);
      const departmentId = employeeInfo[0]?.department_id || null;

      const statusService = new AttendanceStatusService(clientId);
      const durationSettings = await getWorkDurationSettings(clientId, db);
      const durationResult = await statusService.determineWorkDuration(totalHours, durationSettings, date, departmentId, null, employeeId);

      await db.execute(`
        UPDATE attendance SET
          check_out_time = ?, total_hours = ?, overtime_hours = ?,
          pre_shift_overtime_seconds = ?, post_shift_overtime_seconds = ?,
          work_duration = ?, notes = CONCAT(COALESCE(notes, ''), ' | Updated from old system')
        WHERE id = ?
      `, [check_out_time, totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds, durationResult.status, record.id]);

      console.log(`   ✅ Updated successfully`);

      return res.status(200).json({
        success: true,
        message: `Attendance updated for ${emp.employee_name}`,
        status: 'success',
        operation: 'update',
        data: {
          employee_name: emp.employee_name,
          date: date,
          check_in_time: record.check_in_time,
          check_out_time: check_out_time,
          total_hours: totalHours,
          work_duration: durationResult.status
        }
      });
    }

  } catch (error) {
    console.error('❌ Manual sync error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync attendance',
      status: 'error'
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

    // Non-working weekend day - allow as volunteer work
    if ((dayOfWeek === 6 || dayOfWeek === 0) &&
        !(weekendConfig.saturday?.working && dayOfWeek === 6) &&
        !(weekendConfig.sunday?.working && dayOfWeek === 0)) {
      // Return NULL scheduled times for volunteer work (no schedule exists)
      return {
        start_time: null,
        end_time: null,
        late_threshold_minutes: 0,
        employee_name: emp.employee_name,
        follows_company_schedule: false,
        is_non_working_day: true,
        weekend_day: dayOfWeek === 6 ? 'saturday' : 'sunday'
      };
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

  // If already has seconds (HH:MM:SS), return as is
  if (timeString.includes(':') && timeString.split(':').length === 3) {
    return timeString;
  }

  // If it's just HH:MM, add :00 seconds for consistency
  if (timeString.includes(':') && timeString.split(':').length === 2) {
    return `${timeString}:00`;
  }

  // If no colons, assume it's invalid
  return null;
};

/**
 * Calculate payable duration based on overlap between scheduled and actual hours
 * Works for both weekdays and weekends (uses the stored scheduled times)
 * Returns SECONDS for precision without excessive storage
 */
const calculatePayableDuration = async (checkInTime, checkOutTime, scheduledInTime, scheduledOutTime, breakDuration = 0, employeeId = null, db = null) => {
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

  // If scheduled times are NULL (volunteer work), don't calculate payable duration
  if (scheduledInTime === null || scheduledOutTime === null) {
    return null;
  }

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

  // Fetch employee's payable hours policy
  let payableHoursPolicy = 'strict_schedule'; // Default
  if (employeeId && db) {
    try {
      const [employee] = await db.execute(
        'SELECT payable_hours_policy FROM employees WHERE id = ?',
        [employeeId]
      );
      if (employee.length > 0 && employee[0].payable_hours_policy) {
        payableHoursPolicy = employee[0].payable_hours_policy;
      }
    } catch (error) {
      console.error('Error fetching payable_hours_policy:', error);
      // Fall back to strict_schedule on error
    }
  }

  let payableDurationSeconds;

  if (payableHoursPolicy === 'actual_worked') {
    // POLICY: actual_worked - Allow time shifting if total duration is met
    // Calculate total worked time
    const workedMs = actualOut - actualIn;
    const workedSeconds = Math.round(workedMs / 1000);

    // Calculate scheduled duration
    const scheduledMs = scheduledOut - scheduledIn;
    const scheduledSeconds = Math.round(scheduledMs / 1000);

    // If employee worked >= scheduled hours, pay full scheduled hours
    // Otherwise, pay only what they worked (capped to scheduled)
    if (workedSeconds >= scheduledSeconds) {
      payableDurationSeconds = scheduledSeconds;
    } else {
      payableDurationSeconds = workedSeconds;
    }
  } else {
    // POLICY: strict_schedule (default) - Cap to scheduled hours
    // Calculate overlap between scheduled and actual times
    const overlapStart = actualIn > scheduledIn ? actualIn : scheduledIn;
    const overlapEnd = actualOut < scheduledOut ? actualOut : scheduledOut;

    // If no overlap, payable is 0
    if (overlapEnd <= overlapStart) {
      payableDurationSeconds = 0;
    } else {
      // Calculate overlap in SECONDS
      const overlapMs = overlapEnd - overlapStart;
      payableDurationSeconds = Math.round(overlapMs / 1000);
    }
  }

  // Subtract break duration (convert break from hours to seconds)
  const breakSeconds = Math.round((breakDuration || 0) * 60 * 60); // hours to seconds
  payableDurationSeconds = Math.max(0, payableDurationSeconds - breakSeconds);

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

  // Parse times with consistent format (already includes seconds from normalization)
  const scheduledStart = new Date(`2000-01-01T${normalizedScheduledStart}`);
  const actualCheckIn = new Date(`2000-01-01T${normalizedCheckIn}`);
  
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
    return {
      totalHours: null,
      overtimeHours: 0,
      standardHours: null,
      preShiftOvertimeSeconds: 0,
      postShiftOvertimeSeconds: 0
    };
  }

  const inDate  = new Date(`2000-01-01T${inNorm}`);
  const outDate = new Date(`2000-01-01T${outNorm}`);

  if (isNaN(inDate) || isNaN(outDate) || outDate <= inDate) {
    return {
      totalHours: null,
      overtimeHours: 0,
      standardHours: null,
      preShiftOvertimeSeconds: 0,
      postShiftOvertimeSeconds: 0
    };
  }

  /* Calculate total worked time in seconds */
  const rawSeconds = (outDate - inDate) / 1000;  // ms to seconds
  const breakSeconds = (breakDuration || 0) * 3600;  // hours to seconds
  const workedSeconds = Math.max(0, rawSeconds - breakSeconds);
  const workedHours = workedSeconds / 3600;  // seconds to hours

  /* what counts as "standard" today? */
  let standardHours = null;

  if (employeeSchedule?.start_time && employeeSchedule?.end_time) {
    const sIn  = new Date(`2000-01-01T${normalise(employeeSchedule.start_time)}`);
    const sOut = new Date(`2000-01-01T${normalise(employeeSchedule.end_time)}`);
    if (!isNaN(sIn) && !isNaN(sOut) && sOut > sIn) {
      standardHours = (sOut - sIn) / 3600000 - (breakDuration || 0); // ms to hours, subtract break
    }
  } else if (employeeSchedule?.is_non_working_day) {
    // Volunteer work on non-working day: all hours are overtime
    standardHours = 0;
  }

  /* fall back to company-wide setting */
  if (standardHours === null) {
    const { working_hours_per_day } = await getWorkDurationSettings(clientId, db);
    standardHours = working_hours_per_day;
  }

  /* ==================== CALCULATE ACTUAL OVERTIME (NO MULTIPLIER) ==================== */

  let preShiftOvertimeSeconds = 0;
  let postShiftOvertimeSeconds = 0;
  let totalOvertimeHours = 0;

  // ALWAYS calculate actual overtime (regardless of overtime_enabled setting)
  // This preserves data for retroactive OT enabling and multiplier changes
  if (employeeSchedule?.start_time && employeeSchedule?.end_time) {
    const scheduledStart = new Date(`2000-01-01T${normalise(employeeSchedule.start_time)}`);
    const scheduledEnd = new Date(`2000-01-01T${normalise(employeeSchedule.end_time)}`);

    // Calculate early arrival (seconds worked before scheduled start)
    const preScheduleSeconds = inDate < scheduledStart
      ? Math.floor((scheduledStart - inDate) / 1000)
      : 0;

    // Calculate early departure (seconds left before scheduled end)
    const earlyDepartureSeconds = outDate < scheduledEnd
      ? Math.floor((scheduledEnd - outDate) / 1000)
      : 0;

    // Pre-Shift OT: Only count if early arrival exceeds early departure (fair compensation)
    // Example: Arrived 1 hour early, left 1 hour early = NO overtime
    // Example: Arrived 1.5 hours early, left 1 hour early = 0.5 hours overtime
    preShiftOvertimeSeconds = Math.max(0, preScheduleSeconds - earlyDepartureSeconds);

    // Calculate late arrival (seconds arrived after scheduled start)
    const lateArrivalSeconds = inDate > scheduledStart
      ? Math.floor((inDate - scheduledStart) / 1000)
      : 0;

    // Calculate time worked after scheduled end
    const postScheduleSeconds = outDate > scheduledEnd
      ? Math.floor((outDate - scheduledEnd) / 1000)
      : 0;

    // Post-Shift OT: Only count if post-schedule time exceeds late arrival (fair compensation)
    // Example: Arrived 1 hour late, left 1 hour late = NO overtime
    // Example: Arrived 1 hour late, left 1.5 hours late = 0.5 hours overtime
    postShiftOvertimeSeconds = Math.max(0, postScheduleSeconds - lateArrivalSeconds);

    // Total OT in hours (actual hours, NO multiplier applied)
    totalOvertimeHours = (preShiftOvertimeSeconds + postShiftOvertimeSeconds) / 3600;
  } else {
    // No custom schedule - use simple calculation
    totalOvertimeHours = Math.max(0, workedHours - standardHours);
    // For non-scheduled employees, assume all OT is post-shift
    postShiftOvertimeSeconds = Math.floor(totalOvertimeHours * 3600);
  }

  return {
    totalHours: +workedHours.toFixed(2),              // Total hours worked
    overtimeHours: +totalOvertimeHours.toFixed(2),    // ACTUAL OT hours (NO multiplier)
    standardHours: +standardHours.toFixed(2),         // Expected work hours
    preShiftOvertimeSeconds: preShiftOvertimeSeconds,   // Seconds before scheduled start
    postShiftOvertimeSeconds: postShiftOvertimeSeconds  // Seconds after scheduled end
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

      // Calculate work hours first (returns actual OT without multiplier)
      const { totalHours, overtimeHours, standardHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds } = await calculateWorkHours(
        req.body.check_in_time,
        req.body.check_out_time,
        req.body.break_duration,
        req.user.clientId,
        db,
        schedule
      );

      console.log("totalHours", totalHours, "overtimeHours", overtimeHours, "standardHours", standardHours);
      console.log("preShiftOvertimeSeconds", preShiftOvertimeSeconds, "postShiftOvertimeSeconds", postShiftOvertimeSeconds);

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
        req.body.arrival_status,
        req.body.employee_id
      );

      const durationResult = await statusService.determineWorkDuration(
        totalHours,
        durationSettings,
        req.body.date,
        departmentId,
        req.body.work_duration,
        req.body.employee_id
      );

      console.log("Enhanced arrival status:", arrivalResult);
      console.log("Enhanced duration status:", durationResult);

      // Calculate payable duration
      const payableDuration = await calculatePayableDuration(
        req.body.check_in_time,
        req.body.check_out_time,
        schedule.start_time,
        schedule.end_time,
        req.body.break_duration || 0,
        req.body.employee_id,
        db
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
        overtime_hours: overtimeHours, // ACTUAL overtime hours without multiplier
        pre_shift_overtime_seconds: preShiftOvertimeSeconds,
        post_shift_overtime_seconds: postShiftOvertimeSeconds,
        break_duration: req.body.break_duration || 0,
        arrival_status: arrivalResult.status,
        work_duration: durationResult.status,
        work_type: req.body.work_type || 'office',
        notes: req.body.notes || null,
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
          overtime_hours, pre_shift_overtime_seconds, post_shift_overtime_seconds, break_duration, arrival_status, work_duration, work_type, notes, created_by, scheduled_in_time, scheduled_out_time, payable_duration, is_weekend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await db.execute(insertQuery, Object.values(attendanceData));

      // Get created record with employee info
      const [newRecord] = await db.execute(`
        SELECT
          a.*,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          e.phone,
          e.in_time as scheduled_in_time,
          e.out_time as scheduled_out_time,
          c.name as client_name
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN clients c ON e.client_id = c.id
        WHERE a.id = ?
      `, [attendanceId]);

      // Determine what was auto-calculated
      const arrivalAutoCalculated = !req.body.arrival_status || req.body.arrival_status !== autoArrivalStatus;
      const durationAutoCalculated = !req.body.work_duration || req.body.work_duration !== autoWorkDuration;

      // Send SMS notifications for check-in and/or check-out
      const record = newRecord[0];
      if (record.phone && record.client_name) {
        // Send check-in SMS if check_in_time exists
        if (record.check_in_time) {
          const lateBy = smsService.calculateLateTime(record.check_in_time, schedule.start_time);

          smsService.sendCheckInSMS({
            employeeName: record.employee_name,
            companyName: record.client_name,
            phoneNumber: record.phone,
            date: record.date,
            time: record.check_in_time,
            isLate: !!lateBy,
            lateBy: lateBy || '',
            clientId: req.user.clientId
          }).then(smsResult => {
            if (smsResult.success) {
              console.log(`   📱 Check-in SMS sent to ${record.phone}`);
            } else {
              console.log(`   ⚠️  Check-in SMS failed: ${smsResult.error}`);
            }
          }).catch(err => {
            console.error(`   ❌ SMS error:`, err.message);
          });
        }

        // Send check-out SMS if check_out_time exists
        if (record.check_out_time && record.check_in_time) {
          const workingHours = smsService.calculateWorkingHours(record.check_in_time, record.check_out_time);

          smsService.sendCheckOutSMS({
            employeeName: record.employee_name,
            companyName: record.client_name,
            phoneNumber: record.phone,
            date: record.date,
            time: record.check_out_time,
            workingHours: workingHours,
            clientId: req.user.clientId
          }).then(smsResult => {
            if (smsResult.success) {
              console.log(`   📱 Check-out SMS sent to ${record.phone}`);
            } else {
              console.log(`   ⚠️  Check-out SMS failed: ${smsResult.error}`);
            }
          }).catch(err => {
            console.error(`   ❌ SMS error:`, err.message);
          });
        }
      }

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
    a.arrival_status AS status,
    CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
    e.employee_code,
    e.in_time AS scheduled_in_time,
    e.out_time AS scheduled_out_time,
    e.follows_company_schedule,
    d.name AS department_name,
    de.title AS designation_name
FROM attendance a
JOIN employees e ON a.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations de ON e.designation_id = de.id
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

          // Recalculate hours/overtime (now includes seconds)
          const { totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds } = await calculateWorkHours(
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
          const payableDuration = await calculatePayableDuration(
            eff.check_in_time,
            eff.check_out_time,
            current.scheduled_in_time,
            current.scheduled_out_time,
            eff.break_duration,
            employeeId,
            db
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
          maybePush('pre_shift_overtime_seconds', preShiftOvertimeSeconds, current.pre_shift_overtime_seconds);
          maybePush('post_shift_overtime_seconds', postShiftOvertimeSeconds, current.post_shift_overtime_seconds);
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

    // recalc hours/overtime (now includes seconds)
    const { totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds } = await calculateWorkHours(
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
    const payableDuration = await calculatePayableDuration(
      eff.check_in_time,
      eff.check_out_time,
      current.scheduled_in_time,
      current.scheduled_out_time,
      eff.break_duration,
      current.employee_id,
      db
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
    maybePush('pre_shift_overtime_seconds', preShiftOvertimeSeconds, current.pre_shift_overtime_seconds);
    maybePush('post_shift_overtime_seconds', postShiftOvertimeSeconds, current.post_shift_overtime_seconds);
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
              e.employee_code,
              e.phone,
              c.name as client_name
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
         LEFT JOIN clients c ON e.client_id = c.id
        WHERE a.id = ?`, [attendanceId]
    );

    // Send SMS notifications if times were added/changed
    if (updated.phone && updated.client_name) {
      // Send check-in SMS if check_in_time was added or changed
      const checkInChanged = req.body.check_in_time !== undefined &&
                             req.body.check_in_time !== current.check_in_time;

      if (checkInChanged && updated.check_in_time) {
        const lateBy = smsService.calculateLateTime(updated.check_in_time, schedule.start_time);

        smsService.sendCheckInSMS({
          employeeName: updated.employee_name,
          companyName: updated.client_name,
          phoneNumber: updated.phone,
          date: updated.date,
          time: updated.check_in_time,
          isLate: !!lateBy,
          lateBy: lateBy || '',
          clientId: req.user.clientId
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`   📱 Check-in SMS sent to ${updated.phone}`);
          } else {
            console.log(`   ⚠️  Check-in SMS failed: ${smsResult.error}`);
          }
        }).catch(err => {
          console.error(`   ❌ SMS error:`, err.message);
        });
      }

      // Send check-out SMS if check_out_time was added or changed
      const checkOutChanged = req.body.check_out_time !== undefined &&
                              req.body.check_out_time !== current.check_out_time;

      if (checkOutChanged && updated.check_out_time && updated.check_in_time) {
        const workingHours = smsService.calculateWorkingHours(updated.check_in_time, updated.check_out_time);

        smsService.sendCheckOutSMS({
          employeeName: updated.employee_name,
          companyName: updated.client_name,
          phoneNumber: updated.phone,
          date: updated.date,
          time: updated.check_out_time,
          workingHours: workingHours,
          clientId: req.user.clientId
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`   📱 Check-out SMS sent to ${updated.phone}`);
          } else {
            console.log(`   ⚠️  Check-out SMS failed: ${smsResult.error}`);
          }
        }).catch(err => {
          console.error(`   ❌ SMS error:`, err.message);
        });
      }
    }

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
          
          // First recalculate work hours using the same logic as PATCH endpoint (now includes seconds)
          const { totalHours, overtimeHours, preShiftOvertimeSeconds, postShiftOvertimeSeconds } = await calculateWorkHours(
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
              null, // Force recalculation for bulk update
              employeeId
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
              null, // Force recalculation for bulk update
              employeeId
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

          if (record.pre_shift_overtime_seconds !== preShiftOvertimeSeconds) {
            updates.push('pre_shift_overtime_seconds = ?');
            updateValues.push(preShiftOvertimeSeconds);
          }

          if (record.post_shift_overtime_seconds !== postShiftOvertimeSeconds) {
            updates.push('post_shift_overtime_seconds = ?');
            updateValues.push(postShiftOvertimeSeconds);
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