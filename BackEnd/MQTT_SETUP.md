# MQTT Setup Guide

## Step 1 — Install Mosquitto on Ubuntu server

SSH into your server, then run:

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

---

## Step 2 — Configure Mosquitto (username + WebSocket)

```bash
sudo nano /etc/mosquitto/conf.d/hrms.conf
```

Paste this exactly:

```
# Plain MQTT for ESP8266 devices
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd

# WebSocket for React browser (frontend)
listener 9001
protocol websockets
allow_anonymous false
password_file /etc/mosquitto/passwd
```

Save and exit (Ctrl+X → Y → Enter).

---

## Step 3 — Create MQTT user

```bash
sudo mosquitto_passwd -c /etc/mosquitto/passwd hrmsuser
```

It will ask you to enter a password twice. Use the same password you put in your `.env` file as `MQTT_PASSWORD`.

---

## Step 4 — Restart Mosquitto

```bash
sudo systemctl restart mosquitto
sudo systemctl status mosquitto
```

You should see "active (running)" in green.

---

## Step 5 — Open firewall ports in aaPanel

Go to your aaPanel → Security → Firewall → Add Port Rule:

| Protocol | Port | Direction | Strategy | Remarks            |
|----------|------|-----------|----------|--------------------|
| TCP      | 1883 | Inbound   | Allow    | MQTT for ESP8266   |
| TCP      | 9001 | Inbound   | Allow    | MQTT WebSocket     |

---

## Step 6 — Add to your .env file

Open `BackEnd/.env` and add:

```env
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=hrmsuser
MQTT_PASSWORD=your_password_here
```

`localhost` because Node.js and Mosquitto are on the same server.

---

## Step 7 — Install mqtt npm package

```bash
cd BackEnd
npm install mqtt
```

---

## Step 8 — Install PubSubClient on Arduino IDE

In Arduino IDE:
- Go to **Sketch → Include Library → Manage Libraries**
- Search for **PubSubClient** by Nick O'Leary
- Install it

---

## Step 9 — Update fingerprint_code.ino

In [fingerprint_code.ino](src/routes/fingerprint_code.ino), update these two lines with your actual server domain and MQTT password:

```cpp
const char* MQTT_BROKER = "attendance.itsignaturesolutions.com";
const char* MQTT_PASS   = "your_password_here";  // same as MQTT_PASSWORD in .env
```

---

## Step 10 — Run the DB migration

Run the SQL in `src/scripts/migrate_fingerprint_devices.sql` on your MySQL database:

```bash
mysql -u your_db_user -p your_db_name < src/scripts/migrate_fingerprint_devices.sql
```

Or paste it directly in phpMyAdmin / aaPanel DB manager.

---

## Step 11 — First device setup (one-time per device)

1. Power on the ESP8266
2. Connect your phone/laptop to **IT-Signature-Setup** WiFi (password: `admin123`)
3. Open browser → go to `192.168.4.1`
4. Login (admin / admin123)
5. In **Device Identity** section → set Device ID (e.g. `DEV001`) → Save
6. In **WiFi Configuration** → set the office WiFi credentials → Save
7. In **Server Configuration** → set your BASE URL → Save
8. After this, all future operations can be done remotely from the HRMS dashboard

---

## Step 12 — Register device in HRMS (super admin)

1. Login to HRMS as super admin
2. Go to **Devices** in the sidebar
3. Click **Register Device**
4. Enter:
   - **Device ID**: same as what you set on the physical device (e.g. `DEV001`)
   - **Client**: select the client this device belongs to
   - **Name**: friendly name (e.g. "Main Entrance Reader")
   - **Location**: optional (e.g. "Ground Floor")
5. Click Register

The device will appear in the list and show Online once it connects to the MQTT broker.

---

## How it all works together

```
ESP8266 (office) ──TCP 1883──► Mosquitto (your server)
                                      │
                         Node.js subscribes to status/result
                                      │
React browser ──WS 9001──────────────┘
                   (future: real-time via MQTT.js)

Dashboard click "Enroll ID 5"
  → Node.js publishes to devices/DEV001/commands
  → ESP8266 receives instantly
  → ESP enrolls fingerprint
  → ESP publishes result to devices/DEV001/result
  → Node.js updates DB, returns response to dashboard
```

## MQTT Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `devices/{device_id}/commands` | Server → ESP | Send commands |
| `devices/{device_id}/status` | ESP → Server | Heartbeat every 30s |
| `devices/{device_id}/result` | ESP → Server | Command result |
