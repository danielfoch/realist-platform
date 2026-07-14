import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Plus } from "lucide-react";
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

export default function AdminEvents() {
  const { data: events = [], isLoading, error } = useQuery<AdminEventRow[]>({
    queryKey: ["/api/admin/events"],
    retry: false,
  });

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
