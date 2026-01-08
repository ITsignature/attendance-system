import React, { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import settingsApi from '../../services/settingsApi';
import leaveApiService, { LeaveType, CreateLeaveTypeData } from '../../services/leaveApi';
import PayrollSettings from './PayrollSettings';
import { useDynamicRBAC, DynamicProtectedComponent } from '../RBACSystem/rbacSystem';

import {
  Settings,
  Clock,
  DollarSign,
  Building,
  Globe,
  Save,
  RefreshCw,
  ChevronRight,
  Download,
  Upload,
  Calendar,
  Plus,
  Edit,
  Trash2,
  X
} from 'lucide-react';

const SettingsWithBackend = () => {
  const {
    settings,
    loading,
    error,
    fetchSettings,
    updateMultipleSettings,
    resetAllSettings
  } = useSettings();

  const { hasPermission } = useDynamicRBAC();

  const [activeSection, setActiveSection] = useState<string>('');
  // FIX: Initialize with null instead of empty object
  const [localSettings, setLocalSettings] = useState<Record<string, any> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Leave Types state
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false);
  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [leaveTypeFormData, setLeaveTypeFormData] = useState<CreateLeaveTypeData>({
    name: '',
    description: '',
    max_days_per_year: 0,
    max_consecutive_days: 0,
    is_paid: true,
    requires_approval: true,
    notice_period_days: 0
  });

  // 🔧 FIX: Force refresh settings when component mounts to avoid stale data
  useEffect(() => {
    console.log('🔄 Settings component mounted - forcing fresh data fetch...');
    fetchSettings();
  }, []); // Run once on mount

  // Convert backend settings to local format
  // useEffect(() => {
  //   if (settings && Object.keys(settings).length > 0) {
  //     console.log('🔍 Converting backend settings to local format:', settings);
  //     const converted: Record<string, any> = {};
  //     Object.entries(settings).forEach(([key, setting]) => {
  //       converted[key] = setting.value;
  //     });
  //     console.log('🔍 Converted settings:', converted);
  //     setLocalSettings(converted);
  //   }
  // }, [settings]);

  useEffect(() => {
  if (settings && Object.keys(settings).length > 0) {
    console.log('🔍 Converting backend settings to local format:', settings);
    
    const converted: Record<string, any> = {};

    const cleanValue = (val: any) => {
      if (typeof val !== 'string') return val;

      const trimmed = val.trim();

      // Remove extra quotes like "\"08:30\"" → "08:30"
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        const unquoted = trimmed.slice(1, -1);
        
        // 🔧 FIX: Handle boolean conversion for string booleans
        if (unquoted === 'true') return true;
        if (unquoted === 'false') return false;
        
        return unquoted;
      }

      // 🔧 FIX: Handle direct boolean strings  
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;

      return trimmed;
    };

    Object.entries(settings).forEach(([key, setting]) => {
      converted[key] = cleanValue(setting.value);
    });

    console.log('🔍 Converted settings:', converted);
    setLocalSettings(converted);
  }
}, [settings]);

/* ─── auto-compute working_hours_per_day ───────────────────────── */
useEffect(() => {
  if (!localSettings) return;

  const { work_start_time: s, work_end_time: e } = localSettings;

  if (s && e) {
    let diff = hhmmToMinutes(e) - hhmmToMinutes(s);
    if (diff < 0) diff += 24 * 60;              // handles overnight shifts

    // round to nearest 0.5 hours (30 min steps)
    const hours = Math.round(diff / 30) / 2;

    if (hours !== localSettings.working_hours_per_day) {
      setLocalSettings((prev) => ({
        ...prev,
        working_hours_per_day: hours
      }));
      setHasChanges(true);                       // mark as dirty so the Save bar appears
    }
  } else if (localSettings.working_hours_per_day !== null) {
    // if either time cleared, reset hours field
    setLocalSettings((prev) => ({
      ...prev,
      working_hours_per_day: null
    }));
    setHasChanges(true);
  }
}, [
  localSettings?.work_start_time,
  localSettings?.work_end_time
]);

  // Load leave types when leaves tab is active
  useEffect(() => {
    if (activeSection === 'leaves') {
      loadLeaveTypes();
    }
  }, [activeSection]);

  const loadLeaveTypes = async () => {
    setLoadingLeaveTypes(true);
    try {
      const response = await leaveApiService.getLeaveTypes();
      if (response.success && response.data) {
        setLeaveTypes(response.data);
      }
    } catch (error) {
      console.error('Failed to load leave types:', error);
    } finally {
      setLoadingLeaveTypes(false);
    }
  };

  const handleCreateLeaveType = () => {
    setEditingLeaveType(null);
    setLeaveTypeFormData({
      name: '',
      description: '',
      max_days_per_year: 0,
      max_consecutive_days: 0,
      is_paid: true,
      requires_approval: true,
      notice_period_days: 0
    });
    setShowLeaveTypeModal(true);
  };

  const handleEditLeaveType = (leaveType: LeaveType) => {
    setEditingLeaveType(leaveType);
    setLeaveTypeFormData({
      name: leaveType.name,
      description: leaveType.description || '',
      max_days_per_year: leaveType.max_days_per_year || 0,
      max_consecutive_days: leaveType.max_consecutive_days || 0,
      is_paid: leaveType.is_paid,
      requires_approval: leaveType.requires_approval,
      notice_period_days: leaveType.notice_period_days || 0
    });
    setShowLeaveTypeModal(true);
  };

  const handleSaveLeaveType = async () => {
    try {
      console.log('Saving leave type:', leaveTypeFormData);

      let response;
      if (editingLeaveType) {
        console.log('Updating leave type:', editingLeaveType.id);
        response = await leaveApiService.updateLeaveType(editingLeaveType.id, leaveTypeFormData);
      } else {
        console.log('Creating new leave type');
        response = await leaveApiService.createLeaveType(leaveTypeFormData);
      }

      console.log('Save response:', response);

      if (response.success) {
        setShowLeaveTypeModal(false);
        loadLeaveTypes();
        alert(editingLeaveType ? 'Leave type updated successfully!' : 'Leave type created successfully!');
      } else {
        alert('Failed to save leave type: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to save leave type:', error);
      alert('Error: ' + (error.message || 'Failed to save leave type'));
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this leave type?')) {
      try {
        await leaveApiService.deleteLeaveType(id);
        loadLeaveTypes();
      } catch (error) {
        console.error('Failed to delete leave type:', error);
      }
    }
  };

  // Set initial active section to first visible section
  // Must be before early return to maintain consistent hook order
  const settingSections = [
    // { id: 'general', label: 'General', icon: Settings, permission: '' },
    { id: 'attendance', label: 'Attendance', icon: Clock, permission: 'settings.attendance.view' },
    { id: 'leaves', label: 'Leaves', icon: Calendar, permission: 'settings.leaves.view' },
    { id: 'payroll', label: 'Payroll', icon: DollarSign, permission: 'settings.payroll.view' },
    { id: 'payroll-config', label: 'Payroll Component Configuration', icon: Building, permission: 'settings.payroll_components.view' }
  ];

  // Filter sections based on permissions
  const visibleSections = settingSections.filter(section => hasPermission(section.permission));

  useEffect(() => {
    if (!activeSection && visibleSections.length > 0) {
      setActiveSection(visibleSections[0].id);
    }
  }, [visibleSections, activeSection]);

    if (loading || localSettings === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading settings...</span>
        </div>
      </div>
    );
  }

const updateLocalSetting = (key: string, value: any) => {
  console.log(`🔍 DEBUG updateLocalSetting - Key: "${key}", Value: "${value}", Type: ${typeof value}`);

  // Special handling for time inputs
  if (key === 'work_start_time' || key === 'work_end_time') {
    console.log(`⏰ DEBUG time input - Raw value: "${value}"`);
    if (value === '' || value === null || value === undefined) {
      console.log(`❌ DEBUG time input - Empty/null value detected for ${key}`);
      // Don't update if empty - keep the existing value
      return;
    }
  }
  
  setLocalSettings(prev => {
    const newSettings = { ...prev, [key]: value };
    console.log(`🔍 DEBUG - Updated local settings for ${key}:`, newSettings[key]);
    return newSettings;
  });
  setHasChanges(true);
};

const handleSave = async () => {
  setSaving(true);
  try {
    // Only send changed settings
    const changedSettings: Record<string, any> = {};
    Object.entries(localSettings).forEach(([key, value]) => {
      const currentValue = settings[key]?.value;
      const hasChanged = currentValue !== value;

      console.log(`🔍 DEBUG comparing ${key}:`, {
        current: currentValue,
        local: value,
        changed: hasChanged,
        currentType: typeof currentValue,
        localType: typeof value
      });

      if (hasChanged) {
        // Additional validation for time fields
        if ((key === 'work_start_time' || key === 'work_end_time') &&
            (value === '' || value === null || value === undefined)) {
          console.log(`❌ DEBUG - Skipping ${key} due to empty value`);
          return;
        }
        changedSettings[key] = value;
      }
    });

    console.log('🔍 Final changed settings to send:', changedSettings);
    console.log('🔍 LocalSettings state:', localSettings);
    console.log('🔍 Current settings state:', settings);

    if (Object.keys(changedSettings).length > 0) {
      const result = await updateMultipleSettings(changedSettings);
      if (result.success) {
        setHasChanges(false);
        alert('Settings saved successfully!');

        // 🔧 FIX: Force refresh localSettings after successful save
        // This ensures UI state matches backend immediately
        console.log('🔄 Refreshing local settings after save...');
        setTimeout(() => {
          // Re-trigger the useEffect to sync localSettings with updated settings from hook
          if (settings && Object.keys(settings).length > 0) {
            const converted: Record<string, any> = {};
            Object.entries(settings).forEach(([key, setting]) => {
              converted[key] = setting.value;
            });
            console.log('🔄 Force-updated localSettings:', converted);
            setLocalSettings({...converted}); // Force new object reference
          }
        }, 100); // Small delay to ensure hook state is updated

      } else {
        // Handle permission errors and other failures
        const errorMessage = result.error || 'Failed to save settings. Please try again.';

        // Check if it's a permission error
        if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
          alert('You do not have permission to modify these settings.');
        } else {
          alert(errorMessage);
        }

        // Stay on the page - don't redirect
        console.error('Settings save failed:', errorMessage);
      }
    } else {
      setHasChanges(false);
      alert('No changes to save.');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    const errorMsg = error instanceof Error ? error.message : 'An error occurred while saving settings.';

    // Check if it's a permission error
    if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
      alert('You do not have permission to modify these settings.');
    } else {
      alert(errorMsg);
    }
  } finally {
    setSaving(false);
  }
};

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      setSaving(true);
      try {
        const result = await resetAllSettings();
        if (result.success) {
          setHasChanges(false);
          alert('All settings reset to defaults successfully!');
        } else {
          // Handle permission errors and other failures
          const errorMessage = result.error || 'Failed to reset settings. Please try again.';

          // Check if it's a permission error
          if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
            alert('You do not have permission to reset these settings.');
          } else {
            alert(errorMessage);
          }

          console.error('Settings reset failed:', errorMessage);
        }
      } catch (error) {
        console.error('Error resetting settings:', error);
        const errorMsg = error instanceof Error ? error.message : 'An error occurred while resetting settings.';

        // Check if it's a permission error
        if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
          alert('You do not have permission to reset these settings.');
        } else {
          alert(errorMsg);
        }
      } finally {
        setSaving(false);
      }
    }
  };

  const handleExport = async () => {
    try {
      const response = await settingsApi.exportSettings();
      
      // Create download
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting settings:', error);
      alert('Failed to export settings.');
    }
  };

  /* helper: "08:30" → minutes since midnight */
const hhmmToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

  // Render different setting sections
  const renderSettingSection = () => {
    switch (activeSection) {
      // case 'general':
      //   return (
      //     <div className="space-y-6">
      //       <h3 className="text-lg font-medium text-gray-900 dark:text-white">General Settings</h3>
      //
      //       <div className="grid grid-cols-1 gap-6">
      //         <div>
      //           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      //             Company Name
      //           </label>
      //           <input
      //             type="text"
      //             value={localSettings.company_name || ''}
      //             onChange={(e) => updateLocalSetting('company_name', e.target.value)}
      //             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      //           />
      //         </div>
      //
      //         <div>
      //           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      //             Timezone
      //           </label>
      //           <select
      //             value={localSettings.timezone || 'UTC+00:00'}
      //             onChange={(e) => updateLocalSetting('timezone', e.target.value)}
      //             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      //           >
      //             <option value="UTC+00:00">UTC+00:00</option>
      //             <option value="UTC+05:30">UTC+05:30 (Sri Lanka)</option>
      //             <option value="UTC-05:00">UTC-05:00 (EST)</option>
      //             <option value="UTC-08:00">UTC-08:00 (PST)</option>
      //           </select>
      //         </div>
      //
      //         <div>
      //           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      //             Date Format
      //           </label>
      //           <select
      //             value={localSettings.date_format || 'YYYY-MM-DD'}
      //             onChange={(e) => updateLocalSetting('date_format', e.target.value)}
      //             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      //           >
      //             <option value="YYYY-MM-DD">YYYY-MM-DD</option>
      //             <option value="DD/MM/YYYY">DD/MM/YYYY</option>
      //             <option value="MM/DD/YYYY">MM/DD/YYYY</option>
      //           </select>
      //         </div>
      //
      //         <div>
      //           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      //             Currency
      //           </label>
      //           <select
      //             value={localSettings.currency || 'USD'}
      //             onChange={(e) => updateLocalSetting('currency', e.target.value)}
      //             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      //           >
      //             <option value="USD">USD - US Dollar</option>
      //             <option value="LKR">LKR - Sri Lankan Rupee</option>
      //             <option value="EUR">EUR - Euro</option>
      //             <option value="GBP">GBP - British Pound</option>
      //           </select>
      //         </div>
      //       </div>
      //     </div>
      //   );

      case 'attendance':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Attendance Settings</h3>          
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Work Start Time
                </label>
                <input
                  type="time"
                  value={localSettings.work_start_time || null}
                  onChange={(e) => updateLocalSetting('work_start_time', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Work End Time
                </label>
                <input
                  type="time"
                  value={localSettings.work_end_time || null}
                  onChange={(e) => updateLocalSetting('work_end_time', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Working Hours Per Day
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={localSettings.working_hours_per_day || ''}
                  onChange={(e) => updateLocalSetting('working_hours_per_day', parseFloat(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Late Threshold (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={localSettings.late_threshold_minutes || 15}
                  onChange={(e) => updateLocalSetting('late_threshold_minutes', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  How many minutes late before marked as "late"
                </p>
              </div>

              {/* NEW ATTENDANCE SETTINGS */}
              <div className="border-t pt-6 mt-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Attendance Classification
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Full Day Minimum Hours
                    </label>
                    <input
                    type="number"
                    step="0.5"
                    min="6"
                    max="12"
                    value={localSettings.full_day_minimum_hours || 7}
                    onChange={(e) => updateLocalSetting('full_day_minimum_hours', parseFloat(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Minimum hours to be considered full day (default: 7 hours)
                    </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Half Day Minimum Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="8"
                    value={localSettings.half_day_minimum_hours || 4}
                    onChange={(e) => updateLocalSetting('half_day_minimum_hours', parseFloat(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Minimum hours to be considered half day (default: 4 hours)
                  </p>
                </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Short Leave Minimum Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="4"
                      value={localSettings.short_leave_minimum_hours || 1}
                      onChange={(e) => updateLocalSetting('short_leave_minimum_hours', parseFloat(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Minimum hours to be considered short leave (default: 1 hour)
                    </p>
                 </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Work Duration Classification Rules
                  </h5>
                  <div className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <p>• <strong>Less than {localSettings.short_leave_minimum_hours || 1} hours:</strong> Absent</p>
                    <p>• <strong>{localSettings.short_leave_minimum_hours || 1} to {(localSettings.half_day_minimum_hours || 4) - 0.1} hours:</strong> Short Leave</p>
                    <p>• <strong>{localSettings.half_day_minimum_hours || 4} to {(localSettings.full_day_minimum_hours || 7) - 0.1} hours:</strong> Half Day</p>
                    <p>• <strong>{localSettings.full_day_minimum_hours || 7}+ hours:</strong> Full Day</p>
                  </div>
                </div>
              </div>

              {/* WEEKEND WORKING DAYS CONFIGURATION */}
              {/* <div className="border-t pt-6 mt-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Weekend Working Days
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="saturday_working"
                      checked={localSettings.weekend_working_days?.saturday_working || false}
                      onChange={(e) => {
                        const current = localSettings.weekend_working_days || { saturday_working: false, sunday_working: false, custom_weekend_days: [] };
                        updateLocalSetting('weekend_working_days', {
                          ...current,
                          saturday_working: e.target.checked
                        });
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="saturday_working" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Saturday is a working day
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="sunday_working"
                      checked={localSettings.weekend_working_days?.sunday_working || false}
                      onChange={(e) => {
                        const current = localSettings.weekend_working_days || { saturday_working: false, sunday_working: false, custom_weekend_days: [] };
                        updateLocalSetting('weekend_working_days', {
                          ...current,
                          sunday_working: e.target.checked
                        });
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sunday_working" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Sunday is a working day
                    </label>
                  </div>

                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <h5 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                      Weekend Working Configuration
                    </h5>
                    <div className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
                      <p>• When weekend days are marked as working days, they will be included in payroll calculations</p>
                      <p>• Weekend work may apply different overtime multipliers (configure in Working Hours)</p>
                      <p>• This affects attendance tracking and working days calculations</p>
                    </div>
                  </div>
                </div>
              </div> */}

              {/* Day-Specific Schedules Configuration */}
              {/* <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Day-Specific Schedule Override
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Configure special working hours for specific days (e.g., Saturday half-day)
                </p>

                <div className="space-y-4">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                    const daySchedule = localSettings.day_specific_schedules?.[day];
                    const isEnabled = daySchedule?.enabled || false;
                    
                    return (
                      <div key={day} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`${day}_schedule_override`}
                              checked={isEnabled}
                              onChange={(e) => {
                                const current = localSettings.day_specific_schedules || {};
                                const dayConfig = current[day] || { scheduled_hours: 8, salary_weight: 8, apply_to_all: true };
                                updateLocalSetting('day_specific_schedules', {
                                  ...current,
                                  [day]: {
                                    ...dayConfig,
                                    enabled: e.target.checked
                                  }
                                });
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`${day}_schedule_override`} className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                              {day} Override
                            </label>
                          </div>
                        </div>

                        {isEnabled && (
                          <div className="grid grid-cols-2 gap-4 ml-7">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Scheduled Hours
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                value={daySchedule?.scheduled_hours || 8}
                                onChange={(e) => {
                                  const current = localSettings.day_specific_schedules || {};
                                  const dayConfig = current[day] || { scheduled_hours: 8, salary_weight: 8, apply_to_all: true };
                                  updateLocalSetting('day_specific_schedules', {
                                    ...current,
                                    [day]: {
                                      ...dayConfig,
                                      scheduled_hours: parseFloat(e.target.value) || 0
                                    }
                                  });
                                }}
                                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                                placeholder="8"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Salary Weight (Hours)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                value={daySchedule?.salary_weight || 8}
                                onChange={(e) => {
                                  const current = localSettings.day_specific_schedules || {};
                                  const dayConfig = current[day] || { scheduled_hours: 8, salary_weight: 8, apply_to_all: true };
                                  updateLocalSetting('day_specific_schedules', {
                                    ...current,
                                    [day]: {
                                      ...dayConfig,
                                      salary_weight: parseFloat(e.target.value) || 0
                                    }
                                  });
                                }}
                                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                                placeholder="8"
                              />
                            </div>
                            <div className="col-span-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${day}_apply_to_all`}
                                  checked={daySchedule?.apply_to_all !== false}
                                  onChange={(e) => {
                                    const current = localSettings.day_specific_schedules || {};
                                    const dayConfig = current[day] || { scheduled_hours: 8, salary_weight: 8, apply_to_all: true };
                                    updateLocalSetting('day_specific_schedules', {
                                      ...current,
                                      [day]: {
                                        ...dayConfig,
                                        apply_to_all: e.target.checked
                                      }
                                    });
                                  }}
                                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`${day}_apply_to_all`} className="text-xs text-gray-600 dark:text-gray-400">
                                  Apply to all employees
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                      Day-Specific Schedule Example
                    </h5>
                    <div className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                      <p>• <strong>Saturday Half-Day:</strong> Scheduled Hours: 4, Salary Weight: 8.5</p>
                      <p>• Employee works 4 hours but gets paid for 8.5 hours (full day salary)</p>
                      <p>• If overtime is disabled, extra hours beyond scheduled won't add overtime pay</p>
                      <p>• Use "Apply to all employees" to set organization-wide policies</p>
                    </div>
                  </div>
                </div>
              </div> */}
            </div>
          </div>
        );

      case 'leaves':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Leave Settings</h3>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Number of Paid Leaves (per month)
                </label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={localSettings.paid_leaves_per_month || 2}
                  onChange={(e) => updateLocalSetting('paid_leaves_per_month', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Total number of paid leave days allowed per employee per month
                </p>
              </div>
            </div>

            {/* Leave Types Management */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-white">Leave Types</h4>
                <button
                  onClick={handleCreateLeaveType}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Add Leave Type
                </button>
              </div>

              {loadingLeaveTypes ? (
                <div className="text-center py-8">Loading leave types...</div>
              ) : (
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Max Days/Year</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Requires Approval</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Notice Days</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {leaveTypes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            No leave types configured. Click "Add Leave Type" to create one.
                          </td>
                        </tr>
                      ) : (
                        leaveTypes.map((leaveType) => (
                          <tr key={leaveType.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{leaveType.name}</div>
                              {leaveType.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">{leaveType.description}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {leaveType.max_days_per_year || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                leaveType.is_paid
                                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                                  : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                              }`}>
                                {leaveType.is_paid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {leaveType.requires_approval ? 'Yes' : 'No'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {leaveType.notice_period_days || 0} days
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleEditLeaveType(leaveType)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                              >
                                <Edit size={16} className="inline" />
                              </button>
                              <button
                                onClick={() => handleDeleteLeaveType(leaveType.id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 size={16} className="inline" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'payroll':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Payroll Settings</h3>
            
            <div className="grid grid-cols-1 gap-6">
              {/* <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payroll Cycle
                </label>
                <select
                  value={localSettings.payroll_cycle || 'monthly'}
                  onChange={(e) => updateLocalSetting('payroll_cycle', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Salary Processing Date
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={localSettings.salary_processing_date || 25}
                  onChange={(e) => updateLocalSetting('salary_processing_date', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Day of the month to process salaries
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tax Calculation Method
                </label>
                <select
                  value={localSettings.tax_calculation_method || 'standard'}
                  onChange={(e) => updateLocalSetting('tax_calculation_method', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="standard">Standard Deduction</option>
                  <option value="itemized">Itemized Deduction</option>
                  <option value="custom">Custom Method</option>
                </select>
              </div> */}

              {/* OVERTIME SETTINGS - Now managed at employee level */}
              <div className="border-t pt-6 mt-6">
                {/* <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"> */}
                  {/* <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Overtime Configuration Moved
                  </h5> */}
                  {/* <div className="text-sm text-blue-800 dark:text-blue-400"> */}
                    {/* <p>Overtime settings are now configured at the individual employee level in the Professional Information section when adding/editing employees.</p>
                    <p className="mt-2">This allows you to enable overtime calculations for specific employees only.</p> */}
                  {/* </div> */}
                {/* </div> */}
              </div>
            </div>
          </div>
        );

      case 'payroll-config':
        return <PayrollSettings />;

      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Settings for {activeSection} are not yet implemented.
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Configure your HRMS system preferences and security settings
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Settings
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Settings Categories
                </h2>
                <nav className="space-y-2">
                  {visibleSections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center px-3 py-2 text-left rounded-md transition-colors ${
                          activeSection === section.id
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        {section.label}
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                {renderSettingSection()}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        {hasChanges && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You have unsaved changes
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                  Reset All
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Type Modal */}
        {showLeaveTypeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {editingLeaveType ? 'Edit Leave Type' : 'Create Leave Type'}
                  </h3>
                  <button
                    onClick={() => setShowLeaveTypeModal(false)}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={leaveTypeFormData.name}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Annual Leave, Sick Leave"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={leaveTypeFormData.description}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Optional description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Days per Year *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={leaveTypeFormData.max_days_per_year}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, max_days_per_year: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Consecutive Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={leaveTypeFormData.max_consecutive_days}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, max_consecutive_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notice Period (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={leaveTypeFormData.notice_period_days}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, notice_period_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Minimum days notice required"
                  />
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={leaveTypeFormData.is_paid}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, is_paid: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Paid Leave</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={leaveTypeFormData.requires_approval}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, requires_approval: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Requires Approval</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                <button
                  onClick={() => setShowLeaveTypeModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLeaveType}
                  disabled={!leaveTypeFormData.name || leaveTypeFormData.max_days_per_year === 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingLeaveType ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsWithBackend;