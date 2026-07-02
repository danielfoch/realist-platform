import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";

type AnalysesCountStats = { total: number; thisWeek: number };

/** Smoothly counts up to `target` whenever it changes. */
function useCountUp(target: number, durationMs = 1400): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setDisplay(0);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}

/**
 * Live "N deals analyzed" social-proof counter fed by
 * GET /api/stats/analyses-count (server caches 60s; we refetch every 60s so
 * the number moves while you watch the page). Renders nothing until a
 * non-zero count arrives, so there is no "0 deals analyzed" flash.
 */
export function AnalysesCounter({
  className = "",
  suffix = "deals analyzed by Canadian investors",
}: {
  className?: string;
  suffix?: string;
}) {
  const { data } = useQuery<AnalysesCountStats>({
    queryKey: ["/api/stats/analyses-count"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
  const total = useCountUp(data?.total ?? 0);

  if (!data || data.total <= 0) return null;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-sm font-medium ${className}`}
      data-testid="analyses-counter"
    >
      <Flame className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="font-mono text-base font-bold tabular-nums text-primary" data-testid="analyses-counter-total">
          {total.toLocaleString("en-CA")}
        </span>{" "}
        {suffix}
      </span>
      {data.thisWeek > 0 && (
        <span className="text-xs text-muted-foreground" data-testid="analyses-counter-week">
          · {data.thisWeek.toLocaleString("en-CA")} this week
        </span>
      )}
    </div>
  );
}
