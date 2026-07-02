import { useQuery } from "@tanstack/react-query";
import { Bookmark, Eye, Flame, Heart, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

export type ListingEngagement = {
  analyzedCount: number;
  savedCount: number;
  favoritedCount: number;
  watchCount: number;
  noteCount: number;
};

export function useListingEngagement(mlsNumber: string | null | undefined) {
  return useQuery<ListingEngagement>({
    queryKey: [`/api/listings/${encodeURIComponent(mlsNumber || "")}/engagement`],
    enabled: Boolean(mlsNumber),
    staleTime: 2 * 60 * 1000,
  });
}

function Stat({ icon, label, testId }: { icon: ReactNode; label: string; testId: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" data-testid={testId}>
      {icon}
      {label}
    </span>
  );
}

/**
 * Compact per-listing social-proof strip: "Analyzed 14× · Saved 6× · 3 field
 * notes". Hidden entirely while loading or when the listing has no recorded
 * engagement — empty social proof is worse than none.
 */
export function ListingEngagementStrip({
  mlsNumber,
  className = "",
  compact = false,
}: {
  mlsNumber: string | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const { data } = useListingEngagement(mlsNumber);
  if (!data) return null;

  const iconClass = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const parts: ReactNode[] = [];
  if (data.analyzedCount > 0) {
    parts.push(
      <Stat
        key="analyzed"
        icon={<Flame className={`${iconClass} text-orange-500`} />}
        label={`Analyzed ${data.analyzedCount.toLocaleString("en-CA")}×`}
        testId="engagement-analyzed"
      />,
    );
  }
  if (data.savedCount > 0) {
    parts.push(
      <Stat
        key="saved"
        icon={<Bookmark className={`${iconClass} text-primary`} />}
        label={`Saved ${data.savedCount.toLocaleString("en-CA")}×`}
        testId="engagement-saved"
      />,
    );
  }
  if (data.favoritedCount > 0) {
    parts.push(
      <Stat
        key="favorited"
        icon={<Heart className={`${iconClass} text-rose-500`} />}
        label={`${data.favoritedCount.toLocaleString("en-CA")} favourite${data.favoritedCount === 1 ? "" : "s"}`}
        testId="engagement-favorited"
      />,
    );
  }
  if (data.watchCount > 0) {
    parts.push(
      <Stat
        key="watching"
        icon={<Eye className={iconClass} />}
        label={`${data.watchCount.toLocaleString("en-CA")} watching`}
        testId="engagement-watching"
      />,
    );
  }
  if (data.noteCount > 0) {
    parts.push(
      <Stat
        key="notes"
        icon={<MessageSquare className={iconClass} />}
        label={`${data.noteCount.toLocaleString("en-CA")} field note${data.noteCount === 1 ? "" : "s"}`}
        testId="engagement-notes"
      />,
    );
  }
  if (parts.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? "text-xs" : "text-sm"} text-muted-foreground ${className}`}
      data-testid="listing-engagement-strip"
    >
      {parts}
    </div>
  );
}
