import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";
import { apiRequest } from "@/lib/queryClient";
import { ChevronUp, ChevronDown, HardHat, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EXPERT_CATEGORY_LABELS, isExpertCategory } from "@shared/contributorReputation";

interface FieldNote {
  id: string;
  userId: string;
  authorName: string;
  authorCompany: string | null;
  authorHeadshot: string | null;
  category: string;
  body: string;
  score: number;
  myVote: number;
  createdAt: string;
}

function categoryLabel(category: string): string {
  return isExpertCategory(category) ? EXPERT_CATEGORY_LABELS[category] : "Industry Expert";
}

export function FieldNotes({ mlsNumber }: { mlsNumber: string }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const key = [`/api/listings/${mlsNumber}/field-notes`];
  const [body, setBody] = useState("");
  const [composing, setComposing] = useState(false);

  const { data: notes = [], isLoading } = useQuery<FieldNote[]>({ queryKey: key });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  // Any approved industry partner can post; we check the user's own partner
  // profile lazily only when they try to compose.
  const { data: myPartner } = useQuery<{ isApproved: boolean } | null>({
    queryKey: ["/api/partner/profile"],
    enabled: isAuthenticated,
    retry: false,
  });
  const canWrite = Boolean(myPartner?.isApproved);

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/listings/${mlsNumber}/field-notes`, { body: body.trim() });
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      setComposing(false);
      invalidate();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const res = await apiRequest("POST", `/api/field-notes/${id}/vote`, { value });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/field-notes/${id}`),
    onSuccess: invalidate,
  });

  return (
    <section className="mt-10 max-w-4xl" data-testid="section-field-notes">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <HardHat className="h-5 w-5 text-primary" />
          Expert field notes {notes.length > 0 && <span className="text-base font-normal text-muted-foreground">({notes.length})</span>}
        </h2>
        {canWrite && !composing && (
          <Button size="sm" variant="outline" onClick={() => setComposing(true)} data-testid="button-add-field-note">
            Add your field note
          </Button>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Notes from vetted architects, planners, mortgage, legal and inspection pros on this property. Upvote what's useful.
      </p>

      {composing && (
        <div className="mb-5 space-y-2 rounded-lg border p-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Share a professional insight — zoning, conversion feasibility, financing angle, inspection red flag…"
            data-testid="input-field-note"
          />
          {postMutation.isError && <p className="text-xs text-destructive">{(postMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => postMutation.mutate()} disabled={postMutation.isPending || body.trim().length < 10} data-testid="button-submit-field-note">
              {postMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Post note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <div className="mb-5 rounded-lg border bg-muted/30 p-4 text-sm">
          Are you an architect, planner, or mortgage/legal/inspection pro?{" "}
          <a className="text-primary underline" href="/join/experts">Join the expert network</a> to add field notes and build your reputation.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading field notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expert field notes on this property yet.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-3 rounded-lg border p-4" data-testid={`field-note-${note.id}`}>
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <button
                  className={`rounded p-1 hover:bg-muted ${note.myVote === 1 ? "text-primary" : "text-muted-foreground"}`}
                  disabled={!isAuthenticated || voteMutation.isPending}
                  onClick={() => (isAuthenticated ? voteMutation.mutate({ id: note.id, value: note.myVote === 1 ? 0 : 1 }) : (window.location.href = authPath("/login")))}
                  data-testid={`button-upvote-${note.id}`}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold" data-testid={`score-${note.id}`}>{note.score}</span>
                <button
                  className={`rounded p-1 hover:bg-muted ${note.myVote === -1 ? "text-destructive" : "text-muted-foreground"}`}
                  disabled={!isAuthenticated || voteMutation.isPending}
                  onClick={() => (isAuthenticated ? voteMutation.mutate({ id: note.id, value: note.myVote === -1 ? 0 : -1 }) : (window.location.href = authPath("/login")))}
                  data-testid={`button-downvote-${note.id}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    {note.authorHeadshot && <AvatarImage src={note.authorHeadshot} alt={note.authorName} />}
                    <AvatarFallback className="text-[10px]">{note.authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Link href={`/experts/${note.userId}`} className="text-sm font-semibold hover:underline">
                    {note.authorName}
                  </Link>
                  <Badge variant="secondary" className="text-[10px]">{categoryLabel(note.category)}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(note.createdAt), "MMM d, yyyy")}</span>
                  {(user?.id === note.userId || user?.role === "admin") && (
                    <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(note.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
