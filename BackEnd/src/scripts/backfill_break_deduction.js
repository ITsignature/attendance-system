/*
 * Backfill script to recalculate payable_duration with break deduction for existing attendance records
 * This script should be run once after implementing the client-specific break duration feature
 *
 * Usage: node src/scripts/backfill_break_deduction.js
 */

// Load environment variables from BackEnd directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, getDB } = require('../config/database');

/**
 * Get client's break duration setting in hours
 */
async function getClientBreakDuration(clientId, db) {
  const [settings] = await db.execute(`
    SELECT setting_value FROM system_settings
    WHERE client_id = ? AND setting_key = 'break_duration_hours'
  `, [clientId]);

  if (settings.length > 0) {
    return parseFloat(JSON.parse(settings[0].setting_value)) || 0;
  }
  return 0;
}

/**
 * Calculate payable duration (mirrors logic from attendanceRoute.js calculatePayableDuration)
 */
function calculatePayableDurationSync(checkInTime, checkOutTime, scheduledInTime, scheduledOutTime, breakDuration = 0, payableHoursPolicy = 'strict_schedule') {
  // Normalize time to HH:MM:SS
  const normalizeToFullTime = (t) => {
    if (!t) return null;
    const [h = '', m = '', s = '00'] = t.split(':');
    const HH = h.padStart(2, '0');
    const MM = m.padStart(2, '0');
    const SS = s.padStart(2, '0');
    return /^\d\d:\d\d:\d\d$/.test(`${HH}:${MM}:${SS}`) ? `${HH}:${MM}:${SS}` : null;
  };

  const checkIn = normalizeToFullTime(checkInTime);
  const checkOut = normalizeToFullTime(checkOutTime);
  const schedIn = normalizeToFullTime(scheduledInTime);
  const schedOut = normalizeToFullTime(scheduledOutTime);

  // If scheduled times are NULL (volunteer work), don't calculate payable duration
  if (!scheduledInTime || !scheduledOutTime || !checkIn || !checkOut || !schedIn || !schedOut) {
    return null;
  }

  // Convert to Date objects
  const actualIn = new Date(`2000-01-01T${checkIn}`);
  const actualOut = new Date(`2000-01-01T${checkOut}`);
  const scheduledIn = new Date(`2000-01-01T${schedIn}`);
  const scheduledOut = new Date(`2000-01-01T${schedOut}`);

  // Validate dates
  if (isNaN(actualIn) || isNaN(actualOut) || isNaN(scheduledIn) || isNaN(scheduledOut)) {
    return null;
  }

  let payableDurationSeconds;

  if (payableHoursPolicy === 'actual_worked') {
    // POLICY: actual_worked - pay based on total time worked, capped at scheduled duration
    const workedSeconds = Math.round((actualOut - actualIn) / 1000);
    const scheduledSeconds = Math.round((scheduledOut - scheduledIn) / 1000);
    payableDurationSeconds = workedSeconds >= scheduledSeconds ? scheduledSeconds : workedSeconds;
  } else {
    // POLICY: strict_schedule (default) - pay only the overlap with scheduled window
    const overlapStart = actualIn > scheduledIn ? actualIn : scheduledIn;
    const overlapEnd = actualOut < scheduledOut ? actualOut : scheduledOut;

    if (overlapEnd <= overlapStart) {
      payableDurationSeconds = 0;
    } else {
      payableDurationSeconds = Math.round((overlapEnd - overlapStart) / 1000);
    }
  }

  // Subtract break duration (convert break from hours to seconds)
  const breakSeconds = Math.round((breakDuration || 0) * 60 * 60);
  payableDurationSeconds = Math.max(0, payableDurationSeconds - breakSeconds);

  return payableDurationSeconds; // Return as INTEGER seconds
}

async function backfillBreakDeduction() {
  const db = getDB();

  try {
    console.log('🚀 Starting break deduction backfill...\n');

    // Get all attendance records that have check_out_time (completed shifts)
    const [records] = await db.execute(`
      SELECT
        a.id,
        a.employee_id,
        a.date,
        a.check_in_time,
        a.check_out_time,
        a.scheduled_in_time,
        a.scheduled_out_time,
        a.payable_duration as current_payable_duration,
        e.client_id,
        COALESCE(e.payable_hours_policy, 'strict_schedule') as payable_hours_policy
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.check_out_time IS NOT NULL
        AND a.scheduled_in_time IS NOT NULL
        AND a.scheduled_out_time IS NOT NULL
      ORDER BY a.date DESC, e.client_id
    `);

    console.log(`📊 Found ${records.length} attendance records to process\n`);

    if (records.length === 0) {
      console.log('✅ No records to backfill. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    // Group records by client to minimize break duration lookups
    const clientBreakCache = new Map();

    // Process in batches
    const BATCH_SIZE = 100;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)...`);

      for (const record of batch) {
        try {
          // Get client break duration (use cache)
          if (!clientBreakCache.has(record.client_id)) {
            const breakDuration = await getClientBreakDuration(record.client_id, db);
            clientBreakCache.set(record.client_id, breakDuration);
          }

          const breakDuration = clientBreakCache.get(record.client_id);

          // If no break duration for this client, skip
          if (breakDuration === 0) {
            skippedCount++;
            continue;
          }

          // Recalculate payable duration with break deduction
          const newPayableDuration = calculatePayableDurationSync(
            record.check_in_time,
            record.check_out_time,
            record.scheduled_in_time,
            record.scheduled_out_time,
            breakDuration,
            record.payable_hours_policy
          );

          // Only update if the value changed
          if (newPayableDuration !== null && newPayableDuration !== record.current_payable_duration) {
            await db.execute(
              'UPDATE attendance SET payable_duration = ? WHERE id = ?',
              [newPayableDuration, record.id]
            );
            updatedCount++;
          } else {
            skippedCount++;
          }

          successCount++;
        } catch (error) {
          console.error(`❌ Error processing record ${record.id} (${record.date}):`, error.message);
          errorCount++;
        }
      }

      // Progress indicator
      const processed = Math.min(i + BATCH_SIZE, records.length);
      const progress = ((processed / records.length) * 100).toFixed(1);
      console.log(`📊 Progress: ${processed}/${records.length} (${progress}%)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ BACKFILL COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✓ Successfully processed: ${successCount} records`);
    console.log(`✓ Actually updated: ${updatedCount} records`);
    console.log(`⊘ Skipped (no break or same value): ${skippedCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);
    console.log('='.repeat(60));

    // Show which clients had break durations
    console.log('\n📋 Client Break Durations:');
    for (const [clientId, breakDuration] of clientBreakCache) {
      console.log(`   ${clientId}: ${breakDuration} hours`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error);
    throw error;
  }
}

// Initialize database and run the backfill
async function main() {
  try {
    console.log('🔌 Connecting to database...\n');
    await connectDB();
    console.log('✅ Database connected!\n');

    await backfillBreakDeduction();

    console.log('\n✨ Backfill script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Backfill script failed:', error);
    process.exit(1);
  }
}

main();
