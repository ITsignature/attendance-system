const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class LeaveController {
  
  // =============================================
  // LEAVE TYPE METHODS
  // =============================================

  /**
   * Get all active leave types for a client
   */
  static async getLeaveTypes(clientId) {
    try {
      const [leaveTypes] = await db.execute(`
        SELECT 
          id,
          name,
          description,
          max_days_per_year,
          max_consecutive_days,
          is_paid,
          requires_approval,
          approval_hierarchy,
          notice_period_days,
          is_active,
          created_at
        FROM leave_types 
        WHERE client_id = ? AND is_active = TRUE
        ORDER BY name ASC
      `, [clientId]);

      return {
        success: true,
        data: leaveTypes,
        count: leaveTypes.length
      };
    } catch (error) {
      throw new Error(`Failed to fetch leave types: ${error.message}`);
    }
  }

  /**
   * Create a new leave type
   */
  static async createLeaveType(clientId, leaveTypeData) {
    try {
      const {
        name,
        description,
        max_days_per_year,
        max_consecutive_days = 0,
        is_paid,
        requires_approval,
        notice_period_days = 0,
        approval_hierarchy = null
      } = leaveTypeData;

      // Check if leave type name already exists for this client
      const [existing] = await db.execute(`
        SELECT id FROM leave_types 
        WHERE client_id = ? AND name = ? AND is_active = TRUE
      `, [clientId, name]);

      if (existing.length > 0) {
        return {
          success: false,
          message: 'Leave type with this name already exists'
        };
      }

      const leaveTypeId = uuidv4();
      await db.execute(`
        INSERT INTO leave_types (
          id, client_id, name, description, max_days_per_year, 
          max_consecutive_days, is_paid, requires_approval, 
          notice_period_days, approval_hierarchy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        leaveTypeId, clientId, name, description, max_days_per_year,
        max_consecutive_days, is_paid, requires_approval, 
        notice_period_days, JSON.stringify(approval_hierarchy)
      ]);

      return {
        success: true,
        message: 'Leave type created successfully',
        data: { id: leaveTypeId }
      };
    } catch (error) {
      throw new Error(`Failed to create leave type: ${error.message}`);
    }
  }

  /**
   * Update an existing leave type
   */
  static async updateLeaveType(clientId, leaveTypeId, updateData) {
    try {
      // Verify leave type belongs to client
      const [existing] = await db.execute(`
        SELECT id FROM leave_types WHERE id = ? AND client_id = ?
      `, [leaveTypeId, clientId]);

      if (existing.length === 0) {
        return {
          success: false,
          message: 'Leave type not found'
        };
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [];
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          updateFields.push(`${key} = ?`);
          params.push(key === 'approval_hierarchy' ? JSON.stringify(updateData[key]) : updateData[key]);
        }
      });

      if (updateFields.length === 0) {
        return {
          success: false,
          message: 'No fields to update'
        };
      }

      params.push(leaveTypeId);
      
      await db.execute(`
        UPDATE leave_types 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = ?
      `, params);

      return {
        success: true,
        message: 'Leave type updated successfully'
      };
    } catch (error) {
      throw new Error(`Failed to update leave type: ${error.message}`);
    }
  }

  // =============================================
  // LEAVE REQUEST METHODS
  // =============================================

  /**
   * Submit a new leave request
   */
  static async submitLeaveRequest(employeeData, requestData) {
    try {
      const {
        leave_type_id,
        start_date,
        end_date,
        reason,
        days_requested,
        supporting_documents = null
      } = requestData;

      const { employee_id, client_id } = employeeData;

      // Validate dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate >= endDate) {
        return {
          success: false,
          message: 'End date must be after start date'
        };
      }

      if (startDate < today) {
        return {
          success: false,
          message: 'Cannot request leave for past dates'
        };
      }

      // Verify leave type belongs to client and get details
      const [leaveType] = await db.execute(`
        SELECT * FROM leave_types 
        WHERE id = ? AND client_id = ? AND is_active = TRUE
      `, [leave_type_id, client_id]);

      if (leaveType.length === 0) {
        return {
          success: false,
          message: 'Invalid leave type'
        };
      }

      // Check notice period requirement
      const daysUntilStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntilStart < leaveType[0].notice_period_days) {
        return {
          success: false,
          message: `This leave type requires ${leaveType[0].notice_period_days} days advance notice`
        };
      }

      // Check consecutive days limit
      if (leaveType[0].max_consecutive_days > 0 && days_requested > leaveType[0].max_consecutive_days) {
        return {
          success: false,
          message: `Maximum consecutive days allowed: ${leaveType[0].max_consecutive_days}`
        };
      }

      // Check for overlapping requests
      const [overlapping] = await db.execute(`
        SELECT id FROM leave_requests 
        WHERE employee_id = ? 
        AND status IN ('pending', 'approved')
        AND NOT (end_date < ? OR start_date > ?)
      `, [employee_id, start_date, end_date]);

      if (overlapping.length > 0) {
        return {
          success: false,
          message: 'You have overlapping leave requests for this period'
        };
      }

      // Check annual leave balance
      const balanceCheck = await this.checkLeaveBalance(employee_id, leave_type_id, days_requested);
      if (!balanceCheck.success) {
        return balanceCheck;
      }

      // Create leave request
      const requestId = uuidv4();
      await db.execute(`
        INSERT INTO leave_requests (
          id, employee_id, leave_type_id, start_date, end_date,
          days_requested, reason, supporting_documents, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        requestId, employee_id, leave_type_id, start_date, end_date,
        days_requested, reason, supporting_documents ? JSON.stringify(supporting_documents) : null
      ]);

      return {
        success: true,
        message: 'Leave request submitted successfully',
        data: { id: requestId }
      };
    } catch (error) {
      throw new Error(`Failed to submit leave request: ${error.message}`);
    }
  }

  /**
   * Check leave balance for an employee
   */
  static async checkLeaveBalance(employeeId, leaveTypeId, requestedDays) {
    try {
      const currentYear = new Date().getFullYear();

      // Get leave type details
      const [leaveType] = await db.execute(`
        SELECT max_days_per_year FROM leave_types WHERE id = ?
      `, [leaveTypeId]);

      if (leaveType.length === 0) {
        return {
          success: false,
          message: 'Leave type not found'
        };
      }

      // Calculate used leave for current year
      const [usedLeave] = await db.execute(`
        SELECT COALESCE(SUM(days_requested), 0) as used_days
        FROM leave_requests 
        WHERE employee_id = ? 
        AND leave_type_id = ?
        AND status = 'approved'
        AND YEAR(start_date) = ?
      `, [employeeId, leaveTypeId, currentYear]);

      const usedDays = usedLeave[0].used_days || 0;
      const maxDays = leaveType[0].max_days_per_year;
      const availableDays = maxDays - usedDays;

      if (requestedDays > availableDays) {
        return {
          success: false,
          message: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${requestedDays} days`
        };
      }

      return {
        success: true,
        data: {
          maxDays,
          usedDays,
          availableDays,
          requestedDays
        }
      };
    } catch (error) {
      throw new Error(`Failed to check leave balance: ${error.message}`);
    }
  }

  /**
   * Get leave requests with filters
   */
  static async getLeaveRequests(clientId, filters = {}) {
    try {
      const {
        start_date,
        end_date,
        status,
        department_id,
        employee_id,
        leave_type_id,
        limit = 50,
        offset = 0
      } = filters;

      let whereClause = 'WHERE e.client_id = ?';
      let params = [clientId];

      // Build dynamic where clause
      if (start_date) {
        whereClause += ' AND lr.start_date >= ?';
        params.push(start_date);
      }
      if (end_date) {
        whereClause += ' AND lr.end_date <= ?';
        params.push(end_date);
      }
      if (status) {
        whereClause += ' AND lr.status = ?';
        params.push(status);
      }
      if (department_id) {
        whereClause += ' AND e.department_id = ?';
        params.push(department_id);
      }
      if (employee_id) {
        whereClause += ' AND lr.employee_id = ?';
        params.push(employee_id);
      }
      if (leave_type_id) {
        whereClause += ' AND lr.leave_type_id = ?';
        params.push(leave_type_id);
      }

      // Get requests
      const [requests] = await db.execute(`
        SELECT 
          lr.id,
          lr.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_id as employee_code,
          e.email as employee_email,
          e.profile_image,
          d.name as department,
          des.title as designation,
          lr.leave_type_id,
          lt.name as leave_type_name,
          lt.is_paid,
          lr.start_date,
          lr.end_date,
          lr.days_requested,
          lr.reason,
          lr.status,
          lr.applied_at,
          lr.reviewed_at,
          lr.reviewer_comments,
          lr.supporting_documents,
          CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN admin_users au ON lr.reviewed_by = au.id
        LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
        ${whereClause}
        ORDER BY 
          CASE lr.status 
            WHEN 'pending' THEN 1 
            WHEN 'approved' THEN 2 
            WHEN 'rejected' THEN 3 
            WHEN 'cancelled' THEN 4 
          END,
          lr.applied_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      // Get total count
      const [countResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        ${whereClause}
      `, params);

      return {
        success: true,
        data: requests,
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(countResult[0].total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get leave requests: ${error.message}`);
    }
  }

  /**
   * Approve a leave request
   */
  static async approveLeaveRequest(requestId, reviewerId, clientId, comments = null) {
    try {
      // Get request details and verify access
      const [request] = await db.execute(`
        SELECT lr.*, e.client_id, e.id as emp_id
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.id = ? AND lr.status = 'pending'
      `, [requestId]);

      if (request.length === 0) {
        return {
          success: false,
          message: 'Leave request not found or already processed'
        };
      }

      if (request[0].client_id !== clientId) {
        return {
          success: false,
          message: 'Access denied'
        };
      }

      // Check if there are any conflicts with approved leaves
      const [conflicts] = await db.execute(`
        SELECT id FROM leave_requests 
        WHERE employee_id = ? 
        AND id != ?
        AND status = 'approved'
        AND NOT (end_date < ? OR start_date > ?)
      `, [
        request[0].employee_id, 
        requestId, 
        request[0].start_date, 
        request[0].end_date
      ]);

      if (conflicts.length > 0) {
        return {
          success: false,
          message: 'Cannot approve: conflicts with existing approved leave'
        };
      }

      // Update request status
      await db.execute(`
        UPDATE leave_requests 
        SET status = 'approved', 
            reviewed_by = ?, 
            reviewed_at = NOW(), 
            reviewer_comments = ?
        WHERE id = ?
      `, [reviewerId, comments, requestId]);

      return {
        success: true,
        message: 'Leave request approved successfully'
      };
    } catch (error) {
      throw new Error(`Failed to approve leave request: ${error.message}`);
    }
  }

  /**
   * Reject a leave request
   */
  static async rejectLeaveRequest(requestId, reviewerId, clientId, comments) {
    try {
      // Get request details and verify access
      const [request] = await db.execute(`
        SELECT lr.*, e.client_id
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.id = ? AND lr.status = 'pending'
      `, [requestId]);

      if (request.length === 0) {
        return {
          success: false,
          message: 'Leave request not found or already processed'
        };
      }

      if (request[0].client_id !== clientId) {
        return {
          success: false,
          message: 'Access denied'
        };
      }

      // Update request status
      await db.execute(`
        UPDATE leave_requests 
        SET status = 'rejected', 
            reviewed_by = ?, 
            reviewed_at = NOW(), 
            reviewer_comments = ?
        WHERE id = ?
      `, [reviewerId, comments, requestId]);

      return {
        success: true,
        message: 'Leave request rejected successfully'
      };
    } catch (error) {
      throw new Error(`Failed to reject leave request: ${error.message}`);
    }
  }

  /**
   * Cancel a leave request (by employee)
   */
  static async cancelLeaveRequest(requestId, employeeId, clientId) {
    try {
      // Verify request belongs to employee and is cancellable
      const [request] = await db.execute(`
        SELECT lr.*, e.client_id
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.id = ? AND lr.employee_id = ? AND lr.status IN ('pending', 'approved')
      `, [requestId, employeeId]);

      if (request.length === 0) {
        return {
          success: false,
          message: 'Leave request not found or cannot be cancelled'
        };
      }

      if (request[0].client_id !== clientId) {
        return {
          success: false,
          message: 'Access denied'
        };
      }

      // Check if leave has already started
      const today = new Date();
      const startDate = new Date(request[0].start_date);
      
      if (startDate <= today) {
        return {
          success: false,
          message: 'Cannot cancel leave that has already started'
        };
      }

      // Update request status
      await db.execute(`
        UPDATE leave_requests 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ?
      `, [requestId]);

      return {
        success: true,
        message: 'Leave request cancelled successfully'
      };
    } catch (error) {
      throw new Error(`Failed to cancel leave request: ${error.message}`);
    }
  }

  // =============================================
  // DASHBOARD & ANALYTICS METHODS
  // =============================================

  /**
   * Get leave dashboard data
   */
  static async getDashboardData(clientId, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Employees on leave today
      const [onLeaveToday] = await db.execute(`
        SELECT 
          e.id,
          e.employee_id as employee_code,
          CONCAT(e.first_name, ' ', e.last_name) as name,
          e.profile_image,
          e.email,
          d.name as department,
          lr.start_date,
          lr.end_date,
          lr.days_requested,
          lt.name as leave_type,
          lt.is_paid,
          lr.reason
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.client_id = ?
        AND lr.status = 'approved'
        AND ? BETWEEN lr.start_date AND lr.end_date
        ORDER BY e.first_name
      `, [clientId, targetDate]);

      // Pending requests count and details
      const [pendingRequests] = await db.execute(`
        SELECT 
          COUNT(*) as total_pending,
          COUNT(CASE WHEN DATEDIFF(lr.start_date, CURDATE()) <= 7 THEN 1 END) as urgent_pending
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.client_id = ? AND lr.status = 'pending'
      `, [clientId]);

      // Monthly statistics
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [monthlyStats] = await db.execute(`
        SELECT 
          lr.status,
          COUNT(*) as count,
          SUM(lr.days_requested) as total_days
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.client_id = ?
        AND DATE_FORMAT(lr.applied_at, '%Y-%m') = ?
        GROUP BY lr.status
      `, [clientId, currentMonth]);

      // Upcoming leaves (next 30 days)
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      
      const [upcomingLeaves] = await db.execute(`
        SELECT 
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_id as employee_code,
          d.name as department,
          lr.start_date,
          lr.end_date,
          lr.days_requested,
          lt.name as leave_type
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.client_id = ?
        AND lr.status = 'approved'
        AND lr.start_date BETWEEN CURDATE() AND ?
        ORDER BY lr.start_date
        LIMIT 20
      `, [clientId, nextMonth.toISOString().split('T')[0]]);

      // Department-wise leave summary
      const [departmentSummary] = await db.execute(`
        SELECT 
          d.name as department_name,
          COUNT(DISTINCT e.id) as total_employees,
          COUNT(CASE WHEN ? BETWEEN lr.start_date AND lr.end_date AND lr.status = 'approved' THEN lr.id END) as employees_on_leave,
          COUNT(CASE WHEN lr.status = 'pending' THEN lr.id END) as pending_requests
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.client_id = ?
        LEFT JOIN leave_requests lr ON e.id = lr.employee_id
        WHERE d.client_id = ?
        GROUP BY d.id, d.name
        ORDER BY d.name
      `, [targetDate, clientId, clientId]);

      return {
        success: true,
        data: {
          date: targetDate,
          onLeaveToday: onLeaveToday,
          onLeaveCount: onLeaveToday.length,
          pendingRequestsCount: pendingRequests[0].total_pending,
          urgentPendingCount: pendingRequests[0].urgent_pending,
          monthlyStats: monthlyStats,
          upcomingLeaves: upcomingLeaves,
          departmentSummary: departmentSummary
        }
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard data: ${error.message}`);
    }
  }

  /**
   * Get detailed leave balance for an employee
   */
  static async getEmployeeLeaveBalance(employeeId, clientId, year = null) {
    try {
      const targetYear = year || new Date().getFullYear();

      // Verify employee belongs to client
      const [employee] = await db.execute(`
        SELECT 
          id, 
          CONCAT(first_name, ' ', last_name) as name,
          hire_date,
          employment_status
        FROM employees 
        WHERE id = ? AND client_id = ?
      `, [employeeId, clientId]);

      if (employee.length === 0) {
        return {
          success: false,
          message: 'Employee not found'
        };
      }

      // Get leave balance for each leave type
      const [leaveBalance] = await db.execute(`
        SELECT 
          lt.id,
          lt.name,
          lt.description,
          lt.max_days_per_year,
          lt.max_consecutive_days,
          lt.is_paid,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as used_days,
          COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN lr.days_requested ELSE 0 END), 0) as pending_days,
          (lt.max_days_per_year - COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0)) as remaining_days
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id 
          AND lr.employee_id = ? 
          AND YEAR(lr.start_date) = ?
        WHERE lt.client_id = ? AND lt.is_active = TRUE
        GROUP BY lt.id, lt.name, lt.max_days_per_year
        ORDER BY lt.name
      `, [employeeId, targetYear, clientId]);

      // Get recent leave history
      const [recentLeaves] = await db.execute(`
        SELECT 
          lr.id,
          lt.name as leave_type,
          lr.start_date,
          lr.end_date,
          lr.days_requested,
          lr.status,
          lr.reason,
          lr.applied_at
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = ?
        AND YEAR(lr.start_date) = ?
        ORDER BY lr.start_date DESC
        LIMIT 10
      `, [employeeId, targetYear]);

      return {
        success: true,
        data: {
          employee: employee[0],
          year: targetYear,
          leaveBalance: leaveBalance,
          recentLeaves: recentLeaves,
          summary: {
            totalAllocated: leaveBalance.reduce((sum, lt) => sum + lt.max_days_per_year, 0),
            totalUsed: leaveBalance.reduce((sum, lt) => sum + lt.used_days, 0),
            totalPending: leaveBalance.reduce((sum, lt) => sum + lt.pending_days, 0),
            totalRemaining: leaveBalance.reduce((sum, lt) => sum + lt.remaining_days, 0)
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to get employee leave balance: ${error.message}`);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Calculate business days between two dates (excluding weekends)
   */
  static calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;
    
    while (start <= end) {
      const dayOfWeek = start.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        businessDays++;
      }
      start.setDate(start.getDate() + 1);
    }
    
    return businessDays;
  }

  /**
   * Validate leave request dates
   */
  static validateLeaveDates(startDate, endDate, noticeRequired = 0) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const errors = [];

    if (start >= end) {
      errors.push('End date must be after start date');
    }

    if (start < today) {
      errors.push('Cannot request leave for past dates');
    }

    const daysUntilStart = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
    if (daysUntilStart < noticeRequired) {
      errors.push(`This leave type requires ${noticeRequired} days advance notice`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = LeaveController