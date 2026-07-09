ALTER TABLE "realist_event_speakers"
  ADD COLUMN IF NOT EXISTS "expert_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "realist_event_speakers"
  ADD COLUMN IF NOT EXISTS "expert_profile_slug" text;

CREATE INDEX IF NOT EXISTS "realist_event_speakers_expert_user_id_idx"
  ON "realist_event_speakers" ("expert_user_id");

CREATE INDEX IF NOT EXISTS "realist_event_speakers_expert_profile_slug_idx"
  ON "realist_event_speakers" ("expert_profile_slug");
