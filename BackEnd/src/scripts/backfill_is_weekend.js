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

    // Get all attendance records for specific employees
    const [records] = await db.execute(`
      SELECT id, date
      FROM attendance
      WHERE employee_id IN (
          '0ecb438d-2a08-4bc9-b829-9e6a79a46299',
          '0ff29a84-2567-4011-8a61-f4e279a63646',
          '18ac5a38-8e2c-475d-9a37-b06362956f54',
          '1ab2ee30-a478-471b-ba74-da140f765d32',
          '1d0d3f0f-a6c6-4e3e-ac35-90ac3a17ac58',
          '1f61843a-9177-4760-b684-dc83687412b2',
          '2398cb4b-c463-4230-a7ea-8689819c0b6a',
          '2bc8494f-043d-4f93-b92a-bec53a6b43a0',
          '382f0b31-47c8-4789-b2ab-b4112f7508ef',
          '392e9e6e-890f-4f76-94bc-f1ba6619821d',
          '3f7f3cd8-25e6-4af5-8169-ceb23ca5ef93',
          '417811d3-e43d-4f2f-8b41-cb9a87f9c040',
          '4dcc92fc-57ea-46a6-b4a8-6bb37cebe177',
          '519b5b3b-4888-4f88-ae0e-a3300119a0e3',
          '572411cb-298b-459c-a65e-29875cdd82ea',
          '60a27cc1-545b-45e0-9b32-44be6affd800',
          '67787c0a-08f6-46b8-8a02-b3fc4c2dd59f',
          '67d4df9c-127a-41e5-b34b-9d6668ddf908',
          '7e33fdbc-b28c-4d93-836d-f870987d3715',
          '812e3921-28cb-4a2e-bd5f-5d30afe145df',
          '866ae69a-4834-4ff7-88ad-4b29e642ca26',
          '9b73d5e4-d254-4959-a554-28d2d9dfdb78',
          'aa26baee-fedf-46fe-aa02-6efc15651dd5',
          'c8656065-97e5-44af-b349-5bd249f42058',
          'ca5e8ecc-2ba1-4cd9-ab5e-644a6344eb38',
          'd4ccd0ea-2815-4234-a3ce-5b59352de505',
          'd5066ab6-c4cb-4d92-94d5-4ceb4b70b1bc',
          'e5ef508c-33e9-4292-ad19-347a7f024438',
          'e64333c3-ca92-45bf-9687-7469edabe848',
          'eae6f44a-4c21-4753-b7b4-39d0edf1ca9f',
          'efbaaf1e-62ba-4429-b5a6-4d983cc0bbf6'
        )
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
