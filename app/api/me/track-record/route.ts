import { getActorStats, getRanks } from "@/lib/analyses/community";
import { badgeProgress } from "@/lib/analyses/profile";
import { getCurrentUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The signed-in member's own numbers. Public pages stay cached for everyone
 * and layer this on in the browser.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ signedIn: false, stats: null, badge: null, rank: null }, { headers: NO_STORE });

  try {
    const [stats, { week, month, all }] = await Promise.all([getActorStats(`user:${user.id}`), getRanks(user.id)]);
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
