import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Link2, Plus, RefreshCw } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminEventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string;
  eventType: string;
  isFeatured?: boolean;
};

type MeetupStatus = {
  configured: boolean;
  connected: boolean;
  networkUrlname: string;
  account: string | null;
  lastSyncedAt: string | null;
};

export default function AdminEvents() {
  const [syncState, setSyncState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const { data: events = [], isLoading, error } = useQuery<AdminEventRow[]>({
    queryKey: ["/api/admin/events"],
    retry: false,
  });
  const { data: meetup, refetch: refetchMeetup } = useQuery<MeetupStatus>({
    queryKey: ["/api/admin/integrations/meetup/status"],
    retry: false,
  });

  async function syncMeetup() {
    setSyncState("busy");
    try {
      const response = await fetch("/api/admin/integrations/meetup/sync", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Sync failed");
      setSyncState("done");
      await refetchMeetup();
      window.location.reload();
    } catch {
      setSyncState("error");
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
        {!error && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Meetup Pro calendar</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {meetup?.connected ? `Connected${meetup.account ? ` as ${meetup.account}` : ""}` : "Not connected"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {meetup?.connected
                    ? `Syncing /pro/${meetup.networkUrlname}/${meetup.lastSyncedAt ? ` · Last sync ${new Date(meetup.lastSyncedAt).toLocaleString()}` : ""}`
                    : meetup?.configured
                      ? "Authorize the Realist administrator account once, then upcoming Meetup events sync automatically."
                      : "Add the Meetup client credentials to the deployment secrets before connecting."}
                </p>
                {syncState === "error" && <p className="mt-1 text-sm text-destructive">Meetup sync failed. Check the connection and server log.</p>}
              </div>
              <div className="flex gap-2">
                {meetup?.connected && (
                  <Button variant="outline" onClick={syncMeetup} disabled={syncState === "busy"}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncState === "busy" ? "animate-spin" : ""}`} />
                    Sync now
                  </Button>
                )}
                {meetup?.configured ? (
                  <Button asChild>
                    <a href="/api/admin/integrations/meetup/connect">{meetup.connected ? "Reconnect" : "Connect Meetup"}</a>
                  </Button>
                ) : (
                  <Button disabled>Connect Meetup</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Event list</CardTitle></CardHeader>
          <CardContent>
            {error ? (
              <div className="max-w-md space-y-2">
                <h2 className="text-lg font-semibold">Events admin access required</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in as jonathan@realist.ca, danielfoch@gmail.com, or na4hill@gmail.com to create and publish events.
                </p>
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
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>{event.status}</Badge>
                          {event.isFeatured && <Badge variant="outline" className="border-primary/50 text-primary">Homepage</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(event.startsAt).toLocaleString()}</TableCell>
                      <TableCell>{event.eventType}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost" className="mr-2">
                          <Link href={`/admin/events/${event.id}/roster`}>Roster</Link>
                        </Button>
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
