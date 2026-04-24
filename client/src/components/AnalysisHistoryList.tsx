import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ThumbsDown, ThumbsUp } from "lucide-react";

interface Props {
  analyses: any[];
  onDuplicate?: (analysisId: string) => void;
  onFeedback?: (analysisId: string, feedbackType: "useful" | "not_useful" | "disagree") => void;
}

function metricValue(analysis: any, key: string): number | null {
  const value = analysis?.calculatedMetrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function AnalysisHistoryList({ analyses, onDuplicate, onFeedback }: Props) {
  if (!analyses.length) {
    return <p className="text-sm text-muted-foreground">No public analyses yet for this listing.</p>;
  }

  return (
    <div className="space-y-3">
      {analyses.map((analysis) => (
        <div key={analysis.id} className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{analysis.title || analysis.user?.displayName || "Community analysis"}</p>
              <p className="text-xs text-muted-foreground">
                {analysis.user?.displayName || "Community investor"} · {new Date(analysis.createdAt).toLocaleDateString()}
              </p>
            </div>
            {analysis.sentiment && <Badge variant="outline" className="capitalize">{analysis.sentiment}</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {metricValue(analysis, "capRate") != null && <span>{metricValue(analysis, "capRate")?.toFixed(1)}% cap</span>}
            {metricValue(analysis, "cashOnCash") != null && <span>{metricValue(analysis, "cashOnCash")?.toFixed(1)}% CoC</span>}
            {metricValue(analysis, "monthlyCashFlow") != null && <span>${Math.round(metricValue(analysis, "monthlyCashFlow") || 0).toLocaleString()}/mo</span>}
          </div>
          {analysis.summary && <p className="text-sm">{analysis.summary}</p>}
          {analysis.userNotes && <p className="text-sm text-muted-foreground">{analysis.userNotes}</p>}
          <div className="flex flex-wrap gap-2">
            {onDuplicate && (
              <Button size="sm" variant="outline" onClick={() => onDuplicate(analysis.id)}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Duplicate
              </Button>
            )}
            {onFeedback && (
              <>
                <Button size="sm" variant="ghost" onClick={() => onFeedback(analysis.id, "useful")}>
                  <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                  Useful
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onFeedback(analysis.id, "not_useful")}>
                  <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                  Not useful
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onFeedback(analysis.id, "disagree")}>
                  I disagree
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
