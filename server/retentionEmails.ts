/**
 * Behavioural retention emails — event-driven messages that pull users back
 * to analyze deals (which trains the AI/ML backend).
 *
 * Triggers (v1):
 *  - CO-ANALYSIS: another user analyzed a property you analyzed → social-proof
 *    email with their headline numbers and a "compare your analysis" CTA.
 *  - PRICE CHANGE: a US listing you analyzed changed price (us_listing_price_history,
 *    written at ingest) → "re-run the numbers" CTA.
 *    TODO(CA): wire Canadian price changes off ddf_listing_snapshots (monthly)
 *    or a DDF ingest-time price-history table; the email path is source-agnostic.
 *  - MILESTONE: user crosses 5/10/25/50/100 lifetime analyses → congrats +
 *    "see how you rank" leaderboard CTA.
 *
 * Guardrails: only emailDigestOptIn users whose latest email_consent ledger
 * row (CASL) isn't 'revoked'; per-user cap of 3 retention emails per rolling
 * 7 days; per-trigger dedupe via retention_email_log; every email
 * carries the standard unsubscribe link. The weekly leaderboard/KPI digest is
 * separate (weeklyDigest.ts) and already includes rank + platform stats.
 */

import type { Express, Request, Response } from "express";
import { and, desc, eq, gt, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { sendNotificationEmail } from "./resend";
import { generateUnsubscribeToken } from "./weeklyDigest";
import { governMarketingSend } from "./emailGovernor";
import {
  analyses,
  properties,
  usListingPriceHistory,
  usListings,
  users,
} from "@shared/schema";

export async function ensureRetentionTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "retention_email_log" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "dedupe_key" text NOT NULL,
      "email_type" text NOT NULL,
      "sent_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_retention_dedupe" ON "retention_email_log" ("user_id", "dedupe_key")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_retention_user_sent" ON "retention_email_log" ("user_id", "sent_at")
  `);
}

export interface Recipient {
  id: string;
  email: string;
  firstName: string | null;
}

function footer(userId: string): string {
  const token = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `https://realist.ca/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&token=${token}`;
  return `<p style="color:#9ca3af;font-size:12px;margin-top:24px;">Realist.ca — Canada's real estate deal analyzer · <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a></p>`;
}

export function cta(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="background:#16a34a;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

/**
 * Claim + governed send. Delegates the dedupe-claim, the rolling weekly cap,
 * the CASL consent gate AND the notification_preferences gate to the unified
 * emailGovernor (server/emailGovernor.ts) so there is ONE cap definition and
 * ONE consent/preference decision across every marketing producer. This module
 * only wires the decision to the actual Resend send + unsubscribe footer.
 *
 * Retention + onboarding both ride the 'retention' stream (retention_tips
 * toggle). Exported for reuse by the onboarding sequence
 * (server/onboardingEmails.ts), which shares the same log, cap, and stream.
 */
export async function trySend(
  recipient: Recipient,
  emailType: string,
  dedupeKey: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const gate = await governMarketingSend({
    userId: recipient.id,
    stream: "retention",
    emailType,
    dedupeKey,
  });
  if (!gate.ok) return false; // duplicate, capped, consent-revoked, or preference-off

  await sendNotificationEmail({
    to: recipient.email,
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">${html}${footer(recipient.id)}</div>`,
  });
  return true;
}

/**
 * Recipients must (a) have the digest opt-in flag AND (b) not have revoked
 * email consent in the CASL ledger (email_consent is append-only — the latest
 * row per user/channel wins; no rows at all = no objection on record, so the
 * opt-in flag alone governs, as before).
 */
async function optedInUsers(ids: string[]): Promise<Recipient[]> {
  if (!ids.length) return [];
  return db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(and(
      inArray(users.id, ids),
      eq(users.emailDigestOptIn, true),
      sql`COALESCE((
        SELECT ec.status FROM email_consent ec
        WHERE ec.user_id = ${users.id} AND ec.channel = 'email'
        ORDER BY ec.created_at DESC
        LIMIT 1
      ), 'granted') <> 'revoked'`,
    ));
}

function fmtPct(value: unknown): string | null {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : null;
}

// ——— Trigger 1: co-analysis ————————————————————————————————

export async function sweepCoAnalysis(windowHours = 1): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const fresh = await db
    .select({
      id: analyses.id,
      propertyId: analyses.propertyId,
      userId: analyses.userId,
      address: analyses.address,
      city: analyses.city,
      resultsJson: analyses.resultsJson,
    })
    .from(analyses)
    .where(and(gt(analyses.createdAt, since), isNotNull(analyses.propertyId)))
    .limit(500);

  let sent = 0;
  for (const fresh1 of fresh) {
    if (!fresh1.propertyId) continue;
    const earlier = await db
      .selectDistinct({ userId: analyses.userId })
      .from(analyses)
      .where(and(eq(analyses.propertyId, fresh1.propertyId), isNotNull(analyses.userId)))
      .limit(50);
    const otherUserIds = earlier
      .map((row) => row.userId)
      .filter((id): id is string => Boolean(id) && id !== fresh1.userId);
    if (!otherUserIds.length) continue;

    const [prop] = await db.select().from(properties).where(eq(properties.id, fresh1.propertyId)).limit(1);
    const address = fresh1.address || prop?.formattedAddress || "a property you analyzed";
    const capRate = fmtPct((fresh1.resultsJson as any)?.capRate);

    for (const recipient of await optedInUsers(otherUserIds)) {
      const ok = await trySend(
        recipient,
        "co_analysis",
        `coanalysis:${fresh1.propertyId}:${fresh1.id}`,
        `Another investor just analyzed ${address}`,
        `<h2 style="font-size:20px;">Someone else is running the numbers 👀</h2>
         <p>Hi ${recipient.firstName || "there"},</p>
         <p>Another Realist investor just analyzed <strong>${address}</strong>${fresh1.city ? ` in ${fresh1.city}` : ""} — a property you've analyzed too.</p>
         ${capRate ? `<p>Their analysis came out at a <strong>${capRate} cap rate</strong>. How does that compare to yours?</p>` : ""}
         ${cta("https://realist.ca/deal-analyzer?utm_source=retention&utm_campaign=co_analysis", "Compare your analysis")}`,
      );
      if (ok) sent += 1;
    }
  }
  return sent;
}

// ——— Trigger 2: price changes (US source live; CA TODO above) ————————

export async function sweepPriceChanges(windowHours = 24): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const changes = await db
    .select({
      listingId: usListingPriceHistory.listingId,
      oldPrice: usListingPriceHistory.oldPrice,
      newPrice: usListingPriceHistory.newPrice,
      changePercent: usListingPriceHistory.changePercent,
      address: usListings.formattedAddress,
      city: usListings.city,
      state: usListings.state,
    })
    .from(usListingPriceHistory)
    .innerJoin(usListings, eq(usListingPriceHistory.listingId, usListings.id))
    .where(gt(usListingPriceHistory.detectedAt, since))
    .limit(500);

  let sent = 0;
  for (const change of changes) {
    if (!change.address || !change.newPrice) continue;
    // Match analyzers by normalized address (analyses store free-text addresses).
    const watchers = await db
      .selectDistinct({ userId: analyses.userId })
      .from(analyses)
      .where(and(
        isNotNull(analyses.userId),
        sql`LOWER(${analyses.address}) = LOWER(${change.address})`,
      ))
      .limit(100);
    const userIds = watchers.map((w) => w.userId).filter((id): id is string => Boolean(id));
    if (!userIds.length) continue;

    const direction = (change.changePercent ?? 0) < 0 ? "dropped" : "increased";
    const pct = Math.abs(change.changePercent ?? 0).toFixed(1);
    for (const recipient of await optedInUsers(userIds)) {
      const ok = await trySend(
        recipient,
        "price_change",
        `price:${change.listingId}:${change.newPrice}`,
        `Price ${direction} ${pct}% on ${change.address}`,
        `<h2 style="font-size:20px;">The numbers just changed 📉</h2>
         <p>Hi ${recipient.firstName || "there"},</p>
         <p><strong>${change.address}</strong>${change.city ? ` (${change.city}, ${change.state})` : ""} — a property you analyzed — just ${direction} from <strong>$${(change.oldPrice || 0).toLocaleString()}</strong> to <strong>$${change.newPrice.toLocaleString()}</strong> (${pct}%).</p>
         <p>Your old analysis is stale. Sixty seconds to re-run it at the new price.</p>
         ${cta("https://realist.ca/deal-analyzer?utm_source=retention&utm_campaign=price_change", "Re-run the numbers")}`,
      );
      if (ok) sent += 1;
    }
  }
  return sent;
}

// ——— Trigger 3: milestones (DISABLED — duplicate producer collapsed) ————————
//
// This deal-analyzer milestone sweep was a DUPLICATE of the event-driven
// milestone producer in server/notifications.ts (queueMilestoneNotification),
// which fires synchronously on every new community analysis and covers a
// broader ladder (1/5/10/25/50/100/250/500 vs. 5/10/25/50/100 here). Both sent
// a near-identical "You've analyzed N deals" email on overlapping thresholds,
// so a user active in both surfaces received two milestone emails per
// milestone. As part of the email-governor consolidation we keep the single
// event-driven producer (now routed through the unified frequency governor)
// and disable this sweep. Kept as an exported no-op so the route/interval
// wiring and any tests referencing it don't break; safe to delete once no
// caller references it.
export async function sweepMilestones(_windowHours = 24): Promise<number> {
  return 0;
}

// ——— Registration: hourly self-schedule + manual sweep endpoint ————————

export function registerRetentionEmailRoutes(app: Express): void {
  ensureRetentionTables().catch((error) =>
    console.error("[retention] failed to ensure tables:", error.message),
  );

  app.post("/api/retention/sweep", async (req: Request, res: Response) => {
    const key = req.headers["x-api-key"] || req.query.api_key;
    const configured = process.env.EVENTS_CRON_API_KEY || process.env.DEAL_DESK_API_KEY;
    if (!configured || key !== configured) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const results = {
      coAnalysis: await sweepCoAnalysis(Number(req.query.window_hours) || 1).catch((e) => { console.error("[retention] co-analysis sweep failed:", e); return -1; }),
      priceChanges: await sweepPriceChanges(Number(req.query.window_hours) || 24).catch((e) => { console.error("[retention] price sweep failed:", e); return -1; }),
      milestones: await sweepMilestones(Number(req.query.window_hours) || 24).catch((e) => { console.error("[retention] milestone sweep failed:", e); return -1; }),
    };
    res.json({ success: true, sent: results });
  });

  // Hourly background sweep (mirrors the scheduleWeeklyDigest pattern).
  setInterval(() => {
    sweepCoAnalysis(1).catch((e) => console.error("[retention] co-analysis sweep failed:", e));
    sweepPriceChanges(1).catch((e) => console.error("[retention] price sweep failed:", e));
    sweepMilestones(1).catch((e) => console.error("[retention] milestone sweep failed:", e));
  }, 60 * 60 * 1000);
}
