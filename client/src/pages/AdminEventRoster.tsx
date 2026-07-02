import { useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Check, Undo2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

type RosterResponse = {
  event: { id: string; title: string; slug: string; startsAt: string };
  summary: { orderCount: number; ticketsSold: number; attendees: number; checkedIn: number; grossCents: number };
  attendees: Array<{ id: string; name: string | null; email: string; ticketType: string; checkedInAt: string | null }>;
};

function money(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function AdminEventRoster() {
  const [, params] = useRoute("/admin/events/:id/roster");
  const eventId = params?.id || "";
  const queryClient = useQueryClient();
  const queryKey = ["/api/admin/events", eventId, "orders"];

  const { data, isLoading, error } = useQuery<RosterResponse>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", `/api/admin/events/${eventId}/orders`)).json(),
    retry: false,
  });

  const checkIn = useMutation({
    mutationFn: async ({ attendeeId, checkedIn }: { attendeeId: string; checkedIn: boolean }) =>
      apiRequest("POST", `/api/admin/events/${eventId}/attendees/${attendeeId}/check-in`, { checkedIn }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const s = data?.summary;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{data?.event.title || "Event roster"}</h1>
        <p className="mb-6 text-muted-foreground">Door check-in and order roster.</p>

        {error ? (
          <p className="text-sm text-muted-foreground">Events admin access required.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading roster…</p>
        ) : (
          <>
            {s && (
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Paid orders" value={String(s.orderCount)} />
                <Stat label="Tickets sold" value={String(s.ticketsSold)} />
                <Stat label="Checked in" value={`${s.checkedIn} / ${s.attendees}`} />
                <Stat label="Gross" value={money(s.grossCents)} />
              </div>
            )}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Attendees</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead className="text-right">Check-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.attendees || []).map((a) => {
                      const isIn = !!a.checkedInAt;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{a.email}</TableCell>
                          <TableCell>{a.ticketType}</TableCell>
                          <TableCell className="text-right">
                            {isIn && <Badge className="mr-2">Checked in</Badge>}
                            <Button
                              size="sm"
                              variant={isIn ? "ghost" : "default"}
                              disabled={checkIn.isPending}
                              onClick={() => checkIn.mutate({ attendeeId: a.id, checkedIn: !isIn })}
                            >
                              {isIn ? <><Undo2 className="mr-1 h-4 w-4" /> Undo</> : <><Check className="mr-1 h-4 w-4" /> Check in</>}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!data?.attendees.length && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No attendees yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
