import { useState } from "react";
import { useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECURRENCE_RULES, RECURRENCE_RULE_LABELS } from "@shared/eventRecurrence";

export default function MeetupNew() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    title: "",
    city: "",
    startsAt: "",
    venueName: "",
    venueAddress: "",
    shortDescription: "",
    capacity: "",
    recurrenceRule: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/member-meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title.trim(),
          city: form.city.trim(),
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
          venueName: form.venueName.trim() || null,
          venueAddress: form.venueAddress.trim() || null,
          shortDescription: form.shortDescription.trim() || null,
          capacity: form.capacity ? Number(form.capacity) : null,
          recurrenceRule: form.recurrenceRule && form.recurrenceRule !== "once" ? form.recurrenceRule : null,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/login?next=/community/meetups/new";
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to create meetup");
      navigate(`/events/${data.slug}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const valid = form.title.trim().length >= 4 && form.city.trim().length >= 2 && form.startsAt;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Host a real estate investor meetup</h1>
        <p className="mt-2 text-muted-foreground">
          Free to host, free to attend. Your meetup goes live on the Realist events hub
          and attendees RSVP with their Realist account.
        </p>
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Meetup details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="m-title">Title</Label>
              <Input id="m-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ottawa Multiplex Investors — June Meetup" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="m-city">City</Label>
                <Input id="m-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ottawa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-starts">Date & time</Label>
                <Input id="m-starts" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="m-venue">Venue name</Label>
                <Input id="m-venue" value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} placeholder="The Local Pub" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-capacity">Capacity (optional)</Label>
                <Input id="m-capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="40" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-address">Address</Label>
              <Input id="m-address" value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Repeats</Label>
              <Select value={form.recurrenceRule} onValueChange={(v) => setForm({ ...form, recurrenceRule: v })}>
                <SelectTrigger data-testid="select-recurrence">
                  <SelectValue placeholder="One-time meetup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time meetup</SelectItem>
                  {RECURRENCE_RULES.map((rule) => (
                    <SelectItem key={rule} value={rule}>{RECURRENCE_RULE_LABELS[rule]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Recurring meetups automatically re-post the next date after each one ends — set it once, never repost.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-desc">What should attendees expect?</Label>
              <Textarea id="m-desc" rows={4} value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} placeholder="Networking, a live deal analysis, and a local market update." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" onClick={submit} disabled={!valid || busy}>
              {busy ? "Publishing…" : "Publish meetup"}
            </Button>
            <p className="text-xs text-muted-foreground">
              You need a free Realist account to host. Meetups go live immediately and appear on the events hub.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
