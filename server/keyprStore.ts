import { sql } from "drizzle-orm";
import { db, pool } from "./db";
import { linkPersonByEmail } from "./personSpine";
import { leads, type InsertLead } from "../shared/schema";
import { keyprConsentVersion, type KeyprContact } from "../shared/keypr";
import { deliverKeyprLead, keyprPayload, retryDelayMs, type KeyprPayload } from "./keyprWebhook";

export async function initializeKeyprOutbox() {
  await pool.query(`CREATE TABLE IF NOT EXISTS keypr_lead_outbox (
    lead_id varchar PRIMARY KEY REFERENCES leads(id), payload jsonb NOT NULL,
    consent_version text NOT NULL, consent_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
    last_code text, lead_ref text, delivered_at timestamptz
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS keypr_outbox_due ON keypr_lead_outbox(next_attempt_at) WHERE status = 'pending'`);
}

export async function saveKeyprLead(input: InsertLead, contact: KeyprContact) {
  // Both records commit together: a successful form response always has a
  // durable delivery job, even when the partner or this process goes offline.
  const userId = await linkPersonByEmail(input.email);
  return db.transaction(async tx => {
    const [lead] = await tx.insert(leads).values({ ...input, userId }).returning();
    await tx.execute(sql`INSERT INTO keypr_lead_outbox (lead_id, payload, consent_version)
      VALUES (${lead.id}, ${JSON.stringify(keyprPayload(lead.id, contact))}::jsonb, ${keyprConsentVersion})`);
    return lead;
  });
}
let draining = false;
export async function drainKeyprOutbox() {
  const secret = process.env.KEYPR_REALIST_SECRET;
  if (!secret || draining) return;
  draining = true;
  try {
    // Claim one at a time with a lease. Across autoscaled workers, the row lock
    // prevents competing claims; after a crash the lease expires in 60 seconds.
    for (let i = 0; i < 20; i++) {
      const claimed = await pool.query(`UPDATE keypr_lead_outbox SET
        next_attempt_at = now() + interval '60 seconds', attempts = attempts + 1
        WHERE lead_id = (SELECT lead_id FROM keypr_lead_outbox WHERE status = 'pending'
          AND next_attempt_at <= now() ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING lead_id, payload, attempts, created_at`);
      const row = claimed.rows[0];
      if (!row) break;
      if (Date.now() - new Date(row.created_at).getTime() >= 86_400_000) {
        await pool.query("UPDATE keypr_lead_outbox SET status = 'failed', last_code = 'retry_window_expired' WHERE lead_id = $1", [row.lead_id]);
        console.error("[Keypr] Delivery requires attention:", row.lead_id, "retry_window_expired");
        continue;
      }
      const result = await deliverKeyprLead(row.payload as KeyprPayload, secret);
      await pool.query(`UPDATE keypr_lead_outbox SET status = $2, last_code = $3,
        lead_ref = $4, delivered_at = CASE WHEN $2 = 'sent' THEN now() ELSE NULL END,
        next_attempt_at = now() + ($5 * interval '1 millisecond') WHERE lead_id = $1`,
        [row.lead_id, result.status === "retry" ? "pending" : result.status, result.code,
          result.leadRef || null, retryDelayMs(row.attempts)]);
      if (result.status === "failed") console.error("[Keypr] Delivery requires attention:", row.lead_id, result.code);
    }
  } finally { draining = false; }
}
export function kickKeyprOutbox() {
  void drainKeyprOutbox().catch(() => console.error("[Keypr] Queue processing failed; will retry"));
}
