import { CommentComposer } from "@/components/CommentComposer";
import { CommentList } from "@/components/CommentList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  comments: any[];
  currentUserId?: string | null;
  sort: "newest" | "oldest" | "most_helpful" | "pinned";
  onSortChange: (sort: "newest" | "oldest" | "most_helpful" | "pinned") => void;
  onSubmitComment: (body: string, visibility: "public" | "private") => void;
  onHelpful?: (commentId: string) => void;
  onReport?: (commentId: string) => void;
  onReply?: (commentId: string, body: string) => void;
  onDelete?: (commentId: string) => void;
  isAuthenticated: boolean;
}

export function ListingCommentsSection({
  comments,
  currentUserId,
  sort,
  onSortChange,
  onSubmitComment,
  onHelpful,
  onReport,
  onReply,
  onDelete,
  isAuthenticated,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Community comments</p>
          <p className="text-xs text-muted-foreground">{comments.length} public comments</p>
        </div>
        <Select value={sort} onValueChange={(value) => onSortChange(value as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pinned">Pinned first</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="most_helpful">Most helpful</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isAuthenticated ? (
        <CommentComposer onSubmit={onSubmitComment} />
      ) : (
        <p className="text-sm text-muted-foreground">Sign in to join the discussion.</p>
      )}
      <CommentList
        comments={comments}
        currentUserId={currentUserId}
        onHelpful={onHelpful}
        onReport={onReport}
        onReply={onReply}
        onDelete={onDelete}
      />
    </div>
  );
}
