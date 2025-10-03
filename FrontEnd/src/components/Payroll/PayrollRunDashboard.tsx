import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput, Button, Select, Badge, Modal, Table, Alert, Card } from "flowbite-react";
import { payrollRunApiService, PayrollRun, PayrollRunFilters } from '../../services/payrollRunService';
import { HiPlay, HiEye, HiCheck, HiX, HiCreditCard, HiDocumentReport, HiUsers } from 'react-icons/hi';

const PayrollRunDashboard = () => {
  // =============================================
  // STATE MANAGEMENT
  // =============================================
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Data States
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [runSummary, setRunSummary] = useState<any>(null);
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  
  // Filter States
  const [filters, setFilters] = useState<PayrollRunFilters>({
    status: 'all',
    limit: 20,
    offset: 0
  });
  
  // Modal States
  const [showRunDetailsModal, setShowRunDetailsModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Form States
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

  // =============================================
  // PAYROLL RUN OPERATIONS
  // =============================================

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

  const navigateToEmployeeRecords = (runId: string) => {
    navigate(`/payroll/runs/${runId}/employees`);
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
        </div>
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
        <div className="flex justify-between items-center">
          <Select
            value={filters.limit || 20}
            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
            className="w-48"
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
                        Rs. {run.total_net_amount?.toLocaleString()}
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
                          Summary
                        </Button>
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => navigateToEmployeeRecords(run.id)}
                        >
                          <HiUsers className="w-3 h-3 mr-1" />
                          Employees
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

      {/* Run Details Modal */}
      <Modal
        show={showRunDetailsModal}
        onClose={() => {
          setShowRunDetailsModal(false);
          setSelectedRun(null);
          setRunSummary(null);
          setWorkflowStatus(null);
        }}
        size="4xl"
      >
        <Modal.Header>
          Payroll Run Summary - {selectedRun?.run_name}
        </Modal.Header>
        <Modal.Body>
          {/* Summary Content */}
          {runSummary && (
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

          {!runSummary && (
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