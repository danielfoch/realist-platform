import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * "Get the weekly episode digest" opt-in. Posts to /api/podcast/subscribe,
 * which sets podcastDigestEnabled and records CASL consent (source
 * 'podcast_digest'). This is a CONTENT newsletter with its own opt-in —
 * separate from any transactional/deal email.
 *
 * `variant="compact"` renders an inline strip for episode pages; the default
 * renders a full card for the podcast hub.
 */
export function PodcastDigestSubscribe({ variant = "card" }: { variant?: "card" | "compact" }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const subscribeMutation = useMutation({
    mutationFn: async (emailValue: string) => {
      const res = await apiRequest("POST", "/api/podcast/subscribe", { email: emailValue });
      return (await res.json()) as { success: boolean; alreadySubscribed: boolean; message: string };
    },
    onSuccess: (data) => {
      setDone(true);
      toast({
        title: data.alreadySubscribed ? "Already subscribed" : "You're subscribed!",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't subscribe",
        description: err?.message || "Please check your email and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    subscribeMutation.mutate(trimmed);
  };

  const form = (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3" data-testid="form-podcast-digest-subscribe">
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={subscribeMutation.isPending || done}
        aria-label="Email address"
        data-testid="input-podcast-digest-email"
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={subscribeMutation.isPending || done}
        data-testid="button-podcast-digest-subscribe"
      >
        {subscribeMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : done ? (
          <>
            <Check className="w-4 h-4 mr-1" /> Subscribed
          </>
        ) : (
          "Get the digest"
        )}
      </Button>
    </form>
  );

  if (variant === "compact") {
    return (
      <div className="rounded-lg border bg-muted/40 p-4" data-testid="podcast-digest-subscribe-compact">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Get the weekly episode digest</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          New episodes in your inbox every week — links straight to the episode pages on realist.ca. Free, unsubscribe anytime.
        </p>
        {form}
      </div>
    );
  }

  return (
    <Card className="mb-12" data-testid="podcast-digest-subscribe-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Get the weekly episode digest</h2>
            <p className="text-sm text-muted-foreground">
              Every new episode, summarized, in your inbox — with links to listen on realist.ca. Free, unsubscribe anytime.
            </p>
          </div>
        </div>
        {form}
      </CardContent>
    </Card>
  );
}
