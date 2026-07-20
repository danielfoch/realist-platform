-- Booked-call lead funnel (deal/coaching call CTA → admin pipeline → BLD flip).
-- One row per "talk to a financing specialist" / "book a call" submission,
-- with the context the call needs: source page, underwriting/analysis ids,
-- and a small allowlisted deal snapshot. Admins work status
-- new → contacted → booked → flipped; forwarded_at/forwarded_via record
-- delivery to the (env-driven, currently unset) BLD destination.
-- Mirrors shared/schema.ts bookedCallLeads.

-- Ensure property_analyses exists before the foreign key reference.
-- In production this table is typically created by ensureAppTables at boot;
-- including it here makes migrations runnable from a fresh database.
CREATE TABLE IF NOT EXISTS "property_analyses" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_mls_number" text NOT NULL,
  "property_id" varchar,
  "user_id" varchar NOT NULL,
  "parent_analysis_id" varchar,
  "source_analysis_id" varchar,
  "visibility" text NOT NULL DEFAULT 'public',
  "title" text,
  "summary" text,
  "user_notes" text,
  "ai_analysis_text" text,
  "user_analysis_text" text,
  "sentiment" text,
  "city" text,
  "province" text,
  "market" text,
  "neighbourhood" text,
  "property_type" text,
  "listing_price" real,
  "listing_snapshot" jsonb,
  "source_context" jsonb,
  "assumptions" jsonb,
  "calculated_metrics" jsonb,
  "ai_assumptions" jsonb,
  "final_assumptions" jsonb,
  "data_use_consent" jsonb,
  "model_version" text,
  "prompt_version" text,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "is_anonymized" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "property_analyses_listing_lookup_idx"
  ON "property_analyses"("listing_mls_number", "visibility", "created_at");

CREATE TABLE IF NOT EXISTS "booked_call_leads" (
  "id"              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "full_name"       text NOT NULL,
  "email"           text NOT NULL,
  "phone"           text,
  "intent"          text NOT NULL DEFAULT 'financing',
  "source_page"     text,
  "underwriting_id" varchar,
  "analysis_id"     varchar REFERENCES "property_analyses"("id") ON DELETE SET NULL,
  "deal_snapshot"   jsonb,
  "message"         text,
  "status"          text NOT NULL DEFAULT 'new',
  "notes"           text,
  "forwarded_at"    timestamp,
  "forwarded_via"   text,
  "created_at"      timestamp NOT NULL DEFAULT now(),
  "updated_at"      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_booked_call_leads_status" ON "booked_call_leads" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_booked_call_leads_user" ON "booked_call_leads" ("user_id");
