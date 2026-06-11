import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

export interface NextStepDto {
  action: string;
  kind: string;
  reason: string;
  dueAt: string;
  priority: "now" | "today" | "soon";
  dealId?: string;
  emailDraft?: { subject: string; body: string };
  smsDraft?: string;
}

export interface CrmContactDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactType: string;
  stage: string;
  source: string | null;
  targetMarket: string | null;
  consentEmail: boolean;
  consentSms: boolean;
  lastTouchAt: string | null;
  createdAt: string;
  nextStep: NextStepDto;
}

export interface CrmDealDto {
  id: string;
  contactId: string;
  title: string;
  side: string;
  stage: string;
  propertyAddress: string | null;
  price: number | null;
  checklist: Array<{ label: string; done: boolean }>;
  keyDates: Record<string, string | null>;
}

export const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  nurturing: "Nurturing",
  appointment: "Appointment",
  client: "Client",
  past_client: "Past Client",
  lost: "Lost",
};

const PIPELINE_STAGES = ["new", "contacted", "nurturing", "appointment", "client"];

export const DEAL_STAGE_LABELS: Record<string, string> = {
  preparing: "Preparing",
  offer: "Offer Out",
  conditional: "Conditional",
  firm: "Firm",
  closed: "Closed",
  fell_through: "Fell Through",
};

export function priorityBadge(priority: NextStepDto["priority"]) {
  if (priority === "now") return <Badge variant="destructive">Overdue</Badge>;
  if (priority === "today") return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Today</Badge>;
  return <Badge variant="secondary">Scheduled</Badge>;
}

function ContactRow({
  contact,
  onDone,
  busy,
}: {
  contact: CrmContactDto;
  onDone: (contact: CrmContactDto) => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/crm/contacts/${contact.id}`}>
            <span className="cursor-pointer font-medium hover:underline">{contact.name}</span>
          </Link>
          <Badge variant="outline">{STAGE_LABELS[contact.stage] ?? contact.stage}</Badge>
          {priorityBadge(contact.nextStep.priority)}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {contact.nextStep.action}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/crm/contacts/${contact.id}`}>
          <Button size="sm" variant="outline">Open</Button>
        </Link>
        <Button size="sm" onClick={() => onDone(contact)} disabled={busy}>
          Done ✓
        </Button>
      </div>
    </div>
  );
}

function AddContactDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    contactType: "investor",
    targetMarket: "",
    source: "manual",
    consentEmail: true,
    consentSms: false,
  });

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/crm/contacts", {
        ...form,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        targetMarket: form.targetMarket.trim() || null,
      });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", contactType: "investor", targetMarket: "", source: "manual", consentEmail: true, consentSms: false });
      onCreated();
    } catch (error) {
      console.error("Failed to create contact", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Add Contact</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="crm-name">Name</Label>
            <Input id="crm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Investor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="crm-email">Email</Label>
              <Input id="crm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="crm-phone">Phone</Label>
              <Input id="crm-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.contactType} onValueChange={(v) => setForm({ ...form, contactType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investor">Investor</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="renter">Renter</SelectItem>
                  <SelectItem value="realtor">Realtor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="crm-market">Target market</Label>
              <Input id="crm-market" value={form.targetMarket} onChange={(e) => setForm({ ...form, targetMarket: e.target.value })} placeholder="Ottawa" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.consentSms} onChange={(e) => setForm({ ...form, consentSms: e.target.checked })} />
            They agreed to receive texts (required before SMS)
          </label>
          <Button className="w-full" onClick={submit} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : "Create Contact"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CrmHome() {
  const [contacts, setContacts] = useState<CrmContactDto[]>([]);
  const [deals, setDeals] = useState<CrmDealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/contacts", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login?next=/crm";
        return;
      }
      const data = await res.json();
      const list: CrmContactDto[] = data.contacts ?? [];
      setContacts(list);
      // Deals ride along on contact detail; for the board we collect from contacts with a second cheap call avoided.
      const dealRes = await Promise.all(
        list
          .filter((c) => c.stage === "client" || c.nextStep.dealId)
          .slice(0, 25)
          .map((c) =>
            fetch(`/api/crm/contacts/${c.id}`, { credentials: "include" })
              .then((r) => r.json())
              .then((d) => (d.deals ?? []) as CrmDealDto[])
              .catch(() => [] as CrmDealDto[]),
          ),
      );
      setDeals(dealRes.flat());
    } catch (error) {
      console.error("Failed to load CRM", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(contact: CrmContactDto) {
    setBusyId(contact.id);
    try {
      await apiRequest("POST", `/api/crm/contacts/${contact.id}/next-step/execute`, { mode: "log" });
      await load();
    } catch (error) {
      console.error("Failed to complete next step", error);
    } finally {
      setBusyId(null);
    }
  }

  const due = contacts.filter((c) => c.nextStep.priority !== "soon" && c.stage !== "lost");
  const activeDeals = deals.filter((d) => !["closed", "fell_through"].includes(d.stage));

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground">
              Every contact has one next step. Do the list, top to bottom.
            </p>
          </div>
          <AddContactDialog onCreated={load} />
        </div>

        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today ({due.length})</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline ({contacts.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({activeDeals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Due now and today</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                ) : due.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing due. Add a contact or check the pipeline.
                  </p>
                ) : (
                  due.map((c) => (
                    <ContactRow key={c.id} contact={c} onDone={markDone} busy={busyId === c.id} />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PIPELINE_STAGES.map((stage) => {
                const inStage = contacts.filter((c) => c.stage === stage);
                return (
                  <Card key={stage}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {STAGE_LABELS[stage]} <span className="text-muted-foreground">({inStage.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {inStage.map((c) => (
                        <Link key={c.id} href={`/crm/contacts/${c.id}`}>
                          <div className="cursor-pointer rounded-md border p-2 hover:bg-accent">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{c.name}</span>
                              {priorityBadge(c.nextStep.priority)}
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{c.nextStep.action}</p>
                          </div>
                        </Link>
                      ))}
                      {inStage.length === 0 && (
                        <p className="text-xs text-muted-foreground">Empty</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="deals">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {activeDeals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No active deals. Open a deal file from a contact page when a client targets a property.
                  </p>
                ) : (
                  activeDeals.map((d) => {
                    const doneCount = (d.checklist ?? []).filter((i) => i.done).length;
                    const owner = contacts.find((c) => c.id === d.contactId);
                    return (
                      <div key={d.id} className="flex items-center justify-between border-b py-3 last:border-b-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{d.title}</span>
                            <Badge variant="outline">{DEAL_STAGE_LABELS[d.stage] ?? d.stage}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {owner?.name ?? "—"} · checklist {doneCount}/{(d.checklist ?? []).length}
                          </p>
                        </div>
                        {owner && (
                          <Link href={`/crm/contacts/${owner.id}`}>
                            <Button size="sm" variant="outline">Open file</Button>
                          </Link>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
