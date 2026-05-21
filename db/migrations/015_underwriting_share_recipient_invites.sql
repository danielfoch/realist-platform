-- Recipient-specific underwriting share links for qualified viral tracking.
-- These links let owners share the same CTA with known recipients without awarding credits for raw link creation.
-- Credits still flow only through underwriting_share_actions after unique opens/challenges/forks/signups/saved versions.

CREATE TABLE IF NOT EXISTS underwriting_share_recipients (
  id SERIAL PRIMARY KEY,
  share_id INTEGER NOT NULL REFERENCES underwriting_shares(id) ON DELETE CASCADE,
  recipient_hash CHAR(64) NOT NULL,
  recipient_label_hash CHAR(64),
  source VARCHAR(64) NOT NULL DEFAULT 'manual',
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_opened_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_share_recipients_once
  ON underwriting_share_recipients(share_id, recipient_hash);

CREATE INDEX IF NOT EXISTS idx_underwriting_share_recipients_share
  ON underwriting_share_recipients(share_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_underwriting_share_recipients_label
  ON underwriting_share_recipients(share_id, recipient_label_hash)
  WHERE recipient_label_hash IS NOT NULL;

COMMENT ON TABLE underwriting_share_recipients IS 'Recipient-specific share links for Challenge my underwriting; creating links never awards credits.';
COMMENT ON COLUMN underwriting_share_recipients.recipient_hash IS 'SHA-256 of the opaque recipient key used by getRecipientHash; no raw email/name is required.';
COMMENT ON COLUMN underwriting_share_recipients.recipient_label_hash IS 'Optional SHA-256 hash of owner-provided label/email for deduping invite generation without storing raw PII.';
