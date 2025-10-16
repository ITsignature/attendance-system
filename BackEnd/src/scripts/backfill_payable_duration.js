/**
 * Backfill script to calculate and populate payable_duration for existing attendance records
 * This script should be run once after adding the payable_duration column
 *
 * Usage: node src/scripts/backfill_payable_duration.js
 */

// Load environment variables
require('dotenv').config();

const { connectDB, getDB } = require('../config/database');

/**
 * Calculate payable duration based on overlap between scheduled and actual hours
 */
function calculatePayableDuration(checkInTime, checkOutTime, scheduledInTime, scheduledOutTime, breakDuration = 0) {
  // Normalize all times to HH:MM:SS format
  const normalizeToFullTime = (t) => {
    if (!t) return null;
    const timeStr = String(t);
    const [h = '', m = '', s = '00'] = timeStr.split(':');
    const HH = h.padStart(2, '0');
    const MM = m.padStart(2, '0');
    const SS = s.padStart(2, '0');
    return /^\d\d:\d\d:\d\d$/.test(`${HH}:${MM}:${SS}`) ? `${HH}:${MM}:${SS}` : null;
  };

  const checkIn = normalizeToFullTime(checkInTime);
  const checkOut = normalizeToFullTime(checkOutTime);
  const schedIn = normalizeToFullTime(scheduledInTime);
  const schedOut = normalizeToFullTime(scheduledOutTime);

  // If any required time is missing, return null
  if (!checkIn || !checkOut || !schedIn || !schedOut) {
    return null;
  }

  // Convert to Date objects for calculation
  const actualIn = new Date(`2000-01-01T${checkIn}`);
  const actualOut = new Date(`2000-01-01T${checkOut}`);
  const scheduledIn = new Date(`2000-01-01T${schedIn}`);
  const scheduledOut = new Date(`2000-01-01T${schedOut}`);

  // Validate dates
  if (isNaN(actualIn) || isNaN(actualOut) || isNaN(scheduledIn) || isNaN(scheduledOut)) {
    return null;
  }

  // Calculate overlap between scheduled and actual times
  const overlapStart = actualIn > scheduledIn ? actualIn : scheduledIn;
  const overlapEnd = actualOut < scheduledOut ? actualOut : scheduledOut;

  // If no overlap, payable is 0
  if (overlapEnd <= overlapStart) {
    return 0;
  }

  // Calculate overlap hours
  const overlapMs = overlapEnd - overlapStart;
  const overlapHours = overlapMs / 3600000; // ms to hours

  // Subtract break duration
  const payableDuration = Math.max(0, overlapHours - (breakDuration || 0));

  return parseFloat(payableDuration.toFixed(3));
}

async function backfillPayableDuration() {
  const db = getDB();

  try {
    console.log('🚀 Starting payable_duration backfill...\n');

    // Get all attendance records that need backfilling
    // Note: We recalculate ALL records to ensure 3 decimal precision
    const [records] = await db.execute(`
      SELECT
        id,
        check_in_time,
        check_out_time,
        scheduled_in_time,
        scheduled_out_time,
        break_duration,
        date
      FROM attendance
      WHERE check_in_time IS NOT NULL
        AND check_out_time IS NOT NULL
        AND scheduled_in_time IS NOT NULL
        AND scheduled_out_time IS NOT NULL
      ORDER BY date DESC
    `);

    console.log(`📊 Found ${records.length} attendance records to backfill\n`);

    if (records.length === 0) {
      console.log('✅ No records need backfilling. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)...`);

      for (const record of batch) {
        try {
          const payableDuration = calculatePayableDuration(
            record.check_in_time,
            record.check_out_time,
            record.scheduled_in_time,
            record.scheduled_out_time,
            record.break_duration || 0
          );

          if (payableDuration === null) {
            console.log(`⚠️  Skipped ${record.date}: Missing or invalid time data`);
            skippedCount++;
            continue;
          }

          await db.execute(
            'UPDATE attendance SET payable_duration = ? WHERE id = ?',
            [payableDuration, record.id]
          );

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
    console.log(`✓ Successfully updated: ${successCount} records`);
    console.log(`⚠️  Skipped: ${skippedCount} records (missing data)`);
    console.log(`❌ Errors: ${errorCount} records`);
    console.log('='.repeat(60));

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

    await backfillPayableDuration();

    console.log('\n✨ Backfill script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Backfill script failed:', error);
    process.exit(1);
  }
}

main();
