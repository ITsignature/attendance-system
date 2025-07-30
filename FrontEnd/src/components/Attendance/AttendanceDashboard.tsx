import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Select, 
  TextInput, 
  Badge, 
  Alert, 
  Spinner, 
  Modal,
  Label,
  Textarea
} from 'flowbite-react';
import { 
  HiPlus, 
  HiPencil, 
  HiClock, 
  HiCalendar, 
  HiSearch,
  HiFilter,
  HiDownload,
  HiRefresh,
  HiCheckCircle,
  HiXCircle,
  HiExclamation
} from 'react-icons/hi';
import { DynamicProtectedComponent } from '../RBACSystem/rbacExamples';
import apiService, { AttendanceRecord, CreateAttendanceData, UpdateAttendanceData, AttendanceFilters } from '../../services/api';
import { Employee } from '../../types/employee';

const formatHours = (hours: any): string => {
  if (!hours || hours === null || hours === undefined) return '-';
  const numHours = Number(hours);
  if (isNaN(numHours) || numHours <= 0) return '-';
  return `${numHours.toFixed(2)}h`;
};

interface AttendanceStats {
  totalRecords: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  avgHoursToday: number;
}

const AttendanceManagement: React.FC = () => {
  // State management
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [filters, setFilters] = useState<AttendanceFilters>({
    sortBy: 'date',
    sortOrder: 'DESC'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  
  // Form data
  const [createData, setCreateData] = useState<CreateAttendanceData>({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present'
  });
  const [updateData, setUpdateData] = useState<UpdateAttendanceData>({});
  
  // Stats
  const [stats, setStats] = useState<AttendanceStats>({
    totalRecords: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    avgHoursToday: 0
  });

  // Load data on component mount
  useEffect(() => {
    loadAttendanceData();
    loadEmployees();
  }, [currentPage, recordsPerPage, filters]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getAttendance({
        page: currentPage,
        limit: recordsPerPage,
        ...filters
      });

      if (response.success) {
        setAttendanceRecords(response.data.attendance || []);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages);
          setTotalRecords(response.data.pagination.totalRecords);
        }
        calculateStats(response.data.attendance || []);
      } else {
        setError(response.message || 'Failed to load attendance data');
      }
    } catch (err) {
      setError('Network error occurred while loading attendance data');
      console.error('Load attendance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await apiService.getEmployees({ 
        limit: 1000, 
        employment_status: 'active' 
      });
      
      if (response.success) {
        setEmployees(response.data.employees || []);
      }
    } catch (err) {
      console.error('Load employees error:', err);
    }
  };

  const calculateStats = (records: AttendanceRecord[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = records.filter(r => r.date === today);
    
    const presentToday = todayRecords.filter(r => r.status === 'present').length;
    const absentToday = todayRecords.filter(r => r.status === 'absent').length;
    const lateToday = todayRecords.filter(r => r.status === 'late').length;
    
    const totalHours = todayRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const avgHoursToday = todayRecords.length > 0 ? totalHours / todayRecords.length : 0;
    
    setStats({
      totalRecords: records.length,
      presentToday,
      absentToday,
      lateToday,
      avgHoursToday
    });
  };

  const handleCreateAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.createAttendance(createData);
      
      if (response.success) {
        setSuccess('Attendance record created successfully!');
        setShowCreateModal(false);
        setCreateData({
          employee_id: '',
          date: new Date().toISOString().split('T')[0],
          status: 'present'
        });
        loadAttendanceData();
      } else {
        setError(response.message || 'Failed to create attendance record');
      }
    } catch (err) {
      setError('Network error occurred while creating attendance');
      console.error('Create attendance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAttendance = async () => {
    if (!selectedRecord) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.updateAttendance(selectedRecord.id, updateData);
      
      if (response.success) {
        setSuccess('Attendance record updated successfully!');
        setShowEditModal(false);
        setSelectedRecord(null);
        setUpdateData({});
        loadAttendanceData();
      } else {
        setError(response.message || 'Failed to update attendance record');
      }
    } catch (err) {
      setError('Network error occurred while updating attendance');
      console.error('Update attendance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCheckIn = async (employeeId: string) => {
    try {
      setLoading(true);
      const response = await apiService.quickCheckIn(employeeId);
      
      if (response.success) {
        setSuccess('Employee checked in successfully!');
        loadAttendanceData();
      } else {
        setError(response.message || 'Failed to check in employee');
      }
    } catch (err) {
      setError('Network error occurred during check-in');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setUpdateData({
      check_in_time: record.check_in_time,
      check_out_time: record.check_out_time,
      break_duration: record.break_duration,
      status: record.status,
      work_type: record.work_type,
      notes: record.notes
    });
    setShowEditModal(true);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadAttendanceData();
  };

  const resetFilters = () => {
    setFilters({
      sortBy: 'date',
      sortOrder: 'DESC'
    });
    setCurrentPage(1);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present': return <HiCheckCircle className="text-green-500" />;
      case 'absent': return <HiXCircle className="text-red-500" />;
      case 'late': return <HiExclamation className="text-yellow-500" />;
      default: return <HiClock className="text-blue-500" />;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Attendance Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track and manage employee attendance records
          </p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button
            color="gray"
            size="sm"
            onClick={loadAttendanceData}
            disabled={loading}
          >
            <HiRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          
          <DynamicProtectedComponent permission="attendance.edit">
            <Button
              color="blue"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <HiPlus className="mr-2 h-4 w-4" />
              Add Attendance
            </Button>
          </DynamicProtectedComponent>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <Alert color="failure" className="mb-4" onDismiss={clearMessages}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert color="success" className="mb-4" onDismiss={clearMessages}>
          {success}
        </Alert>
      )}

      {/* Stats Cards
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <HiClock className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Records</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalRecords}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <HiCheckCircle className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Present Today</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.presentToday}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <HiXCircle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Absent Today</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.absentToday}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <HiExclamation className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Late Today</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.lateToday}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <HiClock className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Avg Hours</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {stats.avgHoursToday.toFixed(1)}h
              </p>
            </div>
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="employee-filter" value="Employee" />
            <Select
              id="employee-filter"
              value={filters.employeeId || ''}
              onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {`${emp.first_name} ${emp.last_name}`}
                </option>
              ))}
            </Select>
          </div>
          
          <div>
            <Label htmlFor="start-date" value="Start Date" />
            <TextInput
              id="start-date"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="end-date" value="End Date" />
            <TextInput
              id="end-date"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="status-filter" value="Status" />
            <Select
              id="status-filter"
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="on_leave">On Leave</option>
            </Select>
          </div>
          
          <div className="flex items-end gap-2">
            <Button
              color="blue"
              size="sm"
              onClick={applyFilters}
              disabled={loading}
            >
              <HiFilter className="mr-2 h-4 w-4" />
              Apply
            </Button>
            <Button
              color="gray"
              size="sm"
              onClick={resetFilters}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
          <span className="ml-2">Loading attendance data...</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Check In</th>
                <th className="px-6 py-3">Check Out</th>
                <th className="px-6 py-3">Total Hours</th>
                <th className="px-6 py-3">Overtime</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Work Type</th>
                <DynamicProtectedComponent permission="attendance.edit">
                  <th className="px-6 py-3">Actions</th>
                </DynamicProtectedComponent>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {record.employee_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {record.employee_code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {apiService.formatDate(record.date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <HiClock className="mr-2 h-4 w-4 text-green-500" />
                        {apiService.formatTime(record.check_in_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <HiClock className="mr-2 h-4 w-4 text-red-500" />
                        {apiService.formatTime(record.check_out_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">
                          {formatHours(record.total_hours)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${record.overtime_hours && Number(record.overtime_hours) > 0 ? 'text-orange-600' : ''}`}>
                          {formatHours(record.overtime_hours)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getStatusIcon(record.status)}
                        <Badge
                          color={apiService.getStatusBadgeColor(record.status)}
                          size="sm"
                          className="ml-2"
                        >
                          {record.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-gray-700 dark:text-gray-300">
                        {record.work_type || 'Office'}
                      </span>
                    </td>
                    <DynamicProtectedComponent permission="attendance.edit">
                      <td className="px-6 py-4">
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => openEditModal(record)}
                        >
                          <HiPencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      </td>
                    </DynamicProtectedComponent>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center">
                      <HiCalendar className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-lg">No attendance records found</p>
                      <p className="text-sm">Try adjusting your filters or add some attendance records</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Show</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => setRecordsPerPage(parseInt(e.target.value))}
              className="w-20"
              sizing="sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Select>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              records per page
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages} ({totalRecords} total)
            </span>
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || loading}
              size="sm"
              color="gray"
            >
              Previous
            </Button>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              size="sm"
              color="gray"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Attendance Modal */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <Modal.Header>Create Attendance Record</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-employee" value="Employee *" />
              <Select
                id="create-employee"
                value={createData.employee_id}
                onChange={(e) => setCreateData({ ...createData, employee_id: e.target.value })}
                required
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    { `${emp.first_name} ${emp.last_name}`} ({emp.employee_code})
                  </option>
                ))}
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-date" value="Date *" />
                <TextInput
                  id="create-date"
                  type="date"
                  value={createData.date}
                  onChange={(e) => setCreateData({ ...createData, date: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="create-status" value="Status *" />
                <Select
                  id="create-status"
                  value={createData.status}
                  onChange={(e) => setCreateData({ ...createData, status: e.target.value as any })}
                  required
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="on_leave">On Leave</option>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-checkin" value="Check In Time" />
                <TextInput
                  id="create-checkin"
                  type="time"
                  value={createData.check_in_time || ''}
                  onChange={(e) => setCreateData({ ...createData, check_in_time: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="create-checkout" value="Check Out Time" />
                <TextInput
                  id="create-checkout"
                  type="time"
                  value={createData.check_out_time || ''}
                  onChange={(e) => setCreateData({ ...createData, check_out_time: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-worktype" value="Work Type" />
                <Select
                  id="create-worktype"
                  value={createData.work_type || 'office'}
                  onChange={(e) => setCreateData({ ...createData, work_type: e.target.value as any })}
                >
                  <option value="office">Office</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="create-break" value="Break Duration (minutes)" />
                <TextInput
                  id="create-break"
                  type="number"
                  min="0"
                  max="480"
                  value={createData.break_duration || ''}
                  onChange={(e) => setCreateData({ ...createData, break_duration: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="create-notes" value="Notes" />
              <Textarea
                id="create-notes"
                rows={3}
                value={createData.notes || ''}
                onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                placeholder="Optional notes about this attendance record..."
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={handleCreateAttendance}
            disabled={loading || !createData.employee_id || !createData.date}
          >
            {loading ? <Spinner size="sm" className="mr-2" /> : <HiPlus className="mr-2 h-4 w-4" />}
            Create Record
          </Button>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Attendance Modal */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} size="lg">
        <Modal.Header>Edit Attendance Record</Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {selectedRecord.employee_name} - {apiService.formatDate(selectedRecord.date)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Employee Code: {selectedRecord.employee_code}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-checkin" value="Check In Time" />
                  <TextInput
                    id="edit-checkin"
                    type="time"
                    value={updateData.check_in_time || ''}
                    onChange={(e) => setUpdateData({ ...updateData, check_in_time: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-checkout" value="Check Out Time" />
                  <TextInput
                    id="edit-checkout"
                    type="time"
                    value={updateData.check_out_time || ''}
                    onChange={(e) => setUpdateData({ ...updateData, check_out_time: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status" value="Status" />
                  <Select
                    id="edit-status"
                    value={updateData.status || ''}
                    onChange={(e) => setUpdateData({ ...updateData, status: e.target.value as any })}
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="half_day">Half Day</option>
                    <option value="on_leave">On Leave</option>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-worktype" value="Work Type" />
                  <Select
                    id="edit-worktype"
                    value={updateData.work_type || 'office'}
                    onChange={(e) => setUpdateData({ ...updateData, work_type: e.target.value as any })}
                  >
                    <option value="office">Office</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-break" value="Break Duration (minutes)" />
                <TextInput
                  id="edit-break"
                  type="number"
                  min="0"
                  max="480"
                  value={updateData.break_duration || ''}
                  onChange={(e) => setUpdateData({ ...updateData, break_duration: parseInt(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-notes" value="Notes" />
                <Textarea
                  id="edit-notes"
                  rows={3}
                  value={updateData.notes || ''}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                  placeholder="Optional notes about this attendance record..."
                />
              </div>
              
              {/* Calculated Fields Display */}
              {updateData.check_in_time && updateData.check_out_time && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Calculated Hours</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Total Hours: </span>
                      <span className="font-medium">
                        {apiService.calculateHours(updateData.check_in_time, updateData.check_out_time).toFixed(2)}h
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Overtime: </span>
                      <span className="font-medium">
                        {Math.max(0, apiService.calculateHours(updateData.check_in_time, updateData.check_out_time) - 8).toFixed(2)}h
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={handleUpdateAttendance}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" className="mr-2" /> : <HiPencil className="mr-2 h-4 w-4" />}
            Update Record
          </Button>
          <Button color="gray" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AttendanceManagement;