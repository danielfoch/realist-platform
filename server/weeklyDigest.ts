import crypto from "crypto";
import cron from "node-cron";
import { db } from "./db";
import { users, analyses, notificationEvents, notificationQueue } from "@shared/schema";
import { sql, count, desc, and, isNotNull, ne } from "drizzle-orm";
import { storage } from "./storage";

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

interface WeeklyLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  dealCount: number;
  avgCapRate: number | null;
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

interface AllTimeStats {
  totalDeals: number;
  avgCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
  totalUsers: number;
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

async function getAllTimeStats(): Promise<AllTimeStats> {
  const [stats] = await db
    .select({
      totalDeals: count(analyses.id),
      avgCapRate: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'capRate')::numeric ELSE NULL END)`,
      avgCashOnCash: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'cashOnCash') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'cashOnCash')::numeric ELSE NULL END)`,
      avgDscr: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'dscr') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'dscr')::numeric ELSE NULL END)`,
    })
    .from(analyses)
    .where(sql`${analyses.resultsJson} IS NOT NULL`);

  const [userCount] = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${analyses.userId})` })
    .from(analyses)
    .where(sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL`);

  return {
    totalDeals: Number(stats?.totalDeals || 0),
    avgCapRate: stats?.avgCapRate != null ? Math.round(Number(stats.avgCapRate) * 100) / 100 : null,
    avgCashOnCash: stats?.avgCashOnCash != null ? Math.round(Number(stats.avgCashOnCash) * 100) / 100 : null,
    avgDscr: stats?.avgDscr != null ? Math.round(Number(stats.avgDscr) * 100) / 100 : null,
    totalUsers: Number(userCount?.total || 0),
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

async function getWeeklyTopAnalysts(limit = 5): Promise<WeeklyLeaderboardEntry[]> {
  const { weekStart, weekEnd } = getLastWeekBounds();
  const rows = await db
    .select({
      userId: analyses.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      dealCount: count(analyses.id),
      avgCapRate: sql<number>`AVG(CASE WHEN (${analyses.resultsJson}->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${analyses.resultsJson}->>'capRate')::numeric ELSE NULL END)`,
    })
    .from(analyses)
    .leftJoin(users, sql`${users.id} = ${analyses.userId}`)
    .where(sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStart} AND ${analyses.createdAt} < ${weekEnd}`)
    .groupBy(analyses.userId, users.firstName, users.lastName)
    .orderBy(desc(count(analyses.id)))
    .limit(limit);

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId || "",
    name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Anonymous",
    dealCount: Number(row.dealCount || 0),
    avgCapRate: row.avgCapRate != null ? Math.round(Number(row.avgCapRate) * 10) / 10 : null,
  }));
}

function getWeekDateRange(): { start: string; end: string } {
  const { weekStart, weekEnd } = getLastWeekBounds();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const inclusiveEnd = new Date(weekEnd);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  return { start: fmt(weekStart), end: fmt(inclusiveEnd.toISOString()) };
}

function buildTacticalInsight(platform: WeeklyStats, leaderboard: WeeklyLeaderboardEntry[]): string {
  if (platform.totalDeals === 0) {
    return "Quiet weeks are where disciplined operators build the most edge. One underwritten deal now puts you ahead of the pack next Monday.";
  }
  if (platform.avgCapRate != null && platform.avgCapRate >= 6.5) {
    return `This week skewed toward yield. With average cap rates around ${platform.avgCapRate.toFixed(1)}%, investors should pressure-test financing assumptions before chasing headline returns.`;
  }
  if (platform.mostActiveCity) {
    return `${platform.mostActiveCity} generated the most underwriting activity this week. When one city leads volume, it usually means more comps, faster feedback loops, and tighter pricing discipline.`;
  }
  if (leaderboard.length > 0) {
    return `Top analysts did ${leaderboard[0].dealCount}+ writeups this week. Consistency is still the clearest advantage on the board.`;
  }
  return "The weekly board rewards repetition more than hero bets. A few clean writeups every week compounds faster than sporadic bursts.";
}

function buildDigestText(
  firstName: string,
  platform: WeeklyStats,
  user: UserWeeklyStats,
  allTime: AllTimeStats,
  leaderboard: WeeklyLeaderboardEntry[],
  insight: string,
  unsubscribeUrl: string,
): string {
  const { start, end } = getWeekDateRange();
  const lines = [
    `Hey ${firstName || "there"},`,
    "",
    `Your Realist weekly leaderboard update for ${start} to ${end}.`,
    "",
    `This week: ${platform.totalDeals} deals analyzed`,
    `Avg cap rate: ${platform.avgCapRate != null ? `${platform.avgCapRate.toFixed(1)}%` : "n/a"}`,
    `Avg cash-on-cash: ${platform.avgCashOnCash != null ? `${platform.avgCashOnCash.toFixed(1)}%` : "n/a"}`,
    `Avg DSCR: ${platform.avgDscr != null ? `${platform.avgDscr.toFixed(2)}x` : "n/a"}`,
    platform.mostActiveCity ? `Top market: ${platform.mostActiveCity} (${platform.mostActiveCityDeals} deals)` : null,
    "",
    `Your week: ${user.userDeals} deals analyzed`,
    `Your avg cap rate: ${user.userAvgCapRate != null ? `${user.userAvgCapRate.toFixed(1)}%` : "n/a"}`,
    user.rank ? `Your weekly rank: #${user.rank} of ${user.totalUsers}` : "You were not ranked this week yet.",
    "",
    "Top weekly analysts:",
    ...leaderboard.map((entry) => `#${entry.rank} ${entry.name} - ${entry.dealCount} deals${entry.avgCapRate != null ? ` - ${entry.avgCapRate.toFixed(1)}% avg cap` : ""}`),
    "",
    `Investor insight: ${insight}`,
    "",
    `All-time: ${allTime.totalDeals} deals analyzed across ${allTime.totalUsers} active analysts.`,
    "Leaderboard: https://realist.ca/community/leaderboard?source=email",
    "My Performance: https://realist.ca/my-performance?source=email",
    "Analyze a Deal: https://realist.ca/tools/cap-rates?source=email",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildDigestHtml(
  firstName: string,
  platform: WeeklyStats,
  user: UserWeeklyStats,
  allTime: AllTimeStats,
  leaderboard: WeeklyLeaderboardEntry[],
  insight: string,
  unsubscribeUrl: string
): string {
  const { start, end } = getWeekDateRange();
  const isQuietWeek = platform.totalDeals === 0;

  const kpiCard = (label: string, value: string, color: string) => `
    <td style="width: 50%; padding: 8px;">
      <div style="background: ${color}10; border: 1px solid ${color}30; border-radius: 8px; padding: 14px; text-align: center;">
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: ${color};">${value}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
      </div>
    </td>
  `;

  const weeklySection = isQuietWeek ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center;">
      <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">This Week on the Platform</p>
      <p style="margin: 0; font-size: 13px; color: #64748b;">Quiet week — no deals were analyzed. Be the first to break the streak!</p>
    </div>
  ` : `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e293b;">This Week</p>
      <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
        <tr>
          ${kpiCard('Deals Analyzed', String(platform.totalDeals), '#8b5cf6')}
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
  `;

  const allTimeSection = `
    <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #581c87;">All-Time Platform Stats</p>
      <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
        <tr>
          ${kpiCard('Total Deals', String(allTime.totalDeals), '#7c3aed')}
          ${kpiCard('Active Analysts', String(allTime.totalUsers), '#6d28d9')}
        </tr>
        <tr>
          ${kpiCard('Avg Cap Rate', allTime.avgCapRate != null ? allTime.avgCapRate.toFixed(1) + '%' : '\u2014', '#f59e0b')}
          ${kpiCard('Avg Cash-on-Cash', allTime.avgCashOnCash != null ? allTime.avgCashOnCash.toFixed(1) + '%' : '\u2014', '#10b981')}
        </tr>
        <tr>
          ${kpiCard('Avg DSCR', allTime.avgDscr != null ? allTime.avgDscr.toFixed(2) + 'x' : '\u2014', '#3b82f6')}
          <td style="width: 50%; padding: 8px;"></td>
        </tr>
      </table>
    </div>
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

  const leaderboardRows = leaderboard.length > 0 ? leaderboard.map((entry, index) => `
    <tr>
      <td style="padding: 12px 10px; border-bottom: ${index === leaderboard.length - 1 ? "none" : "1px solid #e5e7eb"}; font-size: 13px; color: #111827; font-weight: 700;">#${entry.rank}</td>
      <td style="padding: 12px 10px; border-bottom: ${index === leaderboard.length - 1 ? "none" : "1px solid #e5e7eb"}; font-size: 13px; color: #111827;">${entry.name}</td>
      <td style="padding: 12px 10px; border-bottom: ${index === leaderboard.length - 1 ? "none" : "1px solid #e5e7eb"}; font-size: 13px; color: #475569; text-align: right;">${entry.dealCount}</td>
      <td style="padding: 12px 10px; border-bottom: ${index === leaderboard.length - 1 ? "none" : "1px solid #e5e7eb"}; font-size: 13px; color: #475569; text-align: right;">${entry.avgCapRate != null ? `${entry.avgCapRate.toFixed(1)}%` : '\u2014'}</td>
    </tr>
  `).join("") : `
    <tr>
      <td colspan="4" style="padding: 16px; text-align: center; color: #64748b; font-size: 13px;">No analysts ranked this week yet.</td>
    </tr>
  `;

  const leaderboardSection = `
    <div style="background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%); border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #9a3412;">Weekly Leaderboard</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th align="left" style="padding: 0 10px 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;">Rank</th>
            <th align="left" style="padding: 0 10px 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;">Analyst</th>
            <th align="right" style="padding: 0 10px 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;">Deals</th>
            <th align="right" style="padding: 0 10px 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;">Avg Cap</th>
          </tr>
        </thead>
        <tbody>${leaderboardRows}</tbody>
      </table>
    </div>
  `;

  const insightSection = `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1d4ed8;">Tactical Investor Insight</p>
      <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.6;">${insight}</p>
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
          Here's your weekly update from Realist.ca:
        </p>

        ${weeklySection}
        ${leaderboardSection}
        ${allTimeSection}
        ${userSection}
        ${insightSection}

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://realist.ca/community/leaderboard?source=email" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 6px 12px 6px;">
            View Full Leaderboard
          </a>
          <a href="https://realist.ca/tools/cap-rates?source=email" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 6px 12px 6px;">
            Analyze a Deal
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
  console.log("[weekly-digest] Starting weekly digest queue...");

  const platform = await getPlatformWeeklyStats();
  const allTime = await getAllTimeStats();
  const leaderboard = await getWeeklyTopAnalysts(5);
  const insight = buildTacticalInsight(platform, leaderboard);
  console.log(`[weekly-digest] Platform stats: ${platform.totalDeals} weekly deals, ${allTime.totalDeals} all-time deals, cap rate ${platform.avgCapRate}%`);

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
  const { weekStart } = getLastWeekBounds();
  const weekKey = weekStart.slice(0, 10);
  const { start, end } = getWeekDateRange();

  const eventPayload = {
    weekStart,
    leaderboard,
    platform,
    allTime,
    insight,
  };

  const [event] = await db.insert(notificationEvents).values({
    eventType: "weekly_leaderboard_digest",
    payloadJson: eventPayload,
    city: platform.mostActiveCity || null,
  }).returning({ id: notificationEvents.id });

  for (const recipient of recipients) {
    try {
      const allowsDigest = await storage.getNotificationPreference(recipient.id);
      if (allowsDigest && !allowsDigest.digestEnabled) {
        skipped++;
        continue;
      }

      const userStats = await getUserWeeklyStats(recipient.id);
      const token = generateUnsubscribeToken(recipient.id);
      const unsubscribeUrl = `https://realist.ca/api/email/unsubscribe?uid=${encodeURIComponent(recipient.id)}&token=${token}`;

      const html = buildDigestHtml(
        recipient.firstName || '',
        platform,
        userStats,
        allTime,
        leaderboard,
        insight,
        unsubscribeUrl
      );
      const text = buildDigestText(
        recipient.firstName || "",
        platform,
        userStats,
        allTime,
        leaderboard,
        insight,
        unsubscribeUrl,
      );

      const subject = platform.totalDeals > 0
        ? `Realist Weekly: ${platform.totalDeals} deals analyzed (${start}\u2013${end})`
        : `Realist Weekly: Your ${start}\u2013${end} update (${allTime.totalDeals} deals all-time)`;
      const previewText = userStats.rank
        ? `You ranked #${userStats.rank} this week. See who is moving on the Realist board.`
        : "See this week’s Realist leaderboard, platform stats, and tactical investor signal.";
      const dedupeKey = `weekly_leaderboard_digest:${recipient.id}:${weekKey}`;

      const inserted = await db.insert(notificationQueue).values({
        recipientUserId: recipient.id,
        notificationEventId: event.id,
        channel: "ghl_webhook",
        templateKey: "weekly_leaderboard_digest",
        dedupeKey,
        payloadJson: {
          sendEmail: true,
          eventType: "weekly_leaderboard_digest",
          eventId: event.id,
          eventTs: new Date().toISOString(),
          email: recipient.email,
          phone: null,
          firstName: recipient.firstName || "there",
          reasonText: userStats.rank
            ? `You ranked #${userStats.rank} out of ${userStats.totalUsers} active analysts this week.`
            : `Weekly leaderboard update for ${start} to ${end}.`,
          ctaLabel: "View full leaderboard",
          ctaUrl: "https://realist.ca/community/leaderboard?source=email",
          subjectLine: subject,
          previewText,
          emailBody: text,
          emailHtml: html,
          ghlTags: ["realist-user", "weekly-digest", "weekly-leaderboard"],
          leadScoreDelta: userStats.userDeals > 0 ? 2 : 0,
          leaderboardPeriod: "weekly",
          weeklyRank: userStats.rank,
          weeklyDeals: userStats.userDeals,
          weeklyTopAnalysts: leaderboard,
          platformTotalDeals: platform.totalDeals,
          platformAvgCapRate: platform.avgCapRate,
          platformAvgCashOnCash: platform.avgCashOnCash,
          platformAvgDscr: platform.avgDscr,
          insight,
          unsubscribeUrl,
        },
        scheduledFor: new Date(),
      }).onConflictDoNothing({
        target: notificationQueue.dedupeKey,
      }).returning({ id: notificationQueue.id });

      if (!inserted.length) {
        skipped++;
        continue;
      }

      sent++;
    } catch (err) {
      console.error(`[weekly-digest] Error queueing for ${recipient.email}:`, err);
      errors++;
    }
  }

  console.log(`[weekly-digest] Queue complete: ${sent} queued, ${skipped} skipped, ${errors} errors`);
  return { sent, skipped, errors };
}

export function scheduleWeeklyDigest() {
  cron.schedule("0 14 * * 1", () => {
    console.log("[weekly-digest] Cron triggered");
    sendWeeklyDigest().catch(err => console.error("[weekly-digest] Cron error:", err));
  });
  console.log("[weekly-digest] Scheduled: Mondays at 9am Toronto time (14:00 UTC)");
}
