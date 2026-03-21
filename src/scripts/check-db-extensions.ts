import dotenv from 'dotenv';
import { db } from '../db';

dotenv.config();

type ExtensionRow = {
  extname: string;
  extversion: string;
};

async function main() {
  const result = await db.query<ExtensionRow>(
    `SELECT extname, extversion FROM pg_extension ORDER BY extname`,
  );

  const names = result.rows.map((row) => row.extname);

  console.log('Installed extensions:');
  for (const row of result.rows) {
    console.log(`- ${row.extname} (${row.extversion})`);
  }

  console.log('');

  const hasRequired = names.includes('cube') && names.includes('earthdistance');
  if (!hasRequired) {
    console.log('Missing required extensions for geo distance queries.');
    console.log('Expected: cube, earthdistance');
  } else {
    console.log('Required extensions are present: cube, earthdistance');
  }

  if (names.includes('postgis')) {
    console.log('');
    console.log('Warning: postgis is installed.');
    console.log(
      'This app does not use PostGIS tables/types directly. Replit deploy schema diffing may try to migrate extension-owned tables like spatial_ref_sys and fail.',
    );
    console.log('Recommended: remove PostGIS from the Replit development database if you are not actively using it.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.end();
  });
