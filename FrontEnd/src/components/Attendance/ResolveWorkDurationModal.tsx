// components/Attendance/ResolveWorkDurationModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Select, Button, Label, Alert, Spinner } from 'flowbite-react';
import apiService from '../../services/api';

export type WorkDurationOption = 'half_day' | 'short_leave' | 'full_day';

interface AttendanceRecordLite {
  id: string;
  employee_name?: string;
  date?: string;
  work_duration?: string | null;
}

interface ResolveWorkDurationModalProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecordLite | null;
  onSaved: () => void; // refresh table
}

const ResolveWorkDurationModal: React.FC<ResolveWorkDurationModalProps> = ({
  open,
  onClose,
  record,
  onSaved,
}) => {
  const [value, setValue] = useState<WorkDurationOption | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setValue('');
    setError('');
  }, [open, record?.id]);

  const handleSave = async () => {
    if (!record || !value) {
      setError('Please select an option.');
      return;
    }
    try {
      setSaving(true);
      setError('');

      const resp = await apiService.updateAttendanceRecord(record.id, {
        work_duration: value,
      });

      if (!resp?.success) {
        throw new Error(resp?.message || 'Failed to update work duration.');
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to update work duration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={open} size="md" onClose={onClose}>
      <Modal.Header>
        Resolve Work Duration{record?.employee_name ? ` — ${record.employee_name}` : ''}
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          {record?.date && (
            <div className="text-sm text-gray-500">
              Date: {new Date(record.date).toLocaleDateString()}
            </div>
          )}

          {error && <Alert color="failure">{error}</Alert>}

          <div>
            <Label htmlFor="wd" value="Action Required" />
            <Select
              id="wd"
              value={value}
              onChange={(e) => setValue(e.target.value as WorkDurationOption | '')}
              className="mt-1"
            >
              <option value="">Select an action…</option>
              <option value="half_day">Half Day</option>
              <option value="short_leave">Short Leave</option>
              <option value="full_day">Full day</option>
            </Select>
            <p className="mt-2 text-xs text-gray-500">
              Choose how to classify this incomplete day.
            </p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleSave} disabled={saving || !value}>
          {saving ? <Spinner size="sm" className="mr-2" /> : null}
          Apply
        </Button>
        <Button color="gray" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ResolveWorkDurationModal;
