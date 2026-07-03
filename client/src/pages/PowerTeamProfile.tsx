/**
 * Power Team profile — /power-team/profile (FN-1)
 *
 * A signed-in professional claims/edits their profile: roles, company, bio,
 * service areas, and (optionally) a licence to enter the verification queue.
 * The verification tier badges their field notes across the platform.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { POWER_TEAM_ROLES, ROLE_LABELS, verificationBadge, type VerificationStatus } from "@shared/professionalProfiles";

type Profile = {
  roles: string[];
  company: string | null;
  bio: string | null;
  serviceAreas: string[];
  licenceBody: string | null;
  licenceNumber: string | null;
  verificationStatus: VerificationStatus;
  leadCtaEnabled: boolean;
};

export default function PowerTeamProfile() {
  const { data, isLoading, error, refetch } = useQuery<{ profile: Profile | null }>({
    queryKey: ["/api/power-team/profile"],
    retry: false,
  });

  const [roles, setRoles] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [bio, setBio] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [licenceBody, setLicenceBody] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [leadCtaEnabled, setLeadCtaEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const profile = data?.profile ?? null;
  useEffect(() => {
    if (!profile) return;
    setRoles(profile.roles ?? []);
    setCompany(profile.company ?? "");
    setBio(profile.bio ?? "");
    setServiceAreas((profile.serviceAreas ?? []).join(", "));
    setLicenceBody(profile.licenceBody ?? "");
    setLicenceNumber(profile.licenceNumber ?? "");
    setLeadCtaEnabled(profile.leadCtaEnabled ?? true);
  }, [profile]);

  const toggleRole = (key: string) =>
    setRoles((p) => (p.includes(key) ? p.filter((r) => r !== key) : p.length < 4 ? [...p, key] : p));

  async function save() {
    setFormError(null);
    if (!roles.length) {
      setFormError("Pick at least one role.");
      return;
    }
    setBusy(true);
    setSaved(false);
    try {
      await apiRequest("POST", "/api/power-team/claim", {
        roles,
        company: company || null,
        bio: bio || null,
        serviceAreas: serviceAreas.split(",").map((s) => s.trim()).filter(Boolean),
        licenceBody: licenceBody || null,
        licenceNumber: licenceNumber || null,
        leadCtaEnabled,
      });
      setSaved(true);
      refetch();
    } catch (err: any) {
      setFormError(err?.message?.replace(/^\d+:\s*/, "") || "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Sign in to claim your profile</h1>
          <p className="mt-2 text-muted-foreground">The Power Team profile is for signed-in professionals.</p>
          <Button asChild className="mt-6"><Link href="/login">Sign in</Link></Button>
        </main>
      </div>
    );
  }

  const badge = profile ? verificationBadge(profile.verificationStatus) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Power Team profile</h1>
            <p className="text-muted-foreground">Post field notes, get lead-gen visibility, build reputation.</p>
          </div>
          {badge && (
            <Badge variant={badge.tone === "green" ? "default" : "secondary"} className="gap-1">
              {badge.tone === "green" && <ShieldCheck className="h-3.5 w-3.5" />} {badge.label}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">Roles (up to 4)</Label>
                <div className="flex flex-wrap gap-2">
                  {POWER_TEAM_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`rounded-full border px-3 py-1 text-sm ${roles.includes(r) ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"}`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="areas">Service areas (comma-separated)</Label>
                  <Input id="areas" value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="Toronto, M4L, Hamilton" />
                </div>
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
              </div>
              <div className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Get verified (optional)</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Add your licence and we'll review it. Verified pros are badged and rank above unverified notes.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="lbody">Licence body</Label>
                    <Input id="lbody" value={licenceBody} onChange={(e) => setLicenceBody(e.target.value)} placeholder="OAA / RPP / RECO / FSRA" />
                  </div>
                  <div>
                    <Label htmlFor="lnum">Licence number</Label>
                    <Input id="lnum" value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={leadCtaEnabled} onChange={(e) => setLeadCtaEnabled(e.target.checked)} />
                Show a "Work with me" lead button on my field notes
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex items-center gap-3">
                <Button onClick={save} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {profile ? "Save profile" : "Create profile"}
                </Button>
                {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
