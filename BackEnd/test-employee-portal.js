/**
 * Employee Portal Test Script
 *
 * This script tests all employee portal endpoints to ensure they work correctly.
 *
 * Usage:
 *   1. Start the backend server: npm start
 *   2. Run this test: node test-employee-portal.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api/employee-portal`;

// Test credentials (update these with actual employee credentials)
const EMPLOYEE_EMAIL = 'employee@company.com';
const EMPLOYEE_PASSWORD = 'employee_password';

let authToken = '';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test 1: Employee Login
async function testLogin() {
  log('\n========================================', 'cyan');
  log('TEST 1: Employee Login', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMPLOYEE_EMAIL,
      password: EMPLOYEE_PASSWORD
    });

    if (response.data.success && response.data.data.accessToken) {
      authToken = response.data.data.accessToken;
      logSuccess(`Login successful for ${response.data.data.user.name}`);
      logInfo(`Role: ${response.data.data.user.roleName}`);
      return true;
    } else {
      logError('Login failed: No token received');
      return false;
    }
  } catch (error) {
    logError(`Login failed: ${error.response?.data?.message || error.message}`);
    logWarning('Make sure you have created an employee user account first!');
    return false;
  }
}

// Test 2: Get Employee Profile
async function testGetProfile() {
  log('\n========================================', 'cyan');
  log('TEST 2: Get Employee Profile', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      const employee = response.data.data.employee;
      logSuccess('Profile retrieved successfully');
      logInfo(`Name: ${employee.first_name} ${employee.last_name}`);
      logInfo(`Email: ${employee.email}`);
      logInfo(`Department: ${employee.department_name}`);
      logInfo(`Designation: ${employee.designation_title}`);
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 3: Get Attendance Records
async function testGetAttendance() {
  log('\n========================================', 'cyan');
  log('TEST 3: Get Attendance Records', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/attendance`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { limit: 10 }
    });

    if (response.data.success) {
      const { attendance, summary } = response.data.data;
      logSuccess(`Retrieved ${attendance.length} attendance records`);
      logInfo(`Present: ${summary.present_days}, Absent: ${summary.absent_days}, Late: ${summary.late_days}`);
      logInfo(`Average hours: ${summary.avg_hours?.toFixed(2) || 0}`);
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 4: Get Payroll History
async function testGetPayrollHistory() {
  log('\n========================================', 'cyan');
  log('TEST 4: Get Payroll History', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/payroll/history`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { limit: 5 }
    });

    if (response.data.success) {
      const { history, statistics } = response.data.data;
      logSuccess(`Retrieved ${history.length} payroll records`);
      if (statistics.total_records > 0) {
        logInfo(`Average salary: $${statistics.average_salary?.toFixed(2) || 0}`);
        logInfo(`Total earned: $${statistics.total_earned?.toFixed(2) || 0}`);
      } else {
        logWarning('No payroll records found');
      }
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 5: Get Leave Types
async function testGetLeaveTypes() {
  log('\n========================================', 'cyan');
  log('TEST 5: Get Leave Types', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/leaves/types`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      const leaveTypes = response.data.data;
      logSuccess(`Retrieved ${leaveTypes.length} leave types`);
      leaveTypes.forEach(type => {
        logInfo(`- ${type.name}: ${type.max_days_per_year} days/year (${type.is_paid ? 'Paid' : 'Unpaid'})`);
      });
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 6: Get Leave Balance
async function testGetLeaveBalance() {
  log('\n========================================', 'cyan');
  log('TEST 6: Get Leave Balance', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/leaves/balance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      const { year, balances } = response.data.data;
      logSuccess(`Leave balance for year ${year}`);
      balances.forEach(balance => {
        logInfo(`- ${balance.leave_type_name}: ${balance.days_remaining}/${balance.max_days} days remaining`);
      });
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 7: Get My Leave Requests
async function testGetMyLeaveRequests() {
  log('\n========================================', 'cyan');
  log('TEST 7: Get My Leave Requests', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/leaves/my-requests`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      const leaves = response.data.data;
      logSuccess(`Retrieved ${leaves.length} leave requests`);
      leaves.forEach(leave => {
        logInfo(`- ${leave.leave_type_name}: ${leave.start_date} to ${leave.end_date} (${leave.status})`);
      });
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 8: Get Financial Records
async function testGetFinancialRecords() {
  log('\n========================================', 'cyan');
  log('TEST 8: Get Financial Records', 'cyan');
  log('========================================', 'cyan');

  try {
    const response = await axios.get(`${API_URL}/financial-records`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      const { data, summary } = response.data;
      logSuccess(`Retrieved ${data.length} financial records`);
      logInfo(`Loans: ${summary.loans}, Advances: ${summary.advances}, Bonuses: ${summary.bonuses}`);
      return true;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// Test 9: Test Read-Only Protection (should fail)
async function testReadOnlyProtection() {
  log('\n========================================', 'cyan');
  log('TEST 9: Read-Only Protection', 'cyan');
  log('========================================', 'cyan');

  try {
    // Try to edit profile (should fail)
    await axios.put(`${BASE_URL}/api/employees/some-id`, {
      first_name: 'Hacked'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    logError('Read-only protection FAILED - employee was able to edit data!');
    return false;
  } catch (error) {
    if (error.response?.status === 403) {
      logSuccess('Read-only protection working - edit attempt blocked');
      return true;
    } else {
      logWarning(`Unexpected error: ${error.response?.status} - ${error.response?.data?.message}`);
      return false;
    }
  }
}

// Test 10: Test Data Isolation (should fail)
async function testDataIsolation() {
  log('\n========================================', 'cyan');
  log('TEST 10: Data Isolation', 'cyan');
  log('========================================', 'cyan');

  try {
    // Try to access all employees (should fail or only return own data)
    const response = await axios.get(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      // Check if only one employee is returned (own data)
      const employees = response.data.data?.employees || [];
      if (employees.length === 1) {
        logSuccess('Data isolation working - only own data returned');
        return true;
      } else {
        logError(`Data isolation FAILED - got ${employees.length} employees instead of 1`);
        return false;
      }
    }
  } catch (error) {
    if (error.response?.status === 403) {
      logSuccess('Data isolation working - access to employee list blocked');
      return true;
    } else {
      logWarning(`Unexpected error: ${error.response?.status} - ${error.response?.data?.message}`);
      return false;
    }
  }
}

// Run all tests
async function runAllTests() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║  EMPLOYEE PORTAL TEST SUITE           ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Login first
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    logError('\n❌ Login failed - cannot continue tests');
    logWarning('\nPlease ensure:');
    logWarning('1. Backend server is running (npm start)');
    logWarning('2. Employee user account is created');
    logWarning('3. Database setup script has been run');
    logWarning('4. Credentials in this file are correct\n');
    process.exit(1);
  }

  // Run all tests
  const tests = [
    { name: 'Get Profile', fn: testGetProfile },
    { name: 'Get Attendance', fn: testGetAttendance },
    { name: 'Get Payroll History', fn: testGetPayrollHistory },
    { name: 'Get Leave Types', fn: testGetLeaveTypes },
    { name: 'Get Leave Balance', fn: testGetLeaveBalance },
    { name: 'Get My Leave Requests', fn: testGetMyLeaveRequests },
    { name: 'Get Financial Records', fn: testGetFinancialRecords },
    { name: 'Read-Only Protection', fn: testReadOnlyProtection },
    { name: 'Data Isolation', fn: testDataIsolation }
  ];

  for (const test of tests) {
    results.total++;
    const passed = await test.fn();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║  TEST SUMMARY                          ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  log(`\nTotal Tests: ${results.total}`);
  logSuccess(`Passed: ${results.passed}`);
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  }
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);

  if (results.failed === 0) {
    logSuccess('🎉 All tests passed! Employee portal is working correctly.\n');
  } else {
    logWarning('⚠️  Some tests failed. Please review the output above.\n');
  }
}

// Run the tests
runAllTests().catch(error => {
  logError(`\nUnexpected error: ${error.message}\n`);
  process.exit(1);
});
