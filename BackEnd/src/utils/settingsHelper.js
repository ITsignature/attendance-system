// src/utils/settingsHelper.js
const { getDB } = require('../config/database');

class SettingsHelper {
  constructor(clientId = null) {
    this.clientId = clientId;
  }

  async getSetting(key) {
    const db = getDB();
    
    try {
      const [settings] = await db.execute(`
        SELECT setting_value, setting_type
        FROM system_settings 
        WHERE setting_key = ? AND (client_id = ? OR client_id IS NULL)
        ORDER BY client_id DESC NULLS LAST
        LIMIT 1
      `, [key, this.clientId]);

      if (settings.length === 0) {
        return null;
      }

      let value = settings[0].setting_value;
      
      // Parse JSON values
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If not valid JSON, keep as string
        }
      }

      return value;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  async getSettings(keys = []) {
    const db = getDB();
    
    try {
      let query = `
        SELECT setting_key, setting_value, setting_type
        FROM system_settings 
        WHERE (client_id = ? OR client_id IS NULL)
      `;
      
      let params = [this.clientId];
      
      if (keys.length > 0) {
        query += ` AND setting_key IN (${keys.map(() => '?').join(',')})`;
        params.push(...keys);
      }
      
      query += ` ORDER BY setting_key, client_id DESC NULLS LAST`;

      const [settings] = await db.execute(query, params);

      // Group by setting_key and take client-specific first, then system default
      const settingsMap = {};
      settings.forEach(setting => {
        if (!settingsMap[setting.setting_key]) {
          let value = setting.setting_value;
          
          // Parse JSON values
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // If not valid JSON, keep as string
            }
          }

          settingsMap[setting.setting_key] = value;
        }
      });

      return settingsMap;
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  async setBulkSettings(settings) {
    const db = getDB();
    
    if (!this.clientId) {
      throw new Error('Client ID is required for setting updates');
    }

    await db.execute('START TRANSACTION');

    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.setSetting(key, value, false); // Don't commit each individually
      }

      await db.execute('COMMIT');
      return true;
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  }

  async setSetting(key, value, autoCommit = true) {
    const db = getDB();
    
    if (!this.clientId) {
      throw new Error('Client ID is required for setting updates');
    }

    try {
      // Determine setting type
      let settingType = 'string';
      if (typeof value === 'boolean') {
        settingType = 'boolean';
      } else if (typeof value === 'number') {
        settingType = 'number';
      }

      const jsonValue = JSON.stringify(value);

      // Check if setting exists
      const [existing] = await db.execute(`
        SELECT id FROM system_settings 
        WHERE setting_key = ? AND client_id = ?
      `, [key, this.clientId]);

      if (existing.length > 0) {
        // Update existing
        await db.execute(`
          UPDATE system_settings 
          SET setting_value = ?, setting_type = ?
          WHERE setting_key = ? AND client_id = ?
        `, [jsonValue, settingType, key, this.clientId]);
      } else {
        // Insert new
        const settingId = require('crypto').randomUUID();
        await db.execute(`
          INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, is_public)
          VALUES (?, ?, ?, ?, ?, FALSE)
        `, [settingId, this.clientId, key, jsonValue, settingType]);
      }

      if (autoCommit) {
        await db.execute('COMMIT');
      }

      return true;
    } catch (error) {
      if (autoCommit) {
        await db.execute('ROLLBACK');
      }
      throw error;
    }
  }

  // Helper methods for common settings
  async getWorkingHours() {
    const startTime = await this.getSetting('work_start_time') || '09:00';
    const endTime = await this.getSetting('work_end_time') || '17:00';
    const hoursPerDay = await this.getSetting('working_hours_per_day') || 8;
    
    return {
      start_time: startTime,
      end_time: endTime,
      hours_per_day: hoursPerDay
    };
  }

  async getSecuritySettings() {
    return await this.getSettings([
      'password_expiry_days',
      'session_timeout_minutes',
      'two_factor_auth_enabled',
      'max_login_attempts',
      'account_lockout_duration'
    ]);
  }

  async getNotificationSettings() {
    return await this.getSettings([
      'email_notifications_enabled',
      'push_notifications_enabled',
      'sms_notifications_enabled',
      'weekly_reports_enabled'
    ]);
  }

  async getCompanyInfo() {
    return await this.getSettings([
      'company_name',
      'timezone',
      'date_format',
      'currency',
      'language'
    ]);
  }

  async getWeekendSettings() {
    const weekendConfig = await this.getSetting('weekend_working_days') || {
      saturday_working: false,
      sunday_working: false,
      custom_weekend_days: []
    };
    
    const workingHoursConfig = await this.getSetting('working_hours_config') || {
      standard_hours_per_day: 8,
      weekend_hours_multiplier: 1.5,
      holiday_hours_multiplier: 2.5,
      start_time: '09:00',
      end_time: '17:00',
      break_duration_minutes: 60
    };

    return {
      ...weekendConfig,
      working_hours: workingHoursConfig
    };
  }

  async isWeekendWorkingDay(dayOfWeek) {
    const settings = await this.getWeekendSettings();
    
    // dayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday
    if (dayOfWeek === 0) { // Sunday
      return settings.sunday_working;
    }
    if (dayOfWeek === 6) { // Saturday
      return settings.saturday_working;
    }
    
    // Check custom weekend days
    return settings.custom_weekend_days && settings.custom_weekend_days.includes(dayOfWeek);
  }
}

module.exports = {
  SettingsHelper
};