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
const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

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
        query('status').optional().isIn(['draft', 'calculating', 'calculated', 'processing', 'completed', 'cancelled']),
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
                LIMIT 24
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

// =============================================
// PAYROLL CONFIGURATION ROUTES
// =============================================

/**
 * GET /api/payroll-runs/components
 * Get all payroll components
 */
router.get('/components',
    checkPermission('settings.payroll_components.view'),
    asyncHandler(async (req, res) => {
        const clientId = req.user.clientId;
        const db = await getDB();

        try {
            const [components] = await db.execute(`
                SELECT
                    id,
                    component_name,
                    component_type,
                    category,
                    calculation_type,
                    calculation_value,
                    calculation_formula,
                    is_taxable,
                    is_mandatory,
                    applies_to,
                    applies_to_ids,
                    is_active,
                    created_at,
                    updated_at
                FROM payroll_components
                WHERE client_id = ?
                ORDER BY component_type, component_name
            `, [clientId]);

            res.json({
                success: true,
                data: components
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch payroll components',
                error: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs/components
 * Create new payroll component
 */
router.post('/components',
    checkPermission('settings.payroll_components.add'),
    [
        body('component_name').notEmpty().withMessage('Component name is required'),
        body('component_type').isIn(['earning', 'deduction']).withMessage('Component type must be earning or deduction'),
        body('category').notEmpty().withMessage('Category is required'),
        body('calculation_type').isIn(['fixed', 'percentage', 'formula']).withMessage('Invalid calculation type'),
        body('calculation_value').optional().isNumeric().withMessage('Calculation value must be numeric'),
        body('calculation_formula').optional().isString(),
        body('is_taxable').optional().isBoolean(),
        body('is_mandatory').optional().isBoolean(),
        body('applies_to').optional().isIn(['all', 'department', 'designation', 'individual']),
        body('applies_to_ids').optional().custom((value) => {
            // Allow null, empty array, or array of UUIDs
            if (value === null || value === undefined) return true;
            if (Array.isArray(value)) return true;
            throw new Error('applies_to_ids must be an array or null');
        })
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
        const userId = req.user.userId;
        const db = await getDB();
        const componentId = uuidv4();

        const {
            component_name,
            component_type,
            category,
            calculation_type,
            calculation_value,
            calculation_formula,
            is_taxable = false,
            is_mandatory = false,
            applies_to = 'all',
            applies_to_ids = null
        } = req.body;

        // Handle applies_to_ids: if it's an empty array or applies_to is 'all', set to null
        let processedAppliesIds = null;
        if (applies_to !== 'all' && applies_to_ids && Array.isArray(applies_to_ids) && applies_to_ids.length > 0) {
            processedAppliesIds = JSON.stringify(applies_to_ids);
        }

        try {
            await db.execute(`
            INSERT INTO payroll_components (
                id, client_id, component_name, component_type, category,
                calculation_type, calculation_value, calculation_formula,
                is_taxable, is_mandatory, applies_to, applies_to_ids,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            componentId, clientId, component_name, component_type, category,
            calculation_type,
            calculation_value ?? null,          // handle missing numeric
            calculation_formula ?? null,        // handle missing formula
            is_taxable, is_mandatory, applies_to,
            processedAppliesIds,
            true
        ]);

            res.status(201).json({
                success: true,
                message: 'Payroll component created successfully',
                data: { id: componentId }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to create payroll component',
                error: error.message
            });
        }
    })
);

/**
 * PUT /api/payroll-runs/components/:id
 * Update payroll component
 */
router.put('/components/:id',
    checkPermission('settings.payroll_components.edit'),
    [
        param('id').isUUID().withMessage('Valid component ID is required'),
        body('component_name').optional().notEmpty(),
        body('component_type').optional().isIn(['earning', 'deduction']),
        body('category').optional().notEmpty(),
        body('calculation_type').optional().isIn(['fixed', 'percentage', 'formula']),
        body('calculation_value').optional().isNumeric(),
        body('calculation_formula').optional().isString(),
        body('is_taxable').optional().isBoolean(),
        body('is_mandatory').optional().isBoolean(),
        body('applies_to').optional().isIn(['all', 'department', 'designation', 'individual']),
        body('applies_to_ids').optional().custom((value) => {
            // Allow null, empty array, or array of UUIDs
            if (value === null || value === undefined) return true;
            if (Array.isArray(value)) return true;
            throw new Error('applies_to_ids must be an array or null');
        })
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

        const componentId = req.params.id;
        const clientId = req.user.clientId;
        const userId = req.user.userId;
        const db = await getDB();

        try {
            const updateFields = [];
            const updateValues = [];

            // Handle applies_to_ids specially
            Object.keys(req.body).forEach(key => {
                if (key === 'applies_to_ids') {
                    // If applies_to is 'all' or applies_to_ids is empty/null, set to null
                    const appliesToIds = req.body[key];
                    if (appliesToIds === null || appliesToIds === undefined ||
                        (Array.isArray(appliesToIds) && appliesToIds.length === 0) ||
                        req.body.applies_to === 'all') {
                        updateFields.push(`${key} = ?`);
                        updateValues.push(null);
                    } else if (Array.isArray(appliesToIds) && appliesToIds.length > 0) {
                        updateFields.push(`${key} = ?`);
                        updateValues.push(JSON.stringify(appliesToIds));
                    }
                } else if (req.body[key] !== undefined) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(req.body[key]);
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }

            updateFields.push('updated_at = NOW()');
            updateValues.push(componentId, clientId);

            const [result] = await db.execute(`
                UPDATE payroll_components
                SET ${updateFields.join(', ')}
                WHERE id = ? AND client_id = ?
            `, updateValues);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Component not found'
                });
            }

            res.json({
                success: true,
                message: 'Payroll component updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update payroll component',
                error: error.message
            });
        }
    })
);

/**
 * DELETE /api/payroll-runs/components/:id
 * Delete payroll component
 */
router.delete('/components/:id',
    checkPermission('settings.payroll_components.delete'),
    param('id').isUUID().withMessage('Valid component ID is required'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const componentId = req.params.id;
        const clientId = req.user.clientId;
        const db = await getDB();

        try {
            const [result] = await db.execute(`
                DELETE FROM payroll_components
                WHERE id = ? AND client_id = ?
            `, [componentId, clientId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Component not found'
                });
            }

            res.json({
                success: true,
                message: 'Payroll component deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete payroll component',
                error: error.message
            });
        }
    })
);

/**
 * GET /api/payroll-runs/employee-allowances
 * Get employee allowances
 */
router.get('/employee-allowances',
    checkPermission('settings.employee_allowances.view'),
    [
        query('employee_id').optional().isUUID(),
        query('active_only').optional().isBoolean()
    ],
    asyncHandler(async (req, res) => {
        const clientId = req.user.clientId;
        const db = await getDB();
        const { employee_id, active_only = 'true' } = req.query;

        try {
            let whereClause = 'WHERE ea.client_id = ?';
            let queryParams = [clientId];

            if (employee_id) {
                whereClause += ' AND ea.employee_id = ?';
                queryParams.push(employee_id);
            }

            if (active_only === 'true') {
                whereClause += ' AND ea.is_active = true';
            }

            const [allowances] = await db.execute(`
                SELECT
                    ea.id,
                    ea.employee_id,
                    e.employee_code,
                    COALESCE(NULLIF(CONCAT(TRIM(e.first_name), ' ', TRIM(e.last_name)), ' '), e.employee_code) as employee_name,
                    ea.allowance_type,
                    ea.allowance_name,
                    ea.amount,
                    ea.is_percentage,
                    ea.is_taxable,
                    ea.is_active,
                    ea.effective_from,
                    ea.effective_to,
                    ea.created_at
                FROM employee_allowances ea
                JOIN employees e ON ea.employee_id = e.id
                ${whereClause}
                ORDER BY e.employee_code, ea.allowance_name
            `, queryParams);

            res.json({
                success: true,
                data: allowances
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch employee allowances',
                error: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs/employee-allowances
 * Create employee allowance
 */
router.post('/employee-allowances',

    checkPermission('settings.employee_allowances.add'),
    [
        body('employee_id').isUUID().withMessage('Valid employee ID is required'),
        body('allowance_type').notEmpty().withMessage('Allowance type is required'),
        body('allowance_name').notEmpty().withMessage('Allowance name is required'),
        body('amount').isNumeric().withMessage('Amount must be numeric'),
        body('is_percentage').optional().isBoolean(),
        body('is_taxable').optional().isBoolean(),
        body('effective_from').isISO8601().withMessage('Valid effective from date is required'),
        body('effective_to').optional().custom((value) => {
            // Allow null or valid ISO8601 date
            if (value === null || value === undefined) return true;
            if (typeof value === 'string' && !isNaN(Date.parse(value))) return true;
            throw new Error('effective_to must be a valid date or null');
        })
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
        const userId = req.user.userId;
        const db = await getDB();
        const allowanceId = uuidv4();

        const {
            employee_id,
            allowance_type,
            allowance_name,
            amount,
            is_percentage = false,
            is_taxable = true,
            effective_from,
            effective_to = null
        } = req.body;

        try {
            await db.execute(`
                INSERT INTO employee_allowances (
                    id, client_id, employee_id, allowance_type, allowance_name,
                    amount, is_percentage, is_taxable, is_active,
                    effective_from, effective_to, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                allowanceId, clientId, employee_id, allowance_type, allowance_name,
                amount, is_percentage, is_taxable, true,
                effective_from, effective_to, userId
            ]);

            res.status(201).json({
                success: true,
                message: 'Employee allowance created successfully',
                data: { id: allowanceId }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to create employee allowance',
                error: error.message
            });
        }
    })
);

/**
 * PUT /api/payroll-runs/employee-allowances/:id
 * Update employee allowance
 */
router.put('/employee-allowances/:id',
    checkPermission('settings.employee_allowances.edit'),
    [
        param('id').isUUID().withMessage('Valid allowance ID is required'),
        body('allowance_type').optional().notEmpty(),
        body('allowance_name').optional().notEmpty(),
        body('amount').optional().isNumeric(),
        body('is_percentage').optional().isBoolean(),
        body('is_taxable').optional().isBoolean(),
        body('effective_from').optional().isISO8601(),
        body('effective_to').optional().custom((value) => {
            // Allow null or valid ISO8601 date
            if (value === null || value === undefined) return true;
            if (typeof value === 'string' && !isNaN(Date.parse(value))) return true;
            throw new Error('effective_to must be a valid date or null');
        })
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

        const allowanceId = req.params.id;
        const clientId = req.user.clientId;
        const userId = req.user.userId;
        const db = await getDB();

        try {
            const updateFields = [];
            const updateValues = [];

            Object.keys(req.body).forEach(key => {
                if (req.body[key] !== undefined) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(req.body[key]);
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }

            updateFields.push('updated_at = NOW()');
            updateValues.push(allowanceId, clientId);

            const [result] = await db.execute(`
                UPDATE employee_allowances
                SET ${updateFields.join(', ')}
                WHERE id = ? AND client_id = ?
            `, updateValues);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Allowance not found'
                });
            }

            res.json({
                success: true,
                message: 'Employee allowance updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update employee allowance',
                error: error.message
            });
        }
    })
);

/**
 * DELETE /api/payroll-runs/employee-allowances/:id
 * Delete employee allowance
 */
router.delete('/employee-allowances/:id',
    checkPermission('settings.employee_allowances.delete'),
    param('id').isUUID().withMessage('Valid allowance ID is required'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const allowanceId = req.params.id;
        const clientId = req.user.clientId;
        const db = await getDB();

        try {
            const [result] = await db.execute(`
                DELETE FROM employee_allowances
                WHERE id = ? AND client_id = ?
            `, [allowanceId, clientId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Allowance not found'
                });
            }

            res.json({
                success: true,
                message: 'Employee allowance deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete employee allowance',
                error: error.message
            });
        }
    })
);

/**
 * GET /api/payroll-runs/employee-deductions
 * Get employee deductions
 */
router.get('/employee-deductions',
    checkPermission('settings.employee_deductions.view'),
    [
        query('employee_id').optional().isUUID(),
        query('active_only').optional().isBoolean()
    ],
    asyncHandler(async (req, res) => {
        const clientId = req.user.clientId;
        const db = await getDB();
        const { employee_id, active_only = 'true' } = req.query;

        try {
            let whereClause = 'WHERE ed.client_id = ?';
            let queryParams = [clientId];

            if (employee_id) {
                whereClause += ' AND ed.employee_id = ?';
                queryParams.push(employee_id);
            }

            if (active_only === 'true') {
                whereClause += ' AND ed.is_active = true';
            }

            const [deductions] = await db.execute(`
                SELECT
                    ed.id,
                    ed.employee_id,
                    e.employee_code,
                    COALESCE(NULLIF(CONCAT(TRIM(e.first_name), ' ', TRIM(e.last_name)), ' '), e.employee_code) as employee_name,
                    ed.deduction_type,
                    ed.deduction_name,
                    ed.amount,
                    ed.is_percentage,
                    ed.is_recurring,
                    ed.remaining_installments,
                    ed.is_active,
                    ed.effective_from,
                    ed.effective_to,
                    ed.created_at
                FROM employee_deductions ed
                JOIN employees e ON ed.employee_id = e.id
                ${whereClause}
                ORDER BY e.employee_code, ed.deduction_name
            `, queryParams);

            res.json({
                success: true,
                data: deductions
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch employee deductions',
                error: error.message
            });
        }
    })
);

/**
 * POST /api/payroll-runs/employee-deductions
 * Create employee deduction
 */
router.post('/employee-deductions',
    checkPermission('settings.employee_deductions.add'),
    [
        body('employee_id').isUUID().withMessage('Valid employee ID is required'),
        body('deduction_type').notEmpty().withMessage('Deduction type is required'),
        body('deduction_name').notEmpty().withMessage('Deduction name is required'),
        body('amount').isNumeric().withMessage('Amount must be numeric'),
        body('is_percentage').optional().isBoolean(),
        body('is_recurring').optional().isBoolean(),
        body('remaining_installments').optional().isInt({ min: 1 }).withMessage('Remaining installments must be at least 1'),
        body('effective_from').isISO8601().withMessage('Valid effective from date is required'),
        body('effective_to').optional().custom((value) => {
            // Allow null or valid ISO8601 date
            if (value === null || value === undefined) return true;
            if (typeof value === 'string' && !isNaN(Date.parse(value))) return true;
            throw new Error('effective_to must be a valid date or null');
        })
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

        console.log("body",req.body);

        const clientId = req.user.clientId;
        const userId = req.user.userId;
        const db = await getDB();
        const deductionId = uuidv4();

        const {
            employee_id,
            deduction_type,
            deduction_name,
            amount,
            is_percentage = false,
            is_recurring = false,
            remaining_installments = 1,
            effective_from,
            effective_to = null
        } = req.body;

        try {
            await db.execute(`
                INSERT INTO employee_deductions (
                    id, client_id, employee_id, deduction_type, deduction_name,
                    amount, is_percentage, is_recurring, remaining_installments,
                    is_active, effective_from, effective_to, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                deductionId, clientId, employee_id, deduction_type, deduction_name,
                amount, is_percentage, is_recurring, remaining_installments,
                true, effective_from, effective_to, userId
            ]);

            res.status(201).json({
                success: true,
                message: 'Employee deduction created successfully',
                data: { id: deductionId }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to create employee deduction',
                error: error.message,
                request: req.body
            });
        }
    })
);

/**
 * PUT /api/payroll-runs/employee-deductions/:id
 * Update employee deduction
 */
router.put('/employee-deductions/:id',
    checkPermission('settings.employee_deductions.edit'),
    [
        param('id').isUUID().withMessage('Valid deduction ID is required'),
        body('deduction_type').optional().notEmpty(),
        body('deduction_name').optional().notEmpty(),
        body('amount').optional().isNumeric(),
        body('is_percentage').optional().isBoolean(),
        body('is_recurring').optional().isBoolean(),
        body('remaining_installments').optional().isInt({ min: 0 }).withMessage('Remaining installments cannot be negative'),
        body('effective_from').optional().isISO8601(),
        body('effective_to').optional().custom((value) => {
            // Allow null or valid ISO8601 date
            if (value === null || value === undefined) return true;
            if (typeof value === 'string' && !isNaN(Date.parse(value))) return true;
            throw new Error('effective_to must be a valid date or null');
        })
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

        const deductionId = req.params.id;
        const clientId = req.user.clientId;
        const userId = req.user.userId;
        const db = await getDB();

        try {
            const updateFields = [];
            const updateValues = [];

            Object.keys(req.body).forEach(key => {
                if (req.body[key] !== undefined) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(req.body[key]);
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }

            updateFields.push('updated_at = NOW()');
            updateValues.push( deductionId, clientId);

            console.log("updated fields: ",updateFields);
            console.log("updated values: ",updateValues);

            const query = `UPDATE employee_deductions
                SET ${updateFields.join(', ')}
                WHERE id = ? AND client_id = ?`;

            console.log("query",query);
            
            const [result] = await db.execute(`
                UPDATE employee_deductions
                SET ${updateFields.join(', ')}
                WHERE id = ? AND client_id = ?
            `, updateValues);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Deduction not found'
                });
            }

            res.json({
                success: true,
                message: 'Employee deduction updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update employee deduction',
                error: error.message
            });
        }
    })
);

/**
 * DELETE /api/payroll-runs/employee-deductions/:id
 * Delete employee deduction
 */
router.delete('/employee-deductions/:id',
    checkPermission('settings.employee_deductions.delete'),
    param('id').isUUID().withMessage('Valid deduction ID is required'),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const deductionId = req.params.id;
        const clientId = req.user.clientId;
        const db = await getDB();

        try {
            const [result] = await db.execute(`
                DELETE FROM employee_deductions
                WHERE id = ? AND client_id = ?
            `, [deductionId, clientId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Deduction not found'
                });
            }

            res.json({
                success: true,
                message: 'Employee deduction deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete employee deduction',
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
 * GET /api/payroll-runs/:id/workflow
 * Get workflow status for a payroll run
 */
router.get('/:id/workflow',
    checkPermission('payroll.view'),
    param('id').isUUID().withMessage('Valid run ID is required'),
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
                data: {
                    workflow: {
                        status: run.run_status,
                        created_at: run.created_at,
                        created_by: run.created_by_name || 'System User',
                        processed_at: run.processed_at,
                        processed_by: run.processed_by_name || null,
                        completed_at: run.completed_at
                    }
                }
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
 * GET /api/payroll-runs/:id/records
 * Get individual employee records for a payroll run
 */
router.get('/:id/records',
    checkPermission('payroll.view'),
    param('id').isUUID().withMessage('Valid run ID is required'),
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
            const records = await PayrollRunService.getPayrollRecords(runId, clientId);
            
            res.json({
                success: true,
                data: records
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
 * GET /api/payroll-runs/:id/live-data
 * Get all raw data for frontend payroll calculation (live preview)
 */
router.get('/:id/live-data',
    checkPermission('payroll.view'),
    param('id').isUUID().withMessage('Valid run ID is required'),
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
            const liveData = await PayrollRunService.getLivePayrollData(runId, clientId);

            console.log("liveData",liveData);
            
            res.json({
                success: true,
                data: liveData
            });
        } catch (error) {
            console.error('Error in getLivePayrollData route:', error);
            res.status(404).json({
                success: false,
                message: error?.message || 'Failed to fetch live payroll data'
            });
        }
    })
);

/**
 * POST /api/payroll-runs
 * Create new payroll run
 */
router.post('/',
    checkPermission('payroll.create'),
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
    checkPermission('payroll.calculate'),
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
 * POST /api/payroll-runs/:id/process
 * Process payments for calculated payroll run
 */
router.post('/:id/process',
    checkPermission('payroll.calculate'),
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
    checkPermission('payroll.cancel'),
    param('id').isUUID(),
    [
        body('cancellation_reason').optional().isLength({ max: 500 }).withMessage('Cancellation reason cannot exceed 500 characters')
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
        const cancellationReason = req.body.cancellation_reason || '';

        try {
            const result = await PayrollRunService.cancelPayrollRun(runId, clientId, userId, cancellationReason);
            
            res.json({
                success: true,
                message: 'Payroll run cancelled successfully',
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

/**
 * GET /api/payroll-runs/records/:recordId/components
 * Get component breakdown for a specific payroll record
 */
router.get('/records/:recordId/components',
    checkPermission('payroll.view'),
    param('recordId').isUUID(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const recordId = req.params.recordId;
        const clientId = req.user.clientId;

        try {
            const components = await PayrollRunService.getRecordComponents(recordId, clientId);
            
            res.json({
                success: true,
                data: components
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
 * GET /api/payroll-runs/logs/:filename/download
 * Download payroll calculation log file
 */
router.get('/logs/:filename/download',
    checkPermission('payroll.view'),
    param('filename').matches(/^payroll-run-[a-f0-9-]+\.txt$/),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid filename format',
                errors: errors.array()
            });
        }

        const filename = req.params.filename;
        const logsDir = path.join(__dirname, '../logs');
        const logFilePath = path.join(logsDir, filename);

        try {
            // Security check - ensure file exists and is within logs directory
            const resolvedPath = path.resolve(logFilePath);
            const resolvedLogsDir = path.resolve(logsDir);

            if (!resolvedPath.startsWith(resolvedLogsDir)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Check if file exists
            await fs.access(logFilePath);

            // Get file stats for headers
            const stats = await fs.stat(logFilePath);

            // Set appropriate headers for download
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', stats.size);

            // Read and send file
            const content = await fs.readFile(logFilePath, 'utf8');
            res.send(content);

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    message: 'Log file not found'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error accessing log file'
                });
            }
        }
    })
);

/**
 * GET /api/payroll-runs/logs/:filename/view
 * View payroll calculation log file content
 */
router.get('/logs/:filename/view',
    checkPermission('payroll.view'),
    param('filename').matches(/^payroll-run-[a-f0-9-]+\.txt$/),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid filename format',
                errors: errors.array()
            });
        }

        const filename = req.params.filename;
        const logsDir = path.join(__dirname, '../logs');
        const logFilePath = path.join(logsDir, filename);

        try {
            // Security check - ensure file exists and is within logs directory
            const resolvedPath = path.resolve(logFilePath);
            const resolvedLogsDir = path.resolve(logsDir);

            if (!resolvedPath.startsWith(resolvedLogsDir)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Read file content
            const content = await fs.readFile(logFilePath, 'utf8');
            const stats = await fs.stat(logFilePath);

            res.json({
                success: true,
                data: {
                    filename: filename,
                    size: stats.size,
                    created_at: stats.birthtime,
                    modified_at: stats.mtime,
                    content: content
                }
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    message: 'Log file not found'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error reading log file'
                });
            }
        }
    })
);

// =============================================
// CRON JOB ENDPOINT - AUTO-CREATE PAYROLL RUNS
// =============================================

/**
 * POST /api/payroll-runs/cron/auto-create
 * Auto-create monthly payroll runs for all clients
 * This endpoint should be called by a cron job at the start of each month
 *
 * Security: This endpoint should be protected by API key or internal-only access
 */
router.post('/cron/auto-create',
    asyncHandler(async (req, res) => {
        // Optional: Add API key validation for security
        const apiKey = req.headers['x-cron-api-key'];
        const expectedKey = process.env.CRON_API_KEY || 'your-secure-cron-key-here';

        if (apiKey !== expectedKey) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Invalid API key'
            });
        }

        console.log('🤖 CRON JOB: Auto-create payroll runs triggered');

        const result = await PayrollRunService.autoCreateMonthlyPayrollRuns();

        res.json({
            success: true,
            message: 'Auto-create process completed',
            data: result
        });
    })
);

/**
 * GET /api/payroll-runs/:runId/employee/:employeeId/daily-details
 * Get daily work details (working mins and salary) for an employee in a payroll run
 */
router.get('/:runId/employee/:employeeId/daily-details',
    checkPermission('payroll.view'),
    [
        param('runId').isUUID().withMessage('Valid run ID is required'),
        param('employeeId').isUUID().withMessage('Valid employee ID is required')
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

        const { runId, employeeId } = req.params;
        const clientId = req.user.clientId;

        try {
            const dailyDetails = await PayrollRunService.getEmployeeDailyWorkDetails(runId, employeeId, clientId);

            res.json({
                success: true,
                data: dailyDetails
            });
        } catch (error) {
            console.error('Error fetching employee daily details:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch employee daily work details'
            });
        }
    })
);

router.get("/live/all",
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientId = req.user.clientId;
    const { month, year, page = 1, limit = 20 } = req.query;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get paginated employees
    const [employees] = await db.execute(
      `SELECT id, first_name, last_name, in_time, out_time, weekend_working_config, base_salary
       FROM employees
       WHERE client_id = ?
       ORDER BY first_name, last_name
       LIMIT ? OFFSET ?`,
      [clientId, parseInt(limit), offset]
    );

    if (employees.length === 0) {
      return res.json({ success: true, data: [], page: parseInt(page), limit: parseInt(limit), total: 0 });
    }

    const results = [];

    for (const emp of employees) {
      const weekendConfig = JSON.parse(emp.weekend_working_config);

      // Attendance stats
      // NOTE: payable_duration is stored in MINUTES, divide by 60 to get hours
      const [attendanceRows] = await db.execute(
        `SELECT is_weekend, SUM(payable_duration) / 60 AS total_payable, COUNT(*) AS days
         FROM attendance
         WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
         GROUP BY is_weekend`,
        [emp.id, month, year]
      );

      // Last active check-in
      const [activeCheckInRows] = await db.execute(
        `SELECT check_in_time
         FROM attendance
         WHERE employee_id = ? AND check_out_time IS NULL
         ORDER BY date DESC, check_in_time DESC
         LIMIT 1`,
        [emp.id]
      );

      let last_check_in_time = activeCheckInRows.length > 0 ? activeCheckInRows[0].check_in_time : null;

      // Build live data
      let liveData = {
        empid: emp.id,
        month: parseInt(month),
        year: parseInt(year),
        base_salary: emp.base_salary ?? 0,
        weekdays_of_month: 0,
        saturdays_of_month: 0,
        sundays_of_month: 0,
        is_over_time_paid: false,
        is_sunday_workday: weekendConfig.sunday.working,
        is_saturday_workday: weekendConfig.saturday.working,
        ïs_fullday_salary_sunday: weekendConfig.sunday.full_day_salary,
        ïs_fullday_salary_satuday: weekendConfig.saturday.full_day_salary,
        weekday_shedule_in_time: emp.in_time,
        weekday_shedule_out_time: emp.out_time,
        saturday_shedule_in_time: weekendConfig.saturday.in_time,
        saturday_shedule_out_time: weekendConfig.saturday.out_time,
        sunday_shedule_in_time: weekendConfig.sunday.in_time,
        sunday_shedule_out_time: weekendConfig.sunday.out_time,
        overtime_hours: 0,
        sum_of_weekday_payable_hours: 0,
        sum_of_saturday_payable_hours: 0,
        sum_of_sunday_payable_hours: 0,
        last_check_in_time
      };

      // Fill attendance stats
      attendanceRows.forEach(row => {
        const totalHours = Number(row.total_payable) || 0;
        const days = Number(row.days) || 0;

        if (row.is_weekend === 1) { // Sunday
          liveData.sundays_of_month = days;
          liveData.sum_of_sunday_payable_hours = totalHours;
        } else if (row.is_weekend === 7) { // Saturday
          liveData.saturdays_of_month = days;
          liveData.sum_of_saturday_payable_hours = totalHours;
        } else {
          liveData.weekdays_of_month += days;
          liveData.sum_of_weekday_payable_hours += totalHours;
        }
      });

      results.push({
        employee: { id: emp.id, name: `${emp.first_name} ${emp.last_name}` },
        live: liveData
      });
    }

    // Get total employee count
    const [totalCountRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM employees WHERE client_id = ?`,
      [clientId]
    );

    res.json({
      success: true,
      data: results,
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCountRows[0].total
    });
  })
);

// =============================================
// PAYROLL CYCLE REPORTING ENDPOINTS
// =============================================

/**
 * GET /api/payroll-runs/:id/period-groups
 * Get unique period groups in a payroll run
 * Shows which employees have custom cycles vs default cycles
 */
router.get('/:id/period-groups',
  checkPermission('payroll.view'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const PayrollCycleService = require('../services/PayrollCycleService');

    // Verify run exists and user has access
    const db = getDB();
    const [runs] = await db.execute(`
      SELECT id FROM payroll_runs
      WHERE id = ? AND client_id = ?
    `, [id, req.user.client_id]);

    if (!runs || runs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payroll run not found'
      });
    }

    // Get period groups
    const periodGroups = await PayrollCycleService.getUniquePeriodGroups(id);

    // Get summary statistics
    const summary = await PayrollCycleService.getRunCycleSummary(id);

    res.json({
      success: true,
      data: {
        periodGroups,
        summary: {
          totalEmployees: summary.total_employees,
          customCycleCount: summary.custom_cycle_count,
          defaultCycleCount: summary.default_cycle_count,
          uniqueStartDates: summary.unique_start_dates,
          uniqueEndDates: summary.unique_end_dates
        }
      }
    });
  })
);

module.exports = router;
