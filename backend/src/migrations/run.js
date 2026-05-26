require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const files = ['001_create_tables.sql', '002_updates.sql', '003_reprice_flag.sql', '004_notifications.sql', '005_trip_extras.sql', '006_agent_id_nullable.sql', '007_driver_vehicle_link.sql', '008_bulk_import_vehicles_drivers.sql', '009_not_complete_status.sql', '010_clients_route_prices.sql', '011_ledger_tables.sql'];
  try {
    for (const file of files) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        await pool.query(sql);
        console.log(`✓ ${file}`);
      }
    }
    console.log('All migrations completed');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
