import { getLeaderboard, getActorStats, type LeaderboardPeriod } from "@/lib/analyses/community";
import { badgeProgress } from "@/lib/analyses/profile";
import { getCurrentUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** A place is looked up within this many rows of the board; past it, "not ranked yet". */
const RANK_DEPTH = 500;
const PERIODS: LeaderboardPeriod[] = ["week", "month", "all"];

/**
 * The signed-in member's own numbers. Public pages stay cached for everyone
 * and layer this on in the browser.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ signedIn: false, stats: null, badge: null, rank: null }, { headers: NO_STORE });

  try {
    const [stats, ...boards] = await Promise.all([
      getActorStats(`user:${user.id}`),
      // Members who opted out aren't on any board, so there is nothing to look up.
      ...PERIODS.map((period) => (user.showOnLeaderboard ? getLeaderboard(period, { limit: RANK_DEPTH }) : Promise.resolve([]))),
    ]);
    const [week, month, all] = boards.map((rows) => rows.find((row) => row.userId === user.id)?.rank ?? null);
    return Response.json(
      {
        signedIn: true,
        userId: user.id,
        showOnLeaderboard: user.showOnLeaderboard,
        stats,
        badge: badgeProgress(stats.deals),
        rank: { week, month, all },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[track-record]", (error as Error).message);
    return Response.json({ signedIn: true, stats: null, badge: null, rank: null }, { status: 503, headers: NO_STORE });
  }
}
