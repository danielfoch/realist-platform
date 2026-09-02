-- DDF crawl hardening: run ledger + append-only price/status history.
--
-- ddf_listing_snapshots keeps ONE row per listing per month (unique on
-- listing_key + snapshot_month) and the nightly crawl upserts into it, so a
-- mid-month price cut overwrote the previous price with no trace. Rather than
-- change that grain (dozens of readers select "latest row by captured_at"),
-- ddf_listing_price_history records a row only when a listing is new for the
-- month or its list_price / standard_status changed — small, and it keeps
-- every cut.
--
-- ddf_crawl_runs is the observability ledger: one row per attempt, including
-- 'skipped' rows when a second autoscale instance lost the advisory lock, so
-- /api/ddf-crawl/health can answer "did last night's crawl finish, and was it
-- truncated" without grepping instance logs.
--
-- Mirrors shared/schema.ts ddfListingPriceHistory and ddfCrawlRuns. The
-- crawler also runs ensureDdfCrawlTables() (same DDL) at start so a deploy
-- that lands before this migration is applied still works.

CREATE TABLE IF NOT EXISTS "ddf_listing_price_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_key" varchar NOT NULL,
  "mls_number" varchar,
  "province" text,
  "city" text,
  "list_price" real,
  "standard_status" text,
  "observed_at" timestamp DEFAULT now() NOT NULL,
  "snapshot_month" varchar(7) NOT NULL
);

CREATE INDEX IF NOT EXISTS "ddf_price_history_listing_observed_idx"
  ON "ddf_listing_price_history" ("listing_key", "observed_at" DESC);

CREATE TABLE IF NOT EXISTS "ddf_crawl_runs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "status" text DEFAULT 'running' NOT NULL,
  "trigger" text DEFAULT 'manual' NOT NULL,
  "snapshot_month" varchar(7) NOT NULL,
  "provinces_completed" integer DEFAULT 0 NOT NULL,
  "provinces_total" integer DEFAULT 0 NOT NULL,
  "total_listings" integer DEFAULT 0 NOT NULL,
  "truncated" boolean DEFAULT false NOT NULL,
  "per_province" jsonb,
  "coverage" jsonb,
  "error" text
);

CREATE INDEX IF NOT EXISTS "ddf_crawl_runs_started_at_idx"
  ON "ddf_crawl_runs" ("started_at" DESC);
