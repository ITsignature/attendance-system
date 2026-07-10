const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { getDB } = require('../config/database');
const { sendCommand, isMqttConnected, onTemplateData, offTemplateData } = require('../services/mqttService');

const router = express.Router();

// =============================================
// POST /api/fingerprint-backup/:deviceId/export
// Exports all templates from the sensor as a JSON backup file.
// For each stored ID, sends export_fp command and waits for template_data.
// =============================================
router.post('/:deviceId/export',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    if (!isMqttConnected()) {
      return res.status(503).json({ success: false, message: 'MQTT broker not connected' });
    }

    const db = getDB();
    const [rows] = await db.execute(
      'SELECT device_id FROM fingerprint_devices WHERE device_id = ? AND device_type = ?',
      [req.params.deviceId, 'fingerprint']
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fingerprint device not found' });
    }

    // First get the list of stored IDs from the device
    let listResult;
    try {
      listResult = await sendCommand(req.params.deviceId, 'list_fp', {}, 'fingerprint');
    } catch (err) {
      return res.status(504).json({ success: false, message: 'Could not get fingerprint list: ' + err.message });
    }

    const usedIds = listResult?.used_ids || [];
    if (usedIds.length === 0) {
      return res.json({ success: true, data: { device_id: req.params.deviceId, timestamp: new Date().toISOString(), fingerprints: [] } });
    }

    const fingerprints = [];
    const TEMPLATE_TIMEOUT = 10000; // 10s per template

    // Register template_data listener
    const templatePromise = (id) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        offTemplateData(req.params.deviceId);
        reject(new Error(`Timeout waiting for template ID ${id}`));
      }, TEMPLATE_TIMEOUT);

      onTemplateData(req.params.deviceId, (data) => {
        if (data.id === id) {
          clearTimeout(timer);
          resolve(data);
        }
      });
    });

    for (const id of usedIds) {
      try {
        const tplPromise = templatePromise(id);
        // Send export_fp — result comes back on template_data topic (not result topic)
        // Fire and forget the command (it publishes to template_data, not result)
        const { getMqttClient } = require('../services/mqttService');
        const mqttClient = getMqttClient();
        mqttClient.publish(
          `devices/${req.params.deviceId}/commands`,
          JSON.stringify({ command: 'export_fp', id, ts: Date.now() }),
          { qos: 1 }
        );

        const tplData = await tplPromise;
        offTemplateData(req.params.deviceId);
        fingerprints.push({ id: tplData.id, template: tplData.template });
      } catch (err) {
        offTemplateData(req.params.deviceId);
        return res.status(504).json({ success: false, message: err.message, exported_so_far: fingerprints.length });
      }
    }

    const backup = {
      device_id: req.params.deviceId,
      timestamp: new Date().toISOString(),
      fingerprints,
    };

    res.json({ success: true, data: backup });
  })
);

// =============================================
// POST /api/fingerprint-backup/:deviceId/restore
// Restores templates from a JSON backup to the sensor.
// Body: { fingerprints: [{ id, template }] }
// =============================================
router.post('/:deviceId/restore',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    if (!isMqttConnected()) {
      return res.status(503).json({ success: false, message: 'MQTT broker not connected' });
    }

    const db = getDB();
    const [rows] = await db.execute(
      'SELECT device_id FROM fingerprint_devices WHERE device_id = ? AND device_type = ?',
      [req.params.deviceId, 'fingerprint']
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fingerprint device not found' });
    }

    const { fingerprints } = req.body;
    if (!Array.isArray(fingerprints) || fingerprints.length === 0) {
      return res.status(400).json({ success: false, message: 'fingerprints array is required' });
    }

    const results = [];
    for (const fp of fingerprints) {
      if (!fp.id || !fp.template || fp.template.length !== 1024) {
        results.push({ id: fp.id, success: false, message: 'Invalid template data' });
        continue;
      }
      try {
        await sendCommand(req.params.deviceId, 'import_fp', { id: fp.id, template: fp.template }, 'fingerprint');
        results.push({ id: fp.id, success: true });
      } catch (err) {
        results.push({ id: fp.id, success: false, message: err.message });
      }
    }

    const failed = results.filter(r => !r.success);
    res.json({
      success: failed.length === 0,
      message: `Restored ${results.length - failed.length}/${results.length} templates`,
      results,
    });
  })
);

module.exports = router;
