const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '../.env' });

const seedDefaultSettings = async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'attendance_system'  
  });

  try {
    console.log('🔧 Starting default settings seeding...');

    // Default System Settings
    const defaultSettings = [
      // General Settings
      {
        setting_key: 'company_name',
        setting_value: JSON.stringify('Your Company Name'),
        setting_type: 'string',
        description: 'Official company name displayed throughout the system',
        is_public: true
      },
      {
        setting_key: 'timezone',
        setting_value: JSON.stringify('UTC+00:00'),
        setting_type: 'string',
        description: 'Default timezone for the organization',
        is_public: true
      },
      {
        setting_key: 'date_format',
        setting_value: JSON.stringify('YYYY-MM-DD'),
        setting_type: 'string',
        description: 'Date format used throughout the system',
        is_public: true
      },
      {
        setting_key: 'currency',
        setting_value: JSON.stringify('USD'),
        setting_type: 'string',
        description: 'Default currency for payroll and financial calculations',
        is_public: true
      },
      {
        setting_key: 'language',
        setting_value: JSON.stringify('English'),
        setting_type: 'string',
        description: 'Default system language',
        is_public: true
      },

      // Security Settings
      {
        setting_key: 'password_expiry_days',
        setting_value: JSON.stringify(90),
        setting_type: 'number',
        description: 'Number of days after which passwords expire',
        is_public: false
      },
      {
        setting_key: 'session_timeout_minutes',
        setting_value: JSON.stringify(30),
        setting_type: 'number',
        description: 'Session timeout in minutes for inactive users',
        is_public: false
      },
      {
        setting_key: 'two_factor_auth_enabled',
        setting_value: JSON.stringify(false),
        setting_type: 'boolean',
        description: 'Enable two-factor authentication for admin users',
        is_public: false
      },
      {
        setting_key: 'max_login_attempts',
        setting_value: JSON.stringify(5),
        setting_type: 'number',
        description: 'Maximum failed login attempts before account lockout',
        is_public: false
      },
      {
        setting_key: 'account_lockout_duration',
        setting_value: JSON.stringify(15),
        setting_type: 'number',
        description: 'Account lockout duration in minutes',
        is_public: false
      },

      // Notification Settings
      {
        setting_key: 'email_notifications_enabled',
        setting_value: JSON.stringify(true),
        setting_type: 'boolean',
        description: 'Enable email notifications system-wide',
        is_public: false
      },
      {
        setting_key: 'push_notifications_enabled',
        setting_value: JSON.stringify(true),
        setting_type: 'boolean',
        description: 'Enable browser push notifications',
        is_public: false
      },
      {
        setting_key: 'sms_notifications_enabled',
        setting_value: JSON.stringify(false),
        setting_type: 'boolean',
        description: 'Enable SMS notifications for critical alerts',
        is_public: false
      },
      {
        setting_key: 'weekly_reports_enabled',
        setting_value: JSON.stringify(true),
        setting_type: 'boolean',
        description: 'Enable automated weekly summary reports',
        is_public: false
      },

      // Attendance Settings
      {
        setting_key: 'working_hours_per_day',
        setting_value: JSON.stringify(8),
        setting_type: 'number',
        description: 'Standard working hours per day',
        is_public: true
      },
      {
        setting_key: 'work_start_time',
        setting_value: JSON.stringify('09:00'),
        setting_type: 'string',
        description: 'Official work start time',
        is_public: true
      },
      {
        setting_key: 'work_end_time',
        setting_value: JSON.stringify('17:00'),
        setting_type: 'string',
        description: 'Official work end time',
        is_public: true
      },
      {
        setting_key: 'late_threshold_minutes',
        setting_value: JSON.stringify(15),
        setting_type: 'number',
        description: 'Minutes after start time to mark employee as late',
        is_public: true
      },
      {
        setting_key: 'overtime_rate_multiplier',
        setting_value: JSON.stringify(1.5),
        setting_type: 'number',
        description: 'Overtime pay multiplier (e.g., 1.5 for time and a half)',
        is_public: false
      },
      {
        setting_key: 'overtime_enabled',
        setting_value: JSON.stringify(true),
        setting_type: 'boolean',
        description: 'Enable overtime calculations for payroll',
        is_public: false
      },
      {
        setting_key: 'full_day_minimum_hours',
        setting_value: JSON.stringify(7),
        setting_type: 'number',
        description: 'Minimum hours worked to be considered full day',
        is_public: true
     },
     {
        setting_key: 'half_day_minimum_hours',
        setting_value: JSON.stringify(4),
        setting_type: 'number',
        description: 'Minimum hours worked to be considered half day',
        is_public: true
   },
    {
      setting_key: 'short_leave_minimum_hours',
      setting_value: JSON.stringify(1),
      setting_type: 'number',
      description: 'Minimum hours worked to be considered short leave',
      is_public: true
    },
      

      // Payroll Settings
      {
        setting_key: 'payroll_cycle',
        setting_value: JSON.stringify('monthly'),
        setting_type: 'string',
        description: 'Payroll processing cycle (weekly, bi-weekly, monthly, quarterly)',
        is_public: false
      },
      {
        setting_key: 'salary_processing_date',
        setting_value: JSON.stringify('last-day'),
        setting_type: 'string',
        description: 'When to process salary payments in the cycle',
        is_public: false
      },
      {
        setting_key: 'tax_calculation_method',
        setting_value: JSON.stringify('automatic'),
        setting_type: 'string',
        description: 'Method for calculating taxes (automatic, manual, hybrid)',
        is_public: false
      },

      // Privacy Settings
      {
        setting_key: 'data_retention_years',
        setting_value: JSON.stringify(7),
        setting_type: 'number',
        description: 'Years to retain employee data after termination',
        is_public: false
      },
      {
        setting_key: 'audit_logs_enabled',
        setting_value: JSON.stringify(true),
        setting_type: 'boolean',
        description: 'Enable audit logging for compliance',
        is_public: false
      },
      {
        setting_key: 'anonymize_data_enabled',
        setting_value: JSON.stringify(false),
        setting_type: 'boolean',
        description: 'Anonymize data in reports and exports',
        is_public: false
      },

      // Integration Settings
      {
        setting_key: 'email_integration_enabled',
        setting_value: JSON.stringify(false),
        setting_type: 'boolean',
        description: 'Enable integration with email services',
        is_public: false
      },
      {
        setting_key: 'calendar_sync_enabled',
        setting_value: JSON.stringify(false),
        setting_type: 'boolean',
        description: 'Enable calendar synchronization for leave requests',
        is_public: false
      },
      {
        setting_key: 'backup_frequency',
        setting_value: JSON.stringify('daily'),
        setting_type: 'string',
        description: 'Automated backup frequency (daily, weekly, monthly)',
        is_public: false
      }
    ];

    // Insert default settings
    for (const setting of defaultSettings) {
      await connection.execute(`
        INSERT IGNORE INTO system_settings (id, client_id, setting_key, setting_value, setting_type, description, is_public)
        VALUES (?, NULL, ?, ?, ?, ?, ?)
      `, [uuidv4(), setting.setting_key, setting.setting_value, setting.setting_type, setting.description, setting.is_public]);
    }

    console.log('✅ Default settings seeding completed successfully!');
    console.log('');
    console.log('📊 Settings Created:');
    console.log('===================');
    console.log('🏢 General Settings: 5 items (company info, timezone, currency, etc.)');
    console.log('🔒 Security Settings: 5 items (passwords, 2FA, session timeout, etc.)');
    console.log('🔔 Notification Settings: 4 items (email, push, SMS, reports)');
    console.log('⏰ Attendance Settings: 5 items (work hours, start/end time, overtime)');
    console.log('💰 Payroll Settings: 3 items (cycle, processing, tax calculation)');
    console.log('🔐 Privacy Settings: 3 items (data retention, audit logs, anonymization)');
    console.log('🔗 Integration Settings: 3 items (email, calendar, backup frequency)');
    console.log('');
    console.log('🎉 Total: 28 system-wide default settings');
    console.log('');
    console.log('Next Steps:');
    console.log('===========');
    console.log('1. Add settings route to your server.js:');
    console.log('   const settingsRoutes = require("./src/routes/settingsRoute");');
    console.log('   app.use("/api/settings", settingsRoutes);');
    console.log('');
    console.log('2. Start your server and test:');
    console.log('   GET http://localhost:5000/api/settings');
    console.log('');

  } catch (error) {
    console.error('❌ Settings seeding failed:', error);
  } finally {
    await connection.end();
  }
};

// Run seeding if called directly
if (require.main === module) {
  seedDefaultSettings();
}

module.exports = seedDefaultSettings;