CREATE TABLE IF NOT EXISTS podcast_episode_enrichments (
  episode_slug text PRIMARY KEY,
  clip_id text,
  episode_title text NOT NULL,
  episode_published_at timestamp,
  transcript_source_kind text NOT NULL,
  transcript_source_url text,
  transcript_sha256 text NOT NULL,
  transcript_text text NOT NULL,
  status text NOT NULL DEFAULT 'transcript_ready',
  summary_text text,
  key_takeaways_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation_model text,
  generation_error text,
  generated_at timestamp,
  reviewed_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_podcast_enrichments_clip_id
  ON podcast_episode_enrichments(clip_id);

CREATE INDEX IF NOT EXISTS idx_podcast_enrichments_status_updated
  ON podcast_episode_enrichments(status, updated_at);
