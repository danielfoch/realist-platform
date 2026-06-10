import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users } from "lucide-react";
import type { ListingAnalysisAggregate } from "@shared/schema";

interface Props {
  aggregate?: ListingAnalysisAggregate | null;
}

export function CommunityAnalysisBadge({ aggregate }: Props) {
  if (!aggregate || ((aggregate.publicAnalysisCount || 0) === 0 && (aggregate.publicCommentCount || 0) === 0)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="text-[10px]">
        <Users className="mr-1 h-3 w-3" />
        {(aggregate.publicAnalysisCount || 0)} analyses
      </Badge>
      {(aggregate.publicCommentCount || 0) > 0 && (
        <Badge variant="outline" className="text-[10px]">
          <MessageSquare className="mr-1 h-3 w-3" />
          {aggregate.publicCommentCount} comments
        </Badge>
      )}
      {aggregate.consensusLabel && (
        <Badge variant="outline" className="text-[10px] capitalize">
          {aggregate.consensusLabel}
        </Badge>
      )}
    </div>
  );
}
