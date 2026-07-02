import { FormEvent, useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePersistedTab } from "@/hooks/use-persisted-tab";
import type { DealNote, LeaderboardEntry } from "@shared/engagement";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Hammer,
  Medal,
  MessageSquarePlus,
  Save,
  Send,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

// The fabricated `sampleDeals` watchlist that used to render here is gone —
// the Watchlist tab now shows the user's REAL watches and saved searches via
// WatchlistPanel (/api/watchlists). /watchlist itself routes to the dedicated
// Watchlist page.

const sampleNotes: DealNote[] = [
  {
    id: "note-001",
    listingId: "duplex-hamilton-001",
    userName: "Maya L.",
    userRole: "property_manager",
    visibility: "professional",
    noteType: "rent_feedback",
    comment: "Upper unit rent assumption looks high unless parking is included and laundry is separate.",
    suggestedValue: 2150,
    originalValue: 2350,
    confidence: 0.78,
    physicallyInspected: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "note-002",
    listingId: "duplex-hamilton-001",
    userName: "Devon R.",
    userRole: "contractor",
    visibility: "professional",
    noteType: "repair_estimate",
    comment: "Exterior drainage and rear stairs should be budgeted before financing assumptions are finalized.",
    suggestedValue: 42000,
    confidence: 0.72,
    physicallyInspected: true,
    createdAt: new Date().toISOString(),
  },
];

const prototypeLeaders: LeaderboardEntry[] = [
  { rank: 1, userId: "u1", name: "Maya L.", role: "property_manager", market: "Hamilton", totalPoints: 1840, weeklyPoints: 185, monthlyPoints: 510, contributionCount: 142, verifiedContributionCount: 83, badges: ["Rent Validator", "Local Market Expert"], avatarUrl: "" },
  { rank: 2, userId: "u2", name: "Devon R.", role: "contractor", market: "GTA West", totalPoints: 1715, weeklyPoints: 165, monthlyPoints: 470, contributionCount: 98, verifiedContributionCount: 71, badges: ["Contractor Verified", "Risk Spotter"], avatarUrl: "" },
  { rank: 3, userId: "u3", name: "Priya S.", role: "investor", market: "Windsor", totalPoints: 1490, weeklyPoints: 132, monthlyPoints: 421, contributionCount: 121, verifiedContributionCount: 48, badges: ["Deal Hunter", "Sharp Underwriter"], avatarUrl: "" },
];

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

function formDataObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold font-mono">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvestorOperatingSystem() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = usePersistedTab("investorOS.activeTab", "watchlist", ["watchlist", "notes", "professionals", "challenge", "events"]);
  const [notes, setNotes] = useState(sampleNotes);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState("CRM webhook not tested this session.");

  const investorScore = useMemo(() => {
    const contributionScore = 74;
    const dealAnalysisScore = 68;
    const helpfulness = 81;
    return Math.round((contributionScore + dealAnalysisScore + helpfulness) / 3);
  }, []);

  async function submitEvent(form: HTMLFormElement, endpoint: string, label: string) {
    setSubmitting(label);
    try {
      const data = formDataObject(form);
      const response = await apiRequest("POST", endpoint, data);
      const result = await response.json();
      toast({ title: "Saved", description: `${label} created structured engagement data.` });
      setWebhookStatus(`Last event: ${result.eventId}. Webhook status: ${result.webhook?.status || "unknown"}.`);
      form.reset();
      return result;
    } catch (error: any) {
      toast({ title: "Could not submit", description: error?.message || "Please try again.", variant: "destructive" });
      return null;
    } finally {
      setSubmitting(null);
    }
  }

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formDataObject(form);
    const result = await submitEvent(form, "/api/engagement/deal-notes", "Deal note");
    if (result) {
      setNotes((current) => [
        {
          id: result.eventId,
          listingId: String(data.listingId),
          userName: String(data.userName || "Anonymous investor"),
          userRole: String(data.userRole || "investor") as DealNote["userRole"],
          visibility: String(data.visibility || "public") as DealNote["visibility"],
          noteType: String(data.noteType || "general") as DealNote["noteType"],
          comment: String(data.comment),
          suggestedValue: data.suggestedValue ? Number(data.suggestedValue) : undefined,
          confidence: data.confidence ? Number(data.confidence) : undefined,
          physicallyInspected: data.physicallyInspected === "on",
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    }
  }

  async function testWebhook() {
    setSubmitting("CRM test");
    try {
      const response = await apiRequest("POST", "/api/dev/test-crm-webhook", {});
      const result = await response.json();
      setWebhookStatus(`Dev test event: ${result.eventId}. Webhook status: ${result.webhook?.status || "unknown"}.`);
    } catch (error: any) {
      setWebhookStatus(error?.message || "CRM test route unavailable.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Investor OS - Realist"
        description="Save deals, add structured deal notes, compare opportunities, request professional feedback, and build AI-ready contribution data."
        canonicalUrl="/tools/investor-os"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Prototype intelligence engine</Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Realist Investor OS</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Find better investment properties with AI-ready underwriting, crowd-sourced deal notes, professional feedback, and structured contribution data.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/community/leaderboard"><Button variant="outline" className="gap-2"><Trophy className="h-4 w-4" /> Leaderboard</Button></Link>
            <Link href="/compare"><Button className="gap-2"><BarChart3 className="h-4 w-4" /> Compare Deals</Button></Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatTile label="Investor score" value={`${investorScore}/100`} icon={Medal} />
          <StatTile label="Watchlist" value="Live alerts" icon={Save} />
          <StatTile label="Structured notes" value={String(notes.length)} icon={MessageSquarePlus} />
          <StatTile label="Pro requests" value="6 types" icon={BriefcaseBusiness} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="notes">Deal Notes</TabsTrigger>
            <TabsTrigger value="professionals">Pros</TabsTrigger>
            <TabsTrigger value="challenge">Challenge</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist" className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
              <WatchlistPanel />

              <Card>
                <CardHeader>
                  <CardTitle>Investor Reputation</CardTitle>
                  <CardDescription>Deterministic scoring encourages useful contributions before any ML model exists.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Contribution score</span><span>74</span></div>
                    <Progress value={74} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Deal analysis score</span><span>68</span></div>
                    <Progress value={68} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Community helpfulness</span><span>81</span></div>
                    <Progress value={81} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {["Deal Hunter", "Sharp Underwriter", "Rent Validator", "Risk Spotter", "Early Realist Member"].map((badge) => <Badge key={badge} variant="secondary">{badge}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Add Deal Feedback</CardTitle>
                <CardDescription>Every note improves the deal intelligence layer.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNoteSubmit} className="space-y-4">
                  <input type="hidden" name="listingId" value="duplex-hamilton-001" />
                  <input type="hidden" name="address" value="42 Barton St E" />
                  <input type="hidden" name="city" value="Hamilton" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Name</Label><Input name="userName" placeholder="Your name" /></div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select name="userRole" defaultValue="investor"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["investor", "realtor", "contractor", "property_manager", "lender", "inspector"].map((v) => <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Feedback type</Label>
                      <Select name="noteType" defaultValue="rent_feedback"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["general", "price_feedback", "rent_feedback", "repair_estimate", "arv_feedback", "risk_flag", "offer_strategy", "financing_note", "inspection_note", "comparable_note"].map((v) => <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <Select name="visibility" defaultValue="public"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["private", "public", "professional", "team"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Suggested value</Label><Input name="suggestedValue" type="number" placeholder="2150" /></div>
                    <div className="space-y-2"><Label>Confidence 0-1</Label><Input name="confidence" type="number" min="0" max="1" step="0.05" placeholder="0.75" /></div>
                  </div>
                  <div className="space-y-2"><Label>Comment</Label><Textarea name="comment" required placeholder="This only works if rent is..." /></div>
                  <Button type="submit" className="w-full gap-2" disabled={submitting === "Deal note"}><Send className="h-4 w-4" /> Submit structured note</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Community Deal Feed</CardTitle>
                <CardDescription>Recent structured contributions from investors and professionals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={note.noteType === "risk_flag" ? "destructive" : "secondary"}>{note.noteType.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline">{note.userRole.replace(/_/g, " ")}</Badge>
                      <span className="text-sm text-muted-foreground">{note.userName}</span>
                    </div>
                    <p className="text-sm">{note.comment}</p>
                    {note.suggestedValue && <p className="text-sm font-mono mt-2">Suggested: {currency.format(note.suggestedValue)}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="professionals" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Professional Request Workflow</CardTitle>
                <CardDescription>Request contractor quotes, CMAs, rent validation, financing, inspection, insurance, or legal feedback.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(event) => { event.preventDefault(); submitEvent(event.currentTarget, "/api/engagement/professional-request", "Professional request"); }} className="space-y-4">
                  <input type="hidden" name="listingId" value="duplex-hamilton-001" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Name</Label><Input name="name" required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Market</Label><Input name="market" defaultValue="Hamilton" required /></div>
                    <div className="space-y-2">
                      <Label>Professional type</Label>
                      <Select name="professionalType" defaultValue="contractor"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["contractor", "realtor", "property_manager", "lender", "inspector", "insurance_broker", "lawyer"].map((v) => <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Requested service</Label><Input name="requestedService" defaultValue="Validate repair budget and timeline" required /></div>
                  <div className="space-y-2"><Label>Message</Label><Textarea name="message" placeholder="What do you need checked?" /></div>
                  <Button type="submit" className="w-full gap-2"><Hammer className="h-4 w-4" /> Request professional feedback</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prototype Leaderboard</CardTitle>
                <CardDescription>Climb by spotting risks, validating rents, submitting notes, and helping investors make sharper decisions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {prototypeLeaders.map((entry) => (
                  <div key={entry.userId} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center font-mono">#{entry.rank}</div>
                    <div className="flex-1">
                      <p className="font-medium">{entry.name}</p>
                      <p className="text-sm text-muted-foreground">{entry.role.replace(/_/g, " ")} · {entry.market}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">{entry.totalPoints}</p>
                      <p className="text-xs text-muted-foreground">{entry.verifiedContributionCount} verified</p>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Anti-gaming placeholder: repeated low-quality comments do not earn full points; verified professional contributions carry higher confidence.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="challenge" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Swords className="h-5 w-5" /> Deal Challenge</CardTitle>
                <CardDescription>Would you buy this duplex? Submit offer, rent, repairs, and risk flags.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(event) => { event.preventDefault(); submitEvent(event.currentTarget, "/api/engagement/deal-challenge", "Deal challenge"); }} className="space-y-4">
                  <input type="hidden" name="listingId" value="duplex-hamilton-001" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2"><Label>Offer price</Label><Input name="offerPrice" type="number" defaultValue="642000" required /></div>
                    <div className="space-y-2"><Label>Rent</Label><Input name="estimatedRent" type="number" defaultValue="4550" required /></div>
                    <div className="space-y-2"><Label>Repairs</Label><Input name="repairBudget" type="number" defaultValue="42000" required /></div>
                  </div>
                  <div className="space-y-2"><Label>Risk flags</Label><Input name="riskFlags" defaultValue="drainage, rent assumption, insurance" /></div>
                  <div className="space-y-2"><Label>Confidence 0-1</Label><Input name="confidence" type="number" min="0" max="1" step="0.05" defaultValue="0.72" /></div>
                  <Button type="submit" className="w-full gap-2"><ClipboardList className="h-4 w-4" /> Submit challenge</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deal Battle</CardTitle>
                <CardDescription>Compare cash flow, risk, upside, community feedback, and professional feedback.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="[&_td]:py-2 [&_td]:border-b">
                    <tr><td>Metric</td><td>Hamilton duplex</td><td>Windsor triplex</td></tr>
                    <tr><td>Cap rate</td><td>5.9%</td><td>6.4%</td></tr>
                    <tr><td>Cash flow</td><td>$410/mo</td><td>$520/mo</td></tr>
                    <tr><td>Repair budget</td><td>$42,000</td><td>$26,000</td></tr>
                    <tr><td>Risk score</td><td>38</td><td>44</td></tr>
                    <tr><td>Feedback count</td><td>12</td><td>7</td></tr>
                    <tr><td>Professional notes</td><td>3</td><td>1</td></tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Daily/Weekly Digest Signup</CardTitle>
                <CardDescription>Stay updated when saved deals get new notes, quotes, risk flags, or professional feedback.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(event) => { event.preventDefault(); submitEvent(event.currentTarget, "/api/engagement/waitlist", "Digest signup"); }} className="space-y-4">
                  <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Investor type</Label><Input name="investorType" defaultValue="buy-and-hold investor" required /></div>
                    <div className="space-y-2"><Label>Target market</Label><Input name="targetMarket" defaultValue="Hamilton" /></div>
                  </div>
                  <Button type="submit" className="w-full gap-2"><Bell className="h-4 w-4" /> Join deal digest</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CRM Webhook Status</CardTitle>
                <CardDescription>Email event layer and CRM-ready webhook adapter for future automations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border p-4 text-sm">{webhookStatus}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3"><CheckCircle2 className="h-4 w-4 mb-2 text-emerald-600" /><p className="font-medium">Structured events</p><p className="text-sm text-muted-foreground">Deal notes, saved deals, quotes, challenges, consults, and digests.</p></div>
                  <div className="rounded-md border p-3"><AlertTriangle className="h-4 w-4 mb-2 text-amber-600" /><p className="font-medium">Non-blocking delivery</p><p className="text-sm text-muted-foreground">Webhook failures do not break user-facing forms.</p></div>
                </div>
                <Button variant="outline" onClick={testWebhook} disabled={submitting === "CRM test"} className="gap-2">
                  <Users className="h-4 w-4" /> Test dev webhook route
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
