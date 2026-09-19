-- Agent API spine (P0): first-class Job for specialist work.
-- Intent → specialist → result → optional human approval.
-- Mirrors shared/schema.ts agentJobs. server/agentJobs.ts also runs
-- ensureAgentJobs() at boot / first request so a deploy that lands before
-- this migration is applied still works.

CREATE TABLE IF NOT EXISTS "agent_jobs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "input" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "result" jsonb,
  "error" text,
  "specialist_id" text,
  "created_by_user_id" varchar NOT NULL,
  "created_by_api_key_id" varchar,
  "approval_required" boolean NOT NULL DEFAULT false,
  "approved_at" timestamp,
  "approved_by_user_id" varchar,
  "idempotency_key" text,
  "audit_trail" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_agent_jobs_user_created"
  ON "agent_jobs" ("created_by_user_id", "created_at");

-- Multiple jobs without a key are allowed (NULL ≠ NULL). Replay is per user.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_agent_jobs_user_idempotency"
  ON "agent_jobs" ("created_by_user_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
