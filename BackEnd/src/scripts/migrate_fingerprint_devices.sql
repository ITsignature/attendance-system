-- Migration: Create fingerprint_devices table
-- Run this on your MySQL database

CREATE TABLE IF NOT EXISTS fingerprint_devices (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  device_id VARCHAR(48) NOT NULL UNIQUE,        -- custom ID stored in ESP EEPROM e.g. DEV001
  client_id VARCHAR(36) NOT NULL,               -- links to clients.id
  name VARCHAR(100) NOT NULL DEFAULT 'Device',
  location VARCHAR(100) DEFAULT NULL,           -- e.g. "Main Entrance", "Office Floor 2"
  device_type VARCHAR(20) NOT NULL DEFAULT 'fingerprint', -- fingerprint | doorlock

  -- Live status (updated by MQTT heartbeat)
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  last_seen DATETIME DEFAULT NULL,
  last_ip VARCHAR(45) DEFAULT NULL,
  wifi_rssi INT DEFAULT NULL,                   -- dBm value e.g. -65
  wifi_ssid VARCHAR(64) DEFAULT NULL,
  free_heap INT DEFAULT NULL,
  uptime_minutes INT DEFAULT NULL,
  current_mode VARCHAR(20) DEFAULT 'attendance', -- attendance | enroll | delete | locked | open
  firmware_version VARCHAR(20) DEFAULT NULL,

  -- Door lock specific status
  door_status VARCHAR(10) DEFAULT NULL,         -- locked | open (doorlock only)
  fp_count INT DEFAULT NULL,                    -- fingerprint template count
  rfid_ready TINYINT(1) DEFAULT NULL,           -- PN532 RFID ready (doorlock only)
  unlock_duration INT DEFAULT NULL,             -- seconds door stays unlocked

  -- Last command tracking
  last_command VARCHAR(50) DEFAULT NULL,
  last_command_at DATETIME DEFAULT NULL,
  last_command_status VARCHAR(20) DEFAULT NULL, -- pending | success | failed
  last_command_result TEXT DEFAULT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_fd_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_fd_client (client_id),
  INDEX idx_fd_device_id (device_id),
  INDEX idx_fd_online (is_online),
  INDEX idx_fd_type (device_type)
);

-- If table already exists, add new columns with ALTER TABLE
-- Run these only if you already ran the previous migration:
-- ALTER TABLE fingerprint_devices ADD COLUMN device_type VARCHAR(20) NOT NULL DEFAULT 'fingerprint' AFTER location;
-- ALTER TABLE fingerprint_devices ADD COLUMN door_status VARCHAR(10) DEFAULT NULL AFTER current_mode;
-- ALTER TABLE fingerprint_devices ADD COLUMN fp_count INT DEFAULT NULL AFTER door_status;
-- ALTER TABLE fingerprint_devices ADD COLUMN rfid_ready TINYINT(1) DEFAULT NULL AFTER fp_count;
-- ALTER TABLE fingerprint_devices ADD COLUMN unlock_duration INT DEFAULT NULL AFTER rfid_ready;
