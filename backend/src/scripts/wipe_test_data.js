/**
 * ONE-TIME DATA WIPE — run before handing system to client.
 *
 * KEEPS:  super_admin / admin users, drivers, vehicles, route_prices
 * DELETES: all trips, all agents, all clients, all ledger entries, all notifications
 *
 * Usage:
 *   cd backend
 *   DATABASE_URL="your-railway-url" node src/scripts/wipe_test_data.js
 *   -- or --
 *   node src/scripts/wipe_test_data.js          (uses .env DATABASE_URL)
 */

require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function count(table, where = '') {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM ${table}${where ? ' WHERE ' + where : ''}`);
  return parseInt(rows[0].count, 10);
}

async function main() {
  console.log('\n=== R TRANSPORT — TEST DATA WIPE ===\n');

  // Preview what will be deleted
  const [trips, agents, clients, ledger, clientLedger, notifs] = await Promise.all([
    count('trips'),
    count('users', "role = 'agent'"),
    count('clients'),
    count('ledger_transactions'),
    count('client_ledger_transactions'),
    count('notifications'),
  ]);

  const [vehicles, drivers, admins] = await Promise.all([
    count('vehicles'),
    count('drivers'),
    count('users', "role IN ('super_admin','admin')"),
  ]);

  console.log('Will DELETE:');
  console.log(`  • ${trips} trips`);
  console.log(`  • ${agents} agent accounts`);
  console.log(`  • ${clients} clients`);
  console.log(`  • ${ledger} agent ledger transactions`);
  console.log(`  • ${clientLedger} client ledger transactions`);
  console.log(`  • ${notifs} notifications`);
  console.log('\nWill KEEP:');
  console.log(`  • ${vehicles} vehicles`);
  console.log(`  • ${drivers} drivers`);
  console.log(`  • ${admins} admin/super_admin accounts`);
  console.log(`  • All route_prices (system config)\n`);

  // Confirm
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question('Type YES to proceed with wipe: ', (answer) => {
      rl.close();
      if (answer.trim() !== 'YES') {
        console.log('Aborted.');
        process.exit(0);
      }
      resolve();
    });
  });

  console.log('\nWiping...');

  await pool.query('BEGIN');
  try {
    // Delete in FK-safe order
    const r1 = await pool.query('DELETE FROM ledger_transactions');
    console.log(`  ✓ Deleted ${r1.rowCount} agent ledger entries`);

    const r2 = await pool.query('DELETE FROM client_ledger_transactions');
    console.log(`  ✓ Deleted ${r2.rowCount} client ledger entries`);

    const r3 = await pool.query('DELETE FROM notifications');
    console.log(`  ✓ Deleted ${r3.rowCount} notifications`);

    const r4 = await pool.query('DELETE FROM trips');
    console.log(`  ✓ Deleted ${r4.rowCount} trips`);

    const r5 = await pool.query('DELETE FROM clients');
    console.log(`  ✓ Deleted ${r5.rowCount} clients`);

    const r6 = await pool.query("DELETE FROM users WHERE role = 'agent'");
    console.log(`  ✓ Deleted ${r6.rowCount} agent accounts`);

    await pool.query('COMMIT');
    console.log('\n✅ Wipe complete. System is ready for live environment.\n');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('\n❌ Wipe failed — rolled back. Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
