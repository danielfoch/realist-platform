/**
 * Onboarding email sequence — behaviour-aware D1/D3/D5/D7 emails keyed off
 * users.createdAt. Follows the retentionEmails.ts architecture: sweep on an
 * interval, pure decision logic in shared/onboardingPolicy.ts, consent gate +
 * weekly cap + unsubscribe link on every send.
 *
 * Sequence (each step SKIPPED if the user already did the thing — see
 * shared/onboardingPolicy.ts for the exact rules):
 *  - D1 onboarding_first_analysis: zero analyses → "first deal in 60 seconds"
 *  - D3 onboarding_learn_metrics:  <2 analyses → cap rate / DSCR explainers
 *  - D5 onboarding_deal_desk:      ≥1 analysis, no submission → second set of eyes
 *  - D7 onboarding_community:      podcast + events
 *
 * TABLE DECISION: reuses retention_email_log instead of a new table — the
 * shape (user_id, dedupe_key, email_type, sent_at) fits exactly. Per-step
 * dedupe rides the existing (user_id, dedupe_key) unique index with
 * dedupe_key = the step key, and because onboarding rows live in the same log
 * they automatically count toward the global retention weekly cap (3/week)
 * inside trySend. That composition is deliberate: a brand-new user shouldn't
 * get 4 onboarding + 3 retention emails in their first week. Known edge: a
 * user who earns all 4 steps inside one 7-day window (or whose cap is eaten
 * by retention triggers) has the over-cap step suppressed AND burned — the
 * same acknowledged semantics as retention's "capped" decision. The
 * one-onboarding-email-per-day rule is enforced separately via
 * decideOnboardingStep's sentInLastDay input.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { cta, ensureRetentionTables, trySend, type Recipient } from "./retentionEmails";
import {
  ONBOARDING_MAX_DAYS,
  decideOnboardingStep,
  type OnboardingStepKey,
} from "@shared/onboardingPolicy";

const UTM = "utm_source=onboarding";

function buildStepEmail(step: OnboardingStepKey, firstName: string | null): { subject: string; html: string } {
  const hi = `<p>Hi ${firstName || "there"},</p>`;
  switch (step) {
    case "onboarding_first_analysis":
      return {
        subject: "Analyze your first deal in 60 seconds",
        html: `<h2 style="font-size:20px;">Your first deal is 60 seconds away</h2>
          ${hi}
          <p>Paste an address or a listing into the Realist analyzer and you'll get cash flow, cap rate, and DSCR back in about a minute. No spreadsheet, no guesswork — just the numbers that decide a deal.</p>
          ${cta(`https://realist.ca/tools/analyzer?${UTM}&utm_campaign=first_analysis`, "Analyze your first deal")}`,
      };
    case "onboarding_learn_metrics":
      return {
        subject: "The two numbers that make or break a deal",
        html: `<h2 style="font-size:20px;">Cap rate and DSCR, in plain English</h2>
          ${hi}
          <p>Every deal verdict on Realist comes down to a handful of metrics. The two worth learning first: <a href="https://realist.ca/insights/encyclopedia/cap-rate?${UTM}&utm_campaign=learn_metrics" style="color:#16a34a;font-weight:600;">cap rate</a> (what the property earns relative to its price) and <a href="https://realist.ca/insights/encyclopedia/dscr?${UTM}&utm_campaign=learn_metrics" style="color:#16a34a;font-weight:600;">DSCR</a> (whether the rent actually covers the mortgage).</p>
          <p>Then see what cap rates look like in real markets across Canada:</p>
          ${cta(`https://realist.ca/tools/cap-rates?${UTM}&utm_campaign=learn_metrics`, "Explore the cap rate map")}`,
      };
    case "onboarding_deal_desk":
      return {
        subject: "Get a second set of eyes on your deal",
        html: `<h2 style="font-size:20px;">You ran the numbers — now pressure-test them</h2>
          ${hi}
          <p>You've analyzed a deal on Realist. Before you act on it, submit it to the Deal Desk: our team will sanity-check your assumptions, flag what you might've missed, and point you at financing or next steps. Free, takes two minutes.</p>
          ${cta(`https://realist.ca/deal-desk?${UTM}&utm_campaign=deal_desk`, "Submit to the Deal Desk")}`,
      };
    case "onboarding_community":
      return {
        subject: "Investors worth knowing (and a podcast worth hearing)",
        html: `<h2 style="font-size:20px;">Don't invest alone</h2>
          ${hi}
          <p>The sharpest part of Realist isn't the software — it's the investors using it. Catch the <a href="https://realist.ca/insights/podcast?${UTM}&utm_campaign=community" style="color:#16a34a;font-weight:600;">Realist podcast</a> for market breakdowns, then meet other investors in person:</p>
          ${cta(`https://realist.ca/community/events?${UTM}&utm_campaign=community`, "See upcoming events & meetups")}`,
      };
  }
}

interface CandidateRow {
  id: string;
  email: string;
  first_name: string | null;
  created_at: Date | string;
  analysis_count: number;
  has_submission: boolean;
  sent_steps: string[] | null;
  sent_last_day: boolean;
}

/**
 * One pass over users inside the onboarding window: compute behaviour flags,
 * ask the pure policy which step (if any) is due, and send via the shared
 * retention trySend (dedupe + weekly cap + unsubscribe footer).
 */
export async function sweepOnboarding(now = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() - ONBOARDING_MAX_DAYS * 86_400_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Consent gate matches retentionEmails.optedInUsers: digest opt-in flag AND
  // latest email_consent ledger row (CASL, append-only) isn't 'revoked'.
  const result = await db.execute(sql`
    SELECT u.id, u.email, u.first_name, u.created_at,
      (
        (SELECT COUNT(*)::int FROM analyses a WHERE a.user_id = u.id)
        + (SELECT COUNT(*)::int FROM property_analyses pa
           WHERE pa.user_id = u.id AND pa.is_deleted = false)
      ) AS analysis_count,
      EXISTS(SELECT 1 FROM opportunities o WHERE o.user_id = u.id) AS has_submission,
      (SELECT array_agg(l.dedupe_key) FROM retention_email_log l
        WHERE l.user_id = u.id AND l.email_type LIKE 'onboarding_%') AS sent_steps,
      EXISTS(SELECT 1 FROM retention_email_log l2
        WHERE l2.user_id = u.id AND l2.email_type LIKE 'onboarding_%'
          AND l2.sent_at > ${dayAgo}) AS sent_last_day
    FROM users u
    WHERE u.created_at > ${windowStart}
      AND u.email_digest_opt_in = true
      AND COALESCE((
        SELECT ec.status FROM email_consent ec
        WHERE ec.user_id = u.id AND ec.channel = 'email'
        ORDER BY ec.created_at DESC
        LIMIT 1
      ), 'granted') <> 'revoked'
    LIMIT 2000
  `);

  let sent = 0;
  for (const row of result.rows as unknown as CandidateRow[]) {
    const step = decideOnboardingStep({
      signupAt: new Date(row.created_at),
      now,
      behavior: {
        analysisCount: Number(row.analysis_count || 0),
        hasDealDeskSubmission: Boolean(row.has_submission),
      },
      sentSteps: row.sent_steps || [],
      sentInLastDay: Boolean(row.sent_last_day),
    });
    if (!step) continue;

    const recipient: Recipient = { id: row.id, email: row.email, firstName: row.first_name };
    const { subject, html } = buildStepEmail(step, row.first_name);
    try {
      // dedupe_key = email_type = step key → one row per user per step.
      const ok = await trySend(recipient, step, step, subject, html);
      if (ok) sent += 1;
    } catch (error: any) {
      console.error(`[onboarding] send failed for user ${row.id} (${step}):`, error?.message || error);
    }
  }
  return sent;
}

// ——— Registration: hourly self-schedule + manual sweep endpoint ————————
// Mirrors registerRetentionEmailRoutes; wired next to it in routes.ts.

export function registerOnboardingEmailRoutes(app: Express): void {
  // Same log table as retention — idempotent ensure (also runs there).
  ensureRetentionTables().catch((error) =>
    console.error("[onboarding] failed to ensure tables:", error.message),
  );

  app.post("/api/onboarding/sweep", async (req: Request, res: Response) => {
    const key = req.headers["x-api-key"] || req.query.api_key;
    const configured = process.env.EVENTS_CRON_API_KEY || process.env.DEAL_DESK_API_KEY;
    if (!configured || key !== configured) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const sent = await sweepOnboarding().catch((e) => {
      console.error("[onboarding] sweep failed:", e);
      return -1;
    });
    res.json({ success: true, sent });
  });

  // Hourly background sweep (the one-per-day rule lives in the policy, so the
  // hourly cadence just means steps land within an hour of becoming due).
  setInterval(() => {
    sweepOnboarding().catch((e) => console.error("[onboarding] sweep failed:", e));
  }, 60 * 60 * 1000);
}
