const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { sendCommand, isMqttConnected } = require('../services/mqttService');

const router = express.Router();

// =============================================
// SUPER ADMIN ONLY: manage all devices
// CLIENT ADMIN: see + control only their devices
// We handle both by reading req.user.client_id
// =============================================

router.use(authenticate);

// Helper: get client_id scope for the request
function getClientScope(req) {
  if (req.user.isSuperAdmin) {
    return req.query.client_id || null; // super admin can filter by client or see all
  }
  return req.user.clientId; // client admin sees only their own
}

// =============================================
// GET ALL DEVICES (scoped to client)
// =============================================
router.get('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const clientScope = getClientScope(req);

  let query = `
    SELECT
      fd.*,
      c.name as client_name
    FROM fingerprint_devices fd
    LEFT JOIN clients c ON fd.client_id = c.id
  `;
  const params = [];

  if (clientScope) {
    query += ' WHERE fd.client_id = ?';
    params.push(clientScope);
  }

  query += ' ORDER BY fd.created_at DESC';

  const [devices] = await db.execute(query, params);
  res.json({ success: true, data: devices });
}));

// =============================================
// GET SINGLE DEVICE
// =============================================
router.get('/:id', asyncHandler(async (req, res) => {
  const db = getDB();
  const clientScope = getClientScope(req);

  let query = `
    SELECT fd.*, c.name as client_name
    FROM fingerprint_devices fd
    LEFT JOIN clients c ON fd.client_id = c.id
    WHERE fd.id = ?
  `;
  const params = [req.params.id];

  if (clientScope) {
    query += ' AND fd.client_id = ?';
    params.push(clientScope);
  }

  const [rows] = await db.execute(query, params);
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Device not found' });
  res.json({ success: true, data: rows[0] });
}));

// =============================================
// CREATE DEVICE (super admin only)
// =============================================
router.post('/',
  requireSuperAdmin,
  [
    body('device_id').trim().notEmpty().withMessage('device_id is required'),
    body('client_id').isUUID().withMessage('valid client_id is required'),
    body('name').trim().notEmpty().withMessage('name is required'),
    body('location').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDB();
    const { device_id, client_id, name, location } = req.body;

    // check client exists
    const [client] = await db.execute('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (client.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });

    // check device_id unique
    const [existing] = await db.execute('SELECT id FROM fingerprint_devices WHERE device_id = ?', [device_id]);
    if (existing.length > 0) return res.status(409).json({ success: false, message: 'device_id already registered' });

    const id = uuidv4();
    const device_type = req.body.device_type === 'doorlock' ? 'doorlock' : 'fingerprint';
    await db.execute(
      `INSERT INTO fingerprint_devices (id, device_id, client_id, name, location, device_type) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, device_id, client_id, name, location || null, device_type]
    );

    const [newDevice] = await db.execute('SELECT * FROM fingerprint_devices WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Device registered', data: newDevice[0] });
  })
);

// =============================================
// UPDATE DEVICE INFO (name/location)
// =============================================
router.put('/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('location').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const db = getDB();
    const clientScope = getClientScope(req);

    let checkQuery = 'SELECT id FROM fingerprint_devices WHERE id = ?';
    const checkParams = [req.params.id];
    if (clientScope) { checkQuery += ' AND client_id = ?'; checkParams.push(clientScope); }

    const [existing] = await db.execute(checkQuery, checkParams);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Device not found' });

    const { name, location } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (location !== undefined) { fields.push('location = ?'); values.push(location); }
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'Nothing to update' });

    values.push(req.params.id);
    await db.execute(`UPDATE fingerprint_devices SET ${fields.join(', ')} WHERE id = ?`, values);

    const [updated] = await db.execute('SELECT * FROM fingerprint_devices WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Device updated', data: updated[0] });
  })
);

// =============================================
// DELETE DEVICE (super admin only)
// =============================================
router.delete('/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const [existing] = await db.execute('SELECT id FROM fingerprint_devices WHERE id = ?', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ success: false, message: 'Device not found' });

  await db.execute('DELETE FROM fingerprint_devices WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Device deleted' });
}));

// =============================================
// SEND COMMAND TO DEVICE
// POST /api/devices/:id/command
// body: { command: 'enroll', enroll_id: 5 }
// =============================================
// All valid commands across both device types
const FINGERPRINT_COMMANDS = [
  'enroll', 'delete_fp', 'clear_all', 'list_fp', 'update_url', 'update_wifi',
  'reconnect_wifi', 'clear_settings', 'reboot', 'set_attendance_mode', 'get_status',
  'ota_update',
];
const DOORLOCK_COMMANDS = [
  'unlock', 'lock', 'status', 'restart',
  'enroll', 'delete_fp', 'list_fp', 'export_all', 'export_one', 'import_template',
  'start_rfid_scan', 'stop_rfid_scan',
  'set_duration', 'set_baseurl', 'update_wifi', 'clear_settings',
  'ota_update', 'get_status',
];
const ALL_COMMANDS = [...new Set([...FINGERPRINT_COMMANDS, ...DOORLOCK_COMMANDS])];

router.post('/:id/command',
  [
    body('command').isIn(ALL_COMMANDS).withMessage('Invalid command'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    if (!isMqttConnected()) {
      return res.status(503).json({ success: false, message: 'MQTT broker not connected' });
    }

    const db = getDB();
    const clientScope = getClientScope(req);

    let query = 'SELECT device_id, device_type FROM fingerprint_devices WHERE id = ?';
    const params = [req.params.id];
    if (clientScope) { query += ' AND client_id = ?'; params.push(clientScope); }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Device not found' });

    const deviceId = rows[0].device_id;
    const deviceType = rows[0].device_type;
    const { command, ...cmdParams } = req.body;

    // Validate command is allowed for this device type
    if (deviceType === 'doorlock' && !DOORLOCK_COMMANDS.includes(command)) {
      return res.status(400).json({ success: false, message: `Command '${command}' not supported for door lock devices` });
    }
    if (deviceType === 'fingerprint' && !FINGERPRINT_COMMANDS.includes(command)) {
      return res.status(400).json({ success: false, message: `Command '${command}' not supported for fingerprint devices` });
    }

    // validate command-specific params
    if (command === 'enroll') {
      const id = parseInt(cmdParams.enroll_id);
      const max = deviceType === 'doorlock' ? 300 : 127;
      if (!id || id < 1 || id > max) {
        return res.status(400).json({ success: false, message: `enroll_id must be 1-${max}` });
      }
    }
    if (command === 'delete_fp') {
      const id = parseInt(cmdParams.delete_id);
      const max = deviceType === 'doorlock' ? 300 : 127;
      if (!id || id < 1 || id > max) {
        return res.status(400).json({ success: false, message: `delete_id must be 1-${max}` });
      }
    }
    if (command === 'export_one') {
      const id = parseInt(cmdParams.fp_id);
      if (!id || id < 1 || id > 300) {
        return res.status(400).json({ success: false, message: 'fp_id must be 1-300' });
      }
    }
    if (command === 'set_duration') {
      const d = parseInt(cmdParams.value);
      if (!d || d < 1 || d > 30) {
        return res.status(400).json({ success: false, message: 'duration value must be 1-30 seconds' });
      }
    }
    if (command === 'update_url' || command === 'set_baseurl') {
      const url = cmdParams.base_url || cmdParams.value;
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return res.status(400).json({ success: false, message: 'base_url must start with http:// or https://' });
      }
    }
    if (command === 'update_wifi') {
      if (!cmdParams.ssid) return res.status(400).json({ success: false, message: 'ssid is required' });
      if (!cmdParams.password) return res.status(400).json({ success: false, message: 'password is required' });
    }
    if (command === 'ota_update') {
      if (!cmdParams.url) return res.status(400).json({ success: false, message: 'url is required for OTA update' });
    }

    // Record command sent
    await db.execute(
      `UPDATE fingerprint_devices SET last_command = ?, last_command_at = NOW(), last_command_status = 'pending' WHERE device_id = ?`,
      [command, deviceId]
    );

    try {
      const result = await sendCommand(deviceId, command, cmdParams, deviceType);
      res.json({ success: true, message: 'Command executed', result });
    } catch (err) {
      // Update status to failed if timed out
      await db.execute(
        `UPDATE fingerprint_devices SET last_command_status = 'failed', last_command_result = ? WHERE device_id = ?`,
        [err.message, deviceId]
      );
      res.status(504).json({ success: false, message: err.message });
    }
  })
);

// =============================================
// GET MQTT BROKER STATUS
// =============================================
router.get('/system/mqtt-status', asyncHandler(async (req, res) => {
  res.json({ success: true, mqtt_connected: isMqttConnected() });
}));

module.exports = router;
