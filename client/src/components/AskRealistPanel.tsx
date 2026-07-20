import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, Wrench, Lock } from "lucide-react";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface DealContext {
  address?: string;
  city?: string;
  province?: string;
  strategy?: string;
  price?: number;
  monthlyRent?: number;
  capRate?: number;
  cashOnCash?: number;
  monthlyCashFlow?: number;
  dscr?: number;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string }>;
}

interface AskStatus {
  available: boolean;
  requiresAuth: boolean;
  remaining: number;
  isPremium: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  underwrite_property: "Ran underwrite",
  find_deals: "Searched listings",
  get_mortgage_rates: "Checked rates",
  get_market_report: "Pulled market report",
};

const SUGGESTIONS = [
  "Does this pencil at 20% down?",
  "What kills this deal?",
  "What if rates drop to 4.5%?",
];

export function AskRealistPanel({
  context,
  initialQuestion,
  compact = false,
}: {
  context: DealContext;
  initialQuestion?: string;
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery<AskStatus>({
    queryKey: ["/api/ask/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ask/status");
      return res.json();
    },
    staleTime: 30 * 1000,
    retry: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ask/checkout", {});
      return res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) window.location.href = data.url;
    },
  });

  // Never advertise AI the server can't deliver — hide the panel entirely
  // when the model isn't configured.
  if (!statusLoading && status && !status.available) return null;

  const canAsk = status?.isPremium || (status?.remaining ?? 0) > 0;
  const remaining = status?.remaining ?? 0;

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    if (!isAuthenticated) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    track({ event: "cta_clicked", cta: "ask_realist", location: "analysis_results" });

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question: trimmed,
          context,
          history: turns.slice(-8).map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data?.error === "quota_exceeded") {
          setError(data.message);
        } else {
          setError(data?.message || "Something went wrong — try again.");
        }
        return;
      }
      setTurns([...nextTurns, { role: "assistant", content: data.answer, toolCalls: data.toolCalls }]);
      setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }), 50);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-background" data-testid="card-ask-realist">
      <CardHeader className="pb-3">
        <CardTitle className={compact ? "flex items-center gap-2 text-base" : "flex items-center gap-2 text-lg"}>
          <Sparkles className="h-4 w-4 text-violet-500" />
          {compact ? "Ask Realist" : "Ask Realist about this deal"}
          <Badge variant="outline" className="text-[10px] text-violet-600 dark:text-violet-400 border-violet-500/40">AI</Badge>
          {!statusLoading && status && !status.isPremium && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {remaining}/{3} free left
            </Badge>
          )}
          {!statusLoading && status?.isPremium && (
            <Badge variant="secondary" className="text-[10px] ml-auto">Unlimited</Badge>
          )}
        </CardTitle>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            Answers use your computed numbers and live data — the math runs deterministically, the AI explains it.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAuthenticated ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Sign in to ask Realist.</span>
            </div>
            <Link href="/login">
              <Button size="sm" variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
          </div>
        ) : !canAsk ? (
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-sm space-y-3">
            <p className="font-medium">You've used your free Ask Realist questions this month.</p>
            <p className="text-muted-foreground">
              Upgrade to Ask Realist Premium for unlimited AI deal questions.
            </p>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              data-testid="button-ask-upgrade"
            >
              {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Upgrade to unlimited — $100/mo
            </Button>
          </div>
        ) : (
          <>
            {turns.length > 0 && (
              <div ref={threadRef} className="max-h-80 overflow-y-auto space-y-3 pr-1" data-testid="ask-realist-thread">
                {turns.map((turn, i) => (
                  <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        turn.role === "user"
                          ? "rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm max-w-[85%]"
                          : "rounded-lg border border-border/60 bg-card px-3 py-2 text-sm max-w-[90%] space-y-2"
                      }
                    >
                      <p className="whitespace-pre-wrap">{turn.content}</p>
                      {turn.toolCalls && turn.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                          {turn.toolCalls.map((t, j) => (
                            <span key={j} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Wrench className="h-2.5 w-2.5" />
                              {TOOL_LABELS[t.name] || t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Working through the numbers…
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                {error.includes("free Ask Realist questions") && (
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => checkoutMutation.mutate()}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Upgrade to unlimited — $100/mo
                  </Button>
                )}
              </div>
            )}

            {turns.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    disabled={busy}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-ask-suggestion"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder='Ask anything — "what if rent is $200 lower?"'
                disabled={busy}
                data-testid="input-ask-realist"
              />
              <Button type="submit" size="icon" disabled={busy || !question.trim()} data-testid="button-ask-submit">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
