import React, { useState, useEffect } from 'react';
import { Card, Label, Button, Alert, Spinner, Badge, Select } from 'flowbite-react';
import { HiCalendar, HiRefresh, HiSave, HiX } from 'react-icons/hi';
import { FaBusinessTime, FaHome } from 'react-icons/fa';
import apiService from '../../services/api';
import {
  EmployeeWeekendSettings as WeekendSettings,
  CompanyWeekendSettings,
  DAY_NAMES,
  WEEKEND_DAY_OPTIONS
} from '../../types/employee';

interface EmployeeWeekendSettingsProps {
  employeeId: string;
  employeeName: string;
}

interface WeekendSettingsData {
  employee_settings: WeekendSettings | null;
  company_settings: CompanyWeekendSettings;
  using_company_default: boolean;
}

const EmployeeWeekendSettings: React.FC<EmployeeWeekendSettingsProps> = ({
  employeeId,
  employeeName
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<WeekendSettingsData | null>(null);
  const [formData, setFormData] = useState<WeekendSettings>({
    saturday_working: false,
    sunday_working: false,
    custom_weekend_days: []
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchWeekendSettings();
  }, [employeeId]);

  const fetchWeekendSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getEmployeeWeekendSettings(employeeId);

      if (response.success && response.data) {
        setData(response.data);

        // Set form data - use employee settings if available, otherwise company defaults
        const currentSettings = response.data.employee_settings || {
          saturday_working: response.data.company_settings.saturday_working,
          sunday_working: response.data.company_settings.sunday_working,
          custom_weekend_days: response.data.company_settings.custom_weekend_days
        };

        setFormData(currentSettings);
        setHasChanges(false);
      } else {
        setError(response.message || 'Failed to load weekend settings');
      }
    } catch (err) {
      setError('Error loading weekend settings');
      console.error('Error fetching weekend settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await apiService.updateEmployeeWeekendSettings(employeeId, formData);

      if (response.success) {
        setSuccess('Weekend settings updated successfully');
        setHasChanges(false);
        // Refresh data to get updated state
        await fetchWeekendSettings();
      } else {
        setError(response.message || 'Failed to update weekend settings');
      }
    } catch (err) {
      setError('Error updating weekend settings');
      console.error('Error updating weekend settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await apiService.resetEmployeeWeekendSettings(employeeId);

      if (response.success) {
        setSuccess('Weekend settings reset to company default');
        setHasChanges(false);
        // Refresh data to get updated state
        await fetchWeekendSettings();
      } else {
        setError(response.message || 'Failed to reset weekend settings');
      }
    } catch (err) {
      setError('Error resetting weekend settings');
      console.error('Error resetting weekend settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (field: keyof WeekendSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSuccess(null);
  };

  const handleCustomDayToggle = (dayNumber: number) => {
    const currentDays = formData.custom_weekend_days || [];
    const newDays = currentDays.includes(dayNumber)
      ? currentDays.filter(d => d !== dayNumber)
      : [...currentDays, dayNumber].sort();

    handleFormChange('custom_weekend_days', newDays);
  };

  const isWorkingDay = (dayNumber: number): boolean => {
    if (dayNumber === 6) return formData.saturday_working; // Saturday
    if (dayNumber === 0) return formData.sunday_working; // Sunday
    return (formData.custom_weekend_days || []).includes(dayNumber);
  };

  const getCompanyWorkingDay = (dayNumber: number): boolean => {
    if (!data?.company_settings) return false;

    if (dayNumber === 6) return data.company_settings.saturday_working;
    if (dayNumber === 0) return data.company_settings.sunday_working;
    return (data.company_settings.custom_weekend_days || []).includes(dayNumber);
  };

  if (loading) {
    return (
      <Card className="w-full">
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
          <span className="ml-3">Loading weekend settings...</span>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full">
        <Alert color="failure">
          Failed to load weekend settings. Please try again.
        </Alert>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <HiCalendar className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Weekend Working Schedule
              </h3>
              <p className="text-sm text-gray-600">
                Configure {employeeName}'s weekend working days
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {data.using_company_default ? (
              <Badge color="info" icon={FaBusinessTime}>
                Using Company Default
              </Badge>
            ) : (
              <Badge color="success" icon={FaHome}>
                Custom Settings
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Weekend Days Configuration */}
      <Card>
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          Weekend Working Days
        </h4>

        {/* Standard Weekend Days */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Saturday */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-sm font-medium">Saturday</Label>
                <p className="text-xs text-gray-500">
                  Company: {getCompanyWorkingDay(6) ? 'Working' : 'Non-working'}
                </p>
              </div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  checked={formData.saturday_working}
                  onChange={(e) => handleFormChange('saturday_working', e.target.checked)}
                />
                <span className="ml-2 text-sm">Working Day</span>
              </label>
            </div>

            {/* Sunday */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-sm font-medium">Sunday</Label>
                <p className="text-xs text-gray-500">
                  Company: {getCompanyWorkingDay(0) ? 'Working' : 'Non-working'}
                </p>
              </div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  checked={formData.sunday_working}
                  onChange={(e) => handleFormChange('sunday_working', e.target.checked)}
                />
                <span className="ml-2 text-sm">Working Day</span>
              </label>
            </div>
          </div>
        </div>

        {/* Custom Weekend Days */}
        <div className="border-t pt-4">
          <h5 className="text-sm font-semibold text-gray-900 mb-3">
            Custom Weekend Days
          </h5>
          <p className="text-xs text-gray-600 mb-4">
            Select additional days that should be treated as weekend days for this employee
          </p>

          <div className="grid grid-cols-4 gap-2">
            {DAY_NAMES.map((dayName, index) => {
              // Skip Saturday (6) and Sunday (0) as they have their own controls
              if (index === 6 || index === 0) return null;

              const isSelected = (formData.custom_weekend_days || []).includes(index);
              const isCompanyWeekend = getCompanyWorkingDay(index);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleCustomDayToggle(index)}
                  className={`p-2 text-xs rounded border transition-colors ${
                    isSelected
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{dayName}</div>
                  {isCompanyWeekend && (
                    <div className="text-xs text-blue-600">Company</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Weekly Schedule Preview */}
      <Card>
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          Weekly Schedule Preview
        </h4>

        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((dayName, index) => {
            const isWorking = isWorkingDay(index);
            const isCompanyWorking = getCompanyWorkingDay(index);
            const isDifferentFromCompany = isWorking !== isCompanyWorking;

            return (
              <div
                key={index}
                className={`p-3 text-center rounded-lg border ${
                  isWorking
                    ? 'bg-green-100 border-green-300 text-green-800'
                    : 'bg-red-100 border-red-300 text-red-800'
                }`}
              >
                <div className="font-medium text-sm">{dayName.slice(0, 3)}</div>
                <div className="text-xs mt-1">
                  {isWorking ? 'Work' : 'Off'}
                </div>
                {isDifferentFromCompany && (
                  <div className="text-xs mt-1 font-semibold">
                    (Override)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Action Buttons */}
      <Card>
        <div className="flex items-center justify-between">
          <Button
            color="gray"
            onClick={handleReset}
            disabled={saving || data.using_company_default}
            icon={HiRefresh}
          >
            Reset to Company Default
          </Button>

          <div className="flex space-x-3">
            <Button
              color="gray"
              onClick={fetchWeekendSettings}
              disabled={saving}
              icon={HiX}
            >
              Cancel Changes
            </Button>

            <Button
              color="blue"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              icon={saving ? Spinner : HiSave}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployeeWeekendSettings;