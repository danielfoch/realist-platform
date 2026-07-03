-- Booked-call lead funnel (deal/coaching call CTA → admin pipeline → BLD flip).
-- One row per "talk to a financing specialist" / "book a call" submission,
-- with the context the call needs: source page, underwriting/analysis ids,
-- and a small allowlisted deal snapshot. Admins work status
-- new → contacted → booked → flipped; forwarded_at/forwarded_via record
-- delivery to the (env-driven, currently unset) BLD destination.
-- Mirrors shared/schema.ts bookedCallLeads.

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
