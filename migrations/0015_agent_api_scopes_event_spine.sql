-- Agent API hardening: enforce scoped keys, consent-stamped structured usage
-- summaries, and richer A2A/event-spine attribution.

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "usage_payload_consent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "usage_payload_policy_version" text;

UPDATE "api_keys"
SET
  "scopes" = ARRAY['read','underwrite','deal:submit']::text[]
WHERE "scopes" IS NULL OR cardinality("scopes") = 0;

ALTER TABLE "api_keys"
  ALTER COLUMN "scopes" SET DEFAULT ARRAY['read','underwrite','deal:submit']::text[];

ALTER TABLE "api_usage_events"
  ADD COLUMN IF NOT EXISTS "input_summary" jsonb,
  ADD COLUMN IF NOT EXISTS "input_summary_policy_version" text;

ALTER TABLE "find_deals_queries"
  ADD COLUMN IF NOT EXISTS "api_key_id" varchar,
  ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'web' NOT NULL;

ALTER TABLE "ask_realist_interactions"
  ADD COLUMN IF NOT EXISTS "api_key_id" varchar,
  ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'ask_realist' NOT NULL;

ALTER TABLE "user_activity_events"
  ADD COLUMN IF NOT EXISTS "api_key_id" varchar,
  ADD COLUMN IF NOT EXISTS "partner_id" varchar,
  ADD COLUMN IF NOT EXISTS "notification_id" varchar,
  ADD COLUMN IF NOT EXISTS "channel" text;

CREATE INDEX IF NOT EXISTS "user_activity_events_channel_created_idx"
  ON "user_activity_events" ("channel", "created_at");

CREATE INDEX IF NOT EXISTS "user_activity_events_api_key_created_idx"
  ON "user_activity_events" ("api_key_id", "created_at");

CREATE INDEX IF NOT EXISTS "user_activity_events_partner_created_idx"
  ON "user_activity_events" ("partner_id", "created_at");

CREATE INDEX IF NOT EXISTS "find_deals_queries_api_key_created_idx"
  ON "find_deals_queries" ("api_key_id", "created_at");

CREATE INDEX IF NOT EXISTS "ask_realist_interactions_api_key_created_idx"
  ON "ask_realist_interactions" ("api_key_id", "created_at");
