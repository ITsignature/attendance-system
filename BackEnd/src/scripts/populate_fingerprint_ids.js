/**
 * Script to populate fingerprint_id for it-signature client employees
 * Extracts final digits from employee_code (e.g., EMP000008 -> 8, EMP000016 -> 16)
 *
 * Usage: node src/scripts/populate_fingerprint_ids.js
 */

// Load environment variables from BackEnd directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, getDB } = require('../config/database');

/**
 * Extract final digits from employee code
 * EMP000008 -> 8
 * EMP000016 -> 16
 * EMP000001 -> 1
 */
function extractFingerprintId(employeeCode) {
  if (!employeeCode) return null;

  // Remove all non-digit characters, then remove leading zeros
  const digitsOnly = employeeCode.replace(/\D/g, ''); // Remove non-digits
  const withoutLeadingZeros = digitsOnly.replace(/^0+/, ''); // Remove leading zeros

  // If we have a number, return it as integer
  if (withoutLeadingZeros && /^\d+$/.test(withoutLeadingZeros)) {
    return parseInt(withoutLeadingZeros, 10);
  }

  return null;
}

async function populateFingerprintIds() {
  const db = getDB();

  try {
    console.log('🚀 Starting fingerprint_id population...\n');

    // First, let's check what clients exist
    console.log('🔍 Checking available clients...');
    const [clients] = await db.execute('SELECT id, name FROM clients ORDER BY name');
    console.log('Available clients:');
    clients.forEach(c => console.log(`  - ${c.name} (${c.id})`));
    console.log('');

    // Find the it-signature client by ID
    const [clientRows] = await db.execute(
      'SELECT id, name FROM clients WHERE id = ? LIMIT 1',
      ['it-signature']
    );

    if (clientRows.length === 0) {
      console.log('❌ Client with ID "it-signature" not found!');
      console.log('Please verify the exact client ID from the list above.');
      return;
    }

    const client = clientRows[0];
    console.log(`✅ Found client: "${client.name}" (${client.id})\n`);

    // Get all employees for this client
    const [employees] = await db.execute(`
      SELECT
        id,
        employee_code,
        fingerprint_id,
        CONCAT(first_name, ' ', last_name) as full_name,
        employment_status
      FROM employees
      WHERE client_id = ?
        AND employee_code IS NOT NULL
      ORDER BY employee_code
    `, [client.id]);

    console.log(`📊 Found ${employees.length} employees for "${client.name}"\n`);

    if (employees.length === 0) {
      console.log('✅ No employees found to process.');
      return;
    }

    // Show a sample of employee codes
    console.log('Sample employee codes:');
    employees.slice(0, 5).forEach(emp => {
      const extractedId = extractFingerprintId(emp.employee_code);
      console.log(`  ${emp.employee_code} -> ${extractedId} (${emp.full_name})`);
    });
    console.log('');

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('🔄 Processing employees...\n');

    for (const employee of employees) {
      try {
        const fingerprintId = extractFingerprintId(employee.employee_code);

        if (fingerprintId === null) {
          console.log(`⚠️  Skipped ${employee.employee_code} (${employee.full_name}): No digits found`);
          skippedCount++;
          continue;
        }

        // Check if this fingerprint_id already exists for another employee
        const [existing] = await db.execute(
          'SELECT id, employee_code, CONCAT(first_name, " ", last_name) as full_name FROM employees WHERE fingerprint_id = ? AND id != ?',
          [fingerprintId, employee.id]
        );

        if (existing.length > 0) {
          console.log(`⚠️  Conflict: fingerprint_id ${fingerprintId} already used by ${existing[0].full_name} (${existing[0].employee_code})`);
          console.log(`    Cannot assign to ${employee.full_name} (${employee.employee_code})`);
          errorCount++;
          continue;
        }

        // Update the fingerprint_id
        await db.execute(
          'UPDATE employees SET fingerprint_id = ? WHERE id = ?',
          [fingerprintId, employee.id]
        );

        console.log(`✅ ${employee.employee_code} -> ${fingerprintId} (${employee.full_name})`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing ${employee.employee_code} (${employee.full_name}):`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ POPULATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✓ Successfully updated: ${successCount} employees`);
    console.log(`⚠️  Skipped: ${skippedCount} employees (no valid digits)`);
    console.log(`❌ Errors: ${errorCount} employees (conflicts or errors)`);
    console.log('='.repeat(60));

    // Show verification query
    console.log('\n📋 Verification Results:');
    const [results] = await db.execute(`
      SELECT
        employee_code,
        fingerprint_id,
        CONCAT(first_name, ' ', last_name) as employee_name,
        employment_status
      FROM employees
      WHERE client_id = ?
        AND fingerprint_id IS NOT NULL
      ORDER BY fingerprint_id
    `, [client.id]);

    console.log('\nEmployee Code | Fingerprint ID | Employee Name | Status');
    console.log('-'.repeat(70));
    results.forEach(r => {
      const empCode = (r.employee_code || 'N/A').padEnd(13);
      const fpId = String(r.fingerprint_id || 'N/A').padEnd(14);
      const empName = (r.employee_name || 'N/A').padEnd(25);
      const status = r.employment_status || 'N/A';
      console.log(`${empCode} | ${fpId} | ${empName} | ${status}`);
    });

  } catch (error) {
    console.error('\n❌ Fatal error during population:', error);
    throw error;
  }
}

// Initialize database and run the population
async function main() {
  try {
    console.log('🔌 Connecting to database...\n');
    await connectDB();
    console.log('✅ Database connected!\n');

    await populateFingerprintIds();

    console.log('\n✨ Population script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Population script failed:', error);
    process.exit(1);
  }
}

main();
