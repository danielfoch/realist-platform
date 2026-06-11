import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgendaSection, RealistEventPayload, RealistEventSpeaker, RealistEventTicketType } from "./types";

const emptySpeaker: RealistEventSpeaker = { name: "", title: "", company: "", bio: "", imageUrl: "", sortOrder: 0 };
const emptyTicket: RealistEventTicketType = {
  name: "General Admission",
  description: "",
  priceCents: 9900,
  currency: "cad",
  quantityTotal: 50,
  salesStartAt: "",
  salesEndAt: "",
  isActive: true,
};
const emptyAgenda: AgendaSection = { title: "", description: "", time: "" };

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value?: string | null) {
  return value ? new Date(value).toISOString() : null;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function EventForm({ event }: { event?: RealistEventPayload }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const initial = useMemo<RealistEventPayload>(() => ({
    title: event?.title || "",
    slug: event?.slug || "",
    shortDescription: event?.shortDescription || "",
    longDescription: event?.longDescription || "",
    headerImageUrl: event?.headerImageUrl || "",
    eventType: event?.eventType || "IN_PERSON",
    status: event?.status || "DRAFT",
    startsAt: toDatetimeLocal(event?.startsAt),
    endsAt: toDatetimeLocal(event?.endsAt),
    timezone: event?.timezone || "America/Toronto",
    venueName: event?.venueName || "",
    venueAddress: event?.venueAddress || "",
    onlineUrl: event?.onlineUrl || "",
    agendaSections: event?.agendaSections?.length ? event.agendaSections : [{ ...emptyAgenda }],
    capacity: event?.capacity ?? 50,
    refundPolicy: event?.refundPolicy || "",
    seoTitle: event?.seoTitle || "",
    seoDescription: event?.seoDescription || "",
    kind: event?.kind || "flagship",
    city: event?.city || "",
    isRecurring: event?.isRecurring || false,
    recurrenceNote: event?.recurrenceNote || "",
    speakers: event?.speakers?.length ? event.speakers : [{ ...emptySpeaker }],
    ticketTypes: event?.ticketTypes?.length ? event.ticketTypes : [{ ...emptyTicket }],
  }), [event]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof RealistEventPayload>(key: K, value: RealistEventPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateArray<T>(key: "speakers" | "ticketTypes" | "agendaSections", index: number, patch: Partial<T>) {
    setForm((current) => ({
      ...current,
      [key]: (current[key] as T[]).map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  }

  async function submit() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        startsAt: fromDatetimeLocal(form.startsAt)!,
        endsAt: fromDatetimeLocal(form.endsAt),
        capacity: form.capacity === null || form.capacity === undefined || String(form.capacity) === "" ? null : Number(form.capacity),
        speakers: form.speakers.filter((speaker) => speaker.name.trim()),
        agendaSections: form.agendaSections.filter((section) => section.title.trim()),
        ticketTypes: form.ticketTypes.filter((ticket) => ticket.name.trim()).map((ticket) => ({
          ...ticket,
          priceCents: Number(ticket.priceCents),
          quantityTotal: ticket.quantityTotal === null || ticket.quantityTotal === undefined || String(ticket.quantityTotal) === "" ? null : Number(ticket.quantityTotal),
          salesStartAt: fromDatetimeLocal(ticket.salesStartAt),
          salesEndAt: fromDatetimeLocal(ticket.salesEndAt),
        })),
      };
      const response = await apiRequest(event?.id ? "PATCH" : "POST", event?.id ? `/api/admin/events/${event.id}` : "/api/admin/events", payload);
      const saved = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: "Event saved", description: saved.title });
      navigate(`/admin/events/${saved.id}/edit`);
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message || "Check the form and try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Event details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Event title</Label>
            <Input value={form.title} onChange={(e) => {
              setForm((current) => ({ ...current, title: e.target.value, slug: current.slug || slugify(e.target.value) }));
            }} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setField("slug", slugify(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={form.kind || "flagship"} onValueChange={(value: any) => setField("kind", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flagship">Flagship (paid tickets)</SelectItem>
                <SelectItem value="meetup">Meetup (free, RSVP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input placeholder="Toronto" value={form.city || ""} onChange={(e) => setField("city", e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-7">
            <Switch checked={!!form.isRecurring} onCheckedChange={(checked) => setField("isRecurring", checked)} />
            <Label>Recurring series</Label>
          </div>
          <div className="space-y-2">
            <Label>Recurrence note</Label>
            <Input placeholder="First Tuesday monthly" value={form.recurrenceNote || ""} onChange={(e) => setField("recurrenceNote", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(value: any) => setField("status", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Short description</Label>
            <Textarea value={form.shortDescription || ""} onChange={(e) => setField("shortDescription", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Long description</Label>
            <Textarea rows={8} value={form.longDescription || ""} onChange={(e) => setField("longDescription", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Header image URL</Label>
            <Input value={form.headerImageUrl || ""} onChange={(e) => setField("headerImageUrl", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Schedule and location</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Event type</Label>
            <Select value={form.eventType} onValueChange={(value: any) => setField("eventType", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_PERSON">In person</SelectItem>
                <SelectItem value="WEBINAR">Webinar</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input value={form.timezone} onChange={(e) => setField("timezone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Start date/time</Label>
            <Input type="datetime-local" value={form.startsAt} onChange={(e) => setField("startsAt", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End date/time</Label>
            <Input type="datetime-local" value={form.endsAt || ""} onChange={(e) => setField("endsAt", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Venue name</Label>
            <Input value={form.venueName || ""} onChange={(e) => setField("venueName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Venue address</Label>
            <Input value={form.venueAddress || ""} onChange={(e) => setField("venueAddress", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Online meeting URL</Label>
            <Input value={form.onlineUrl || ""} onChange={(e) => setField("onlineUrl", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ticket tiers</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => setField("ticketTypes", [...form.ticketTypes, { ...emptyTicket }])}>
            <Plus className="mr-2 h-4 w-4" /> Add ticket
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Event capacity</Label>
            <Input type="number" value={form.capacity ?? ""} onChange={(e) => setField("capacity", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
          {form.ticketTypes.map((ticket, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
              <Input placeholder="Name" value={ticket.name} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { name: e.target.value })} />
              <Input type="number" placeholder="Price cents" value={ticket.priceCents} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { priceCents: Number(e.target.value) })} />
              <Input placeholder="Currency" value={ticket.currency} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { currency: e.target.value.toLowerCase() })} />
              <Input type="number" placeholder="Quantity" value={ticket.quantityTotal ?? ""} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { quantityTotal: e.target.value === "" ? null : Number(e.target.value) })} />
              <Textarea className="md:col-span-4" placeholder="Description" value={ticket.description || ""} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { description: e.target.value })} />
              <Input type="datetime-local" value={toDatetimeLocal(ticket.salesStartAt)} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { salesStartAt: e.target.value })} />
              <Input type="datetime-local" value={toDatetimeLocal(ticket.salesEndAt)} onChange={(e) => updateArray<RealistEventTicketType>("ticketTypes", index, { salesEndAt: e.target.value })} />
              <div className="flex items-center gap-2">
                <Switch checked={ticket.isActive} onCheckedChange={(checked) => updateArray<RealistEventTicketType>("ticketTypes", index, { isActive: checked })} />
                <Label>Active</Label>
              </div>
              <Button type="button" variant="ghost" onClick={() => setField("ticketTypes", form.ticketTypes.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Speakers and agenda</CardTitle>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setField("speakers", [...form.speakers, { ...emptySpeaker }])}>Add speaker</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setField("agendaSections", [...form.agendaSections, { ...emptyAgenda }])}>Add agenda</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.speakers.map((speaker, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
              <Input placeholder="Name" value={speaker.name} onChange={(e) => updateArray<RealistEventSpeaker>("speakers", index, { name: e.target.value })} />
              <Input placeholder="Title" value={speaker.title || ""} onChange={(e) => updateArray<RealistEventSpeaker>("speakers", index, { title: e.target.value })} />
              <Input placeholder="Company" value={speaker.company || ""} onChange={(e) => updateArray<RealistEventSpeaker>("speakers", index, { company: e.target.value })} />
              <Input className="md:col-span-2" placeholder="Image URL" value={speaker.imageUrl || ""} onChange={(e) => updateArray<RealistEventSpeaker>("speakers", index, { imageUrl: e.target.value })} />
              <Input type="number" placeholder="Sort" value={speaker.sortOrder || 0} onChange={(e) => updateArray<RealistEventSpeaker>("speakers", index, { sortOrder: Number(e.target.value) })} />
              <Textarea className="md:col-span-3" placeholder="Bio" value={speaker.bio || ""} onChange={(e) => updateArray<RealistEventSpeaker>("speakers", index, { bio: e.target.value })} />
            </div>
          ))}
          {form.agendaSections.map((section, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[160px_1fr]">
              <Input placeholder="Time" value={section.time || ""} onChange={(e) => updateArray<AgendaSection>("agendaSections", index, { time: e.target.value })} />
              <Input placeholder="Title" value={section.title} onChange={(e) => updateArray<AgendaSection>("agendaSections", index, { title: e.target.value })} />
              <Textarea className="md:col-span-2" placeholder="Description" value={section.description || ""} onChange={(e) => updateArray<AgendaSection>("agendaSections", index, { description: e.target.value })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Policy and SEO</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Textarea placeholder="Refund policy" value={form.refundPolicy || ""} onChange={(e) => setField("refundPolicy", e.target.value)} />
          <Input placeholder="SEO title" value={form.seoTitle || ""} onChange={(e) => setField("seoTitle", e.target.value)} />
          <Textarea placeholder="SEO description" value={form.seoDescription || ""} onChange={(e) => setField("seoDescription", e.target.value)} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={submit} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save event"}
        </Button>
      </div>
    </div>
  );
}
