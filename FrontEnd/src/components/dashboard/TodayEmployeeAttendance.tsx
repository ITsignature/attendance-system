import { Badge, Table, Spinner } from "flowbite-react";
import SimpleBar from "simplebar-react";
import { useEffect, useState } from "react";
import { apiService } from "../../services/api";

interface AttendanceRecord {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  designation_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  total_hours: number | null;
  work_location: string;
}

const TodayEmployeeAttendance = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      const response = await apiService.getAttendanceRecords({
        startDate: today,
        endDate: today,
        limit: 20,
        page: 1
      });

      if (response.success && response.data) {
        setAttendanceRecords(response.data.attendance || []);
      }
    } catch (err: any) {
      console.error('Error fetching today\'s attendance:', err);
      setError(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      'present': { color: 'success', text: 'On Time' },
      'late': { color: 'warning', text: 'Late' },
      'absent': { color: 'failure', text: 'Absent' },
      'on_leave': { color: 'info', text: 'On Leave' },
    };

    const config = statusConfig[status] || { color: 'gray', text: status };
    return <Badge color={config.color}>{config.text}</Badge>;
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';

    // If time is already in HH:MM:SS format
    if (time.includes(':')) {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    }

    // Otherwise treat as full datetime
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return '-';
    return `${hours.toFixed(2)}h`;
  };

  return (
    <>
      <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-6 px-0 relative w-full break-words">
        <div className="px-6 flex justify-between items-center mb-6">
          <div>
            <h5 className="card-title text-xl font-semibold">Today's Attendance</h5>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          {!loading && (
            <Badge color="info" size="sm">
              {attendanceRecords.length} Records
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading attendance records...</span>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No attendance records for today</p>
          </div>
        ) : (
          <SimpleBar className="max-h-[500px]">
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell className="p-6 text-gray-500 dark:text-gray-400 font-medium">
                    Employee
                  </Table.HeadCell>
                  <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                    Department
                  </Table.HeadCell>
                  <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                    Type
                  </Table.HeadCell>
                  <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                    Check In
                  </Table.HeadCell>
                  <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                    Check Out
                  </Table.HeadCell>
                  <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                    Hours
                  </Table.HeadCell>
                  <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                    Status
                  </Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y divide-border dark:divide-darkborder">
                  {attendanceRecords.map((record, index) => (
                    <Table.Row
                      key={`${record.employee_id}-${index}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Table.Cell className="whitespace-nowrap ps-6">
                        <div className="flex flex-col">
                          <h6 className="text-sm font-medium text-gray-900 dark:text-white">
                            {record.employee_name}
                          </h6>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {record.employee_code}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="me-5">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {record.department_name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {record.designation_name || ''}
                          </p>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="me-5">
                          <Badge color={record.work_location === 'remote' ? 'purple' : 'gray'} size="sm">
                            {record.work_location || 'Office'}
                          </Badge>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="me-5">
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {formatTime(record.check_in_time)}
                          </p>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="me-5">
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {formatTime(record.check_out_time)}
                          </p>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="me-5">
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {formatHours(record.total_hours)}
                          </p>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {getStatusBadge(record.status)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </SimpleBar>
        )}
      </div>
    </>
  );
};

export default TodayEmployeeAttendance;
