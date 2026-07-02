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
import { ChevronUp, ChevronDown, EyeOff, HardHat, Loader2, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EXPERT_CATEGORY_LABELS, isExpertCategory } from "@shared/contributorReputation";
import { FIELD_NOTE_LIMITS } from "@shared/fieldNotes";

interface FieldNote {
  id: string;
  userId: string;
  authorName: string;
  authorCompany: string | null;
  authorHeadshot: string | null;
  category: string;
  isExpert?: boolean;
  body: string;
  score: number;
  myVote: number;
  createdAt: string;
  updatedAt?: string;
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery<FieldNote[]>({ queryKey: key });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: [`/api/listings/${encodeURIComponent(mlsNumber)}/engagement`] });
  };

  // Approved industry partners get the long-form expert allowance; any other
  // signed-in member can leave ONE short note per listing (editable).
  const { data: myPartner } = useQuery<{ isApproved: boolean } | null>({
    queryKey: ["/api/partner/profile"],
    enabled: isAuthenticated,
    retry: false,
  });
  const isExpertWriter = Boolean(myPartner?.isApproved);
  const maxLength = isExpertWriter ? FIELD_NOTE_LIMITS.EXPERT_MAX_LENGTH : FIELD_NOTE_LIMITS.MEMBER_MAX_LENGTH;
  const isAdmin = user?.role === "admin";
  const myNote = user ? notes.find((note) => note.userId === user.id) : undefined;
  const canAddNew = isAuthenticated && (isExpertWriter || !myNote);

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

  const editMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await apiRequest("PATCH", `/api/field-notes/${id}`, { body: body.trim() });
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      setEditingId(null);
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

  const hideMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/field-notes/${id}/hide`, { hidden: true }),
    onSuccess: invalidate,
  });

  const startEditing = (note: FieldNote) => {
    setComposing(false);
    setEditingId(note.id);
    setBody(note.body);
  };

  const composerOpen = composing || editingId !== null;
  const activeMutation = editingId ? editMutation : postMutation;
  const submitLabel = editingId ? "Save changes" : "Post note";

  return (
    <section id="field-notes" className="mt-10 max-w-4xl" data-testid="section-field-notes">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <HardHat className="h-5 w-5 text-primary" />
          Field notes {notes.length > 0 && <span className="text-base font-normal text-muted-foreground">({notes.length})</span>}
        </h2>
        {canAddNew && !composerOpen && (
          <Button size="sm" variant="outline" onClick={() => { setBody(""); setComposing(true); }} data-testid="button-add-field-note">
            Add your field note
          </Button>
        )}
        {isAuthenticated && myNote && !isExpertWriter && !composerOpen && (
          <Button size="sm" variant="outline" onClick={() => startEditing(myNote)} data-testid="button-edit-field-note">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit your note
          </Button>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        On-the-ground notes from vetted industry experts and investors who have dug into this property. Upvote what's useful.
      </p>

      {composerOpen && (
        <div className="mb-5 space-y-2 rounded-lg border p-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={maxLength}
            placeholder={
              isExpertWriter
                ? "Share a professional insight — zoning, conversion feasibility, financing angle, inspection red flag…"
                : "Share what you learned about this property — rent reality, repair scope, neighbourhood context…"
            }
            data-testid="input-field-note"
          />
          <p className="text-right text-xs text-muted-foreground">{body.trim().length}/{maxLength}</p>
          {activeMutation.isError && <p className="text-xs text-destructive">{(activeMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => (editingId ? editMutation.mutate({ id: editingId }) : postMutation.mutate())}
              disabled={activeMutation.isPending || body.trim().length < FIELD_NOTE_LIMITS.MIN_LENGTH}
              data-testid="button-submit-field-note"
            >
              {activeMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {submitLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setComposing(false); setEditingId(null); setBody(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <div className="mb-5 rounded-lg border bg-muted/30 p-4 text-sm">
          <a className="text-primary underline" href={authPath("/login")}>Sign in</a> to add your own field note and vote on what's useful.
          Industry pro? <a className="text-primary underline" href="/join/experts">Join the expert network</a> to build your reputation.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading field notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No field notes on this property yet. Be the first to share what you know.</p>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <Avatar className="h-6 w-6">
                    {note.authorHeadshot && <AvatarImage src={note.authorHeadshot} alt={note.authorName} />}
                    <AvatarFallback className="text-[10px]">{note.authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {note.isExpert !== false ? (
                    <Link href={`/experts/${note.userId}`} className="text-sm font-semibold hover:underline">
                      {note.authorName}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold">{note.authorName}</span>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {note.category === "investor" ? "Investor" : categoryLabel(note.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(note.createdAt), "MMM d, yyyy")}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {user?.id === note.userId && (
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => startEditing(note)}
                        title="Edit your note"
                        data-testid={`button-edit-${note.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isAdmin && user?.id !== note.userId && (
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => hideMutation.mutate(note.id)}
                        title="Hide note (admin)"
                        data-testid={`button-hide-${note.id}`}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(user?.id === note.userId || isAdmin) && (
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(note.id)}
                        title="Delete note"
                        data-testid={`button-delete-${note.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
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
