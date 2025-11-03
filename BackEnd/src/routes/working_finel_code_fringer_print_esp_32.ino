#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>

// AS608 Fingerprint Scanner using Hardware Serial for ESP32
#define FP_SERIAL Serial2  // Use Hardware Serial2 on ESP32
#define FP_BAUDRATE 57600

// LCD Display pins for ESP32
#define LED_SDA_PIN 21   // LCD SDA_PIN 
#define LED_SCL_PIN 22   // LCD SCL_PIN

// Buzzer pin for ESP32
#define BUZZER_PIN 2     // BUZZER (+) PIN

// AS608 pins for ESP32 (Hardware Serial2)
// TX2 (GPIO 17) -> AS608 RX (Yellow)
// RX2 (GPIO 16) -> AS608 TX (White)
// VCC -> 3.3V (Red)
// GND -> GND (Black)

Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FP_SERIAL);
LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure client;
HTTPClient http;
WebServer server(80);

// EEPROM - Increased size for ESP32
#define EEPROM_SIZE 1024
#define WIFI_START_ADDR 0
#define BASEURL_START_ADDR 400

String stationSSID = "";
String stationPassword = "";
String lastError = "";
String lastConnectionLog = "";
String BASE_URL = "https://attendance2.itsignaturesolutions.com/test_http.php?uid=";

const String AP_SSID = "IT-Signature-Setup";
const String AP_PASSWORD = "admin123";

// Authentication
const String ADMIN_USERNAME = "admin";
const String ADMIN_PASSWORD = "admin123";
String currentSessionToken = "";
unsigned long sessionStartTime = 0;
const unsigned long SESSION_TIMEOUT = 3600000; // 1 hour

// Fingerprint scanning variables
unsigned long lastScanTime = 0;
unsigned long backlightOnTime = 0;
unsigned long lastStationCheck = 0;
const unsigned long SCAN_DEBOUNCE = 1000;
const unsigned long BACKLIGHT_DURATION = 5000;
const unsigned long STATION_CHECK_INTERVAL = 30000;
bool backlightActive = false;
bool stationConnected = false;
bool fingerprintSensorOK = false;

// Operation modes
enum OperationMode {
  MODE_ATTENDANCE,
  MODE_ENROLL,
  MODE_DELETE
};
OperationMode currentMode = MODE_ATTENDANCE;
int enrollID = 0;
int deleteID = 0;

// Pre-allocated JSON document - increased for ESP32
StaticJsonDocument<512> jsonDoc;

// HTML template parts
const String HTML_HEAD = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>IT Signature</title></head>";
const String CSS_OPTIMIZED = "<style>body{font-family:Arial;background:linear-gradient(135deg,#1E9ADA,#6BC7F0);margin:0;padding:20px;min-height:100vh;box-sizing:border-box}.container{max-width:900px;margin:0 auto}.card{background:#fff;padding:20px;border-radius:10px;box-shadow:0 5px 15px rgba(0,0,0,0.1);margin-bottom:15px}.logo{font-size:28px;color:#1E9ADA;font-weight:bold;text-align:center;margin-bottom:10px}.btn{background:#1E9ADA;color:#fff;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-size:14px;margin:5px}.btn:hover{background:#0A7CB8}.btn-danger{background:#f44336}.btn-success{background:#4CAF50}.btn-warning{background:#FF9800}.form-group{margin-bottom:15px}.form-group label{display:block;margin-bottom:5px;font-weight:500}.form-group input{width:100%;padding:8px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;word-break:break-all}.status{padding:8px;border-radius:5px;margin:5px 0;word-wrap:break-word;overflow-wrap:break-word}.status-success{background:#e8f5e8;color:#4CAF50}.status-error{background:#ffe8e8;color:#f44336}.status-info{background:#f8f9fa;color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px}.fingerprint-list{max-height:300px;overflow-y:auto;border:1px solid #ddd;padding:10px;border-radius:5px}.fp-item{padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}.fp-item:last-child{border-bottom:none}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.spinner{animation:spin 2s linear infinite}</style>";

void setupEEPROM() {
  EEPROM.begin(EEPROM_SIZE);
}

void clearEEPROM() {
  for (int i = 0; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
  EEPROM.commit();
}

void saveWiFiToEEPROM(const String& ssid, const String& pass) {
  // Clear WiFi section only
  for (int i = WIFI_START_ADDR; i < BASEURL_START_ADDR; i++) EEPROM.write(i, 0);
  
  // Save WiFi credentials
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
  // Clear BASE_URL section
  for (int i = BASEURL_START_ADDR; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
  
  // Save BASE_URL
  for (int i = 0; i < baseurl.length() && i < (EEPROM_SIZE - BASEURL_START_ADDR - 1); ++i) {
    EEPROM.write(BASEURL_START_ADDR + i, baseurl[i]);
  }
  EEPROM.commit();
}

bool loadBaseURLFromEEPROM(String& baseurl) {
  String content = "";
  content.reserve(EEPROM_SIZE - BASEURL_START_ADDR);
  
  for (int i = BASEURL_START_ADDR; i < EEPROM_SIZE; i++) {
    char c = EEPROM.read(i);
    if (c == 0) break;
    content += c;
  }
  
  if (content.length() > 10) { // Basic validation
    baseurl = content;
    return true;
  }
  return false;
}

void clearBaseURLFromEEPROM() {
  for (int i = BASEURL_START_ADDR; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
  EEPROM.commit();
}

String generateSessionToken() {
  String token = "";
  token.reserve(32);
  for (int i = 0; i < 32; i++) {
    token += String(random(16), HEX);
  }
  return token;
}

bool isAuthenticated() {
  if (currentSessionToken.length() == 0) return false;
  if (millis() - sessionStartTime > SESSION_TIMEOUT) {
    currentSessionToken = "";
    return false;
  }
  
  String urlSession = server.arg("session");
  if (urlSession.length() > 0 && urlSession == currentSessionToken) {
    sessionStartTime = millis();
    return true;
  }
  
  String postSession = server.arg("session_token");
  if (postSession.length() > 0 && postSession == currentSessionToken) {
    sessionStartTime = millis();
    return true;
  }
  
  return false;
}

void handleRoot() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  String page = generateOptimizedDashboard();
  server.send(200, "text/html", page);
}

String generateLoginHTML(String errorMsg = "") {
  String html = "";
  html.reserve(2500); // Increased for ESP32
  
  html = HTML_HEAD + CSS_OPTIMIZED;
  html += "<body><div class='container'><div class='card'>";
  html += "<div class='logo'>IT Signature</div>";
  html += "<h3 style='text-align:center;margin:0 0 20px 0'>Admin Login</h3>";
  
  if (errorMsg.length() > 0) {
    html += "<div class='status status-error'>" + errorMsg + "</div>";
  }
  
  html += "<form method='POST' action='/login'>";
  html += "<div class='form-group'><label>Username:</label>";
  html += "<input type='text' name='username' required autofocus></div>";
  html += "<div class='form-group'><label>Password:</label>";
  html += "<input type='password' name='password' required></div>";
  html += "<button type='submit' class='btn' style='width:100%'>Login</button>";
  html += "</form></div></div></body></html>";
  
  return html;
}

void handleLogin() {
  if (server.method() == HTTP_POST) {
    String username = server.arg("username");
    String password = server.arg("password");
    
    if (username == ADMIN_USERNAME && password == ADMIN_PASSWORD) {
      currentSessionToken = generateSessionToken();
      sessionStartTime = millis();
      
      String redirectUrl = "/?session=" + currentSessionToken;
      server.sendHeader("Location", redirectUrl);
      server.send(302, "text/plain", "");
      return;
    } else {
      String loginPage = generateLoginHTML("Invalid credentials!");
      server.send(200, "text/html", loginPage);
      return;
    }
  }
  
  String loginPage = generateLoginHTML("");
  server.send(200, "text/html", loginPage);
}

void handleLogout() {
  currentSessionToken = "";
  sessionStartTime = 0;
  currentMode = MODE_ATTENDANCE;
  server.sendHeader("Location", "/login");
  server.send(302, "text/plain", "");
}

String getStoredFingerprints() {
  String fpList = "";
  int count = 0;
  
  if (!fingerprintSensorOK) {
    return "<div class='status status-error'>Sensor not available</div>";
  }
  
  finger.getTemplateCount();
  
  if (finger.templateCount == 0) {
    return "<div class='status status-info'>No fingerprints stored</div>";
  }
  
  fpList += "<div class='fingerprint-list'>";
  
  for (int id = 1; id <= 127; id++) {
    if (finger.loadModel(id) == FINGERPRINT_OK) {
      count++;
      fpList += "<div class='fp-item'>";
      fpList += "<span>ID: " + String(id) + "</span>";
      fpList += "<form method='POST' action='/delete-fingerprint' style='margin:0'>";
      fpList += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
      fpList += "<input type='hidden' name='delete_id' value='" + String(id) + "'>";
      fpList += "<button type='submit' class='btn btn-danger' style='padding:5px 10px;font-size:12px' onclick='return confirm(\"Delete fingerprint ID " + String(id) + "?\")'>Delete</button>";
      fpList += "</form></div>";
    }
    delay(10);
    yield(); // Allow other tasks to run
  }
  
  fpList += "</div>";
  fpList += "<div class='status status-info'>Total: " + String(count) + " fingerprints</div>";
  
  return fpList;
}

String generateOptimizedDashboard() {
  String html = "";
  html.reserve(6000); // Increased for ESP32
  
  html = HTML_HEAD + CSS_OPTIMIZED;
  html += "<body><div class='container'>";
  
  // Header
  html += "<div class='card'><div class='logo'>IT Signature</div>";
  html += "<div style='text-align:center;color:#666'>Fingerprint Attendance System - ESP32</div>";
  html += "<div style='text-align:center;margin-top:10px'>";
  html += "<button onclick='location.reload()' class='btn btn-success'>Refresh</button>";
  html += "<form method='POST' action='/logout' style='display:inline'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-danger'>Logout</button></form>";
  html += "</div></div>";
  
  // Current Mode Status
  html += "<div class='card'><h4>Current Mode</h4>";
  html += "<div class='status ";
  switch(currentMode) {
    case MODE_ATTENDANCE:
      html += "status-success'>Attendance Scanning";
      break;
    case MODE_ENROLL:
      html += "status-warning'>Enrollment Mode (ID: " + String(enrollID) + ")";
      break;
    case MODE_DELETE:
      html += "status-error'>Delete Mode";
      break;
  }
  html += "</div>";
  
  if (currentMode != MODE_ATTENDANCE) {
    html += "<form method='POST' action='/set-attendance-mode'>";
    html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
    html += "<button type='submit' class='btn btn-success'>Return to Attendance Mode</button>";
    html += "</form>";
  }
  html += "</div>";
  
  // BASE_URL Configuration Section
  html += "<div class='card'><h4>Server Configuration</h4>";
  html += "<div class='status status-info' style='word-break:break-all;'>Current URL: " + BASE_URL + "</div>";
  html += "<form method='POST' action='/update-baseurl'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<div class='form-group'><label>BASE URL:</label>";
  html += "<input type='text' name='baseurl' value='" + BASE_URL + "' required placeholder='https://your-server.com/api/endpoint.php?uid=' style='word-break:break-all;'></div>";
  html += "<div class='grid'>";
  html += "<button type='submit' class='btn btn-success'>Update BASE URL</button>";
  html += "</form>";
  html += "<form method='POST' action='/clear-baseurl'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-danger' onclick='return confirm(\"Reset BASE URL to default?\")'>Reset to Default</button>";
  html += "</form>";
  html += "</div></div>";
  
  // AS608 Sensor Status
  html += "<div class='card'><h4>AS608 Sensor Status</h4><div class='grid'>";
  if (fingerprintSensorOK) {
    html += "<div class='status status-success'>Sensor: Connected</div>";
    finger.getParameters();
    finger.getTemplateCount();
    html += "<div class='status status-info'>Capacity: " + String(finger.capacity) + "</div>";
    html += "<div class='status status-info'>Templates: " + String(finger.templateCount) + "</div>";
    html += "<div class='status status-info'>Security Level: " + String(finger.security_level) + "</div>";
    html += "<div class='status status-info'>Data Packet: " + String(finger.packet_len) + "</div>";
  } else {
    html += "<div class='status status-error'>Sensor: Disconnected</div>";
    html += "<div class='status status-error'>Check wiring and restart</div>";
  }
  html += "</div></div>";
  
  // Device Status
  html += "<div class='card'><h4>Device Status</h4><div class='grid'>";
  html += "<div class='status status-success'>AP: Active</div>";
  html += "<div class='status status-info'>IP: " + WiFi.softAPIP().toString() + "</div>";
  html += "<div class='status status-info'>Chip: ESP32</div>";
  html += "<div class='status status-info'>Uptime: " + String(millis()/60000) + "m</div>";
  html += "<div class='status status-info'>Free Heap: " + String(ESP.getFreeHeap()) + "B</div>";
  html += "<div class='status status-info'>CPU Freq: " + String(ESP.getCpuFreqMHz()) + "MHz</div>";
  html += "</div></div>";
  
  // WiFi Status
  html += "<div class='card'><h4>WiFi Status</h4>";
  if (stationConnected) {
    html += "<div class='status status-success'>Connected: " + stationSSID + "</div>";
    html += "<div class='status status-info'>IP: " + WiFi.localIP().toString() + "</div>";
    html += "<div class='status status-info'>Signal: " + String(WiFi.RSSI()) + " dBm</div>";
  } else {
    html += "<div class='status status-error'>Disconnected</div>";
    if (lastError.length() > 0) {
      html += "<div class='status status-error'>Error: " + lastError + "</div>";
    }
  }
  html += "</div>";
  
  // Fingerprint Management
  if (fingerprintSensorOK) {
    html += "<div class='card'><h4>Fingerprint Management</h4>";
    html += "<div class='grid'>";
    html += "<form method='POST' action='/start-enroll'>";
    html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
    html += "<input type='number' name='enroll_id' placeholder='Enter ID (1-127)' min='1' max='127' required style='margin-bottom:5px'>";
    html += "<button type='submit' class='btn btn-success'>Start Enrollment</button>";
    html += "</form>";
    
    html += "<form method='POST' action='/clear-all-fingerprints'>";
    html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
    html += "<button type='submit' class='btn btn-danger' onclick='return confirm(\"Delete ALL fingerprints?\")'>Clear All</button>";
    html += "</form>";
    html += "</div></div>";
    
    // Stored Fingerprints List
    html += "<div class='card'><h4>Stored Fingerprints</h4>";
    html += getStoredFingerprints();
    html += "</div>";
  }
  
  // WiFi Config
  html += "<div class='card'><h4>WiFi Configuration</h4>";
  html += "<form method='POST' action='/update-wifi'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<div class='form-group'><label>SSID:</label>";
  html += "<input type='text' name='ssid' value='" + stationSSID + "' required></div>";
  html += "<div class='form-group'><label>Password:</label>";
  html += "<input type='password' name='password' required></div>";
  html += "<button type='submit' class='btn'>Update WiFi</button>";
  html += "</form></div>";
  
  // Quick Actions
  html += "<div class='card'><h4>Quick Actions</h4><div class='grid'>";
  html += "<form method='POST' action='/reconnect-wifi'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-success'>Reconnect WiFi</button></form>";
  
  html += "<form method='POST' action='/clear-settings'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-danger' onclick='return confirm(\"Clear settings?\")'>Clear Settings</button></form>";
  
  html += "<form method='POST' action='/reboot'>";
  html += "<input type='hidden' name='session_token' value='" + currentSessionToken + "'>";
  html += "<button type='submit' class='btn btn-warning' onclick='return confirm(\"Reboot device?\")'>Reboot</button></form>";
  html += "</div></div>";
  
  html += "</div></body></html>";
  
  return html;
}

void handleSetAttendanceMode() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  currentMode = MODE_ATTENDANCE;
  displayWelcome();
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleStartEnroll() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  String enrollIdStr = server.arg("enroll_id");
  enrollID = enrollIdStr.toInt();
  
  if (enrollID < 1 || enrollID > 127) {
    String redirectUrl = "/?session=" + currentSessionToken;
    server.sendHeader("Location", redirectUrl);
    server.send(302, "text/plain", "");
    return;
  }
  
  currentMode = MODE_ENROLL;
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Enroll Mode");
  lcd.setCursor(0, 1);
  lcd.print("ID: " + String(enrollID));
  activateBacklight();
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleDeleteFingerprint() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  String deleteIdStr = server.arg("delete_id");
  int deleteId = deleteIdStr.toInt();
  
  if (deleteId >= 1 && deleteId <= 127 && fingerprintSensorOK) {
    uint8_t p = finger.deleteModel(deleteId);
    
    lcd.clear();
    lcd.setCursor(0, 0);
    if (p == FINGERPRINT_OK) {
      lcd.print("Deleted ID:" + String(deleteId));
      buzzerSound();
    } else {
      lcd.print("Delete Failed");
    }
    activateBacklight();
    delay(2000);
    displayWelcome();
  }
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleClearAllFingerprints() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  if (fingerprintSensorOK) {
    finger.emptyDatabase();
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("All Deleted");
    activateBacklight();
    delay(2000);
    displayWelcome();
  }
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleUpdateBaseURL() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  String newBaseURL = server.arg("baseurl");
  
  if (newBaseURL.length() == 0) {
    lastError = "BASE URL cannot be empty";
    String redirectUrl = "/?session=" + currentSessionToken;
    server.sendHeader("Location", redirectUrl);
    server.send(302, "text/plain", "");
    return;
  }
  
  // Basic URL validation
  if (!newBaseURL.startsWith("http://") && !newBaseURL.startsWith("https://")) {
    lastError = "BASE URL must start with http:// or https://";
    String redirectUrl = "/?session=" + currentSessionToken;
    server.sendHeader("Location", redirectUrl);
    server.send(302, "text/plain", "");
    return;
  }
  
  // Save to EEPROM and update current variable
  saveBaseURLToEEPROM(newBaseURL);
  BASE_URL = newBaseURL;
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("URL Updated!");
  lcd.setCursor(0, 1);
  lcd.print("Success");
  activateBacklight();
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleClearBaseURL() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  // Reset to default URL
  BASE_URL = "https://attendance2.itsignaturesolutions.com/test_http.php?uid=";
  clearBaseURLFromEEPROM();
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("URL Reset!");
  lcd.setCursor(0, 1);
  lcd.print("To Default");
  activateBacklight();
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void testWiFiConnection(String newSSID, String newPassword) {
  WiFi.begin(newSSID.c_str(), newPassword.c_str());
  
  unsigned long startTime = millis();
  bool connected = false;
  
  while (millis() - startTime < 10000) {
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      break;
    }
    delay(100);
    yield();
    server.handleClient();
  }
  
  if (connected) {
    saveWiFiToEEPROM(newSSID, newPassword);
    stationSSID = newSSID;
    stationPassword = newPassword;
    stationConnected = true;
    lastError = "";
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Updated!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    activateBacklight();
  } else {
    stationConnected = false;
    if (WiFi.status() == WL_CONNECT_FAILED) {
      lastError = "Wrong password";
    } else if (WiFi.status() == WL_NO_SSID_AVAIL) {
      lastError = "SSID not found";
    } else {
      lastError = "Connection timeout";
    }
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Update Failed");
    lcd.setCursor(0, 1);
    lcd.print(lastError);
    activateBacklight();
  }
}

void handleUpdateWiFi() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  String newSSID = server.arg("ssid");
  String newPassword = server.arg("password");
  
  if (newSSID.length() == 0) {
    lastError = "SSID cannot be empty";
    String redirectUrl = "/?session=" + currentSessionToken;
    server.sendHeader("Location", redirectUrl);
    server.send(302, "text/plain", "");
    return;
  }