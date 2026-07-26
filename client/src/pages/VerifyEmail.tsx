import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Loader2, MailWarning, ArrowRight, RefreshCw } from "lucide-react";
import { getAuthReturnUrl } from "@/lib/authReturn";

/**
 * Landing page for the emailed verification link.
 *
 * The token in the URL is the proof, so this verifies on mount without needing a
 * session — people routinely open mail links in a browser they are not signed
 * into, and bouncing them to a login screen first would strand them.
 *
 * Every failure offers a way forward. A dead end here is expensive: the tools are
 * gated on verification (server/accountVerification.ts), so someone who cannot
 * get past this page cannot use the product.
 */

type VerifyState =
  | { kind: "verifying" }
  | { kind: "verified" }
  | { kind: "failed"; reason: string; message: string }
  | { kind: "no_token" };

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [state, setState] = useState<VerifyState>({ kind: "verifying" });
  const returnUrl = getAuthReturnUrl("/investor");

  const token = new URLSearchParams(window.location.search).get("token");

  const verifyMutation = useMutation({
    mutationFn: async (t: string) => {
      const res = await apiRequest("POST", "/api/auth/email/verify", { token: t });
      return res.json();
    },
    onSuccess: () => setState({ kind: "verified" }),
    onError: async (err: any) => {
      // apiRequest throws with the response body on non-2xx; fall back to a
      // generic message rather than showing the caller a raw error string.
      let message = "That verification link isn't valid.";
      let reason = "invalid";
      try {
        const parsed = typeof err?.message === "string" ? JSON.parse(err.message.replace(/^\d+:\s*/, "")) : null;
        if (parsed?.message) message = parsed.message;
        if (parsed?.reason) reason = parsed.reason;
      } catch {
        /* keep the default */
      }
      setState({ kind: "failed", reason, message });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/email/send-verification", {});
      return res.json();
    },
    onSuccess: () => toast({ title: "Sent", description: "Check your inbox for a fresh link." }),
    onError: () =>
      toast({
        title: "Couldn't send",
        description: "Sign in first, then request a new link from your account.",
        variant: "destructive",
      }),
  });

  useEffect(() => {
    if (!token) {
      setState({ kind: "no_token" });
      return;
    }
    verifyMutation.mutate(token);
    // Runs once for the token in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto flex max-w-lg flex-col px-4 py-16">
        <Card>
          {state.kind === "verifying" && (
            <>
              <CardHeader className="text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                <CardTitle className="mt-3">Confirming your email…</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                One moment.
              </CardContent>
            </>
          )}

          {state.kind === "verified" && (
            <>
              <CardHeader className="text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
                <CardTitle className="mt-3" data-testid="text-verify-email-success">Email confirmed</CardTitle>
                <CardDescription>
                  Your tools are unlocked. If you haven't confirmed your phone number yet, that's the last step.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button onClick={() => setLocation("/tools/multiplex-underwriter")} className="gap-2">
                  Underwrite a site <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="outline" onClick={() => setLocation("/verify-phone")}>
                  Confirm my phone number
                </Button>
                <Button variant="ghost" onClick={() => setLocation(returnUrl)}>
                  Go to my dashboard
                </Button>
              </CardContent>
            </>
          )}

          {(state.kind === "failed" || state.kind === "no_token") && (
            <>
              <CardHeader className="text-center">
                <MailWarning className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
                <CardTitle className="mt-3" data-testid="text-verify-email-failed">
                  {state.kind === "no_token" ? "No verification link found" : "That link didn't work"}
                </CardTitle>
                <CardDescription>
                  {state.kind === "no_token"
                    ? "Open the link from your confirmation email, or send yourself a fresh one below."
                    : state.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  onClick={() => resendMutation.mutate()}
                  disabled={resendMutation.isPending}
                  className="gap-2"
                >
                  {resendMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" aria-hidden="true" /> Send me a new link</>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  You'll need to be signed in to request one.{" "}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
