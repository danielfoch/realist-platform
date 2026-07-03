import cron from "node-cron";
import { db } from "./db";
import { users, analyses, notificationEvents, notificationQueue } from "@shared/schema";
import { sql, count, desc } from "drizzle-orm";
import { getResendClient } from "./resend";
import { governMarketingSend } from "./emailGovernor";

const REPLY_TO_EMAIL = process.env.MONTHLY_WINNER_REPLY_EMAIL || "danielfoch@gmail.com";
const TEXT_PHONE = process.env.MONTHLY_WINNER_TEXT_PHONE || "";
// Everyone ranked last month gets a placement email; only #1 gets the prize.
const RANK_EMAIL_LIMIT = Math.max(1, Math.min(500, Number(process.env.MONTHLY_RANK_EMAIL_LIMIT) || 500));
const PRIZE_RANKS = Math.max(1, Math.min(3, Number(process.env.MONTHLY_PRIZE_RANKS) || 1));

const PRIZE_TIERS: Record<number, { medal: string; label: string }> = {
  1: { medal: "🥇", label: "1st place" },
  2: { medal: "🥈", label: "2nd place" },
  3: { medal: "🥉", label: "3rd place" },
};

interface WinnerRow {
  rank: number;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  dealCount: number;
  emailDigestOptIn: boolean | null;
  consentStatus: string;
}

function getLastMonthBoundsToronto(): { start: string; end: string; monthKey: string; label: string } {
  const now = new Date();
  const torontoNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const startOfThisMonth = new Date(torontoNow.getFullYear(), torontoNow.getMonth(), 1, 0, 0, 0, 0);
  const startOfLastMonth = new Date(torontoNow.getFullYear(), torontoNow.getMonth() - 1, 1, 0, 0, 0, 0);
  const monthKey = `${startOfLastMonth.getFullYear()}-${String(startOfLastMonth.getMonth() + 1).padStart(2, "0")}`;
  const label = startOfLastMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  return {
    start: startOfLastMonth.toISOString(),
    end: startOfThisMonth.toISOString(),
    monthKey,
    label,
  };
}

export async function getLastMonthWinners(limit = RANK_EMAIL_LIMIT): Promise<WinnerRow[]> {
  const { start, end } = getLastMonthBoundsToronto();
  const rows = await db
    .select({
      userId: analyses.userId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      dealCount: count(analyses.id),
      emailDigestOptIn: users.emailDigestOptIn,
      consentStatus: sql<string>`COALESCE((SELECT ec.status FROM email_consent ec WHERE ec.user_id = ${users.id} AND ec.channel = 'email' ORDER BY ec.created_at DESC LIMIT 1), 'granted')`,
    })
    .from(analyses)
    .innerJoin(users, sql`${users.id} = ${analyses.userId}`)
    .where(sql`
      ${analyses.userId} IS NOT NULL
      AND ${analyses.resultsJson} IS NOT NULL
      AND ${analyses.createdAt} >= ${start}
      AND ${analyses.createdAt} < ${end}
      AND ${users.email} IS NOT NULL
      AND ${users.email} <> ''
      AND LOWER(COALESCE(${users.email}, '')) NOT LIKE '%@example.com'
      AND NOT (
        LOWER(COALESCE(${users.firstName}, '')) = 'test'
        AND LOWER(COALESCE(${users.lastName}, '')) = 'user'
      )
      AND NOT EXISTS (
        SELECT 1 FROM analysis_quality_scores aqs
        WHERE aqs.analysis_id = ${analyses.id}
          AND (aqs.leaderboard_eligible = false OR aqs.confidence_score::numeric < 0.65)
      )
      AND (
        NOT ((${analyses.resultsJson}->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$')
        OR ((${analyses.resultsJson}->>'capRate')::numeric BETWEEN -10 AND 25)
      )
      AND (
        NOT ((${analyses.resultsJson}->>'cashOnCash') ~ '^-?[0-9]+(\\.[0-9]+)?$')
        OR ((${analyses.resultsJson}->>'cashOnCash')::numeric BETWEEN -50 AND 60)
      )
      AND (
        NOT ((${analyses.resultsJson}->>'dscr') ~ '^-?[0-9]+(\\.[0-9]+)?$')
        OR ((${analyses.resultsJson}->>'dscr')::numeric BETWEEN 0 AND 4)
      )
    `)
    .groupBy(analyses.userId, users.email, users.firstName, users.lastName, users.emailDigestOptIn)
    .orderBy(desc(count(analyses.id)))
    .limit(limit);

  return rows
    .filter((r) => r.userId && r.email)
    .map((r, i) => ({
      rank: i + 1,
      userId: r.userId as string,
      email: r.email as string,
      firstName: r.firstName,
      lastName: r.lastName,
      dealCount: Number(r.dealCount || 0),
      emailDigestOptIn: (r as { emailDigestOptIn?: boolean | null }).emailDigestOptIn ?? null,
      consentStatus: (r as { consentStatus?: string }).consentStatus ?? "granted",
    }));
}

function buildSubject(rank: number, monthLabel: string, total: number): string {
  const tier = PRIZE_TIERS[rank];
  if (rank <= PRIZE_RANKS && tier) return `${tier.medal} You won ${tier.label} on the Realist leaderboard for ${monthLabel}`;
  if (tier) return `${tier.medal} You took ${tier.label} on the Realist leaderboard for ${monthLabel}`;
  return `You ranked #${rank} of ${total} on the Realist leaderboard for ${monthLabel}`;
}

function buildHtml(winner: WinnerRow, monthLabel: string, total: number): string {
  const isPrize = winner.rank <= PRIZE_RANKS;
  const tier = PRIZE_TIERS[winner.rank] || { medal: "🏆", label: `#${winner.rank}` };
  const firstName = winner.firstName || "there";
  const textLine = TEXT_PHONE
    ? `Reply to this email <strong>or text Daniel at ${TEXT_PHONE}</strong> with your shipping address`
    : `Reply to this email with your shipping address`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Monthly Leaderboard</p>
        <h1 style="margin: 6px 0 0 0; font-size: 24px; color: white; font-weight: 700;">${tier.medal} ${isPrize ? tier.label.toUpperCase() : `RANK #${winner.rank} OF ${total}`}</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">${monthLabel}</p>
      </div>

      <div style="padding: 28px 24px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827;">Hey ${firstName},</p>

        <p style="margin: 0 0 16px 0; font-size: 14px; color: #374151; line-height: 1.7;">
          ${isPrize ? `Congrats — you finished <strong>#${winner.rank}</strong> on the Realist.ca monthly leaderboard for <strong>${monthLabel}</strong> with <strong>${winner.dealCount} deal${winner.dealCount === 1 ? "" : "s"} analyzed</strong>. That puts you in real-life-prize territory.` : `You finished <strong>#${winner.rank} of ${total}</strong> on the Realist.ca monthly leaderboard for <strong>${monthLabel}</strong> with <strong>${winner.dealCount} deal${winner.dealCount === 1 ? "" : "s"} analyzed</strong>. The board resets on the 1st — every analysis counts, and #1 ships home a real prize.`}
        </p>

        ${isPrize ? `<div style="background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%); border: 1px solid #fed7aa; border-radius: 8px; padding: 18px; margin: 18px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #9a3412;">How to claim your reward</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.7;">
            ${textLine} so we can ship it out. Include your full name, mailing address, and (if you'd like a custom note) what name you want on the package.
          </p>
        </div>` : `<div style="text-align: center; margin: 18px 0;">
          <a href="https://realist.ca/tools/analyzer?source=monthly_rank_email" style="display: inline-block; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Analyze a deal — start climbing
          </a>
        </div>`}

        <p style="margin: 16px 0 0 0; font-size: 14px; color: #374151; line-height: 1.7;">
          Thanks for using Realist and helping keep the underwriting community sharp.
        </p>
        <p style="margin: 14px 0 0 0; font-size: 14px; color: #374151; line-height: 1.7;">
          — Daniel<br/>
          <span style="color: #6b7280; font-size: 13px;">Realist.ca</span>
        </p>

        <div style="text-align: center; margin: 24px 0 0 0;">
          <a href="https://realist.ca/community/leaderboard?source=monthly_winner_email" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            View the Leaderboard
          </a>
        </div>
      </div>

      <div style="padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background: #f9fafb;">
        <p style="margin: 0; text-align: center; color: #9ca3af; font-size: 11px;">
          Realist.ca — Canada's #1 Real Estate Deal Analyzer
        </p>
      </div>
    </div>
  `;
}

function buildText(winner: WinnerRow, monthLabel: string, total: number): string {
  const isPrize = winner.rank <= PRIZE_RANKS;
  const tier = PRIZE_TIERS[winner.rank];
  const place = tier ? tier.label : `#${winner.rank}`;
  const firstName = winner.firstName || "there";
  const textLine = TEXT_PHONE
    ? `Reply to this email or text Daniel at ${TEXT_PHONE}`
    : `Reply to this email`;

  return [
    `Hey ${firstName},`,
    "",
    isPrize
      ? `Congrats — you finished ${place} on the Realist.ca monthly leaderboard for ${monthLabel} with ${winner.dealCount} deal${winner.dealCount === 1 ? "" : "s"} analyzed.`
      : `You finished #${winner.rank} of ${total} on the Realist.ca monthly leaderboard for ${monthLabel} with ${winner.dealCount} deal${winner.dealCount === 1 ? "" : "s"} analyzed. The board resets on the 1st — #1 ships home a real prize.`,
    "",
    ...(isPrize
      ? ["How to claim your reward:", `${textLine} with your full name and mailing address so we can ship it out.`, ""]
      : ["Start climbing: https://realist.ca/tools/analyzer?source=monthly_rank_email", ""]),
    "Leaderboard: https://realist.ca/community/leaderboard?source=monthly_winner_email",
    "",
    "— Daniel",
    "Realist.ca",
  ].join("\n");
}

interface SendResult {
  monthKey: string;
  monthLabel: string;
  attempted: number;
  sent: number;
  skipped: number;
  errors: number;
  winners: Array<{ rank: number; userId: string; email: string; status: "sent" | "skipped" | "error"; reason?: string }>;
}

export async function sendMonthlyWinnerEmails(options?: { dryRun?: boolean; limit?: number }): Promise<SendResult> {
  const dryRun = options?.dryRun ?? false;
  const limit = options?.limit ?? RANK_EMAIL_LIMIT;
  const { monthKey, label } = getLastMonthBoundsToronto();
  console.log(`[monthly-winner] Starting for ${label} (key=${monthKey}) limit=${limit} dryRun=${dryRun}`);

  const winners = await getLastMonthWinners(limit);
  if (winners.length === 0) {
    console.log(`[monthly-winner] No eligible winners for ${label}`);
    return { monthKey, monthLabel: label, attempted: 0, sent: 0, skipped: 0, errors: 0, winners: [] };
  }

  const result: SendResult = {
    monthKey,
    monthLabel: label,
    attempted: winners.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    winners: [],
  };

  let event: { id: string } | undefined;
  if (!dryRun) {
    const inserted = await db
      .insert(notificationEvents)
      .values({
        eventType: "monthly_leaderboard_winner",
        payloadJson: { monthKey, monthLabel: label, winners },
      })
      .returning({ id: notificationEvents.id });
    event = inserted[0];
  }

  let resendCtx: Awaited<ReturnType<typeof getResendClient>> | null = null;
  if (!dryRun) {
    try {
      resendCtx = await getResendClient();
    } catch (err: any) {
      console.error("[monthly-winner] Resend init failed:", err?.message || err);
      throw err;
    }
  }

  for (const winner of winners) {
    const dedupeKey = `monthly_winner:${winner.userId}:${monthKey}`;
    try {
      if (dryRun) {
        // Preview only — do NOT consume the cap or claim a send-log row.
        result.winners.push({ rank: winner.rank, userId: winner.userId, email: winner.email, status: "skipped", reason: "dry_run" });
        result.skipped++;
        continue;
      }

      // Unified governor: CASL consent + digest opt-in + monthly_rank
      // preference toggle + rolling marketing cap, in one decision. The
      // per-month dedupeKey preserves once-per-month dedupe while the governor
      // adds the shared weekly cap. On allow it has claimed the canonical
      // retention_email_log row; the notification_queue reservation below is
      // the per-send status/delivery record.
      const gate = await governMarketingSend({
        userId: winner.userId,
        stream: "monthly_rank",
        emailType: "monthly_leaderboard_winner",
        dedupeKey,
      });
      if (!gate.ok) {
        const reason = gate.reason === "capped" ? "already_sent" : "consent";
        console.log(`[monthly-winner] Governor blocked ${winner.email} for ${monthKey} (${gate.reason})`);
        result.winners.push({ rank: winner.rank, userId: winner.userId, email: winner.email, status: "skipped", reason });
        result.skipped++;
        continue;
      }

      const reservation = await db
        .insert(notificationQueue)
        .values({
          recipientUserId: winner.userId,
          notificationEventId: event!.id,
          channel: "email_resend",
          templateKey: "monthly_leaderboard_winner",
          dedupeKey,
          status: "pending",
          payloadJson: { rank: winner.rank, dealCount: winner.dealCount, monthKey, monthLabel: label },
        })
        .onConflictDoNothing({ target: notificationQueue.dedupeKey })
        .returning({ id: notificationQueue.id });

      if (reservation.length === 0) {
        console.log(`[monthly-winner] Already sent to ${winner.email} for ${monthKey} — skipping`);
        result.winners.push({ rank: winner.rank, userId: winner.userId, email: winner.email, status: "skipped", reason: "already_sent" });
        result.skipped++;
        continue;
      }

      const subject = buildSubject(winner.rank, label, winners.length);
      const html = buildHtml(winner, label, winners.length);
      const text = buildText(winner, label, winners.length);

      const { data, error } = await resendCtx!.client.emails.send({
        from: resendCtx!.fromEmail,
        to: winner.email,
        bcc: REPLY_TO_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        subject,
        html,
        text,
      });

      if (error) {
        await db
          .update(notificationQueue)
          .set({ status: "failed", failureReason: String(error.message || error) })
          .where(sql`${notificationQueue.id} = ${reservation[0].id}`);
        console.error(`[monthly-winner] Send failed for ${winner.email}:`, error);
        result.winners.push({ rank: winner.rank, userId: winner.userId, email: winner.email, status: "error", reason: String(error.message || error) });
        result.errors++;
        continue;
      }

      await db
        .update(notificationQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(sql`${notificationQueue.id} = ${reservation[0].id}`);

      console.log(`[monthly-winner] Sent to ${winner.email} (rank ${winner.rank}, ${winner.dealCount} deals) — id=${(data as any)?.id || "?"}`);
      result.winners.push({ rank: winner.rank, userId: winner.userId, email: winner.email, status: "sent" });
      result.sent++;
      await new Promise((r) => setTimeout(r, 600)); // throttle: ~100/min, gentle on Resend
    } catch (err: any) {
      console.error(`[monthly-winner] Error processing ${winner.email}:`, err);
      result.winners.push({ rank: winner.rank, userId: winner.userId, email: winner.email, status: "error", reason: err?.message || String(err) });
      result.errors++;
    }
  }

  console.log(`[monthly-winner] Complete: attempted=${result.attempted} sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`);
  return result;
}

export function scheduleMonthlyWinnerEmail() {
  cron.schedule("0 14 1 * *", () => {
    console.log("[monthly-winner] Cron triggered");
    sendMonthlyWinnerEmails().catch((err) => console.error("[monthly-winner] Cron error:", err));
  });
  console.log("[monthly-winner] Scheduled: 1st of each month at 9am Toronto time (14:00 UTC)");
}
