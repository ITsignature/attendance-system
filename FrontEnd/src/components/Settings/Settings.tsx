import React, { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import settingsApi from '../../services/settingsApi';
import { 
  Settings, 
  Shield, 
  Bell, 
  Clock,
  DollarSign,
  Eye,
  Database,
  Building,
  Globe,
  Save,
  RefreshCw,
  ChevronRight,
  Download,
  Upload
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

  const [activeSection, setActiveSection] = useState('general');
  // FIX: Initialize with null instead of empty object
  const [localSettings, setLocalSettings] = useState<Record<string, any> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

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
      
      // 🔧 DEBUG: Special logging for overtime_enabled to track the issue
      if (key === 'overtime_enabled') {
        console.log(`🔍 DEBUG overtime_enabled conversion:`, {
          original: setting.value,
          originalType: typeof setting.value,
          converted: converted[key],
          convertedType: typeof converted[key]
        });
      }
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

  const settingSections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
    { id: 'privacy', label: 'Privacy', icon: Eye },
    { id: 'integration', label: 'Integration', icon: Database }
  ];

const updateLocalSetting = (key: string, value: any) => {
  console.log(`🔍 DEBUG updateLocalSetting - Key: "${key}", Value: "${value}", Type: ${typeof value}`);
  
  // 🔧 DEBUG: Special logging for overtime_enabled
  if (key === 'overtime_enabled') {
    console.log(`🔍 DEBUG overtime_enabled updateLocalSetting:`, {
      newValue: value,
      newValueType: typeof value,
      currentLocalValue: localSettings?.overtime_enabled,
      currentLocalType: typeof localSettings?.overtime_enabled
    });
  }
  
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
      const success = await updateMultipleSettings(changedSettings);
      if (success) {
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
        alert('Failed to save settings. Please try again.');
      }
    } else {
      setHasChanges(false);
      alert('No changes to save.');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('An error occurred while saving settings.');
  } finally {
    setSaving(false);
  }
};

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      setSaving(true);
      try {
        const success = await resetAllSettings();
        if (success) {
          setHasChanges(false);
          alert('All settings reset to defaults successfully!');
        } else {
          alert('Failed to reset settings. Please try again.');
        }
      } catch (error) {
        console.error('Error resetting settings:', error);
        alert('An error occurred while resetting settings.');
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
      case 'general':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">General Settings</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Company Name
                </label>
                <input
                  type="text"
                  value={localSettings.company_name || ''}
                  onChange={(e) => updateLocalSetting('company_name', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Timezone
                </label>
                <select
                  value={localSettings.timezone || 'UTC+00:00'}
                  onChange={(e) => updateLocalSetting('timezone', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="UTC+00:00">UTC+00:00</option>
                  <option value="UTC+05:30">UTC+05:30 (Sri Lanka)</option>
                  <option value="UTC-05:00">UTC-05:00 (EST)</option>
                  <option value="UTC-08:00">UTC-08:00 (PST)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date Format
                </label>
                <select
                  value={localSettings.date_format || 'YYYY-MM-DD'}
                  onChange={(e) => updateLocalSetting('date_format', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Currency
                </label>
                <select
                  value={localSettings.currency || 'USD'}
                  onChange={(e) => updateLocalSetting('currency', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="LKR">LKR - Sri Lankan Rupee</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Security Settings</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password Expiry (days)
                </label>
                <input
                  type="number"
                  value={localSettings.password_expiry_days || 90}
                  onChange={(e) => updateLocalSetting('password_expiry_days', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={localSettings.session_timeout_minutes || 30}
                  onChange={(e) => updateLocalSetting('session_timeout_minutes', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Login Attempts
                </label>
                <input
                  type="number"
                  value={localSettings.max_login_attempts || 5}
                  onChange={(e) => updateLocalSetting('max_login_attempts', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.two_factor_auth_enabled || false}
                  onChange={(e) => updateLocalSetting('two_factor_auth_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Two-Factor Authentication
                </label>
              </div>
            </div>
          </div>
        );

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
              <div className="border-t pt-6 mt-6">
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
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notification Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.email_notifications_enabled || false}
                  onChange={(e) => updateLocalSetting('email_notifications_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Email Notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.push_notifications_enabled || false}
                  onChange={(e) => updateLocalSetting('push_notifications_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Push Notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.sms_notifications_enabled || false}
                  onChange={(e) => updateLocalSetting('sms_notifications_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable SMS Notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.weekly_reports_enabled || false}
                  onChange={(e) => updateLocalSetting('weekly_reports_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Weekly Reports
                </label>
              </div>
            </div>
          </div>
        );

      case 'payroll':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Payroll Settings</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
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
              </div>

              {/* OVERTIME SETTINGS */}
              <div className="border-t pt-6 mt-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Overtime Configuration
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localSettings.overtime_enabled || false}
                      onChange={(e) => updateLocalSetting('overtime_enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Enable Overtime Calculations
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    When enabled, overtime will be calculated and applied to payroll
                  </p>

                  {localSettings.overtime_enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Regular Overtime Rate Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="3"
                          value={localSettings.overtime_rate_multiplier || 1.5}
                          onChange={(e) => updateLocalSetting('overtime_rate_multiplier', parseFloat(e.target.value))}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Multiplier for regular overtime pay (e.g., 1.5 = 150% of regular rate)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Weekend Hours Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="3"
                          value={localSettings.working_hours_config?.weekend_hours_multiplier || 1.5}
                          onChange={(e) => {
                            const current = localSettings.working_hours_config || {};
                            updateLocalSetting('working_hours_config', {
                              ...current,
                              weekend_hours_multiplier: parseFloat(e.target.value)
                            });
                          }}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Pay multiplier for weekend work (e.g., 1.5 = 150% of regular rate)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Holiday Hours Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={localSettings.working_hours_config?.holiday_hours_multiplier || 2.5}
                          onChange={(e) => {
                            const current = localSettings.working_hours_config || {};
                            updateLocalSetting('working_hours_config', {
                              ...current,
                              holiday_hours_multiplier: parseFloat(e.target.value)
                            });
                          }}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Pay multiplier for holiday work (e.g., 2.5 = 250% of regular rate)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Privacy Settings</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data Retention (years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={localSettings.data_retention_years || 7}
                  onChange={(e) => updateLocalSetting('data_retention_years', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.audit_logs_enabled || false}
                  onChange={(e) => updateLocalSetting('audit_logs_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Audit Logs
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.anonymize_data_enabled || false}
                  onChange={(e) => updateLocalSetting('anonymize_data_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Anonymize Sensitive Data
                </label>
              </div>
            </div>
          </div>
        );

      case 'integration':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Integration Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.email_integration_enabled || false}
                  onChange={(e) => updateLocalSetting('email_integration_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Email Integration
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.calendar_sync_enabled || false}
                  onChange={(e) => updateLocalSetting('calendar_sync_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable Calendar Sync
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Backup Frequency
                </label>
                <select
                  value={localSettings.backup_frequency || 'weekly'}
                  onChange={(e) => updateLocalSetting('backup_frequency', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </div>
        );

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
                  {settingSections.map((section) => {
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
      </div>
    </div>
  );
};

export default SettingsWithBackend;