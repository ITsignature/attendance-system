/**
 * SMS Service using TextIt.biz Gateway
 * This service handles sending SMS notifications for attendance check-in/check-out
 */

const axios = require('axios');

class SMSService {
  constructor() {
    // TextIt.biz credentials from environment variables
    this.baseURL = process.env.SMS_BASE_URL || 'https://www.textit.biz/sendmsg';
    this.accountId = process.env.SMS_ACCOUNT_ID || '942021070701';
    this.password = process.env.SMS_PASSWORD || '7470';
    this.enabled = process.env.SMS_ENABLED === 'true';

    // Notification configuration for specific clients
    this.clientNotifications = {
      '617f36df-e92a-4f7e-bd19-31df35173926': '0775554262' // Eduzon client notification number
    };
  }

  /**
   * Send SMS via TextIt.biz gateway
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - SMS message text
   * @returns {Promise<Object>} - Response from SMS gateway
   */
  async sendSMS(phoneNumber, message) {
    if (!this.enabled) {
      console.log('📱 SMS disabled. Would have sent:', { phoneNumber, message });
      return { success: true, message: 'SMS disabled', mock: true };
    }

    try {
      // Clean and validate phone number
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      if (!cleanPhone) {
        console.log('❌ Invalid phone number:', phoneNumber);
        return { success: false, error: 'Invalid phone number' };
      }

      // URL encode the message and remove extra spaces
      const encodedMessage = encodeURIComponent(message);
      const cleanedMessage = encodedMessage.replace(/\s+/g, ' ');

      // Build SMS URL with query parameters
      const smsURL = `${this.baseURL}/?id=${this.accountId}&pw=${this.password}&to=${cleanPhone}&text=${cleanedMessage}&eco=Y`;

      console.log('📱 Sending SMS to:', cleanPhone);

      // Send SMS via GET request
      const response = await axios.get(smsURL, {
        timeout: 10000 // 10 second timeout
      });
     
      //validate SMS gateway response
      const responseData = typeof response.data === 'String' ? response.data.trim() : response.data;
      
      //Check for authentication/configuration errors
      if(responseData.includes('INVALID')||responseData.includes('ERROR')||responseData.includes('FAIL')||responseData.includes('UNAUTHORIZED')||responseData.includes('OK')) {
        console.log('❌ SMS gateway error:', responseData);
        return {
          success: false,
          error: `SMS gateway rejected: ${responseData}`,
          phoneNumber: cleanPhone,
          gatewayResponse: responseData
        };
      }

      console.log('✅ SMS sent successfully:', responseData);

      return {
        success: true,
        response: responseData,
        phoneNumber: cleanPhone,
        message: message
      };

    } catch (error) {
      console.error('❌ SMS sending failed:', error.message);
      return {
        success: false,
        error: error.message,
        phoneNumber: phoneNumber
      };
    }
  }

  /**
   * Clean and validate phone number
   * @param {string} phoneNumber - Raw phone number
   * @returns {string|null} - Cleaned phone number or null if invalid
   */
  cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;

    // Remove all non-digit characters
    const cleaned = phoneNumber.toString().replace(/\D/g, '');

    // Must have at least 9 digits
    if (cleaned.length < 9) return null;

    // If starts with 0, remove it and add country code (94 for Sri Lanka)
    if (cleaned.startsWith('0')) {
      return '94' + cleaned.substring(1);
    }

    // If already has country code
    if (cleaned.startsWith('94')) {
      return cleaned;
    }

    // Default: add 94 country code
    return '94' + cleaned;
  }

  /**
   * Send check-in SMS notification
   * @param {Object} params - Check-in parameters
   * @returns {Promise<Object>} - SMS response
   */
  async sendCheckInSMS({ employeeName, companyName, phoneNumber, date, time, isLate = false, lateBy = '', clientId = null }) {
    let message = `${employeeName} has attended ${companyName} on ${date} at ${time}.`;

    if (isLate && lateBy) {
      message += `\n\n${lateBy}`;
    }

    message += `\n\nSystem Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;

    // Send to employee
    const employeeResult = await this.sendSMS(phoneNumber, message);

    // Send to notification number if client has one configured
    if (clientId && this.clientNotifications[clientId]) {
      const notificationNumber = this.clientNotifications[clientId];
      console.log(`   📱 Sending copy to notification number: ${notificationNumber}`);
      await this.sendSMS(notificationNumber, message);
    }

    return employeeResult;
  }

  /**
   * Send check-out SMS notification
   * @param {Object} params - Check-out parameters
   * @returns {Promise<Object>} - SMS response
   */
  async sendCheckOutSMS({ employeeName, companyName, phoneNumber, date, time, workingHours, clientId = null }) {
    const message = `${employeeName} left ${companyName} on ${date} at ${time}.\n\nWorking Hours: ${workingHours}`;

    // Send to employee
    const employeeResult = await this.sendSMS(phoneNumber, message);

    // Send to notification number if client has one configured
    if (clientId && this.clientNotifications[clientId]) {
      const notificationNumber = this.clientNotifications[clientId];
      console.log(`   📱 Sending copy to notification number: ${notificationNumber}`);
      await this.sendSMS(notificationNumber, message);
    }

    return employeeResult;
  }

  /**
   * Calculate working hours in human-readable format
   * @param {string} checkInTime - Check-in time (HH:MM:SS)
   * @param {string} checkOutTime - Check-out time (HH:MM:SS)
   * @returns {string} - Formatted working hours (e.g., "8 hours 30 minutes")
   */
  calculateWorkingHours(checkInTime, checkOutTime) {
    try {
      const inDate = new Date(`2000-01-01T${checkInTime}`);
      const outDate = new Date(`2000-01-01T${checkOutTime}`);

      const diffMs = outDate - inDate;
      const diffSeconds = Math.floor(diffMs / 1000);

      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);

      if (hours > 0 && minutes > 0) {
        return `${hours} hours ${minutes} minutes`;
      } else if (hours > 0) {
        return `${hours} hours`;
      } else {
        return `${minutes} minutes`;
      }
    } catch (error) {
      console.error('Error calculating working hours:', error);
      return 'N/A';
    }
  }

  /**
   * Calculate late time in human-readable format
   * @param {string} actualTime - Actual check-in time (HH:MM:SS)
   * @param {string} scheduledTime - Scheduled check-in time (HH:MM:SS)
   * @returns {string|null} - Late message or null if not late
   */
  calculateLateTime(actualTime, scheduledTime) {
    try {
      const actual = new Date(`2000-01-01T${actualTime}`);
      const scheduled = new Date(`2000-01-01T${scheduledTime}`);

      if (actual <= scheduled) {
        return null; // Not late
      }

      const diffMs = actual - scheduled;
      const diffSeconds = Math.floor(diffMs / 1000);

      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);

      if (hours > 0 && minutes > 0) {
        return `${hours} hour ${minutes} minutes Late`;
      } else if (hours > 0) {
        return `${hours} hour Late`;
      } else {
        return `${minutes} minutes Late`;
      }
    } catch (error) {
      console.error('Error calculating late time:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new SMSService();
