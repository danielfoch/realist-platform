-- Deal Desk Loop v1
-- Adds deals, opportunities, email_triggers tables.
-- Adds consentSms to leads, makes phone nullable.
-- Adds dealId and source to user_activity_events.

ALTER TABLE "leads" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "consent_sms" boolean DEFAULT false;

ALTER TABLE "user_activity_events" ADD COLUMN IF NOT EXISTS "deal_id" varchar;
ALTER TABLE "user_activity_events" ADD COLUMN IF NOT EXISTS "source" text;

CREATE TABLE IF NOT EXISTS "deals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" varchar REFERENCES "leads"("id"),
  "user_id" varchar REFERENCES "users"("id"),
  "analysis_id" varchar REFERENCES "analyses"("id"),
  "address" text NOT NULL,
  "listing_url" text,
  "market" text,
  "property_type" text,
  "purchase_price" real,
  "estimated_rent" real,
  "cap_rate" real,
  "cash_flow" real,
  "target_return_hit" boolean DEFAULT false,
  "report_url" text,
  "financing_help_wanted" boolean DEFAULT false,
  "buying_help_wanted" boolean DEFAULT false,
  "user_notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "opportunities" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" varchar REFERENCES "leads"("id"),
  "user_id" varchar REFERENCES "users"("id"),
  "deal_id" varchar REFERENCES "deals"("id"),
  "intent_score" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'new',
  "assigned_to" text,
  "suggested_next_action" text NOT NULL,
  "source" text NOT NULL DEFAULT 'deal_desk',
  "lost_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_triggers" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" varchar REFERENCES "leads"("id"),
  "user_id" varchar REFERENCES "users"("id"),
  "opportunity_id" varchar REFERENCES "opportunities"("id"),
  "trigger_type" text NOT NULL,
  "payload" jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "opportunities_status_idx" ON "opportunities" ("status");
CREATE INDEX IF NOT EXISTS "opportunities_lead_id_idx" ON "opportunities" ("lead_id");
CREATE INDEX IF NOT EXISTS "email_triggers_status_idx" ON "email_triggers" ("status");
CREATE INDEX IF NOT EXISTS "email_triggers_opportunity_id_idx" ON "email_triggers" ("opportunity_id");
