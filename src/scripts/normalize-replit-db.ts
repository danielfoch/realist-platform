import dotenv from 'dotenv';
import { db } from '../db';

dotenv.config();

type ExtensionRow = {
  extname: string;
  extversion: string;
};

type GeometryColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  udt_name: string;
};

function isTruthy(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function listExtensions(): Promise<ExtensionRow[]> {
  const result = await db.query<ExtensionRow>(
    'SELECT extname, extversion FROM pg_extension ORDER BY extname',
  );
  return result.rows;
}

async function ensureRequiredExtensions(): Promise<void> {
  await db.query('CREATE EXTENSION IF NOT EXISTS cube');
  await db.query('CREATE EXTENSION IF NOT EXISTS earthdistance');
}

async function findSpatialColumns(): Promise<GeometryColumnRow[]> {
  const result = await db.query<GeometryColumnRow>(`
    SELECT table_schema, table_name, column_name, udt_name
    FROM information_schema.columns
    WHERE udt_name IN ('geometry', 'geography')
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, column_name
  `);

  return result.rows;
}

async function main() {
  console.log('[db:normalize] ensuring required extensions');
  await ensureRequiredExtensions();

  const extensions = await listExtensions();
  const names = extensions.map((row) => row.extname);

  console.log('[db:normalize] installed extensions:', names.join(', '));

  if (!names.includes('postgis')) {
    console.log('[db:normalize] postgis not installed; nothing to clean up');
    return;
  }

  const spatialColumns = await findSpatialColumns();
  if (spatialColumns.length > 0) {
    console.log('[db:normalize] found geometry/geography columns; refusing to drop postgis');
    for (const column of spatialColumns) {
      console.log(
        `- ${column.table_schema}.${column.table_name}.${column.column_name} (${column.udt_name})`,
      );
    }
    console.log(
      '[db:normalize] If PostGIS is truly required for this app, do not use Replit schema copy/deploy until dev and prod extension versions match.',
    );
    return;
  }

  const runningOnReplit = Boolean(process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT);
  const allowDrop = isTruthy(
    process.env.ALLOW_DROP_UNUSED_POSTGIS,
    runningOnReplit,
  );

  if (!allowDrop) {
    console.log('[db:normalize] postgis is installed but auto-drop is disabled');
    console.log('[db:normalize] To remove it, rerun with ALLOW_DROP_UNUSED_POSTGIS=true');
    return;
  }

  console.log('[db:normalize] dropping unused postgis extension');
  await db.query('DROP EXTENSION IF EXISTS postgis CASCADE');
  console.log('[db:normalize] postgis removed successfully');
}

main()
  .catch((error) => {
    console.error('[db:normalize] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.end();
  });
