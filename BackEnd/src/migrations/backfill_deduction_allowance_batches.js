/**
 * One-off backfill: groups pre-existing employee_deductions / employee_allowances rows
 * that were created together via the old "loop the single-create endpoint N times" bulk
 * flow into synthetic batches, so they show up and edit as one bulk record going forward.
 *
 * Grouping key: same client_id + all shared fields (type/name/amount/is_percentage/
 * effective_from/effective_to, plus is_recurring+remaining_installments for deductions,
 * is_taxable for allowances) + created within 30 seconds of each other (the old loop fired
 * requests sequentially in a single submit, so siblings land within a couple seconds of
 * each other in practice; 30s gives headroom without merging unrelated same-day entries).
 * Only clusters of 2+ rows become a batch; singletons are left as plain records.
 *
 * Run manually once after applying add_deduction_allowance_batches.sql:
 *   node src/migrations/backfill_deduction_allowance_batches.js
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { connectDB, getDB } = require('../config/database');

const CLUSTER_WINDOW_SECONDS = 30;

async function backfillDeductions(db) {
    const [rows] = await db.execute(`
        SELECT id, client_id, deduction_type, deduction_name, amount, is_percentage,
               is_recurring, remaining_installments, effective_from, effective_to,
               is_active, created_by, created_at
        FROM employee_deductions
        WHERE batch_id IS NULL
        ORDER BY client_id, deduction_type, deduction_name, amount, effective_from, created_at
    `);

    const groups = new Map();
    for (const row of rows) {
        const key = [
            row.client_id, row.deduction_type, row.deduction_name, row.amount,
            row.is_percentage, row.is_recurring, row.remaining_installments,
            row.effective_from, row.effective_to
        ].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    let batchCount = 0;
    let rowCount = 0;

    for (const candidates of groups.values()) {
        candidates.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        let cluster = [];
        const flush = async () => {
            if (cluster.length >= 2) {
                const batchId = uuidv4();
                const first = cluster[0];
                await db.execute(`
                    INSERT INTO employee_deduction_batches (
                        id, client_id, deduction_type, deduction_name, amount, is_percentage,
                        is_recurring, remaining_installments, is_active, effective_from,
                        effective_to, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    batchId, first.client_id, first.deduction_type, first.deduction_name,
                    first.amount, first.is_percentage, first.is_recurring,
                    first.remaining_installments, first.is_active, first.effective_from,
                    first.effective_to, first.created_by, first.created_at
                ]);
                await db.execute(`
                    UPDATE employee_deductions SET batch_id = ? WHERE id IN (${cluster.map(() => '?').join(',')})
                `, [batchId, ...cluster.map(r => r.id)]);
                batchCount++;
                rowCount += cluster.length;
            }
            cluster = [];
        };

        for (const row of candidates) {
            if (cluster.length === 0) {
                cluster.push(row);
                continue;
            }
            const last = cluster[cluster.length - 1];
            const gapSeconds = (new Date(row.created_at) - new Date(last.created_at)) / 1000;
            if (gapSeconds <= CLUSTER_WINDOW_SECONDS) {
                cluster.push(row);
            } else {
                await flush();
                cluster.push(row);
            }
        }
        await flush();
    }

    console.log(`employee_deductions: created ${batchCount} batch(es) covering ${rowCount} row(s)`);
}

async function backfillAllowances(db) {
    const [rows] = await db.execute(`
        SELECT id, client_id, allowance_type, allowance_name, amount, is_percentage,
               is_taxable, effective_from, effective_to, is_active, created_by, created_at
        FROM employee_allowances
        WHERE batch_id IS NULL
        ORDER BY client_id, allowance_type, allowance_name, amount, effective_from, created_at
    `);

    const groups = new Map();
    for (const row of rows) {
        const key = [
            row.client_id, row.allowance_type, row.allowance_name, row.amount,
            row.is_percentage, row.is_taxable, row.effective_from, row.effective_to
        ].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    let batchCount = 0;
    let rowCount = 0;

    for (const candidates of groups.values()) {
        candidates.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        let cluster = [];
        const flush = async () => {
            if (cluster.length >= 2) {
                const batchId = uuidv4();
                const first = cluster[0];
                await db.execute(`
                    INSERT INTO employee_allowance_batches (
                        id, client_id, allowance_type, allowance_name, amount, is_percentage,
                        is_taxable, is_active, effective_from, effective_to, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    batchId, first.client_id, first.allowance_type, first.allowance_name,
                    first.amount, first.is_percentage, first.is_taxable, first.is_active,
                    first.effective_from, first.effective_to, first.created_by, first.created_at
                ]);
                await db.execute(`
                    UPDATE employee_allowances SET batch_id = ? WHERE id IN (${cluster.map(() => '?').join(',')})
                `, [batchId, ...cluster.map(r => r.id)]);
                batchCount++;
                rowCount += cluster.length;
            }
            cluster = [];
        };

        for (const row of candidates) {
            if (cluster.length === 0) {
                cluster.push(row);
                continue;
            }
            const last = cluster[cluster.length - 1];
            const gapSeconds = (new Date(row.created_at) - new Date(last.created_at)) / 1000;
            if (gapSeconds <= CLUSTER_WINDOW_SECONDS) {
                cluster.push(row);
            } else {
                await flush();
                cluster.push(row);
            }
        }
        await flush();
    }

    console.log(`employee_allowances: created ${batchCount} batch(es) covering ${rowCount} row(s)`);
}

async function main() {
    await connectDB();
    const db = getDB();
    await backfillDeductions(db);
    await backfillAllowances(db);
    process.exit(0);
}

main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
