/**
 * Admin — Power Team verification queue (/admin/power-team, FN-1).
 *
 * Reviews professional_profiles that submitted a licence (verification_status
 * "pending") and marks them verified or rejected.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, Loader2 } from "lucide-react";
import { ROLE_LABELS, verificationBadge, type VerificationStatus } from "@shared/professionalProfiles";

type AdminProfile = {
  id: string;
  userId: string;
  roles: string[];
  company: string | null;
  bio: string | null;
  serviceAreas: string[];
  licenceBody: string | null;
  licenceNumber: string | null;
  verificationStatus: VerificationStatus;
};

export default function AdminPowerTeam() {
  const [status, setStatus] = useState<string>("pending");
  const { data, isLoading, error, refetch } = useQuery<{ profiles: AdminProfile[] }>({
    queryKey: ["/api/admin/power-team/profiles", status],
    queryFn: async () => {
      const res = await fetch(`/api/admin/power-team/profiles?status=${status}`, { credentials: "include" });
      if (!res.ok) throw new Error("Admin access required");
      return res.json();
    },
    retry: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, decision: "verified" | "rejected") {
    setBusyId(id);
    try {
      await apiRequest("POST", `/api/admin/power-team/profiles/${id}/verify`, { decision });
      refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Power Team verification</h1>
            <p className="text-muted-foreground">Approve licensed professionals so their notes are badged verified.</p>
          </div>
          <div className="flex gap-2">
            {["pending", "verified", "unverified", "rejected"].map((s) => (
              <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-muted-foreground">Sign in as an admin to review the queue.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !data?.profiles.length ? (
          <p className="text-sm text-muted-foreground">No {status} profiles.</p>
        ) : (
          <div className="space-y-3">
            {data.profiles.map((p) => {
              const badge = verificationBadge(p.verificationStatus);
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      {p.company || "Independent"}
                      <Badge variant={badge.tone === "green" ? "default" : "secondary"}>{badge.label}</Badge>
                      {p.roles.map((r) => (
                        <Badge key={r} variant="outline">{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</Badge>
                      ))}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {p.bio && <p className="text-muted-foreground">{p.bio}</p>}
                    <div className="text-muted-foreground">
                      Licence: <span className="font-medium text-foreground">{p.licenceBody || "—"} {p.licenceNumber || ""}</span>
                      {p.serviceAreas.length > 0 && <> · Areas: {p.serviceAreas.join(", ")}</>}
                    </div>
                    {p.verificationStatus !== "verified" && p.verificationStatus !== "rejected" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" disabled={busyId === p.id} onClick={() => decide(p.id, "verified")}>
                          <ShieldCheck className="mr-1 h-4 w-4" /> Verify
                        </Button>
                        <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => decide(p.id, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
