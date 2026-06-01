import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Plus } from "lucide-react";
import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

type AdminEventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string;
  eventType: string;
};

export default function AdminEvents() {
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const { data: events = [], isLoading, error, refetch } = useQuery<AdminEventRow[]>({
    queryKey: ["/api/admin/events"],
    retry: false,
  });

  async function unlockEventsAdmin() {
    setUnlocking(true);
    setUnlockError(null);
    try {
      await apiRequest("POST", "/api/admin/events/unlock", { password });
      setPassword("");
      await refetch();
    } catch {
      setUnlockError("That password did not work.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground">Create and publish standardized Realist event pages.</p>
          </div>
          <Button asChild>
            <Link href="/admin/events/new"><Plus className="mr-2 h-4 w-4" /> New event</Link>
          </Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Event list</CardTitle></CardHeader>
          <CardContent>
            {error ? (
              <div className="max-w-md space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Enter event admin password</h2>
                  <p className="text-sm text-muted-foreground">
                    This temporary gate unlocks event admin tools for the current browser session.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="events-admin-password">Password</Label>
                  <Input
                    id="events-admin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") unlockEventsAdmin();
                    }}
                    autoComplete="current-password"
                  />
                </div>
                {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
                <Button onClick={unlockEventsAdmin} disabled={unlocking || !password}>
                  {unlocking ? "Unlocking..." : "Unlock Events Admin"}
                </Button>
              </div>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading events...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-xs text-muted-foreground">/events/{event.slug}</div>
                      </TableCell>
                      <TableCell><Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>{event.status}</Badge></TableCell>
                      <TableCell>{new Date(event.startsAt).toLocaleString()}</TableCell>
                      <TableCell>{event.eventType}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/events/${event.id}/edit`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
