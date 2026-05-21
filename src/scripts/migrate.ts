import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db } from '../db';
import { logger } from '../logger';

dotenv.config();

interface MigrationRow {
  name: string;
}

async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await fs.readdir(migrationsDir);
  return entries
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function run(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
  await ensureMigrationsTable();

  const applied = await db.query<MigrationRow>('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.rows.map((row) => row.name));
  const files = await listMigrationFiles(migrationsDir);

  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.info('Migration already applied', { file });
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, 'utf8');

    logger.info('Applying migration', { file });
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    logger.info('Migration applied', { file });
  }

  logger.info('Migrations complete');
}

run()
  .then(() => db.end())
  .catch(async (error) => {
    logger.error('Migration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await db.end();
    process.exit(1);
  });
