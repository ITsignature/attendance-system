// Test script for employee weekend settings functionality
const { SettingsHelper } = require('../utils/settingsHelper');
const { connectDB, getDB } = require('../config/database');

async function testEmployeeWeekendSettings() {
  console.log('Testing Employee Weekend Settings Implementation...\n');

  try {
    // Initialize database connection
    await connectDB();
    const db = getDB();

    // Get a test client and employee
    const [clients] = await db.execute('SELECT id FROM clients LIMIT 1');
    if (clients.length === 0) {
      console.log('❌ No clients found in database');
      return;
    }

    const clientId = clients[0].id;
    console.log(`Using client ID: ${clientId}`);

    const [employees] = await db.execute('SELECT id, first_name, last_name FROM employees WHERE client_id = ? LIMIT 1', [clientId]);
    if (employees.length === 0) {
      console.log('❌ No employees found for this client');
      return;
    }

    const employeeId = employees[0].id;
    const employeeName = `${employees[0].first_name} ${employees[0].last_name}`;
    console.log(`Using employee: ${employeeName} (${employeeId})\n`);

    const settingsHelper = new SettingsHelper(clientId);

    // Test 1: Check initial state (should use company settings)
    console.log('Test 1: Initial employee weekend settings');
    const initialSettings = await settingsHelper.getEmployeeWeekendSettings(employeeId);
    console.log('Employee settings:', initialSettings);
    console.log(initialSettings === null ? '✅ Using company defaults' : '⚠️ Has custom settings');

    // Test 2: Get company settings for comparison
    console.log('\nTest 2: Company weekend settings');
    const companySettings = await settingsHelper.getWeekendSettings();
    console.log('Company settings:', JSON.stringify(companySettings, null, 2));

    // Test 3: Test weekend working day check with company settings
    console.log('\nTest 3: Weekend working day checks (company settings)');
    for (let day = 0; day <= 6; day++) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const isWorking = await settingsHelper.isWeekendWorkingDay(day, employeeId);
      console.log(`${dayNames[day]} (${day}): ${isWorking ? 'Working' : 'Not working'}`);
    }

    // Test 4: Set employee-specific weekend settings
    console.log('\nTest 4: Setting employee-specific weekend settings');
    const customSettings = {
      saturday_working: true,
      sunday_working: false,
      custom_weekend_days: [3] // Wednesday as custom weekend
    };

    await settingsHelper.setEmployeeWeekendSettings(employeeId, customSettings);
    console.log('✅ Custom settings applied');

    // Test 5: Verify employee settings were saved
    console.log('\nTest 5: Verifying custom settings');
    const savedSettings = await settingsHelper.getEmployeeWeekendSettings(employeeId);
    console.log('Saved settings:', JSON.stringify(savedSettings, null, 2));
    console.log(JSON.stringify(savedSettings) === JSON.stringify(customSettings) ? '✅ Settings match' : '❌ Settings mismatch');

    // Test 6: Test weekend working day check with employee settings
    console.log('\nTest 6: Weekend working day checks (employee override)');
    for (let day = 0; day <= 6; day++) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const isWorking = await settingsHelper.isWeekendWorkingDay(day, employeeId);
      console.log(`${dayNames[day]} (${day}): ${isWorking ? 'Working' : 'Not working'}`);
    }

    // Test 7: Test specific scenarios
    console.log('\nTest 7: Specific scenario tests');
    const saturdayWorking = await settingsHelper.isWeekendWorkingDay(6, employeeId); // Saturday
    const sundayWorking = await settingsHelper.isWeekendWorkingDay(0, employeeId); // Sunday
    const wednesdayWorking = await settingsHelper.isWeekendWorkingDay(3, employeeId); // Wednesday
    const mondayWorking = await settingsHelper.isWeekendWorkingDay(1, employeeId); // Monday

    console.log(`Saturday working: ${saturdayWorking} (expected: true) ${saturdayWorking === true ? '✅' : '❌'}`);
    console.log(`Sunday working: ${sundayWorking} (expected: false) ${sundayWorking === false ? '✅' : '❌'}`);
    console.log(`Wednesday working: ${wednesdayWorking} (expected: true) ${wednesdayWorking === true ? '✅' : '❌'}`);
    console.log(`Monday working: ${mondayWorking} (expected: true) ${mondayWorking === true ? '✅' : '❌'}`);

    // Test 8: Reset to company default
    console.log('\nTest 8: Resetting to company default');
    await settingsHelper.setEmployeeWeekendSettings(employeeId, null);
    const resetSettings = await settingsHelper.getEmployeeWeekendSettings(employeeId);
    console.log('Reset settings:', resetSettings);
    console.log(resetSettings === null ? '✅ Successfully reset to company default' : '❌ Failed to reset');

    // Test 9: Verify fallback to company settings
    console.log('\nTest 9: Verifying fallback to company settings');
    const saturdayAfterReset = await settingsHelper.isWeekendWorkingDay(6, employeeId);
    const saturdayCompany = await settingsHelper.isWeekendWorkingDay(6); // Without employee ID
    console.log(`Saturday (employee): ${saturdayAfterReset}, Saturday (company): ${saturdayCompany}`);
    console.log(saturdayAfterReset === saturdayCompany ? '✅ Fallback working correctly' : '❌ Fallback not working');

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testEmployeeWeekendSettings().then(() => {
    console.log('\nTest execution finished');
    process.exit(0);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testEmployeeWeekendSettings };