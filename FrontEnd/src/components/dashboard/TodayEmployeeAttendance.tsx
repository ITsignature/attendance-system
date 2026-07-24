import { Badge, Table, Spinner, TextInput, Button } from "flowbite-react";
import { HiCheck, HiPencil, HiTrash, HiX } from "react-icons/hi";
import SimpleBar from "simplebar-react";
import { useEffect, useState } from "react";
import { apiService } from "../../services/api";

interface AttendanceAnomaly {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  designation_name: string;
  date: string;
  check_in_time: string | null;
  scheduled_in_time: string | null;
  check_out_time: string | null;
  scheduled_out_time: string | null;
  total_hours: number | null;
  work_location: string;
  anomaly_type: 'missing_checkout' | 'invalid_order' | 'instant_checkout';
}

const dayOffset = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TodayEmployeeAttendance = () => {
  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(dayOffset(-1));
  const [endDate, setEndDate] = useState(dayOffset(-1));
  const [employeeName, setEmployeeName] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnomalies();
  }, [startDate, endDate, employeeName]);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getAttendanceAnomalies({
        startDate,
        endDate,
        employeeName: employeeName || undefined
      });

      if (response.success && response.data) {
        setAnomalies(response.data.anomalies || []);
      }
    } catch (err: any) {
      console.error('Error fetching attendance anomalies:', err);
      setError(err.message || 'Failed to load attendance issues');
    } finally {
      setLoading(false);
    }
  };

  const getAnomalyBadge = (type: AttendanceAnomaly['anomaly_type']) => {
    const config: Record<string, { color: string; text: string }> = {
      missing_checkout: { color: 'failure', text: 'Missing Checkout' },
      invalid_order: { color: 'warning', text: 'Invalid Order' },
      instant_checkout: { color: 'warning', text: 'Instant Checkout' },
    };
    const c = config[type] || { color: 'gray', text: type };
    return <Badge color={c.color}>{c.text}</Badge>;
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';

    if (time.includes(':')) {
      const parts = time.split(':');
      const hour = parseInt(parts[0]);
      const minutes = parts[1];
      const seconds = parts[2] || '00';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes}:${seconds} ${ampm}`;
    }

    const date = new Date(time);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return '-';
    return `${hours.toFixed(2)}h`;
  };

  const toTimeInputValue = (time: string | null) => {
    if (!time) return '';
    return time.split(':').slice(0, 2).join(':');
  };

  const startEdit = (record: AttendanceAnomaly) => {
    setEditingId(record.id);
    setEditCheckIn(toTimeInputValue(record.check_in_time));
    setEditCheckOut(toTimeInputValue(record.check_out_time));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCheckIn('');
    setEditCheckOut('');
  };

  const saveEdit = async (id: string) => {
    try {
      setSaving(true);
      const response = await apiService.updateAttendanceRecord(id, {
        check_in_time: editCheckIn || undefined,
        check_out_time: editCheckOut || undefined
      });

      if (response.success) {
        cancelEdit();
        fetchAnomalies();
      }
    } catch (err) {
      console.error('Failed to update attendance record:', err);
      alert('Could not save changes, please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;

    try {
      const response = await apiService.apiCall(`/api/attendance/${id}`, {
        method: 'DELETE'
      });

      if (response.success) {
        fetchAnomalies();
      }
    } catch (err) {
      console.error('Failed to delete attendance record:', err);
    }
  };

  return (
    <>
      <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-4 sm:pt-6 px-0 relative w-full break-words">
        <div className="px-3 sm:px-6 flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <h5 className="card-title text-lg sm:text-xl font-semibold">Attendance Issues to Review</h5>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Missing checkouts and suspicious time records
            </p>
          </div>
          {!loading && (
            <Badge color="info" size="sm">
              {anomalies.length} Records
            </Badge>
          )}
        </div>

        <div className="px-3 sm:px-6 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextInput
            type="text"
            placeholder="Search by employee name"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
          />
          <TextInput
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <TextInput
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading attendance issues...</span>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : anomalies.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No attendance issues found for this range</p>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="lg:hidden px-3 sm:px-6 pb-4 sm:pb-6 space-y-3 max-h-[500px] overflow-y-auto">
              {anomalies.map((record) => {
                const isEditing = editingId === record.id;
                return (
                  <div
                    key={record.id}
                    className="border border-gray-200 dark:border-darkborder rounded-lg p-3 sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h6 className="text-sm font-medium text-gray-900 dark:text-white">
                          {record.employee_name}
                        </h6>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {record.employee_code} &middot; {record.date}
                        </span>
                      </div>
                      {getAnomalyBadge(record.anomaly_type)}
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Check In</label>
                          <TextInput
                            type="time"
                            value={editCheckIn}
                            onChange={(e) => setEditCheckIn(e.target.value)}
                            sizing="sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Check Out</label>
                          <TextInput
                            type="time"
                            value={editCheckOut}
                            onChange={(e) => setEditCheckOut(e.target.value)}
                            sizing="sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Check In</p>
                          <p className="text-gray-900 dark:text-white font-medium">{formatTime(record.check_in_time)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Check Out</p>
                          <p className="text-gray-900 dark:text-white font-medium">{formatTime(record.check_out_time)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Hours</p>
                          <p className="text-gray-900 dark:text-white font-medium">{formatHours(record.total_hours)}</p>
                        </div>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button size="xs" color="success" disabled={saving} onClick={() => saveEdit(record.id)}>
                          <HiCheck className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button size="xs" color="gray" disabled={saving} onClick={cancelEdit}>
                          <HiX className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="xs" color="light" onClick={() => startEdit(record)}>
                          <HiPencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button size="xs" color="failure" onClick={() => deleteRecord(record.id)}>
                          <HiTrash className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block">
              <SimpleBar className="max-h-[500px]">
                <div className="overflow-x-auto">
                  <Table hoverable>
                    <Table.Head>
                      <Table.HeadCell className="p-6 text-gray-500 dark:text-gray-400 font-medium">
                        Employee
                      </Table.HeadCell>
                      <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                        Date
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
                        Issue
                      </Table.HeadCell>
                      <Table.HeadCell className="text-gray-500 dark:text-gray-400 font-medium">
                        Actions
                      </Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="divide-y divide-border dark:divide-darkborder">
                      {anomalies.map((record) => {
                        const isEditing = editingId === record.id;
                        return (
                          <Table.Row
                            key={record.id}
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
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {record.date}
                              </p>
                            </Table.Cell>
                            <Table.Cell>
                              {isEditing ? (
                                <TextInput
                                  type="time"
                                  value={editCheckIn}
                                  onChange={(e) => setEditCheckIn(e.target.value)}
                                  sizing="sm"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 dark:text-white font-medium whitespace-nowrap">
                                  {formatTime(record.check_in_time)}
                                </p>
                              )}
                            </Table.Cell>
                            <Table.Cell>
                              {isEditing ? (
                                <TextInput
                                  type="time"
                                  value={editCheckOut}
                                  onChange={(e) => setEditCheckOut(e.target.value)}
                                  sizing="sm"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 dark:text-white font-medium whitespace-nowrap">
                                  {formatTime(record.check_out_time)}
                                </p>
                              )}
                            </Table.Cell>
                            <Table.Cell>
                              <p className="text-sm text-gray-900 dark:text-white font-medium">
                                {formatHours(record.total_hours)}
                              </p>
                            </Table.Cell>
                            <Table.Cell>
                              {getAnomalyBadge(record.anomaly_type)}
                            </Table.Cell>
                            <Table.Cell>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Button size="xs" color="success" disabled={saving} onClick={() => saveEdit(record.id)}>
                                    <HiCheck className="h-4 w-4" />
                                  </Button>
                                  <Button size="xs" color="gray" disabled={saving} onClick={cancelEdit}>
                                    <HiX className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button size="xs" color="light" onClick={() => startEdit(record)}>
                                    <HiPencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="xs" color="failure" onClick={() => deleteRecord(record.id)}>
                                    <HiTrash className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                </div>
              </SimpleBar>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default TodayEmployeeAttendance;
