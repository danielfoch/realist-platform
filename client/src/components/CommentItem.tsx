import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommentHelpfulButton } from "@/components/CommentHelpfulButton";
import { CommentReportButton } from "@/components/CommentReportButton";
import { CommentReplyForm } from "@/components/CommentReplyForm";

interface Props {
  comment: any;
  canEdit?: boolean;
  onHelpful?: () => void;
  onReport?: () => void;
  onReply?: (body: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CommentItem({ comment, canEdit, onHelpful, onReport, onReply, onEdit, onDelete }: Props) {
  const [showReply, setShowReply] = useState(false);
  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {comment.userId ? (
              <Link href={`/u/${comment.userId}`}>
                <p className="text-sm font-semibold hover:underline">
                  {comment.user?.displayName || comment.userDisplaySnapshot || "Community investor"}
                </p>
              </Link>
            ) : (
              <p className="text-sm font-semibold">{comment.user?.displayName || comment.userDisplaySnapshot || "Community investor"}</p>
            )}
            {comment.user?.role && comment.user.role !== "investor" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{comment.user.role}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString()}{comment.editedAt ? " · edited" : ""}
          </p>
        </div>
      </div>
      {comment.referencedAnalysisId && (
        <p className="text-[11px] text-muted-foreground">Comment on a saved analysis</p>
      )}
      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
      <div className="flex flex-wrap gap-2">
        <CommentHelpfulButton count={comment.helpfulCount} onClick={onHelpful} />
        {onReply && (
          <Button size="sm" variant="ghost" onClick={() => setShowReply((value) => !value)}>
            Reply
          </Button>
        )}
        <CommentReportButton onClick={onReport} />
        {canEdit && (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
          </>
        )}
      </div>
      {showReply && onReply && <CommentReplyForm onSubmit={onReply} />}
      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <div className="ml-4 space-y-2 border-l border-border/60 pl-4">
          {comment.replies.map((reply: any) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              canEdit={canEdit && reply.userId === comment.currentUserId}
              onHelpful={onHelpful}
              onReport={onReport}
            />
          ))}
        </div>
      )}
    </div>
  );
}
