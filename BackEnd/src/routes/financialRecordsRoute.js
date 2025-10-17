const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const approvalWorkflowService = require('../services/ApprovalWorkflowService');
const { getDB } = require('../config/database');

// Apply authentication and client validation middleware
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// TEST ENDPOINT
// =============================================

/**
 * Test endpoint to check if financial records API is working
 * GET /api/employees/financial-test
 */
router.get('/financial-test', async (req, res) => {
  try {
    const connection = getDB();

    // Test database connection
    const [result] = await connection.execute('SELECT 1 as test');

    // Check if employee_loans table exists
    const [tableCheck] = await connection.execute('SHOW TABLES LIKE "employee_loans"');

    res.json({
      success: true,
      message: 'Financial records API is working',
      data: {
        database_connection: 'OK',
        employee_loans_table: tableCheck.length > 0 ? 'EXISTS' : 'NOT_FOUND',
        test_query_result: result[0]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Financial records API test failed',
      error: error.message
    });
  }
});

// =============================================
// EMPLOYEE LOANS API ENDPOINTS
// =============================================

/**
 * Create new employee loan
 * POST /api/employees/loans
 */
router.post('/loans', async (req, res) => {
  let connection;
  try {
    const {
      employee_id,
      type,
      amount,
      description,
      loan_type,
      interest_rate,
      tenure_months,
      start_date,
      notes,
      created_by
    } = req.body;

    // Validate required fields
    if (!employee_id || !amount || !description || !tenure_months) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, amount, description, and tenure are required'
      });
    }

    connection = getDB();
    const loanId = uuidv4();
    const clientId = req.user.clientId;

    // Calculate monthly deduction (simple calculation)
    const principal = parseFloat(amount);
    const months = parseInt(tenure_months);
    const rate = parseFloat(interest_rate) || 0;

    // Calculate EMI with interest
    const monthlyRate = rate / (12 * 100);
    let monthlyDeduction;

    if (rate > 0) {
      monthlyDeduction = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
                        (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      monthlyDeduction = principal / months;
    }

    const totalAmount = monthlyDeduction * months;
    const endDate = new Date(start_date);
    endDate.setMonth(endDate.getMonth() + months);

    // Insert loan record
    await connection.execute(`
      INSERT INTO employee_loans (
        id, employee_id, loan_type, loan_amount, interest_rate,
        tenure_months, monthly_deduction, total_paid, remaining_amount,
        start_date, end_date, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      loanId, employee_id, loan_type || 'personal', principal, rate,
      months, monthlyDeduction, 0, totalAmount,
      start_date, endDate.toISOString().split('T')[0], 'active', notes || null
    ]);

    console.log('✅ Loan created successfully:', loanId);

    res.status(201).json({
      success: true,
      message: 'Loan request created successfully',
      data: {
        loan_id: loanId,
        monthly_deduction: monthlyDeduction,
        total_amount: totalAmount,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('❌ Error creating loan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create loan request',
      error: error.message
    });
  }
});

/**
 * Get all financial records for an employee
 * GET /api/employees/:employee_id/financial-records
 */
router.get('/:employee_id/financial-records', async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { type } = req.query; // Optional filter by type
    const connection = getDB();

    let financialRecords = [];

    // Get loans if requested or if no type filter
    if (!type || type === 'loan') {
      const [loans] = await connection.execute(`
        SELECT
          el.id,
          'loan' as type,
          el.loan_amount as amount,
          el.loan_type,
          el.interest_rate,
          el.tenure_months,
          el.monthly_deduction,
          el.remaining_amount,
          el.start_date,
          el.end_date,
          el.status,
          el.notes,
          el.created_at,
          CONCAT('Loan - ', UPPER(SUBSTRING(el.loan_type, 1, 1)), SUBSTRING(el.loan_type, 2)) as description,
          e.first_name,
          e.last_name,
          e.employee_code
        FROM employee_loans el
        JOIN employees e ON el.employee_id = e.id
        WHERE el.employee_id = ?
        ORDER BY el.created_at DESC
      `, [employee_id]);
      financialRecords = [...financialRecords, ...loans];
    }

    // Get advances if requested or if no type filter
    if (!type || type === 'advance') {
      const [advances] = await connection.execute(`
        SELECT
          ea.id,
          'advance' as type,
          ea.advance_amount as amount,
          ea.advance_type,
          ea.deduction_months,
          ea.monthly_deduction,
          ea.remaining_amount,
          ea.request_date,
          ea.required_date,
          ea.deduction_start_date,
          ea.status,
          ea.justification,
          ea.notes,
          ea.created_at,
          ea.description,
          e.first_name,
          e.last_name,
          e.employee_code
        FROM employee_advances ea
        JOIN employees e ON ea.employee_id = e.id
        WHERE ea.employee_id = ?
        ORDER BY ea.created_at DESC
      `, [employee_id]);
      financialRecords = [...financialRecords, ...advances];
    }

    // Get bonuses if requested or if no type filter
    if (!type || type === 'bonus') {
      const [bonuses] = await connection.execute(`
        SELECT
          eb.id,
          'bonus' as type,
          eb.bonus_amount as amount,
          eb.bonus_type,
          eb.bonus_period,
          eb.calculation_basis,
          eb.effective_date,
          eb.payment_date,
          eb.payment_method,
          eb.status,
          eb.notes,
          eb.created_at,
          eb.description,
          e.first_name,
          e.last_name,
          e.employee_code
        FROM employee_bonuses eb
        JOIN employees e ON eb.employee_id = e.id
        WHERE eb.employee_id = ?
        ORDER BY eb.created_at DESC
      `, [employee_id]);
      financialRecords = [...financialRecords, ...bonuses];
    }

    // Sort all records by creation date
    financialRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: financialRecords,
      summary: {
        total_records: financialRecords.length,
        loans: financialRecords.filter(r => r.type === 'loan').length,
        advances: financialRecords.filter(r => r.type === 'advance').length,
        bonuses: financialRecords.filter(r => r.type === 'bonus').length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching financial records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial records',
      error: error.message
    });
  }
});

/**
 * Get employee loans specifically
 * GET /api/employees/:employee_id/loans
 */
router.get('/:employee_id/loans', async (req, res) => {
  try {
    const { employee_id } = req.params;
    const connection = getDB();

    const [loans] = await connection.execute(`
      SELECT
        el.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_loans el
      JOIN employees e ON el.employee_id = e.id
      WHERE el.employee_id = ?
      ORDER BY el.created_at DESC
    `, [employee_id]);

    res.json({
      success: true,
      data: loans
    });

  } catch (error) {
    console.error('❌ Error fetching loans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loans',
      error: error.message
    });
  }
});

/**
 * Get employee advances specifically
 * GET /api/employees/:employee_id/advances
 */
router.get('/:employee_id/advances', async (req, res) => {
  try {
    const { employee_id } = req.params;
    const connection = getDB();

    const [advances] = await connection.execute(`
      SELECT
        ea.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_advances ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.employee_id = ?
      ORDER BY ea.created_at DESC
    `, [employee_id]);

    res.json({
      success: true,
      data: advances
    });

  } catch (error) {
    console.error('❌ Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advances',
      error: error.message
    });
  }
});

/**
 * Get employee bonuses specifically
 * GET /api/employees/:employee_id/bonuses
 */
router.get('/:employee_id/bonuses', async (req, res) => {
  try {
    const { employee_id } = req.params;
    const connection = getDB();

    const [bonuses] = await connection.execute(`
      SELECT
        eb.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_bonuses eb
      JOIN employees e ON eb.employee_id = e.id
      WHERE eb.employee_id = ?
      ORDER BY eb.created_at DESC
    `, [employee_id]);

    res.json({
      success: true,
      data: bonuses
    });

  } catch (error) {
    console.error('❌ Error fetching bonuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bonuses',
      error: error.message
    });
  }
});

// =============================================
// ADVANCE PAYMENTS API ENDPOINTS
// =============================================

/**
 * Create advance payment request
 * POST /api/employees/advances
 */
router.post('/advances', async (req, res) => {
  let connection;
  try {
    const {
      employee_id,
      amount,
      description,
      advance_type = 'salary',
      deduction_months = 1,
      required_date,
      justification,
      notes,
      created_by
    } = req.body;

    // Validate required fields
    if (!employee_id || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, amount, and description are required'
      });
    }

    connection = getDB();
    const advanceId = uuidv4();
    const clientId = req.user.clientId;

    // Calculate monthly deduction
    const advanceAmount = parseFloat(amount);
    const months = parseInt(deduction_months);
    const monthlyDeduction = advanceAmount / months;
    const requestDate = new Date().toISOString().split('T')[0];
    const deductionStartDate = new Date();
    deductionStartDate.setMonth(deductionStartDate.getMonth() + 1); // Start next month

    // Insert into dedicated employee_advances table
    await connection.execute(`
      INSERT INTO employee_advances (
        id, employee_id, advance_type, advance_amount, description,
        request_date, required_date, deduction_start_date, deduction_months,
        monthly_deduction, remaining_amount, status, justification,
        notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, NOW())
    `, [
      advanceId, employee_id, advance_type, advanceAmount, description,
      requestDate, required_date || null, deductionStartDate.toISOString().split('T')[0],
      months, monthlyDeduction, advanceAmount, justification || null, notes || null, req.user.userId || null
    ]);

    console.log('✅ Advance request created successfully:', advanceId);

    res.status(201).json({
      success: true,
      message: 'Advance payment request created successfully',
      data: {
        advance_id: advanceId,
        amount: advanceAmount,
        monthly_deduction: monthlyDeduction,
        deduction_months: months,
        status: 'approved'
      }
    });

  } catch (error) {
    console.error('❌ Error creating advance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create advance request',
      error: error.message
    });
  }
});

// =============================================
// BONUS PAYMENTS API ENDPOINTS
// =============================================

/**
 * Create bonus record
 * POST /api/employees/bonuses
 */
router.post('/bonuses', async (req, res) => {
  let connection;
  try {
    const {
      employee_id,
      amount,
      description,
      bonus_type = 'performance',
      bonus_period,
      effective_date,
      payment_method = 'next_payroll',
      calculation_basis,
      notes,
      created_by
    } = req.body;

    // Validate required fields
    if (!employee_id || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, amount, and description are required'
      });
    }

    connection = getDB();
    const bonusId = uuidv4();
    const clientId = req.user.clientId;
    const bonusAmount = parseFloat(amount);
    const effectiveDate = effective_date || new Date().toISOString().split('T')[0];

    // Insert into dedicated employee_bonuses table
    await connection.execute(`
      INSERT INTO employee_bonuses (
        id, employee_id, bonus_type, bonus_amount, description,
        bonus_period, calculation_basis, effective_date, status,
        payment_method, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, NOW())
    `, [
      bonusId, employee_id, bonus_type, bonusAmount, description,
      bonus_period || null, calculation_basis || null, effectiveDate, payment_method,
      notes || null, req.user.id || null
    ]);

    console.log('✅ Bonus record created successfully:', bonusId);

    res.status(201).json({
      success: true,
      message: 'Bonus payment created successfully',
      data: {
        bonus_id: bonusId,
        amount: bonusAmount,
        bonus_type,
        effective_date: effectiveDate,
        status: 'approved'
      }
    });

  } catch (error) {
    console.error('❌ Error creating bonus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bonus record',
      error: error.message
    });
  }
});

// =============================================
// APPROVAL WORKFLOW ENDPOINTS
// =============================================

/**
 * Get pending approvals for current user
 * GET /api/employees/financial-records/approvals
 */
router.get('/financial-records/approvals', async (req, res) => {
  try {
    const connection = getDB();
    const pendingApprovals = await approvalWorkflowService.getPendingApprovals(req.user.id);

    res.json({
      success: true,
      data: pendingApprovals
    });

  } catch (error) {
    console.error('❌ Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message
    });
  }
});

/**
 * Approve or reject advance request directly
 * POST /api/employees/advances/:advance_id/approve
 */
router.post('/advances/:advance_id/approve', async (req, res) => {
  try {
    const { advance_id } = req.params;
    const { action, comments } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be "approve" or "reject"'
      });
    }

    const connection = getDB();

    // Check if advance exists and is pending
    const [advance] = await connection.execute(`
      SELECT * FROM employee_advances
      WHERE id = ? AND status = 'pending'
    `, [advance_id]);

    if (advance.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found or not pending approval'
      });
    }

    // Update advance status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const approverField = action === 'approve' ? 'approved_by' : 'rejected_by';
    const dateField = action === 'approve' ? 'approved_at' : 'rejected_at';

    await connection.execute(`
      UPDATE employee_advances
      SET status = ?, ${approverField} = ?, ${dateField} = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [newStatus, req.user.id, advance_id]);

    console.log(`✅ Advance ${advance_id} ${action}d by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Advance request ${action}d successfully`,
      data: {
        advance_id: advance_id,
        status: newStatus,
        action: action,
        approved_by: req.user.id,
        comments: comments
      }
    });

  } catch (error) {
    console.error('❌ Error processing advance approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process advance approval',
      error: error.message
    });
  }
});

/**
 * Approve or reject financial record (Legacy - for workflow-based approvals)
 * POST /api/employees/financial-records/:record_id/approve
 */
router.post('/financial-records/:record_id/approve', async (req, res) => {
  try {
    const { record_id } = req.params;
    const { action, comments } = req.body; // action: 'approve' or 'reject'

    const connection = getDB();
    const result = await approvalWorkflowService.processApproval({
      workflow_id: record_id,
      approver_id: req.user.id,
      action,
      comments
    });

    res.json({
      success: true,
      message: `Financial record ${action}d successfully`,
      data: result
    });

  } catch (error) {
    console.error('❌ Error processing approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approval',
      error: error.message
    });
  }
});

// =============================================
// DELETE ENDPOINTS
// =============================================

/**
 * Delete a loan record
 * DELETE /api/employees/loans/:loan_id
 */
router.delete('/loans/:loan_id', checkPermission('payroll.edit'), async (req, res) => {
  try {
    const { loan_id } = req.params;
    const connection = getDB();

    // Check if loan exists
    const [loan] = await connection.execute(
      'SELECT * FROM employee_loans WHERE id = ?',
      [loan_id]
    );

    if (loan.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Delete the loan
    await connection.execute(
      'DELETE FROM employee_loans WHERE id = ?',
      [loan_id]
    );

    console.log('✅ Loan deleted successfully:', loan_id);

    res.json({
      success: true,
      message: 'Loan deleted successfully',
      data: { loan_id }
    });

  } catch (error) {
    console.error('❌ Error deleting loan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete loan',
      error: error.message
    });
  }
});

/**
 * Delete an advance record
 * DELETE /api/employees/advances/:advance_id
 */
router.delete('/advances/:advance_id', checkPermission('payroll.edit'), async (req, res) => {
  try {
    const { advance_id } = req.params;
    const connection = getDB();

    // Check if advance exists
    const [advance] = await connection.execute(
      'SELECT * FROM employee_advances WHERE id = ?',
      [advance_id]
    );

    if (advance.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    // Delete the advance
    await connection.execute(
      'DELETE FROM employee_advances WHERE id = ?',
      [advance_id]
    );

    console.log('✅ Advance deleted successfully:', advance_id);

    res.json({
      success: true,
      message: 'Advance deleted successfully',
      data: { advance_id }
    });

  } catch (error) {
    console.error('❌ Error deleting advance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete advance',
      error: error.message
    });
  }
});

/**
 * Delete a bonus record
 * DELETE /api/employees/bonuses/:bonus_id
 */
router.delete('/bonuses/:bonus_id', checkPermission('payroll.edit'), async (req, res) => {
  try {
    const { bonus_id } = req.params;
    const connection = getDB();

    // Check if bonus exists
    const [bonus] = await connection.execute(
      'SELECT * FROM employee_bonuses WHERE id = ?',
      [bonus_id]
    );

    if (bonus.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bonus not found'
      });
    }

    // Delete the bonus
    await connection.execute(
      'DELETE FROM employee_bonuses WHERE id = ?',
      [bonus_id]
    );

    console.log('✅ Bonus deleted successfully:', bonus_id);

    res.json({
      success: true,
      message: 'Bonus deleted successfully',
      data: { bonus_id }
    });

  } catch (error) {
    console.error('❌ Error deleting bonus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bonus',
      error: error.message
    });
  }
});

module.exports = router;