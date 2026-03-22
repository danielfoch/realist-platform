import crypto from "crypto";
import cron from "node-cron";
import { db } from "./db";
import { users, analyses } from "@shared/schema";
import { sql, eq, count, desc, and, isNotNull, ne } from "drizzle-orm";
import { getResendClient } from "./resend";

const UNSUBSCRIBE_SECRET = process.env.SESSION_SECRET || "realist-digest-secret";

export function generateUnsubscribeToken(userId: string): string {
  return crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(userId).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(userId);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

interface WeeklyStats {
  totalDeals: number;
  avgCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
  mostActiveCity: string | null;
  mostActiveCityDeals: number;
}

interface UserWeeklyStats {
  userDeals: number;
  userAvgCapRate: number | null;
  rank: number | null;
  totalUsers: number;
}

function getLastWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const torontoNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const dayOfWeek = torontoNow.getDay();
  const lastMonday = new Date(torontoNow);
  lastMonday.setDate(torontoNow.getDate() - dayOfWeek - 6);
  lastMonday.setHours(0, 0, 0, 0);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 7);

  return { weekStart: lastMonday.toISOString(), weekEnd: lastSunday.toISOString() };
}

async function getPlatformWeeklyStats(): Promise<WeeklyStats> {
  const { weekStart, weekEnd } = getLastWeekBounds();

  const [stats] = await db
    .select({
      totalDeals: count(analyses.id),
      avgCapRate: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'capRate')::numeric ELSE NULL END)`,
      avgCashOnCash: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'cashOnCash') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'cashOnCash')::numeric ELSE NULL END)`,
      avgDscr: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'dscr') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'dscr')::numeric ELSE NULL END)`,
    })
    .from(analyses)
    .where(sql`${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStart} AND ${analyses.createdAt} < ${weekEnd}`);

  const cityResult = await db
    .select({
      city: analyses.city,
      dealCount: count(analyses.id),
    })
    .from(analyses)
    .where(sql`${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStart} AND ${analyses.createdAt} < ${weekEnd} AND ${analyses.city} IS NOT NULL AND ${analyses.city} != ''`)
    .groupBy(analyses.city)
    .orderBy(desc(count(analyses.id)))
    .limit(1);

  return {
    totalDeals: Number(stats?.totalDeals || 0),
    avgCapRate: stats?.avgCapRate != null ? Math.round(Number(stats.avgCapRate) * 100) / 100 : null,
    avgCashOnCash: stats?.avgCashOnCash != null ? Math.round(Number(stats.avgCashOnCash) * 100) / 100 : null,
    avgDscr: stats?.avgDscr != null ? Math.round(Number(stats.avgDscr) * 100) / 100 : null,
    mostActiveCity: cityResult.length > 0 ? cityResult[0].city : null,
    mostActiveCityDeals: cityResult.length > 0 ? Number(cityResult[0].dealCount) : 0,
  };
}

async function getUserWeeklyStats(userId: string): Promise<UserWeeklyStats> {
  const { weekStart, weekEnd } = getLastWeekBounds();

  const [userStats] = await db
    .select({
      userDeals: count(analyses.id),
      userAvgCapRate: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'capRate')::numeric ELSE NULL END)`,
    })
    .from(analyses)
    .where(sql`${analyses.userId} = ${userId} AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStart} AND ${analyses.createdAt} < ${weekEnd}`);

  const rankings = await db
    .select({
      rankUserId: analyses.userId,
      dealCount: count(analyses.id),
    })
    .from(analyses)
    .where(sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStart} AND ${analyses.createdAt} < ${weekEnd}`)
    .groupBy(analyses.userId)
    .orderBy(desc(count(analyses.id)));

  const rank = rankings.findIndex(r => r.rankUserId === userId) + 1;

  return {
    userDeals: Number(userStats?.userDeals || 0),
    userAvgCapRate: userStats?.userAvgCapRate != null ? Math.round(Number(userStats.userAvgCapRate) * 100) / 100 : null,
    rank: rank > 0 ? rank : null,
    totalUsers: rankings.length,
  };
}

function getWeekDateRange(): { start: string; end: string } {
  const { weekStart, weekEnd } = getLastWeekBounds();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { start: fmt(weekStart), end: fmt(weekEnd) };
}

function buildDigestHtml(
  firstName: string,
  platform: WeeklyStats,
  user: UserWeeklyStats,
  unsubscribeUrl: string
): string {
  const { start, end } = getWeekDateRange();

  const kpiCard = (label: string, value: string, color: string) => `
    <td style="width: 50%; padding: 8px;">
      <div style="background: ${color}10; border: 1px solid ${color}30; border-radius: 8px; padding: 14px; text-align: center;">
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: ${color};">${value}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
      </div>
    </td>
  `;

  const userSection = user.userDeals > 0 ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #166534;">Your Week</p>
      <table style="width: 100%;"><tr>
        ${kpiCard('Deals Analyzed', String(user.userDeals), '#16a34a')}
        ${kpiCard('Avg Cap Rate', user.userAvgCapRate != null ? user.userAvgCapRate.toFixed(1) + '%' : '\u2014', '#2563eb')}
      </tr></table>
      ${user.rank ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #374151; text-align: center;">You ranked <strong>#${user.rank}</strong> of ${user.totalUsers} active analysts this week</p>` : ''}
    </div>
  ` : `
    <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #854d0e;">You didn't analyze any deals last week.</p>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #a16207;">Jump back in \u2014 every deal sharpens your edge.</p>
    </div>
  `;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 24px; border-radius: 8px 8px 0 0;">
        <p style="margin: 0; font-size: 13px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Weekly Digest</p>
        <h1 style="margin: 4px 0 0 0; font-size: 22px; color: white; font-weight: 700;">Realist.ca</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">${start} \u2014 ${end}</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #111827;">
          Hey ${firstName || 'there'},
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #374151; line-height: 1.6;">
          Here's what happened on Realist.ca last week:
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e293b;">Platform Highlights</p>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
            <tr>
              ${kpiCard('Total Deals', String(platform.totalDeals), '#8b5cf6')}
              ${kpiCard('Avg Cap Rate', platform.avgCapRate != null ? platform.avgCapRate.toFixed(1) + '%' : '\u2014', '#f59e0b')}
            </tr>
            <tr>
              ${kpiCard('Avg Cash-on-Cash', platform.avgCashOnCash != null ? platform.avgCashOnCash.toFixed(1) + '%' : '\u2014', '#10b981')}
              ${kpiCard('Avg DSCR', platform.avgDscr != null ? platform.avgDscr.toFixed(2) + 'x' : '\u2014', '#3b82f6')}
            </tr>
          </table>
          ${platform.mostActiveCity ? `
            <p style="margin: 12px 0 0 0; font-size: 13px; color: #475569; text-align: center;">
              Hottest market: <strong>${platform.mostActiveCity}</strong> (${platform.mostActiveCityDeals} deals)
            </p>
          ` : ''}
        </div>

        ${userSection}

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://realist.ca" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Analyze a Deal Now
          </a>
        </div>
        <div style="text-align: center; margin: 12px 0;">
          <a href="https://realist.ca/my-performance?source=email" style="color: #2563eb; text-decoration: none; font-size: 13px;">
            View My Performance Dashboard \u2192
          </a>
        </div>
      </div>

      <div style="padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background: #f9fafb;">
        <p style="margin: 0; text-align: center; color: #9ca3af; font-size: 11px;">
          Realist.ca \u2014 Canada's #1 Real Estate Deal Analyzer
        </p>
        <p style="margin: 8px 0 0 0; text-align: center;">
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline; font-size: 11px;">
            Unsubscribe from weekly digest
          </a>
        </p>
      </div>
    </div>
  `;
}

export async function sendWeeklyDigest(): Promise<{ sent: number; skipped: number; errors: number }> {
  console.log("[weekly-digest] Starting weekly digest...");

  const platform = await getPlatformWeeklyStats();
  console.log(`[weekly-digest] Platform stats: ${platform.totalDeals} deals, cap rate ${platform.avgCapRate}%`);

  if (platform.totalDeals === 0) {
    console.log("[weekly-digest] No deals analyzed last week, skipping digest");
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const recipients = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
    })
    .from(users)
    .where(
      and(
        sql`${users.emailDigestOptIn} IS NOT FALSE`,
        isNotNull(users.email),
        ne(users.email, '')
      )
    );

  console.log(`[weekly-digest] Found ${recipients.length} opted-in users`);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  let resendClient;
  try {
    resendClient = await getResendClient();
  } catch (err) {
    console.error("[weekly-digest] Failed to get Resend client:", err);
    return { sent: 0, skipped: 0, errors: recipients.length };
  }

  for (const recipient of recipients) {
    try {
      const userStats = await getUserWeeklyStats(recipient.id);
      const token = generateUnsubscribeToken(recipient.id);
      const unsubscribeUrl = `https://realist.ca/api/email/unsubscribe?uid=${encodeURIComponent(recipient.id)}&token=${token}`;

      const html = buildDigestHtml(
        recipient.firstName || '',
        platform,
        userStats,
        unsubscribeUrl
      );

      const { start, end } = getWeekDateRange();

      const result = await resendClient.client.emails.send({
        from: resendClient.fromEmail,
        to: recipient.email,
        subject: `Realist Weekly: ${platform.totalDeals} deals analyzed (${start}\u2013${end})`,
        html,
      });

      if ((result as any)?.error) {
        console.error(`[weekly-digest] Resend error for ${recipient.email}:`, (result as any).error);
        errors++;
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[weekly-digest] Error sending to ${recipient.email}:`, err);
      errors++;
    }
  }

  console.log(`[weekly-digest] Complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);
  return { sent, skipped, errors };
}

export function scheduleWeeklyDigest() {
  cron.schedule("0 14 * * 1", () => {
    console.log("[weekly-digest] Cron triggered");
    sendWeeklyDigest().catch(err => console.error("[weekly-digest] Cron error:", err));
  });
  console.log("[weekly-digest] Scheduled: Mondays at 9am Toronto time (14:00 UTC)");
}
