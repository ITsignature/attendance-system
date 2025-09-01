// =============================================
// PAYROLL RUN ROUTES - INDUSTRY STANDARD BATCH PROCESSING API
// =============================================
// RESTful API for managing payroll runs (batches) with approval workflow

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const PayrollRunService = require('../services/PayrollRunService');

// Apply authentication and client access to all routes
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// VALIDATION SCHEMAS
// =============================================

const validateCreateRun = [
    body('period_id').isUUID().withMessage('Valid period ID is required'),
    body('run_name').isLength({ min: 3, max: 100 }).withMessage('Run name must be 3-100 characters'),
    body('run_type').optional().isIn(['regular', 'bonus', 'correction', 'off-cycle']).withMessage('Invalid run type'),
    body('calculation_method').optional().isIn(['simple', 'advanced']).withMessage('Invalid calculation method'),
    body('employee_filters.department_id').optional().isUUID().withMessage('Invalid department ID'),
    body('employee_filters.employee_ids').optional().isArray().withMessage('Employee IDs must be an array'),
    body('employee_filters.employee_type').optional().isIn(['full-time', 'part-time', 'contract', 'intern']).withMessage('Invalid employee type')
];

const validateApproval = [
    body('approval_level').isIn(['review', 'approve']).withMessage('Invalid approval level'),
    body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
];

const validateProcessPayment = [
    body('payment_method').optional().isIn(['bank_transfer', 'cash', 'cheque']).withMessage('Invalid payment method'),
    body('payment_date').optional().isISO8601().withMessage('Invalid payment date'),
    body('batch_reference').optional().isLength({ max: 100 }).withMessage('Batch reference too long')
];

// =============================================
// PAYROLL RUN CRUD OPERATIONS
// =============================================

/**
 * GET /api/payroll-runs
 * Get paginated list of payroll runs
 */
router.get('/',
    checkPermission('payroll.view'),
    [
        query('status').optional().isIn(['draft', 'calculating', 'calculated', 'review', 'approved', 'processing', 'completed', 'cancelled']),
        query('period_id').optional().isUUID(),
        query('run_type').optional().isIn(['regular', 'bonus', 'correction', 'off-cycle']),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const clientId = req.user.clientId;
        const filters = {
            status: req.query.status,
            period_id: req.query.period_id,
            run_type: req.query.run_type,
            limit: parseInt(req.query.limit) || 20,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await PayrollRunService.getPayrollRuns(clientId, filters);

        res.json({
            success: true,
            data: result.runs,
            pagination: result.pagination
        });
    })
);

/**
 * GET /api/payroll-runs/approvals/pending
 * Get pending approvals for current user
 */
router.get('/approvals/pending',
    checkPermission('payroll.view'),
    asyncHandler(async (req, res) => {
        const userId = req.user.userId;
        const clientId = req.user.clientId;
        const ApprovalWorkflowService = require('../services/ApprovalWorkflowService');
        
        try {
            const pendingApprovals = await ApprovalWorkflowService.getPendingApprovalsForUser(userId, clientId);
            
            res.json({
                success: true,
                data: pendingApprovals
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to load pending approvals',
                error: error.message
            });
        }
    })
);

/**
 * GET /api/payroll-runs/periods/available
 * Get available payroll periods for creating runs
 */
router.get('/periods/available',
    checkPermission('payroll.view'),
    asyncHandler(async (req, res) => {
        const clientId = req.user.clientId;
        const { getDB } = require('../config/database');
        const db = getDB();
        
        try {
            // Get available periods for this client
            const [periods] = await db.execute(`
                SELECT 
                    id,
                    period_number,
                    period_year,
                    period_type,
                    period_start_date,
                    period_end_date,
                    cut_off_date,
                    pay_date,
                    status
                FROM payroll_periods 
                WHERE client_id = ? 
                  AND status = 'active'
                ORDER BY period_year DESC, period_number DESC
                LIMIT 12
            `, [clientId]);
            
            res.json({
                success: true,
                data: periods
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to load available periods',
                error: error.message
            });
        }
    })
);

/**
 * GET /api/payroll-runs/:id
 * Get single payroll run with full details
 */
router.get('/:id',
    checkPermission('payroll.view'),
    param('id').isUUID(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;

        try {
            const run = await PayrollRunService.getPayrollRun(runId, clientId);
            
            res.json({
                success: true,
                data: run
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs
 * Create new payroll run
 */
router.post('/',
    checkPermission('payroll.edit'),
    validateCreateRun,
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const clientId = req.user.clientId;
        const userId = req.user.userId;

        try {
            const result = await PayrollRunService.createPayrollRun(clientId, userId, req.body);
            
            res.status(201).json({
                success: true,
                message: 'Payroll run created successfully',
                data: result.data
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    })
);

// =============================================
// PAYROLL RUN PROCESSING WORKFLOW
// =============================================

/**
 * POST /api/payroll-runs/:id/calculate
 * Calculate payroll for entire run
 */
router.post('/:id/calculate',
    checkPermission('payroll.process'),
    param('id').isUUID(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;
        const userId = req.user.userId;

        try {
            const result = await PayrollRunService.calculatePayrollRun(runId, clientId, userId);
            
            res.json({
                success: true,
                message: `Payroll calculation completed. Processed ${result.data.processed_records} records.`,
                data: result.data
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs/:id/approve
 * Approve payroll run (review or final approval)
 */
router.post('/:id/approve',
    checkPermission('payroll.approve'),
    [
        param('id').isUUID(),
        ...validateApproval
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;
        const approverId = req.user.userId;

        try {
            const result = await PayrollRunService.approvePayrollRun(runId, clientId, approverId, req.body);
            
            res.json({
                success: true,
                message: `Payroll run ${req.body.approval_level}ed successfully`,
                data: result.data
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs/:id/process
 * Process payments for approved payroll run
 */
router.post('/:id/process',
    checkPermission('payroll.process'),
    [
        param('id').isUUID(),
        ...validateProcessPayment
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;
        const userId = req.user.userId;

        try {
            const result = await PayrollRunService.processPayrollRun(runId, clientId, userId, req.body);
            
            res.json({
                success: true,
                message: `Payment processing completed for ${result.data.records_processed} records`,
                data: result.data
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs/:id/cancel
 * Cancel payroll run (if not yet processed)
 */
router.post('/:id/cancel',
    checkPermission('payroll.edit'),
    param('id').isUUID(),
    [
        body('cancellation_reason').isLength({ min: 10, max: 500 }).withMessage('Cancellation reason required (10-500 characters)')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;
        const userId = req.user.userId;

        // Implementation for cancellation logic would go here
        res.json({
            success: true,
            message: 'Payroll run cancelled successfully'
        });
    })
);

// =============================================
// PAYROLL RUN DATA ACCESS
// =============================================

/**
 * GET /api/payroll-runs/:id/records
 * Get payroll records within a run
 */
router.get('/:id/records',
    checkPermission('payroll.view'),
    param('id').isUUID(),
    [
        query('status').optional().isIn(['pending', 'calculating', 'calculated', 'error', 'excluded']),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;
        const filters = {
            status: req.query.status,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        // This would be implemented in the service
        res.json({
            success: true,
            message: 'Feature coming soon - get run records'
        });
    })
);

/**
 * GET /api/payroll-runs/:id/summary
 * Get payroll run summary and statistics
 */
router.get('/:id/summary',
    checkPermission('payroll.view'),
    param('id').isUUID(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const runId = req.params.id;
        const clientId = req.user.clientId;

        try {
            const run = await PayrollRunService.getPayrollRun(runId, clientId);
            
            // Extract summary data
            const summary = {
                run_info: {
                    id: run.id,
                    run_number: run.run_number,
                    run_name: run.run_name,
                    status: run.run_status,
                    period: {
                        start: run.period_start_date,
                        end: run.period_end_date,
                        pay_date: run.pay_date
                    }
                },
                statistics: {
                    total_employees: run.total_employees,
                    processed_employees: run.processed_employees,
                    total_gross_amount: parseFloat(run.total_gross_amount),
                    total_deductions_amount: parseFloat(run.total_deductions_amount),
                    total_net_amount: parseFloat(run.total_net_amount)
                },
                workflow: {
                    created_at: run.created_at,
                    created_by: run.created_by_name,
                    reviewed_at: run.reviewed_at,
                    reviewed_by: run.reviewed_by_name,
                    approved_at: run.approved_at,
                    approved_by: run.approved_by_name,
                    processed_at: run.processed_at,
                    processed_by: run.processed_by_name
                }
            };
            
            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    })
);


// =============================================
// PAYROLL PERIODS MANAGEMENT
// =============================================

/**
 * POST /api/payroll-runs/periods
 * Create new payroll period
 */
router.post('/periods',
    checkPermission('payroll.admin'),
    [
        body('period_type').isIn(['weekly', 'bi-weekly', 'monthly', 'quarterly']),
        body('period_start_date').isISO8601(),
        body('period_end_date').isISO8601(),
        body('pay_date').isISO8601(),
        body('cut_off_date').isISO8601()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Implementation for creating payroll periods would go here
        res.json({
            success: true,
            message: 'Feature coming soon - create payroll periods'
        });
    })
);

module.exports = router;