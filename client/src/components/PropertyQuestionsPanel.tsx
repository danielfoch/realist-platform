import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";
import { EXPERT_CATEGORY_LABELS, type ExpertCategory } from "@shared/contributorReputation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PropertyQuestionWidget } from "@/components/PropertyQuestionWidget";

export interface PropertyQuestion {
  id: string;
  listingMlsNumber: string;
  body: string;
  questionStatus: "open" | "answered" | "resolved";
  requestedExpertCategories: ExpertCategory[];
  requestedExpertLabels: string[];
  listingSnapshot: Record<string, unknown> | null;
  answerCount: number;
  authorName: string;
  createdAt: string;
  answers?: Array<{
    id: string;
    body: string;
    authorName: string;
    expertCategory: ExpertCategory | null;
    expertCategoryLabel: string | null;
    isExpertAnswer: boolean;
    createdAt: string;
  }>;
}

interface PropertyQuestionsPanelProps {
  listingMlsNumber: string;
  listingSnapshot?: Record<string, unknown>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function PropertyQuestionsPanel({ listingMlsNumber, listingSnapshot }: PropertyQuestionsPanelProps) {
  const { toast } = useToast();
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ questions: PropertyQuestion[] }>({
    queryKey: ["/api/community/questions", listingMlsNumber],
    queryFn: async () => {
      const res = await fetch(`/api/community/questions?listingMlsNumber=${encodeURIComponent(listingMlsNumber)}&status=all`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load property questions");
      return res.json();
    },
    staleTime: 60_000,
  });

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, body }: { questionId: string; body: string }) => {
      const res = await apiRequest("POST", `/api/community/questions/${questionId}/answers`, { body });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setAnswerDrafts((current) => ({ ...current, [variables.questionId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/community/questions", listingMlsNumber] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/questions"] });
      toast({ title: "Answer posted" });
    },
    onError: (error: any) => {
      toast({ title: "Could not post answer", description: error?.message || "Try again.", variant: "destructive" });
    },
  });

  const questions = data?.questions ?? [];

  return (
    <Card id="questions" className="border-cyan-200 bg-gradient-to-b from-cyan-50/70 to-background">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-cyan-700" />
            Property questions
          </CardTitle>
          <CardDescription>
            Public questions tied to this listing, routed to the Power Team categories investors want to hear from.
          </CardDescription>
        </div>
        <PropertyQuestionWidget listingMlsNumber={listingMlsNumber} listingSnapshot={listingSnapshot} />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading questions...</p>}
        {!isLoading && questions.length === 0 && (
          <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            No public questions yet. Ask the first one and tag the experts who should answer.
          </div>
        )}
        {questions.map((question) => {
          const draft = answerDrafts[question.id] ?? "";
          return (
            <div key={question.id} id={`question-${question.id}`} className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant={question.questionStatus === "resolved" ? "secondary" : "default"}>
                  {question.questionStatus === "resolved" ? "Resolved" : question.answerCount > 0 ? "Answered" : "Open"}
                </Badge>
                {question.requestedExpertLabels.map((label) => (
                  <Badge key={label} variant="outline">{label}</Badge>
                ))}
                <span className="text-xs text-muted-foreground">
                  Asked by {question.authorName} on {formatDate(question.createdAt)}
                </span>
              </div>
              <p className="text-sm leading-6">{question.body}</p>

              {(question.answers ?? []).length > 0 && (
                <div className="mt-4 space-y-3">
                  {question.answers?.map((answer) => (
                    <div key={answer.id} className="rounded-md bg-muted/50 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{answer.authorName}</span>
                        {answer.isExpertAnswer && answer.expertCategoryLabel && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {answer.expertCategoryLabel}
                          </Badge>
                        )}
                        <span>{formatDate(answer.createdAt)}</span>
                      </div>
                      <p className="text-sm leading-6">{answer.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-2">
                <Textarea
                  value={draft}
                  onChange={(event) => setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Answer this question publicly..."
                  className="min-h-20"
                />
                <div className="flex items-center justify-between gap-3">
                  <Link href="/account/notifications" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                    Experts can turn on live question alerts
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => answerMutation.mutate({ questionId: question.id, body: draft })}
                    disabled={draft.trim().length < 3 || answerMutation.isPending}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Answer
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        <div className="pt-2">
          <Link href="/community/questions" className="text-sm font-medium text-cyan-700 underline-offset-4 hover:underline">
            See all open property questions
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
