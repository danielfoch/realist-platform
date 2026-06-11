import { useQuery } from "@tanstack/react-query";
import type { RealistSponsor } from "./types";

const TIER_ORDER: Record<string, number> = { title: 0, gold: 1, silver: 2, partner: 3 };

export function SponsorStrip({ heading = "Our sponsors" }: { heading?: string }) {
  const { data: sponsors } = useQuery<RealistSponsor[]>({
    queryKey: ["/api/sponsors"],
    staleTime: 5 * 60 * 1000,
  });

  if (!sponsors?.length) return null;

  const sorted = [...sponsors].sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.sortOrder - b.sortOrder,
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{heading}</h2>
      <div className="flex flex-wrap items-center gap-6">
        {sorted.map((sponsor) => {
          const inner = sponsor.logoUrl ? (
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              title={sponsor.blurb || sponsor.name}
              className="h-12 max-w-[160px] object-contain opacity-80 transition hover:opacity-100"
            />
          ) : (
            <span className="text-sm font-medium text-muted-foreground hover:text-foreground">{sponsor.name}</span>
          );
          return sponsor.websiteUrl ? (
            <a key={sponsor.id} href={sponsor.websiteUrl} target="_blank" rel="noreferrer sponsored">
              {inner}
            </a>
          ) : (
            <span key={sponsor.id}>{inner}</span>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Want your brand in front of Canada's most active real estate investors?{" "}
        <a className="underline" href="mailto:jonathan@realist.ca?subject=Realist%20sponsorship">Become a sponsor</a>.
      </p>
    </section>
  );
}
