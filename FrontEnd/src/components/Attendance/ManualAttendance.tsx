// components/Attendance/ManualAttendance.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  TextInput,
  Button,
  Badge,
  Spinner,
  Alert,
} from 'flowbite-react';
import {
  HiArrowLeft,
  HiArrowRight,
  HiCalendar,
  HiCheck,
  HiSave
} from 'react-icons/hi';
import apiService from '../../services/api';
import { useWorkingHours } from '../../hooks/useWorkingHours';

type WorkType = 'office' | 'remote' | 'hybrid';

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  employee_code?: string;
  department_name?: string;
  // Optional: if your API provides a default location per employee
  default_work_type?: WorkType;
};

type AttendanceRow = {
  employee: Employee;
  check_in_time: string;   // "HH:MM"
  check_out_time: string;  // "HH:MM"
//   notes: string;
  work_type?: WorkType | ''; // display only (read-only)
  dirty: boolean;
  saving?: boolean;
  error?: string | null;
  saved?: boolean;          // after successful POST
};

type AttendanceApiRow = {
  id: string;
  employee_id: string;
  date: string;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const isTimeValid = (val: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(val || '');
const padSeconds = (t?: string) => (t && t.length === 5 ? `${t}:00` : t);  // "17:30" → "17:30:00"

const ManualAttendance: React.FC = () => {
  const [date, setDate] = useState<string>(todayStr());
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadError, setLoadError] = useState<string>('');
  
  // Get configured working hours
  const { workingHours } = useWorkingHours();
  
  // Clean time values to remove extra quotes
  const cleanTimeValue = (timeStr: string) => {
    if (typeof timeStr !== 'string') return timeStr;
    const trimmed = timeStr.trim();
    // Remove extra quotes like "\"08:30\"" → "08:30"
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  };

  // Load employees once
  useEffect(() => {
    (async () => {
      try {
        setLoadError('');
        const res = await apiService.getEmployees({ limit: 10000, page: 1, status: 'active' });
        setEmployees(res?.data?.employees || []);
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load employees');
      }
    })();
  }, []);

  // Load “already present that day”, then build rows with only missing employees
  const loadMissingForDate = async (selectedDate: string) => {
    setLoading(true);
    try {
      const res = await apiService.getAttendanceRecords({
        page: 1,
        limit: 10000,
        startDate: selectedDate,
        endDate: selectedDate,
        sortBy: 'employee_id',
        sortOrder: 'ASC',
      });

      const existing: AttendanceApiRow[] = res?.data?.attendance || [];
      const presentIds = new Set(existing.map(r => r.employee_id));

      const toCreate = employees.filter(emp => !presentIds.has(emp.id));

      const nextRows: AttendanceRow[] = toCreate.map(emp => ({
        employee: emp,
        check_in_time: '',
        check_out_time: '',
        work_type: emp.default_work_type || 'office', // display only; not editable/not sent
        notes: '',
        dirty: false,
        saved: false,
      }));

      setRows(nextRows);
    } catch (e) {
      // If attendance load fails, still show all employees (create-only mode)
      const nextRows: AttendanceRow[] = employees.map(emp => ({
        employee: emp,
        check_in_time: '',
        check_out_time: '',
        work_type: emp.default_work_type || 'office',
        notes: '',
        dirty: false,
        saved: false,
      }));
      setRows(nextRows);
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever date or employees change
  useEffect(() => {
    if (employees.length) {
      loadMissingForDate(date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, employees]);

  const changeDateBy = (deltaDays: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    setDate(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  };

  const setRowField = (idx: number, patch: Partial<AttendanceRow>) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, dirty: true, error: null, saved: false };
      return next;
    });
  };

  const workTypeBadge = (wt?: string) => {
    const label = wt ? wt.charAt(0).toUpperCase() + wt.slice(1) : '—';
    const color =
      wt === 'office' ? 'success' :
      wt === 'remote' ? 'info' :
      wt === 'hybrid' ? 'purple' : 'gray';
    return <Badge color={color}>{label}</Badge>;
  };

  const rowStatusBadge = (r: AttendanceRow) => {
    if (r.saving) return <Badge color="info">Saving…</Badge>;
    if (r.error) return <Badge color="failure">Error</Badge>;
    if (r.saved) return <Badge color="success">Saved</Badge>;
    if (r.dirty) return <Badge color="warning">Unsaved</Badge>;
    return <Badge color="gray">—</Badge>;
  };

  // CREATE one new record
  const saveRow = async (idx: number) => {
    const r = rows[idx];

    // Kinda-basic validation for time fields
    if (r.check_in_time && !isTimeValid(r.check_in_time)) {
      setRowField(idx, { error: 'Invalid in time (HH:MM)', saving: false });
      return;
    }
    if (r.check_out_time && !isTimeValid(r.check_out_time)) {
      setRowField(idx, { error: 'Invalid out time (HH:MM)', saving: false });
      return;
    }

    setRows(prev => {
      const next = [...prev];
      next[idx].saving = true;
      next[idx].error = null;
      return next;
    });

    try {
      // Build payload similar to your working AttendanceForm (no arrival_status/work_duration)
      const payload = {
        employee_id: r.employee.id,
        date,
        check_in_time: padSeconds(r.check_in_time) || undefined,
        check_out_time: padSeconds(r.check_out_time) || undefined,
        // work_type NOT sent (work location is read-only here)
        // notes: r.notes || undefined,
      };

      const response = await apiService.createAttendanceRecord(payload as any);

      if (!response.success) {
        throw new Error(response.message || 'Create failed');
      }

      setRows(prev => {
        const next = [...prev];
        next[idx].saving = false;
        next[idx].dirty = false;
        next[idx].saved = true;
        return next;
      });
    } catch (e: any) {
      setRows(prev => {
        const next = [...prev];
        next[idx].saving = false;
        next[idx].error = e?.message || 'Save failed';
        return next;
      });
    }
  };

  const dirtyCount = useMemo(() => rows.filter(r => r.dirty).length, [rows]);

  const saveAll = async () => {
    if (!dirtyCount) return;
    setSavingAll(true);
    try {
      await Promise.all(rows.map(async (r, i) => r.dirty ? saveRow(i) : undefined));
      // Optionally reload the list to hide newly created ones:
      await loadMissingForDate(date);
    } finally {
      setSavingAll(false);
    }
  };

  const quickFillTimes = (inTime?: string, outTime?: string) => {
    setRows(prev => prev.map(r => ({
      ...r,
      check_in_time: inTime ?? r.check_in_time,
      check_out_time: outTime ?? r.check_out_time,
      dirty: true,
      saved: false,
    })));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manual Attendance (Create Only)</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Shows only employees who don’t have a record for the selected date.
          </p>
        </div>
        <div className="flex gap-2">
          <Button color="gray" onClick={() => changeDateBy(-1)}>
            <HiArrowLeft className="mr-2 h-5 w-5" /> Prev
          </Button>
          <div className="flex items-center gap-2">
            <HiCalendar className="text-gray-500" />
            <TextInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button color="gray" onClick={() => setDate(todayStr())}>Today</Button>
          <Button color="gray" onClick={() => changeDateBy(1)}>
            Next <HiArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert color="failure" className="mb-4">
          {loadError}
        </Alert>
      )}

      {/* Quick actions (times only) */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={() => quickFillTimes(cleanTimeValue(workingHours.start_time), cleanTimeValue(workingHours.end_time))}>
            Fill All Times: {cleanTimeValue(workingHours.start_time)}–{cleanTimeValue(workingHours.end_time)}
          </Button>
          <Button size="sm" color="gray" onClick={() => quickFillTimes('', '')}>
            Clear All Times
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-500">{dirtyCount} change(s)</span>
            <Button disabled={!dirtyCount || savingAll} onClick={saveAll}>
              <HiSave className="mr-2 h-5 w-5" /> Save All
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            All employees already have attendance for {date}. 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Employee</Table.HeadCell>
                <Table.HeadCell>Work Location</Table.HeadCell>
                <Table.HeadCell>In Time</Table.HeadCell>
                <Table.HeadCell>Out Time</Table.HeadCell>
                {/* <Table.HeadCell>Notes</Table.HeadCell> */}
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Action</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {rows.map((r, idx) => {
                  const ciOk = !r.check_in_time || isTimeValid(r.check_in_time);
                  const coOk = !r.check_out_time || isTimeValid(r.check_out_time);
                  return (
                    <Table.Row key={r.employee.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        <div className="font-semibold">
                          {r.employee.first_name} {r.employee.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.employee.employee_code || '—'} {r.employee.department_name ? `• ${r.employee.department_name}` : ''}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {/* Read-only badge; not sent */}
                        {workTypeBadge(r.work_type || 'office')}
                      </Table.Cell>
                      <Table.Cell>
                        <TextInput
                          type="time"
                          value={r.check_in_time}
                          onChange={(e) => setRowField(idx, { check_in_time: e.target.value })}
                          color={ciOk ? undefined : 'failure'}
                          helperText={!ciOk ? 'Format HH:MM' : undefined}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <TextInput
                          type="time"
                          value={r.check_out_time}
                          onChange={(e) => setRowField(idx, { check_out_time: e.target.value })}
                          color={coOk ? undefined : 'failure'}
                          helperText={!coOk ? 'Format HH:MM' : undefined}
                        />
                      </Table.Cell>
                      {/* <Table.Cell>
                        <TextInput
                          value={r.notes}
                          onChange={(e) => setRowField(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </Table.Cell> */}
                      <Table.Cell>{rowStatusBadge(r)}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size="sm"
                          onClick={() => saveRow(idx)}
                          disabled={r.saving || r.saved}
                        >
                          <HiCheck className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ManualAttendance;
