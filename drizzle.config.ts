import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Tables that live in the prod database but are NOT managed by this schema.
  // Without these exclusions `drizzle-kit push` proposes dropping them:
  //  - spatial_ref_sys: PostGIS system table (~8500 rows)
  //  - schema_migrations: legacy idx-app migration ledger
  //  - listings_partitioned*: legacy idx-app partitioned listing tables
  // NOTE: `deals` is intentionally NOT filtered — it is declared in
  // shared/schema.ts (Clyde's Deal Desk shape, which prod was pushed from).
  tablesFilter: ["!spatial_ref_sys", "!schema_migrations", "!listings_partitioned*"],
});
