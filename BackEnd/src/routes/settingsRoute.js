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
    'full_day_minimum_hours', 'half_day_minimum_hours', 'short_leave_minimum_hours',
    'weekend_working_days', 'working_hours_config',
    
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
    'data_retention_years', 'account_lockout_duration',
    'full_day_minimum_hours', 'half_day_minimum_hours', 'short_leave_minimum_hours' 
  ];

  const objectSettings = [
    'weekend_working_days', 'working_hours_config'
  ];
  
  if (booleanSettings.includes(key)) {
    return 'boolean';
  } else if (numberSettings.includes(key)) {
    return 'number';
  } else if (objectSettings.includes(key)) {
    return 'object';
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
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    
    // // Get all settings for the client
    // const [settings] = await db.execute(`
    //   SELECT 
    //     setting_key,
    //     setting_value,
    //     setting_type,
    //     description,
    //     is_public,
    //     updated_at
    //   FROM system_settings 
    //   WHERE client_id = ? OR client_id IS NULL
    //   ORDER BY setting_key ASC
    // `, [req.user.clientId]);


       // Get all settings for the client
    const [settings] = await db.execute(`
        SELECT 
      setting_key,
      setting_value,
      setting_type,
      description,
      is_public,
      updated_at
    FROM (
      SELECT *,
            ROW_NUMBER() OVER (PARTITION BY setting_key ORDER BY 
                                CASE WHEN client_id IS NULL THEN 1 ELSE 0 END) as rn
      FROM system_settings
      WHERE client_id = ? OR client_id IS NULL
    ) as ranked
    WHERE rn = 1
    ORDER BY setting_key ASC
    `, [req.user.clientId]);

    // console.log('📊 Settings response:', settings);
    // Convert JSON values and format response
    const formattedSettings = settings.reduce((acc, setting) => {
      let value = setting.setting_value;
      
      // Parse JSON values
     if (typeof value === 'string' && isValidJson(value)) {
        value = JSON.parse(value);
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

    // console.log('📊 Formatted settings response:', formattedSettings);
    // console.log('📊 Total settings:', settings.length);

    res.status(200).json({
      success: true,
      data: {
        settings: formattedSettings,
        total: settings.length
      }
    });
  })
);

function isValidJson(str) {
  try {
    const parsed = JSON.parse(str);
    // Optional: only consider it valid JSON if it results in object/array
    return typeof parsed === 'object' || Array.isArray(parsed);
  } catch (e) {
    return false;
  }
}

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
      `, [jsonValue, settingType, description || null, key, req.user.clientId]);
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
router.put('/', [
  checkPermission('settings.edit'),
  body('settings').isObject().withMessage('Settings must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const db = getDB();
  const settings = req.body.settings;
  
  // Check if work schedule settings are being updated
  const scheduleSettings = ['work_start_time', 'work_end_time'];
  const hasScheduleChanges = scheduleSettings.some(key => settings.hasOwnProperty(key));
  
  let scheduleUpdateInfo = null;
  
  try {
    // Start transaction for consistency
    await db.execute('START TRANSACTION');
    
    // Update settings first
    for (const [key, value] of Object.entries(settings)) {
      if (!validateSettingKey(key)) {
        await db.execute('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Invalid setting key: ${key}`
        });
      }

      const settingType = getSettingType(key, value);
      
      if (!validateSettingValue(key, value, settingType)) {
        await db.execute('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Invalid value for setting: ${key}`
        });
      }

      const jsonValue = JSON.stringify(value);

      // Check if setting exists
      const [existing] = await db.execute(`
        SELECT id FROM system_settings 
        WHERE setting_key = ? AND client_id = ?
      `, [key, req.user.clientId]);

      if (existing.length > 0) {
        // Update existing
        await db.execute(`
          UPDATE system_settings 
          SET setting_value = ?, setting_type = ?, updated_at = NOW()
          WHERE setting_key = ? AND client_id = ?
        `, [jsonValue, settingType, key, req.user.clientId]);
      } else {
        // Insert new
        const settingId = require('crypto').randomUUID();
        await db.execute(`
          INSERT INTO system_settings (id, client_id, setting_key, setting_value, setting_type, is_public, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, FALSE, NOW(), NOW())
        `, [settingId, req.user.clientId, key, jsonValue, settingType]);
      }
    }

    // CASCADE UPDATE: If work schedule changed, update all employees who follow company schedule
    if (hasScheduleChanges) {
      console.log('🔄 Work schedule changed, updating employees who follow company schedule...');
      
      // Get the new schedule values
      const newStartTime = settings.work_start_time;
      const newEndTime = settings.work_end_time;
      
      // If only one time is being updated, get the other from database
      let finalStartTime = newStartTime;
      let finalEndTime = newEndTime;
      
      if (!finalStartTime || !finalEndTime) {
        const [currentSchedule] = await db.execute(`
          SELECT setting_key, setting_value 
          FROM system_settings 
          WHERE setting_key IN ('work_start_time', 'work_end_time') 
          AND client_id = ?
        `, [req.user.clientId]);
        
        currentSchedule.forEach(setting => {
          try {
            const value = JSON.parse(setting.setting_value);
            if (setting.setting_key === 'work_start_time' && !finalStartTime) {
              finalStartTime = value;
            }
            if (setting.setting_key === 'work_end_time' && !finalEndTime) {
              finalEndTime = value;
            }
          } catch (e) {
            console.warn(`Failed to parse setting value for ${setting.setting_key}`);
          }
        });
      }
      
      // Validate the final times
      if (finalStartTime && finalEndTime) {
        const startTime = new Date(`2000-01-01T${finalStartTime}:00`);
        const endTime = new Date(`2000-01-01T${finalEndTime}:00`);
        
        if (endTime <= startTime) {
          await db.execute('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Work end time must be after start time',
            field: 'work_end_time'
          });
        }
      }
      
      // Update all employees who follow company schedule
      const updateFields = [];
      const updateValues = [];
      
      if (finalStartTime) {
        updateFields.push('in_time = ?');
        updateValues.push(finalStartTime);
      }
      
      if (finalEndTime) {
        updateFields.push('out_time = ?');
        updateValues.push(finalEndTime);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(req.user.clientId);
        
        const [result] = await db.execute(`
          UPDATE employees 
          SET ${updateFields.join(', ')}
          WHERE client_id = ? AND follows_company_schedule = TRUE AND employment_status != 'terminated'
        `, updateValues);
        
        scheduleUpdateInfo = {
          employees_updated: result.affectedRows,
          new_start_time: finalStartTime,
          new_end_time: finalEndTime
        };
        
        console.log(`✅ Updated ${result.affectedRows} employees with new company schedule`);
      }
    }

    // Commit transaction
    await db.execute('COMMIT');
    
    const response = {
      success: true,
      message: 'Settings updated successfully',
      data: {
        updated_settings: Object.keys(settings)
      }
    };
    
    // Add schedule update info if applicable
    if (scheduleUpdateInfo) {
      response.data.schedule_cascade_update = scheduleUpdateInfo;
      response.message += ` and ${scheduleUpdateInfo.employees_updated} employee schedules updated`;
    }
    
    res.status(200).json(response);

  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

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
        settings: [
          'working_hours_per_day', 
          'work_start_time', 
          'work_end_time', 
          'late_threshold_minutes', 
          'overtime_rate_multiplier',
          'half_time_duration_minutes',     // NEW SETTING
          'short_leave_duration_minutes'    // NEW SETTING
        ]
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