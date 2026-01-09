const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  ensureOwnEmployeeAccess,
  ensureOwnAttendance,
  ensureOwnPayroll,
  ensureOwnLeaves,
  ensureOwnFinancialRecords
} = require('../middleware/employeeAuthMiddleware');
const {
  getMyProfile,
  getMyAttendance,
  getMyPayrollHistory,
  getMyPayslip,
  getMyLeaveRequests,
  applyForLeave,
  getLeaveTypes,
  getMyLeaveBalance,
  getMyFinancialRecords,
  getMyLivePayrollPreview,
  getMyLivePayrollDetails
} = require('../controllers/employeePortalController');

// All routes require authentication
router.use(authenticate);

/**
 * EMPLOYEE PROFILE ROUTES
 * Employees can only view their own profile (read-only)
 */

// Get my profile
router.get('/profile', ensureOwnEmployeeAccess, getMyProfile);

/**
 * ATTENDANCE ROUTES
 * Employees can only view their own attendance records (read-only)
 */

// Get my attendance records
router.get('/attendance', ensureOwnAttendance, getMyAttendance);

/**
 * PAYROLL ROUTES
 * Employees can only view their own payroll records (read-only)
 */

// Get my payroll history
router.get('/payroll/history', ensureOwnPayroll, getMyPayrollHistory);

// Get my live payroll preview (all runs)
router.get('/payroll/live-preview', ensureOwnPayroll, getMyLivePayrollPreview);

// Get my live payroll details for a specific run
router.get('/payroll/live-preview/:runId', ensureOwnPayroll, getMyLivePayrollDetails);

// Get specific payslip
router.get('/payroll/:id', ensureOwnPayroll, getMyPayslip);

/**
 * LEAVE ROUTES
 * Employees can view their leave requests and apply for new leaves
 * They CANNOT approve or reject leaves
 */

// Get available leave types
router.get('/leaves/types', getLeaveTypes);

// Get my leave balance
router.get('/leaves/balance', ensureOwnLeaves, getMyLeaveBalance);

// Get my leave requests
router.get('/leaves/my-requests', ensureOwnLeaves, getMyLeaveRequests);

// Apply for leave (only POST allowed for employees)
router.post('/leaves/apply', ensureOwnLeaves, applyForLeave);

/**
 * FINANCIAL RECORDS ROUTES
 * Employees can only VIEW their loans, advances, and bonuses (read-only)
 * They CANNOT create, edit, or delete financial records
 */

// Get my financial records (loans, advances, bonuses)
router.get('/financial-records', ensureOwnFinancialRecords, getMyFinancialRecords);

module.exports = router;
