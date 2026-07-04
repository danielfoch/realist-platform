/**
 * Power Team — /power-team
 *
 * Waitlist landing for the field-notes program announced at Unpacking
 * Multiplexes Toronto (Sept 15). Professionals join by role; contribution
 * earns lead-gen visibility, reputation, and data access when v1 ships.
 */
import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { CheckCircle2, Loader2, Users, FileText, TrendingUp, Database } from "lucide-react";
import { PowerTeamLeaders } from "@/components/PowerTeamLeaders";

const ROLES = [
  { key: "planner", label: "Planner (RPP)" },
  { key: "architect", label: "Architect / Designer" },
  { key: "gc_builder", label: "GC / Builder" },
  { key: "mortgage_pro", label: "Mortgage Professional" },
  { key: "realtor", label: "Realtor / Broker" },
  { key: "property_manager", label: "Property Manager" },
  { key: "arborist", label: "Arborist" },
  { key: "other", label: "Other trade" },
] as const;

export default function PowerTeam() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [note, setNote] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(key: string) {
    setRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : prev.length < 4 ? [...prev, key] : prev));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    track({ event: "lead_captured", source: "power_team_waitlist", strategy: roles.join(",") });
    try {
      await apiRequest("POST", "/api/power-team/waitlist", {
        name, email, roles,
        company: company || undefined,
        serviceAreas: serviceAreas || undefined,
        note: note || undefined,
        source: new URLSearchParams(window.location.search).get("source") || "web",
      });
      setDone(true);
    } catch {
      setError("Submission failed — check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3"><Users className="h-3 w-3 mr-1" /> Founding contributors</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Join the Realist Power Team</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Planners, architects, builders, mortgage pros, realtors, property managers, and arborists — add
            structured field notes to properties ("minor variance likely — side setback and height") and get
            found by the investors underwriting those deals.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10 text-sm">
          <div className="flex gap-3">
            <TrendingUp className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div><p className="font-medium">Get hired</p><p className="text-muted-foreground">Every note carries your profile with a direct contact CTA.</p></div>
          </div>
          <div className="flex gap-3">
            <FileText className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div><p className="font-medium">Build reputation</p><p className="text-muted-foreground">Peer endorsements, contributor leaderboard, verified badges.</p></div>
          </div>
          <div className="flex gap-3">
            <Database className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div><p className="font-medium">Unlock data</p><p className="text-muted-foreground">Contributors get area benchmarks and underwriting intelligence.</p></div>
          </div>
        </div>

        {done ? (
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold mb-1">You're on the list</h2>
              <p className="text-sm text-muted-foreground">We'll reach out when field notes open to founding contributors this fall.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-lg mx-auto">
            <CardHeader><CardTitle className="text-lg">Claim your spot</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="space-y-2">
                <Label>Your role{roles.length > 1 ? "s" : ""} <span className="text-muted-foreground">(pick up to 4)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => toggleRole(r.key)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        roles.includes(r.key)
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-background hover:bg-muted border-input"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pt-name">Name</Label>
                  <Input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-email">Email</Label>
                  <Input id="pt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pt-company">Company <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="pt-company" value={company} onChange={(e) => setCompany(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-areas">Service areas <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="pt-areas" placeholder="Toronto east end, Scarborough" value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-note">Anything we should know? <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea id="pt-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </div>
              <Button className="w-full h-12" disabled={busy || roles.length === 0 || name.trim().length < 2 || !email.includes("@")} onClick={submit}>
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining…</> : "Join the waitlist"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Field notes are professional opinions with attribution — never advice. Licence verification available at launch.
              </p>
            </CardContent>
          </Card>
        )}
        <PowerTeamLeaders />
      </main>
    </div>
  );
}
