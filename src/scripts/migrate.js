const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const runMigrations = async () => {
  try {
    console.log('[Migration] Starting database migration...');
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(sql);
    console.log('[Migration] Schema migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigrations();
