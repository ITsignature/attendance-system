import { useState, useEffect } from 'react';
import settingsApi, { SettingValue } from '../services/settingsApi';

export const useSettings = () => {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.getAllSettings();
      
      console.log('response from hooks', response);

      if (response.success) {
        setSettings(response.data.settings);
        console.log('✅ Settings fetched from use Settings:', response.data.settings);
      } else {
        setError('Failed to fetch settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any, description?: string) => {
    try {
      const response = await settingsApi.updateSetting(key, value, description);
      
      if (response.success) {
        // Update local state
        setSettings(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            value: value
          }
        }));
        return true;
      } else {
        setError('Failed to update setting');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  };

  const updateMultipleSettings = async (newSettings: Record<string, any>) => {
    try {
      const response = await settingsApi.updateSettings(newSettings);

      if (response.success) {
        // Update local state
        setSettings(prev => {
          const updated = { ...prev };
          Object.entries(newSettings).forEach(([key, value]) => {
            updated[key] = {
              ...updated[key],
              value: value
            };
          });
          return updated;
        });
        return { success: true };
      } else {
        const errorMsg = response.message || 'Failed to update settings';
        // Don't set global error state - let component handle it with alert
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      // Don't set global error state - let component handle it with alert
      return { success: false, error: errorMsg };
    }
  };

  const resetSetting = async (key: string) => {
    try {
      const response = await settingsApi.resetSetting(key);
      
      if (response.success) {
        // Refresh settings to get the default value
        await fetchSettings();
        return true;
      } else {
        setError('Failed to reset setting');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  };

  const resetAllSettings = async () => {
    try {
      const response = await settingsApi.resetAllSettings();

      if (response.success) {
        // Refresh settings to get the default values
        await fetchSettings();
        return { success: true };
      } else {
        const errorMsg = response.message || 'Failed to reset all settings';
        // Don't set global error state - let component handle it with alert
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      // Don't set global error state - let component handle it with alert
      return { success: false, error: errorMsg };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSetting,
    updateMultipleSettings,
    resetSetting,
    resetAllSettings,
  };
};