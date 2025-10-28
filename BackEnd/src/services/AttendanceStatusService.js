const { SettingsHelper } = require('../utils/settingsHelper');
const holidayService = require('./HolidayService'); // This is already an instance

class AttendanceStatusService {
  constructor(clientId) {
    this.clientId = clientId;
    this.settingsHelper = new SettingsHelper(clientId);
    this.holidayService = holidayService; // Use the imported instance directly
  }

  /**
   * Check if a specific date is a working day based on weekend and holiday settings
   */
  async isWorkingDay(date, departmentId = null) {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = dateObj.toISOString().split('T')[0];

    // Check if it's a holiday first
    const holiday = await this.holidayService.isHoliday(this.clientId, dateStr, departmentId);
    if (holiday) {
      return {
        isWorking: false,
        reason: 'holiday',
        details: holiday.name
      };
    }

    // Check weekend settings
    const isWeekendWorking = await this.settingsHelper.isWeekendWorkingDay(dayOfWeek);

    // If it's a weekend day
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isWorking: isWeekendWorking,
        reason: isWeekendWorking ? 'weekend_working' : 'weekend_off',
        details: dayOfWeek === 0 ? 'Sunday' : 'Saturday'
      };
    }

    // Regular weekday
    return {
      isWorking: true,
      reason: 'regular_workday',
      details: null
    };
  }

  /**
   * Enhanced arrival status determination that considers working day status
   */
    async determineArrivalStatus(checkInTime, schedule, date, departmentId = null, requestedArrivalStatus = null) {
    // Check if this is a working day
    const workingDayInfo = await this.isWorkingDay(date, departmentId);

    // If manually provided arrival status for specific cases, use it
    if (requestedArrivalStatus && ['absent', 'on_leave'].includes(requestedArrivalStatus)) {
      return {
        status: requestedArrivalStatus,
        isAutoCalculated: false,
        workingDayInfo
      };
    }

    // No check-in time handling
    if (!checkInTime) {
      if (!workingDayInfo.isWorking) {
        return {
          status: 'scheduled_off',
          isAutoCalculated: true,
          workingDayInfo
        };
      } else {
        return {
          status: 'absent',
          isAutoCalculated: true,
          workingDayInfo
        };
      }
    }

    // Has check-in time
    if (!workingDayInfo.isWorking) {
      // Working on a non-working day (holiday/weekend) - always on time
      return {
        status: 'voluntary_work',
        isAutoCalculated: true,
        workingDayInfo
      };
    }

    // Regular working day - apply normal logic
    const normalizedCheckIn = this.normalizeTimeFormat(checkInTime);
    const normalizedScheduledStart = this.normalizeTimeFormat(schedule.start_time);

    if (!normalizedCheckIn || !normalizedScheduledStart) {
      return {
        status: 'late',
        isAutoCalculated: true,
        workingDayInfo
      };
    }

    const scheduledStart = new Date(`2000-01-01T${normalizedScheduledStart}:00`);
    const actualCheckIn = new Date(`2000-01-01T${normalizedCheckIn}:00`);
    
    const timeDiffMinutes = (actualCheckIn - scheduledStart) / (1000 * 60);

    if (timeDiffMinutes <= schedule.late_threshold_minutes) {
      return {
        status: 'on_time',
        isAutoCalculated: true,
        workingDayInfo
      };
    } else {
      return {
        status: 'late',
        isAutoCalculated: true,
        workingDayInfo
      };
    }
  }

  /**
   * Enhanced work duration determination that considers working day status
   */
  async determineWorkDuration(totalHours, durationSettings, date, departmentId = null, requestedWorkDuration = null) {
    // Check if this is a working day
    const workingDayInfo = await this.isWorkingDay(date, departmentId);
    // If manually provided, use it
    if (requestedWorkDuration) {
      return {
        status: requestedWorkDuration,
        isAutoCalculated: false,
        workingDayInfo
      };
    }

    // No hours worked
    if (totalHours === null || totalHours === 0) {
      if (!workingDayInfo.isWorking) {
        return {
          status: 'scheduled_off',
          isAutoCalculated: true,
          workingDayInfo
        };
      } else {
        return {
          status: 'absent',
          isAutoCalculated: true,
          workingDayInfo
        };
      }
    }

    // Has worked some hours
    if (!workingDayInfo.isWorking) {
      // Working on non-working day
      if (totalHours >= durationSettings.full_day_minimum_hours) {
        return {
          status: 'voluntary_full_day',
          isAutoCalculated: true,
          workingDayInfo
        };
      } else if (totalHours >= durationSettings.half_day_minimum_hours) {
        return {
          status: 'voluntary_half_day',
          isAutoCalculated: true,
          workingDayInfo
        };
      } else {
        return {
          status: 'voluntary_short_work',
          isAutoCalculated: true,
          workingDayInfo
        };
      }
    }

    // Regular working day - apply normal logic
    if (totalHours >= durationSettings.full_day_minimum_hours) {
      return {
        status: 'full_day',
        isAutoCalculated: true,
        workingDayInfo
      };
    } else if (totalHours >= durationSettings.half_day_minimum_hours) {
      return {
        status: 'half_day',
        isAutoCalculated: true,
        workingDayInfo
      };
    } else if (totalHours >= durationSettings.short_leave_minimum_hours) {
      return {
        status: 'short_leave',
        isAutoCalculated: true,
        workingDayInfo
      };
    } else {
      return {
        status: 'insufficient_hours',
        isAutoCalculated: true,
        workingDayInfo
      };
    }
  }

  /**
   * Calculate overtime multiplier based on working day type
   */
  async getOvertimeMultiplier(date, departmentId = null) {
    const workingDayInfo = await this.isWorkingDay(date, departmentId);
    const workingHoursConfig = await this.settingsHelper.getWeekendSettings();

    if (workingDayInfo.reason === 'holiday') {
      return {
        multiplier: workingHoursConfig.working_hours.holiday_hours_multiplier || 2.5,
        reason: 'Holiday work'
      };
    } else if (workingDayInfo.reason === 'weekend_working' || workingDayInfo.reason === 'weekend_off') {
      return {
        multiplier: workingHoursConfig.working_hours.weekend_hours_multiplier || 1.5,
        reason: 'Weekend work'
      };
    } else {
      return {
        multiplier: 1.0,
        reason: 'Regular work'
      };
    }
  }

  /**
   * Normalize time format helper
   */
  normalizeTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      return null;
    }

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
  }

  /**
   * Get comprehensive attendance analysis for a date
   */
  async analyzeAttendanceForDate(attendanceData, schedule, durationSettings) {
    const { date, check_in_time, total_hours, employee_id, department_id } = attendanceData;

    const arrivalResult = await this.determineArrivalStatus(
      check_in_time, 
      schedule, 
      date, 
      department_id
    );

    const durationResult = await this.determineWorkDuration(
      total_hours, 
      durationSettings, 
      date, 
      department_id
    );

    const overtimeInfo = await this.getOvertimeMultiplier(date, department_id);

    return {
      date,
      workingDayInfo: arrivalResult.workingDayInfo,
      arrival: {
        status: arrivalResult.status,
        isAutoCalculated: arrivalResult.isAutoCalculated
      },
      duration: {
        status: durationResult.status,
        isAutoCalculated: durationResult.isAutoCalculated
      },
      overtime: overtimeInfo,
      recommendations: this.generateRecommendations(arrivalResult, durationResult, overtimeInfo)
    };
  }

  /**
   * Generate recommendations for attendance review
   */
  generateRecommendations(arrivalResult, durationResult, overtimeInfo) {
    const recommendations = [];

    // Voluntary work recommendations
    if (arrivalResult.status === 'voluntary_work' || durationResult.status.includes('voluntary')) {
      recommendations.push({
        type: 'info',
        message: `Employee worked on ${arrivalResult.workingDayInfo.reason.replace('_', ' ')} (${arrivalResult.workingDayInfo.details}). Consider applying ${overtimeInfo.multiplier}x multiplier.`
      });
    }

    // Scheduled off recommendations
    if (arrivalResult.status === 'scheduled_off' || durationResult.status === 'scheduled_off') {
      recommendations.push({
        type: 'success',
        message: `Employee was scheduled off for ${arrivalResult.workingDayInfo.reason.replace('_', ' ')}. No attendance issues.`
      });
    }

    // Insufficient hours on working day
    if (durationResult.status === 'insufficient_hours' && arrivalResult.workingDayInfo.isWorking) {
      recommendations.push({
        type: 'warning',
        message: 'Employee worked insufficient hours on a working day. Review required.'
      });
    }

    return recommendations;
  }
}

module.exports = AttendanceStatusService;