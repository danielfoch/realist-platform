-- Usage metering for bearer-authenticated agent/API calls (@realist/mcp, /api/agent/*).
-- One row per request. Inputs are never stored — only a truncated SHA-256 hash
-- for forensic correlation. Powers rate-limit audits, the account usage
-- dashboard, and (later) Stripe metered billing.
CREATE TABLE IF NOT EXISTS "api_usage_events" (
  "id"          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "api_key_id"  varchar NOT NULL,
  "user_id"     varchar NOT NULL,
  "method"      varchar(8) NOT NULL,
  "endpoint"    text NOT NULL,
  "status"      integer NOT NULL,
  "latency_ms"  integer NOT NULL,
  "input_hash"  varchar(16),
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "api_usage_events_key_created_idx" ON "api_usage_events" ("api_key_id", "created_at");
CREATE INDEX IF NOT EXISTS "api_usage_events_user_created_idx" ON "api_usage_events" ("user_id", "created_at");
