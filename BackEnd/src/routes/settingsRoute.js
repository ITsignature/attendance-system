// src/routes/settingsRoute.js
const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

// Apply authentication to all settings routes
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// VALIDATION MIDDLEWARE
// =============================================

const validateSettingKey = (key) => {
  const allowedKeys = [
    // General Settings
    'company_name', 'timezone', 'date_format', 'currency', 'language',
    
    // Security Settings
    'password_expiry_days', 'session_timeout_minutes', 'two_factor_auth_enabled', 
    'max_login_attempts', 'account_lockout_duration',
    
    // Notification Settings
    'email_notifications_enabled', 'push_notifications_enabled', 
    'sms_notifications_enabled', 'weekly_reports_enabled',
    
    // Attendance Settings
    'working_hours_per_day', 'work_start_time', 'work_end_time', 
    'late_threshold_minutes', 'overtime_rate_multiplier',
    
    // Payroll Settings
    'payroll_cycle', 'salary_processing_date', 'tax_calculation_method',
    
    // Privacy Settings
    'data_retention_years', 'audit_logs_enabled', 'anonymize_data_enabled',
    
    // Integration Settings
    'email_integration_enabled', 'calendar_sync_enabled', 'backup_frequency'
  ];
  
  return allowedKeys.includes(key);
};

const getSettingType = (key, value) => {
  const booleanSettings = [
    'two_factor_auth_enabled', 'email_notifications_enabled', 'push_notifications_enabled',
    'sms_notifications_enabled', 'weekly_reports_enabled', 'audit_logs_enabled',
    'anonymize_data_enabled', 'email_integration_enabled', 'calendar_sync_enabled'
  ];
  
  const numberSettings = [
    'password_expiry_days', 'session_timeout_minutes', 'max_login_attempts',
    'working_hours_per_day', 'late_threshold_minutes', 'overtime_rate_multiplier',
    'data_retention_years', 'account_lockout_duration'
  ];
  
  if (booleanSettings.includes(key)) {
    return 'boolean';
  } else if (numberSettings.includes(key)) {
    return 'number';
  } else {
    return 'string';
  }
};

const validateSettingValue = (key, value, type) => {
  switch (type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && !isNaN(value) && value >= 0;
    case 'string':
      return typeof value === 'string' && value.length > 0;
    default:
      return false;
  }
};

// =============================================
// GET ALL SETTINGS
// =============================================
router.get('/', 
  checkPermission('settings.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    // Get all settings for the client
    const [settings] = await db.execute(`
      SELECT 
        setting_key,
        setting_value,
        setting_type,
        description,
        is_public,
        updated_at
      FROM system_settings 
      WHERE client_id = ? OR client_id IS NULL
      ORDER BY setting_key ASC
    `, [req.user.clientId]);

    // Convert JSON values and format response
    const formattedSettings = settings.reduce((acc, setting) => {
      let value = setting.setting_value;
      
      // Parse JSON values
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If not valid JSON, keep as string
        }
      }

      acc[setting.setting_key] = {
        value: value,
        type: setting.setting_type,
        description: setting.description,
        is_public: setting.is_public,
        updated_at: setting.updated_at
      };
      
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        settings: formattedSettings,
        total: settings.length
      }
    });
  })
);

// =============================================
// GET SPECIFIC SETTING
// =============================================
router.get('/:key', 
  checkPermission('settings.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { key } = req.params;

    if (!validateSettingKey(key)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setting key'
      });
    }

    const [settings] = await db.execute(`
      SELECT 
        setting_key,
        setting_value,
        setting_type,
        description,
        is_public,
        updated_at
      FROM system_settings 
      WHERE setting_key = ? AND (client_id = ? OR client_id IS NULL)
      ORDER BY client_id DESC NULLS LAST
      LIMIT 1
    `, [key, req.user.clientId]);

    if (settings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    const setting = settings[0];
    let value = setting.setting_value;
    
    // Parse JSON values
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // If not valid JSON, keep as string
      }
    }

    res.status(200).json({
      success: true,
      data: {
        setting_key: setting.setting_key,
        value: value,
        type: setting.setting_type,
        description: setting.description,
        is_public: setting.is_public,
        updated_at: setting.updated_at
      }
    });
  })
);

// =============================================
// GET PUBLIC SETTINGS (NO AUTH REQUIRED)
// =============================================
router.get('/public/all', 
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { client_id } = req.query;

    if (!client_id) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    const [settings] = await db.execute(`
      SELECT 
        setting_key,
        setting_value,
        setting_type
      FROM system_settings 
      WHERE (client_id = ? OR client_id IS NULL) AND is_public = TRUE
      ORDER BY setting_key ASC
    `, [client_id]);

    const formattedSettings = settings.reduce((acc, setting) => {
      let value = setting.setting_value;
      
      // Parse JSON values
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If not valid JSON, keep as string
        }
      }

      acc[setting.setting_key] = value;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        settings: formattedSettings
      }
    });
  })
);

// =============================================
// UPDATE SINGLE SETTING
// =============================================
router.put('/:key', 
  checkPermission('settings.edit'),
  [
    body('value').notEmpty().withMessage('Value is required'),
    body('description').optional().isString().isLength({ max: 500 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { key } = req.params;
    const { value, description } = req.body;

    if (!validateSettingKey(key)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setting key'
      });
    }

    const settingType = getSettingType(key, value);
    
    if (!validateSettingValue(key, value, settingType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid value for setting type: ${settingType}`
      });
    }

    // Check if setting exists for this client
    const [existing] = await db.execute(`
      SELECT id FROM system_settings 
      WHERE setting_key = ? AND client_id = ?
    `, [key, req.user.clientId]);

    const jsonValue = JSON.stringify(value);

    if (existing.length > 0) {
      // Update existing setting
      await db.execute(`
        UPDATE system_settings 
        SET setting_value = ?, setting_type = ?, description = COALESCE(?, description)
        WHERE setting_key = ? AND client_id = ?
      `, [jsonValue, settingType, description, key, req.user.clientId]);
    } else {
      // Create new setting for this client
      const settingId = require('crypto').randomUUID();
      await db.execute(`
        INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, description, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [settingId, req.user.clientId, key, jsonValue, settingType, description || null, false]);
    }

    res.status(200).json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        setting_key: key,
        value: value,
        type: settingType
      }
    });
  })
);

// =============================================
// BULK UPDATE SETTINGS
// =============================================
router.put('/', 
  checkPermission('settings.edit'),
  [
    body('settings').isObject().withMessage('Settings must be an object'),
    body('settings.*').notEmpty().withMessage('Setting values cannot be empty')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { settings } = req.body;
    
    // Validate all setting keys
    const invalidKeys = Object.keys(settings).filter(key => !validateSettingKey(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setting keys',
        invalid_keys: invalidKeys
      });
    }

    // Validate all values
    const validationErrors = [];
    Object.entries(settings).forEach(([key, value]) => {
      const settingType = getSettingType(key, value);
      if (!validateSettingValue(key, value, settingType)) {
        validationErrors.push(`Invalid value for ${key}: expected ${settingType}`);
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      const updatedSettings = {};

      for (const [key, value] of Object.entries(settings)) {
        const settingType = getSettingType(key, value);
        const jsonValue = JSON.stringify(value);

        // Check if setting exists for this client
        const [existing] = await db.execute(`
          SELECT id FROM system_settings 
          WHERE setting_key = ? AND client_id = ?
        `, [key, req.user.clientId]);

        if (existing.length > 0) {
          // Update existing setting
          await db.execute(`
            UPDATE system_settings 
            SET setting_value = ?, setting_type = ?
            WHERE setting_key = ? AND client_id = ?
          `, [jsonValue, settingType, key, req.user.clientId]);
        } else {
          // Create new setting for this client
          const settingId = require('crypto').randomUUID();
          await db.execute(`
            INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, is_public)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [settingId, req.user.clientId, key, jsonValue, settingType, false]);
        }

        updatedSettings[key] = {
          value: value,
          type: settingType
        };
      }

      await db.execute('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: {
          updated_settings: updatedSettings,
          total_updated: Object.keys(settings).length
        }
      });

    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  })
);

// =============================================
// DELETE SETTING (Reset to system default)
// =============================================
router.delete('/:key', 
  checkPermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    const { key } = req.params;

    if (!validateSettingKey(key)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setting key'
      });
    }

    // Delete client-specific setting (will fall back to system default)
    const [result] = await db.execute(`
      DELETE FROM system_settings 
      WHERE setting_key = ? AND client_id = ?
    `, [key, req.user.clientId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found or already at system default'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Setting reset to system default',
      data: {
        setting_key: key
      }
    });
  })
);

// =============================================
// GET SETTING CATEGORIES
// =============================================
router.get('/meta/categories', 
  checkPermission('settings.view'),
  asyncHandler(async (req, res) => {
    const categories = {
      general: {
        name: 'General Settings',
        description: 'Basic company and localization settings',
        settings: ['company_name', 'timezone', 'date_format', 'currency', 'language']
      },
      security: {
        name: 'Security Settings',
        description: 'Authentication and password policies',
        settings: ['password_expiry_days', 'session_timeout_minutes', 'two_factor_auth_enabled', 'max_login_attempts', 'account_lockout_duration']
      },
      notifications: {
        name: 'Notification Settings',
        description: 'Communication and alert preferences',
        settings: ['email_notifications_enabled', 'push_notifications_enabled', 'sms_notifications_enabled', 'weekly_reports_enabled']
      },
      attendance: {
        name: 'Attendance Settings',
        description: 'Work schedule and attendance policies',
        settings: ['working_hours_per_day', 'work_start_time', 'work_end_time', 'late_threshold_minutes', 'overtime_rate_multiplier']
      },
      payroll: {
        name: 'Payroll Settings',
        description: 'Salary processing and payment configuration',
        settings: ['payroll_cycle', 'salary_processing_date', 'tax_calculation_method']
      },
      privacy: {
        name: 'Privacy Settings',
        description: 'Data protection and compliance settings',
        settings: ['data_retention_years', 'audit_logs_enabled', 'anonymize_data_enabled']
      },
      integration: {
        name: 'Integration Settings',
        description: 'External services and system integrations',
        settings: ['email_integration_enabled', 'calendar_sync_enabled', 'backup_frequency']
      }
    };

    res.status(200).json({
      success: true,
      data: {
        categories
      }
    });
  })
);

// =============================================
// RESET ALL SETTINGS TO DEFAULT
// =============================================
router.post('/reset-all', 
  checkPermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const db = getDB();

    // Delete all client-specific settings (will fall back to system defaults)
    const [result] = await db.execute(`
      DELETE FROM system_settings 
      WHERE client_id = ?
    `, [req.user.clientId]);

    res.status(200).json({
      success: true,
      message: 'All settings reset to system defaults',
      data: {
        settings_reset: result.affectedRows
      }
    });
  })
);

// =============================================
// EXPORT SETTINGS
// =============================================
router.get('/export/backup', 
  checkPermission('settings.view'),
  asyncHandler(async (req, res) => {
    const db = getDB();
    
    const [settings] = await db.execute(`
      SELECT 
        setting_key,
        setting_value,
        setting_type,
        description
      FROM system_settings 
      WHERE client_id = ?
      ORDER BY setting_key ASC
    `, [req.user.clientId]);

    const backup = {
      export_date: new Date().toISOString(),
      client_id: req.user.clientId,
      settings: settings.reduce((acc, setting) => {
        let value = setting.setting_value;
        
        // Parse JSON values
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // If not valid JSON, keep as string
          }
        }

        acc[setting.setting_key] = {
          value: value,
          type: setting.setting_type,
          description: setting.description
        };
        
        return acc;
      }, {})
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="settings-backup-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.status(200).json(backup);
  })
);

module.exports = router;