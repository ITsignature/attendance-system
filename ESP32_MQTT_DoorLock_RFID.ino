/*
  ╔══════════════════════════════════════════════════════════╗
  ║   IT Signature Smart Door Lock — RFID Edition            ║
  ║   ESP32-S3 + AS608/R503 Fingerprint + PN532 RFID + MQTT  ║
  ║                                                          ║
  ║   Changes from LITE:                                     ║
  ║   • PN532 RFID via I2C (shares bus with LCD)             ║
  ║   • Topics: gym/{gymSub}/device/{id}/...                 ║
  ║   • RFID enroll via MQTT (start/stop_rfid_scan)          ║
  ║   • "Not Registered" shown on LCD when FP not found      ║
  ║   • gymSub configurable via settings & MQTT              ║
  ╚══════════════════════════════════════════════════════════╝
*/
// ─── LIBRARIES ───────────────────────────────────────────
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFiClient.h>
#include <DNSServer.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_PN532.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <HTTPUpdate.h>
#define MQTT_MAX_PACKET_SIZE 2048
#include <PubSubClient.h>
#include "Audio.h"

// ─── PIN DEFINITIONS ─────────────────────────────────────
#define I2C_SDA       8
#define I2C_SCL       9
#define BUZZER_PIN    7
#define RELAY_PIN     39
#define FP_RX_PIN     16
#define FP_TX_PIN     17
#define EMERGENCY_PIN 40
#define PN532_IRQ     0xFF  // 4-pin I2C module — no IRQ pin
#define PN532_RST     0xFF  // 4-pin I2C module — no RST pin
#define I2S_BCLK      4
#define I2S_WS        5
#define I2S_DOUT      6

// ─── RELAY / BUZZER CONFIG ────────────────────────────────
#define RELAY_ACTIVE_LOW  0
#define BUZZER_PASSIVE    0
#define BUZZER_ACTIVE_LOW 0
#define BUZZER_CHANNEL    0
#define BUZZER_FREQ       3000
#define BUZZER_RESOLUTION 8

// ─── AUDIO DEFAULT ───────────────────────────────────────
#define DEFAULT_ACCESS_SOUND  ""   // default MP3 URL when API has no audio_url (leave "" to skip)

// ─── FINGERPRINT CONFIG ───────────────────────────────────
#define FP_BAUD       57600
#define FP_MAX_ID     300
#define TEMPLATE_SIZE 512
#define DATA_CHUNK_SIZE 128

// ─── MQTT DEFAULTS ────────────────────────────────────────
#define DEFAULT_MQTT_HOST  "attendance.itsignaturesolutions.com"
#define DEFAULT_MQTT_PORT  1883
#define DEFAULT_MQTT_USER  ""    // anonymous mode
#define DEFAULT_MQTT_PASS  ""    // anonymous mode
#define DEFAULT_DEVICE_ID  "DOOR001"
#define DEFAULT_GYM_SUB    ""    // not used in HRMS topic scheme

#define TOUCH_THRESHOLD 40

// ─── AP / ADMIN ───────────────────────────────────────────
String AP_SSID             = "IT-Signature-Setup";
const String AP_PASSWORD   = "admin123";
const String ADMIN_USERNAME = "admin";
const String ADMIN_PASSWORD = "admin123";

// ─── OBJECTS ─────────────────────────────────────────────
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer         server(80);
Preferences       prefs;
DNSServer         dnsServer;
HardwareSerial    FPSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FPSerial);
Adafruit_PN532    nfc(PN532_IRQ, PN532_RST);
Audio             audio;

WiFiClient        mqttWifiClient;
PubSubClient      mqttClient(mqttWifiClient);

// ─── SESSION ─────────────────────────────────────────────
String currentSessionToken = "";
unsigned long sessionStartTime = 0;
const unsigned long SESSION_TIMEOUT = 3600000UL;

// ─── RUNTIME STATE ───────────────────────────────────────
String stationSSID     = "";
String stationPassword = "";
String BASE_URL = "https://attendance2.itsignaturesolutions.com/test_http.php?uid=";
String mqttHost     = DEFAULT_MQTT_HOST;
int    mqttPort     = DEFAULT_MQTT_PORT;
String mqttUser     = DEFAULT_MQTT_USER;
String mqttPass     = DEFAULT_MQTT_PASS;
String deviceId     = DEFAULT_DEVICE_ID;
String gymSub       = DEFAULT_GYM_SUB;
int    unlockDuration = 3;
bool   stationConnected = false;
String lastError        = "";

// Topics
String topicCmd      = "";
String topicFinger   = "";
String topicStatus   = "";
String topicFpList   = "";
String topicEnroll   = "";
String topicTemplate = "";
String topicRfid     = "";

// ─── TIMING ──────────────────────────────────────────────
unsigned long backlightOnTime   = 0;
unsigned long lastStationCheck  = 0;
unsigned long lockTimer         = 0;
unsigned long lastHeartbeat     = 0;
unsigned long lastFingerTime    = 0;
unsigned long lastRfidTime      = 0;
unsigned long lastRfidCheck     = 0;
unsigned long lastMqttReconnect = 0;
unsigned long notRegShowTime    = 0;

const unsigned long BACKLIGHT_DURATION     = 6000UL;
const unsigned long STATION_CHECK_INTERVAL = 30000UL;
const unsigned long HEARTBEAT_INTERVAL     = 10000UL;
const unsigned long FINGER_DEBOUNCE        = 1500UL;
const unsigned long RFID_DEBOUNCE          = 2000UL;
const unsigned long RFID_POLL_INTERVAL     = 300UL;  // poll PN532 every 300ms, not every loop
const unsigned long MQTT_RECONNECT_DELAY   = 5000UL;
const unsigned long NOT_REG_DISPLAY        = 2000UL;

// ─── FLAGS ───────────────────────────────────────────────
bool   backlightActive    = false;
bool   doorUnlocked       = false;
bool   fpReady            = false;
bool   rfidReady          = false;
bool   rfidScanMode       = false;   // true = enroll mode (waiting for card tap)
bool   notRegShown        = false;   // fingerprint not registered — display cooldown
bool   emergencyTriggered = false;
int    fpTemplateCount    = -1;
String fpLastStatus       = "";

// ─── PENDING MQTT ACTIONS ────────────────────────────────
bool   pendingFpList         = false;
bool   pendingEnroll         = false;
int    pendingEnrollId       = 0;
bool   pendingDelete         = false;
int    pendingDeleteId       = 0;
bool   pendingSetDuration    = false;
int    pendingDuration       = 3;
bool   pendingSetBaseUrl     = false;
String pendingBaseUrl        = "";
bool   pendingClearSettings  = false;
bool   pendingWifiUpdate     = false;
String pendingWifiSSID       = "";
String pendingWifiPass       = "";
bool   pendingExportAll      = false;
bool   pendingExportOne      = false;
int    exportOneId           = 0;
bool   pendingImportTemplate = false;
int    importId              = 0;
String importTemplateHex     = "";
bool   pendingSetGymSub      = false;
String pendingGymSub         = "";
bool   pendingMqttConfig     = false;
String pendingMqttHost       = "";
int    pendingMqttPort       = 0;
String pendingMqttUser       = "";
String pendingMqttPass       = "";
String pendingMqttGymSub     = "";

// ─── ENROLL STATE MACHINE ────────────────────────────────
enum EnrollState {
  ENROLL_IDLE, ENROLL_WAIT_FIRST, ENROLL_REMOVE,
  ENROLL_WAIT_SECOND, ENROLL_CREATING, ENROLL_STORING,
  ENROLL_DONE_OK, ENROLL_DONE_FAIL
};
volatile EnrollState enrollState = ENROLL_IDLE;
int    enrollId  = -1;
String enrollMsg = "";
unsigned long enrollTs = 0;

WiFiClientSecure secureClient;
bool secureClientReady = false;

// ═══════════════════════════════════════════════════════
//  NVS HELPERS
// ═══════════════════════════════════════════════════════
void saveSettings() {
  prefs.begin("doorlock", false);
  prefs.putString("ssid",      stationSSID);
  prefs.putString("pass",      stationPassword);
  prefs.putString("ap_ssid",   AP_SSID);
  prefs.putString("baseurl",   BASE_URL);
  prefs.putString("mqtt_host", mqttHost);
  prefs.putInt   ("mqtt_port", mqttPort);
  prefs.putString("mqtt_user", mqttUser);
  prefs.putString("mqtt_pass", mqttPass);
  prefs.putString("device_id", deviceId);
  prefs.putString("gym_sub",   gymSub);
  prefs.putInt   ("unlock_dur",unlockDuration);
  prefs.end();
}

void loadSettings() {
  prefs.begin("doorlock", true);
  stationSSID     = prefs.getString("ssid",      "");
  stationPassword = prefs.getString("pass",      "");
  AP_SSID         = prefs.getString("ap_ssid",   "IT-Signature-Setup");
  BASE_URL        = prefs.getString("baseurl",   "https://attendance2.itsignaturesolutions.com/test_http.php?uid=");
  mqttHost        = prefs.getString("mqtt_host", DEFAULT_MQTT_HOST);
  mqttPort        = prefs.getInt   ("mqtt_port", DEFAULT_MQTT_PORT);
  mqttUser        = prefs.getString("mqtt_user", DEFAULT_MQTT_USER);
  mqttPass        = prefs.getString("mqtt_pass", DEFAULT_MQTT_PASS);
  deviceId        = prefs.getString("device_id", DEFAULT_DEVICE_ID);
  gymSub          = prefs.getString("gym_sub",   DEFAULT_GYM_SUB);
  unlockDuration  = prefs.getInt   ("unlock_dur",3);
  prefs.end();
}

void buildTopics() {
  // HRMS topic scheme: devices/{device_id}/...
  String pfx = "devices/" + deviceId;
  topicCmd      = pfx + "/commands";   // HRMS sends commands here
  topicFinger   = pfx + "/finger";
  topicStatus   = pfx + "/status";     // device publishes heartbeat here
  topicFpList   = pfx + "/finger/list";
  topicEnroll   = pfx + "/enroll/progress";
  topicTemplate = pfx + "/finger/template";
  topicRfid     = pfx + "/rfid";
}

// ═══════════════════════════════════════════════════════
//  SIGNAL HELPERS
// ═══════════════════════════════════════════════════════
String rssiToSignal(int rssi) {
  if (rssi >= -50) return "excellent";
  if (rssi >= -60) return "good";
  if (rssi >= -70) return "fair";
  if (rssi >= -80) return "weak";
  return "poor";
}
int rssiToPercent(int rssi) {
  int p = 2*(rssi+100); if(p<0)p=0; if(p>100)p=100; return p;
}

// ═══════════════════════════════════════════════════════
//  SESSION HELPERS
// ═══════════════════════════════════════════════════════
String generateToken() {
  String t=""; t.reserve(32);
  for(int i=0;i<32;i++) t+=String(random(16),HEX);
  return t;
}
bool isAuthenticated() {
  if(currentSessionToken.length()==0) return false;
  if(millis()-sessionStartTime>SESSION_TIMEOUT){currentSessionToken="";return false;}
  String s=server.arg("session");
  if(s.length()==0) s=server.arg("session_token");
  if(s==currentSessionToken){sessionStartTime=millis();return true;}
  return false;
}
void requireAuth(){server.sendHeader("Location","/login");server.send(302,"text/plain","");}
String sess(){return currentSessionToken;}

// ═══════════════════════════════════════════════════════
//  HARDWARE HELPERS
// ═══════════════════════════════════════════════════════
void activateBacklight(){if(!backlightActive){lcd.backlight();backlightActive=true;}backlightOnTime=millis();}
void handleBacklight(){if(backlightActive&&millis()-backlightOnTime>BACKLIGHT_DURATION){lcd.noBacklight();backlightActive=false;}}

void buzzerOn(){
  #if BUZZER_PASSIVE
    ledcWriteTone(BUZZER_CHANNEL,BUZZER_FREQ);
  #else
    digitalWrite(BUZZER_PIN,BUZZER_ACTIVE_LOW?LOW:HIGH);
  #endif
}
void buzzerOff(){
  #if BUZZER_PASSIVE
    ledcWriteTone(BUZZER_CHANNEL,0);
  #else
    digitalWrite(BUZZER_PIN,BUZZER_ACTIVE_LOW?HIGH:LOW);
  #endif
}
void buzzerBeep(int n=1){for(int i=0;i<n;i++){buzzerOn();delay(150);buzzerOff();if(n>1)delay(120);}}

void unlockDoor(){
  digitalWrite(RELAY_PIN,RELAY_ACTIVE_LOW?LOW:HIGH);
  doorUnlocked=true; lockTimer=millis(); buzzerBeep(1);
  lcd.clear();lcd.setCursor(0,0);lcd.print("  Access Grant");
  lcd.setCursor(0,1);lcd.print("  Door Opened!"); activateBacklight();
}
void lockDoor(){digitalWrite(RELAY_PIN,RELAY_ACTIVE_LOW?HIGH:LOW);doorUnlocked=false;}
void handleDoorTimer(){if(doorUnlocked&&millis()-lockTimer>(unsigned long)(unlockDuration*1000)){lockDoor();displayWelcome();}}

void handleEmergencyButton() {
  // GPIO 41 is NOT a touch pin on ESP32-S3 (touch = GPIO 1-14 only).
  // Using digitalRead with INPUT_PULLUP: LOW = button pressed.
  bool pressed = (digitalRead(EMERGENCY_PIN) == LOW);
  if (pressed && !emergencyTriggered) {
    emergencyTriggered = true;
    unlockDoor();
    lcd.clear(); lcd.setCursor(0,0); lcd.print("  Emergency!  ");
    lcd.setCursor(0,1);  lcd.print("  Door Opened!");
    activateBacklight();
    mqttPublishStatus();
  }
  if (!pressed) emergencyTriggered = false;
}

void displayWelcome(){
  lcd.clear();lcd.setCursor(0,0);lcd.print(" Place Finger  ");
  lcd.setCursor(0,1);lcd.print(" or Tap Card   "); activateBacklight();
}
void displayError(String msg){
  lcd.clear();lcd.setCursor(0,0);lcd.print("  Access Deny  ");
  lcd.setCursor(0,1);
  if(msg.length()>16)msg=msg.substring(0,16);
  int pad=(16-msg.length())/2; String p=""; for(int i=0;i<pad;i++)p+=" "; p+=msg;
  lcd.print(p); activateBacklight(); buzzerBeep(3);
}

// ═══════════════════════════════════════════════════════
//  WIFI
// ═══════════════════════════════════════════════════════
void attemptStationConnection(){
  if(stationSSID.length()==0){lastError="No WiFi saved";return;}
  WiFi.begin(stationSSID.c_str(),stationPassword.c_str());
  unsigned long t=millis();
  while(WiFi.status()!=WL_CONNECTED&&millis()-t<12000){delay(100);yield();server.handleClient();}
  if(WiFi.status()==WL_CONNECTED){
    stationConnected=true;lastError="";
    lcd.clear();lcd.setCursor(0,0);lcd.print("WiFi Connected!");
    lcd.setCursor(0,1);lcd.print(WiFi.localIP().toString());
  }else{
    stationConnected=false;
    lastError=(WiFi.status()==WL_NO_SSID_AVAIL)?"SSID not found":"Connect failed";
  }
  activateBacklight();delay(1500);
}

void setupWiFi(){
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID.c_str(),AP_PASSWORD.c_str());
  dnsServer.start(53,"*",WiFi.softAPIP());
  lcd.clear();lcd.setCursor(0,0);lcd.print(AP_SSID.substring(0,16));
  lcd.setCursor(0,1);lcd.print(WiFi.softAPIP().toString());
  activateBacklight();delay(1200);
  attemptStationConnection();
}

// ═══════════════════════════════════════════════════════
//  FINGERPRINT HELPERS
// ═══════════════════════════════════════════════════════
bool fpUpdateCounts(){if(!fpReady)return false;if(finger.getTemplateCount()==FINGERPRINT_OK){fpTemplateCount=finger.templateCount;return true;}return false;}
String fpErrToText(int c){
  switch(c){
    case FINGERPRINT_OK:             return "OK";
    case FINGERPRINT_NOFINGER:       return "No Finger";
    case FINGERPRINT_IMAGEFAIL:      return "Image Fail";
    case FINGERPRINT_IMAGEMESS:      return "Messy Image";
    case FINGERPRINT_FEATUREFAIL:    return "Feature Fail";
    case FINGERPRINT_INVALIDIMAGE:   return "Invalid Image";
    case FINGERPRINT_NOTFOUND:       return "Not Found";
    case FINGERPRINT_ENROLLMISMATCH: return "Mismatch";
    case FINGERPRINT_BADLOCATION:    return "Bad Location";
    case FINGERPRINT_FLASHERR:       return "Flash Error";
    default: return "Err "+String(c);
  }
}
bool fpTemplateExists(int id){if(!fpReady)return false;return(finger.loadModel(id)==FINGERPRINT_OK);}

// ─── RAW UART HELPERS FOR BACKUP/RESTORE ────────────────
void as608SendPacket(uint8_t pid, const uint8_t* data, uint16_t len) {
  const uint8_t hdr[] = {0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF};
  FPSerial.write(hdr, sizeof(hdr));
  FPSerial.write(pid);
  uint16_t pktLen = len + 2;
  FPSerial.write((uint8_t)(pktLen >> 8));
  FPSerial.write((uint8_t)(pktLen & 0xFF));
  uint32_t sum = (uint32_t)pid + (pktLen >> 8) + (pktLen & 0xFF);
  for (uint16_t i = 0; i < len; i++) { FPSerial.write(data[i]); sum += data[i]; }
  FPSerial.write((uint8_t)(sum >> 8));
  FPSerial.write((uint8_t)(sum & 0xFF));
}

int as608ReadPacket(uint8_t* outData, uint16_t* outDataLen, uint8_t* outPid, uint32_t timeoutMs = 2000) {
  static uint8_t raw[700]; uint16_t pos = 0; bool gotHeader = false; unsigned long t = millis();
  while (millis() - t < timeoutMs) {
    if (!FPSerial.available()) { delay(1); continue; }
    uint8_t b = FPSerial.read();
    if (!gotHeader) {
      if (pos == 0 && b == 0xEF) raw[pos++] = b;
      else if (pos == 1 && b == 0x01) { raw[pos++] = b; gotHeader = true; }
      else pos = 0; continue;
    }
    if (pos >= sizeof(raw)) return -2;
    raw[pos++] = b; if (pos < 9) continue;
    uint16_t pktLen = ((uint16_t)raw[7] << 8) | raw[8];
    uint16_t total  = 9 + pktLen;
    if (pos >= total) {
      if (outPid) *outPid = raw[6];
      if (outDataLen) *outDataLen = pktLen - 2;
      if (outData) memcpy(outData, raw + 9, pktLen - 2);
      return (int)raw[9];
    }
  }
  return -1;
}

bool exportSensorToHost(uint8_t bufId, uint8_t* out, uint16_t* outLen) {
  while (FPSerial.available()) FPSerial.read();
  uint8_t cmd[] = {0x08, bufId}; as608SendPacket(0x01, cmd, sizeof(cmd));
  delay(400); static uint8_t rawStream[1000]; uint16_t rawLen = 0;
  while (FPSerial.available() && rawLen < sizeof(rawStream)) {
    rawStream[rawLen++] = FPSerial.read(); if (!FPSerial.available()) delay(5);
  }
  if (rawLen == 0) return false;
  uint16_t received = 0; uint16_t i = 0; bool gotAck = false;
  while (i + 11 < rawLen) {
    if (rawStream[i] != 0xEF || rawStream[i+1] != 0x01) { i++; continue; }
    uint8_t pid = rawStream[i+6]; uint16_t pktLen = ((uint16_t)rawStream[i+7] << 8) | rawStream[i+8];
    uint16_t total = 9 + pktLen; if (i + total > rawLen) break;
    uint16_t dataLen = pktLen - 2; uint8_t* pktData = rawStream + i + 9;
    if (pid == 0x07) { if (pktData[0] != 0x00) return false; gotAck = true; }
    else if (pid == 0x02 || pid == 0x08) {
      uint16_t copy = min(dataLen, (uint16_t)(TEMPLATE_SIZE - received));
      memcpy(out + received, pktData, copy); received += copy; if (pid == 0x08) break;
    }
    i += total;
  }
  *outLen = received; return gotAck && (received > 0);
}

bool importHostToSensor(uint8_t bufId, const uint8_t* data, uint16_t dataLen) {
  while (FPSerial.available()) FPSerial.read();
  uint8_t cmd[] = {0x09, bufId}; as608SendPacket(0x01, cmd, sizeof(cmd));
  uint8_t ackData[16]; uint16_t ackL; uint8_t ackP;
  int rc = as608ReadPacket(ackData, &ackL, &ackP, 5000);
  if (rc != 0) return false;
  uint16_t offset = 0;
  while (offset < dataLen) {
    uint16_t chunk = min((uint16_t)DATA_CHUNK_SIZE, (uint16_t)(dataLen - offset));
    bool isLast = (offset + chunk >= dataLen);
    as608SendPacket(isLast ? 0x08 : 0x02, data + offset, chunk);
    offset += chunk; delay(40);
  }
  return true;
}

void performOtaUpdate(String url) {
  if (url.startsWith("https")) {
    WiFiClientSecure client; client.setInsecure();
    httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    t_httpUpdate_return ret = httpUpdate.update(client, url);
    handleOtaResult(ret);
  } else {
    WiFiClient client;
    httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    t_httpUpdate_return ret = httpUpdate.update(client, url);
    handleOtaResult(ret);
  }
}

void handleOtaResult(t_httpUpdate_return ret) {
  switch (ret) {
    case HTTP_UPDATE_FAILED: {
      String err = httpUpdate.getLastErrorString();
      int code = httpUpdate.getLastError();
      String payload = "{\"status\":\"ota_failed\",\"code\":" + String(code) + ",\"reason\":\"" + err + "\"}";
      Serial.println("OTA FAILED: " + err + " (code " + String(code) + ")");
      mqttClient.publish(topicStatus.c_str(), payload.c_str());
      break;
    }
    case HTTP_UPDATE_OK: break;
    default: break;
  }
}

void bytesToHex(const uint8_t* buf, uint16_t len, char* out) {
  for (uint16_t i = 0; i < len; i++) sprintf(out + (i * 2), "%02x", buf[i]);
  out[len * 2] = '\0';
}

bool hexToBytes(const String& hex, uint8_t* out, uint16_t* outLen) {
  if (hex.length() % 2 != 0) return false;
  uint16_t n = hex.length() / 2;
  for (uint16_t i = 0; i < n; i++) {
    char h=tolower(hex[i*2]), l=tolower(hex[i*2+1]);
    uint8_t vh=(h>='a')?h-'a'+10:h-'0', vl=(l>='a')?l-'a'+10:l-'0';
    out[i] = (vh << 4) | vl;
  }
  *outLen = n; return true;
}

String fpListAllJson(){
  String out="["; bool first=true;
  for(int i=1;i<=FP_MAX_ID;i++){
    yield();server.handleClient();
    if(i%10==0)mqttClient.loop();
    if(fpTemplateExists(i)){if(!first)out+=",";out+=String(i);first=false;}
  }
  return out+"]";
}

// ═══════════════════════════════════════════════════════
//  MQTT PUBLISH HELPERS
// ═══════════════════════════════════════════════════════
void mqttPublishStatus(){
  if(!mqttClient.connected())return;
  int rssi=stationConnected?WiFi.RSSI():-100;
  DynamicJsonDocument doc(1024);
  doc["device_id"]  = deviceId;
  doc["online"]     = true;
  doc["door"]       = doorUnlocked?"open":"locked";
  doc["rssi"]       = rssi;
  doc["signal_pct"] = rssiToPercent(rssi);
  doc["signal"]     = rssiToSignal(rssi);
  doc["fp_ready"]   = fpReady;
  doc["fp_count"]   = fpTemplateCount<0?0:fpTemplateCount;
  doc["rfid_ready"] = rfidReady;
  doc["uptime_min"] = millis()/60000;
  doc["ip"]         = stationConnected?WiFi.localIP().toString():"";
  doc["unlock_dur"] = unlockDuration;
  doc["ssid"]       = stationSSID;
  doc["base_url"]   = BASE_URL;
  String payload; serializeJson(doc,payload);
  mqttClient.publish(topicStatus.c_str(),payload.c_str(),true);
}

void mqttPublishEnrollProgress(){
  if(!mqttClient.connected())return;
  StaticJsonDocument<150> doc;
  doc["device_id"]=deviceId; doc["state"]=(int)enrollState;
  doc["msg"]=enrollMsg; doc["id"]=enrollId;
  String p; serializeJson(doc,p);
  mqttClient.publish(topicEnroll.c_str(),p.c_str());
}

void mqttPublishFpList(){
  if(!mqttClient.connected())return;
  String list=fpListAllJson();
  String payload="{\"device_id\":\""+deviceId+"\",\"ids\":"+list+"}";
  mqttClient.publish(topicFpList.c_str(),payload.c_str());
}

// ═══════════════════════════════════════════════════════
//  MQTT COMMAND HANDLER
// ═══════════════════════════════════════════════════════
void mqttOnMessage(char* topic, byte* payload, unsigned int length){
  String msg=""; for(unsigned int i=0;i<length;i++) msg+=(char)payload[i];
  DynamicJsonDocument doc(2048);
  if(deserializeJson(doc,msg))return;
  String tStr=String(topic);

  if(tStr==topicCmd){
    String action=doc["action"]|"";
    if(action=="unlock"){
      unlockDoor();
      lcd.clear();lcd.setCursor(0,0);lcd.print(" Remote Unlock ");
      lcd.setCursor(0,1);lcd.print("  Dashboard    ");activateBacklight();
      mqttPublishStatus();
    }
    else if(action=="lock"){lockDoor();displayWelcome();mqttPublishStatus();}
    else if(action=="status"){mqttPublishStatus();}
    else if(action=="restart"){mqttPublishStatus();delay(300);ESP.restart();}
    else if(action=="set_duration"){int d=doc["value"]|0;if(d>=1&&d<=30){pendingSetDuration=true;pendingDuration=d;}}
    else if(action=="set_baseurl"){String u=doc["value"]|"";if(u.length()>10){pendingSetBaseUrl=true;pendingBaseUrl=u;}}
    else if(action=="set_gym_sub"){String g=doc["value"]|"";pendingSetGymSub=true;pendingGymSub=g;}
    else if(action=="set_mqtt_config"){
      pendingMqttHost    = doc["host"]   |"";
      pendingMqttPort    = doc["port"]   |0;
      pendingMqttUser    = doc["user"]   |"";
      pendingMqttPass    = doc["pass"]   |"";
      pendingMqttGymSub  = doc["gym_sub"]|"";
      pendingMqttConfig  = true;
    }
    else if(action=="set_wifi"){
      String ss=doc["ssid"]|"",pp=doc["pass"]|"";
      if(ss.length()>0){pendingWifiSSID=ss;pendingWifiPass=pp;pendingWifiUpdate=true;}
    }
    else if(action=="clear_settings"){pendingClearSettings=true;}
    else if(action=="start_rfid_scan"){
      rfidScanMode=true;
      lcd.clear();lcd.setCursor(0,0);lcd.print("  Tap RFID Card");
      lcd.setCursor(0,1);lcd.print("  Waiting...   ");activateBacklight();
    }
    else if(action=="stop_rfid_scan"){
      rfidScanMode=false;
      displayWelcome();
    }
    else if(action=="ota_update"){
      String url = doc["url"]|"";
      if(url.length()>10){
        mqttClient.publish(topicStatus.c_str(), "{\"status\":\"updating_ota\"}");
        performOtaUpdate(url);
      }
    }
  }
  else if(tStr==topicFinger){
    String action=doc["action"]|""; int id=doc["id"]|0;
    if(action=="enroll"){pendingEnroll=true;pendingEnrollId=id;}
    else if(action=="delete"){pendingDelete=true;pendingDeleteId=id;}
    else if(action=="list"){pendingFpList=true;}
    else if(action=="export_all"){pendingExportAll=true;}
    else if(action=="export_one"){
      int eid=doc["id"]|0;
      if(eid>=1&&eid<=FP_MAX_ID){pendingExportOne=true;exportOneId=eid;}
    }
    else if(action=="import_template"){
      String tmpl = doc["template"]|"";
      if(id > 0 && tmpl.length() > 0){
        pendingImportTemplate=true; importId=id; importTemplateHex=tmpl;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
//  MQTT CONNECT / LOOP
// ═══════════════════════════════════════════════════════
bool mqttConnect(){
  if(!stationConnected)return false;
  mqttClient.setServer(mqttHost.c_str(),mqttPort);
  mqttClient.setBufferSize(2048);
  mqttClient.setCallback(mqttOnMessage);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(15);
  String clientId="esp-"+deviceId+"_"+String(random(0xFFFF),HEX);
  String willPayload="{\"device_id\":\""+deviceId+"\",\"online\":false}";
  bool ok;
  if(mqttUser.length() > 0) {
    ok = mqttClient.connect(clientId.c_str(), mqttUser.c_str(), mqttPass.c_str(),
      topicStatus.c_str(), 1, true, willPayload.c_str());
  } else {
    // anonymous mode
    ok = mqttClient.connect(clientId.c_str(), NULL, NULL,
      topicStatus.c_str(), 1, true, willPayload.c_str());
  }
  if(ok){
    mqttClient.subscribe(topicCmd.c_str(),1);
    mqttClient.subscribe(topicFinger.c_str(),1);
    lcd.clear();lcd.setCursor(0,0);lcd.print("MQTT Connected!");
    lcd.setCursor(0,1);lcd.print("ID: "+deviceId);activateBacklight();
    mqttPublishStatus();return true;
  }
  lcd.clear();lcd.setCursor(0,0);lcd.print("MQTT Fail!     ");
  lcd.setCursor(0,1);lcd.print("rc="+String(mqttClient.state()));
  return false;
}

void handleMqttLoop(){
  if(!stationConnected)return;
  if(!mqttClient.connected()){
    if(millis()-lastMqttReconnect>MQTT_RECONNECT_DELAY){lastMqttReconnect=millis();mqttConnect();}
  }else{
    mqttClient.loop();
    if(millis()-lastHeartbeat>HEARTBEAT_INTERVAL){lastHeartbeat=millis();mqttPublishStatus();}
  }
}

// ═══════════════════════════════════════════════════════
//  DEFERRED MQTT PAYLOAD HANDLER
// ═══════════════════════════════════════════════════════
void handlePendingMqtt(){
  if(pendingFpList){pendingFpList=false;mqttPublishFpList();}
  if(pendingEnroll){pendingEnroll=false;enrollBegin(pendingEnrollId);mqttPublishEnrollProgress();}
  if(pendingDelete){
    pendingDelete=false;
    if(fpReady&&pendingDeleteId>=1&&pendingDeleteId<=FP_MAX_ID){
      int p=finger.deleteModel(pendingDeleteId);
      fpLastStatus=(p==FINGERPRINT_OK)?"Deleted ID "+String(pendingDeleteId):fpErrToText(p);
      fpUpdateCounts();if(p==FINGERPRINT_OK)buzzerBeep(1);mqttPublishStatus();
    }
  }
  if(pendingSetDuration){pendingSetDuration=false;unlockDuration=pendingDuration;saveSettings();mqttPublishStatus();}
  if(pendingSetBaseUrl){pendingSetBaseUrl=false;BASE_URL=pendingBaseUrl;saveSettings();mqttPublishStatus();}
  if(pendingSetGymSub){
    pendingSetGymSub=false;gymSub=pendingGymSub;saveSettings();buildTopics();
    mqttClient.disconnect();lastMqttReconnect=0;
  }
  if(pendingMqttConfig){
    pendingMqttConfig=false;
    if(pendingMqttHost.length()>0)    mqttHost    = pendingMqttHost;
    if(pendingMqttPort>0)             mqttPort    = pendingMqttPort;
    if(pendingMqttUser.length()>0)    mqttUser    = pendingMqttUser;
    if(pendingMqttPass.length()>0)    mqttPass    = pendingMqttPass;
    if(pendingMqttGymSub.length()>0){ gymSub      = pendingMqttGymSub; buildTopics(); }
    saveSettings();
    mqttClient.publish(topicStatus.c_str(),"{\"status\":\"mqtt_config_saved\"}");
    delay(200);
    mqttClient.disconnect();
    lastMqttReconnect=0;
  }
  if(pendingClearSettings){
    pendingClearSettings=false;
    mqttClient.publish(topicStatus.c_str(),("{\"device_id\":\""+deviceId+"\",\"online\":false}").c_str(),true);
    delay(200);prefs.begin("doorlock",false);prefs.clear();prefs.end();delay(300);ESP.restart();
  }
  if(pendingWifiUpdate){
    pendingWifiUpdate=false;stationSSID=pendingWifiSSID;stationPassword=pendingWifiPass;saveSettings();
    mqttPublishStatus();delay(200);WiFi.disconnect(true,true);delay(500);
    WiFi.begin(stationSSID.c_str(),stationPassword.c_str());
    lcd.clear();lcd.setCursor(0,0);lcd.print("WiFi Updating..");
    lcd.setCursor(0,1);lcd.print(stationSSID.substring(0,16));activateBacklight();
  }
  if(pendingExportAll){
    pendingExportAll = false;
    for(int i=1; i<=FP_MAX_ID; i++){
      if(fpTemplateExists(i)){
        uint8_t buf[TEMPLATE_SIZE]; uint16_t tLen=0;
        if(exportSensorToHost(1, buf, &tLen)){
          char hex[TEMPLATE_SIZE*2 + 1]; bytesToHex(buf, tLen, hex);
          String p = "{\"device_id\":\""+deviceId+"\",\"id\":"+String(i)+",\"template\":\""+String(hex)+"\"}";
          mqttClient.publish(topicTemplate.c_str(), p.c_str());
          delay(100);
        }
      }
      yield(); handleMqttLoop();
    }
    mqttClient.publish(topicFinger.c_str(), ("{\"device_id\":\""+deviceId+"\",\"action\":\"export_done\"}").c_str());
  }
  if(pendingExportOne){
    pendingExportOne=false;
    if(fpReady && finger.loadModel(exportOneId)==FINGERPRINT_OK){
      uint8_t buf[TEMPLATE_SIZE]; uint16_t tLen=0;
      if(exportSensorToHost(1,buf,&tLen)){
        char hex[TEMPLATE_SIZE*2+1]; bytesToHex(buf,tLen,hex);
        String p="{\"device_id\":\""+deviceId+"\",\"id\":"+String(exportOneId)+",\"template\":\""+String(hex)+"\"}";
        mqttClient.publish(topicTemplate.c_str(),p.c_str());
      }
    }
    mqttClient.publish(topicFinger.c_str(),("{\"device_id\":\""+deviceId+"\",\"action\":\"export_done\"}").c_str());
  }
  if(pendingImportTemplate){
    pendingImportTemplate = false;
    uint8_t buf[TEMPLATE_SIZE]; uint16_t bLen=0;
    if(hexToBytes(importTemplateHex, buf, &bLen)){
      if(importHostToSensor(1, buf, bLen)){
        int rc = finger.storeModel(importId);
        if(rc == FINGERPRINT_OK){ fpUpdateCounts(); buzzerBeep(1); mqttPublishStatus(); }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
//  ATTENDANCE HTTP CHECK
// ═══════════════════════════════════════════════════════
void initSecureClient(){secureClient.setInsecure();secureClient.setTimeout(5000);secureClientReady=true;}

void processAttendance(String uid){
  lcd.clear();lcd.setCursor(0,0);lcd.print("  Checking...  ");
  lcd.setCursor(0,1);lcd.print(uid.substring(0,14));activateBacklight();
  if(!stationConnected||WiFi.status()!=WL_CONNECTED){displayError("No Internet");return;}
  if(!secureClientReady)initSecureClient();
  HTTPClient http;
  http.begin(secureClient,BASE_URL+uid);
  http.setTimeout(3000);http.addHeader("User-Agent","ESP32-DoorLock");http.setReuse(true);
  int code=http.GET();
  if(code==HTTP_CODE_OK){
    String payload=http.getString();http.end();
    StaticJsonDocument<512> doc;
    if(!deserializeJson(doc,payload)){
      String status=doc["status"]|"",message=doc["message"]|"",name=doc["name"]|"";
      String audioUrl=doc["audio_url"]|"";
      if(status=="success"){
        unlockDoor();
        lcd.clear();lcd.setCursor(0,0);
        String l1=name.length()>0?"Hi, "+name:"Access Granted";
        lcd.print(l1.substring(0,16));
        lcd.setCursor(0,1);lcd.print((message.length()>0?message:"Door Opened!").substring(0,16));
        if(audioUrl.length()>10) audio.connecttohost(audioUrl.c_str());
        else if(strlen(DEFAULT_ACCESS_SOUND)>10) audio.connecttohost(DEFAULT_ACCESS_SOUND);
      }else displayError(message.length()>0?message:"No Access");
    }else{http.end();displayError("Parse Error");}
  }else{
    http.end();
    if(code==HTTPC_ERROR_CONNECTION_REFUSED)displayError("Server Refused");
    else if(code==HTTPC_ERROR_READ_TIMEOUT) displayError("Timeout");
    else displayError("HTTP "+String(code));
  }
  mqttPublishStatus();
}

// kept for backward compat — fingerprint search passes int ID
void processFingerId(int fid){ processAttendance(String(fid)); }

// ═══════════════════════════════════════════════════════
//  RFID SCAN (PN532)
// ═══════════════════════════════════════════════════════
void handleRfid(){
  if(!rfidReady) return;
  if(millis()-lastRfidTime < RFID_DEBOUNCE) return;   // debounce after tap
  if(millis()-lastRfidCheck < RFID_POLL_INTERVAL) return; // rate-limit polling
  lastRfidCheck = millis();

  uint8_t uid[7]; uint8_t uidLen=0;
  if(!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 80)) return;

  // Build hex UID string
  String uidStr="";
  if(uidLen==4){uint32_t v=((uint32_t)uid[3]<<24)|((uint32_t)uid[2]<<16)|((uint32_t)uid[1]<<8)|uid[0];uidStr=String(v);}else{for(uint8_t i=0;i<uidLen;i++){if(uid[i]<0x10)uidStr+="0";uidStr+=String(uid[i],HEX);}uidStr.toUpperCase();}

  if(rfidScanMode){
    // Enroll mode — report card to dashboard
    String p="{\"action\":\"rfid_read\",\"device_id\":\""+deviceId+"\",\"uid\":\""+uidStr+"\"}";
    mqttClient.publish(topicRfid.c_str(),p.c_str());
    lcd.clear();lcd.setCursor(0,0);lcd.print("Card Detected!");
    lcd.setCursor(0,1);lcd.print(uidStr.substring(0,16));activateBacklight();
    buzzerBeep(1);
    rfidScanMode=false;
  } else {
    // Normal mode — check attendance
    if(enrollState!=ENROLL_IDLE)return; // don't interrupt enroll
    processAttendance(uidStr);
    if(!doorUnlocked)displayWelcome();
  }
}

// ═══════════════════════════════════════════════════════
//  ENROLL STATE MACHINE
// ═══════════════════════════════════════════════════════
void enrollReset(EnrollState s,const String& m){enrollState=s;enrollMsg=m;enrollTs=millis();}

void enrollBegin(int id){
  if(!fpReady){enrollReset(ENROLL_DONE_FAIL,"FP Not Ready");return;}
  if(id<1||id>FP_MAX_ID){enrollReset(ENROLL_DONE_FAIL,"Bad ID");return;}
  if(fpTemplateExists(id)){enrollReset(ENROLL_DONE_FAIL,"ID Exists");return;}
  enrollId=id;enrollMsg="Place finger 1";enrollState=ENROLL_WAIT_FIRST;
  lcd.clear();lcd.setCursor(0,0);lcd.print("Enroll ID:"+String(id));
  lcd.setCursor(0,1);lcd.print("Place finger 1 ");activateBacklight();
}

void enrollTick(){
  if(enrollState==ENROLL_IDLE)return;
  if(enrollState==ENROLL_DONE_OK||enrollState==ENROLL_DONE_FAIL){
    if(millis()-enrollTs>15000){enrollState=ENROLL_IDLE;enrollId=-1;enrollMsg="";displayWelcome();}return;
  }
  if(!fpReady){enrollReset(ENROLL_DONE_FAIL,"FP Not Ready");return;}
  int p;
  switch(enrollState){
    case ENROLL_WAIT_FIRST:
      p=finger.getImage();if(p==FINGERPRINT_NOFINGER)return;
      if(p!=FINGERPRINT_OK){enrollReset(ENROLL_DONE_FAIL,"Img1 "+fpErrToText(p));mqttPublishEnrollProgress();return;}
      p=finger.image2Tz(1);if(p!=FINGERPRINT_OK){enrollReset(ENROLL_DONE_FAIL,"Tz1 "+fpErrToText(p));mqttPublishEnrollProgress();return;}
      enrollState=ENROLL_REMOVE;enrollMsg="Remove finger";
      lcd.clear();lcd.setCursor(0,0);lcd.print("Enroll ID:"+String(enrollId));
      lcd.setCursor(0,1);lcd.print("Remove finger  ");activateBacklight();enrollTs=millis();
      mqttPublishEnrollProgress();return;
    case ENROLL_REMOVE:
      p=finger.getImage();
      if(p==FINGERPRINT_NOFINGER){
        enrollState=ENROLL_WAIT_SECOND;enrollMsg="Place finger 2";
        lcd.clear();lcd.setCursor(0,0);lcd.print("Enroll ID:"+String(enrollId));
        lcd.setCursor(0,1);lcd.print("Place finger 2 ");activateBacklight();
        mqttPublishEnrollProgress();
      }return;
    case ENROLL_WAIT_SECOND:
      p=finger.getImage();if(p==FINGERPRINT_NOFINGER)return;
      if(p!=FINGERPRINT_OK){enrollReset(ENROLL_DONE_FAIL,"Img2 "+fpErrToText(p));mqttPublishEnrollProgress();return;}
      p=finger.image2Tz(2);if(p!=FINGERPRINT_OK){enrollReset(ENROLL_DONE_FAIL,"Tz2 "+fpErrToText(p));mqttPublishEnrollProgress();return;}
      enrollState=ENROLL_CREATING;enrollMsg="Creating model";return;
    case ENROLL_CREATING:
      p=finger.createModel();
      if(p!=FINGERPRINT_OK){enrollReset(ENROLL_DONE_FAIL,"Model "+fpErrToText(p));mqttPublishEnrollProgress();return;}
      enrollState=ENROLL_STORING;enrollMsg="Storing...";return;
    case ENROLL_STORING:
      p=finger.storeModel(enrollId);
      if(p==FINGERPRINT_OK){
        enrollReset(ENROLL_DONE_OK,"Enroll OK ID "+String(enrollId));
        buzzerBeep(2);fpUpdateCounts();
        lcd.clear();lcd.setCursor(0,0);lcd.print("Enroll Success!");
        lcd.setCursor(0,1);lcd.print("ID: "+String(enrollId));activateBacklight();
      }else{enrollReset(ENROLL_DONE_FAIL,"Store "+fpErrToText(p));buzzerBeep(3);}
      mqttPublishEnrollProgress();mqttPublishStatus();return;
    default:return;
  }
}

// ═══════════════════════════════════════════════════════
//  FINGERPRINT MATCH
//  Returns: >=0 matched ID | -1 no finger | -2 not registered
// ═══════════════════════════════════════════════════════
int fingerSearchOnce(){
  if(!fpReady)return -1;
  int p=finger.getImage();if(p==FINGERPRINT_NOFINGER)return -1;
  if(p!=FINGERPRINT_OK){fpLastStatus="getImage: "+fpErrToText(p);return -1;}
  p=finger.image2Tz();if(p!=FINGERPRINT_OK){fpLastStatus="image2Tz: "+fpErrToText(p);return -1;}
  p=finger.fingerSearch();
  if(p==FINGERPRINT_OK){fpLastStatus="Match ID "+String(finger.fingerID);return finger.fingerID;}
  if(p==FINGERPRINT_NOTFOUND){fpLastStatus="Not Registered";return -2;}
  fpLastStatus="Search: "+fpErrToText(p);
  return -1;
}

// ═══════════════════════════════════════════════════════
//  MINIMAL WEB UI
// ═══════════════════════════════════════════════════════
static const char* CSS =
  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
  "<style>"
  "body{font-family:Arial,sans-serif;background:#1a1a2e;margin:0;padding:16px;color:#eee}"
  ".c{max-width:480px;margin:0 auto}"
  ".box{background:#16213e;border-radius:10px;padding:20px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.2)}"
  "h2{color:#1E9ADA;margin:0 0 16px;font-size:17px}"
  "input,select{width:100%;box-sizing:border-box;padding:9px;background:#0f3460;border:1px solid #1E9ADA;"
              "border-radius:6px;margin-bottom:10px;font-size:14px;color:#fff}"
  "input:focus{outline:none}"
  ".btn{display:block;background:#1E9ADA;color:#fff;border:none;border-radius:6px;"
       "padding:10px;width:100%;font-size:14px;cursor:pointer;text-decoration:none;text-align:center;margin-top:4px}"
  ".r{background:#e53935}.y{background:#d97706}.g{background:#1b5e20}"
  ".badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}"
  ".on{background:#1b5e20;color:#fff}.off{background:#b71c1c;color:#fff}"
  ".row{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #333}"
  "</style>";

String H(){ return String("<html><head>") + CSS + "</head><body><div class='c'>"; }
String foot(){ return "</div></body></html>"; }
String navW(const String& p){ return p+(p.indexOf("?")>=0?"&":"?")+"session="+sess(); }

String generateLogin(String err=""){
  String h=H();
  h+="<div class='box' style='margin-top:60px'>";
  h+="<h2 style='text-align:center'>IT Signature<br><small style='color:#aaa;font-size:12px'>Door Lock Panel</small></h2>";
  if(err.length()>0) h+="<p style='color:red;font-size:13px;text-align:center'>"+err+"</p>";
  h+="<form method='POST' action='/login'>";
  h+="<input name='username' placeholder='Username' required autofocus>";
  h+="<input type='password' name='password' placeholder='Password' required>";
  h+="<button type='submit' class='btn'>Sign In</button>";
  h+="</form></div>"+foot();
  return h;
}

String generateDashboard(){
  bool online=stationConnected&&(WiFi.status()==WL_CONNECTED);
  bool mqttOk=mqttClient.connected();
  String h=H();
  h+="<div class='box'><h2>IT Signature &nbsp;<small style='color:#aaa;font-size:12px'>"+deviceId+"</small></h2>";
  h+="<div class='row'><span>WiFi</span><span class='badge "+String(online?"on":"off")+"'>"+String(online?String("● ")+stationSSID:String("✗ Not connected"))+"</span></div>";
  h+="<div class='row'><span>MQTT</span><span class='badge "+String(mqttOk?"on":"off")+"'>"+String(mqttOk?"Connected":"Disconnected")+"</span></div>";
  h+="<div class='row'><span>Door</span><span class='badge "+String(doorUnlocked?"on":"off")+"'>"+String(doorUnlocked?"OPEN":"Locked")+"</span></div>";
  h+="<div class='row'><span>Fingerprint</span><span class='badge "+String(fpReady?"on":"off")+"'>"+String(fpReady?"Ready":"Not Ready")+"</span></div>";
  h+="<div class='row'><span>RFID (PN532)</span><span class='badge "+String(rfidReady?"on":"off")+"'>"+String(rfidReady?"Ready":"Not Ready")+"</span></div>";
  h+="<div class='row'><span>FP Count</span><span>"+(fpTemplateCount<0?"—":String(fpTemplateCount))+"</span></div>";
  h+="<div class='row'><span>Gym Sub</span><span>"+gymSub+"</span></div>";
  h+="<div class='row'><span>Uptime</span><span>"+String(millis()/60000)+" min</span></div>";
  if(stationConnected) h+="<div class='row'><span>IP</span><span>"+WiFi.localIP().toString()+"</span></div>";
  h+="</div>";
  h+="<div class='box'><h2>Quick Actions</h2>";
  h+="<form method='POST' action='/manual-unlock'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<button type='submit' class='btn g'>Manual Unlock</button></form>";
  h+="<a class='btn' style='margin-top:8px' href='"+navW("/settings")+"'>Settings</a>";
  h+="<a class='btn' style='margin-top:8px' href='"+navW("/mqtt-settings")+"'>MQTT Settings</a>";
  h+="<form method='POST' action='/logout' style='margin-top:8px'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<button type='submit' class='btn r'>Logout</button></form></div>";
  h+=foot(); return h;
}

String generateSettings(){
  String h=H();
  h+="<div class='box'><a href='"+navW("/")+"' style='font-size:13px;color:#1E9ADA'>Back</a><h2>Settings</h2>";
  h+="<b style='font-size:13px'>WiFi</b>";
  if(stationConnected) h+="<p style='font-size:12px;color:#4CAF50;margin:4px 0'>Current: "+stationSSID+" ("+WiFi.localIP().toString()+")</p>";
  h+="<form method='POST' action='/update-wifi'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input name='ssid' placeholder='SSID' value='"+stationSSID+"' required>";
  h+="<input type='password' name='password' placeholder='Password'>";
  h+="<button type='submit' class='btn g' style='margin-bottom:16px'>Save WiFi</button></form>";
  h+="<b style='font-size:13px'>Access Point SSID</b>";
  h+="<form method='POST' action='/update-ap-ssid'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input name='ap_ssid' value='"+AP_SSID+"' required>";
  h+="<button type='submit' class='btn g' style='margin-bottom:16px'>Save AP SSID</button></form>";
  h+="<b style='font-size:13px'>Attendance Base URL</b>";
  h+="<form method='POST' action='/update-baseurl'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input name='baseurl' value='"+BASE_URL+"' required>";
  h+="<button type='submit' class='btn g' style='margin-bottom:16px'>Save URL</button></form>";
  h+="<b style='font-size:13px'>Device ID</b>";
  h+="<form method='POST' action='/update-device-id'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input name='device_id' value='"+deviceId+"' required>";
  h+="<button type='submit' class='btn y' onclick='return confirm(\"Change ID and reboot?\")' style='margin-bottom:16px'>Update & Reboot</button></form>";
  h+="<b style='font-size:13px'>Gym Subdomain (MQTT prefix)</b>";
  h+="<form method='POST' action='/update-gym-sub'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input name='gym_sub' placeholder='e.g. demogyms' value='"+gymSub+"'>";
  h+="<button type='submit' class='btn g' style='margin-bottom:16px'>Save Gym Sub</button></form>";
  h+="<b style='font-size:13px'>Unlock Duration</b>";
  h+="<form method='POST' action='/update-duration'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input type='number' name='duration' min='1' max='30' value='"+String(unlockDuration)+"' required>";
  h+="<button type='submit' class='btn g' style='margin-bottom:16px'>Save</button></form>";
  h+="<b style='font-size:13px;color:#e53935'>System</b>";
  h+="<form method='POST' action='/reboot'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<button type='submit' class='btn y' onclick='return confirm(\"Reboot?\")' style='margin-bottom:6px'>Reboot</button></form>";
  h+="<form method='POST' action='/clear-settings'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<button type='submit' class='btn r' onclick='return confirm(\"Clear ALL settings?\")'>Clear Settings</button></form>";
  h+="</div>"+foot(); return h;
}

String generateMqttSettings(){
  bool mqttOk=mqttClient.connected();
  String h=H();
  h+="<div class='box'><a href='"+navW("/")+"' style='font-size:13px;color:#1E9ADA'>Back</a><h2>MQTT Settings</h2>";
  h+="<div class='row'><span>Status</span><span class='badge "+String(mqttOk?"on":"off")+"'>"+String(mqttOk?"Connected":"Disconnected")+"</span></div>";
  String pfx=(gymSub.length()>0)?"gym/"+gymSub+"/device/"+deviceId:"device/"+deviceId;
  h+="<p style='font-size:11px;color:#888;margin:8px 0'>Topics: "+pfx+"/command &amp; /finger, /rfid, /status</p>";
  h+="<form method='POST' action='/update-mqtt'><input type='hidden' name='session_token' value='"+sess()+"'>";
  h+="<input name='host' placeholder='Broker Host' value='"+mqttHost+"' required>";
  h+="<input type='number' name='port' value='"+String(mqttPort)+"' required>";
  h+="<input name='user' placeholder='Username' value='"+mqttUser+"' required>";
  h+="<input type='password' name='pass' placeholder='Password'>";
  h+="<button type='submit' class='btn g'>Save & Reconnect</button></form>";
  h+="</div>"+foot(); return h;
}

// ═══════════════════════════════════════════════════════
//  WEB SERVER HANDLERS
// ═══════════════════════════════════════════════════════
void handleRoot(){if(!isAuthenticated()){requireAuth();return;}server.send(200,"text/html",generateDashboard());}
void handleLogin(){
  if(server.method()==HTTP_POST){
    if(server.arg("username")==ADMIN_USERNAME&&server.arg("password")==ADMIN_PASSWORD){
      currentSessionToken=generateToken();sessionStartTime=millis();
      server.sendHeader("Location","/?session="+currentSessionToken);server.send(302,"text/plain","");
    }else server.send(200,"text/html",generateLogin("Invalid credentials!"));
    return;
  }
  server.send(200,"text/html",generateLogin());
}
void handleLogout(){currentSessionToken="";server.sendHeader("Location","/login");server.send(302,"text/plain","");}
void handleManualUnlock(){if(!isAuthenticated()){requireAuth();return;}unlockDoor();server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");}
void handleSettings(){if(!isAuthenticated()){requireAuth();return;}server.send(200,"text/html",generateSettings());}

void handleUpdateBaseURL(){
  if(!isAuthenticated()){requireAuth();return;}
  String u=server.arg("baseurl");
  if(u.length()>10&&(u.startsWith("http://")||u.startsWith("https://"))){BASE_URL=u;saveSettings();}
  server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");
}
void handleUpdateDuration(){
  if(!isAuthenticated()){requireAuth();return;}
  int d=server.arg("duration").toInt();
  if(d>=1&&d<=30){unlockDuration=d;saveSettings();}
  server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");
}
void handleUpdateDeviceId(){
  if(!isAuthenticated()){requireAuth();return;}
  String nd=server.arg("device_id");nd.trim();
  if(nd.length()==0||nd.length()>20){
    server.sendHeader("Location","/settings?session="+sess());
    server.send(302,"text/plain","");
    return;
  }
  deviceId=nd;saveSettings();
  String rb="<html><head>"+String(CSS)+"</head><body><div class='c'><div class='box'>";
  rb+="<p style='text-align:center'>Device ID updated to <b>"+nd+"</b><br>Rebooting...<br><small>Wait ~10s</small></p>";
  rb+="<script>setTimeout(()=>{location.href='/login'},12000);</script>";
  rb+="</div></div></body></html>";
  server.send(200,"text/html",rb);
  delay(500);ESP.restart();
}
void handleUpdateApSSID(){
  if(!isAuthenticated()){requireAuth();return;}
  String ns=server.arg("ap_ssid");ns.trim();
  if(ns.length()>0){AP_SSID=ns;saveSettings();}
  server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");
}
void handleUpdateGymSub(){
  if(!isAuthenticated()){requireAuth();return;}
  String g=server.arg("gym_sub");g.trim();
  gymSub=g;saveSettings();buildTopics();
  mqttClient.disconnect();lastMqttReconnect=0;
  server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");
}
void handleUpdateWiFi(){
  if(!isAuthenticated()){requireAuth();return;}
  String ns=server.arg("ssid"),np=server.arg("password");
  if(ns.length()==0){server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");return;}
  String prog="<html><head>"+String(CSS)+"</head><body><div class='c'><div class='box'>";
  prog+="<p style='text-align:center'>Connecting to <b>"+ns+"</b>...<br><small>Wait ~15s</small></p>";
  prog+="<script>setTimeout(()=>{location.href='/?session="+sess()+"'},16000);</script>";
  prog+="</div></div></body></html>";
  server.send(200,"text/html",prog);delay(300);
  stationSSID=ns;stationPassword=np;saveSettings();
  WiFi.disconnect(true,true);delay(500);WiFi.begin(ns.c_str(),np.c_str());
  unsigned long t=millis();
  while(WiFi.status()!=WL_CONNECTED&&millis()-t<14000){delay(100);yield();server.handleClient();}
  stationConnected=(WiFi.status()==WL_CONNECTED);
}
void handleUpdateMqtt(){
  if(!isAuthenticated()){requireAuth();return;}
  String nh=server.arg("host"),nu=server.arg("user"),np=server.arg("pass");
  int npt=server.arg("port").toInt();
  if(nh.length()>0&&nu.length()>0&&npt>0){
    mqttHost=nh;mqttPort=npt;mqttUser=nu;if(np.length()>0)mqttPass=np;
    saveSettings();mqttClient.disconnect();lastMqttReconnect=0;
  }
  server.sendHeader("Location","/mqtt-settings?session="+sess());server.send(302,"text/plain","");
}
void handleMqttSettings(){if(!isAuthenticated()){requireAuth();return;}server.send(200,"text/html",generateMqttSettings());}
void handleClearSettings(){
  if(!isAuthenticated()){requireAuth();return;}
  prefs.begin("doorlock",false);prefs.clear();prefs.end();
  server.sendHeader("Location","/?session="+sess());server.send(302,"text/plain","");
  delay(300);ESP.restart();
}

void handleUpdate() {
  if(!isAuthenticated()){requireAuth();return;}
  String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{font-family:Arial;padding:20px;background:#1a1a2e;color:#eee}.card{background:#16213e;padding:20px;border-radius:10px}.btn{background:#1E9ADA;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;width:100%}input{margin-bottom:20px;width:100%}</style></head><body>"
                "<div class='card'><h2>OTA Update</h2><form method='POST' action='/update' enctype='multipart/form-data'>"
                "<input type='file' name='update' accept='.bin'><br>"
                "<input type='submit' class='btn' value='Update Firmware'></form></div></body></html>";
  server.send(200, "text/html", html);
}
void handleDoUpdate() {
  if(!isAuthenticated()){requireAuth();return;}
  server.sendHeader("Connection", "close");
  server.send(200, "text/plain", (Update.hasError()) ? "FAIL" : "OK");
  ESP.restart();
}
void handleUpdateUpload() {
  HTTPUpload& upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { Update.printError(Serial); }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) { Update.printError(Serial); }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (Update.end(true)) { Serial.printf("OTA OK: %u bytes\n", upload.totalSize); }
    else { Update.printError(Serial); }
  }
}
void handleReboot(){
  if(!isAuthenticated()){requireAuth();return;}
  String rb="<html><head>"+String(CSS)+"</head><body><div class='c'><div class='box'>";
  rb+="<p style='text-align:center'>Rebooting...<br><small>Wait ~10s</small></p>";
  rb+="<script>setTimeout(()=>{location.href='/login'},12000);</script>";
  rb+="</div></div></body></html>";
  server.send(200,"text/html",rb);delay(500);ESP.restart();
}

// ═══════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════
void setup(){
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.begin(16,2); lcd.noBacklight();

  audio.setPinout(I2S_BCLK, I2S_WS, I2S_DOUT);
  audio.setVolume(21);  // 0-21

  if(psramInit()) {
    Serial.println("PSRAM initialized!");
  } else {
    Serial.println("PSRAM not available!");
  }

  #if BUZZER_PASSIVE
    ledcSetup(BUZZER_CHANNEL,BUZZER_FREQ,BUZZER_RESOLUTION);
    ledcAttachPin(BUZZER_PIN,BUZZER_CHANNEL);
    ledcWriteTone(BUZZER_CHANNEL,0);
  #else
    pinMode(BUZZER_PIN,OUTPUT); buzzerOff();
  #endif
  pinMode(RELAY_PIN,OUTPUT);
  digitalWrite(RELAY_PIN,RELAY_ACTIVE_LOW?HIGH:LOW);
  pinMode(EMERGENCY_PIN, INPUT_PULLUP);

  loadSettings(); buildTopics(); randomSeed(esp_random());

  // Fingerprint
  FPSerial.setRxBufferSize(1024);
  FPSerial.begin(FP_BAUD,SERIAL_8N1,FP_RX_PIN,FP_TX_PIN);
  finger.begin(FP_BAUD); delay(200);
  if(finger.verifyPassword()){
    fpReady=true; fpUpdateCounts();
    Serial.println("FP OK");
    if(finger.getParameters() == FINGERPRINT_OK){
      Serial.print("  Capacity     : "); Serial.println(finger.capacity);
      Serial.print("  Security Lvl : "); Serial.println(finger.security_level);
      Serial.print("  Baud Rate    : "); Serial.println(finger.baud_rate);
      Serial.print("  System ID    : 0x"); Serial.println(finger.system_id, HEX);
      // Model hint based on capacity
      if     (finger.capacity >= 200) Serial.println("  Model hint   : R503 / R503C (200-slot)");
      else if(finger.capacity >= 162) Serial.println("  Model hint   : AS608 (162-slot)");
      else if(finger.capacity >= 127) Serial.println("  Model hint   : R307 (127-slot)");
      else                            Serial.println("  Model hint   : Unknown clone");
    }
    Serial.print("  Stored now   : "); Serial.println(fpTemplateCount);
  } else Serial.println("FP FAIL");

  // PN532 RFID
  nfc.begin();
  uint32_t nfcVer = nfc.getFirmwareVersion();
  if(nfcVer){
    nfc.SAMConfig();
    rfidReady=true;
    Serial.printf("PN532 OK v%d.%d\n",(nfcVer>>16)&0xFF,(nfcVer>>8)&0xFF);
  } else Serial.println("PN532 FAIL — check IRQ/RST pins");

  setupWiFi();
  if(stationConnected){initSecureClient();mqttConnect();}

  server.on("/",              handleRoot);
  server.on("/login",         handleLogin);
  server.on("/logout",        handleLogout);
  server.on("/manual-unlock", handleManualUnlock);
  server.on("/settings",      handleSettings);
  server.on("/update-baseurl",   handleUpdateBaseURL);
  server.on("/update-duration",  handleUpdateDuration);
  server.on("/update-device-id", handleUpdateDeviceId);
  server.on("/update-wifi",      handleUpdateWiFi);
  server.on("/update-ap-ssid",   handleUpdateApSSID);
  server.on("/update-gym-sub",   handleUpdateGymSub);
  server.on("/mqtt-settings",    handleMqttSettings);
  server.on("/update-mqtt",      handleUpdateMqtt);
  server.on("/clear-settings",   handleClearSettings);
  server.on("/reboot",           handleReboot);
  server.on("/update", HTTP_GET,  handleUpdate);
  server.on("/update", HTTP_POST, handleDoUpdate, handleUpdateUpload);
  server.onNotFound([](){server.sendHeader("Location","/",true);server.send(302,"text/plain","");});
  server.begin();

  displayWelcome(); activateBacklight();
  Serial.println("RFID firmware ready. Device: "+deviceId+" Gym: "+gymSub);

  // Audio runs on Core 0 — uninterrupted by main loop blocking calls
  xTaskCreatePinnedToCore([](void*){ for(;;){ audio.loop(); vTaskDelay(1); } },
    "audioTask", 4096, NULL, 1, NULL, 0);
}

// ═══════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════
void loop(){
  server.handleClient();
  dnsServer.processNextRequest();
  handleBacklight();
  handleDoorTimer();
  handleEmergencyButton();
  enrollTick();
  handleMqttLoop();
  handlePendingMqtt();
  handleRfid();

  // Clear "not registered" display after cooldown
  if(notRegShown && millis()-notRegShowTime > NOT_REG_DISPLAY){
    notRegShown=false;
    displayWelcome();
  }

  // WiFi health check
  if(millis()-lastStationCheck>STATION_CHECK_INTERVAL){
    lastStationCheck=millis();
    if(stationSSID.length()>0){
      bool was=stationConnected;
      stationConnected=(WiFi.status()==WL_CONNECTED);
      if(!stationConnected&&was){Serial.println("WiFi lost, reconnecting...");attemptStationConnection();}
    }
  }

  // Fingerprint scan (paused during enroll/delete/export/import/rfid-enroll + debounce)
  if(fpReady && enrollState==ENROLL_IDLE && !pendingEnroll && !pendingDelete && !pendingExportAll &&
     !pendingImportTemplate && !rfidScanMode && !notRegShown &&
     millis()-lastFingerTime > FINGER_DEBOUNCE){
    int fid=fingerSearchOnce();
    if(fid>=0){
      lastFingerTime=millis();
      processFingerId(fid);
      if(!doorUnlocked) displayWelcome();
    } else if(fid==-2){
      lastFingerTime=millis();
      notRegShown=true;
      notRegShowTime=millis();
      lcd.clear();lcd.setCursor(0,0);lcd.print(" Not Registered");
      lcd.setCursor(0,1);lcd.print(" Try Again...  ");
      activateBacklight(); buzzerBeep(2);
    }
  }
}
