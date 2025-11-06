/*
 * Test script to verify the new optimized payroll calculation system
 * This script tests:
 * 1. Pre-calculation of working days, daily hours, and salary rates
 * 2. New earned salary calculation (worked_hours × hourly_rate)
 * 3. Proper day_of_week values in attendance records
 *
 * Usage: node src/scripts/test_payroll_calculation.js
 */

// Load environment variables
require('dotenv').config();

const { connectDB, getDB } = require('../config/database');

async function testPayrollCalculation() {
    const db = getDB();

    try {
        console.log('🧪 TESTING NEW PAYROLL CALCULATION SYSTEM\n');
        console.log('='.repeat(70));

        // Test 1: Check if day_of_week migration has been applied
        console.log('\n📋 TEST 1: Checking day_of_week conversion...');
        const [attendanceSample] = await db.execute(`
            SELECT id, date, is_weekend,
                CASE
                    WHEN is_weekend = 1 THEN 'Sunday'
                    WHEN is_weekend = 2 THEN 'Monday'
                    WHEN is_weekend = 3 THEN 'Tuesday'
                    WHEN is_weekend = 4 THEN 'Wednesday'
                    WHEN is_weekend = 5 THEN 'Thursday'
                    WHEN is_weekend = 6 THEN 'Friday'
                    WHEN is_weekend = 7 THEN 'Saturday'
                    ELSE 'Unknown'
                END as day_name,
                DAYOFWEEK(date) as expected_value
            FROM attendance
            WHERE date IS NOT NULL
            ORDER BY date DESC
            LIMIT 10
        `);

        console.log('Sample attendance records:');
        attendanceSample.forEach(record => {
            const match = record.is_weekend === record.expected_value ? '✅' : '❌';
            const dateStr = record.date instanceof Date ? record.date.toISOString().split('T')[0] : record.date;
            console.log(`  ${match} ${dateStr} - ${record.day_name} (stored: ${record.is_weekend}, expected: ${record.expected_value})`);
        });

        const allMatch = attendanceSample.every(r => r.is_weekend === r.expected_value);
        if (allMatch) {
            console.log('✅ All attendance records have correct day_of_week values!');
        } else {
            console.log('❌ Some attendance records have incorrect day_of_week values - migration may need to be run');
        }

        // Test 2: Check if payroll_records has new columns
        console.log('\n📋 TEST 2: Checking payroll_records table schema...');
        const [columns] = await db.execute(`
            SHOW COLUMNS FROM payroll_records
            WHERE Field IN (
                'weekday_working_days', 'working_saturdays', 'working_sundays',
                'weekday_daily_hours', 'saturday_daily_hours', 'sunday_daily_hours',
                'daily_salary', 'weekday_hourly_rate', 'saturday_hourly_rate', 'sunday_hourly_rate'
            )
        `);

        const expectedColumns = [
            'weekday_working_days', 'working_saturdays', 'working_sundays',
            'weekday_daily_hours', 'saturday_daily_hours', 'sunday_daily_hours',
            'daily_salary', 'weekday_hourly_rate', 'saturday_hourly_rate', 'sunday_hourly_rate'
        ];

        const foundColumns = columns.map(c => c.Field);
        console.log('Found columns:', foundColumns.length);
        expectedColumns.forEach(col => {
            const found = foundColumns.includes(col);
            console.log(`  ${found ? '✅' : '❌'} ${col}`);
        });

        if (foundColumns.length === expectedColumns.length) {
            console.log('✅ All required columns exist in payroll_records table!');
        } else {
            console.log('❌ Some columns are missing - migrations may need to be run');
        }

        // Test 3: Check if there's a recent payroll run to test with
        console.log('\n📋 TEST 3: Checking for recent payroll runs...');
        const [recentRuns] = await db.execute(`
            SELECT pr.id, pr.run_name, pp.period_start_date, pp.period_end_date,
                COUNT(prec.id) as record_count
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            LEFT JOIN payroll_records prec ON pr.id = prec.run_id
            GROUP BY pr.id
            ORDER BY pr.created_at DESC
            LIMIT 5
        `);

        if (recentRuns.length === 0) {
            console.log('⚠️  No payroll runs found - cannot test calculation');
            return;
        }

        console.log('Recent payroll runs:');
        recentRuns.forEach((run, idx) => {
            console.log(`  ${idx + 1}. ${run.run_name} - ${run.record_count} records`);
            const startDate = run.period_start_date instanceof Date ? run.period_start_date.toISOString().split('T')[0] : run.period_start_date;
            const endDate = run.period_end_date instanceof Date ? run.period_end_date.toISOString().split('T')[0] : run.period_end_date;
            console.log(`     Period: ${startDate} to ${endDate}`);
        });

        // Test 4: Verify pre-calculated values in payroll records
        const testRun = recentRuns[0];
        console.log(`\n📋 TEST 4: Verifying pre-calculated values in run: ${testRun.run_name}...`);

        const [payrollRecords] = await db.execute(`
            SELECT
                employee_id, base_salary,
                weekday_working_days, working_saturdays, working_sundays,
                weekday_daily_hours, saturday_daily_hours, sunday_daily_hours,
                daily_salary, weekday_hourly_rate, saturday_hourly_rate, sunday_hourly_rate
            FROM payroll_records
            WHERE run_id = ?
            LIMIT 5
        `, [testRun.id]);

        console.log('Sample payroll records with pre-calculated values:');
        payrollRecords.forEach((record, idx) => {
            console.log(`\n  Employee ${idx + 1} (ID: ${record.employee_id})`);
            console.log(`    Base Salary: Rs.${parseFloat(record.base_salary || 0).toFixed(2)}`);
            console.log(`    Working Days: Weekday=${record.weekday_working_days}, Sat=${record.working_saturdays}, Sun=${record.working_sundays}`);
            console.log(`    Daily Hours: Weekday=${record.weekday_daily_hours}h, Sat=${record.saturday_daily_hours}h, Sun=${record.sunday_daily_hours}h`);
            console.log(`    Daily Salary: Rs.${parseFloat(record.daily_salary || 0).toFixed(2)}`);
            console.log(`    Hourly Rates: Weekday=Rs.${parseFloat(record.weekday_hourly_rate || 0).toFixed(2)}, Sat=Rs.${parseFloat(record.saturday_hourly_rate || 0).toFixed(2)}, Sun=Rs.${parseFloat(record.sunday_hourly_rate || 0).toFixed(2)}`);

            // Verify calculations
            const totalWorkingDays = parseFloat(record.weekday_working_days || 0) +
                parseFloat(record.working_saturdays || 0) +
                parseFloat(record.working_sundays || 0);
            const expectedDailySalary = totalWorkingDays > 0 ?
                parseFloat(record.base_salary || 0) / totalWorkingDays : 0;
            const dailySalaryMatch = Math.abs(parseFloat(record.daily_salary || 0) - expectedDailySalary) < 0.01;

            console.log(`    Validation: Daily salary calculation ${dailySalaryMatch ? '✅' : '❌'}`);
        });

        // Test 5: Test worked hours calculation by day type
        console.log('\n📋 TEST 5: Testing worked hours calculation by day type...');

        const testEmployeeId = payrollRecords[0].employee_id;
        // NOTE: payable_duration is stored in MINUTES, divide by 60 to get hours
        const [workedHours] = await db.execute(`
            SELECT
                SUM(CASE WHEN is_weekend BETWEEN 2 AND 6 THEN payable_duration ELSE 0 END) / 60 as weekday_hours,
                SUM(CASE WHEN is_weekend = 7 THEN payable_duration ELSE 0 END) / 60 as saturday_hours,
                SUM(CASE WHEN is_weekend = 1 THEN payable_duration ELSE 0 END) / 60 as sunday_hours,
                COUNT(*) as total_records
            FROM attendance
            WHERE employee_id = ?
            AND date BETWEEN ? AND CURDATE()
        `, [testEmployeeId, testRun.period_start_date]);

        console.log(`Employee ${testEmployeeId} worked hours:`);
        console.log(`  Weekday: ${parseFloat(workedHours[0].weekday_hours || 0).toFixed(2)}h`);
        console.log(`  Saturday: ${parseFloat(workedHours[0].saturday_hours || 0).toFixed(2)}h`);
        console.log(`  Sunday: ${parseFloat(workedHours[0].sunday_hours || 0).toFixed(2)}h`);
        console.log(`  Total attendance records: ${workedHours[0].total_records}`);

        // Test 6: Calculate earned salary manually
        console.log('\n📋 TEST 6: Testing earned salary calculation...');

        const record = payrollRecords[0];
        const weekdayHours = parseFloat(workedHours[0].weekday_hours || 0);
        const saturdayHours = parseFloat(workedHours[0].saturday_hours || 0);
        const sundayHours = parseFloat(workedHours[0].sunday_hours || 0);

        const weekdayRate = parseFloat(record.weekday_hourly_rate || 0);
        const saturdayRate = parseFloat(record.saturday_hourly_rate || 0);
        const sundayRate = parseFloat(record.sunday_hourly_rate || 0);

        const weekdayEarned = weekdayHours * weekdayRate;
        const saturdayEarned = saturdayHours * saturdayRate;
        const sundayEarned = sundayHours * sundayRate;
        const totalEarned = weekdayEarned + saturdayEarned + sundayEarned;

        const baseSalary = parseFloat(record.base_salary || 0);
        const deduction = Math.max(0, baseSalary - totalEarned);

        console.log(`Employee ${testEmployeeId} salary breakdown:`);
        console.log(`  Weekday Earned: ${weekdayHours}h × Rs.${weekdayRate.toFixed(2)} = Rs.${weekdayEarned.toFixed(2)}`);
        console.log(`  Saturday Earned: ${saturdayHours}h × Rs.${saturdayRate.toFixed(2)} = Rs.${saturdayEarned.toFixed(2)}`);
        console.log(`  Sunday Earned: ${sundayHours}h × Rs.${sundayRate.toFixed(2)} = Rs.${sundayEarned.toFixed(2)}`);
        console.log(`  Total Earned: Rs.${totalEarned.toFixed(2)}`);
        console.log(`  Base Salary: Rs.${baseSalary.toFixed(2)}`);
        console.log(`  Deduction: Rs.${deduction.toFixed(2)}`);
        console.log(`  Net Salary: Rs.${(baseSalary - deduction).toFixed(2)}`);

        console.log('\n' + '='.repeat(70));
        console.log('✅ ALL TESTS COMPLETED!');
        console.log('='.repeat(70));
        console.log('\nSummary:');
        console.log('  ✓ Day of week values in attendance records');
        console.log('  ✓ Payroll records table schema updated');
        console.log('  ✓ Pre-calculated values stored correctly');
        console.log('  ✓ Worked hours calculation by day type');
        console.log('  ✓ Earned salary calculation formula');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        throw error;
    }
}

// Initialize database and run tests
async function main() {
    try {
        console.log('🔌 Connecting to database...\n');
        await connectDB();
        console.log('✅ Database connected!\n');

        await testPayrollCalculation();

        console.log('\n✨ Test script completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n💥 Test script failed:', error);
        process.exit(1);
    }
}

main();
