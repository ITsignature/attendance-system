# Fingerprint Device Integration Guide

This guide explains how to integrate your existing AS608 fingerprint device with the smart attendance system.

## Overview

**Current Flow:**
```
ESP32 Fingerprint Device → fp.php (Old System) → Old Database
```

**New Flow:**
```
ESP32 Fingerprint Device → fp.php (Old System) → New Smart Attendance System API → New Database
```

## Prerequisites

1. ✅ ESP32 with AS608 fingerprint scanner (already working)
2. ✅ `fp.php` endpoint (already configured in fingerprint device)
3. ✅ New smart attendance system API running

---

## Step 1: Run Database Migration

Add the `fingerprint_id` column to the employees table:

```bash
# Run the migration
mysql -u your_username -p your_database < BackEnd/src/migrations/add_fingerprint_id_to_employees.sql
```

Or manually run this SQL:

```sql
ALTER TABLE employees
ADD COLUMN fingerprint_id INT NULL UNIQUE
COMMENT 'Fingerprint device ID for attendance marking'
AFTER employee_code;

CREATE INDEX idx_employees_fingerprint_id ON employees(fingerprint_id);
```

---

## Step 2: Map Employees to Fingerprint IDs

You need to map each employee in the new system to their fingerprint ID in the device.

### Option A: Update via SQL

```sql
-- Update individual employees
UPDATE employees
SET fingerprint_id = 1
WHERE employee_code = 'EMP001';

UPDATE employees
SET fingerprint_id = 2
WHERE employee_code = 'EMP002';
```

### Option B: Bulk Update via CSV Import

Create a CSV file `fingerprint_mapping.csv`:

```csv
employee_code,fingerprint_id
EMP001,1
EMP002,2
EMP003,3
```

Then import:

```sql
LOAD DATA LOCAL INFILE 'fingerprint_mapping.csv'
INTO TABLE employees
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(employee_code, @fingerprint_id)
SET fingerprint_id = @fingerprint_id;
```

---

## Step 3: Modify `fp.php` to Call New API

Open `BackEnd/src/routes/fp.php` and add this code **after line 116** (after successful attendance marking):

```php
// =============================================
// FORWARD TO NEW SMART ATTENDANCE SYSTEM
// =============================================

// Configuration
$newSystemURL = "http://localhost:3000/api/attendance/fingerprint"; // Change to your API URL
$clientId = null; // Optional: Set your client UUID if you have multiple clients

try {
    // Prepare data for new system
    $postData = json_encode([
        'fingerprint_id' => (int)$employee_id,
        'client_id' => $clientId // Optional
    ]);

    // Initialize cURL
    $ch = curl_init($newSystemURL);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($postData)
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 second timeout
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

    // Execute request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    // Log response for debugging
    error_log("New System Response: HTTP $httpCode - $response");

    // Check if successful
    if ($httpCode >= 200 && $httpCode < 300) {
        $responseData = json_decode($response, true);
        if ($responseData && $responseData['success']) {
            error_log("✅ Attendance synced to new system successfully");
        } else {
            error_log("⚠️  New system returned error: " . ($responseData['message'] ?? 'Unknown error'));
        }
    } else {
        error_log("❌ Failed to sync to new system: HTTP $httpCode");
    }

} catch (Exception $e) {
    // Don't fail the old system if new system sync fails
    error_log("❌ Exception syncing to new system: " . $e->getMessage());
}

// =============================================
// END NEW SYSTEM INTEGRATION
// =============================================
```

### Where to Add the Code

Add the above code at **two locations** in `fp.php`:

1. **After Check-In** (around line 112): After the welcome message
2. **After Check-Out** (around line 68): After the goodbye message

This ensures both check-in and check-out are synced to the new system.

---

## Step 4: Configure API URL

Update the `$newSystemURL` in the code above:

### For Local Development:
```php
$newSystemURL = "http://localhost:3000/api/attendance/fingerprint";
```

### For Production:
```php
$newSystemURL = "https://your-domain.com/api/attendance/fingerprint";
```

### If Backend is on Different Server:
```php
$newSystemURL = "http://192.168.1.100:3000/api/attendance/fingerprint";
```

---

## Step 5: Test the Integration

### 5.1: Test via Direct API Call

```bash
# Test check-in
curl -X POST http://localhost:3000/api/attendance/fingerprint \
  -H "Content-Type: application/json" \
  -d '{"fingerprint_id": 1}'

# Expected response:
{
  "success": true,
  "message": "Welcome John Doe!",
  "status": "success",
  "action": "check_in",
  "data": {
    "employee_name": "John Doe",
    "employee_code": "EMP001",
    "check_in_time": "09:15",
    "date": "2025-10-31"
  }
}

# Test check-out (scan again)
curl -X POST http://localhost:3000/api/attendance/fingerprint \
  -H "Content-Type: application/json" \
  -d '{"fingerprint_id": 1}'

# Expected response:
{
  "success": true,
  "message": "Goodbye John Doe!",
  "status": "success",
  "action": "check_out",
  "data": {
    "employee_name": "John Doe",
    "total_hours": 8.5,
    "overtime_hours": 0.5
  }
}
```

### 5.2: Test via Fingerprint Device

1. Have an employee scan their fingerprint
2. Check the server logs:
   ```bash
   tail -f BackEnd/logs/app.log
   ```
3. Look for:
   ```
   🔐 FINGERPRINT ATTENDANCE - John Doe (EMP001)
      Fingerprint ID: 1
      Date: 2025-10-31
      Time: 09:15
      Action: CHECK-IN
      ✅ Check-in successful at 09:15
   ```

### 5.3: Verify in Database

```sql
-- Check attendance record
SELECT
    a.date,
    a.check_in_time,
    a.check_out_time,
    a.total_hours,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    e.fingerprint_id
FROM attendance a
JOIN employees e ON a.employee_id = e.id
WHERE a.date = CURDATE()
ORDER BY a.check_in_time DESC;
```

---

## API Endpoint Reference

### Endpoint
```
POST /api/attendance/fingerprint
```

### Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "fingerprint_id": 1,        // Required: Integer from fingerprint device
  "client_id": "uuid-here"    // Optional: UUID for multi-client systems
}
```

### Success Response (Check-In)
```json
{
  "success": true,
  "message": "Welcome John Doe!",
  "status": "success",
  "action": "check_in",
  "data": {
    "employee_name": "John Doe",
    "employee_code": "EMP001",
    "check_in_time": "09:15",
    "scheduled_in_time": "09:00",
    "date": "2025-10-31"
  }
}
```

### Success Response (Check-Out)
```json
{
  "success": true,
  "message": "Goodbye John Doe!",
  "status": "success",
  "action": "check_out",
  "data": {
    "employee_name": "John Doe",
    "employee_code": "EMP001",
    "check_in_time": "09:15",
    "check_out_time": "17:30",
    "total_hours": 8.25,
    "overtime_hours": 0.25,
    "arrival_status": "late",
    "work_duration": "full_day",
    "date": "2025-10-31"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Employee not found or inactive. Fingerprint ID: 999",
  "status": "error"
}
```

---

## Troubleshooting

### Issue 1: Employee not found
**Error:** `Employee not found or inactive. Fingerprint ID: X`

**Solution:**
1. Check if employee has `fingerprint_id` set:
   ```sql
   SELECT id, employee_code, fingerprint_id
   FROM employees
   WHERE fingerprint_id = X;
   ```
2. Ensure employee status is 'active':
   ```sql
   UPDATE employees
   SET employment_status = 'active'
   WHERE fingerprint_id = X;
   ```

### Issue 2: Connection refused
**Error:** `Failed to sync to new system: HTTP 0`

**Solution:**
1. Check if API server is running:
   ```bash
   curl http://localhost:3000/health
   ```
2. Verify URL in `fp.php` is correct
3. Check firewall allows connection

### Issue 3: Already checked out
**Error:** `You have already checked out today`

**Solution:**
This is expected behavior. The system prevents multiple check-outs on the same day.

### Issue 4: Check logs
```bash
# API logs
tail -f BackEnd/logs/app.log

# PHP error logs (location varies)
tail -f /var/log/php/error.log
# or
tail -f /var/log/apache2/error.log
```

---

## Features

The fingerprint endpoint automatically:

✅ **Maps fingerprint ID to employee**
✅ **Records check-in/check-out times**
✅ **Calculates work hours and overtime**
✅ **Determines arrival status** (on_time, late)
✅ **Determines work duration** (full_day, half_day, etc.)
✅ **Calculates payable duration** (overlap with scheduled hours)
✅ **Handles weekend working days**
✅ **Applies overtime multipliers** (holidays, weekends)
✅ **Prevents duplicate check-outs**
✅ **Logs all activities** for debugging

---

## Security Notes

1. **No Authentication Required**: The `/fingerprint` endpoint does NOT require JWT authentication since it's called from the fingerprint device.

2. **Access Control**: Ensure only your internal network can access this endpoint. Use firewall rules:
   ```bash
   # Allow only from local network
   iptables -A INPUT -p tcp --dport 3000 -s 192.168.1.0/24 -j ACCEPT
   iptables -A INPUT -p tcp --dport 3000 -j DROP
   ```

3. **Rate Limiting**: Consider adding rate limiting to prevent abuse.

---

## Maintenance

### Updating Fingerprint Mappings

When employees join/leave:

```sql
-- New employee
UPDATE employees
SET fingerprint_id = 10
WHERE employee_code = 'EMP010';

-- Employee left (clear fingerprint)
UPDATE employees
SET fingerprint_id = NULL
WHERE employee_code = 'EMP005';
```

### Bulk Re-sync

If you need to re-sync all attendance data from the old system to new system, create a migration script.

---

## Support

For issues:
1. Check server logs
2. Verify employee mapping
3. Test API endpoint directly
4. Check network connectivity

---

## File Locations

- **Fingerprint Endpoint**: `BackEnd/src/routes/attendanceRoute.js` (lines 16-261)
- **Migration**: `BackEnd/src/migrations/add_fingerprint_id_to_employees.sql`
- **Old PHP File**: `BackEnd/src/routes/fp.php`
- **ESP32 Code**: `BackEnd/src/routes/working_finel_code_fringer_print_esp_32.ino`
