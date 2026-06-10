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

/**
 * These SQL migrations belong to the idx app's schema. The live production
 * database is owned by Drizzle (shared/schema.ts via `npm run db:push`) and
 * has a differently-shaped users table — running idx migrations there would
 * try to ALTER live tables. Detect that and refuse.
 */
async function assertNotDrizzleDatabase(): Promise<void> {
  const result = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users' AND column_name IN ('tier', 'role')`,
  );
  const columns = new Set(result.rows.map((r) => r.column_name));
  // idx users has tier; the live Drizzle users has role but no tier
  if (columns.has('role') && !columns.has('tier')) {
    logger.error(
      'Refusing to run: this database is managed by Drizzle (live app). ' +
        'Use `npm run db:push` for schema changes. db/migrations/*.sql only ' +
        'apply to a dedicated idx-app database.',
    );
    process.exit(1);
  }
}

async function run(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
  await assertNotDrizzleDatabase();
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
