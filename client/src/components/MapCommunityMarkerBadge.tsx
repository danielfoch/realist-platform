interface Props {
  analysisCount?: number | null;
  commentCount?: number | null;
  consensusLabel?: string | null;
}

export function MapCommunityMarkerBadge({ analysisCount, commentCount, consensusLabel }: Props) {
  const total = (analysisCount || 0) + (commentCount || 0);
  if (!total) return null;
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
      <span>{total}</span>
      {consensusLabel && <span className="capitalize text-white/80">{consensusLabel}</span>}
    </div>
  );
}
