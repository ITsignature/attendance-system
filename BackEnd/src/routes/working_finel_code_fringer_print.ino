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

// AS608 Fingerprint Scanner
#define FP_TX_PIN D1     // Connect to AS608 RX
#define FP_RX_PIN D2     // Connect to AS608 TX
// LCD Display
#define LED_SDA_PIN D3   // LCD SDA_PIN 
#define LED_SCL_PIN D4   // LCD SCL_PIN
// Buzzer
#define BUZZER_PIN D0    // BUZZER (+) PIN

SoftwareSerial mySerial(FP_RX_PIN, FP_TX_PIN);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure client;
HTTPClient http;
ESP8266WebServer server(80);

// EEPROM - Increased size to accommodate BASE_URL
#define EEPROM_SIZE 512
#define WIFI_START_ADDR 0
#define BASEURL_START_ADDR 200

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

// Pre-allocated JSON document
StaticJsonDocument<256> jsonDoc;

// HTML template parts
const String HTML_HEAD = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>IT Signature</title></head>";
const String CSS_OPTIMIZED = "<style>body{font-family:Arial;background:linear-gradient(135deg,#1E9ADA,#6BC7F0);margin:0;padding:20px;min-height:100vh;box-sizing:border-box}.container{max-width:900px;margin:0 auto}.card{background:#fff;padding:20px;border-radius:10px;box-shadow:0 5px 15px rgba(0,0,0,0.1);margin-bottom:15px}.logo{font-size:28px;color:#1E9ADA;font-weight:bold;text-align:center;margin-bottom:10px}.btn{background:#1E9ADA;color:#fff;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-size:14px;margin:5px}.btn:hover{background:#0A7CB8}.btn-danger{background:#f44336}.btn-success{background:#4CAF50}.btn-warning{background:#FF9800}.form-group{margin-bottom:15px}.form-group label{display:block;margin-bottom:5px;font-weight:500}.form-group input{width:100%;padding:8px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;word-break:break-all}.status{padding:8px;border-radius:5px;margin:5px 0;word-wrap:break-word;overflow-wrap:break-word}.status-success{background:#e8f5e8;color:#4CAF50}.status-error{background:#ffe8e8;color:#f44336}.status-info{background:#f8f9fa;color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px}.fingerprint-list{max-height:300px;overflow-y:auto;border:1px solid #ddd;padding:10px;border-radius:5px}.fp-item{padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}.fp-item:last-child{border-bottom:none}.pagination{text-align:center;margin:10px 0}.pagination .btn{margin:2px;font-size:12px;padding:5px 10px}.pagination .current{background:#FF9800;color:#fff}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.spinner{animation:spin 2s linear infinite}</style>";

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
  html.reserve(2000);
  
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

bool fingerprintExists(uint16_t id) {
  return (finger.loadModel(id) == FINGERPRINT_OK);
}

// Global arrays for pagination (avoiding struct issues)
uint16_t fingerprintIDs[60];
uint16_t fingerprintCount = 0;

void getAllFingerprints() {
  fingerprintCount = 0;
  
  if (!fingerprintSensorOK) {
    return;
  }
  
  for (uint16_t id = 1; id <= 60 && fingerprintCount < 60; id++) {
    yield();
    if (fingerprintExists(id)) {
      fingerprintIDs[fingerprintCount] = id;
      fingerprintCount++;
    }
    delay(2);
  }
}

String getStoredFingerprintsWithPagination(int page = 1) {
  if (!fingerprintSensorOK) {
    return F("<div class='status status-error'>Sensor not available</div>");
  }

  // Get all fingerprints first
  getAllFingerprints();
  
  if (fingerprintCount == 0) {
    return F("<div class='status status-info'>No fingerprints stored</div>");
  }

  const int itemsPerPage = 5;
  int totalPages = (fingerprintCount + itemsPerPage - 1) / itemsPerPage;
  
  // Validate page number
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  
  int startIdx = (page - 1) * itemsPerPage;
  int endIdx = min(startIdx + itemsPerPage, (int)fingerprintCount);

  String fpList;
  fpList.reserve(2000);
  
  // Pagination controls (top)
  if (totalPages > 1) {
    fpList += F("<div class='pagination'>");
    
    // Previous button
    if (page > 1) {
      fpList += F("<a href='/?session=");
      fpList += currentSessionToken;
      fpList += F("&fp_page=");
      fpList += (page - 1);
      fpList += F("' class='btn'>‹ Prev</a>");
    }
    
    // Page numbers
    for (int p = 1; p <= totalPages; p++) {
      if (p == page) {
        fpList += F("<span class='btn current'>");
        fpList += p;
        fpList += F("</span>");
      } else {
        fpList += F("<a href='/?session=");
        fpList += currentSessionToken;
        fpList += F("&fp_page=");
        fpList += p;
        fpList += F("' class='btn'>");
        fpList += p;
        fpList += F("</a>");
      }
    }
    
    // Next button
    if (page < totalPages) {
      fpList += F("<a href='/?session=");
      fpList += currentSessionToken;
      fpList += F("&fp_page=");
      fpList += (page + 1);
      fpList += F("' class='btn'>Next ›</a>");
    }
    
    fpList += F("</div>");
  }

  fpList += F("<div class='fingerprint-list'>");

  // Display fingerprints for current page
  for (int i = startIdx; i < endIdx; i++) {
    uint16_t id = fingerprintIDs[i];
    
    fpList += F("<div class='fp-item'><span>ID: ");
    fpList += id;
    fpList += F("</span>"
                "<form method='POST' action='/delete-fingerprint' style='margin:0'>"
                "<input type='hidden' name='session_token' value='");
    fpList += currentSessionToken;
    fpList += F("'>"
                "<input type='hidden' name='delete_id' value='");
    fpList += id;
    fpList += F("'>"
                "<button type='submit' class='btn btn-danger' "
                "style='padding:5px 10px;font-size:12px' "
                "onclick='return confirm(\"Delete fingerprint ID ");
    fpList += id;
    fpList += F("?\")'>Delete</button></form></div>");
  }

  fpList += F("</div>");
  
  // Pagination controls (bottom) and summary
  fpList += F("<div class='status status-info'>Showing ");
  fpList += (startIdx + 1);
  fpList += F("-");
  fpList += endIdx;
  fpList += F(" of ");
  fpList += fingerprintCount;
  fpList += F(" fingerprints (Page ");
  fpList += page;
  fpList += F(" of ");
  fpList += totalPages;
  fpList += F(")</div>");
  
  if (totalPages > 1) {
    fpList += F("<div class='pagination'>");
    
    // Previous button
    if (page > 1) {
      fpList += F("<a href='/?session=");
      fpList += currentSessionToken;
      fpList += F("&fp_page=");
      fpList += (page - 1);
      fpList += F("' class='btn'>‹ Previous</a>");
    }
    
    // Next button  
    if (page < totalPages) {
      fpList += F("<a href='/?session=");
      fpList += currentSessionToken;
      fpList += F("&fp_page=");
      fpList += (page + 1);
      fpList += F("' class='btn'>Next ›</a>");
    }
    
    fpList += F("</div>");
  }

  return fpList;
}

String generateOptimizedDashboard() {
  String html = "";
  html.reserve(5000);
  
  html = HTML_HEAD + CSS_OPTIMIZED;
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
  } else {
    html += "<div class='status status-error'>Sensor: Disconnected</div>";
    html += "<div class='status status-error'>Check wiring and restart</div>";
  }
  html += "</div></div>";
  
  // Device Status
  html += "<div class='card'><h4>Device Status</h4><div class='grid'>";
  html += "<div class='status status-success'>AP: Active</div>";
  html += "<div class='status status-info'>IP: " + WiFi.softAPIP().toString() + "</div>";
  html += "<div class='status status-info'>Uptime: " + String(millis()/60000) + "m</div>";
  html += "<div class='status status-info'>Free Heap: " + String(ESP.getFreeHeap()) + "B</div>";
  html += "</div></div>";
  
  // WiFi Status
  html += "<div class='card'><h4>WiFi Status</h4>";
  if (stationConnected) {
    html += "<div class='status status-success'>Connected: " + stationSSID + "</div>";
    html += "<div class='status status-info'>IP: " + WiFi.localIP().toString() + "</div>";
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
    
    // Stored Fingerprints List with Pagination
    html += "<div class='card'><h4>Stored Fingerprints</h4>";
    
    // Get current page from URL parameter
    int currentPage = 1;
    String pageParam = server.arg("fp_page");
    if (pageParam.length() > 0) {
      currentPage = pageParam.toInt();
      if (currentPage < 1) currentPage = 1;
    }
    
    html += getStoredFingerprintsWithPagination(currentPage);
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
  
  html += "</div>";
  html += "</body></html>";
  
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

// Existing WiFi and other handlers remain the same...
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
  
  String updatePage = HTML_HEAD + CSS_OPTIMIZED;
  updatePage += "<body><div class='container'><div class='card'>";
  updatePage += "<div class='logo'>IT Signature</div>";
  updatePage += "<h3 style='text-align:center'>Updating WiFi...</h3>";
  updatePage += "<div style='text-align:center;font-size:48px;margin:20px 0' class='spinner'>⚙️</div>";
  updatePage += "<div class='status status-info'>Connecting to: " + newSSID + "</div>";
  updatePage += "</div></div>";
  updatePage += "<script>setTimeout(function(){location.href='/?session=" + currentSessionToken + "';},3000);</script>";
  updatePage += "</body></html>";
  
  server.send(200, "text/html", updatePage);
  delay(500);
  testWiFiConnection(newSSID, newPassword);
}

void handleReconnectWiFi() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  attemptStationConnection();
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleClearSettings() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  clearEEPROM();
  stationSSID = "";
  stationPassword = "";
  stationConnected = false;
  lastError = "";
  // Reset BASE_URL to default
  BASE_URL = "https://attendance2.itsignaturesolutions.com/test_http.php?uid=";
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Settings Cleared");
  activateBacklight();
  
  String redirectUrl = "/?session=" + currentSessionToken;
  server.sendHeader("Location", redirectUrl);
  server.send(302, "text/plain", "");
}

void handleReboot() {
  if (!isAuthenticated()) {
    server.sendHeader("Location", "/login");
    server.send(302, "text/plain", "");
    return;
  }
  
  String rebootPage = HTML_HEAD + CSS_OPTIMIZED;
  rebootPage += "<body><div class='container'><div class='card'>";
  rebootPage += "<div class='logo'>IT Signature</div>";
  rebootPage += "<h3 style='text-align:center'>Rebooting...</h3>";
  rebootPage += "<div style='text-align:center;font-size:48px;margin:20px 0' class='spinner'>⚙️</div>";
  rebootPage += "</div></div>";
  rebootPage += "<script>setTimeout(function(){location.href='/login';},15000);</script>";
  rebootPage += "</body></html>";
  
  server.send(200, "text/html", rebootPage);
  delay(500);
  ESP.restart();
}

void setupWiFi() {
  WiFi.softAP(AP_SSID.c_str(), AP_PASSWORD.c_str());
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AP: IT-Signature");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.softAPIP().toString());
  
  delay(1000);
  attemptStationConnection();
}

void attemptStationConnection() {
  if (loadWiFiFromEEPROM(stationSSID, stationPassword)) {
    WiFi.begin(stationSSID.c_str(), stationPassword.c_str());
    
    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
      delay(100);
      yield();
      server.handleClient();
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      stationConnected = true;
      lastError = "";
      
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Connected");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.localIP().toString());
    } else {
      stationConnected = false;
      if (WiFi.status() == WL_CONNECT_FAILED) {
        lastError = "Wrong password";
      } else if (WiFi.status() == WL_NO_SSID_AVAIL) {
        lastError = "SSID not found";
      } else {
        lastError = "Connection failed";
      }
      
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Failed");
      lcd.setCursor(0, 1);
      lcd.print("Use AP");
    }
  } else {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("No WiFi Config");
    lcd.setCursor(0, 1);
    lcd.print("Use AP");
  }
  
  activateBacklight();
}

void setup() {
  Wire.begin(D3, D4);
  lcd.begin(16, 2);
  lcd.noBacklight();
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.begin(115200);
  Serial.println("\nIT Signature Fingerprint System Starting...");
  
  // Initialize fingerprint sensor
  mySerial.begin(57600);
  delay(100);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Init Fingerprint");
  activateBacklight();
  
  if (finger.verifyPassword()) {
    Serial.println("AS608 Fingerprint sensor found!");
    fingerprintSensorOK = true;
    
    finger.getParameters();
    finger.getTemplateCount();
    Serial.print("Capacity: "); Serial.println(finger.capacity);
    Serial.print("Templates stored: "); Serial.println(finger.templateCount);
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("FP Sensor OK");
    lcd.setCursor(0, 1);
    lcd.print("Templates: " + String(finger.templateCount));
    delay(2000);
  } else {
    Serial.println("AS608 Fingerprint sensor NOT found!");
    fingerprintSensorOK = false;
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("FP Sensor ERROR");
    lcd.setCursor(0, 1);
    lcd.print("Check Wiring");
    delay(3000);
  }

  setupEEPROM();
  
  // Load BASE_URL from EEPROM if available
  String savedBaseURL;
  if (loadBaseURLFromEEPROM(savedBaseURL)) {
    BASE_URL = savedBaseURL;
    Serial.println("Loaded BASE_URL from EEPROM: " + BASE_URL);
  } else {
    Serial.println("Using default BASE_URL: " + BASE_URL);
  }
  
  randomSeed(analogRead(0));
  setupWiFi();
  
  // Setup web server routes
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
  server.begin();
  
  Serial.println("Web server started!");
  Serial.println("Access Point: " + AP_SSID);
  Serial.println("AP IP: " + WiFi.softAPIP().toString());
  Serial.println("Current BASE_URL: " + BASE_URL);

  // Configure HTTPS Client
  client.setInsecure();  // Skip SSL certificate validation
  client.setTimeout(15000);  // Increased timeout for SSL handshake
  client.setBufferSizes(1024, 1024);  // Increased buffer sizes for better response handling
  
  displayWelcome();
  activateBacklight();
}

void loop() {
  server.handleClient();
  
  // Check station connection periodically
  if (millis() - lastStationCheck > STATION_CHECK_INTERVAL) {
    lastStationCheck = millis();
    if (stationSSID.length() > 0) {
      bool wasConnected = stationConnected;
      stationConnected = (WiFi.status() == WL_CONNECTED);
      
      if (!stationConnected && wasConnected) {
        attemptStationConnection();
      }
    }
  }
  
  handleBacklight();
  
  // Fingerprint Processing based on current mode
  if (fingerprintSensorOK && millis() - lastScanTime > SCAN_DEBOUNCE) {
    if (currentMode == MODE_ATTENDANCE) {
      handleAttendanceMode();
    } else if (currentMode == MODE_ENROLL) {
      handleEnrollMode();
    }
  }
  
  delay(50);
}

void handleAttendanceMode() {
  uint8_t fingerprintID = getFingerprintID();
  
  if (fingerprintID != 255) {
    lastScanTime = millis();
    activateBacklight();
    
    Serial.println("Fingerprint ID: " + String(fingerprintID));
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Processing...");
    
    if (stationConnected) {
      sendOptimizedRequest(String(fingerprintID));
    } else {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("No Internet");
      lcd.setCursor(0, 1);
      lcd.print("ID: " + String(fingerprintID));
    }
    
    delay(2000);
    displayWelcome();
  }
}

void handleEnrollMode() {
  static int enrollStep = 0;
  static unsigned long enrollStepTime = 0;
  
  if (millis() - enrollStepTime < 500) return; // Debounce
  
  uint8_t p = finger.getImage();
  
  if (p == FINGERPRINT_OK) {
    enrollStepTime = millis();
    activateBacklight();
    
    if (enrollStep == 0) {
      // First fingerprint image
      p = finger.image2Tz(1);
      if (p == FINGERPRINT_OK) {
        enrollStep = 1;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Remove finger");
        lcd.setCursor(0, 1);
        lcd.print("Place again");
        buzzerSound();
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Image error");
        delay(1000);
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Enroll Mode");
        lcd.setCursor(0, 1);
        lcd.print("ID: " + String(enrollID));
      }
    } else if (enrollStep == 1) {
      // Wait for finger to be removed
      return;
    } else if (enrollStep == 2) {
      // Second fingerprint image
      p = finger.image2Tz(2);
      if (p == FINGERPRINT_OK) {
        // Create model
        p = finger.createModel();
        if (p == FINGERPRINT_OK) {
          // Store model
          p = finger.storeModel(enrollID);
          if (p == FINGERPRINT_OK) {
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Enrolled!");
            lcd.setCursor(0, 1);
            lcd.print("ID: " + String(enrollID));
            buzzerSound();
            delay(2000);
            
            currentMode = MODE_ATTENDANCE;
            displayWelcome();
            enrollStep = 0;
          } else {
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Store error");
            delay(1000);
            enrollStep = 0;
          }
        } else {
          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("No match");
          delay(1000);
          enrollStep = 0;
        }
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Image error");
        delay(1000);
        enrollStep = 0;
      }
    }
  } else if (p == FINGERPRINT_NOFINGER && enrollStep == 1) {
    // Finger removed, ready for second scan
    enrollStep = 2;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Place same");
    lcd.setCursor(0, 1);
    lcd.print("finger again");
  }
}

uint8_t getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return 255;
  
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return 255;
  
  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK) {
    if (p == FINGERPRINT_NOTFOUND) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Not Registered");
      activateBacklight();
      delay(2000);
      displayWelcome();
    }
    return 255;
  }
  
  return finger.fingerID;
}

void displayWelcome() {
  lcd.clear();
  if (currentMode == MODE_ATTENDANCE) {
    lcd.setCursor(0, 0);
    lcd.print("Place Finger");
    lcd.setCursor(0, 1);
    lcd.print("IT Signature");
  } else if (currentMode == MODE_ENROLL) {
    lcd.setCursor(0, 0);
    lcd.print("Enroll Mode");
    lcd.setCursor(0, 1);
    lcd.print("ID: " + String(enrollID));
  }
}

void handleBacklight() {
  if (backlightActive && (millis() - backlightOnTime > BACKLIGHT_DURATION)) {
    lcd.noBacklight();
    backlightActive = false;
  }
}

void activateBacklight() {
  if (!backlightActive) {
    lcd.backlight();
    backlightActive = true;
  }
  backlightOnTime = millis();
}

void sendOptimizedRequest(String fingerprintID) {
  if (!stationConnected) {
    displayError("No WiFi");
    return;
  }

  String fullUrl = BASE_URL + fingerprintID;

  // Debug output
  Serial.println("Sending request to: " + fullUrl);

  http.begin(client, fullUrl);
  http.setTimeout(10000);  // Increased timeout to 10 seconds
  http.addHeader("Connection", "close");
  http.addHeader("User-Agent", "ESP8266");
  http.addHeader("Accept", "application/json");
  http.setReuse(false);

  int httpCode = http.GET();

  // Debug output
  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    // HTTP header has been sent and Server response header has been handled
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_MOVED_PERMANENTLY) {
      String payload = http.getString();
      Serial.println("Response received: " + payload);
      processResponse(payload);
    } else {
      Serial.println("HTTP Error: " + String(httpCode));
      displayError("HTTP " + String(httpCode));
    }
  } else {
    // httpCode will be negative on error
    String errorMsg = http.errorToString(httpCode);
    Serial.println("Request failed: " + errorMsg);
    displayError("Conn Error");

    // Try to display more specific error on second line
    lcd.setCursor(0, 1);
    if (httpCode == -1) {
      lcd.print("Connection Lost");
    } else if (httpCode == -2) {
      lcd.print("Send Failed");
    } else if (httpCode == -3) {
      lcd.print("Server Timeout");
    } else if (httpCode == -11) {
      lcd.print("Read Timeout");
    } else {
      lcd.print("Code: " + String(httpCode));
    }
  }

  http.end();
}

void processResponse(String payload) {
  // Check if payload is empty
  if (payload.length() == 0) {
    Serial.println("Empty response received");
    displayError("Empty Response");
    return;
  }

  jsonDoc.clear();
  DeserializationError error = deserializeJson(jsonDoc, payload);

  if (!error) {
    // Check if message field exists
    if (!jsonDoc.containsKey("message")) {
      Serial.println("Response missing 'message' field");
      displayError("Invalid Response");
      return;
    }

    String message = jsonDoc["message"].as<String>();
    Serial.println("Message: " + message);

    lcd.clear();
    lcd.setCursor(0, 0);

    if (message.length() > 16) {
      lcd.print(message.substring(0, 16));
      lcd.setCursor(0, 1);
      lcd.print(message.substring(16, message.length() > 32 ? 32 : message.length()));
    } else {
      lcd.print(message);
    }

    if (message != "Fingerprint not registered") {
      buzzerSound();
    }
  } else {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    Serial.println("Payload was: " + payload);
    displayError("JSON Error");
  }
}

void displayError(String error) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Error:");
  lcd.setCursor(0, 1);
  lcd.print(error);
  activateBacklight();
}

void buzzerSound() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(300);
  digitalWrite(BUZZER_PIN, LOW);
}