import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  TextInput,
  Select,
  Button,
  Badge,
  Spinner,
} from 'flowbite-react';
import { HiArrowLeft, HiArrowRight, HiCalendar, HiCheck, HiSave } from 'react-icons/hi';
import apiService from '../../services/api';

type WorkType = 'office' | 'remote' | 'hybrid';

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  employee_code?: string;
  department_name?: string;
};

type AttendanceRow = {
  recordId?: string;               // existing attendance id (for PATCH)
  employee: Employee;
  check_in_time: string;           // "HH:MM"
  check_out_time: string;          // "HH:MM"
  work_type: WorkType | '';
  notes: string;
  dirty: boolean;
  saving?: boolean;
  error?: string | null;
};

type AttendanceApiRow = {
  id: string;
  employee_id: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  work_type?: WorkType | null;
  notes?: string | null;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const toTimeInput = (t?: string | null) => {
  // Accept "HH:MM" or "HH:MM:SS" and normalize to "HH:MM"
  if (!t) return '';
  const [h, m] = t.split(':');
  if (!h || !m) return '';
  return `${pad2(Number(h))}:${pad2(Number(m))}`;
};

const ManualAttendanceSheet: React.FC = () => {
  const [date, setDate] = useState<string>(todayStr());
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  // --- Load employees once
  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.apiCall<{ employees: Employee[] }>(
          '/api/employees?limit=10000&page=1'
        );
        setEmployees(res?.data?.employees || []);
      } catch (e) {
        console.error('Failed to load employees', e);
      }
    })();
  }, []);

  // --- Load attendance for selected date and merge with employees
  const loadForDate = async (selectedDate: string) => {
    setLoading(true);
    try {
      // Fetch existing attendance for the date
      const res = await apiService.getAttendanceRecords({
        page: 1,
        limit: 10000,
        startDate: selectedDate,
        endDate: selectedDate,
        sortBy: 'employee_id',
        sortOrder: 'ASC',
      });

      const existing: AttendanceApiRow[] = res?.data?.attendance || [];
      const byEmp = new Map(existing.map(r => [r.employee_id, r]));

      const nextRows: AttendanceRow[] = employees.map((emp) => {
        const rec = byEmp.get(emp.id);
        return {
          recordId: rec?.id,
          employee: emp,
          check_in_time: toTimeInput(rec?.check_in_time) || '',
          check_out_time: toTimeInput(rec?.check_out_time) || '',
          work_type: (rec?.work_type as WorkType) || '',
          notes: rec?.notes || '',
          dirty: false,
        };
      });

      setRows(nextRows);
    } catch (e) {
      console.error('Failed to load attendance for date', e);
      // still show rows with empty fields for employees
      setRows(employees.map(emp => ({
        employee: emp,
        check_in_time: '',
        check_out_time: '',
        work_type: '',
        notes: '',
        dirty: false,
      })));
    } finally {
      setLoading(false);
    }
  };

  // Reload rows whenever date or employees change (after employees have loaded)
  useEffect(() => {
    if (employees.length) loadForDate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, employees]);

  // ---- Utils
  const changeDateBy = (deltaDays: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    setDate(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  };

  const setRowField = (idx: number, patch: Partial<AttendanceRow>) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, dirty: true, error: null };
      return next;
    });
  };

  const isTimeValid = (val: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(val || '');

  const rowStatusBadge = (r: AttendanceRow) => {
    if (r.saving) return <Badge color="info">Saving…</Badge>;
    if (r.error) return <Badge color="failure">Error</Badge>;
    if (r.dirty) return <Badge color="warning">Unsaved</Badge>;
    return <Badge color="success">Saved</Badge>;
  };

  // --- Save one row (upsert): PATCH if recordId exists, else POST
  const saveRow = async (idx: number) => {
    setRows(prev => {
      const next = [...prev];
      next[idx].saving = true;
      next[idx].error = null;
      return next;
    });

    const r = rows[idx];
    const payload = {
      employee_id: r.employee.id,
      date,
      check_in_time: r.check_in_time || undefined,
      check_out_time: r.check_out_time || undefined,
      work_type: r.work_type || undefined,
      notes: r.notes || undefined,
    };

    try {
      if (r.recordId) {
        await apiService.apiCall(`/api/attendance/${r.recordId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            check_in_time: payload.check_in_time,
            check_out_time: payload.check_out_time,
            work_type: payload.work_type,
            notes: payload.notes,
          }),
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        const createRes = await apiService.apiCall<{ id: string }>('/api/attendance', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        });
        // If backend returns created id → keep it so subsequent saves are PATCH
        const createdId = (createRes as any)?.data?.id;
        if (createdId) {
          setRows(prev => {
            const next = [...prev];
            next[idx].recordId = createdId;
            return next;
          });
        }
      }

      setRows(prev => {
        const next = [...prev];
        next[idx].saving = false;
        next[idx].dirty = false;
        next[idx].error = null;
        return next;
      });
    } catch (e: any) {
      console.error('Save row failed', e);
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
      // serial or parallel; we’ll do parallel with a soft cap to avoid hammering backend
      await Promise.all(rows.map(async (r, i) => r.dirty ? saveRow(i) : undefined));
    } finally {
      setSavingAll(false);
    }
  };

  const quickFill = (fill: { work_type?: WorkType; check_in_time?: string; check_out_time?: string }) => {
    setRows(prev => prev.map(r => ({
      ...r,
      work_type: fill.work_type ?? r.work_type,
      check_in_time: fill.check_in_time ?? r.check_in_time,
      check_out_time: fill.check_out_time ?? r.check_out_time,
      dirty: true,
    })));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manual Attendance Sheet</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter work location and in/out times for every employee on a selected date.
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

      {/* Quick actions */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={() => quickFill({ work_type: 'office', check_in_time: '09:00', check_out_time: '17:00' })}>
            Fill All: Office 09:00–17:00
          </Button>
          <Button size="sm" onClick={() => quickFill({ work_type: 'remote' })}>
            Set All: Remote
          </Button>
          <Button size="sm" color="gray" onClick={() => quickFill({ check_in_time: '', check_out_time: '' })}>
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
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Employee</Table.HeadCell>
                <Table.HeadCell>Work Location</Table.HeadCell>
                <Table.HeadCell>In Time</Table.HeadCell>
                <Table.HeadCell>Out Time</Table.HeadCell>
                <Table.HeadCell>Notes</Table.HeadCell>
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
                        <Select
                          value={r.work_type || ''}
                          onChange={(e) => setRowField(idx, { work_type: e.target.value as WorkType | '' })}
                        >
                          <option value="">Select…</option>
                          <option value="office">Office</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                        </Select>
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
                      <Table.Cell>
                        <TextInput
                          value={r.notes}
                          onChange={(e) => setRowField(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </Table.Cell>
                      <Table.Cell>{rowStatusBadge(r)}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size="sm"
                          onClick={() => saveRow(idx)}
                          disabled={r.saving || (!r.dirty && !!r.recordId)}
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

export default ManualAttendanceSheet;
