-- Prevent duplicate recipient-specific invites for the same owner-provided label on one share.
-- Labels are stored only as SHA-256 hashes, so this guards against repeated invites
-- without persisting raw emails/names. Link creation still awards no credits.

CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_share_recipients_label_once
  ON underwriting_share_recipients(share_id, recipient_label_hash)
  WHERE recipient_label_hash IS NOT NULL;

COMMENT ON INDEX idx_underwriting_share_recipients_label_once IS 'Dedupes Challenge my underwriting recipient invite labels per share using hashed labels; no raw PII stored.';
