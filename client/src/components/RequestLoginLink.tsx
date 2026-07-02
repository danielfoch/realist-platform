import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

/**
 * Self-serve recovery for expired/invalid set-password and reset links:
 * instead of an error wall, ask for the email and send a fresh 30-minute
 * magic sign-in link (POST /api/auth/email-login-link). No enumeration —
 * the confirmation is the same whether or not the account exists.
 */
export function RequestLoginLink({ defaultEmail }: { defaultEmail?: string | null }) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail || "");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const sendLinkMutation = useMutation({
    mutationFn: async (targetEmail: string) => {
      const response = await apiRequest("POST", "/api/auth/email-login-link", { email: targetEmail });
      return response.json();
    },
    onSuccess: (_data, targetEmail) => {
      setSentTo(targetEmail);
    },
    onError: (error: any) => {
      const message = typeof error?.message === "string" && error.message.startsWith("429")
        ? "Too many sign-in links requested. Please wait a bit and try again."
        : "Could not send a sign-in link. Please try again.";
      toast({ title: "Sign-in link failed", description: message, variant: "destructive" });
    },
  });

  if (sentTo) {
    return (
      <div
        className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm text-left"
        data-testid="notice-fresh-link-sent"
      >
        <p className="font-medium flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-primary" />
          Fresh sign-in link sent
        </p>
        <p className="mt-1 text-muted-foreground">
          If an account exists for <span className="font-medium">{sentTo}</span>, you'll get an
          email with a one-click sign-in link (valid 30 minutes). You can add a password later
          from your dashboard — it's optional.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="email"
          placeholder="you@example.com"
          className="pl-10 h-11"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          data-testid="input-fresh-link-email"
        />
      </div>
      <Button
        type="button"
        className="w-full h-11"
        disabled={sendLinkMutation.isPending || !email.includes("@")}
        onClick={() => sendLinkMutation.mutate(email.trim())}
        data-testid="button-send-fresh-link"
      >
        {sendLinkMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Email me a fresh sign-in link
          </>
        )}
      </Button>
    </div>
  );
}
