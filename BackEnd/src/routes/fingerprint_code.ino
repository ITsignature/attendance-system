#include <SoftwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <NTPClient.h>
#include <WiFiClientSecure.h>
#include <ESP8266WebServer.h>
#include <PubSubClient.h>

// AS608 Fingerprint Scanner
#define FP_TX_PIN D1
#define FP_RX_PIN D2
// LCD Display
#define LED_SDA_PIN D3
#define LED_SCL_PIN D4
// Buzzer
#define BUZZER_PIN D0

SoftwareSerial mySerial(FP_RX_PIN, FP_TX_PIN);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure client;
HTTPClient http;
ESP8266WebServer server(80);
WiFiClient mqttWifiClient;
PubSubClient mqttClient(mqttWifiClient);

// =============================================
// EEPROM LAYOUT
// 0   - 199 : WiFi credentials  (ssid|password)
// 200 - 311 : BASE_URL
// 312 - 360 : Device ID (custom, e.g. DEV001)
// =============================================
#define EEPROM_SIZE       512
#define WIFI_START_ADDR      0
#define BASEURL_START_ADDR 200
#define DEVID_START_ADDR   312
#define DEVID_MAX_LEN       48

String stationSSID     = "";
String stationPassword = "";
String lastError       = "";
String BASE_URL        = "https://attendance.itsignaturesolutions.com/api/api/attendance/fingerprint?client_id=&fingerprint_id=";
String DEVICE_ID       = "";   // loaded from EEPROM, set via local dashboard

// =============================================
// MQTT CONFIG — change to your server IP/domain
// =============================================
const char* MQTT_BROKER   = "attendance.itsignaturesolutions.com";
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "hrmsuser";
const char* MQTT_PASS     = "your_strong_password_here";  // match .env MQTT_PASSWORD

// Topics (filled after DEVICE_ID loaded)
String topicCommands = "";
String topicStatus   = "";
String topicResult   = "";

const String AP_SSID     = "IT-Signature-Setup";
const String AP_PASSWORD = "admin123";

// Auth
const String ADMIN_USERNAME = "admin";
const String ADMIN_PASSWORD = "admin123";
String currentSessionToken  = "";
unsigned long sessionStartTime = 0;
const unsigned long SESSION_TIMEOUT = 3600000;

// Timing
unsigned long lastScanTime        = 0;
unsigned long backlightOnTime     = 0;
unsigned long lastStationCheck    = 0;
unsigned long lastMqttReconnect   = 0;
unsigned long lastStatusPublish   = 0;
const unsigned long SCAN_DEBOUNCE          = 1000;
const unsigned long BACKLIGHT_DURATION     = 5000;
const unsigned long STATION_CHECK_INTERVAL = 30000;
const unsigned long MQTT_RECONNECT_INTERVAL = 5000;
const unsigned long STATUS_PUBLISH_INTERVAL = 30000;  // heartbeat every 30s

bool backlightActive  = false;
bool stationConnected = false;
bool fingerprintSensorOK = false;

// Modes
enum OperationMode { MODE_ATTENDANCE, MODE_ENROLL, MODE_DELETE };
OperationMode currentMode = MODE_ATTENDANCE;
int enrollID = 0;

StaticJsonDocument<256> jsonDoc;

// =============================================
// HTML TEMPLATES (unchanged from original)
// =============================================
const String HTML_HEAD = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>IT Signature</title></head>";
const String CSS_OPTIMIZED = "<style>body{font-family:Arial;background:linear-gradient(135deg,#1E9ADA,#6BC7F0);margin:0;padding:20px;min-height:100vh;box-sizing:border-box}.container{max-width:900px;margin:0 auto}.card{background:#fff;padding:20px;border-radius:10px;box-shadow:0 5px 15px rgba(0,0,0,0.1);margin-bottom:15px}.logo{font-size:28px;color:#1E9ADA;font-weight:bold;text-align:center;margin-bottom:10px}.btn{background:#1E9ADA;color:#fff;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-size:14px;margin:5px}.btn:hover{background:#0A7CB8}.btn-danger{background:#f44336}.btn-success{background:#4CAF50}.btn-warning{background:#FF9800}.form-group{margin-bottom:15px}.form-group label{display:block;margin-bottom:5px;font-weight:500}.form-group input{width:100%;padding:8px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;word-break:break-all}.status{padding:8px;border-radius:5px;margin:5px 0;word-wrap:break-word;overflow-wrap:break-word}.status-success{background:#e8f5e8;color:#4CAF50}.status-error{background:#ffe8e8;color:#f44336}.status-info{background:#f8f9fa;color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px}.fingerprint-list{max-height:300px;overflow-y:auto;border:1px solid #ddd;padding:10px;border-radius:5px}.fp-item{padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}.fp-item:last-child{border-bottom:none}.pagination{text-align:center;margin:10px 0}.pagination .btn{margin:2px;font-size:12px;padding:5px 10px}.pagination .current{background:#FF9800;color:#fff}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.spinner{animation:spin 2s linear infinite}</style>";

// =============================================
// EEPROM HELPERS
// =============================================
void setupEEPROM() { EEPROM.begin(EEPROM_SIZE); }

void clearEEPROM() {
  for (int i = 0; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
  EEPROM.commit();
}

void saveWiFiToEEPROM(const String& ssid, const String& pass) {
  for (int i = WIFI_START_ADDR; i < BASEURL_START_ADDR; i++) EEPROM.write(i, 0);
  for (int i = 0; i < ssid.length(); ++i) EEPROM.write(WIFI_START_ADDR + i, ssid[i]);
  EEPROM.write(WIFI_START_ADDR + ssid.length(), '|');
  for (int i = 0; i < pass.length(); ++i) EEPROM.write(WIFI_START_ADDR + i + ssid.length() + 1, pass[i]);
  EEPROM.commit();
}

bool loadWiFiFromEEPROM(String& ssid, String& pass) {
  String content = "";
  content.reserve(BASEURL_START_ADDR - WIFI_START_ADDR);
  for (int i = WIFI_START_ADDR; i < BASEURL_START_ADDR; i++) {
    char c = EEPROM.read(i);
    if (c == 0) break;
    content += c;
  }
  int sep = content.indexOf('|');
  if (sep == -1) return false;
  ssid = content.substring(0, sep);
  pass = content.substring(sep + 1);
  return true;
}

void saveBaseURLToEEPROM(const String& baseurl) {
  for (int i = BASEURL_START_ADDR; i < DEVID_START_ADDR; i++) EEPROM.write(i, 0);
  for (int i = 0; i < baseurl.length() && i < (DEVID_START_ADDR - BASEURL_START_ADDR - 1); ++i)
    EEPROM.write(BASEURL_START_ADDR + i, baseurl[i]);
  EEPROM.commit();
}

bool loadBaseURLFromEEPROM(String& baseurl) {
  String content = "";
  content.reserve(DEVID_START_ADDR - BASEURL_START_ADDR);
  for (int i = BASEURL_START_ADDR; i < DEVID_START_ADDR; i++) {
    char c = EEPROM.read(i);
    if (c == 0) break;
    content += c;
  }
  if (content.length() > 10) { baseurl = content; return true; }
  return false;
}

void clearBaseURLFromEEPROM() {
  for (int i = BASEURL_START_ADDR; i < DEVID_START_ADDR; i++) EEPROM.write(i, 0);
  EEPROM.commit();
}

void saveDeviceIDToEEPROM(const String& devId) {
  for (int i = DEVID_START_ADDR; i < DEVID_START_ADDR + DEVID_MAX_LEN; i++) EEPROM.write(i, 0);
  for (int i = 0; i < devId.length() && i < DEVID_MAX_LEN - 1; ++i)
    EEPROM.write(DEVID_START_ADDR + i, devId[i]);
  EEPROM.commit();
}

bool loadDeviceIDFromEEPROM(String& devId) {
  String content = "";
  content.reserve(DEVID_MAX_LEN);
  for (int i = DEVID_START_ADDR; i < DEVID_START_ADDR + DEVID_MAX_LEN; i++) {
    char c = EEPROM.read(i);
    if (c == 0) break;
    content += c;
  }
  if (content.length() > 0) { devId = content; return true; }
  return false;
}

// =============================================
// MQTT HELPERS
// =============================================
void buildMqttTopics() {
  topicCommands = "devices/" + DEVICE_ID + "/commands";
  topicStatus   = "devices/" + DEVICE_ID + "/status";
  topicResult   = "devices/" + DEVICE_ID + "/result";
}

void publishStatus() {
  if (!mqttClient.connected() || DEVICE_ID.length() == 0) return;

  StaticJsonDocument<256> doc;
  doc["ip"]             = stationConnected ? WiFi.localIP().toString() : "";
  doc["rssi"]           = stationConnected ? WiFi.RSSI() : 0;
  doc["ssid"]           = stationConnected ? WiFi.SSID() : "";
  doc["free_heap"]      = ESP.getFreeHeap();
  doc["uptime_minutes"] = millis() / 60000;
  doc["mode"]           = (currentMode == MODE_ATTENDANCE) ? "attendance" :
                          (currentMode == MODE_ENROLL)     ? "enroll" : "delete";
  doc["firmware"]       = "1.1.0";

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(topicStatus.c_str(), payload.c_str(), false);
}

void publishResult(bool success, const String& message, const String& mode = "") {
  if (!mqttClient.connected() || DEVICE_ID.length() == 0) return;

  StaticJsonDocument<200> doc;
  doc["success"] = success;
  doc["message"] = message;
  if (mode.length() > 0) doc["mode"] = mode;

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(topicResult.c_str(), payload.c_str(), false);
}

// =============================================
// MQTT COMMAND HANDLER
// =============================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.println("MQTT command received: " + msg);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) {
    publishResult(false, "JSON parse error");
    return;
  }

  String command = doc["command"].as<String>();

  if (command == "get_status") {
    publishStatus();
    publishResult(true, "Status sent", currentMode == MODE_ATTENDANCE ? "attendance" : "enroll");

  } else if (command == "set_attendance_mode") {
    currentMode = MODE_ATTENDANCE;
    displayWelcome();
    publishResult(true, "Switched to attendance mode", "attendance");

  } else if (command == "enroll") {
    int id = doc["enroll_id"] | 0;
    if (id < 1 || id > 127) { publishResult(false, "Invalid enroll ID"); return; }
    enrollID = id;
    currentMode = MODE_ENROLL;
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Enroll Mode");
    lcd.setCursor(0, 1); lcd.print("ID: " + String(enrollID));
    activateBacklight();
    publishResult(true, "Enrollment started for ID " + String(enrollID), "enroll");

  } else if (command == "delete_fp") {
    int id = doc["delete_id"] | 0;
    if (id < 1 || id > 127 || !fingerprintSensorOK) {
      publishResult(false, "Invalid ID or sensor unavailable"); return;
    }
    uint8_t p = finger.deleteModel(id);
    if (p == FINGERPRINT_OK) {
      lcd.clear(); lcd.setCursor(0, 0); lcd.print("Deleted ID:" + String(id));
      activateBacklight(); buzzerSound();
      delay(1500); displayWelcome();
      publishResult(true, "Deleted fingerprint ID " + String(id), "attendance");
    } else {
      publishResult(false, "Delete failed for ID " + String(id));
    }

  } else if (command == "clear_all") {
    if (!fingerprintSensorOK) { publishResult(false, "Sensor unavailable"); return; }
    finger.emptyDatabase();
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("All Deleted");
    activateBacklight(); delay(1500); displayWelcome();
    publishResult(true, "All fingerprints cleared", "attendance");

  } else if (command == "update_url") {
    String newUrl = doc["base_url"].as<String>();
    if (newUrl.length() == 0) { publishResult(false, "base_url empty"); return; }
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
      publishResult(false, "base_url must start with http:// or https://"); return;
    }
    saveBaseURLToEEPROM(newUrl);
    BASE_URL = newUrl;
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("URL Updated!");
    activateBacklight();
    publishResult(true, "BASE URL updated successfully");

  } else if (command == "update_wifi") {
    String newSSID = doc["ssid"].as<String>();
    String newPass = doc["password"].as<String>();
    if (newSSID.length() == 0) { publishResult(false, "SSID empty"); return; }
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("Updating WiFi");
    lcd.setCursor(0, 1); lcd.print(newSSID);
    activateBacklight();
    testWiFiConnection(newSSID, newPass);
    if (stationConnected) {
      publishResult(true, "WiFi updated, IP: " + WiFi.localIP().toString());
    } else {
      publishResult(false, "WiFi update failed: " + lastError);
    }

  } else if (command == "reconnect_wifi") {
    attemptStationConnection();
    if (stationConnected) {
      publishResult(true, "WiFi reconnected, IP: " + WiFi.localIP().toString());
    } else {
      publishResult(false, "Reconnect failed: " + lastError);
    }

  } else if (command == "clear_settings") {
    clearEEPROM();
    stationSSID = ""; stationPassword = ""; stationConnected = false;
    lastError = "";
    BASE_URL = "https://attendance.itsignaturesolutions.com/api/api/attendance/fingerprint?client_id=&fingerprint_id=";
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("Settings Cleared");
    activateBacklight();
    publishResult(true, "All settings cleared");

  } else if (command == "reboot") {
    publishResult(true, "Rebooting...");
    delay(500);
    ESP.restart();

  } else {
    publishResult(false, "Unknown command: " + command);
  }
}

void reconnectMQTT() {
  if (mqttClient.connected() || !stationConnected || DEVICE_ID.length() == 0) return;
  if (millis() - lastMqttReconnect < MQTT_RECONNECT_INTERVAL) return;
  lastMqttReconnect = millis();

  Serial.println("Connecting to MQTT broker...");
  String clientId = "esp-" + DEVICE_ID;

  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected as: " + clientId);
    mqttClient.subscribe(topicCommands.c_str(), 1);
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("MQTT Connected");
    activateBacklight(); delay(1000); displayWelcome();
    publishStatus();
  } else {
    Serial.println("MQTT connect failed, rc=" + String(mqttClient.state()));
  }
}

// =============================================
// AUTH
// =============================================
String generateSessionToken() {
  String token = "";
  token.reserve(32);
  for (int i = 0; i < 32; i++) token += String(random(16), HEX);
  return token;
}

bool isAuthenticated() {
  if (currentSessionToken.length() == 0) return false;
  if (millis() - sessionStartTime > SESSION_TIMEOUT) { currentSessionToken = ""; return false; }
  String s = server.arg("session");
  if (s.length() > 0 && s == currentSessionToken) { sessionStartTime = millis(); return true; }
  String ps = server.arg("session_token");
  if (ps.length() > 0 && ps == currentSessionToken) { sessionStartTime = millis(); return true; }
  return false;
}

// =============================================
// WEB SERVER HANDLERS (local 192.168.4.1)
// =============================================
void handleRoot() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  server.send(200, "text/html", generateOptimizedDashboard());
}

String generateLoginHTML(String errorMsg = "") {
  String html = HTML_HEAD + CSS_OPTIMIZED;
  html += "<body><div class='container'><div class='card'>";
  html += "<div class='logo'>IT Signature</div>";
  html += "<h3 style='text-align:center;margin:0 0 20px 0'>Admin Login</h3>";
  if (errorMsg.length() > 0) html += "<div class='status status-error'>" + errorMsg + "</div>";
  html += "<form method='POST' action='/login'>";
  html += "<div class='form-group'><label>Username:</label><input type='text' name='username' required autofocus></div>";
  html += "<div class='form-group'><label>Password:</label><input type='password' name='password' required></div>";
  html += "<button type='submit' class='btn' style='width:100%'>Login</button>";
  html += "</form></div></div></body></html>";
  return html;
}

void handleLogin() {
  if (server.method() == HTTP_POST) {
    if (server.arg("username") == ADMIN_USERNAME && server.arg("password") == ADMIN_PASSWORD) {
      currentSessionToken = generateSessionToken();
      sessionStartTime = millis();
      server.sendHeader("Location", "/?session=" + currentSessionToken);
      server.send(302, "text/plain", "");
    } else {
      server.send(200, "text/html", generateLoginHTML("Invalid credentials!"));
    }
    return;
  }
  server.send(200, "text/html", generateLoginHTML(""));
}

void handleLogout() {
  currentSessionToken = ""; sessionStartTime = 0; currentMode = MODE_ATTENDANCE;
  server.sendHeader("Location", "/login"); server.send(302, "text/plain", "");
}

bool fingerprintExists(uint16_t id) { return (finger.loadModel(id) == FINGERPRINT_OK); }

uint16_t fingerprintIDs[60];
uint16_t fingerprintCount = 0;

void getAllFingerprints() {
  fingerprintCount = 0;
  if (!fingerprintSensorOK) return;
  for (uint16_t id = 1; id <= 60 && fingerprintCount < 60; id++) {
    yield();
    if (fingerprintExists(id)) { fingerprintIDs[fingerprintCount] = id; fingerprintCount++; }
    delay(2);
  }
}

String getStoredFingerprintsWithPagination(int page = 1) {
  if (!fingerprintSensorOK) return F("<div class='status status-error'>Sensor not available</div>");
  getAllFingerprints();
  if (fingerprintCount == 0) return F("<div class='status status-info'>No fingerprints stored</div>");

  const int itemsPerPage = 5;
  int totalPages = (fingerprintCount + itemsPerPage - 1) / itemsPerPage;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  int startIdx = (page - 1) * itemsPerPage;
  int endIdx   = min(startIdx + itemsPerPage, (int)fingerprintCount);

  String fpList;
  fpList.reserve(2000);

  if (totalPages > 1) {
    fpList += F("<div class='pagination'>");
    if (page > 1) { fpList += F("<a href='/?session="); fpList += currentSessionToken; fpList += F("&fp_page="); fpList += (page-1); fpList += F("' class='btn'>‹ Prev</a>"); }
    for (int p = 1; p <= totalPages; p++) {
      if (p == page) { fpList += F("<span class='btn current'>"); fpList += p; fpList += F("</span>"); }
      else { fpList += F("<a href='/?session="); fpList += currentSessionToken; fpList += F("&fp_page="); fpList += p; fpList += F("' class='btn'>"); fpList += p; fpList += F("</a>"); }
    }
    if (page < totalPages) { fpList += F("<a href='/?session="); fpList += currentSessionToken; fpList += F("&fp_page="); fpList += (page+1); fpList += F("' class='btn'>Next ›</a>"); }
    fpList += F("</div>");
  }

  fpList += F("<div class='fingerprint-list'>");
  for (int i = startIdx; i < endIdx; i++) {
    uint16_t id = fingerprintIDs[i];
    fpList += F("<div class='fp-item'><span>ID: "); fpList += id; fpList += F("</span>");
    fpList += F("<form method='POST' action='/delete-fingerprint' style='margin:0'>");
    fpList += F("<input type='hidden' name='session_token' value='"); fpList += currentSessionToken; fpList += F("'>");
    fpList += F("<input type='hidden' name='delete_id' value='"); fpList += id; fpList += F("'>");
    fpList += F("<button type='submit' class='btn btn-danger' style='padding:5px 10px;font-size:12px' onclick='return confirm(\"Delete fingerprint ID "); fpList += id; fpList += F("?\")'>Delete</button></form></div>");
  }
  fpList += F("</div>");
  fpList += F("<div class='status status-info'>Showing "); fpList += (startIdx+1); fpList += F("-"); fpList += endIdx; fpList += F(" of "); fpList += fingerprintCount; fpList += F(" (Page "); fpList += page; fpList += F(" of "); fpList += totalPages; fpList += F(")</div>");

  if (totalPages > 1) {
    fpList += F("<div class='pagination'>");
    if (page > 1) { fpList += F("<a href='/?session="); fpList += currentSessionToken; fpList += F("&fp_page="); fpList += (page-1); fpList += F("' class='btn'>‹ Previous</a>"); }
    if (page < totalPages) { fpList += F("<a href='/?session="); fpList += currentSessionToken; fpList += F("&fp_page="); fpList += (page+1); fpList += F("' class='btn'>Next ›</a>"); }
    fpList += F("</div>");
  }
  return fpList;
}

String generateOptimizedDashboard() {
  String html = HTML_HEAD + CSS_OPTIMIZED;
  html += "<body><div class='container'>";

  // Header
  html += "<div class='card'><div class='logo'>IT Signature</div>";
  html += "<div style='text-align:center;color:#666'>Fingerprint Attendance System</div>";
  html += "<div style='text-align:center;margin-top:10px'>";
  html += "<button onclick='location.reload()' class='btn btn-success'>Refresh</button>";
  html += "<form method='POST' action='/logout' style='display:inline'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-danger'>Logout</button></form>";
  html += "</div></div>";

  // Current Mode
  html += "<div class='card'><h4>Current Mode</h4><div class='status ";
  switch(currentMode) {
    case MODE_ATTENDANCE: html += "status-success'>Attendance Scanning"; break;
    case MODE_ENROLL:     html += "status-warning'>Enrollment Mode (ID: " + String(enrollID) + ")"; break;
    case MODE_DELETE:     html += "status-error'>Delete Mode"; break;
  }
  html += "</div>";
  if (currentMode != MODE_ATTENDANCE) {
    html += "<form method='POST' action='/set-attendance-mode'>";
    html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
    html += "<button type='submit' class='btn btn-success'>Return to Attendance Mode</button></form>";
  }
  html += "</div>";

  // Device ID
  html += "<div class='card'><h4>Device Identity</h4>";
  html += "<div class='status status-info'>Device ID: <strong>" + (DEVICE_ID.length() > 0 ? DEVICE_ID : "NOT SET") + "</strong></div>";
  html += "<div class='status status-info'>MQTT: <strong>" + String(mqttClient.connected() ? "Connected" : "Disconnected") + "</strong></div>";
  html += "<form method='POST' action='/update-deviceid'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<div class='form-group'><label>Device ID (e.g. DEV001):</label>";
  html += "<input type='text' name='device_id' value='" + DEVICE_ID + "' required placeholder='DEV001' maxlength='47'></div>";
  html += "<button type='submit' class='btn btn-success'>Save Device ID</button>";
  html += "</form></div>";

  // BASE_URL Config
  html += "<div class='card'><h4>Server Configuration</h4>";
  html += "<div class='status status-info' style='word-break:break-all;'>Current URL: " + BASE_URL + "</div>";
  html += "<form method='POST' action='/update-baseurl'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<div class='form-group'><label>BASE URL:</label>";
  html += "<input type='text' name='baseurl' value='" + BASE_URL + "' required style='word-break:break-all;'></div>";
  html += "<div class='grid'>";
  html += "<button type='submit' class='btn btn-success'>Update BASE URL</button></form>";
  html += "<form method='POST' action='/clear-baseurl'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-danger' onclick='return confirm(\"Reset BASE URL to default?\")'>Reset to Default</button></form>";
  html += "</div></div>";

  // AS608 Sensor Status
  html += "<div class='card'><h4>AS608 Sensor Status</h4><div class='grid'>";
  if (fingerprintSensorOK) {
    finger.getParameters(); finger.getTemplateCount();
    html += "<div class='status status-success'>Sensor: Connected</div>";
    html += "<div class='status status-info'>Capacity: " + String(finger.capacity) + "</div>";
    html += "<div class='status status-info'>Templates: " + String(finger.templateCount) + "</div>";
    html += "<div class='status status-info'>Security Level: " + String(finger.security_level) + "</div>";
  } else {
    html += "<div class='status status-error'>Sensor: Disconnected</div>";
    html += "<div class='status status-error'>Check wiring and restart</div>";
  }
  html += "</div></div>";

  // Device Status
  html += "<div class='card'><h4>Device Status</h4><div class='grid'>";
  html += "<div class='status status-success'>AP: Active</div>";
  html += "<div class='status status-info'>AP IP: " + WiFi.softAPIP().toString() + "</div>";
  html += "<div class='status status-info'>Uptime: " + String(millis()/60000) + "m</div>";
  html += "<div class='status status-info'>Free Heap: " + String(ESP.getFreeHeap()) + "B</div>";
  html += "</div></div>";

  // WiFi Status
  html += "<div class='card'><h4>WiFi Status</h4>";
  if (stationConnected) {
    int rssi = WiFi.RSSI();
    String rssiLabel = rssi >= -50 ? "Excellent" : rssi >= -60 ? "Good" : rssi >= -70 ? "Fair" : "Weak";
    html += "<div class='status status-success'>Connected: " + stationSSID + "</div>";
    html += "<div class='status status-info'>IP: " + WiFi.localIP().toString() + "</div>";
    html += "<div class='status status-info'>Signal: " + String(rssi) + " dBm (" + rssiLabel + ")</div>";
  } else {
    html += "<div class='status status-error'>Disconnected</div>";
    if (lastError.length() > 0) html += "<div class='status status-error'>Error: " + lastError + "</div>";
  }
  html += "</div>";

  // Fingerprint Management
  if (fingerprintSensorOK) {
    html += "<div class='card'><h4>Fingerprint Management</h4><div class='grid'>";
    html += "<form method='POST' action='/start-enroll'>";
    html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
    html += "<input type='number' name='enroll_id' placeholder='Enter ID (1-127)' min='1' max='127' required style='margin-bottom:5px'>";
    html += "<button type='submit' class='btn btn-success'>Start Enrollment</button></form>";
    html += "<form method='POST' action='/clear-all-fingerprints'>";
    html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
    html += "<button type='submit' class='btn btn-danger' onclick='return confirm(\"Delete ALL fingerprints?\")'>Clear All</button></form>";
    html += "</div></div>";

    html += "<div class='card'><h4>Stored Fingerprints</h4>";
    int currentPage = 1;
    String pageParam = server.arg("fp_page");
    if (pageParam.length() > 0) { currentPage = pageParam.toInt(); if (currentPage < 1) currentPage = 1; }
    html += getStoredFingerprintsWithPagination(currentPage);
    html += "</div>";
  }

  // WiFi Config
  html += "<div class='card'><h4>WiFi Configuration</h4>";
  html += "<form method='POST' action='/update-wifi'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<div class='form-group'><label>SSID:</label><input type='text' name='ssid' value='" + stationSSID + "' required></div>";
  html += "<div class='form-group'><label>Password:</label><input type='password' name='password' required></div>";
  html += "<button type='submit' class='btn'>Update WiFi</button></form></div>";

  // Quick Actions
  html += "<div class='card'><h4>Quick Actions</h4><div class='grid'>";
  html += "<form method='POST' action='/reconnect-wifi'><input type='hidden' name='session_token' value='" + currentSessionToken + "'><button type='submit' class='btn btn-success'>Reconnect WiFi</button></form>";
  html += "<form method='POST' action='/clear-settings'><input type='hidden' name='session_token' value='" + currentSessionToken + "'><button type='submit' class='btn btn-danger' onclick='return confirm(\"Clear settings?\")'>Clear Settings</button></form>";
  html += "<form method='POST' action='/reboot'><input type='hidden' name='session_token' value='" + currentSessionToken + "'><button type='submit' class='btn btn-warning' onclick='return confirm(\"Reboot device?\")'>Reboot</button></form>";
  html += "</div></div>";

  html += "</div></body></html>";
  return html;
}

// =============================================
// LOCAL DASHBOARD ROUTE HANDLERS
// =============================================
void handleSetAttendanceMode() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  currentMode = MODE_ATTENDANCE; displayWelcome();
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleStartEnroll() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  int id = server.arg("enroll_id").toInt();
  if (id < 1 || id > 127) { server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", ""); return; }
  enrollID = id; currentMode = MODE_ENROLL;
  lcd.clear(); lcd.setCursor(0,0); lcd.print("Enroll Mode"); lcd.setCursor(0,1); lcd.print("ID: " + String(enrollID));
  activateBacklight();
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleDeleteFingerprint() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  int id = server.arg("delete_id").toInt();
  if (id >= 1 && id <= 127 && fingerprintSensorOK) {
    uint8_t p = finger.deleteModel(id);
    lcd.clear(); lcd.setCursor(0,0);
    if (p == FINGERPRINT_OK) { lcd.print("Deleted ID:" + String(id)); buzzerSound(); }
    else lcd.print("Delete Failed");
    activateBacklight(); delay(2000); displayWelcome();
  }
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleClearAllFingerprints() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  if (fingerprintSensorOK) { finger.emptyDatabase(); lcd.clear(); lcd.setCursor(0,0); lcd.print("All Deleted"); activateBacklight(); delay(2000); displayWelcome(); }
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleUpdateBaseURL() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  String newUrl = server.arg("baseurl");
  if (newUrl.length() == 0 || (!newUrl.startsWith("http://") && !newUrl.startsWith("https://"))) {
    lastError = "Invalid URL"; server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", ""); return;
  }
  saveBaseURLToEEPROM(newUrl); BASE_URL = newUrl;
  lcd.clear(); lcd.setCursor(0,0); lcd.print("URL Updated!"); activateBacklight();
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleClearBaseURL() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  BASE_URL = "https://attendance.itsignaturesolutions.com/api/api/attendance/fingerprint?client_id=&fingerprint_id=";
  clearBaseURLFromEEPROM();
  lcd.clear(); lcd.setCursor(0,0); lcd.print("URL Reset!"); lcd.setCursor(0,1); lcd.print("To Default"); activateBacklight();
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleUpdateDeviceID() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  String newId = server.arg("device_id");
  newId.trim();
  if (newId.length() == 0) { server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", ""); return; }
  saveDeviceIDToEEPROM(newId);
  DEVICE_ID = newId;
  buildMqttTopics();
  lcd.clear(); lcd.setCursor(0,0); lcd.print("Device ID Set:"); lcd.setCursor(0,1); lcd.print(DEVICE_ID); activateBacklight();
  // Reconnect MQTT with new ID
  mqttClient.disconnect();
  lastMqttReconnect = 0;
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void testWiFiConnection(String newSSID, String newPassword) {
  WiFi.begin(newSSID.c_str(), newPassword.c_str());
  unsigned long startTime = millis();
  bool connected = false;
  while (millis() - startTime < 10000) {
    if (WiFi.status() == WL_CONNECTED) { connected = true; break; }
    delay(100); yield(); server.handleClient();
  }
  if (connected) {
    saveWiFiToEEPROM(newSSID, newPassword);
    stationSSID = newSSID; stationPassword = newPassword; stationConnected = true; lastError = "";
    lcd.clear(); lcd.setCursor(0,0); lcd.print("WiFi Updated!"); lcd.setCursor(0,1); lcd.print(WiFi.localIP().toString()); activateBacklight();
  } else {
    stationConnected = false;
    if (WiFi.status() == WL_CONNECT_FAILED)       lastError = "Wrong password";
    else if (WiFi.status() == WL_NO_SSID_AVAIL)   lastError = "SSID not found";
    else                                           lastError = "Connection timeout";
    lcd.clear(); lcd.setCursor(0,0); lcd.print("Update Failed"); lcd.setCursor(0,1); lcd.print(lastError); activateBacklight();
  }
}

void handleUpdateWiFi() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  String newSSID = server.arg("ssid");
  String newPass = server.arg("password");
  if (newSSID.length() == 0) { lastError = "SSID empty"; server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", ""); return; }
  String updatePage = HTML_HEAD + CSS_OPTIMIZED;
  updatePage += "<body><div class='container'><div class='card'><div class='logo'>IT Signature</div>";
  updatePage += "<h3 style='text-align:center'>Updating WiFi...</h3>";
  updatePage += "<div style='text-align:center;font-size:48px;margin:20px 0' class='spinner'>⚙️</div>";
  updatePage += "<div class='status status-info'>Connecting to: " + newSSID + "</div>";
  updatePage += "<div class='status status-info'>Please wait up to 15 seconds...</div>";
  updatePage += "</div></div>";
  updatePage += "<script>setTimeout(function(){location.href='/?session=" + currentSessionToken + "';},12000);</script>";
  updatePage += "</body></html>";
  server.send(200, "text/html", updatePage);
  delay(500);
  testWiFiConnection(newSSID, newPass);
}

void handleReconnectWiFi() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  attemptStationConnection();
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleClearSettings() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  clearEEPROM();
  stationSSID = ""; stationPassword = ""; stationConnected = false; lastError = "";
  BASE_URL = "https://attendance.itsignaturesolutions.com/api/api/attendance/fingerprint?client_id=&fingerprint_id=";
  lcd.clear(); lcd.setCursor(0,0); lcd.print("Settings Cleared"); activateBacklight();
  server.sendHeader("Location", "/?session=" + currentSessionToken); server.send(302, "text/plain", "");
}

void handleReboot() {
  if (!isAuthenticated()) { server.sendHeader("Location", "/login"); server.send(302, "text/plain", ""); return; }
  String rebootPage = HTML_HEAD + CSS_OPTIMIZED;
  rebootPage += "<body><div class='container'><div class='card'><div class='logo'>IT Signature</div><h3 style='text-align:center'>Rebooting...</h3><div style='text-align:center;font-size:48px;margin:20px 0' class='spinner'>⚙️</div></div></div>";
  rebootPage += "<script>setTimeout(function(){location.href='/login';},15000);</script></body></html>";
  server.send(200, "text/html", rebootPage);
  delay(500); ESP.restart();
}

// =============================================
// WIFI SETUP
// =============================================
void setupWiFi() {
  WiFi.softAP(AP_SSID.c_str(), AP_PASSWORD.c_str(), 6, false, 4);
  lcd.clear(); lcd.setCursor(0,0); lcd.print("AP: IT-Signature"); lcd.setCursor(0,1); lcd.print(WiFi.softAPIP().toString());
  delay(1000);
  attemptStationConnection();
}

void attemptStationConnection() {
  if (loadWiFiFromEEPROM(stationSSID, stationPassword)) {
    WiFi.begin(stationSSID.c_str(), stationPassword.c_str());
    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
      delay(100); yield(); server.handleClient();
    }
    if (WiFi.status() == WL_CONNECTED) {
      stationConnected = true; lastError = "";
      lcd.clear(); lcd.setCursor(0,0); lcd.print("WiFi Connected"); lcd.setCursor(0,1); lcd.print(WiFi.localIP().toString());
    } else {
      stationConnected = false;
      if (WiFi.status() == WL_CONNECT_FAILED)      lastError = "Wrong password";
      else if (WiFi.status() == WL_NO_SSID_AVAIL)  lastError = "SSID not found";
      else                                          lastError = "Connection failed";
      lcd.clear(); lcd.setCursor(0,0); lcd.print("WiFi Failed"); lcd.setCursor(0,1); lcd.print("Use AP");
    }
  } else {
    lcd.clear(); lcd.setCursor(0,0); lcd.print("No WiFi Config"); lcd.setCursor(0,1); lcd.print("Use AP");
  }
  activateBacklight();
}

// =============================================
// SETUP
// =============================================
void setup() {
  Wire.begin(D3, D4);
  lcd.begin(16, 2);
  lcd.noBacklight();
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.begin(115200);
  Serial.println("\nIT Signature Fingerprint System Starting...");

  mySerial.begin(57600);
  delay(100);

  lcd.clear(); lcd.setCursor(0,0); lcd.print("Init Fingerprint"); activateBacklight();

  if (finger.verifyPassword()) {
    fingerprintSensorOK = true;
    finger.getParameters(); finger.getTemplateCount();
    lcd.clear(); lcd.setCursor(0,0); lcd.print("FP Sensor OK"); lcd.setCursor(0,1); lcd.print("Templates: " + String(finger.templateCount));
    delay(2000);
  } else {
    fingerprintSensorOK = false;
    lcd.clear(); lcd.setCursor(0,0); lcd.print("FP Sensor ERROR"); lcd.setCursor(0,1); lcd.print("Check Wiring");
    delay(3000);
  }

  setupEEPROM();

  String savedBaseURL;
  if (loadBaseURLFromEEPROM(savedBaseURL)) BASE_URL = savedBaseURL;

  String savedDevID;
  if (loadDeviceIDFromEEPROM(savedDevID)) {
    DEVICE_ID = savedDevID;
    Serial.println("Device ID: " + DEVICE_ID);
  } else {
    Serial.println("WARNING: Device ID not set. Set it via 192.168.4.1 dashboard.");
  }

  buildMqttTopics();
  randomSeed(analogRead(0));
  setupWiFi();

  // Web server routes
  server.on("/", handleRoot);
  server.on("/login", handleLogin);
  server.on("/logout", handleLogout);
  server.on("/update-wifi", handleUpdateWiFi);
  server.on("/reconnect-wifi", handleReconnectWiFi);
  server.on("/clear-settings", handleClearSettings);
  server.on("/reboot", handleReboot);
  server.on("/set-attendance-mode", handleSetAttendanceMode);
  server.on("/start-enroll", handleStartEnroll);
  server.on("/delete-fingerprint", handleDeleteFingerprint);
  server.on("/clear-all-fingerprints", handleClearAllFingerprints);
  server.on("/update-baseurl", handleUpdateBaseURL);
  server.on("/clear-baseurl", handleClearBaseURL);
  server.on("/update-deviceid", handleUpdateDeviceID);
  server.begin();

  // MQTT broker setup
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  client.setInsecure();
  client.setTimeout(15);
  client.setBufferSizes(2048, 512);

  displayWelcome();
  activateBacklight();
}

// =============================================
// LOOP
// =============================================
void loop() {
  server.handleClient();

  // MQTT loop
  if (stationConnected) {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    } else {
      mqttClient.loop();
      // Publish heartbeat every 30s
      if (millis() - lastStatusPublish > STATUS_PUBLISH_INTERVAL) {
        lastStatusPublish = millis();
        publishStatus();
      }
    }
  }

  // Station WiFi watchdog
  if (millis() - lastStationCheck > STATION_CHECK_INTERVAL) {
    lastStationCheck = millis();
    if (stationSSID.length() > 0) {
      bool wasConnected = stationConnected;
      stationConnected = (WiFi.status() == WL_CONNECTED);
      if (!stationConnected && wasConnected) attemptStationConnection();
    }
  }

  handleBacklight();

  if (fingerprintSensorOK && millis() - lastScanTime > SCAN_DEBOUNCE) {
    if (currentMode == MODE_ATTENDANCE)   handleAttendanceMode();
    else if (currentMode == MODE_ENROLL)  handleEnrollMode();
  }

  delay(50);
}

// =============================================
// ATTENDANCE / ENROLL LOGIC (unchanged)
// =============================================
void handleAttendanceMode() {
  uint8_t fingerprintID = getFingerprintID();
  if (fingerprintID != 255) {
    lastScanTime = millis();
    activateBacklight();
    lcd.clear(); lcd.setCursor(0,0); lcd.print("Processing...");
    if (stationConnected) sendOptimizedRequest(String(fingerprintID));
    else { lcd.clear(); lcd.setCursor(0,0); lcd.print("No Internet"); lcd.setCursor(0,1); lcd.print("ID: " + String(fingerprintID)); }
    delay(2000); displayWelcome();
  }
}

void handleEnrollMode() {
  static int enrollStep = 0;
  static unsigned long enrollStepTime = 0;
  if (millis() - enrollStepTime < 500) return;

  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_OK) {
    enrollStepTime = millis(); activateBacklight();
    if (enrollStep == 0) {
      p = finger.image2Tz(1);
      if (p == FINGERPRINT_OK) { enrollStep = 1; lcd.clear(); lcd.setCursor(0,0); lcd.print("Remove finger"); lcd.setCursor(0,1); lcd.print("Place again"); buzzerSound(); }
      else { lcd.clear(); lcd.setCursor(0,0); lcd.print("Image error"); delay(1000); lcd.clear(); lcd.setCursor(0,0); lcd.print("Enroll Mode"); lcd.setCursor(0,1); lcd.print("ID: " + String(enrollID)); }
    } else if (enrollStep == 1) {
      return;
    } else if (enrollStep == 2) {
      p = finger.image2Tz(2);
      if (p == FINGERPRINT_OK) {
        p = finger.createModel();
        if (p == FINGERPRINT_OK) {
          p = finger.storeModel(enrollID);
          if (p == FINGERPRINT_OK) {
            lcd.clear(); lcd.setCursor(0,0); lcd.print("Enrolled!"); lcd.setCursor(0,1); lcd.print("ID: " + String(enrollID));
            buzzerSound(); delay(2000);
            // Notify dashboard via MQTT
            publishResult(true, "Enrolled fingerprint ID " + String(enrollID), "attendance");
            currentMode = MODE_ATTENDANCE; displayWelcome(); enrollStep = 0;
          } else { lcd.clear(); lcd.setCursor(0,0); lcd.print("Store error"); delay(1000); enrollStep = 0; }
        } else { lcd.clear(); lcd.setCursor(0,0); lcd.print("No match"); delay(1000); enrollStep = 0; }
      } else { lcd.clear(); lcd.setCursor(0,0); lcd.print("Image error"); delay(1000); enrollStep = 0; }
    }
  } else if (p == FINGERPRINT_NOFINGER && enrollStep == 1) {
    enrollStep = 2; lcd.clear(); lcd.setCursor(0,0); lcd.print("Place same"); lcd.setCursor(0,1); lcd.print("finger again");
  }
}

uint8_t getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return 255;
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return 255;
  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK) {
    if (p == FINGERPRINT_NOTFOUND) { lcd.clear(); lcd.setCursor(0,0); lcd.print("Not Registered"); activateBacklight(); delay(2000); displayWelcome(); }
    return 255;
  }
  return finger.fingerID;
}

void displayWelcome() {
  lcd.clear();
  if (currentMode == MODE_ATTENDANCE) { lcd.setCursor(0,0); lcd.print("Place Finger"); lcd.setCursor(0,1); lcd.print("IT Signature"); }
  else if (currentMode == MODE_ENROLL) { lcd.setCursor(0,0); lcd.print("Enroll Mode"); lcd.setCursor(0,1); lcd.print("ID: " + String(enrollID)); }
}

void handleBacklight() {
  if (backlightActive && (millis() - backlightOnTime > BACKLIGHT_DURATION)) { lcd.noBacklight(); backlightActive = false; }
}

void activateBacklight() {
  if (!backlightActive) { lcd.backlight(); backlightActive = true; }
  backlightOnTime = millis();
}

void sendOptimizedRequest(String fingerprintID) {
  if (!stationConnected) { displayError("No WiFi"); return; }

  String fullUrl = BASE_URL + fingerprintID;
  Serial.println("Sending request to: " + fullUrl);

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  secureClient.setTimeout(15);
  secureClient.setBufferSizes(2048, 512);

  HTTPClient httpClient;
  httpClient.begin(secureClient, fullUrl);
  httpClient.setTimeout(10000);
  httpClient.addHeader("Connection", "close");
  httpClient.addHeader("User-Agent", "ESP8266");
  httpClient.setReuse(false);

  int httpCode = httpClient.GET();

  if (httpCode == HTTP_CODE_OK) {
    WiFiClient* stream = httpClient.getStreamPtr();
    String payload = "";
    payload.reserve(256);
    unsigned long timeout = millis();
    while (httpClient.connected() || stream->available()) {
      if (stream->available()) { char c = stream->read(); payload += c; timeout = millis(); if (payload.length() > 512) break; }
      else { if (millis() - timeout > 2000) break; delay(1); }
    }
    httpClient.end();
    processResponse(payload);
  } else if (httpCode > 0) {
    httpClient.end(); displayError("HTTP " + String(httpCode));
  } else {
    httpClient.end(); displayError("Req Failed");
  }
}

void processResponse(String payload) {
  jsonDoc.clear();
  DeserializationError error = deserializeJson(jsonDoc, payload);
  if (!error) {
    String message = jsonDoc["message"].as<String>();
    lcd.clear(); lcd.setCursor(0,0);
    if (message.length() > 16) { lcd.print(message.substring(0,16)); lcd.setCursor(0,1); lcd.print(message.substring(16, message.length() > 32 ? 32 : message.length())); }
    else lcd.print(message);
    if (message != "Fingerprint not registered") buzzerSound();
  } else {
    displayError("JSON Error");
  }
}

void displayError(String error) {
  lcd.clear(); lcd.setCursor(0,0); lcd.print("Error:"); lcd.setCursor(0,1); lcd.print(error); activateBacklight();
}

void buzzerSound() {
  digitalWrite(BUZZER_PIN, HIGH); delay(300); digitalWrite(BUZZER_PIN, LOW);
}
