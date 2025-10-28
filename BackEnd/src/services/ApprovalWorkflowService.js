// =============================================
// APPROVAL WORKFLOW SERVICE - INDUSTRY STANDARD
// =============================================
// Manages multi-level approval workflows for payroll runs
// Supports configurable approval chains and role-based permissions

const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

class ApprovalWorkflowService {
    
    // =============================================
    // WORKFLOW CONFIGURATION
    // =============================================
    
    /**
     * Get approval workflow configuration for client
     */
    async getWorkflowConfig(clientId) {
        // Default 3-level approval workflow
        return {
            levels: [
                {
                    level: 1,
                    name: 'review',
                    title: 'HR Review',
                    description: 'HR team reviews payroll calculations',
                    required_role: 'payroll.review',
                    auto_advance: false,
                    timeout_hours: 24
                },
                {
                    level: 2,
                    name: 'approve',
                    title: 'Manager Approval',
                    description: 'Department manager approves payroll',
                    required_role: 'payroll.approve',
                    auto_advance: false,
                    timeout_hours: 48
                },
                {
                    level: 3,
                    name: 'process',
                    title: 'Finance Processing',
                    description: 'Finance team processes payments',
                    required_role: 'payroll.process',
                    auto_advance: false,
                    timeout_hours: 72
                }
            ],
            rules: {
                require_all_levels: true,
                allow_skip_levels: false,
                allow_rejection: true,
                require_comments_on_rejection: true
            }
        };
    }

    // =============================================
    // WORKFLOW MANAGEMENT
    // =============================================
    
    /**
     * Initialize approval workflow for payroll run
     */
    async initializeWorkflow(runId, clientId, initiatorId) {
        const db = getDB();
        const workflowConfig = await this.getWorkflowConfig(clientId);
        
        try {
            await db.execute('START TRANSACTION');

            // Create workflow instance
            const workflowId = uuidv4();
            await db.execute(`
                INSERT INTO approval_workflows (
                    id, run_id, client_id, status, current_level,
                    total_levels, initiated_by, created_at
                ) VALUES (?, ?, ?, 'active', 1, ?, ?, NOW())
            `, [workflowId, runId, clientId, workflowConfig.levels.length, initiatorId]);

            // Create approval steps
            for (let i = 0; i < workflowConfig.levels.length; i++) {
                const level = workflowConfig.levels[i];
                const stepId = uuidv4();
                
                await db.execute(`
                    INSERT INTO approval_steps (
                        id, workflow_id, step_level, step_name, step_title,
                        required_role, status, timeout_hours, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
                `, [
                    stepId, workflowId, level.level, level.name, level.title,
                    level.required_role, level.timeout_hours
                ]);

                // Set first step as active
                if (i === 0) {
                    await db.execute(
                        'UPDATE approval_steps SET status = "active" WHERE id = ?',
                        [stepId]
                    );
                }
            }

            await db.execute('COMMIT');

            return {
                workflow_id: workflowId,
                current_step: workflowConfig.levels[0],
                next_approvers: await this.getEligibleApprovers(clientId, workflowConfig.levels[0].required_role)
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Process approval action
     */
    async processApproval(runId, approverId, action, data = {}) {
        const {
            comments = '',
            approval_level,
            rejection_reason = null
        } = data;

        const db = getDB();
        
        try {
            await db.execute('START TRANSACTION');

            // Get current workflow state
            const [workflow] = await db.execute(`
                SELECT aw.*, pr.client_id
                FROM approval_workflows aw
                JOIN payroll_runs pr ON aw.run_id = pr.id
                WHERE aw.run_id = ? AND aw.status = 'active'
            `, [runId]);

            if (workflow.length === 0) {
                throw new Error('No active workflow found for this payroll run');
            }

            const workflowData = workflow[0];

            // Get current active step
            const [currentStep] = await db.execute(`
                SELECT * FROM approval_steps 
                WHERE workflow_id = ? AND status = 'active'
                ORDER BY step_level ASC LIMIT 1
            `, [workflowData.id]);

            if (currentStep.length === 0) {
                throw new Error('No active approval step found');
            }

            const step = currentStep[0];

            // Verify approver has permission
            const hasPermission = await this.verifyApproverPermission(
                approverId, 
                workflowData.client_id, 
                step.required_role
            );

            if (!hasPermission) {
                throw new Error('Insufficient permissions for this approval level');
            }

            // Record the approval/rejection
            const approvalId = uuidv4();
            await db.execute(`
                INSERT INTO payroll_approvals (
                    id, run_id, approval_level, approver_id,
                    approval_status, approval_date, comments
                ) VALUES (?, ?, ?, ?, ?, NOW(), ?)
            `, [
                approvalId, runId, step.step_name, approverId,
                action, comments
            ]);

            if (action === 'approved') {
                // Mark current step as approved
                await db.execute(`
                    UPDATE approval_steps 
                    SET status = 'approved', approved_by = ?, approved_at = NOW() 
                    WHERE id = ?
                `, [approverId, step.id]);

                // Check if this was the final step
                const [nextStep] = await db.execute(`
                    SELECT * FROM approval_steps 
                    WHERE workflow_id = ? AND step_level > ? AND status = 'pending'
                    ORDER BY step_level ASC LIMIT 1
                `, [workflowData.id, step.step_level]);

                if (nextStep.length > 0) {
                    // Activate next step
                    await db.execute(
                        'UPDATE approval_steps SET status = "active" WHERE id = ?',
                        [nextStep[0].id]
                    );

                    // Update workflow current level
                    await db.execute(
                        'UPDATE approval_workflows SET current_level = ? WHERE id = ?',
                        [nextStep[0].step_level, workflowData.id]
                    );

                    // Update payroll run status
                    const statusMap = {
                        'review': 'review',
                        'approve': 'approved',
                        'process': 'processing'
                    };
                    
                    await db.execute(
                        'UPDATE payroll_runs SET run_status = ? WHERE id = ?',
                        [statusMap[nextStep[0].step_name] || 'review', runId]
                    );

                } else {
                    // All steps completed
                    await db.execute(
                        'UPDATE approval_workflows SET status = "completed", completed_at = NOW() WHERE id = ?',
                        [workflowData.id]
                    );

                    await db.execute(
                        'UPDATE payroll_runs SET run_status = "approved" WHERE id = ?',
                        [runId]
                    );
                }

            } else if (action === 'rejected') {
                // Mark step and workflow as rejected
                await db.execute(`
                    UPDATE approval_steps 
                    SET status = 'rejected', approved_by = ?, approved_at = NOW() 
                    WHERE id = ?
                `, [approverId, step.id]);

                await db.execute(
                    'UPDATE approval_workflows SET status = "rejected", completed_at = NOW() WHERE id = ?',
                    [workflowData.id]
                );

                await db.execute(
                    'UPDATE payroll_runs SET run_status = "draft" WHERE id = ?',
                    [runId]
                );
            }

            // Log the action
            await this.logWorkflowAction(runId, approverId, action, {
                step_name: step.step_name,
                step_level: step.step_level,
                comments,
                rejection_reason
            });

            await db.execute('COMMIT');

            return {
                success: true,
                action,
                current_step: step.step_name,
                workflow_status: action === 'rejected' ? 'rejected' : 
                               (nextStep && nextStep.length > 0) ? 'in_progress' : 'completed'
            };

        } catch (error) {
            await db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Get workflow status for payroll run
     */
    async getWorkflowStatus(runId, clientId) {
        const db = getDB();
        
        const [workflow] = await db.execute(`
            SELECT 
                aw.*,
                pr.run_number, pr.run_name, pr.run_status,
                initiator.first_name as initiated_by_name
            FROM approval_workflows aw
            JOIN payroll_runs pr ON aw.run_id = pr.id
            LEFT JOIN admin_users au ON aw.initiated_by = au.id
            LEFT JOIN employees initiator ON au.employee_id = initiator.id
            WHERE aw.run_id = ? AND pr.client_id = ?
        `, [runId, clientId]);

        if (workflow.length === 0) {
            return null;
        }

        const workflowData = workflow[0];

        // Get all approval steps
        const [steps] = await db.execute(`
            SELECT 
                ast.*,
                approver.first_name as approved_by_name
            FROM approval_steps ast
            LEFT JOIN admin_users au ON ast.approved_by = au.id
            LEFT JOIN employees approver ON au.employee_id = approver.id
            WHERE ast.workflow_id = ?
            ORDER BY ast.step_level
        `, [workflowData.id]);

        // Get approval history
        const [approvals] = await db.execute(`
            SELECT 
                pa.*,
                approver.first_name as approver_name
            FROM payroll_approvals pa
            LEFT JOIN admin_users au ON pa.approver_id = au.id
            LEFT JOIN employees approver ON au.employee_id = approver.id
            WHERE pa.run_id = ?
            ORDER BY pa.approval_date
        `, [runId]);

        return {
            workflow: workflowData,
            steps,
            approvals,
            current_step: steps.find(s => s.status === 'active'),
            completed_steps: steps.filter(s => s.status === 'approved'),
            pending_steps: steps.filter(s => s.status === 'pending')
        };
    }

    // =============================================
    // HELPER METHODS
    // =============================================
    
    /**
     * Get eligible approvers for a role
     */
    async getEligibleApprovers(clientId, requiredRole) {
        const db = getDB();
        
        const [approvers] = await db.execute(`
            SELECT DISTINCT
                e.id, e.first_name, e.last_name, e.email,
                au.id as user_id, r.name as role
            FROM admin_users au
            JOIN employees e ON au.employee_id = e.id
            JOIN roles r ON au.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            JOIN permissions p ON p.name_id = p.id
            WHERE e.client_id = ? 
              AND p.name = ?
              AND au.is_active = 1
              AND e.employment_status = 'active'
              AND r.is_active = 1
              AND p.is_active = 1
        `, [clientId, requiredRole]);

        return approvers;
    }

    /**
     * Verify approver has required permission
     */
    async verifyApproverPermission(approverId, clientId, requiredRole) {
        const db = getDB();
        
        const [permission] = await db.execute(`
            SELECT 1
            FROM admin_users au
            JOIN employees e ON au.employee_id = e.id
            JOIN roles r ON au.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            JOIN permissions p ON p.name_id = p.id
            WHERE au.id = ? 
              AND e.client_id = ? 
              AND p.name = ?
              AND au.is_active = 1
              AND r.is_active = 1
              AND p.is_active = 1
        `, [approverId, clientId, requiredRole]);

        return permission.length > 0;
    }

    /**
     * Log workflow action for audit
     */
    async logWorkflowAction(runId, userId, action, metadata = {}) {
        const db = getDB();
        
        await db.execute(`
            INSERT INTO payroll_audit_log (
                id, run_id, action, user_id, new_value, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        `, [
            uuidv4(), runId, `workflow_${action}`, userId, 
            JSON.stringify(metadata)
        ]);
    }

    /**
     * Get pending approvals for user
     */
    async getPendingApprovalsForUser(userId, clientId) {
        const db = getDB();
        
        const [pendingApprovals] = await db.execute(`
            SELECT 
                pr.id as run_id, pr.run_number, pr.run_name,
                pr.total_employees, pr.total_net_amount,
                ast.step_name, ast.step_title, ast.timeout_hours,
                TIMESTAMPDIFF(HOUR, ast.created_at, NOW()) as hours_pending,
                pp.period_start_date, pp.period_end_date
            FROM approval_steps ast
            JOIN approval_workflows aw ON ast.workflow_id = aw.id
            JOIN payroll_runs pr ON aw.run_id = pr.id
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE ast.status = 'active'
              AND pr.client_id = ?
              AND EXISTS (
                  SELECT 1 FROM admin_users au
                  JOIN roles r ON au.role_id = r.id
                  JOIN role_permissions rp ON r.id = rp.role_id
                  JOIN permissions p ON rp.permission_id = p.id
                  WHERE au.id = ? AND p.name = ast.required_role
                  AND r.is_active = 1 AND p.is_active = 1
              )
            ORDER BY ast.created_at ASC
        `, [clientId, userId]);

        return pendingApprovals;
    }

    /**
     * Get approval history for payroll run
     */
    async getApprovalHistory(runId, clientId) {
        const db = getDB();
        
        const [history] = await db.execute(`
            SELECT 
                pa.approval_level, pa.approval_status, pa.approval_date, pa.comments,
                approver.first_name as approver_name,
                approver.email as approver_email
            FROM payroll_approvals pa
            JOIN admin_users au ON pa.approver_id = au.id
            JOIN employees approver ON au.employee_id = approver.id
            JOIN payroll_runs pr ON pa.run_id = pr.id
            WHERE pa.run_id = ? AND pr.client_id = ?
            ORDER BY pa.approval_date
        `, [runId, clientId]);

        return history;
    }

    /**
     * Check if user can approve specific run
     */
    async canUserApprove(userId, runId, clientId) {
        const db = getDB();
        
        const [canApprove] = await db.execute(`
            SELECT ast.step_name, ast.step_title
            FROM approval_steps ast
            JOIN approval_workflows aw ON ast.workflow_id = aw.id
            JOIN payroll_runs pr ON aw.run_id = pr.id
            WHERE pr.id = ? 
              AND pr.client_id = ?
              AND ast.status = 'active'
              AND EXISTS (
                  SELECT 1 FROM admin_users au
                  JOIN roles r ON au.role_id = r.id
                  JOIN role_permissions rp ON r.id = rp.role_id
                  JOIN permissions p ON rp.permission_id = p.id
                  WHERE au.id = ? AND p.name = ast.required_role
                  AND r.is_active = 1 AND p.is_active = 1
              )
        `, [runId, clientId, userId]);

        return {
            can_approve: canApprove.length > 0,
            current_step: canApprove.length > 0 ? canApprove[0] : null
        };
    }
}

module.exports = new ApprovalWorkflowService();