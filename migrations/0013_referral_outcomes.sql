-- Referral Outcome Ledger V1.
-- One durable row per realtor lead notification, created after the intro
-- email is sent. Public token routes update only an allowlisted outcome state.

CREATE TABLE IF NOT EXISTS "referral_outcomes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "token" varchar(64) NOT NULL,
  "notification_id" varchar NOT NULL REFERENCES "realtor_lead_notifications"("id"),
  "introduction_id" varchar NOT NULL REFERENCES "realtor_introductions"("id"),
  "realtor_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "realtor_claim_id" varchar NOT NULL REFERENCES "realtor_market_claims"("id"),
  "lead_id" varchar NOT NULL REFERENCES "leads"("id"),
  "analysis_id" varchar REFERENCES "analyses"("id"),
  "crm_deal_id" varchar,
  "status" text NOT NULL DEFAULT 'pending',
  "last_action" text,
  "close_price" numeric(12, 2),
  "gci" numeric(12, 2),
  "referral_fee_percent" real NOT NULL DEFAULT 25,
  "referral_fee_amount" numeric(12, 2),
  "lost_reason" text,
  "notes" text,
  "reported_by" text,
  "reported_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_outcomes_notification_id_idx"
  ON "referral_outcomes" ("notification_id");

CREATE UNIQUE INDEX IF NOT EXISTS "referral_outcomes_token_idx"
  ON "referral_outcomes" ("token");

CREATE INDEX IF NOT EXISTS "referral_outcomes_realtor_status_idx"
  ON "referral_outcomes" ("realtor_user_id", "status");

CREATE INDEX IF NOT EXISTS "referral_outcomes_claim_status_idx"
  ON "referral_outcomes" ("realtor_claim_id", "status");

CREATE INDEX IF NOT EXISTS "referral_outcomes_lead_idx"
  ON "referral_outcomes" ("lead_id");
