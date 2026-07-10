const mqtt = require('mqtt');
const { getDB } = require('../config/database');
const { emitDeviceLog, emitDeviceEvent } = require('./socketService');

let mqttClient = null;
let isConnected = false;

// pending command resolvers: device_id -> { resolve, reject, timer }
const pendingCommands = new Map();

// template_data listeners: device_id -> callback(data)
const templateListeners = new Map();

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

    // Fingerprint device topics
    mqttClient.subscribe('devices/+/status', { qos: 1 });
    mqttClient.subscribe('devices/+/result', { qos: 1 });
    mqttClient.subscribe('devices/+/template_data', { qos: 1 });
    // Door lock enroll progress topic
    mqttClient.subscribe('devices/+/enroll/progress', { qos: 1 });
    // Live serial log streaming
    mqttClient.subscribe('devices/+/log', { qos: 0 });
    console.log('📡 MQTT subscribed to device topics');
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
      const parts = topic.split('/');
      if (parts[0] !== 'devices') return;

      const deviceId = parts[1];
      const type = parts[2];

      if (type === 'log') {
        emitDeviceLog(deviceId, message.toString());
        return;
      }

      if (type === 'template_data') {
        const cb = templateListeners.get(deviceId);
        if (cb) cb(JSON.parse(message.toString()));
        return;
      }

      const payload = JSON.parse(message.toString());

      if (type === 'status') {
        await handleStatusMessage(deviceId, payload);
        // Door lock resolves pending commands via status (no separate result topic)
        if (pendingCommands.has(deviceId)) {
          const { resolve, timer } = pendingCommands.get(deviceId);
          clearTimeout(timer);
          pendingCommands.delete(deviceId);
          resolve({ success: true, message: `Door: ${payload.door || 'unknown'}`, door: payload.door });
        }
      } else if (type === 'result') {
        await handleResultMessage(deviceId, payload);
      } else if (parts.length === 4 && parts[2] === 'enroll' && parts[3] === 'progress') {
        // Door lock enroll progress — resolve pending enroll command when done
        if (payload.state === 6 || payload.state === 7) { // ENROLL_DONE_OK=6, ENROLL_DONE_FAIL=7
          if (pendingCommands.has(deviceId)) {
            const { resolve, timer } = pendingCommands.get(deviceId);
            clearTimeout(timer);
            pendingCommands.delete(deviceId);
            resolve({ success: payload.state === 6, message: payload.msg || 'Enroll complete' });
          }
        }
      }
    } catch (err) {
      console.error('MQTT message parse error:', err.message);
    }
  });
}

async function handleStatusMessage(deviceId, payload) {
  try {
    const db = getDB();

    // Check device type to handle door lock vs fingerprint status fields
    const [rows] = await db.execute('SELECT device_type FROM fingerprint_devices WHERE device_id = ?', [deviceId]);
    if (rows.length === 0) return; // unregistered device, ignore
    const isDoorLock = rows[0].device_type === 'doorlock';

    if (isDoorLock) {
      // Door lock status payload fields: online, door, rssi, signal_pct, fp_ready, fp_count, rfid_ready, uptime_min, ip, unlock_dur, ssid
      await db.execute(
        `UPDATE fingerprint_devices SET
          is_online = 1,
          last_seen = NOW(),
          last_ip = ?,
          wifi_rssi = ?,
          wifi_ssid = ?,
          uptime_minutes = ?,
          door_status = ?,
          fp_count = ?,
          rfid_ready = ?,
          unlock_duration = ?,
          current_mode = ?,
          updated_at = NOW()
        WHERE device_id = ?`,
        [
          payload.ip || null,
          payload.rssi || null,
          payload.ssid || null,
          payload.uptime_min || null,
          payload.door || null,
          payload.fp_count ?? null,
          payload.rfid_ready ? 1 : 0,
          payload.unlock_dur || null,
          payload.door === 'open' ? 'open' : 'locked',
          deviceId,
        ]
      );
    } else {
      // Fingerprint attendance device
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
    }
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

    // Fingerprint enrollment completed (asynchronous, after "enroll" command already resolved)
    if (payload.enroll_done) {
      emitDeviceEvent(deviceId, 'enroll_done', {
        success: payload.success,
        message: payload.message,
        enroll_id: payload.enroll_id,
      });
      return;
    }

    // Resolve pending promise if any
    if (pendingCommands.has(deviceId)) {
      const { resolve, timer } = pendingCommands.get(deviceId);
      clearTimeout(timer);
      pendingCommands.delete(deviceId);
      resolve({ success: payload.success, message: payload.message, mode: payload.mode, used_ids: payload.used_ids });
    }
  } catch (err) {
    console.error('MQTT handleResultMessage DB error:', err.message);
  }
}

// Door lock fingerprint commands go to /finger topic, others to /commands
const DOORLOCK_FINGER_COMMANDS = ['enroll', 'delete_fp', 'list_fp', 'export_all', 'export_one', 'import_template'];

// Map HRMS command names to door lock action names + topic
function buildDoorLockPayload(command, params) {
  // fingerprint sub-topic commands
  if (DOORLOCK_FINGER_COMMANDS.includes(command)) {
    const actionMap = {
      enroll:           { action: 'enroll',           id: params.enroll_id },
      delete_fp:        { action: 'delete',            id: params.delete_id },
      list_fp:          { action: 'list' },
      export_all:       { action: 'export_all' },
      export_one:       { action: 'export_one',        id: params.fp_id },
      import_template:  { action: 'import_template',   id: params.fp_id, template: params.template },
    };
    return { topic: 'finger', payload: actionMap[command] || { action: command } };
  }
  // RFID sub-topic commands
  if (command === 'start_rfid_scan') return { topic: 'commands', payload: { action: 'start_rfid_scan' } };
  if (command === 'stop_rfid_scan')  return { topic: 'commands', payload: { action: 'stop_rfid_scan' } };

  // main /commands topic
  const actionMap = {
    unlock:             { action: 'unlock' },
    lock:               { action: 'lock' },
    status:             { action: 'status' },
    get_status:         { action: 'status' },
    restart:            { action: 'restart' },
    reboot:             { action: 'restart' },
    set_duration:       { action: 'set_duration',      value: params.value },
    set_baseurl:        { action: 'set_baseurl',        value: params.base_url || params.value },
    update_wifi:        { action: 'set_wifi',           ssid: params.ssid, pass: params.password },
    clear_settings:     { action: 'clear_settings' },
    ota_update:         { action: 'ota_update',         url: params.url },
  };
  return { topic: 'commands', payload: actionMap[command] || { action: command } };
}

/**
 * Send a command to a device and wait for its result (max 30s)
 * deviceType: 'fingerprint' | 'doorlock'
 */
function sendCommand(deviceId, command, params = {}, deviceType = 'fingerprint') {
  return new Promise((resolve, reject) => {
    if (!isConnected || !mqttClient) {
      return reject(new Error('MQTT broker not connected'));
    }

    let topic;
    let payloadStr;

    if (deviceType === 'doorlock') {
      const { topic: subTopic, payload: dlPayload } = buildDoorLockPayload(command, params);
      topic = `devices/${deviceId}/${subTopic}`;
      payloadStr = JSON.stringify({ ...dlPayload, ts: Date.now() });
    } else {
      topic = `devices/${deviceId}/commands`;
      payloadStr = JSON.stringify({ command, ...params, ts: Date.now() });
    }

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

    mqttClient.publish(topic, payloadStr, { qos: 1 }, (err) => {
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

function onTemplateData(deviceId, cb) {
  templateListeners.set(deviceId, cb);
}

function offTemplateData(deviceId) {
  templateListeners.delete(deviceId);
}

module.exports = {
  connectMQTT,
  getMqttClient,
  isMqttConnected,
  sendCommand,
  markStaleDevicesOffline,
  onTemplateData,
  offTemplateData,
};
