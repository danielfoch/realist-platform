/**
 * Passwordless-activation emails — monthly "set a password" nudges to DORMANT
 * passwordless accounts (silently created via lead capture, event
 * checkout/RSVP, admin imports). Follows the retentionEmails.ts /
 * onboardingEmails.ts architecture: sweep on the hourly lifecycle cadence, pure
 * decision logic in shared/activationPolicy.ts, and — the point of this branch
 * — every send routed through the unified governor (governMarketingSend in
 * server/emailGovernor.ts), which owns consent (CASL + digest opt-in), the
 * per-category notification_preferences toggle, AND the rolling 7-day marketing
 * cap. None of those are re-implemented here.
 *
 * Governor wiring:
 *   stream    = 'product_updates'  → the closest existing MarketingStream /
 *               notification_preferences toggle (product_updates_enabled). A
 *               passwordless-activation nudge IS a product-value announcement,
 *               so it reuses that toggle rather than adding a new column.
 *   emailType = 'passwordless_activation'   (written to retention_email_log)
 *   dedupeKey = 'passwordless_activation:<attempt#>'   (per-attempt idempotency)
 *
 * Targeting (shared/activationPolicy.ts): users.password_hash IS NULL AND
 * dormant. There is no users.last_login_at column, so "activity" is the max of
 * the real signals that exist in this schema:
 *  - users.created_at            (creation itself counts as activity, so new
 *                                 accounts wait a full 30d window and never
 *                                 overlap the D1–D14 onboarding sequence);
 *  - analyses.created_at         (deal-analyzer runs);
 *  - property_analyses.created_at (listing underwriting runs);
 *  - user_activity_events.event_timestamp (client behavioural events);
 *  - sessions.expire - 7d        (live-session evidence: connect-pg-simple
 *                                 touches sessions on request with a 7-day TTL,
 *                                 so expire ≈ last request + 7d. Expired rows
 *                                 are pruned, so this only witnesses logins in
 *                                 the trailing ~7 days — a pure login 8–30 days
 *                                 ago that produced no events is invisible.
 *                                 Acceptable: it errs toward one extra nudge,
 *                                 and any post-send activity permanently stops
 *                                 the sequence on the next sweep.)
 *
 * Stop conditions (forever, per shared/activationPolicy.ts): password set; any
 * activity after the last send; 6 lifetime attempts (address retired).
 * Cadence: rolling 30d per user — not a calendar blast.
 *
 * OPS / VOLUME: Resend's free tier caps at 100 emails/day (and ~2 req/s), so
 * each sweep sends at most ACTIVATION_DAILY_SEND_LIMIT (90) with a per-send
 * throttle, leaving headroom for transactional + retention mail. The rolling
 * per-user cadence spreads steady-state volume across days; the first deploy
 * (when every dormant passwordless user is due at once) drains as a 90/day drip
 * in deterministic order (oldest accounts first) — overflow candidates roll to
 * the next sweep. When due-count > 90 the sweep logs an [activation] VOLUME
 * warning; watch for it after deploy. Each send also mints a fresh 14-day
 * set-password token (the exact issuance pattern of the welcome/set-password
 * flow in server/auth.ts: raw = randomBytes(32).hex, stored = sha256(raw),
 * 14-day expiry, link = /set-password?token=<raw>).
 */

import crypto from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { appBaseUrl, isAdmin } from "./auth";
import { sendNotificationEmail } from "./resend";
import { generateUnsubscribeToken } from "./weeklyDigest";
import { cta, ensureRetentionTables, type Recipient } from "./retentionEmails";
import { governMarketingSend } from "./emailGovernor";
import { passwordResetTokens } from "@shared/models/auth";
import { SETUP_LINK_TTL_MS } from "@shared/authTokens";
import {
  ACTIVATION_EMAIL_TYPE,
  ACTIVATION_MAX_LIFETIME_ATTEMPTS,
  activationDedupeKey,
  decideActivationSend,
  type ActivationDecision,
} from "@shared/activationPolicy";

/** Stay under Resend's 100/day free tier with headroom for other mail. */
export const ACTIVATION_DAILY_SEND_LIMIT = 90;

/** Gap between sends (Resend free tier allows ~2 req/s; be gentle). */
const SEND_THROTTLE_MS = 600;

/** Candidate rows fetched per sweep (matches the onboarding sweep bound). */
const CANDIDATE_SCAN_LIMIT = 2000;

const UTM = "utm_source=activation&utm_campaign=passwordless";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ——— Standard footer + governed send (mirrors retentionEmails.trySend, but on
//     the 'product_updates' stream with the passwordless_activation dedupe key) —

function footer(userId: string): string {
  const token = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `https://realist.ca/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&token=${token}`;
  return `<p style="color:#9ca3af;font-size:12px;margin-top:24px;">Realist.ca — Canada's real estate deal analyzer · <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a></p>`;
}

/**
 * Claim + governed send. The governor atomically claims the per-attempt dedupe
 * row in retention_email_log, then applies consent + the product_updates
 * toggle + the shared rolling 7-day cap. Only on a fresh, allowed claim do we
 * perform the actual Resend send and wrap it in the standard unsubscribe
 * footer. Returns whether an email actually went out.
 */
async function sendActivationEmail(
  recipient: Recipient,
  attemptNumber: number,
  subject: string,
  html: string,
): Promise<boolean> {
  const gate = await governMarketingSend({
    userId: recipient.id,
    stream: "product_updates",
    emailType: ACTIVATION_EMAIL_TYPE,
    dedupeKey: activationDedupeKey(attemptNumber),
  });
  if (!gate.ok) return false; // duplicate, capped, consent-revoked, or preference-off

  await sendNotificationEmail({
    to: recipient.email,
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">${html}${footer(recipient.id)}</div>`,
  });
  return true;
}

// ——— Email content: one body, evolving slightly by attempt (≤160 words) ————

/** Subject ladder, indexed by attempt number (1–6). */
export const ACTIVATION_SUBJECTS: readonly string[] = [
  "Your Realist account is waiting — here's what it unlocks",
  "The AI now knows your market",
  "Investors are leaving field notes across your market",
  "Set a password, keep every deal you run",
  "Price alerts do the watching — once you're in",
  "Last note from us — your Realist account stays open",
];

export function buildActivationEmail(
  attemptNumber: number,
  firstName: string | null,
  setupLink: string,
): { subject: string; html: string } {
  const subject =
    ACTIVATION_SUBJECTS[Math.min(Math.max(attemptNumber, 1), ACTIVATION_SUBJECTS.length) - 1];
  const isFinal = attemptNumber >= ACTIVATION_MAX_LIFETIME_ATTEMPTS;
  const intro =
    attemptNumber <= 1
      ? "Your account was created along the way — at an event or while analyzing a deal — and it's been quietly holding your place. Set a password and all of this unlocks:"
      : "Quick reminder: your Realist account — created at an event or while analyzing a deal — is still holding your place. One password unlocks all of this:";

  const html = `<h2 style="font-size:20px;">The full Realist toolkit is one password away</h2>
    <p>Hi ${firstName || "there"},</p>
    <p>${intro}</p>
    <ul style="color:#374151;font-size:14px;line-height:1.7;padding-left:20px;">
      <li><strong>AI market defaults</strong> — assumptions pre-filled from thousands of real analyses in your market.</li>
      <li><strong>Watchlists &amp; price alerts</strong> — we watch the listings so you don't have to.</li>
      <li><strong>Saved analyses &amp; pitch-deck exports</strong> — every deal you run, keepable and shareable.</li>
      <li><strong>Field notes &amp; the monthly leaderboard</strong> — on-the-ground intel from investors, with real prizes.</li>
    </ul>
    ${isFinal ? `<p>This is the last note from us — your account stays open whenever you're ready.</p>` : ""}
    ${cta(setupLink, "Set your password")}
    <p style="color:#6b7280;font-size:13px;">This link works for 14 days. Prefer no password? <a href="https://realist.ca/login?${UTM}_${attemptNumber}" style="color:#16a34a;">Sign in instantly — we'll email you a link</a>.</p>`;
  return { subject, html };
}

// ——— Candidate query + evaluation (shared by preview and sweep) ————————

interface CandidateRow {
  id: string;
  email: string;
  first_name: string | null;
  last_activity_at: Date | string | null;
  last_sent_at: Date | string | null;
  attempts_sent: number;
}

export interface EvaluatedCandidate {
  id: string;
  email: string;
  firstName: string | null;
  lastActivityAt: Date | null;
  lastSentAt: Date | null;
  attemptsSent: number;
  decision: ActivationDecision;
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * One pass over passwordless users. password_hash IS NULL and the
 * lifetime-attempt ceiling are pre-filtered in SQL so retired users stop
 * costing scan budget; the pure policy then re-runs every rule authoritatively
 * per row. Consent + the marketing cap are NOT pre-filtered here — the governor
 * decides those at send time (a consent-revoked user simply won't get a send,
 * and their claimed row is released so they re-qualify if they re-opt-in).
 *
 * last_activity_at is the GREATEST of every activity signal that exists in the
 * schema (see module header) — creation, deal analyses, property analyses,
 * behavioural events, and trailing-window session evidence.
 */
export async function evaluateActivationCandidates(
  now: Date = new Date(),
): Promise<EvaluatedCandidate[]> {
  const result = await db.execute(sql`
    SELECT u.id, u.email, u.first_name,
      GREATEST(
        u.created_at,
        (SELECT MAX(a.created_at) FROM analyses a WHERE a.user_id = u.id),
        (SELECT MAX(pa.created_at) FROM property_analyses pa WHERE pa.user_id = u.id),
        (SELECT MAX(e.event_timestamp) FROM user_activity_events e WHERE e.user_id = u.id),
        (SELECT MAX(s.expire) - interval '7 days' FROM sessions s WHERE s.sess->>'userId' = u.id)
      ) AS last_activity_at,
      (SELECT MAX(l.sent_at) FROM retention_email_log l
        WHERE l.user_id = u.id AND l.email_type = ${ACTIVATION_EMAIL_TYPE}) AS last_sent_at,
      (SELECT COUNT(*)::int FROM retention_email_log l
        WHERE l.user_id = u.id AND l.email_type = ${ACTIVATION_EMAIL_TYPE}) AS attempts_sent
    FROM users u
    WHERE u.password_hash IS NULL
      AND (SELECT COUNT(*) FROM retention_email_log l
        WHERE l.user_id = u.id AND l.email_type = ${ACTIVATION_EMAIL_TYPE}
      ) < ${ACTIVATION_MAX_LIFETIME_ATTEMPTS}
    ORDER BY u.created_at ASC
    LIMIT ${CANDIDATE_SCAN_LIMIT}
  `);

  return ((result as any).rows as CandidateRow[]).map((row) => {
    const lastActivityAt = toDate(row.last_activity_at);
    const lastSentAt = toDate(row.last_sent_at);
    const attemptsSent = Number(row.attempts_sent || 0);
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastActivityAt,
      lastSentAt,
      attemptsSent,
      decision: decideActivationSend(
        { hasPassword: false, lastActivityAt, lastSentAt, attemptsSent },
        now,
      ),
    };
  });
}

// ——— Sweep: token issuance + governed send ————————————————————————————

export interface ActivationSweepResult {
  scanned: number;
  due: number;
  sent: number;
  /** Due candidates deferred past the daily limit (roll to the next sweep). */
  deferred: number;
  skipped: Record<string, number>;
}

export async function sweepPasswordlessActivation(
  now: Date = new Date(),
): Promise<ActivationSweepResult> {
  const candidates = await evaluateActivationCandidates(now);
  const due = candidates.filter((c) => c.decision.send);
  const skipped: Record<string, number> = {};
  for (const c of candidates) {
    if (!c.decision.send) skipped[c.decision.reason] = (skipped[c.decision.reason] || 0) + 1;
  }

  if (due.length > ACTIVATION_DAILY_SEND_LIMIT) {
    console.warn(
      `[activation] VOLUME: ${due.length} candidates due but daily limit is ${ACTIVATION_DAILY_SEND_LIMIT} ` +
        `(Resend free tier caps 100/day) — overflow rolls to the next sweep.`,
    );
  }

  let sent = 0;
  for (const candidate of due.slice(0, ACTIVATION_DAILY_SEND_LIMIT)) {
    if (candidate.decision.send !== true) continue;
    const attemptNumber = candidate.decision.attemptNumber;
    try {
      // Fresh 14-day set-password token — the exact issuance pattern of the
      // welcome/set-password flow in server/auth.ts (raw randomBytes(32).hex;
      // stored sha256(raw); the set-password endpoint hashes the bare token, so
      // purpose-scoped login-link hashes can never redeem here).
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const [tokenRow] = await db
        .insert(passwordResetTokens)
        .values({
          userId: candidate.id,
          token: tokenHash,
          expiresAt: new Date(now.getTime() + SETUP_LINK_TTL_MS),
        })
        .returning({ id: passwordResetTokens.id });

      const setupLink = `${appBaseUrl()}/set-password?token=${rawToken}`;
      const recipient: Recipient = {
        id: candidate.id,
        email: candidate.email,
        firstName: candidate.firstName,
      };
      const { subject, html } = buildActivationEmail(attemptNumber, candidate.firstName, setupLink);

      const ok = await sendActivationEmail(recipient, attemptNumber, subject, html);
      if (ok) {
        sent += 1;
        await sleep(SEND_THROTTLE_MS);
      } else if (tokenRow) {
        // Duplicate claim, cap suppression, or preference-off: no email went
        // out, so don't leave a live 14-day token that was never delivered.
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenRow.id));
      }
    } catch (error: any) {
      console.error(
        `[activation] send failed for user ${candidate.id} (attempt ${attemptNumber}):`,
        error?.message || error,
      );
    }
  }

  return {
    scanned: candidates.length,
    due: due.length,
    sent,
    deferred: Math.max(0, due.length - ACTIVATION_DAILY_SEND_LIMIT),
    skipped,
  };
}

// ——— Registration: hourly self-schedule + gated admin endpoints ————————

/**
 * Admin gate: accepts the cron API key (same header contract as the
 * retention/onboarding sweep endpoints, so external cron can drive it) OR an
 * admin session (same rule as the /api/admin/* routes).
 */
function activationAdminGate(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-api-key"] || req.query.api_key;
  const configured = process.env.EVENTS_CRON_API_KEY || process.env.DEAL_DESK_API_KEY;
  if (configured && key === configured) {
    next();
    return;
  }
  void isAdmin(req, res, next);
}

export function registerPasswordlessActivationRoutes(app: Express): void {
  // Shares retention_email_log with retention/onboarding — idempotent ensure.
  ensureRetentionTables().catch((error) =>
    console.error("[activation] failed to ensure tables:", error.message),
  );

  // Who is due right now (no sends, no side effects) + volume counts.
  app.get("/api/activation/preview", activationAdminGate, async (req: Request, res: Response) => {
    try {
      const sampleLimit = Math.min(Number(req.query.limit) || 25, 200);
      const candidates = await evaluateActivationCandidates();
      const due = candidates.filter((c) => c.decision.send);
      const skipped: Record<string, number> = {};
      for (const c of candidates) {
        if (!c.decision.send) skipped[c.decision.reason] = (skipped[c.decision.reason] || 0) + 1;
      }
      res.json({
        scanned: candidates.length,
        due: due.length,
        dailySendLimit: ACTIVATION_DAILY_SEND_LIMIT,
        overDailyLimit: due.length > ACTIVATION_DAILY_SEND_LIMIT,
        skipped,
        dueSample: due.slice(0, sampleLimit).map((c) => ({
          id: c.id,
          email: c.email,
          attemptNumber: c.decision.send ? c.decision.attemptNumber : null,
          lastActivityAt: c.lastActivityAt,
          lastSentAt: c.lastSentAt,
        })),
      });
    } catch (error: any) {
      console.error("[activation] preview failed:", error);
      res.status(500).json({ error: "Preview failed" });
    }
  });

  // Manual trigger (also the hook for external cron, mirroring retention).
  app.post("/api/activation/sweep", activationAdminGate, async (_req: Request, res: Response) => {
    const result = await sweepPasswordlessActivation().catch((e) => {
      console.error("[activation] sweep failed:", e);
      return null;
    });
    if (!result) {
      res.status(500).json({ success: false });
      return;
    }
    res.json({ success: true, ...result });
  });

  // Hourly background sweep, matching the retention/onboarding lifecycle
  // cadence. The per-user rolling 30d spacing lives in the policy, so cadence
  // stays monthly per user no matter how often this fires.
  setInterval(() => {
    sweepPasswordlessActivation().catch((e) => console.error("[activation] sweep failed:", e));
  }, 60 * 60 * 1000);
}
