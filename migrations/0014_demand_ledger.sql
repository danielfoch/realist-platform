-- Demand Ledger V1.
-- Captures the raw natural-language demand Realist otherwise loses:
-- Ask Realist questions/answers and Find Deals search queries. Ask Realist
-- history is intentionally not persisted; only the current turn is stored.

CREATE TABLE IF NOT EXISTS "ask_realist_interactions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text,
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "question" text NOT NULL,
  "answer" text,
  "tool_calls" jsonb,
  "context" jsonb,
  "status" text NOT NULL DEFAULT 'ok',
  "error_message" text,
  "latency_ms" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ask_realist_interactions_created_idx"
  ON "ask_realist_interactions" ("created_at");

CREATE INDEX IF NOT EXISTS "ask_realist_interactions_user_created_idx"
  ON "ask_realist_interactions" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "find_deals_queries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text,
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "raw_query" text NOT NULL,
  "query_hash" varchar(16) NOT NULL,
  "parsed_filters" jsonb,
  "result_count" integer,
  "source" text NOT NULL DEFAULT 'web',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "find_deals_queries_hash_idx"
  ON "find_deals_queries" ("query_hash");

CREATE INDEX IF NOT EXISTS "find_deals_queries_created_idx"
  ON "find_deals_queries" ("created_at");

CREATE INDEX IF NOT EXISTS "find_deals_queries_source_created_idx"
  ON "find_deals_queries" ("source", "created_at");
