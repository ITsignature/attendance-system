const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { getDB } = require('../config/database');
const { sendCommand, isMqttConnected } = require('../services/mqttService');

const router = express.Router();

const FIRMWARE_DIR = path.join(__dirname, '../../firmware');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FIRMWARE_DIR),
  filename: (req, file, cb) => {
    // Saved as {deviceId}_latest.bin — overwriting the previous build
    cb(null, `${req.params.deviceId}_latest.bin`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.bin') {
      return cb(new Error('Only .bin firmware files are accepted'));
    }
    cb(null, true);
  },
});

// =============================================
// GET firmware .bin for a device (called by the ESP32 during OTA)
// No auth — device fetches this directly
// =============================================
router.get('/:deviceId', asyncHandler(async (req, res) => {
  const filePath = path.join(FIRMWARE_DIR, `${req.params.deviceId}_latest.bin`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'No firmware found for this device' });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.deviceId}_latest.bin"`);
  res.sendFile(filePath);
}));

// =============================================
// POST upload firmware + trigger OTA (super admin only)
// POST /api/firmware/:deviceId
// =============================================
router.post('/:deviceId',
  authenticate,
  requireSuperAdmin,
  (req, res, next) => {
    upload.single('firmware')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No firmware file uploaded' });
    }

    const db = getDB();
    const [rows] = await db.execute(
      'SELECT id, device_type FROM fingerprint_devices WHERE device_id = ?',
      [req.params.deviceId]
    );
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    if (rows[0].device_type !== 'fingerprint') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'OTA upload is only supported for fingerprint devices' });
    }

    // Build the public URL the ESP32 will fetch.
    // Always use https (nginx terminates TLS) and /api/firmware/ so the
    // browser-facing URL works; nginx strips /api/ before forwarding to Node.
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'https';
    const otaUrl = `${proto}://${host}/api/firmware/${req.params.deviceId}`;

    // Trigger OTA via MQTT if device is expected to be online
    if (!isMqttConnected()) {
      return res.status(503).json({ success: false, message: 'MQTT broker not connected — firmware saved but OTA not triggered' });
    }

    try {
      const result = await sendCommand(req.params.deviceId, 'ota_update', { url: otaUrl }, 'fingerprint');
      res.json({ success: true, message: 'Firmware uploaded and OTA triggered', url: otaUrl, result });
    } catch (err) {
      // Firmware was saved even if device is offline — admin can retry via separate trigger
      res.status(504).json({
        success: false,
        message: `Firmware saved but OTA command failed: ${err.message}`,
        url: otaUrl,
      });
    }
  })
);

// =============================================
// POST trigger OTA on already-uploaded firmware (no re-upload)
// POST /api/firmware/:deviceId/trigger
// =============================================
router.post('/:deviceId/trigger',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const filePath = path.join(FIRMWARE_DIR, `${req.params.deviceId}_latest.bin`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'No firmware uploaded for this device yet' });
    }

    if (!isMqttConnected()) {
      return res.status(503).json({ success: false, message: 'MQTT broker not connected' });
    }

    const host = req.headers['x-forwarded-host'] || req.get('host');
    const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'https';
    const otaUrl = `${proto}://${host}/api/firmware/${req.params.deviceId}`;

    try {
      const result = await sendCommand(req.params.deviceId, 'ota_update', { url: otaUrl }, 'fingerprint');
      res.json({ success: true, message: 'OTA triggered', url: otaUrl, result });
    } catch (err) {
      res.status(504).json({ success: false, message: err.message });
    }
  })
);

// =============================================
// GET firmware metadata (size, upload date) for a device
// =============================================
router.get('/:deviceId/info',
  authenticate,
  asyncHandler(async (req, res) => {
    const filePath = path.join(FIRMWARE_DIR, `${req.params.deviceId}_latest.bin`);
    if (!fs.existsSync(filePath)) {
      return res.json({ success: true, exists: false });
    }
    const stat = fs.statSync(filePath);
    res.json({
      success: true,
      exists: true,
      size_bytes: stat.size,
      uploaded_at: stat.mtime,
    });
  })
);

module.exports = router;
