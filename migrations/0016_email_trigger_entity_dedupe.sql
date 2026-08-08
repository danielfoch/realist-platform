-- Permanent entity-level idempotency for incident-style email triggers.
--
-- The SLA sweep runs every five minutes. Its old partial index only blocked a
-- duplicate while the prior row was pending; once the worker marked it sent,
-- the same opportunity could enqueue again forever. A nullable stable key
-- preserves existing history and gives SLA alerts once-per-opportunity
-- semantics across sent rows, process restarts, and autoscaled instances.

ALTER TABLE "email_triggers"
  ADD COLUMN IF NOT EXISTS "dedupe_key" text;

-- Production already contains repeated SLA history from the incident. Keep it
-- intact for audit and assign the permanent key only to the newest row for each
-- opportunity, so the unique index can be introduced without deleting data.
WITH latest_sla AS (
  SELECT DISTINCT ON (opportunity_id) id, opportunity_id
  FROM email_triggers source
  WHERE source.trigger_type = 'sla_breach_nag'
    AND source.opportunity_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM email_triggers claimed
      WHERE claimed.opportunity_id = source.opportunity_id
        AND claimed.dedupe_key IS NOT NULL
    )
  ORDER BY source.opportunity_id, source.created_at DESC, source.id DESC
)
UPDATE email_triggers t
SET dedupe_key = 'email_trigger:sla_breach_nag:opportunity:' || latest_sla.opportunity_id
FROM latest_sla
WHERE t.id = latest_sla.id
  AND t.dedupe_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_triggers_dedupe_key"
  ON "email_triggers" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
