/**
 * Live Deal Room — /deal-room
 *
 * The weekly one-to-many deal-review call (Mondays 11:30am ET, Google Meet).
 * Registration is owned here, not on Skool: register → confirmation +
 * reminder emails → live call → replay hosted free on this page behind a
 * lightweight email capture. Deal submissions route through the Deal Desk
 * tagged to the session.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CalendarCheck,
  ClipboardList,
  Inbox,
  PhoneCall,
  PlayCircle,
  Radio,
  Users,
  Video,
} from "lucide-react";

interface NextSession {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  registrationCount: number;
}

interface Replay {
  id: string;
  title: string;
  scheduledAt: string;
  aiSummary: string | null;
  aiChapters: Array<{ label: string }>;
}

const LEAD_STORAGE_KEY = "realist_lead_info";

function readStoredLead(): { name?: string; email?: string } {
  try {
    const raw = localStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { firstName?: string; lastName?: string; name?: string; email?: string };
    const name = parsed.name ?? [parsed.firstName, parsed.lastName].filter(Boolean).join(" ");
    return { name: name || undefined, email: parsed.email };
  } catch {
    return {};
  }
}

function formatSessionTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function useCountdown(targetIso: string | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    if (!targetIso) return null;
    const diff = new Date(targetIso).getTime() - now;
    if (diff <= 0) return "live now";
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  }, [targetIso, now]);
}

export default function DealRoom() {
  const { toast } = useToast();
  const stored = useMemo(readStoredLead, []);
  const [name, setName] = useState(stored.name ?? "");
  const [email, setEmail] = useState(stored.email ?? "");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [unlockTarget, setUnlockTarget] = useState<Replay | null>(null);
  const [unlockEmail, setUnlockEmail] = useState(stored.email ?? "");
  const [activeReplay, setActiveReplay] = useState<{ id: string; embedUrl: string } | null>(null);

  const { data: next } = useQuery<NextSession>({
    queryKey: ["/api/deal-room/next"],
  });
  const { data: replays } = useQuery<Replay[]>({
    queryKey: ["/api/deal-room/replays"],
  });
  const countdown = useCountdown(next?.scheduledAt);

  const register = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deal-room/register", {
        sessionId: next?.id,
        name,
        email,
        phone: phone || undefined,
        smsConsent,
        source: "deal-room",
      });
      return res.json();
    },
    onSuccess: (data: { alreadyRegistered?: boolean }) => {
      setRegistered(true);
      try {
        localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ name, email }));
      } catch {
        /* storage unavailable — fine */
      }
      toast({
        title: data.alreadyRegistered ? "You're already registered" : "You're in",
        description: "Check your email for the session link and calendar invite.",
      });
    },
    onError: () => {
      toast({ title: "Registration failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const unlock = useMutation({
    mutationFn: async (replay: Replay) => {
      const res = await apiRequest("POST", `/api/deal-room/replays/${replay.id}/unlock`, {
        email: unlockEmail,
        name: name || undefined,
      });
      return res.json() as Promise<{ embedUrl: string }>;
    },
    onSuccess: (data, replay) => {
      try {
        localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ name, email: unlockEmail }));
      } catch {
        /* ignore */
      }
      setActiveReplay({ id: replay.id, embedUrl: data.embedUrl });
      setUnlockTarget(null);
      toast({ title: "Replay unlocked", description: "We also emailed you the link." });
    },
    onError: () => {
      toast({ title: "Could not unlock the replay", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleWatch = (replay: Replay) => {
    if (activeReplay?.id === replay.id) return;
    const knownEmail = unlockEmail || email || readStoredLead().email;
    if (knownEmail) {
      setUnlockEmail(knownEmail);
      unlock.mutate(replay);
    } else {
      setUnlockTarget(replay);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Live Deal Room — Free Weekly Deal Review | Realist.ca"
        description="Bring your deal to the Live Deal Room. Free live underwriting and Q&A with the Realist team, Mondays 11:30am ET. Replays hosted free — no signup required."
      />
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3">
            <Radio className="h-3 w-3 mr-1" /> Live every Monday, 11:30am ET
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">The Live Deal Room</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real deals from the community, underwritten live. Bring your numbers, ask anything,
            and leave knowing whether your deal pencils. Free, on Google Meet.
          </p>
          {next && (
            <p className="mt-4 text-sm font-medium">
              Next session: {formatSessionTime(next.scheduledAt)}
              {countdown && (
                <span className="ml-2 text-primary">({countdown})</span>
              )}
              {next.registrationCount >= 5 && (
                <span className="ml-2 text-muted-foreground">
                  <Users className="inline h-3.5 w-3.5 mr-1" />
                  {next.registrationCount} registered
                </span>
              )}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-14">
          {/* Registration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" /> Save your spot
              </CardTitle>
              <CardDescription>
                Confirmation and the Meet link land in your inbox. No account needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {registered ? (
                <div className="text-center py-6">
                  <p className="font-medium mb-2">You're registered.</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Check your email for the session link. Want your deal reviewed live on the call?
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/tools/deal-desk?src=deal-room">Submit your deal</Link>
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim() && email.trim()) register.mutate();
                  }}
                >
                  <div>
                    <Label htmlFor="deal-room-name">Name</Label>
                    <Input
                      id="deal-room-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      data-testid="input-deal-room-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deal-room-email">Email</Label>
                    <Input
                      id="deal-room-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      data-testid="input-deal-room-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deal-room-phone">Phone (optional)</Label>
                    <Input
                      id="deal-room-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      data-testid="input-deal-room-phone"
                    />
                  </div>
                  {phone.trim().length > 0 && (
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="deal-room-sms"
                        checked={smsConsent}
                        onCheckedChange={(v) => setSmsConsent(v === true)}
                      />
                      <Label htmlFor="deal-room-sms" className="text-sm font-normal text-muted-foreground leading-snug">
                        Text me a reminder before the session. Message frequency is one per session; reply STOP to opt out.
                      </Label>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={register.isPending} data-testid="button-deal-room-register">
                    {register.isPending ? "Registering..." : "Register free"}
                  </Button>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sessions are recorded. Replays are published on realist.ca and recordings are used to
                    improve Realist's analysis tools. By registering you agree to receive session emails.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Submit a deal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-primary" /> Get your deal reviewed live
              </CardTitle>
              <CardDescription>
                Submit the address and your numbers before the call. We pull it up on screen and
                underwrite it with you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <ClipboardList className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  Run your numbers in the analyzer, or bring what you have.
                </li>
                <li className="flex gap-2">
                  <Inbox className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  Submit the deal through the Deal Desk and mention the Deal Room.
                </li>
                <li className="flex gap-2">
                  <Video className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  We review it live on Monday — cash flow, financing, and the verdict.
                </li>
              </ol>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/tools/analyzer">Run your numbers</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/tools/deal-desk?src=deal-room">Submit your deal</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Replays */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Session replays</h2>
            <p className="text-sm text-muted-foreground">Free — enter your email and watch.</p>
          </div>
          {!replays || replays.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <PlayCircle className="h-8 w-8 mx-auto mb-3 opacity-60" />
                <p>The first hosted replay lands after the next session. Register above and we'll email it to you.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {replays.map((replay) => (
                <Card key={replay.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {replay.title} —{" "}
                      {new Intl.DateTimeFormat("en-CA", {
                        month: "long",
                        day: "numeric",
                        timeZone: "America/Toronto",
                      }).format(new Date(replay.scheduledAt))}
                    </CardTitle>
                    {replay.aiSummary && (
                      <CardDescription className="line-clamp-3">{replay.aiSummary}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {activeReplay?.id === replay.id ? (
                      <div className="aspect-video w-full rounded-lg overflow-hidden border">
                        <iframe
                          src={activeReplay.embedUrl}
                          className="w-full h-full"
                          allow="autoplay; fullscreen"
                          title={`${replay.title} replay`}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleWatch(replay)}
                        disabled={unlock.isPending}
                        data-testid={`button-watch-replay-${replay.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        {unlock.isPending ? "Unlocking..." : "Watch replay"}
                      </Button>
                    )}
                    {replay.aiChapters.length > 0 && activeReplay?.id !== replay.id && (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {replay.aiChapters.slice(0, 4).map((chapter, i) => (
                          <li key={i}>• {chapter.label}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Next step */}
        <Card className="bg-muted/40">
          <CardContent className="py-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Working a deal right now?</h3>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-4">
              If Monday is too far away, talk it through with the team this week — financing,
              offer strategy, or whether to walk.
            </p>
            <Button asChild>
              <Link href="/book-a-call">
                <PhoneCall className="h-4 w-4 mr-2" /> Book a call
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Replay email capture */}
      <Dialog open={unlockTarget !== null} onOpenChange={(open) => !open && setUnlockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Watch the replay</DialogTitle>
            <DialogDescription>
              Free, no account. We'll email you the link so you can finish it later.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (unlockTarget && unlockEmail.trim()) unlock.mutate(unlockTarget);
            }}
          >
            <div>
              <Label htmlFor="replay-email">Email</Label>
              <Input
                id="replay-email"
                type="email"
                value={unlockEmail}
                onChange={(e) => setUnlockEmail(e.target.value)}
                required
                autoFocus
                data-testid="input-replay-email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={unlock.isPending}>
              {unlock.isPending ? "Unlocking..." : "Watch now"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
