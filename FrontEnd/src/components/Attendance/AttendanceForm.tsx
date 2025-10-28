// components/Attendance/AttendanceForm.tsx

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  TextInput,
  Select,
  Label,
  Alert,
  Spinner,
  Card,
  Badge,
  Textarea
} from 'flowbite-react';
import { HiInformationCircle, HiClock, HiCalculator } from 'react-icons/hi';
import apiService from '../../services/api';

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

interface AttendanceFormData {
  employee_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  arrival_status?: 'on_time' | 'late' | 'absent';
  work_duration?: 'full_day' | 'half_day' | 'short_leave' | 'on_leave';
  break_duration?: number;
  work_type: 'office' | 'remote' | 'hybrid';
  notes?: string;
}

interface CalculationInfo {
  scheduled_start: string;
  scheduled_end: string;
  late_threshold_minutes: number;
  standard_working_hours: number;
  duration_thresholds: {
    full_day_minimum_hours: number;
    half_day_minimum_hours: number;
    short_leave_minimum_hours: number;
    working_hours_per_day: number;
  };
  arrival_status_auto_determined: boolean;
  work_duration_auto_determined: boolean;
  follows_company_schedule: boolean;
}

interface AttendanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingRecord?: AttendanceRecord | null;
  employees: any[];
}

const AttendanceForm: React.FC<AttendanceFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingRecord,
  employees
}) => {
  const [formData, setFormData] = useState<AttendanceFormData>({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    work_type: 'office'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [calculationInfo, setCalculationInfo] = useState<CalculationInfo | null>(null);
  const [autoCalculateEnabled, setAutoCalculateEnabled] = useState(true);

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        employee_id: editingRecord.employee_id,
        date: editingRecord.date,
        check_in_time: editingRecord.check_in_time || '',
        check_out_time: editingRecord.check_out_time || '',
        arrival_status: editingRecord.arrival_status,
        work_duration: editingRecord.work_duration,
        break_duration: editingRecord.break_duration || 0,
        work_type: editingRecord.work_type,
        notes: editingRecord.notes || ''
      });
      setAutoCalculateEnabled(false); // Disable auto-calc when editing
    } else {
      // Reset form for new record
      setFormData({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        work_type: 'office'
      });
      setAutoCalculateEnabled(true);
    }
    setError('');
    setCalculationInfo(null);
  }, [editingRecord, isOpen]);


  console.log('🔍 FORM DATA:', formData);
  
  const handleInputChange = (field: keyof AttendanceFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear auto-calculated fields if manual values are provided
    if ((field === 'arrival_status' || field === 'work_duration') && value) {
      setAutoCalculateEnabled(false);
    }
  };

  const calculateHours = () => {
    if (!formData.check_in_time || !formData.check_out_time) return 0;
    
    const checkIn = new Date(`2000-01-01T${formData.check_in_time}`);
    const checkOut = new Date(`2000-01-01T${formData.check_out_time}`);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    
    return Math.max(0, hours - (formData.break_duration || 0));
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    /* helper functions */
    const padSeconds = (t: string) => (t && t.length === 5 ? `${t}:00` : t);  // "17:30" → "17:30:00"
    const stripEmpty = (v: string) => (v === '' ? undefined : v);

    /* 1️⃣ build payload with ONLY changed keys */
    const payload: Record<string, any> = {};
    Object.keys(formData).forEach((k) => {
      const key = k as keyof AttendanceFormData;
      let v = formData[key];

      /* strip seconds + empty strings for time fields */
      if (k === 'check_in_time' || k === 'check_out_time') v = padSeconds(v as string);
      v = stripEmpty(v as string);

      /* include key only if value changed vs original */
      if (
        editingRecord && v !== undefined &&
        v !== (editingRecord as any)[k]
      ) {
        payload[k] = v;
      }

      /* on create → send everything except empty strings */
      if (!editingRecord && v !== undefined) {
        payload[k] = v;
      }
    });

    /* 2️⃣ remove auto-calculated fields when that option is enabled */
    if (autoCalculateEnabled) {
      delete payload.arrival_status;
      delete payload.work_duration;
    }

    /* 3️⃣ call correct endpoint */
    let response;
    if (editingRecord) {
      response = await apiService.updateAttendanceRecord(editingRecord.id, payload);
    } else {
      response = await apiService.createAttendanceRecord(payload as AttendanceFormData); // POST helper
    }

    /* 4️⃣ handle server reply */
    if (response.success) {
      setCalculationInfo(response.data.calculation_info);
      onSuccess();
    } else {
      setError(response.message || 'Failed to save attendance record');
    }
  } catch (err) {
    setError(err.message || 'Failed to save attendance record');
  } finally {
    setLoading(false);
  }
};

  const totalHours = calculateHours();

  return (
    <Modal show={isOpen} onClose={onClose} size="2xl">
      <Modal.Header>
        {editingRecord ? 'Edit Attendance Record' : 'Add Attendance Record'}
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert color="failure" icon={HiInformationCircle}>
              {error}
            </Alert>
          )}

      {/* Basic Information */}
{!editingRecord ? (
  /* CREATE MODE – employee & date selectable */
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <Label htmlFor="employee_id" value="Employee *" />
      <Select
        id="employee_id"
        required
        value={formData.employee_id}
        onChange={(e) => handleInputChange('employee_id', e.target.value)}
      >
        <option value="">Select Employee</option>
        {employees.map((emp: any) => (
          <option key={emp.id} value={emp.id}>
            {emp.first_name} {emp.last_name} ({emp.employee_code})
          </option>
        ))}
      </Select>
    </div>

    <div>
      <Label htmlFor="date" value="Date *" />
      <TextInput
        id="date"
        type="date"
        required
        value={formData.date}
        onChange={(e) => handleInputChange('date', e.target.value)}
      />
    </div>
  </div>
  ) : null /* EDIT MODE – hide the two inputs */ }

          {/* Time Information */}
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <HiClock className="mr-2" />
              Time Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="check_in_time" value="Check In Time" />
                <TextInput
                  id="check_in_time"
                  type="time"
                  value={formData.check_in_time || ''}
                  onChange={(e) => handleInputChange('check_in_time', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="check_out_time" value="Check Out Time" />
                <TextInput
                  id="check_out_time"
                  type="time"
                  value={formData.check_out_time || ''}
                  onChange={(e) => handleInputChange('check_out_time', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="break_duration" value="Break Duration (hours)" />
                <TextInput
                  id="break_duration"
                  type="number"
                  step="0.5"
                  min="0"
                  max="8"
                  value={formData.break_duration || 0}
                  onChange={(e) => handleInputChange('break_duration', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Hours Calculation Display */}
            {totalHours > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center">
                  <HiCalculator className="mr-2 text-blue-600" />
                  <span className="font-semibold text-blue-800 dark:text-blue-300">
                    Calculated Work Hours: {totalHours.toFixed(2)} hours
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Status Information */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Status Information</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_calculate"
                  checked={autoCalculateEnabled}
                  onChange={(e) => setAutoCalculateEnabled(e.target.checked)}
                  className="mr-2"
                />
                <Label htmlFor="auto_calculate" value="Auto-calculate statuses" />
              </div>
            </div>

            {!autoCalculateEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* <div>
                  <Label htmlFor="arrival_status" value="Arrival Status" />
                  <Select
                    id="arrival_status"
                    value={formData.arrival_status || ''}
                    onChange={(e) => handleInputChange('arrival_status', e.target.value)}
                  >
                    <option value="">Auto-calculate</option>
                    <option value="on_time">On Time</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                  </Select>
                </div> */}

                <div>
                  <Label htmlFor="work_duration" value="Work Duration" />
                  <Select
                    id="work_duration"
                    value={formData.work_duration || ''}
                    onChange={(e) => handleInputChange('work_duration', e.target.value)}
                  >
                    <option value="">Auto-calculate</option>
                    <option value="full_day">Full Day</option>
                    <option value="half_day">Half Day</option>
                    <option value="short_leave">Short Leave</option>
                    <option value="on_leave">On Leave</option>
                  </Select>
                </div>
              </div>
            )}

            {autoCalculateEnabled && (
              <Alert color="info" icon={HiInformationCircle}>
                Arrival status and work duration will be automatically calculated based on check-in time and work hours.
              </Alert>
            )}
          </Card>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="work_type" value="Work Type" />
              <Select
                id="work_type"
                value={formData.work_type}
                onChange={(e) => handleInputChange('work_type', e.target.value)}
              >
                <option value="office">Office</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes" value="Notes" />
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this attendance record..."
              rows={3}
            />
          </div>

          {/* Calculation Info Display */}
          {calculationInfo && (
            <Card>
              <h4 className="font-semibold mb-2">Calculation Results</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Arrival Status:</span>
                  <Badge color={calculationInfo.arrival_status_auto_determined ? 'success' : 'gray'} className="ml-2">
                    {calculationInfo.arrival_status_auto_determined ? 'Auto-calculated' : 'Manual'}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Work Duration:</span>
                  <Badge color={calculationInfo.work_duration_auto_determined ? 'success' : 'gray'} className="ml-2">
                    {calculationInfo.work_duration_auto_determined ? 'Auto-calculated' : 'Manual'}
                  </Badge>
                </div>
              </div>
            </Card>
          )}
        </form>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size="sm" className="mr-2" /> : null}
          {editingRecord ? 'Update' : 'Create'} Attendance
        </Button>
        <Button color="gray" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AttendanceForm;