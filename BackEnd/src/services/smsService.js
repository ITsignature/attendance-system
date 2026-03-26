/**
 * SMS Service using TextIt.biz Gateway
 * Supports per-company credentials stored in system_settings (key: 'sms_config')
 * Falls back to global ENV vars if no company config exists.
 */

const axios = require('axios');

class SMSService {
  constructor() {
    // Global fallback credentials from environment variables
    this.fallbackBaseURL = process.env.SMS_BASE_URL || 'https://www.textit.biz/sendmsg';
    this.fallbackAccountId = process.env.SMS_ACCOUNT_ID || '';
    this.fallbackPassword = process.env.SMS_PASSWORD || '';
    this.fallbackEnabled = process.env.SMS_ENABLED === 'true';
  }

  /**
   * Load SMS config for a specific company from system_settings.
   * Returns null if no company-specific config exists.
   */
  async getClientConfig(clientId) {
    if (!clientId) return null;
    try {
      const { getDB } = require('../config/database');
      const db = getDB();
      const [rows] = await db.execute(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'sms_config' AND client_id = ? LIMIT 1`,
        [clientId]
      );
      if (rows.length === 0) return null;
      return JSON.parse(rows[0].setting_value);
    } catch (err) {
      console.error('Failed to load client SMS config:', err.message);
      return null;
    }
  }

  /**
   * Save SMS config for a specific company into system_settings.
   */
  async saveClientConfig(clientId, config) {
    const { getDB } = require('../config/database');
    const db = getDB();
    const value = JSON.stringify(config);
    const [existing] = await db.execute(
      `SELECT id FROM system_settings WHERE setting_key = 'sms_config' AND client_id = ?`,
      [clientId]
    );
    if (existing.length > 0) {
      await db.execute(
        `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'sms_config' AND client_id = ?`,
        [value, clientId]
      );
    } else {
      const { v4: uuidv4 } = require('uuid');
      await db.execute(
        `INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, is_public) VALUES (?, ?, 'sms_config', ?, 'object', FALSE)`,
        [uuidv4(), clientId, value]
      );
    }
  }

  /**
   * Core SMS send using explicit credentials.
   */
  async sendSMS(phoneNumber, message, credentials = null) {
    const accountId = credentials?.account_id || this.fallbackAccountId;
    const password = credentials?.password || this.fallbackPassword;
    const baseURL = credentials?.base_url || this.fallbackBaseURL;
    const enabled = credentials?.enabled !== undefined ? credentials.enabled : this.fallbackEnabled;

    if (!enabled) {
      console.log('📱 SMS disabled. Would have sent:', { phoneNumber, message });
      return { success: true, message: 'SMS disabled', mock: true };
    }

    if (!accountId || !password) {
      console.log('📱 SMS not configured (no account_id/password).');
      return { success: false, error: 'SMS not configured' };
    }

    try {
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      if (!cleanPhone) {
        console.log('❌ Invalid phone number:', phoneNumber);
        return { success: false, error: 'Invalid phone number' };
      }

      const encodedMessage = encodeURIComponent(message).replace(/\s+/g, ' ');
      const smsURL = `${baseURL}/?id=${accountId}&pw=${password}&to=${cleanPhone}&text=${encodedMessage}&eco=Y`;

      console.log('📱 Sending SMS to:', cleanPhone);
      console.log('🔧 SMS Gateway URL:', smsURL.replace(password, '****'));

      const response = await axios.get(smsURL, { timeout: 10000 });
      const responseData = typeof response.data === 'string' ? response.data.trim() : response.data;
      console.log('📥 Gateway Response:', responseData);

      if (
        responseData.includes('INVALID') ||
        responseData.includes('ERROR') ||
        responseData.includes('FAIL') ||
        responseData.includes('UNAUTHORIZED') ||
        !responseData.includes('OK')
      ) {
        console.error('❌ SMS gateway error:', responseData);
        return { success: false, error: `SMS gateway rejected: ${responseData}`, phoneNumber: cleanPhone, gatewayResponse: responseData };
      }

      console.log('✅ SMS sent successfully:', responseData);
      return { success: true, response: responseData, phoneNumber: cleanPhone, message };

    } catch (error) {
      console.error('❌ SMS sending failed:', error.message);
      return { success: false, error: error.message, phoneNumber };
    }
  }

  /**
   * Clean and validate phone number (Sri Lanka format)
   */
  cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    const cleaned = phoneNumber.toString().replace(/\D/g, '');
    if (cleaned.length < 9) return null;
    if (cleaned.startsWith('0')) return '94' + cleaned.substring(1);
    if (cleaned.startsWith('94')) return cleaned;
    return '94' + cleaned;
  }

  /**
   * Send check-in SMS notification.
   * Loads company-specific credentials via clientId.
   */
  async sendCheckInSMS({ employeeName, companyName, phoneNumber, date, time, isLate = false, lateBy = '', clientId = null }) {
    const config = await this.getClientConfig(clientId);

    let message = `${employeeName} has attended ${companyName} on ${date} at ${time}.`;
    if (isLate && lateBy) message += `\n\n${lateBy}`;
    message += `\n\nSystem Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;

    const employeeResult = await this.sendSMS(phoneNumber, message, config);

    if (config?.notification_number) {
      console.log(`   📱 Sending copy to notification number: ${config.notification_number}`);
      await this.sendSMS(config.notification_number, message, config);
    }

    return employeeResult;
  }

  /**
   * Send check-out SMS notification.
   * Loads company-specific credentials via clientId.
   */
  async sendCheckOutSMS({ employeeName, companyName, phoneNumber, date, time, workingHours, clientId = null }) {
    const config = await this.getClientConfig(clientId);

    const message = `${employeeName} left ${companyName} on ${date} at ${time}.\n\nWorking Hours: ${workingHours}`;

    const employeeResult = await this.sendSMS(phoneNumber, message, config);

    if (config?.notification_number) {
      console.log(`   📱 Sending copy to notification number: ${config.notification_number}`);
      await this.sendSMS(config.notification_number, message, config);
    }

    return employeeResult;
  }

  /**
   * Calculate working hours in human-readable format
   */
  calculateWorkingHours(checkInTime, checkOutTime) {
    try {
      const inDate = new Date(`2000-01-01T${checkInTime}`);
      const outDate = new Date(`2000-01-01T${checkOutTime}`);
      const diffSeconds = Math.floor((outDate - inDate) / 1000);
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      if (hours > 0 && minutes > 0) return `${hours} hours ${minutes} minutes`;
      if (hours > 0) return `${hours} hours`;
      return `${minutes} minutes`;
    } catch (error) {
      console.error('Error calculating working hours:', error);
      return 'N/A';
    }
  }

  /**
   * Calculate late time in human-readable format
   */
  calculateLateTime(actualTime, scheduledTime) {
    try {
      const actual = new Date(`2000-01-01T${actualTime}`);
      const scheduled = new Date(`2000-01-01T${scheduledTime}`);
      if (actual <= scheduled) return null;
      const diffSeconds = Math.floor((actual - scheduled) / 1000);
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      if (hours > 0 && minutes > 0) return `${hours} hour ${minutes} minutes Late`;
      if (hours > 0) return `${hours} hour Late`;
      return `${minutes} minutes Late`;
    } catch (error) {
      console.error('Error calculating late time:', error);
      return null;
    }
  }
}

module.exports = new SMSService();
