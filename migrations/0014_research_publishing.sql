CREATE TABLE IF NOT EXISTS research_articles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,
  ingest_idempotency_key text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  dek text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  article_json jsonb NOT NULL,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  preview_issued_at timestamp,
  reviewed_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  publish_requested_at timestamp,
  publish_blocked_reason text,
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_articles_status_created
  ON research_articles(status, created_at);

CREATE INDEX IF NOT EXISTS idx_research_articles_slug
  ON research_articles(slug);

CREATE TABLE IF NOT EXISTS research_publish_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id varchar NOT NULL REFERENCES research_articles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  requested_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  message text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_publish_attempts_article_key
  ON research_publish_attempts(article_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_research_publish_attempts_article
  ON research_publish_attempts(article_id);
