import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";
import { MessageSquare, Reply, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface EventComment {
  id: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  authorName: string;
  isMine: boolean;
}

function CommentBody({
  comment,
  onReply,
  onDelete,
  canReply,
}: {
  comment: EventComment;
  onReply?: () => void;
  onDelete: (id: string) => void;
  canReply: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{comment.authorName}</span>
        <span className="text-xs text-muted-foreground">{format(new Date(comment.createdAt), "MMM d, h:mm a")}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
      <div className="flex gap-3">
        {canReply && onReply && (
          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={onReply}>
            <Reply className="h-3 w-3" /> Reply
          </button>
        )}
        {comment.isMine && (
          <button
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
            onClick={() => onDelete(comment.id)}
            data-testid={`button-delete-comment-${comment.id}`}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function EventComments({ slug }: { slug: string }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<EventComment | null>(null);

  const { data: comments = [], isLoading } = useQuery<EventComment[]>({
    queryKey: [`/api/realist-events/${slug}/comments`],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/realist-events/${slug}/comments`] });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/realist-events/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: body.trim(), parentCommentId: replyTo?.id || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post");
      return data;
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/realist-events/comments/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: invalidate,
  });

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesFor = (id: string) => comments.filter((c) => c.parentCommentId === id);

  return (
    <section className="space-y-4" data-testid="section-event-discussion">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <MessageSquare className="h-5 w-5" />
        Discussion {comments.length > 0 && <span className="text-base font-normal text-muted-foreground">({comments.length})</span>}
      </h2>

      {isAuthenticated ? (
        <div className="space-y-2 rounded-lg border p-4">
          {replyTo && (
            <p className="text-xs text-muted-foreground">
              Replying to <strong>{replyTo.authorName}</strong>{" "}
              <button className="underline" onClick={() => setReplyTo(null)}>cancel</button>
            </p>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={replyTo ? "Write a reply…" : "Ask a question or say hi to other attendees…"}
            rows={3}
            maxLength={2000}
            data-testid="input-event-comment"
          />
          {postMutation.isError && <p className="text-xs text-destructive">{(postMutation.error as Error).message}</p>}
          <Button
            size="sm"
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || !body.trim()}
            data-testid="button-post-comment"
          >
            {postMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {replyTo ? "Post reply" : "Post"}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <a className="text-primary underline" href={authPath("/create-account")}>Create a free account</a> or{" "}
          <a className="text-primary underline" href={authPath("/login")}>sign in</a> to join the discussion.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading discussion…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet — start the conversation.</p>
      ) : (
        <div className="space-y-5">
          {topLevel.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-4">
              <CommentBody
                comment={comment}
                canReply={isAuthenticated}
                onReply={() => setReplyTo(comment)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
              {repliesFor(comment.id).length > 0 && (
                <div className="mt-3 space-y-3 border-l-2 pl-4">
                  {repliesFor(comment.id).map((reply) => (
                    <CommentBody
                      key={reply.id}
                      comment={reply}
                      canReply={false}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
