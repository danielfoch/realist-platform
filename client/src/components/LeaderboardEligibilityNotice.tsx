import { Shield } from "lucide-react";

interface LeaderboardEligibilityNoticeProps {
  variant?: "full" | "compact";
  className?: string;
}

export function LeaderboardEligibilityNotice({
  variant = "full",
  className = "",
}: LeaderboardEligibilityNoticeProps) {
  if (variant === "compact") {
    return (
      <div
        className={`flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-[11px] leading-snug text-amber-900 dark:text-amber-200 ${className}`}
        data-testid="notice-leaderboard-eligibility-compact"
      >
        <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Deals with metrics more than 3 standard deviations from the platform
          average won&rsquo;t count toward the leaderboard. Underwrite carefully &mdash;
          wild numbers don&rsquo;t beat consistent, realistic ones.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-100 ${className}`}
      data-testid="notice-leaderboard-eligibility"
    >
      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Leaderboard eligibility policy</p>
        <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
          To keep rankings honest, analyses with implausible metrics
          (cap rate outside &minus;10% to 25%, cash-on-cash outside &minus;50% to 60%,
          DSCR outside 0&ndash;4, or anything more than 3 standard deviations from
          the platform mean) are <strong>excluded from the leaderboard</strong>.
          They still appear in your saved analyses, but they don&rsquo;t earn rank
          or weighted score. Underwrite carefully &mdash; consistent, realistic
          deals beat headline-grabbing numbers.
        </p>
      </div>
    </div>
  );
}
