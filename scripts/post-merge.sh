#!/bin/bash
set -e

# Install dependencies (non-interactive)
npm install --no-fund --no-audit

# Apply any pending migrations via raw SQL.
# drizzle-kit push is interactive (prompts TTY) and not suitable for CI.
# Each migration uses IF NOT EXISTS so re-running is always safe.
node --input-type=module << 'MIGRATE_EOF'
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrationsDir = './migrations';
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  try {
    await pool.query(sql);
    console.log('  OK:', file);
  } catch (err) {
    // Codes: 42701 = column exists, 42P07 = relation exists, 42710 = object exists
    if (['42701', '42P07', '42710'].includes(err.code)) {
      console.log('  SKIP (already applied):', file);
    } else {
      console.error('  FAIL:', file, err.message);
      process.exit(1);
    }
  }
}

await pool.end();
console.log('All migrations done.');
MIGRATE_EOF
