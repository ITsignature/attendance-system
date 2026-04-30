const mqtt = require('mqtt');
const { getDB } = require('../config/database');

let mqttClient = null;
let isConnected = false;

// pending command resolvers: device_id -> { resolve, reject, timer }
const pendingCommands = new Map();

const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const COMMAND_TIMEOUT_MS = 30000;

function getMqttClient() {
  return mqttClient;
}

function isMqttConnected() {
  return isConnected;
}

function connectMQTT() {
  const options = {
    clientId: `hrms-server-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };
  if (MQTT_USERNAME) {
    options.username = MQTT_USERNAME;
    options.password = MQTT_PASSWORD;
  }

  mqttClient = mqtt.connect(MQTT_BROKER, options);

  mqttClient.on('connect', () => {
    isConnected = true;
    console.log('✅ MQTT connected to broker:', MQTT_BROKER);

    // Subscribe to all device status and result topics
    mqttClient.subscribe('devices/+/status', { qos: 1 });
    mqttClient.subscribe('devices/+/result', { qos: 1 });
    console.log('📡 MQTT subscribed to devices/+/status and devices/+/result');
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT reconnecting...');
  });

  mqttClient.on('offline', () => {
    isConnected = false;
    console.log('⚠️  MQTT offline');
  });

  mqttClient.on('error', (err) => {
    console.error('❌ MQTT error:', err.message);
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const parts = topic.split('/');
      // topic format: devices/{device_id}/status  or  devices/{device_id}/result
      if (parts.length !== 3 || parts[0] !== 'devices') return;

      const deviceId = parts[1];
      const type = parts[2];

      if (type === 'status') {
        await handleStatusMessage(deviceId, payload);
      } else if (type === 'result') {
        await handleResultMessage(deviceId, payload);
      }
    } catch (err) {
      console.error('MQTT message parse error:', err.message);
    }
  });
}

async function handleStatusMessage(deviceId, payload) {
  try {
    const db = getDB();
    await db.execute(
      `UPDATE fingerprint_devices SET
        is_online = 1,
        last_seen = NOW(),
        last_ip = ?,
        wifi_rssi = ?,
        wifi_ssid = ?,
        free_heap = ?,
        uptime_minutes = ?,
        current_mode = ?,
        firmware_version = ?,
        updated_at = NOW()
      WHERE device_id = ?`,
      [
        payload.ip || null,
        payload.rssi || null,
        payload.ssid || null,
        payload.free_heap || null,
        payload.uptime_minutes || null,
        payload.mode || 'attendance',
        payload.firmware || null,
        deviceId,
      ]
    );
  } catch (err) {
    console.error('MQTT handleStatusMessage DB error:', err.message);
  }
}

async function handleResultMessage(deviceId, payload) {
  try {
    const db = getDB();
    const status = payload.success ? 'success' : 'failed';

    await db.execute(
      `UPDATE fingerprint_devices SET
        last_command_status = ?,
        last_command_result = ?,
        current_mode = ?,
        updated_at = NOW()
      WHERE device_id = ?`,
      [
        status,
        payload.message || null,
        payload.mode || null,
        deviceId,
      ]
    );

    // Resolve pending promise if any
    if (pendingCommands.has(deviceId)) {
      const { resolve, timer } = pendingCommands.get(deviceId);
      clearTimeout(timer);
      pendingCommands.delete(deviceId);
      resolve({ success: payload.success, message: payload.message, mode: payload.mode });
    }
  } catch (err) {
    console.error('MQTT handleResultMessage DB error:', err.message);
  }
}

/**
 * Send a command to a device and wait for its result (max 30s)
 * Returns a promise that resolves with { success, message }
 */
function sendCommand(deviceId, command, params = {}) {
  return new Promise((resolve, reject) => {
    if (!isConnected || !mqttClient) {
      return reject(new Error('MQTT broker not connected'));
    }

    const topic = `devices/${deviceId}/commands`;
    const payload = JSON.stringify({ command, ...params, ts: Date.now() });

    // Cancel any existing pending command for this device
    if (pendingCommands.has(deviceId)) {
      const existing = pendingCommands.get(deviceId);
      clearTimeout(existing.timer);
      existing.reject(new Error('Superseded by new command'));
      pendingCommands.delete(deviceId);
    }

    const timer = setTimeout(() => {
      pendingCommands.delete(deviceId);
      reject(new Error('Command timed out — device did not respond in 30s'));
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(deviceId, { resolve, reject, timer });

    mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        clearTimeout(timer);
        pendingCommands.delete(deviceId);
        reject(new Error('Failed to publish MQTT command: ' + err.message));
      }
    });
  });
}

/**
 * Mark devices offline if no status received in last 2 minutes
 * Called by a cron in server.js
 */
async function markStaleDevicesOffline() {
  try {
    const db = getDB();
    await db.execute(
      `UPDATE fingerprint_devices SET is_online = 0
       WHERE is_online = 1 AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 2 MINUTE))`
    );
  } catch (err) {
    console.error('MQTT markStaleDevicesOffline error:', err.message);
  }
}

module.exports = {
  connectMQTT,
  getMqttClient,
  isMqttConnected,
  sendCommand,
  markStaleDevicesOffline,
};
