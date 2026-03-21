import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("[db-normalize] Checking installed extensions...");

    const extResult = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname = 'postgis'"
    );
    const hasPostgis = extResult.rows.length > 0;

    if (hasPostgis) {
      const geomResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE udt_name IN ('geometry', 'geography')
          AND table_schema = 'public'
      `);
      const geomCount = parseInt(geomResult.rows[0].count, 10);

      if (geomCount === 0) {
        console.log(
          "[db-normalize] PostGIS is installed but no geometry/geography columns found. Dropping PostGIS..."
        );
        await pool.query("DROP EXTENSION IF EXISTS postgis CASCADE;");
        console.log("[db-normalize] PostGIS dropped successfully.");
      } else {
        console.log(
          `[db-normalize] PostGIS is installed and ${geomCount} geometry/geography column(s) found. Keeping PostGIS.`
        );
      }
    } else {
      console.log("[db-normalize] PostGIS is not installed. Nothing to do.");
    }

    console.log("[db-normalize] Ensuring cube and earthdistance extensions...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS cube;");
    await pool.query("CREATE EXTENSION IF NOT EXISTS earthdistance;");
    console.log("[db-normalize] Extensions normalized successfully.");
  } catch (err) {
    console.error("[db-normalize] Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
