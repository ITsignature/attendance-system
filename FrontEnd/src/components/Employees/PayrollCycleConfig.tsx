import React, { useState, useEffect } from 'react';
import { Card, Label, Select, TextInput, Button, Alert, Spinner, Badge } from 'flowbite-react';
import { HiCalendar, HiSave, HiX, HiInformationCircle } from 'react-icons/hi';
import apiService from '../../services/api';

interface PayrollCycleConfigProps {
  employeeId: string;
  employeeName: string;
  canEdit?: boolean;
}

interface PayrollCycleData {
  payrollCycleOverride: 'default' | 'custom';
  payrollCycleDay: number | null;
  payrollCycleEffectiveFrom: string | null;
}

const PayrollCycleConfig: React.FC<PayrollCycleConfigProps> = ({
  employeeId,
  employeeName,
  canEdit = false
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [config, setConfig] = useState<PayrollCycleData>({
    payrollCycleOverride: 'default',
    payrollCycleDay: null,
    payrollCycleEffectiveFrom: null
  });

  const [editMode, setEditMode] = useState(false);
  const [editedConfig, setEditedConfig] = useState<PayrollCycleData>(config);

  useEffect(() => {
    fetchConfig();
  }, [employeeId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.apiCall(`/api/employees/${employeeId}/payroll-cycle`);

      if (response.success) {
        const data = response.data;
        const configData: PayrollCycleData = {
          payrollCycleOverride: data.payrollCycleOverride || 'default',
          payrollCycleDay: data.payrollCycleDay,
          payrollCycleEffectiveFrom: data.payrollCycleEffectiveFrom
        };
        setConfig(configData);
        setEditedConfig(configData);
      }
    } catch (err: any) {
      console.error('Error fetching payroll cycle config:', err);
      setError(err.message || 'Failed to load payroll cycle configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validation
      if (editedConfig.payrollCycleOverride === 'custom') {
        if (!editedConfig.payrollCycleDay || editedConfig.payrollCycleDay < 1 || editedConfig.payrollCycleDay > 31) {
          setError('Cycle day must be between 1 and 31');
          return;
        }
        if (!editedConfig.payrollCycleEffectiveFrom) {
          setError('Effective from date is required for custom cycle');
          return;
        }
      }

      const response = await apiService.apiCall(`/api/employees/${employeeId}/payroll-cycle`, {
        method: 'PUT',
        body: JSON.stringify({
          cycleType: editedConfig.payrollCycleOverride,
          cycleDay: editedConfig.payrollCycleDay,
          effectiveFrom: editedConfig.payrollCycleEffectiveFrom
        })
      });

      if (response.success) {
        setConfig(editedConfig);
        setEditMode(false);
        setSuccess(response.message || 'Payroll cycle configuration updated successfully');

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Error saving payroll cycle config:', err);
      setError(err.message || 'Failed to update payroll cycle configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedConfig(config);
    setEditMode(false);
    setError(null);
  };

  const getExamplePeriod = () => {
    if (editedConfig.payrollCycleOverride === 'default') {
      return 'Example: 1st Feb 2026 to 28th Feb 2026';
    }

    const day = editedConfig.payrollCycleDay || 23;
    const endDay = day - 1; // Period ends on (cycleDay - 1) of next month
    return `Example: ${day}${getOrdinalSuffix(day)} Jan 2026 to ${endDay}${getOrdinalSuffix(endDay)} Feb 2026`;
  };

  const getOrdinalSuffix = (day: number) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <Spinner size="lg" />
          <span className="ml-3">Loading payroll cycle configuration...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <HiCalendar className="text-2xl text-blue-600 mr-2" />
          <h3 className="text-xl font-semibold">Payroll Cycle Configuration</h3>
        </div>
        {canEdit && !editMode && (
          <Button size="sm" onClick={() => setEditMode(true)}>
            Edit Configuration
          </Button>
        )}
      </div>

      {error && (
        <Alert color="failure" icon={HiInformationCircle} onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" icon={HiInformationCircle} onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="space-y-4">
        {/* Cycle Type */}
        <div>
          <Label htmlFor="cycleType" value="Payroll Cycle Type" />
          {editMode ? (
            <Select
              id="cycleType"
              value={editedConfig.payrollCycleOverride}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                payrollCycleOverride: e.target.value as 'default' | 'custom'
              })}
              className="mt-1"
            >
              <option value="default">Use Company Default (1st to End of Month)</option>
              <option value="custom">Custom Cycle Day</option>
            </Select>
          ) : (
            <div className="mt-1">
              <Badge color={config.payrollCycleOverride === 'custom' ? 'warning' : 'info'} size="lg">
                {config.payrollCycleOverride === 'custom' ? 'Custom Cycle' : 'Default Cycle'}
              </Badge>
            </div>
          )}
        </div>

        {/* Custom Cycle Day */}
        {(editMode ? editedConfig.payrollCycleOverride : config.payrollCycleOverride) === 'custom' && (
          <>
            <div>
              <Label htmlFor="cycleDay">
                Cycle Start Day (1-31)
                <span className="text-red-500 ml-1">*</span>
              </Label>
              {editMode ? (
                <>
                  <TextInput
                    id="cycleDay"
                    type="number"
                    min="1"
                    max="31"
                    value={editedConfig.payrollCycleDay || ''}
                    onChange={(e) => setEditedConfig({
                      ...editedConfig,
                      payrollCycleDay: parseInt(e.target.value) || null
                    })}
                    placeholder="e.g., 23"
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Payroll period: From this day to (day - 1) of next month. Example: Day 19 = 19th Jan to 18th Feb
                  </p>
                </>
              ) : (
                <div className="mt-1">
                  <span className="text-2xl font-bold text-blue-600">{config.payrollCycleDay}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    ({config.payrollCycleDay}{getOrdinalSuffix(config.payrollCycleDay)} of each month)
                  </span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="effectiveFrom">
                Effective From Date
                <span className="text-red-500 ml-1">*</span>
              </Label>
              {editMode ? (
                <>
                  <TextInput
                    id="effectiveFrom"
                    type="date"
                    value={editedConfig.payrollCycleEffectiveFrom || ''}
                    onChange={(e) => setEditedConfig({
                      ...editedConfig,
                      payrollCycleEffectiveFrom: e.target.value
                    })}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Date when this custom cycle should start
                  </p>
                </>
              ) : (
                <div className="mt-1">
                  <span className="font-semibold">
                    {config.payrollCycleEffectiveFrom
                      ? new Date(config.payrollCycleEffectiveFrom).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Not set'}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Example Period */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-start">
            <HiInformationCircle className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                Example Payroll Period for January 2026:
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {getExamplePeriod()}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {editMode && canEdit && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              color="blue"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              color="gray"
              onClick={handleCancel}
              disabled={saving}
            >
              <HiX className="mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PayrollCycleConfig;
