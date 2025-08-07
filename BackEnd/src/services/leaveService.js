const LeaveController = require('../controllers/leaveController');
const db = require('../config/database');

class LeaveService {

  // =============================================
  // NOTIFICATION HELPERS
  // =============================================

  /**
   * Send notification for leave request status changes
   */
  static async sendLeaveNotification(leaveRequestId, action, reviewerName = null) {
    try {
      // Get request details
      const [request] = await db.execute(`
        SELECT 
          lr.*,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.email as employee_email,
          lt.name as leave_type_name,
          CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN admin_users au ON lr.reviewed_by = au.id
        LEFT JOIN employees reviewer ON au.employee_id = reviewer.id
        WHERE lr.id = ?
      `, [leaveRequestId]);

      if (request.length === 0) return;

      const req = request[0];
      
      // Prepare notification data
      const notificationData = {
        to: req.employee_email,
        subject: `Leave Request ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        template: `leave_${action}`,
        data: {
          employeeName: req.employee_name,
          leaveType: req.leave_type_name,
          startDate: req.start_date,
          endDate: req.end_date,
          days: req.days_requested,
          reason: req.reason,
          appliedAt: req.applied_at
        }
      };

      console.log('📧 Manager Notification:', notificationData);
      
      return {
        success: true,
        message: 'Manager notification sent successfully'
      };
    } catch (error) {
      console.error('Failed to send manager notification:', error);
      return {
        success: false,
        message: 'Failed to send manager notification'
      };
    }
  }

  // =============================================
  // LEAVE REQUEST WORKFLOW
  // =============================================

  /**
   * Complete leave request submission workflow
   */
  static async submitLeaveRequestWorkflow(employeeData, requestData) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Submit the request
      const result = await LeaveController.submitLeaveRequest(employeeData, requestData);
      
      if (!result.success) {
        await connection.rollback();
        return result;
      }

      // Log audit trail
      await connection.execute(`
        INSERT INTO audit_logs (
          id, client_id, entity_type, entity_id, action, 
          old_values, new_values, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        require('uuid').v4(),
        employeeData.client_id,
        'leave_request',
        result.data.id,
        'create',
        null,
        JSON.stringify(requestData),
        employeeData.user_id || null
      ]);

      await connection.commit();

      // Send notifications (async, don't wait)
      this.notifyManagersOfNewRequest(result.data.id).catch(console.error);

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Complete leave approval workflow
   */
  static async approveLeaveRequestWorkflow(requestId, reviewerId, clientId, comments) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get request data before approval for audit
      const [beforeData] = await connection.execute(`
        SELECT * FROM leave_requests WHERE id = ?
      `, [requestId]);

      // Approve the request
      const result = await LeaveController.approveLeaveRequest(requestId, reviewerId, clientId, comments);
      
      if (!result.success) {
        await connection.rollback();
        return result;
      }

      // Log audit trail
      await connection.execute(`
        INSERT INTO audit_logs (
          id, client_id, entity_type, entity_id, action, 
          old_values, new_values, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        require('uuid').v4(),
        clientId,
        'leave_request',
        requestId,
        'approve',
        JSON.stringify(beforeData[0]),
        JSON.stringify({ status: 'approved', reviewed_by: reviewerId, reviewer_comments: comments }),
        reviewerId
      ]);

      await connection.commit();

      // Send notification (async)
      this.sendLeaveNotification(requestId, 'approved').catch(console.error);

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Complete leave rejection workflow
   */
  static async rejectLeaveRequestWorkflow(requestId, reviewerId, clientId, comments) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get request data before rejection for audit
      const [beforeData] = await connection.execute(`
        SELECT * FROM leave_requests WHERE id = ?
      `, [requestId]);

      // Reject the request
      const result = await LeaveController.rejectLeaveRequest(requestId, reviewerId, clientId, comments);
      
      if (!result.success) {
        await connection.rollback();
        return result;
      }

      // Log audit trail
      await connection.execute(`
        INSERT INTO audit_logs (
          id, client_id, entity_type, entity_id, action, 
          old_values, new_values, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        require('uuid').v4(),
        clientId,
        'leave_request',
        requestId,
        'reject',
        JSON.stringify(beforeData[0]),
        JSON.stringify({ status: 'rejected', reviewed_by: reviewerId, reviewer_comments: comments }),
        reviewerId
      ]);

      await connection.commit();

      // Send notification (async)
      this.sendLeaveNotification(requestId, 'rejected').catch(console.error);

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // =============================================
  // DATA TRANSFORMATION HELPERS
  // =============================================

  /**
   * Transform leave request data for frontend
   */
  static transformLeaveRequestData(requests) {
    return requests.map(request => ({
      id: request.id,
      employee: {
        id: request.employee_id,
        name: request.employee_name,
        code: request.employee_code,
        email: request.employee_email,
        avatar: request.profile_image,
        department: request.department,
        designation: request.designation
      },
      leaveType: {
        id: request.leave_type_id,
        name: request.leave_type_name,
        isPaid: request.is_paid
      },
      dates: {
        start: request.start_date,
        end: request.end_date,
        daysRequested: request.days_requested
      },
      details: {
        reason: request.reason,
        status: request.status,
        appliedAt: request.applied_at,
        reviewedAt: request.reviewed_at,
        reviewerComments: request.reviewer_comments,
        reviewerName: request.reviewer_name,
        supportingDocuments: request.supporting_documents ? JSON.parse(request.supporting_documents) : null
      }
    }));
  }

  /**
   * Transform dashboard data for frontend
   */
  static transformDashboardData(dashboardData) {
    return {
      date: dashboardData.date,
      summary: {
        onLeaveCount: dashboardData.onLeaveCount,
        pendingRequestsCount: dashboardData.pendingRequestsCount,
        urgentPendingCount: dashboardData.urgentPendingCount
      },
      onLeaveToday: dashboardData.onLeaveToday.map(emp => ({
        id: emp.id,
        name: emp.name,
        code: emp.employee_code,
        avatar: emp.profile_image,
        department: emp.department,
        leave: {
          type: emp.leave_type,
          isPaid: emp.is_paid,
          startDate: emp.start_date,
          endDate: emp.end_date,
          days: emp.days_requested,
          reason: emp.reason
        }
      })),
      monthlyStats: dashboardData.monthlyStats.reduce((acc, stat) => {
        acc[stat.status] = {
          count: stat.count,
          totalDays: stat.total_days
        };
        return acc;
      }, {}),
      upcomingLeaves: dashboardData.upcomingLeaves.map(leave => ({
        employeeName: leave.employee_name,
        employeeCode: leave.employee_code,
        department: leave.department,
        startDate: leave.start_date,
        endDate: leave.end_date,
        days: leave.days_requested,
        leaveType: leave.leave_type
      })),
      departmentSummary: dashboardData.departmentSummary.map(dept => ({
        department: dept.department_name,
        totalEmployees: dept.total_employees,
        employeesOnLeave: dept.employees_on_leave,
        pendingRequests: dept.pending_requests,
        availabilityPercentage: dept.total_employees > 0 
          ? Math.round(((dept.total_employees - dept.employees_on_leave) / dept.total_employees) * 100)
          : 100
      }))
    };
  }

  // =============================================
  // ANALYTICS & REPORTS
  // =============================================

  /**
   * Generate leave analytics report
   */
  static async generateLeaveAnalytics(clientId, filters = {}) {
    try {
      const {
        start_date = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end_date = new Date().toISOString().split('T')[0],
        department_id,
        leave_type_id
      } = filters;

      let whereClause = 'WHERE e.client_id = ? AND lr.start_date >= ? AND lr.end_date <= ?';
      let params = [clientId, start_date, end_date];

      if (department_id) {
        whereClause += ' AND e.department_id = ?';
        params.push(department_id);
      }
      if (leave_type_id) {
        whereClause += ' AND lr.leave_type_id = ?';
        params.push(leave_type_id);
      }

      // Overall statistics
      const [overallStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_requests,
          COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_requests,
          SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END) as total_approved_days,
          AVG(CASE WHEN lr.status = 'approved' THEN lr.days_requested END) as avg_leave_duration,
          AVG(CASE WHEN lr.reviewed_at IS NOT NULL THEN DATEDIFF(lr.reviewed_at, lr.applied_at) END) as avg_approval_time
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        ${whereClause}
      `, params);

      // Leave type breakdown
      const [leaveTypeStats] = await db.execute(`
        SELECT 
          lt.name as leave_type,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END) as total_days
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        ${whereClause}
        GROUP BY lt.id, lt.name
        ORDER BY total_requests DESC
      `, params);

      // Department breakdown
      const [departmentStats] = await db.execute(`
        SELECT 
          d.name as department,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END) as total_days,
          COUNT(DISTINCT e.id) as unique_employees
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        ${whereClause}
        GROUP BY d.id, d.name
        ORDER BY total_requests DESC
      `, params);

      // Monthly trend
      const [monthlyTrend] = await db.execute(`
        SELECT 
          DATE_FORMAT(lr.start_date, '%Y-%m') as month,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END) as total_days
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        ${whereClause}
        GROUP BY DATE_FORMAT(lr.start_date, '%Y-%m')
        ORDER BY month
      `, params);

      // Top leave takers
      const [topLeaveTakers] = await db.execute(`
        SELECT 
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_id as employee_code,
          d.name as department,
          COUNT(*) as total_requests,
          SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END) as total_days_taken
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        ${whereClause}
        GROUP BY e.id, e.first_name, e.last_name, e.employee_id, d.name
        HAVING total_days_taken > 0
        ORDER BY total_days_taken DESC
        LIMIT 10
      `, params);

      return {
        success: true,
        data: {
          period: { start_date, end_date },
          overall: overallStats[0],
          leaveTypes: leaveTypeStats,
          departments: departmentStats,
          monthlyTrend: monthlyTrend,
          topLeaveTakers: topLeaveTakers,
          summary: {
            approvalRate: overallStats[0].total_requests > 0 
              ? Math.round((overallStats[0].approved_requests / overallStats[0].total_requests) * 100)
              : 0,
            rejectionRate: overallStats[0].total_requests > 0 
              ? Math.round((overallStats[0].rejected_requests / overallStats[0].total_requests) * 100)
              : 0,
            avgProcessingTime: Math.round(overallStats[0].avg_approval_time || 0)
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate leave analytics: ${error.message}`);
    }
  }

  /**
   * Export leave data in various formats
   */
  static async exportLeaveData(clientId, filters = {}, format = 'json') {
    try {
      // Get leave requests with comprehensive data
      const requests = await LeaveController.getLeaveRequests(clientId, filters);
      
      if (!requests.success) {
        return requests;
      }

      const exportData = requests.data.map(request => ({
        'Request ID': request.id,
        'Employee ID': request.employee_code,
        'Employee Name': request.employee_name,
        'Department': request.department,
        'Designation': request.designation,
        'Leave Type': request.leave_type_name,
        'Is Paid': request.is_paid ? 'Yes' : 'No',
        'Start Date': request.start_date,
        'End Date': request.end_date,
        'Days Requested': request.days_requested,
        'Reason': request.reason,
        'Status': request.status.charAt(0).toUpperCase() + request.status.slice(1),
        'Applied Date': request.applied_at,
        'Reviewed Date': request.reviewed_at || 'N/A',
        'Reviewed By': request.reviewer_name || 'N/A',
        'Comments': request.reviewer_comments || 'N/A'
      }));

      if (format === 'csv') {
        // Convert to CSV
        const csvHeader = Object.keys(exportData[0] || {}).join(',');
        const csvRows = exportData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && (value.includes(',') || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"` 
              : value
          ).join(',')
        );
        
        return {
          success: true,
          data: [csvHeader, ...csvRows].join('\n'),
          filename: `leave-export-${new Date().toISOString().split('T')[0]}.csv`,
          contentType: 'text/csv'
        };
      }

      return {
        success: true,
        data: exportData,
        meta: {
          totalRecords: exportData.length,
          filters: filters,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error(`Failed to export leave data: ${error.message}`);
    }
  }

  // =============================================
  // VALIDATION HELPERS
  // =============================================

  /**
   * Validate leave request before submission
   */
  static async validateLeaveRequest(employeeData, requestData) {
    const errors = [];
    
    try {
      const {
        leave_type_id,
        start_date,
        end_date,
        days_requested
      } = requestData;

      // Basic date validation
      const dateValidation = LeaveController.validateLeaveDates(start_date, end_date);
      if (!dateValidation.isValid) {
        errors.push(...dateValidation.errors);
      }

      // Verify leave type exists and get details
      const [leaveType] = await db.execute(`
        SELECT * FROM leave_types 
        WHERE id = ? AND client_id = ? AND is_active = TRUE
      `, [leave_type_id, employeeData.client_id]);

      if (leaveType.length === 0) {
        errors.push('Invalid leave type selected');
      } else {
        // Check notice period
        const daysValidation = LeaveController.validateLeaveDates(
          start_date, 
          end_date, 
          leaveType[0].notice_period_days
        );
        if (!daysValidation.isValid) {
          errors.push(...daysValidation.errors);
        }

        // Check consecutive days limit
        if (leaveType[0].max_consecutive_days > 0 && days_requested > leaveType[0].max_consecutive_days) {
          errors.push(`Maximum consecutive days allowed: ${leaveType[0].max_consecutive_days}`);
        }
      }

      // Check leave balance
      const balanceCheck = await LeaveController.checkLeaveBalance(
        employeeData.employee_id, 
        leave_type_id, 
        days_requested
      );
      if (!balanceCheck.success) {
        errors.push(balanceCheck.message);
      }

      // Check for overlapping requests
      const [overlapping] = await db.execute(`
        SELECT id FROM leave_requests 
        WHERE employee_id = ? 
        AND status IN ('pending', 'approved')
        AND NOT (end_date < ? OR start_date > ?)
      `, [employeeData.employee_id, start_date, end_date]);

      if (overlapping.length > 0) {
        errors.push('You have overlapping leave requests for this period');
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    } catch (error) {
      throw new Error(`Failed to validate leave request: ${error.message}`);
    }
  }

  // =============================================
  // BULK OPERATIONS
  // =============================================

  /**
   * Bulk approve multiple leave requests
   */
  static async bulkApproveRequests(requestIds, reviewerId, clientId, comments = null) {
    const connection = await db.getConnection();
    const results = [];
    
    try {
      await connection.beginTransaction();

      for (const requestId of requestIds) {
        try {
          const result = await this.approveLeaveRequestWorkflow(requestId, reviewerId, clientId, comments);
          results.push({
            requestId,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.push({
            requestId,
            success: false,
            message: error.message
          });
        }
      }

      await connection.commit();
      
      return {
        success: true,
        results: results,
        summary: {
          total: requestIds.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = LeaveService;