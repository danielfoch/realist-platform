-- API keys for the AI agent / MCP plugin (@realist/mcp).
-- Plaintext keys are returned only at creation; only SHA-256 hashes are stored.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       varchar NOT NULL,
  "name"          text NOT NULL,
  "key_prefix"    varchar(16) NOT NULL,
  "key_hash"      text NOT NULL UNIQUE,
  "scopes"        text[] DEFAULT ARRAY[]::text[],
  "last_used_at"  timestamp,
  "revoked_at"    timestamp,
  "created_at"    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");
