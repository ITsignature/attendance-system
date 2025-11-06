/*
 * Backfill script to populate is_weekend for existing attendance records
 * This script should be run once after adding the is_weekend column
 *
 * Usage: node src/scripts/backfill_is_weekend.js
 */

// Load environment variables from BackEnd directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, getDB } = require('../config/database');

async function backfillIsWeekend() {
  const db = getDB();

  try {
    console.log('🚀 Starting is_weekend backfill...\n');

    // Get all attendance records
    const [records] = await db.execute(`
      SELECT id, date
      FROM attendance
      WHERE date >= '2025-10-20'
        AND date <= '2025-11-06'
      ORDER BY date DESC
    `);

    console.log(`📊 Found ${records.length} attendance records to process\n`);

    if (records.length === 0) {
      console.log('✅ No records to backfill. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)...`);

      for (const record of batch) {
        try {
          const recordDate = new Date(record.date);
          const jsDayOfWeek = recordDate.getDay(); // JavaScript: 0=Sunday, 1=Monday, ... 6=Saturday
          // Convert to MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ... 7=Saturday
          const dayOfWeekValue = jsDayOfWeek === 0 ? 1 : jsDayOfWeek + 1;

          await db.execute(
            'UPDATE attendance SET is_weekend = ? WHERE id = ?',
            [dayOfWeekValue, record.id]
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

    await backfillIsWeekend();

    console.log('\n✨ Backfill script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Backfill script failed:', error);
    process.exit(1);
  }
}

main();
