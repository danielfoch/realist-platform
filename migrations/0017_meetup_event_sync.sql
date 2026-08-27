CREATE TABLE IF NOT EXISTS "user_integrations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(30) NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token" text,
  "token_expires_at" timestamp,
  "scope" text,
  "external_email" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_integrations_user_provider"
  ON "user_integrations" ("user_id", "provider");

ALTER TABLE "realist_events"
  ADD COLUMN IF NOT EXISTS "external_source" text,
  ADD COLUMN IF NOT EXISTS "external_event_id" text,
  ADD COLUMN IF NOT EXISTS "external_url" text,
  ADD COLUMN IF NOT EXISTS "external_group_urlname" text,
  ADD COLUMN IF NOT EXISTS "external_group_name" text,
  ADD COLUMN IF NOT EXISTS "external_rsvp_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_realist_events_external_source_id"
  ON "realist_events" ("external_source", "external_event_id");
