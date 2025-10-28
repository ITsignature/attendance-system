#!/bin/bash

# =============================================
# PAYROLL API TESTING COMMANDS
# =============================================

# Set your base URL and token
BASE_URL="http://localhost:5000/api"
AUTH_TOKEN="YOUR_TOKEN_HERE"

# Replace these with actual IDs from your database
EMPLOYEE_ID="9fd7caa5-1ae8-4d92-89a9-1f2cc5c8374b"
PAYROLL_RECORD_ID="REPLACE_WITH_ACTUAL_ID"
DEPARTMENT_ID="449ed028-6381-11f0-855d-98e743540430"

# =============================================
# 1. GET ALL PAYROLL RECORDS
# =============================================

echo "=== GET All Payroll Records ==="
curl -X GET "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Payroll Records with Filters ==="
curl -X GET "${BASE_URL}/payroll?month=6&year=2024&status=pending&limit=10&offset=0" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Payroll Records by Department ==="
curl -X GET "${BASE_URL}/payroll?department_id=${DEPARTMENT_ID}&month=6&year=2024" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Payroll Records by Employee ==="
curl -X GET "${BASE_URL}/payroll?employee_id=${EMPLOYEE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Payroll Records by Payment Method ==="
curl -X GET "${BASE_URL}/payroll?payment_method=bank_transfer&status=paid" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 2. GET SINGLE PAYROLL RECORD
# =============================================

echo -e "\n\n=== GET Single Payroll Record ==="
curl -X GET "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 3. CREATE PAYROLL RECORD
# =============================================

echo -e "\n\n=== CREATE Payroll Record (Basic) ==="
curl -X POST "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "'${EMPLOYEE_ID}'",
    "pay_period_start": "2024-07-01",
    "pay_period_end": "2024-07-31",
    "base_salary": 75000,
    "allowances": 12000,
    "overtime_amount": 3500,
    "bonus": 5000,
    "tax_deduction": 14250,
    "provident_fund": 7500,
    "insurance": 2000,
    "other_deductions": 500,
    "payment_method": "bank_transfer",
    "notes": "July 2024 salary"
  }'

echo -e "\n\n=== CREATE Payroll Record (With Payment Info) ==="
curl -X POST "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "'${EMPLOYEE_ID}'",
    "pay_period_start": "2024-08-01",
    "pay_period_end": "2024-08-31",
    "base_salary": 75000,
    "allowances": 12000,
    "overtime_amount": 4200,
    "bonus": 8000,
    "commission": 3000,
    "tax_deduction": 15300,
    "provident_fund": 7500,
    "insurance": 2000,
    "loan_deduction": 5000,
    "other_deductions": 0,
    "payment_method": "bank_transfer",
    "payment_date": "2024-08-31",
    "payment_reference": "TXN-2024-08-001",
    "notes": "August 2024 salary with performance bonus"
  }'

# =============================================
# 4. UPDATE PAYROLL RECORD
# =============================================

echo -e "\n\n=== UPDATE Payroll Record ==="
curl -X PUT "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "base_salary": 80000,
    "allowances": 13000,
    "overtime_amount": 5000,
    "bonus": 10000,
    "tax_deduction": 16200,
    "provident_fund": 8000,
    "insurance": 2500,
    "notes": "Updated with annual increment"
  }'

# =============================================
# 5. UPDATE PAYMENT STATUS
# =============================================

echo -e "\n\n=== UPDATE Payment Status to Processing ==="
curl -X PATCH "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}/payment-status" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_status": "processing"
  }'

echo -e "\n\n=== UPDATE Payment Status to Paid ==="
curl -X PATCH "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}/payment-status" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_status": "paid",
    "payment_date": "2024-06-30",
    "payment_reference": "BANK-TXN-123456"
  }'

echo -e "\n\n=== UPDATE Payment Status to Failed ==="
curl -X PATCH "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}/payment-status" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_status": "failed",
    "payment_reference": "FAILED-TXN-789"
  }'

# =============================================
# 6. BULK PROCESS PAYROLL
# =============================================

echo -e "\n\n=== BULK Process - All Active Employees ==="
curl -X POST "${BASE_URL}/payroll/bulk-process" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pay_period_start": "2024-09-01",
    "pay_period_end": "2024-09-30",
    "auto_calculate_overtime": true,
    "default_allowances": 10000,
    "default_bonus": 5000,
    "tax_rate": 0.15,
    "provident_fund_rate": 0.08,
    "insurance_amount": 2000
  }'

echo -e "\n\n=== BULK Process - By Department ==="
curl -X POST "${BASE_URL}/payroll/bulk-process" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pay_period_start": "2024-10-01",
    "pay_period_end": "2024-10-31",
    "department_id": "'${DEPARTMENT_ID}'",
    "auto_calculate_overtime": true,
    "default_allowances": 12000,
    "default_bonus": 0,
    "tax_rate": 0.18,
    "provident_fund_rate": 0.08,
    "insurance_amount": 2500
  }'

echo -e "\n\n=== BULK Process - Specific Employees ==="
curl -X POST "${BASE_URL}/payroll/bulk-process" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pay_period_start": "2024-11-01",
    "pay_period_end": "2024-11-30",
    "employee_ids": ["'${EMPLOYEE_ID}'"],
    "auto_calculate_overtime": false,
    "default_allowances": 15000,
    "default_bonus": 20000,
    "tax_rate": 0.20,
    "provident_fund_rate": 0.10,
    "insurance_amount": 3000
  }'

# =============================================
# 7. GET PAYROLL SUMMARY
# =============================================

echo -e "\n\n=== GET Payroll Summary for June 2024 ==="
curl -X GET "${BASE_URL}/payroll/summary/2024-06" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Payroll Summary for Current Month ==="
CURRENT_MONTH=$(date +%Y-%m)
curl -X GET "${BASE_URL}/payroll/summary/${CURRENT_MONTH}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 8. GENERATE PAYSLIP
# =============================================

echo -e "\n\n=== GET Payslip for Record ==="
curl -X GET "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}/payslip" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 9. GET EMPLOYEE PAYROLL HISTORY
# =============================================

echo -e "\n\n=== GET Employee Payroll History ==="
curl -X GET "${BASE_URL}/payroll/employee/${EMPLOYEE_ID}/history" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Employee Payroll History with Pagination ==="
curl -X GET "${BASE_URL}/payroll/employee/${EMPLOYEE_ID}/history?limit=5&offset=0" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 10. EXPORT PAYROLL DATA
# =============================================

echo -e "\n\n=== EXPORT Payroll Data as JSON ==="
curl -X GET "${BASE_URL}/payroll/export/json?month=6&year=2024" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== EXPORT Payroll Data as CSV ==="
curl -X GET "${BASE_URL}/payroll/export/csv?month=6&year=2024" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -o "payroll_export_2024_06.csv"
echo "CSV file saved as payroll_export_2024_06.csv"

echo -e "\n\n=== EXPORT Filtered Payroll Data ==="
curl -X GET "${BASE_URL}/payroll/export/json?month=6&year=2024&department_id=${DEPARTMENT_ID}&status=paid" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 11. DELETE PAYROLL RECORD
# =============================================

echo -e "\n\n=== DELETE Payroll Record ==="
curl -X DELETE "${BASE_URL}/payroll/${PAYROLL_RECORD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 12. ADVANCED QUERIES
# =============================================

echo -e "\n\n=== GET Payroll with Sorting ==="
curl -X GET "${BASE_URL}/payroll?sort_by=net_salary&sort_order=DESC&limit=5" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Pending Payments ==="
curl -X GET "${BASE_URL}/payroll?status=pending&month=6&year=2024" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n=== GET Failed Payments ==="
curl -X GET "${BASE_URL}/payroll?status=failed" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# =============================================
# 13. ERROR TESTING
# =============================================

echo -e "\n\n=== TEST: Invalid Employee ID ==="
curl -X POST "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "invalid-uuid",
    "pay_period_start": "2024-06-01",
    "pay_period_end": "2024-06-30",
    "base_salary": 50000
  }'

echo -e "\n\n=== TEST: Invalid Date Range ==="
curl -X POST "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "'${EMPLOYEE_ID}'",
    "pay_period_start": "2024-06-30",
    "pay_period_end": "2024-06-01",
    "base_salary": 50000
  }'

echo -e "\n\n=== TEST: Negative Salary ==="
curl -X POST "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "'${EMPLOYEE_ID}'",
    "pay_period_start": "2024-06-01",
    "pay_period_end": "2024-06-30",
    "base_salary": -5000
  }'

echo -e "\n\n=== TEST: Duplicate Payroll Record ==="
# Try to create the same payroll record twice
curl -X POST "${BASE_URL}/payroll" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "'${EMPLOYEE_ID}'",
    "pay_period_start": "2024-06-01",
    "pay_period_end": "2024-06-30",
    "base_salary": 75000
  }'

# =============================================
# HELPER FUNCTIONS FOR TESTING
# =============================================

# Function to get auth token (if you have a login endpoint)
get_auth_token() {
  echo -e "\n\n=== Getting Auth Token ==="
  response=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@example.com",
      "password": "your_password"
    }')
  
  # Extract token from response (adjust based on your API response format)
  token=$(echo $response | grep -oP '"accessToken"\s*:\s*"\K[^"]+')
  echo "Token: $token"
}

# Function to create test employee
create_test_employee() {
  echo -e "\n\n=== Creating Test Employee ==="
  curl -X POST "${BASE_URL}/employees" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "first_name": "Test",
      "last_name": "Employee",
      "email": "test.employee@example.com",
      "employee_code": "EMP-TEST-001",
      "department_id": "'${DEPARTMENT_ID}'",
      "base_salary": 50000,
      "hire_date": "2024-01-01",
      "employment_status": "active"
    }'
}

# =============================================
# BATCH TESTING SCRIPT
# =============================================

run_all_tests() {
  echo "================================"
  echo "RUNNING ALL PAYROLL API TESTS"
  echo "================================"
  
  # You can uncomment and run specific tests
  # get_auth_token
  # create_test_employee
  
  echo "Tests completed!"
}

# Uncomment to run all tests
# run_all_tests