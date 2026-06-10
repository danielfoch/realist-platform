-- Replit publish fix:
-- Remove an unused PostGIS extension from the development database so
-- Replit stops generating invalid migrations for extension-owned tables
-- like spatial_ref_sys.
--
-- Safe behavior:
-- - refuses to run if any geometry/geography columns exist
-- - ensures cube + earthdistance remain installed

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE udt_name IN ('geometry', 'geography')
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
  ) THEN
    RAISE EXCEPTION
      'PostGIS is still in use by one or more geometry/geography columns. Aborting drop.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'postgis'
  ) THEN
    DROP EXTENSION postgis CASCADE;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

SELECT extname, extversion
FROM pg_extension
ORDER BY extname;
