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
  const [employeeRecords, setEmployeeRecords] = useState<any[]>([]);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'summary' | 'employees'>('summary');
  
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  
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

  const [cancelForm, setCancelForm] = useState({
    cancellation_reason: ''
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
    setActiveDetailsTab('summary');
    try {
      const [summaryResponse, workflowResponse, recordsResponse] = await Promise.all([
        payrollRunApiService.getRunSummary(run.id),
        payrollRunApiService.getWorkflowStatus(run.id),
        payrollRunApiService.getPayrollRecords(run.id)
      ]);
      
      if (summaryResponse.success) {
        setRunSummary(summaryResponse.data);
      }
      
      if (workflowResponse.success) {
        setWorkflowStatus(workflowResponse.data);
      }

      if (recordsResponse.success) {
        setEmployeeRecords(recordsResponse.data);
      }
      
      setShowRunDetailsModal(true);
    } catch (err) {
      console.warn('Failed to load run details:', err);
      setShowRunDetailsModal(true);
    }
  };

  const handleApproval = async (run: PayrollRun, approvalLevel: 'review' | 'approve') => {
    setSelectedRun(run);
    setApprovalForm({ 
      approval_level: approvalLevel, 
      comments: '' 
    });
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!selectedRun) return;

    setLoading(true);
    setError(null);
    
    try {
      const result = await payrollRunApiService.approvePayrollRun(selectedRun.id, approvalForm);
      
      if (result.success) {
        setSuccessMessage(
          approvalForm.approval_level === 'review' 
            ? 'Payroll run submitted for review successfully' 
            : 'Payroll run approved successfully'
        );
        setShowApprovalModal(false);
        loadPayrollRuns(); // Refresh the list
      } else {
        setError(result.message || 'Failed to update payroll run');
      }
    } catch (err) {
      setError('Failed to update payroll run');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (run: PayrollRun) => {
    setSelectedRun(run);
    setProcessForm({
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      batch_reference: ''
    });
    setShowProcessModal(true);
  };

  const submitProcess = async () => {
    if (!selectedRun) return;

    setLoading(true);
    setError(null);
    
    try {
      const result = await payrollRunApiService.processPayrollRun(selectedRun.id, processForm);
      
      if (result.success) {
        setSuccessMessage(`Payroll run processed successfully. ${result.data.records_processed} records processed.`);
        setShowProcessModal(false);
        loadPayrollRuns(); // Refresh the list
      } else {
        setError(result.message || 'Failed to process payroll run');
      }
    } catch (err) {
      setError('Failed to process payroll run');
    } finally {
      setLoading(false);
    }
  };

  const submitCancel = async () => {
    if (!selectedRun) return;

    setLoading(true);
    setError(null);
    
    try {
      const result = await payrollRunApiService.cancelPayrollRun(selectedRun.id, cancelForm.cancellation_reason);
      
      if (result.success) {
        setSuccessMessage(`Payroll run cancelled successfully.`);
        setShowCancelModal(false);
        loadPayrollRuns(); // Refresh the list
      } else {
        setError(result.message || 'Failed to cancel payroll run');
      }
    } catch (err) {
      setError('Failed to cancel payroll run');
    } finally {
      setLoading(false);
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
        setCancelForm({ cancellation_reason: '' });
        setShowCancelModal(true);
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

      {/* Run Details Modal */}
      <Modal
        show={showRunDetailsModal}
        onClose={() => {
          setShowRunDetailsModal(false);
          setSelectedRun(null);
          setRunSummary(null);
          setWorkflowStatus(null);
          setEmployeeRecords([]);
          setActiveDetailsTab('summary');
        }}
        size="4xl"
      >
        <Modal.Header>
          Payroll Run Details - {selectedRun?.run_name}
        </Modal.Header>
        <Modal.Body>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveDetailsTab('summary')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeDetailsTab === 'summary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Summary & Statistics
              </button>
              <button
                onClick={() => setActiveDetailsTab('employees')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeDetailsTab === 'employees'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Employee Records ({employeeRecords.length})
              </button>
            </nav>
          </div>

          {/* Summary Tab */}
          {activeDetailsTab === 'summary' && runSummary && (
            <div className="space-y-6">
              {/* Run Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Run Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Run Number</span>
                    <p className="text-sm">{runSummary.run_info?.run_number}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Status</span>
                    <p className="text-sm">
                      <Badge color={
                        runSummary.run_info?.status === 'completed' ? 'success' :
                        runSummary.run_info?.status === 'calculated' ? 'info' :
                        runSummary.run_info?.status === 'draft' ? 'warning' : 'gray'
                      }>
                        {runSummary.run_info?.status?.toUpperCase()}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Pay Date</span>
                    <p className="text-sm">{runSummary.run_info?.period?.pay_date}</p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <span className="text-sm font-medium text-blue-600">Total Employees</span>
                    <p className="text-2xl font-bold text-blue-700">{runSummary.statistics?.total_employees}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <span className="text-sm font-medium text-green-600">Gross Amount</span>
                    <p className="text-2xl font-bold text-green-700">
                      Rs. {runSummary.statistics?.total_gross_amount?.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <span className="text-sm font-medium text-red-600">Deductions</span>
                    <p className="text-2xl font-bold text-red-700">
                      Rs. {runSummary.statistics?.total_deductions_amount?.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <span className="text-sm font-medium text-purple-600">Net Amount</span>
                    <p className="text-2xl font-bold text-purple-700">
                      Rs. {runSummary.statistics?.total_net_amount?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Workflow Status */}
              {workflowStatus?.workflow && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Workflow Status</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Created</span>
                        <p className="text-sm">
                          {new Date(workflowStatus.workflow.created_at).toLocaleString()} 
                          <br />by {workflowStatus.workflow.created_by}
                        </p>
                      </div>
                      {workflowStatus.workflow.approved_at && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Approved</span>
                          <p className="text-sm">
                            {new Date(workflowStatus.workflow.approved_at).toLocaleString()} 
                            <br />by {workflowStatus.workflow.approved_by}
                          </p>
                        </div>
                      )}
                      {workflowStatus.workflow.processed_at && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Processed</span>
                          <p className="text-sm">
                            {new Date(workflowStatus.workflow.processed_at).toLocaleString()} 
                            <br />by {workflowStatus.workflow.processed_by}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Employee Records Tab */}
          {activeDetailsTab === 'employees' && (
            <div className="space-y-4">
              {employeeRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Head>
                      <Table.HeadCell>Employee</Table.HeadCell>
                      <Table.HeadCell>Department</Table.HeadCell>
                      <Table.HeadCell>Base Salary</Table.HeadCell>
                      <Table.HeadCell>Gross Salary</Table.HeadCell>
                      <Table.HeadCell>Deductions</Table.HeadCell>
                      <Table.HeadCell>Net Salary</Table.HeadCell>
                      <Table.HeadCell>Status</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                      {employeeRecords.map((record) => (
                        <Table.Row key={record.id}>
                          <Table.Cell>
                            <div>
                              <div className="font-medium">{record.employee_name}</div>
                              <div className="text-sm text-gray-500">{record.employee_code}</div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div>
                              <div className="text-sm">{record.department_name}</div>
                              <div className="text-xs text-gray-500">{record.designation_name}</div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm">Rs. {record.base_salary?.toLocaleString()}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm font-medium">Rs. {record.gross_salary?.toLocaleString()}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-red-600">Rs. {record.total_deductions?.toLocaleString()}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm font-semibold text-green-600">Rs. {record.net_salary?.toLocaleString()}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge color={
                              record.calculation_status === 'calculated' ? 'success' :
                              record.calculation_status === 'pending' ? 'warning' :
                              record.calculation_status === 'error' ? 'failure' : 'gray'
                            }>
                              {record.calculation_status?.toUpperCase()}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                  
                  {/* Summary Row */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Total Employees:</span>
                        <span className="font-medium ml-2">{employeeRecords.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Gross:</span>
                        <span className="font-medium ml-2">Rs. {employeeRecords.reduce((sum, r) => sum + (r.gross_salary || 0), 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Deductions:</span>
                        <span className="font-medium ml-2 text-red-600">Rs. {employeeRecords.reduce((sum, r) => sum + (r.total_deductions || 0), 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Net:</span>
                        <span className="font-medium ml-2 text-green-600">Rs. {employeeRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No employee records found for this payroll run.</p>
                </div>
              )}
            </div>
          )}
          
          {!runSummary && activeDetailsTab === 'summary' && (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading payroll run details...</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowRunDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Approval Modal */}
      <Modal
        show={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedRun(null);
          setApprovalForm({ approval_level: 'review', comments: '' });
        }}
        size="md"
      >
        <Modal.Header>
          {approvalForm.approval_level === 'review' ? 'Submit for Review' : 'Approve Payroll Run'}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {selectedRun && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold">{selectedRun.run_name}</h4>
                <p className="text-sm text-gray-600">{selectedRun.run_number}</p>
                <p className="text-sm text-gray-600">
                  {selectedRun.total_employees} employees • Rs. {selectedRun.total_net_amount?.toLocaleString()}
                </p>
              </div>
            )}
            
            <div>
              <label htmlFor="approval-comments" className="block text-sm font-medium text-gray-700 mb-2">
                Comments (optional)
              </label>
              <textarea
                id="approval-comments"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  approvalForm.approval_level === 'review' 
                    ? 'Add any notes for the reviewer...' 
                    : 'Add approval comments...'
                }
                value={approvalForm.comments}
                onChange={(e) => setApprovalForm({ ...approvalForm, comments: e.target.value })}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowApprovalModal(false)}>
            Cancel
          </Button>
          <Button 
            color={approvalForm.approval_level === 'review' ? 'orange' : 'green'}
            onClick={submitApproval}
            disabled={loading}
          >
            {loading ? 'Processing...' : (
              approvalForm.approval_level === 'review' ? 'Submit for Review' : 'Approve Payroll'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Process Payment Modal */}
      <Modal
        show={showProcessModal}
        onClose={() => {
          setShowProcessModal(false);
          setSelectedRun(null);
          setProcessForm({
            payment_method: 'bank_transfer',
            payment_date: new Date().toISOString().split('T')[0],
            batch_reference: ''
          });
        }}
        size="md"
      >
        <Modal.Header>
          Process Payroll Payments
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {selectedRun && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold">{selectedRun.run_name}</h4>
                <p className="text-sm text-gray-600">{selectedRun.run_number}</p>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Employees:</span>
                    <span className="font-medium ml-2">{selectedRun.total_employees}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Amount:</span>
                    <span className="font-medium ml-2">Rs. {selectedRun.total_net_amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                id="payment-method"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={processForm.payment_method}
                onChange={(e) => setProcessForm({ ...processForm, payment_method: e.target.value as any })}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="payment-date" className="block text-sm font-medium text-gray-700 mb-2">
                Payment Date *
              </label>
              <input
                type="date"
                id="payment-date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={processForm.payment_date}
                onChange={(e) => setProcessForm({ ...processForm, payment_date: e.target.value })}
              />
            </div>
            
            <div>
              <label htmlFor="batch-reference" className="block text-sm font-medium text-gray-700 mb-2">
                Batch Reference (optional)
              </label>
              <input
                type="text"
                id="batch-reference"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter batch reference number..."
                value={processForm.batch_reference}
                onChange={(e) => setProcessForm({ ...processForm, batch_reference: e.target.value })}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowProcessModal(false)}>
            Cancel
          </Button>
          <Button 
            color="purple"
            onClick={submitProcess}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Process Payments'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Payroll Run Modal */}
      <Modal
        show={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setSelectedRun(null);
          setCancelForm({ cancellation_reason: '' });
        }}
        size="md"
      >
        <Modal.Header>
          Cancel Payroll Run
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {selectedRun && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-800">{selectedRun.run_name}</h4>
                <p className="text-sm text-red-600">{selectedRun.run_number}</p>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-red-500">Employees:</span>
                    <span className="font-medium ml-2">{selectedRun.total_employees}</span>
                  </div>
                  <div>
                    <span className="text-red-500">Total Amount:</span>
                    <span className="font-medium ml-2">Rs. {selectedRun.total_net_amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center">
                <span className="text-yellow-600 text-lg mr-2">⚠️</span>
                <div>
                  <h4 className="font-semibold text-yellow-800">Warning</h4>
                  <p className="text-sm text-yellow-700">
                    This action will permanently cancel the payroll run. All calculated payroll data will be lost and cannot be recovered.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="cancellation-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason (optional)
              </label>
              <textarea
                id="cancellation-reason"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Optional: Provide a reason for cancelling this payroll run..."
                value={cancelForm.cancellation_reason}
                onChange={(e) => setCancelForm({ ...cancelForm, cancellation_reason: e.target.value })}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowCancelModal(false)}>
            Keep Run
          </Button>
          <Button 
            color="red"
            onClick={submitCancel}
            disabled={loading}
          >
            {loading ? 'Cancelling...' : 'Cancel Payroll Run'}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default PayrollRunDashboard;