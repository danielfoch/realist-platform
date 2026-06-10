import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(rootDir, 'db', 'migrations');
const outputPath = path.join(rootDir, 'schema.sql');

async function main() {
  const entries = await fs.readdir(migrationsDir);
  const migrationFiles = entries
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const sections = await Promise.all(
    migrationFiles.map(async (file) => {
      const fullPath = path.join(migrationsDir, file);
      const sql = (await fs.readFile(fullPath, 'utf8')).trim();
      return `-- ============================================\n-- ${file}\n-- ============================================\n\n${sql}`;
    }),
  );

  const output = [
    '-- GENERATED FILE: do not edit schema.sql directly.',
    '-- Source of truth: db/migrations/*.sql',
    '-- Regenerate with: npm run sync:schema',
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');

  await fs.writeFile(outputPath, output, 'utf8');
  console.log(`Wrote ${path.relative(rootDir, outputPath)} from ${migrationFiles.length} migrations.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
