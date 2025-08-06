import apiService from './api';

export interface SettingValue {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  is_public?: boolean;
  updated_at?: string;
}

export interface SettingsResponse {
  success: boolean;
  data?: {
    settings: Record<string, SettingValue>;
    total?: number;
  };
  message?: string;
}

export interface SingleSettingResponse {
  success: boolean;
  data?: {
    setting_key: string;
    value: any;
    type: string;
    description?: string;
    is_public?: boolean;
    updated_at?: string;
  };
  message?: string;
}

class SettingsApiService {
  // Get all settings
  async getAllSettings(): Promise<SettingsResponse> {
    return apiService.apiCall('/api/settings');
  }

  // Get specific setting
  async getSetting(key: string): Promise<SingleSettingResponse> {
    return apiService.apiCall(`/api/settings/${key}`);
  }

  // Update single setting
  async updateSetting(key: string, value: any, description?: string): Promise<any> {
    return apiService.apiCall(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, description }),
    });
  }

  // Bulk update settings
  async updateSettings(settings: Record<string, any>): Promise<any> {
    console.log('🔄 Bulk updating settings:', settings);
    return apiService.apiCall('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  }

  // Delete setting (reset to default)
  async resetSetting(key: string): Promise<any> {
    return apiService.apiCall(`/api/settings/${key}`, {
      method: 'DELETE',
    });
  }

  // Reset all settings to defaults
  async resetAllSettings(): Promise<any> {
    return apiService.apiCall('/api/settings/reset-all', {
      method: 'POST',
    });
  }

  // Get setting categories
  async getCategories(): Promise<any> {
    return apiService.apiCall('/api/settings/meta/categories');
  }

  // Export settings backup
  async exportSettings(): Promise<any> {
    return apiService.apiCall('/api/settings/export/backup');
  }

  // Get public settings (no auth required)
  async getPublicSettings(clientId: string): Promise<any> {
    return apiService.apiCall(`/api/settings/public/all?client_id=${clientId}`);
  }

  // Helper methods for specific setting groups
  async getWorkingHours(): Promise<{
  start_time: string;
  end_time: string;
  hours_per_day: number;
  late_threshold: number;
  overtime_rate: number;
  full_day_minimum_hours: number;
  half_day_minimum_hours: number;
  short_leave_minimum_hours: number;
}> {
  try {
    const settings = await this.getAllSettings();
    
    if (!settings || !settings.success || !settings.data || !settings.data.settings) {
      console.warn('Failed to fetch settings, using defaults');
      return {
        start_time: '09:00',
        end_time: '17:00',
        hours_per_day: 8,
        late_threshold: 15,
        overtime_rate: 1.5,
        full_day_minimum_hours: 7,
        half_day_minimum_hours: 4,
        short_leave_minimum_hours: 1,
      };
    }

    const settingsData = settings.data.settings;

    return {
      start_time: settingsData.work_start_time?.value || '09:00',
      end_time: settingsData.work_end_time?.value || '17:00',
      hours_per_day: settingsData.working_hours_per_day?.value || 8,
      late_threshold: settingsData.late_threshold_minutes?.value || 15,
      overtime_rate: settingsData.overtime_rate_multiplier?.value || 1.5,
      full_day_minimum_hours: settingsData.full_day_minimum_hours?.value || 7,
      half_day_minimum_hours: settingsData.half_day_minimum_hours?.value || 4,
      short_leave_minimum_hours: settingsData.short_leave_minimum_hours?.value || 1,
    };
  } catch (error) {
    console.error('Error fetching working hours:', error);
    return {
      start_time: '09:00',
      end_time: '17:00',
      hours_per_day: 8,
      late_threshold: 15,
      overtime_rate: 1.5,
      full_day_minimum_hours: 7,
      half_day_minimum_hours: 4,
      short_leave_minimum_hours: 1,
    };
  }
}

  async getCompanyInfo(): Promise<{
    company_name: string;
    timezone: string;
    date_format: string;
    currency: string;
    language: string;
  }> {
    try {
      const settings = await this.getAllSettings();
      
      // Add null/undefined checks
      if (!settings || !settings.success || !settings.data || !settings.data.settings) {
        console.warn('Failed to fetch settings, using defaults');
        return {
          company_name: 'Your Company',
          timezone: 'UTC+00:00',
          date_format: 'YYYY-MM-DD',
          currency: 'USD',
          language: 'English',
        };
      }

      const settingsData = settings.data.settings;

      return {
        company_name: settingsData.company_name?.value || 'Your Company',
        timezone: settingsData.timezone?.value || 'UTC+00:00',
        date_format: settingsData.date_format?.value || 'YYYY-MM-DD',
        currency: settingsData.currency?.value || 'USD',
        language: settingsData.language?.value || 'English',
      };
    } catch (error) {
      console.error('Error fetching company info:', error);
      return {
        company_name: 'Your Company',
        timezone: 'UTC+00:00',
        date_format: 'YYYY-MM-DD',
        currency: 'USD',
        language: 'English',
      };
    }
  }

  async getSecuritySettings(): Promise<{
    password_expiry_days: number;
    session_timeout_minutes: number;
    two_factor_auth_enabled: boolean;
    max_login_attempts: number;
    account_lockout_duration: number;
  }> {
    try {
      const settings = await this.getAllSettings();
      
      // Add null/undefined checks
      if (!settings || !settings.success || !settings.data || !settings.data.settings) {
        console.warn('Failed to fetch settings, using defaults');
        return {
          password_expiry_days: 90,
          session_timeout_minutes: 30,
          two_factor_auth_enabled: false,
          max_login_attempts: 5,
          account_lockout_duration: 15,
        };
      }

      const settingsData = settings.data.settings;

      return {
        password_expiry_days: settingsData.password_expiry_days?.value || 90,
        session_timeout_minutes: settingsData.session_timeout_minutes?.value || 30,
        two_factor_auth_enabled: settingsData.two_factor_auth_enabled?.value || false,
        max_login_attempts: settingsData.max_login_attempts?.value || 5,
        account_lockout_duration: settingsData.account_lockout_duration?.value || 15,
      };
    } catch (error) {
      console.error('Error fetching security settings:', error);
      return {
        password_expiry_days: 90,
        session_timeout_minutes: 30,
        two_factor_auth_enabled: false,
        max_login_attempts: 5,
        account_lockout_duration: 15,
      };
    }
  }
}

export default new SettingsApiService();