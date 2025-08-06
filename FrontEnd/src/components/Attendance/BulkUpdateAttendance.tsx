import React, { useState } from 'react';
import {
  Modal,
  Button,
  TextInput,
  Label,
  Alert,
  Spinner,
  Table,
  Checkbox,
  Card
} from 'flowbite-react';
import { HiBriefcase, HiClock, HiRefresh } from 'react-icons/hi';
import apiService from '../../services/api';

interface BulkUpdateProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: any[];
}

const BulkUpdateAttendance: React.FC<BulkUpdateProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employees
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [updateArrival, setUpdateArrival] = useState(true);
  const [updateDuration, setUpdateDuration] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedEmployees.length === 0) {
      setError('Please select at least one employee');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await apiService.bulkUpdateAttendanceStatus({
        date: selectedDate,
        employee_ids: selectedEmployees,
        update_arrival: updateArrival,
        update_duration: updateDuration
      });

      if (response.success) {
        setResults(response.data.results);
        onSuccess();
      } else {
        setError(response.message || 'Bulk update failed');
      }
    } catch (err: any) {
      setError(err.message || 'Bulk update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl">
      <Modal.Header>
        Bulk Update Attendance Status
      </Modal.Header>

      <Modal.Body>
        <div className="space-y-6">
          {error && (
            <Alert color="failure">
              {error}
            </Alert>
          )}

          {/* Update Options */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Update Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="bulk_date" value="Date" />
                <TextInput
                  id="bulk_date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <Checkbox
                    id="update_arrival"
                    checked={updateArrival}
                    onChange={(e) => setUpdateArrival(e.target.checked)}
                  />
                  <Label htmlFor="update_arrival" className="ml-2" value="Update Arrival Status" />
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="update_duration"
                    checked={updateDuration}
                    onChange={(e) => setUpdateDuration(e.target.checked)}
                  />
                  <Label htmlFor="update_duration" className="ml-2" value="Update Work Duration" />
                </div>
              </div>
            </div>
          </Card>

          {/* Employee Selection */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Employees</h3>
              <Button
                color="gray"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedEmployees.length === employees.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {employees.map((employee: any) => (
                  <div key={employee.id} className="flex items-center p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Checkbox
                      id={`emp_${employee.id}`}
                      checked={selectedEmployees.includes(employee.id)}
                      onChange={() => handleEmployeeToggle(employee.id)}
                    />
                    <Label htmlFor={`emp_${employee.id}`} className="ml-3 flex-1 cursor-pointer">
                      <div className="font-medium">{employee.first_name} {employee.last_name}</div>
                      <div className="text-sm text-gray-500">{employee.employee_code} - {employee.department_name}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Selected: {selectedEmployees.length} of {employees.length} employees
            </div>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Update Results</h3>
              
              <div className="overflow-x-auto">
                <Table>
                  <Table.Head>
                    <Table.HeadCell>Employee</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    <Table.HeadCell>Changes</Table.HeadCell>
                    <Table.HeadCell>Message</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {results.map((result, index) => (
                      <Table.Row key={index}>
                        <Table.Cell>{result.employee_name || result.employee_id}</Table.Cell>
                        <Table.Cell>
                          <Badge color={result.updated ? 'success' : 'gray'}>
                            {result.updated ? 'Updated' : 'Skipped'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="space-y-1">
                            {result.arrival_updated && (
                              <div className="text-sm text-green-600">
                                <HiClock className="inline mr-1" />
                                Arrival Updated
                              </div>
                            )}
                            {result.duration_updated && (
                              <div className="text-sm text-blue-600">
                                <HiBriefcase className="inline mr-1" />
                                Duration Updated
                              </div>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-sm text-gray-600">
                            {result.message || result.error || 'Success'}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleBulkUpdate} disabled={loading || selectedEmployees.length === 0}>
          {loading ? <Spinner size="sm" className="mr-2" /> : <HiRefresh className="mr-2" />}
          Update Selected Employees
        </Button>
        <Button color="gray" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkUpdateAttendance;