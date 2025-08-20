import React, { useState, useEffect } from 'react';
import { 
  Modal,
  Table, 
  Button, 
  TextInput, 
  Select, 
  Badge, 
  Card,
  Pagination,
  Spinner
} from 'flowbite-react';
import { 
  HiPlus, 
  HiPencil, 
  HiTrash, 
  HiRefresh,
  HiClock,
  HiCalendar
} from 'react-icons/hi';
import apiService from '../../services/api';
import AttendanceForm from './AttendanceForm';
import { set } from 'lodash';
import ResolveWorkDurationModal from './ResolveWorkDurationModal'
import {Link} from 'react-router-dom';

// Types
interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  break_duration?: number;
  arrival_status: 'on_time' | 'late' | 'absent';
  work_duration: 'full_day' | 'half_day' | 'short_leave' | 'on_leave';
  work_type: 'office' | 'remote' | 'hybrid';
  notes?: string;
  scheduled_in_time?: string;
  scheduled_out_time?: string;
  follows_company_schedule?: boolean;
  department_name?: string;
  created_at: string;
  updated_at: string;
}

interface AttendanceFilters {
  page: number;
  limit: number;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  arrival_status?: string;
  work_duration?: string;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  employeeName: '';
}



const AttendanceView: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [employees, setEmployees] = useState([]);
    const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // YYYY-MM-DD (local)
};

  const [filters, setFilters] = useState<AttendanceFilters>({
    page: 1,
    limit: 50,
    sortBy: 'date',
    sortOrder: 'DESC',
    startDate: todayStr(),
    endDate: todayStr(),
    employeeName: '', 
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50
  });


  const [showResolve, setShowResolve] = useState(false);
  const [resolveRecord, setResolveRecord] = useState<AttendanceRecord | null>(null);
/* add after the other useState hooks */
  const [showDelete, setShowDelete] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  

  // open handler
  const openResolve = (rec: AttendanceRecord) => {
    setResolveRecord(rec);
    setShowResolve(true);
  };
  // Load data on component mount and filter changes
  useEffect(() => {
    loadAttendanceRecords();
  }, [filters]);

  useEffect(() => {
    loadEmployees();
  }, []);

  // const loadAttendanceRecords = async () => {
  //   try {
  //     setLoading(true);
      
  //     // Build query parameters
  //     const params = new URLSearchParams();
  //     Object.entries(filters).forEach(([key, value]) => {
  //       if (value !== undefined && value !== null && value !== '') {
  //         params.append(key, value.toString());
  //       }
  //     });

  //     const response = await apiService.getAttendanceRecords(params);

  //     console.log('📊 Attendance records response:', response);

  //     if (response.success) {
  //       setAttendanceRecords(response.data.attendance);
  //       setPagination(response.data.pagination);
  //       console.log('📊 Attendance records:', attendanceRecords);
  //     }
  //   } catch (error) {
  //     console.error('Failed to load attendance records:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };


  const loadAttendanceRecords = async () => {
  try {
    setLoading(true);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const qs = params.toString(); // <-- important
    console.log('GET /api/attendance?' + qs);

    const response = await apiService.getAttendanceRecords(qs); // <-- pass string

    if (response.success) {
      console.log("attendance re",response.data.attendance);
      setAttendanceRecords(response.data.attendance);
      setPagination(response.data.pagination);
    }
  } catch (e) {
    console.error('Failed to load attendance records:', e);
  } finally {
    setLoading(false);
  }
};


  const loadEmployees = async () => {
    try {
      const response = await apiService.apiCall('/api/employees');
      if (response.success) {
        console.log('📊 Employees:', response.data.employees);
        setEmployees(response.data.employees);

      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };


// load non attendant employee


  // const handleFilterChange = (key: string, value: string) => {
  //   setFilters(prev => ({
  //     ...prev,
  //     [key]: value,
  //     page: 1 // Reset to first page when filtering
  //   }));
  // };

  const handleFilterChange = (key: string, value: string) => {
  setFilters(prev => {
    let next = { ...prev, [key]: value, page: 1 };

    // ensure start <= end
    if (key === 'startDate' && next.endDate && value > next.endDate) {
      next.endDate = value;
    }
    if (key === 'endDate' && next.startDate && value < next.startDate) {
      next.startDate = value;
    }
    return next;
  });
};

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;

    try {
      const response = await apiService.apiCall(`/api/attendance/${recordId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        loadAttendanceRecords();
      }
    } catch (error) {
      console.error('Failed to delete attendance record:', error);
    }
  };

  // FIXED: Added null safety checks
  const getArrivalStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return <Badge color="gray">Unknown</Badge>;
    }
    
    const colors: { [key: string]: string } = {
      'on_time': 'success',
      'late': 'warning', 
      // 'absent': 'failure'
    };
    return <Badge color={colors[status] || 'gray'}>{status.replace('_', ' ')}</Badge>;
  };

// null-safe badge
const getWorkDurationBadge = (duration?: string | null) => {
  const label = duration ? duration.replace(/_/g, ' ') : 'Action required';
  const colorMap: Record<string, any> = {
    full_day: 'success',
    half_day: 'info',
    short_leave: 'warning',
    on_leave: 'purple',
  };
  const color = duration ? (colorMap[duration] ?? 'gray') : 'warning';
  return <Badge color={color}>{label}</Badge>;
};


  const formatTime = (time?: string) => {
    if (!time) return 'Not recorded';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };


  /**
 * 2.25  → "2 h 15 m"
 * 0.50 → "30 m"
 * 1    → "1 h"
 */
const toHrsMins = (decimal?: number) => {
  if (!decimal || decimal <= 0) return '';
  const totalMinutes = Math.round(decimal * 60);   // 0.47 h → 28.2 m → 28
  const hrs  = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs)         return `${hrs}h`;
  return           `${mins}m`;
};

/* minutesBetween("08:30:00","08:32:00") → 2  (positive = late, negative = early) */
const minutesBetween = (sched?: string, actual?: string) => {
  if (!sched || !actual) return 0;
  const s = new Date(`2000-01-01T${sched}`);
  const a = new Date(`2000-01-01T${actual}`);
  return Math.round((a.getTime() - s.getTime()) / 60000);
};

/* 62 → "1h 2m", 2 → "2m", 0 → ""  */
const minsToHrsMins = (mins: number) => {
  if (mins <= 0) return '';                 // on-time or early → show nothing
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m`
       : h      ? `${h}h`
       :          `${m}m`;
};

/** quick PATCH to /api/attendance/:id */
const setWorkDuration = async (id: string, value: 'half_day' | 'short_leave') => {
  try {
    await apiService.apiCall(`/api/attendance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ work_duration: value }),
      headers: { 'Content-Type': 'application/json' }
    });
    loadAttendanceRecords();                    // refresh table
  } catch (err) {
    console.error('Failed to update work_duration', err);
    alert('Could not save work-duration, please try again.');
  }
};

const filteredRecords = attendanceRecords.filter(record =>
  record.employee_name.toLowerCase().includes(filters.employeeName?.toLowerCase() || '')
);



  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Attendance Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track employee arrival times and work duration
          </p>
        </div>
        <div className="flex gap-2">
          <Button color="purple" as={Link} to="/manual-attendance">
        Manual Attendance Sheet
      </Button>
        <Button onClick={() => setShowForm(true)}>
          <HiPlus className="mr-2 h-4 w-4" />
          Add Attendance
        </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            {/* <input
              value={filters.employeeId || ''}
              onChange={(e) => handleFilterChange('employeeId', e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </input> */}
             <TextInput
    type="text"
    placeholder="Search by employee name"
    value={filters.employeeName || ''}
    onChange={(e) => handleFilterChange('employeeName', e.target.value)}
    
  />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <TextInput
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <TextInput
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Arrival Status</label>
            <Select
              value={filters.arrival_status || ''}
              onChange={(e) => handleFilterChange('arrival_status', e.target.value)}
            >
              <option value="">All Arrival Status</option>
              <option value="on_time">On Time</option>
              <option value="late">Late</option>
              {/* <option value="absent">Absent</option> */}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Work Duration</label>
            <Select
              value={filters.work_duration || ''}
              onChange={(e) => handleFilterChange('work_duration', e.target.value)}
            >
              <option value="">All Work Duration</option>
              <option value="full_day">Full Day</option>
              <option value="half_day">Half Day</option>
              <option value="short_leave">Short Leave</option>
              {/* <option value="on_leave">On Leave</option> */}
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={loadAttendanceRecords} disabled={loading}>
              <HiRefresh className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Employee</Table.HeadCell>
                  <Table.HeadCell>Date</Table.HeadCell>
                  <Table.HeadCell>Check In</Table.HeadCell>
                  <Table.HeadCell>Check Out</Table.HeadCell>
                  <Table.HeadCell>Arrival Status</Table.HeadCell>
                  <Table.HeadCell>Work Duration</Table.HeadCell>
                  <Table.HeadCell>Total Hours</Table.HeadCell>
                  <Table.HeadCell>Actions</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {filteredRecords.map((record) => (
                    <Table.Row key={record.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        <div>
                          <div className="font-semibold">{record.employee_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{record.employee_code || 'N/A'}</div>
                        </div>
                      </Table.Cell>
                      
                      <Table.Cell>
                        <div className="flex items-center">
                          <HiCalendar className="mr-2 h-4 w-4 text-gray-400" />
                          {formatDate(record.date)}
                        </div>
                      </Table.Cell>
                      
                      <Table.Cell>
                        <div className="flex items-center text-sm">
                          <HiClock className="mr-1 h-3 w-3 text-green-500" />
                          {formatTime(record.check_in_time)}
                        </div>
                      </Table.Cell>
                      
                      <Table.Cell>
                        <div className="flex items-center text-sm">
                          <HiClock className="mr-1 h-3 w-3 text-red-500" />
                          {formatTime(record.check_out_time)}
                        </div>  
                      </Table.Cell>
                      
                      <Table.Cell>

                          {/* inline lateness calc */}
                      {(() => {
                        if (!record.scheduled_in_time || !record.check_in_time) return null;

                        const diffMin =
                          (new Date(`2000-01-01T${record.check_in_time}`).getTime() -
                          new Date(`2000-01-01T${record.scheduled_in_time}`).getTime()) / 60000;

                        if (diffMin <= 0) return null;                      // on-time or early

                        const hrs = Math.floor(diffMin / 60);
                        const min = Math.round(diffMin % 60);
                        const label = hrs ? `${hrs}h ${min}m` : `${min}m`;

                        return (
                          <div className="text-xs text-orange-600">
                            {label} 
                          </div>
                        );
                      })()}
                        {getArrivalStatusBadge(record.arrival_status)}
                  
                  
                      </Table.Cell>
                      
              <Table.Cell>
              <span
                role="button"
                tabIndex={0}
                onClick={() => openResolve(record)}
                onKeyDown={(e) => e.key === 'Enter' && openResolve(record)}
                className="inline-block cursor-pointer"
                title="Click to change work duration"
              >
                {getWorkDurationBadge(record.work_duration)}
              </span>
            </Table.Cell>


                      
                      <Table.Cell>
                        <div className="space-y-1">
                          <div className="font-semibold">
                            {record.total_hours ? `${toHrsMins(record.total_hours)}` : 'N/A'}
                          </div>
                          {(record.overtime_hours || 0) > 0 && (
                            <div className="text-sm text-orange-600">
                               OT: {toHrsMins(record.overtime_hours)}
                            </div>
                          )}
                        </div>
                      </Table.Cell>
                      
                      <Table.Cell>
                        <div className="flex space-x-2">
                          <Button
                          size="sm"
                          color="warning"
                          onClick={() => {
                            setEditingRecord(record);   // opens edit modal via <AttendanceForm>
                            setShowForm(true);
                          }}
                        >
                          <HiPencil className="h-4 w-4" />
                        </Button>
                          <Button
                              size="sm"
                              color="failure"
                              onClick={() => {
                                setRecordToDelete(record);
                                setShowDelete(true);        // opens confirmation modal
                              }}
                            >
                            <HiTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                Showing {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to{' '}
                {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} of{' '}
                {pagination.totalRecords} entries
              </div>
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
                showIcons
              />
            </div>
          </>
        )}
      </Card>


      // place the modal once at the end of the page JSX:
<ResolveWorkDurationModal
  open={showResolve}
  record={resolveRecord}
  onClose={() => setShowResolve(false)}
  onSaved={loadAttendanceRecords}
/>

      <Modal show={showDelete} size="md" onClose={() => setShowDelete(false)} popup>
  <Modal.Header />
  <Modal.Body>
    <div className="text-center space-y-4">
      <HiTrash className="mx-auto h-12 w-12 text-red-600" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Delete this attendance record?
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {recordToDelete?.employee_name} — {formatDate(recordToDelete?.date || '')}
      </p>

      <div className="flex justify-center gap-4 mt-6">
        <Button
          color="failure"
          onClick={async () => {
            if (!recordToDelete) return;
            try {
              await apiService.apiCall(`/api/attendance/${recordToDelete.id}`, {
                method: 'DELETE'
              });
              loadAttendanceRecords();
            } catch (err) {
              console.error('Delete failed', err);
              alert('Failed to delete record.');
            } finally {
              setShowDelete(false);
              setRecordToDelete(null);
            }
          }}
        >
          Delete
        </Button>
        <Button color="gray" onClick={() => setShowDelete(false)}>
          Cancel
        </Button>
      </div>
    </div>
  </Modal.Body>
</Modal>



      {/* Attendance Form Modal */}
      {showForm && (
        <AttendanceForm
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingRecord(null);
          }}
          onSuccess={() => {
            loadAttendanceRecords();
            setShowForm(false);
            setEditingRecord(null);
          }}
          editingRecord={editingRecord}
          employees={employees}
        />
      )}
    </div>

    
    
  );
  
};

export default AttendanceView;