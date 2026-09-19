import { getPublicProfile } from "@/lib/analyses/profile";
import { OG_CONTENT_TYPE, OG_SIZE, shareCard } from "@/lib/og/card";

export const alt = "An investor's track record on Realist";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Only what the profile page itself shows: a first name and initial, counts, markets. Never a deal. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id).catch(() => null);
  if (!profile) return shareCard({ eyebrow: "Track records", title: "Who's underwriting the most deals in Canada?" });

  const markets = profile.topMarkets.slice(0, 3).map((market) => market.city).join(" · ");
  return shareCard({
    eyebrow: profile.badge.name ? `${profile.badge.name} · track record` : "Track record",
    title: profile.name,
    subtitle: markets ? `Underwrites ${markets}` : profile.city,
    stats: [
      { label: "Deals underwritten", value: profile.stats.deals.toLocaleString("en-CA") },
      { label: "Streak", value: `${profile.stats.streakWeeks} wk` },
      ...(profile.medianCapRate != null ? [{ label: "Median cap rate", value: `${profile.medianCapRate.toFixed(1)}%` }] : []),
    ],
    footer: "Underwrite a deal and get on the board — realist.ca",
  });
}
