// =============================================
// PAYROLL RUN DASHBOARD - INDUSTRY STANDARD UI
// =============================================
// Modern payroll management dashboard with run-based operations
// Replaces individual record management with batch processing workflow

import React, { useState, useEffect } from 'react';
import { TextInput, Button, Select, Badge, Modal, Table, Alert, Card } from "flowbite-react";
import { payrollRunApiService, PayrollRun, PayrollRunFilters } from '../../services/payrollRunService';
import { HiPlus, HiPlay, HiEye, HiCheck, HiX, HiCreditCard, HiDocumentReport } from 'react-icons/hi';

const PayrollRunDashboard = () => {
  // =============================================
  // STATE MANAGEMENT
  // =============================================
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Data States
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [runSummary, setRunSummary] = useState<any>(null);
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  // Filter States
  const [filters, setFilters] = useState<PayrollRunFilters>({
    status: 'all',
    limit: 20,
    offset: 0
  });
  
  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRunDetailsModal, setShowRunDetailsModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  
  // Form States
  const [createRunForm, setCreateRunForm] = useState({
    period_id: '',
    run_name: '',
    run_type: 'regular' as 'regular' | 'bonus' | 'correction' | 'off-cycle',
    calculation_method: 'advanced' as 'simple' | 'advanced',
    employee_filters: {
      department_id: '',
      employee_type: ''
    },
    notes: ''
  });
  
  const [approvalForm, setApprovalForm] = useState({
    approval_level: 'review' as 'review' | 'approve',
    comments: ''
  });
  
  const [processForm, setProcessForm] = useState({
    payment_method: 'bank_transfer' as 'bank_transfer' | 'cash' | 'cheque',
    payment_date: new Date().toISOString().split('T')[0],
    batch_reference: ''
  });

  // =============================================
  // LIFECYCLE & DATA LOADING
  // =============================================
  
  useEffect(() => {
    loadPayrollRuns();
    loadPendingApprovals();
    loadAvailablePeriods();
    loadDepartments();
  }, [filters]);

  useEffect(() => {
    // Clear messages after 5 seconds
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const loadPayrollRuns = async () => {
    try {
      setLoading(true);
      const response = await payrollRunApiService.getPayrollRuns(filters);
      
      if (response.success) {
        setPayrollRuns(response.data || []);
      } else {
        setError('Failed to load payroll runs');
        setPayrollRuns([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll runs');
      setPayrollRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const response = await payrollRunApiService.getPendingApprovals();
      if (response.success) {
        setPendingApprovals(response.data || []);
      } else {
        setPendingApprovals([]);
      }
    } catch (err) {
      console.warn('Failed to load pending approvals:', err);
      setPendingApprovals([]);
    }
  };

  const loadAvailablePeriods = async () => {
    try {
      const response = await payrollRunApiService.getAvailablePeriods();
      if (response.success) {
        setAvailablePeriods(response.data || []);
      } else {
        setAvailablePeriods([]);
      }
    } catch (err) {
      console.warn('Failed to load payroll periods:', err);
      setAvailablePeriods([]);
    }
  };

  const loadDepartments = async () => {
    try {
      // You'll need to add this to your API service or use existing employee API
      // For now, we'll create a simple fallback
      setDepartments([
        { id: '', name: 'All Departments' },
        { id: 'hr', name: 'Human Resources' },
        { id: 'it', name: 'Information Technology' },
        { id: 'finance', name: 'Finance' },
        { id: 'sales', name: 'Sales' }
      ]);
    } catch (err) {
      console.warn('Failed to load departments:', err);
    }
  };

  // =============================================
  // PAYROLL RUN OPERATIONS
  // =============================================
  
  const handleCreateRun = async () => {
    try {
      setLoading(true);
      
      // Clean the form data - remove empty optional fields
      const cleanFormData: any = {
        period_id: createRunForm.period_id,
        run_name: createRunForm.run_name,
        run_type: createRunForm.run_type,
        calculation_method: createRunForm.calculation_method
      };
      
      // Only add employee_filters if they have values
      const filters: any = {};
      if (createRunForm.employee_filters.department_id) {
        filters.department_id = createRunForm.employee_filters.department_id;
      }
      if (createRunForm.employee_filters.employee_type) {
        filters.employee_type = createRunForm.employee_filters.employee_type;
      }
      
      // Only add employee_filters object if it has properties
      if (Object.keys(filters).length > 0) {
        cleanFormData.employee_filters = filters;
      }
      
      // Only add notes if not empty
      if (createRunForm.notes.trim()) {
        cleanFormData.notes = createRunForm.notes.trim();
      }
      
      const response = await payrollRunApiService.createPayrollRun(cleanFormData);
      
      if (response.success) {
        setSuccessMessage(`Payroll run created successfully with ${response.data.total_employees} employees`);
        setShowCreateModal(false);
        resetCreateForm();
        loadPayrollRuns();
      } else {
        setError(response.message || 'Failed to create payroll run');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create payroll run');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateRun = async (runId: string) => {
    try {
      setLoading(true);
      const response = await payrollRunApiService.calculatePayrollRun(runId);
      
      if (response.success) {
        setSuccessMessage(`Payroll calculated successfully. Processed ${response.data.processed_records} records.`);
        loadPayrollRuns();
      } else {
        setError(response.message || 'Failed to calculate payroll');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRun = async () => {
    if (!selectedRun) return;
    
    try {
      setLoading(true);
      const response = await payrollRunApiService.approvePayrollRun(selectedRun.id, approvalForm);
      
      if (response.success) {
        setSuccessMessage(`Payroll run ${approvalForm.approval_level}ed successfully`);
        setShowApprovalModal(false);
        loadPayrollRuns();
        loadPendingApprovals();
      } else {
        setError(response.message || 'Failed to approve payroll run');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve payroll run');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRun = async () => {
    if (!selectedRun) return;
    
    try {
      setLoading(true);
      const response = await payrollRunApiService.processPayrollRun(selectedRun.id, processForm);
      
      if (response.success) {
        setSuccessMessage(`Payment processing completed for ${response.data.records_processed} records`);
        setShowProcessModal(false);
        loadPayrollRuns();
      } else {
        setError(response.message || 'Failed to process payments');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process payments');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // UI HELPERS
  // =============================================
  
  const resetCreateForm = () => {
    setCreateRunForm({
      period_id: '',
      run_name: '',
      run_type: 'regular',
      calculation_method: 'advanced',
      employee_filters: {
        department_id: '',
        employee_type: ''
      },
      notes: ''
    });
  };

  const openRunDetails = async (run: PayrollRun) => {
    setSelectedRun(run);
    try {
      const [summaryResponse, workflowResponse] = await Promise.all([
        payrollRunApiService.getRunSummary(run.id),
        payrollRunApiService.getWorkflowStatus(run.id)
      ]);
      
      if (summaryResponse.success) {
        setRunSummary(summaryResponse.data);
      }
      
      if (workflowResponse.success) {
        setWorkflowStatus(workflowResponse.data);
      }
      
      setShowRunDetailsModal(true);
    } catch (err) {
      console.warn('Failed to load run details:', err);
      setShowRunDetailsModal(true);
    }
  };

  const getActionButtons = (run: PayrollRun) => {
    const actions = payrollRunApiService.getAvailableActions(run);
    
    return actions.map(action => (
      <Button
        key={action.action}
        size="xs"
        color={action.color}
        onClick={() => handleAction(run, action.action)}
      >
        {getActionIcon(action.action)} {action.label}
      </Button>
    ));
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, JSX.Element> = {
      'calculate': <HiPlay className="w-3 h-3 mr-1" />,
      'review': <HiEye className="w-3 h-3 mr-1" />,
      'approve': <HiCheck className="w-3 h-3 mr-1" />,
      'process': <HiCreditCard className="w-3 h-3 mr-1" />,
      'cancel': <HiX className="w-3 h-3 mr-1" />
    };
    
    return icons[action] || null;
  };

  const handleAction = (run: PayrollRun, action: string) => {
    setSelectedRun(run);
    
    switch (action) {
      case 'calculate':
        handleCalculateRun(run.id);
        break;
      case 'review':
        setApprovalForm({ approval_level: 'review', comments: '' });
        setShowApprovalModal(true);
        break;
      case 'approve':
        setApprovalForm({ approval_level: 'approve', comments: '' });
        setShowApprovalModal(true);
        break;
      case 'process':
        setShowProcessModal(true);
        break;
      case 'cancel':
        // Implement cancel logic
        break;
    }
  };

  // =============================================
  // RENDER COMPONENT
  // =============================================
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Payroll Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Industry-standard batch payroll processing with approval workflows
          </p>
        </div>
        
        <Button color="blue" onClick={() => setShowCreateModal(true)}>
          <HiPlus className="w-4 h-4 mr-2" />
          Create Payroll Run
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert color="success" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Pending Approvals Card */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">⚠️ Pending Approvals</h3>
            <Badge color="warning">{pendingApprovals?.length || 0}</Badge>
          </div>
          
          <div className="space-y-2">
            {pendingApprovals.slice(0, 3).map((approval, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <div className="font-medium">{approval.run_name}</div>
                  <div className="text-sm text-gray-600">
                    {approval.step_title} • {approval.total_employees} employees • 
                    Pending for {approval.hours_pending}h
                  </div>
                </div>
                <Button size="xs" color="yellow">
                  Review
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            value={filters.status || 'all'}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="calculated">Calculated</option>
            <option value="review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
          </Select>

          <Select
            value={filters.run_type || ''}
            onChange={(e) => setFilters({ ...filters, run_type: e.target.value as any })}
          >
            <option value="">All Types</option>
            <option value="regular">Regular</option>
            <option value="bonus">Bonus</option>
            <option value="correction">Correction</option>
            <option value="off-cycle">Off-cycle</option>
          </Select>

          <Select
            value={filters.limit || 20}
            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
          >
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
          </Select>

          <Button color="gray" onClick={loadPayrollRuns}>
            🔄 Refresh
          </Button>
        </div>
      </Card>

      {/* Payroll Runs Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Run Details</Table.HeadCell>
              <Table.HeadCell>Period</Table.HeadCell>
              <Table.HeadCell>Employees</Table.HeadCell>
              <Table.HeadCell>Total Amount</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Created</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {loading ? (
                <Table.Row>
                  <Table.Cell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading payroll runs...</span>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ) : !payrollRuns || payrollRuns.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={7} className="text-center py-8 text-gray-500">
                    No payroll runs found. Create your first payroll run to get started.
                  </Table.Cell>
                </Table.Row>
              ) : (
                (payrollRuns || []).map((run) => (
                  <Table.Row key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                    <Table.Cell>
                      <div>
                        <div className="font-medium">{run.run_name}</div>
                        <div className="text-sm text-gray-500">
                          {run.run_number} • {run.run_type}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <div>{payrollRunApiService.formatDate(run.period_start_date)}</div>
                        <div className="text-gray-500">
                          to {payrollRunApiService.formatDate(run.period_end_date)}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <div className="font-medium">{run.total_employees}</div>
                        <div className="text-sm text-gray-500">
                          {run.processed_employees} processed
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="font-medium">
                        {payrollRunApiService.formatCurrency(run.total_net_amount)}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={payrollRunApiService.getRunStatusColor(run.run_status)}>
                        {payrollRunApiService.getRunStatusIcon(run.run_status)} {' '}
                        {payrollRunApiService.getRunStatusText(run.run_status)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <div>{payrollRunApiService.formatDate(run.created_at)}</div>
                        <div className="text-gray-500">{run.created_by_name}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="xs"
                          color="gray"
                          onClick={() => openRunDetails(run)}
                        >
                          <HiEye className="w-3 h-3 mr-1" />
                          Details
                        </Button>
                        {getActionButtons(run)}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Create Payroll Run Modal */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <Modal.Header>Create New Payroll Run</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payroll Period *</label>
              <Select
                value={createRunForm.period_id}
                onChange={(e) => setCreateRunForm({ ...createRunForm, period_id: e.target.value })}
                required
              >
                <option value="">Select a payroll period...</option>
                {availablePeriods && availablePeriods.length > 0 ? 
                  availablePeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.period_type} - {new Date(period.period_start_date).toLocaleDateString()} to {new Date(period.period_end_date).toLocaleDateString()}
                    </option>
                  )) : 
                  <option disabled>No periods available</option>
                }
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Run Name *</label>
              <TextInput
                value={createRunForm.run_name}
                onChange={(e) => setCreateRunForm({ ...createRunForm, run_name: e.target.value })}
                placeholder="e.g., January 2024 Regular Payroll"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Run Type</label>
                <Select
                  value={createRunForm.run_type}
                  onChange={(e) => setCreateRunForm({ ...createRunForm, run_type: e.target.value as any })}
                >
                  <option value="regular">Regular Payroll</option>
                  <option value="bonus">Bonus Payroll</option>
                  <option value="correction">Correction</option>
                  <option value="off-cycle">Off-cycle</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Calculation Method</label>
                <Select
                  value={createRunForm.calculation_method}
                  onChange={(e) => setCreateRunForm({ ...createRunForm, calculation_method: e.target.value as any })}
                >
                  <option value="advanced">Advanced (Progressive Tax)</option>
                  <option value="simple">Simple (Flat Tax)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Department Filter (Optional)</label>
                <Select
                  value={createRunForm.employee_filters.department_id}
                  onChange={(e) => setCreateRunForm({ 
                    ...createRunForm, 
                    employee_filters: { 
                      ...createRunForm.employee_filters, 
                      department_id: e.target.value 
                    } 
                  })}
                >
                  {departments && departments.length > 0 ? 
                    departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    )) :
                    <option value="">All Departments</option>
                  }
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Employee Type Filter (Optional)</label>
                <Select
                  value={createRunForm.employee_filters.employee_type}
                  onChange={(e) => setCreateRunForm({ 
                    ...createRunForm, 
                    employee_filters: { 
                      ...createRunForm.employee_filters, 
                      employee_type: e.target.value 
                    } 
                  })}
                >
                  <option value="">All Employee Types</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-md"
                rows={3}
                value={createRunForm.notes}
                onChange={(e) => setCreateRunForm({ ...createRunForm, notes: e.target.value })}
                placeholder="Optional notes about this payroll run..."
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">🏭 Industry Standard Workflow</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div>1. ✅ <strong>Create Run</strong> - Setup payroll batch with employees</div>
                <div>2. ⚙️ <strong>Calculate</strong> - Process all employee payroll calculations</div>
                <div>3. 👀 <strong>Review</strong> - HR reviews calculations and exceptions</div>
                <div>4. ✅ <strong>Approve</strong> - Manager approves payroll for processing</div>
                <div>5. 💳 <strong>Process</strong> - Finance processes payments to employees</div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button color="blue" onClick={handleCreateRun} disabled={!createRunForm.run_name || !createRunForm.period_id}>
            Create Payroll Run
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Other modals would go here... */}
      {/* For brevity, I'm not including all modal implementations */}
      {/* You would add: RunDetailsModal, ApprovalModal, ProcessModal */}

    </div>
  );
};

export default PayrollRunDashboard;