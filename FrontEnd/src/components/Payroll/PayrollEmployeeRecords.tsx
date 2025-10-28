import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Badge, Modal, Card, Alert, Spinner } from "flowbite-react";
import { HiArrowLeft, HiEye, HiDocumentReport } from 'react-icons/hi';
import { payrollRunApiService } from '../../services/payrollRunService';

interface EmployeeRecord {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  designation_name: string;
  calculation_status: string;
  base_salary: number;
  expected_base_salary: number;
  actual_earned_base: number;
  attendance_shortfall: number;
  total_earnings: number;
  total_deductions: number;
  total_taxes: number;
  gross_salary: number;
  net_salary: number;
  payment_status: string;
  calculated_at: string;
  notes: string;
}

interface ComponentDetail {
  id: string;
  component_code: string;
  component_name: string;
  component_type: 'earning' | 'deduction' | 'tax';
  component_category: string;
  calculated_amount: number;
  calculation_method: string;
  details?: string;
}

const PayrollEmployeeRecords: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payrollRun, setPayrollRun] = useState<any>(null);
  const [employeeRecords, setEmployeeRecords] = useState<EmployeeRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<EmployeeRecord | null>(null);
  const [componentDetails, setComponentDetails] = useState<ComponentDetail[]>([]);
  const [showComponentsModal, setShowComponentsModal] = useState(false);
  const [componentType, setComponentType] = useState<'additions' | 'deductions'>('additions');

  // Load data on component mount
  useEffect(() => {
    if (runId) {
      loadPayrollData();
    }
  }, [runId]);

  const loadPayrollData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load payroll run details and employee records in parallel
      const [runResponse, recordsResponse] = await Promise.all([
        payrollRunApiService.getPayrollRun(runId!),
        payrollRunApiService.getPayrollRecords(runId!)
      ]);

      if (runResponse.success && recordsResponse.success) {
        setPayrollRun(runResponse.data);
        setEmployeeRecords(recordsResponse.data || []);
      } else {
        setError('Failed to load payroll data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const handleShowComponents = async (record: EmployeeRecord, type: 'additions' | 'deductions') => {
    try {
      setSelectedRecord(record);
      setComponentType(type);
      setShowComponentsModal(true);

      // Load component details for this record
      const response = await payrollRunApiService.getRecordComponents(record.id);
      if (response.success) {
        const filteredComponents = response.data.filter((comp: ComponentDetail) => {
          if (type === 'additions') {
            // For additions, exclude base salary (it's shown separately)
            return comp.component_type === 'earning' && comp.component_category !== 'basic';
          } else {
            // For deductions, exclude attendance shortfall (it's shown separately)
            return (comp.component_type === 'deduction' || comp.component_type === 'tax') &&
                   comp.component_category !== 'attendance';
          }
        });
        setComponentDetails(filteredComponents);
      }
    } catch (err) {
      console.error('Failed to load component details:', err);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'calculated': 'success',
      'pending': 'warning',
      'error': 'failure',
      'excluded': 'gray'
    };
    return colorMap[status] || 'gray';
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount?.toLocaleString() || '0'}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
        <span className="ml-3 text-lg">Loading payroll records...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            color="gray"
            onClick={() => navigate('/payroll')}
          >
            <HiArrowLeft className="w-4 h-4 mr-2" />
            Back to Payroll Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Employee Records
            </h1>
            {payrollRun && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {payrollRun.run_name} • {payrollRun.run_number}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {payrollRun && (
            <Badge color={payrollRunApiService.getRunStatusColor(payrollRun.run_status)} size="lg">
              {payrollRunApiService.getRunStatusIcon(payrollRun.run_status)} {' '}
              {payrollRunApiService.getRunStatusText(payrollRun.run_status)}
            </Badge>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      {payrollRun && (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{payrollRun.total_employees}</div>
              <div className="text-sm text-gray-500">Total Employees</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(payrollRun.total_gross_amount)}</div>
              <div className="text-sm text-gray-500">Gross Amount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(payrollRun.total_deductions_amount)}</div>
              <div className="text-sm text-gray-500">Total Deductions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(payrollRun.total_net_amount)}</div>
              <div className="text-sm text-gray-500">Net Amount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{payrollRun.processed_employees}</div>
              <div className="text-sm text-gray-500">Processed</div>
            </div>
          </div>
        </Card>
      )}

      {/* Employee Records Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Employee</Table.HeadCell>
              <Table.HeadCell>Base Salary</Table.HeadCell>
              <Table.HeadCell>Expected Base (Until Now)</Table.HeadCell>
              <Table.HeadCell>Actual Earned (Until Now)</Table.HeadCell>
              <Table.HeadCell>Shortfall (Until Now)</Table.HeadCell>
              <Table.HeadCell>Allowances</Table.HeadCell>
              <Table.HeadCell>Gross Salary</Table.HeadCell>
              <Table.HeadCell>Deductions</Table.HeadCell>
              <Table.HeadCell>Net Salary</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {employeeRecords.length > 0 ? (
                employeeRecords.map((record) => (
                  <Table.Row key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                    <Table.Cell>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {record.employee_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {record.employee_code}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-medium">
                        {formatCurrency(record.base_salary)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-medium text-blue-600">
                        {formatCurrency(record.expected_base_salary || 0)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(record.actual_earned_base || 0)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-medium text-orange-600">
                        {formatCurrency(record.attendance_shortfall || 0)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="xs"
                        color="green"
                        onClick={() => handleShowComponents(record, 'additions')}
                      >
                        <HiEye className="w-3 h-3 mr-1" />
                        {formatCurrency(record.total_earnings || 0)}
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-semibold text-blue-600">
                        {formatCurrency(record.gross_salary)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="xs"
                        color="red"
                        onClick={() => handleShowComponents(record, 'deductions')}
                      >
                        <HiEye className="w-3 h-3 mr-1" />
                        {formatCurrency(record.total_deductions + record.total_taxes)}
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-bold text-purple-600">
                        {formatCurrency(record.net_salary)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={9} className="text-center py-8 text-gray-500">
                    No employee records found for this payroll run.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Component Details Modal */}
      <Modal
        show={showComponentsModal}
        onClose={() => {
          setShowComponentsModal(false);
          setSelectedRecord(null);
          setComponentDetails([]);
        }}
        size="lg"
      >
        <Modal.Header>
          {componentType === 'additions' ? 'Earnings Breakdown' : 'Deductions Breakdown'} - {selectedRecord?.employee_name}
        </Modal.Header>
        <Modal.Body>
          {componentDetails.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <Table.Head>
                    <Table.HeadCell>Component</Table.HeadCell>
                    <Table.HeadCell>Category</Table.HeadCell>
                    <Table.HeadCell>Amount</Table.HeadCell>
                    <Table.HeadCell>Method</Table.HeadCell>
                    <Table.HeadCell>Details</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {componentDetails.map((component) => (
                      <Table.Row key={component.id}>
                        <Table.Cell>
                          <div>
                            <div className="font-medium">{component.component_name}</div>
                            <div className="text-sm text-gray-500">{component.component_code}</div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color="gray">{component.component_category}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <span className={`font-semibold ${
                            component.component_type === 'earning' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(component.calculated_amount)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-sm">{component.calculation_method}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-500">
                            {component.details || 'N/A'}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
              
              {/* Summary */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    Total {componentType === 'additions' ? 'Earnings' : 'Deductions'}:
                  </span>
                  <span className={`font-bold text-lg ${
                    componentType === 'additions' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(
                      componentDetails.reduce((sum, comp) => sum + comp.calculated_amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <HiDocumentReport className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No {componentType} found for this employee.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowComponentsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PayrollEmployeeRecords;