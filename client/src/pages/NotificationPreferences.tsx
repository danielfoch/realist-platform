import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Prefs {
  emailDigestOptIn: boolean;
  marketingEmailEnabled: boolean;
  retentionTipsEnabled: boolean;
  listingWatchAlertsEnabled: boolean;
  communityAlertsEnabled: boolean;
  expertQuestionDigestEnabled: boolean;
  expertQuestionLiveAlertsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  monthlyRankEnabled: boolean;
  podcastDigestEnabled: boolean;
  productUpdatesEnabled: boolean;
  weeklyEmailFrequency: number | null;
}

// One row per governed marketing stream. `key` matches the server field and the
// emailGovernor's MarketingStream → notification_preferences column mapping.
const CATEGORY_ROWS: Array<{ key: keyof Prefs; title: string; description: string }> = [
  {
    key: "retentionTipsEnabled",
    title: "Tips & re-engagement",
    description: "Behavioural nudges — co-analysis alerts, price-change reminders, milestones, and onboarding tips.",
  },
  {
    key: "listingWatchAlertsEnabled",
    title: "Watchlist alerts",
    description: "Price and status changes on listings you watch, plus saved-search matches.",
  },
  {
    key: "weeklyDigestEnabled",
    title: "Weekly leaderboard digest",
    description: "Monday recap: platform stats, deal of the week, and where you rank.",
  },
  {
    key: "monthlyRankEnabled",
    title: "Monthly rank & prizes",
    description: "Your monthly leaderboard placement (and prize claim details if you place).",
  },
  {
    key: "communityAlertsEnabled",
    title: "Community activity",
    description: "Votes on your field notes and other community engagement.",
  },
  {
    key: "expertQuestionDigestEnabled",
    title: "Expert question digest",
    description: "Outstanding property questions by expert category in the weekly Realist email.",
  },
  {
    key: "expertQuestionLiveAlertsEnabled",
    title: "Live expert questions",
    description: "Immediate emails when investors tag your category on a property question. Useful for business development.",
  },
  {
    key: "podcastDigestEnabled",
    title: "Podcast digest",
    description: "New episodes of the Realist podcast (coming soon).",
  },
  {
    key: "productUpdatesEnabled",
    title: "Product announcements",
    description: "New tools and meaningful product changes. Rare, never spammy.",
  },
];

export default function NotificationPreferences() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Prefs | null>(null);

  const { data, isLoading } = useQuery<Prefs>({
    queryKey: ["/api/account/notification-preferences"],
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (prefs: Prefs) => {
      const res = await apiRequest("PUT", "/api/account/notification-preferences", prefs);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Preferences saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/account/notification-preferences"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  const set = (patch: Partial<Prefs>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  if (isLoading || !draft) {
    return (
      <div className="container max-w-2xl mx-auto py-10" data-testid="page-notifications-loading">
        <p className="text-muted-foreground text-sm">Loading your preferences…</p>
      </div>
    );
  }

  // When the master unsubscribe is off, marketing streams can't send regardless
  // of their individual toggles — reflect that by disabling the sub-toggles.
  const marketingOff = !draft.emailDigestOptIn || !draft.marketingEmailEnabled;

  return (
    <div className="container max-w-2xl mx-auto py-10 space-y-6" data-testid="page-notifications">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Bell className="w-7 h-7" /> Email preferences
        </h1>
        <p className="text-muted-foreground mt-2">
          Choose which emails Realist sends you. Account and security emails (sign-in links, password
          resets, receipts) are always delivered.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Master switch
          </CardTitle>
          <CardDescription>
            Turn all marketing and content emails on or off. Leaving this on lets you fine-tune the
            categories below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="font-medium">Marketing & content emails</p>
              <p className="text-sm text-muted-foreground">
                The single unsubscribe. Off = we stop all non-essential email.
              </p>
            </div>
            <Switch
              checked={draft.emailDigestOptIn && draft.marketingEmailEnabled}
              onCheckedChange={(v) => set({ emailDigestOptIn: v, marketingEmailEnabled: v })}
              data-testid="switch-master"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            We cap marketing email to a few per week — these toggles decide which streams count.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {CATEGORY_ROWS.map((row, i) => (
            <div key={row.key}>
              {i > 0 && <Separator className="my-1" />}
              <div className="flex items-center justify-between py-3">
                <div className="pr-4">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-sm text-muted-foreground">{row.description}</p>
                </div>
                <Switch
                  checked={Boolean(draft[row.key])}
                  disabled={marketingOff}
                  onCheckedChange={(v) => set({ [row.key]: v } as Partial<Prefs>)}
                  data-testid={`switch-${row.key}`}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(draft)}
          disabled={saveMutation.isPending}
          data-testid="button-save-preferences"
        >
          {saveMutation.isPending ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
