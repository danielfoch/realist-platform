import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { publicName } from "@/lib/analyses/dealKey";

/** The week that just ended, as a board. Computed once per cron run and shared by every email. */
export interface LastWeekRow {
  rank: number;
  userId: string;
  name: string;
  city: string | null;
  deals: number;
}

export async function getLastWeekBoard(limit = 1000): Promise<LastWeekRow[]> {
  const result = await getDb().execute(sql`
    SELECT u.id AS user_id, u.name, u.city, count(*)::int AS deals, round(sum(a.quality) * 10)::int AS score
    FROM deal_analyses a JOIN users u ON u.id = a.user_id
    WHERE a.eligible AND u.show_on_leaderboard
      AND a.created_at >= date_trunc('week', now() AT TIME ZONE 'utc') - interval '7 days'
      AND a.created_at < date_trunc('week', now() AT TIME ZONE 'utc')
    GROUP BY u.id, u.name, u.city
    ORDER BY score DESC, deals DESC, min(a.created_at) ASC
    LIMIT ${limit}
  `);
  return (result.rows as Array<Record<string, unknown>>).map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id),
    name: publicName(row.name as string | null),
    city: (row.city as string | null) ?? null,
    deals: Number(row.deals),
  }));
}

/**
 * Who gets this week's digest: consented members who have underwritten at
 * least one deal and haven't been sent one in the last six days.
 */
export async function digestRecipients(limit: number): Promise<User[]> {
  const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000);
  return getDb()
    .select()
    .from(users)
    .where(
      and(
        eq(users.consentMarketing, true),
        or(isNull(users.lastDigestAt), lt(users.lastDigestAt, sixDaysAgo)),
        sql`EXISTS (SELECT 1 FROM deal_analyses a WHERE a.user_id = ${users.id} AND a.eligible)`,
      ),
    )
    .limit(limit);
}
