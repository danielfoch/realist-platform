import { CommentItem } from "@/components/CommentItem";

interface Props {
  comments: any[];
  currentUserId?: string | null;
  onHelpful?: (commentId: string) => void;
  onReport?: (commentId: string) => void;
  onReply?: (commentId: string, body: string) => void;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

export function CommentList({ comments, currentUserId, onHelpful, onReport, onReply, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={{ ...comment, currentUserId }}
          canEdit={comment.userId === currentUserId}
          onHelpful={onHelpful ? () => onHelpful(comment.id) : undefined}
          onReport={onReport ? () => onReport(comment.id) : undefined}
          onReply={onReply ? (body) => onReply(comment.id, body) : undefined}
          onEdit={onEdit ? () => onEdit(comment.id) : undefined}
          onDelete={onDelete ? () => onDelete(comment.id) : undefined}
        />
      ))}
    </div>
  );
}
