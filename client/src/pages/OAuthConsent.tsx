/**
 * OAuth consent — /oauth/consent?request=<id>
 *
 * Where someone lands after adding Realist as a connector in claude.ai, ChatGPT
 * or another MCP client: the server has validated the client's /oauth/authorize
 * request and parked it; this page asks the signed-in user whether that app may
 * act on their Realist account, and sends them back with the answer.
 *
 * It is a client route on purpose: the sign-in flow returns here with a
 * client-side navigation, which a server-rendered page could not receive.
 */
import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, ExternalLink, Eye, Calculator, Send, Megaphone, ShieldCheck, TriangleAlert } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import logoImage from "@assets/Untitled_design_(4)_1773356428184.webp";

interface ConsentRequest {
  client: {
    name: string;
    uri: string | null;
    redirect: { display: string; kind: "known" | "local" | "unknown"; knownAs?: string };
  };
  scopes: Array<{ id: string; label: string; description: string; actsForYou: boolean }>;
}

const SCOPE_ICONS: Record<string, typeof Eye> = {
  read: Eye,
  underwrite: Calculator,
  "deal:submit": Send,
  "community:write": Megaphone,
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4 py-10">
      <SEO title="Connect an app — Realist" description="Approve an application's access to your Realist account." noIndex />
      <Link href="/" className="mb-6 flex items-center gap-2">
        <img src={logoImage} alt="Realist" className="h-8 w-8 object-contain dark:invert" />
        <span className="text-lg font-bold tracking-tight">Realist</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <Card data-testid="consent-problem">
        <CardHeader className="items-center text-center">
          <CircleAlert className="h-8 w-8 text-muted-foreground" />
          <CardTitle className="text-xl pt-2">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground leading-6">{body}</CardContent>
      </Card>
    </Shell>
  );
}

export default function OAuthConsent() {
  const requestId = new URLSearchParams(useSearch()).get("request") || "";
  const returnPath = `/oauth/consent?request=${encodeURIComponent(requestId)}`;
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [unchecked, setUnchecked] = useState<Set<string> | null>(null);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [failed, setFailed] = useState(false);

  const { data, isLoading, isError } = useQuery<ConsentRequest>({
    queryKey: [`/api/oauth/requests/${requestId}`],
    enabled: isAuthenticated && !!requestId,
    retry: false,
  });

  if (!requestId) {
    return <Problem title="Nothing to approve" body="This page is opened by an app that wants to connect to Realist. Start the connection from that app." />;
  }
  if (authLoading) {
    return <Shell><Skeleton className="h-80 w-full rounded-xl" /></Shell>;
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <Card data-testid="consent-sign-in">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign in to connect your app</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground leading-6">
            An app is asking to use Realist on your behalf. Sign in — or create a free account — and you'll be asked what it may do.
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full" data-testid="button-consent-login">
              <Link href={authPath("/login", returnPath)}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="w-full" data-testid="button-consent-signup">
              <Link href={authPath("/create-account", returnPath)}>Create a free account</Link>
            </Button>
          </CardFooter>
        </Card>
      </Shell>
    );
  }

  if (isLoading) {
    return <Shell><Skeleton className="h-96 w-full rounded-xl" /></Shell>;
  }
  if (isError || !data) {
    return <Problem title="This request has expired" body="Connection requests are only valid for a few minutes. Go back to the app and start connecting to Realist again." />;
  }

  // Permissions that let the app act on the user's behalf are opt-out; posting publicly starts unticked.
  const off = unchecked ?? new Set(data.scopes.filter((scope) => scope.id === "community:write").map((scope) => scope.id));
  const approved = data.scopes.filter((scope) => !off.has(scope.id)).map((scope) => scope.id);

  async function decide(decision: "approve" | "deny") {
    setSubmitting(decision);
    setFailed(false);
    try {
      const response = await apiRequest("POST", `/api/oauth/requests/${requestId}/${decision}`, decision === "approve" ? { scopes: approved } : undefined);
      const { redirectTo } = (await response.json()) as { redirectTo: string };
      window.location.assign(redirectTo);
    } catch {
      setFailed(true);
      setSubmitting(null);
    }
  }

  const { client } = data;
  return (
    <Shell>
      <Card data-testid="consent-card">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl leading-snug">
            <span data-testid="text-consent-client">{client.name}</span> wants to connect to your Realist account
          </CardTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Signed in as <span className="font-medium text-foreground">{user?.email}</span>
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">It will be able to</p>
          <ul className="space-y-3">
            {data.scopes.map((scope) => {
              const Icon = SCOPE_ICONS[scope.id] ?? Eye;
              const checked = !off.has(scope.id);
              return (
                <li key={scope.id} className="flex items-start gap-3" data-testid={`scope-${scope.id}`}>
                  <Icon className="h-4 w-4 mt-1 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`scope-${scope.id}`} className="text-sm font-medium leading-tight">{scope.label}</label>
                    <p className="text-xs text-muted-foreground leading-5">{scope.description}</p>
                  </div>
                  {scope.actsForYou ? (
                    <Checkbox
                      id={`scope-${scope.id}`}
                      checked={checked}
                      onCheckedChange={(next) => {
                        const updated = new Set(off);
                        if (next === true) updated.delete(scope.id);
                        else updated.add(scope.id);
                        setUnchecked(updated);
                      }}
                      className="mt-1"
                      data-testid={`checkbox-scope-${scope.id}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div
            className={`flex gap-2.5 rounded-lg border p-3 text-xs leading-5 ${client.redirect.kind === "unknown" ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/40"}`}
            data-testid="consent-redirect"
          >
            {client.redirect.kind === "unknown"
              ? <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              : <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />}
            <p className="text-muted-foreground">
              After you decide, you'll be sent back to <span className="font-medium text-foreground">{client.redirect.display}</span>
              {client.redirect.kind === "known" && client.redirect.knownAs ? ` (${client.redirect.knownAs})` : ""}.
              {client.redirect.kind === "unknown" && " Realist doesn't recognise this address — only continue if you started this connection yourself and trust the app."}
            </p>
          </div>

          {failed && (
            <p className="text-sm text-destructive" role="alert">
              That didn't go through. The request may have expired — go back to the app and start again.
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" disabled={submitting !== null || approved.length === 0} onClick={() => decide("approve")} data-testid="button-consent-approve">
            {submitting === "approve" ? "Connecting…" : "Allow access"}
          </Button>
          <Button variant="ghost" className="w-full" disabled={submitting !== null} onClick={() => decide("deny")} data-testid="button-consent-deny">
            Cancel
          </Button>
          <p className="pt-2 text-center text-xs text-muted-foreground leading-5">
            The app never sees your password. Disconnect it any time from{" "}
            <Link href="/account/api-keys" className="underline underline-offset-2">Account → API keys</Link>.
            {client.uri && (
              <>
                {" "}
                <a href={client.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
                  About this app <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </p>
        </CardFooter>
      </Card>
    </Shell>
  );
}
