import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

interface Props {
  count?: number | null;
  hasRecent?: boolean;
}

export function ListingCommentCountBadge({ count, hasRecent }: Props) {
  if (!count) return null;
  return (
    <Badge variant="outline" className="text-[10px]">
      <MessageSquare className="mr-1 h-3 w-3" />
      {count} comments{hasRecent ? " · New discussion" : ""}
    </Badge>
  );
}
