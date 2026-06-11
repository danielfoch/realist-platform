import { useCallback, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DEAL_STAGE_LABELS,
  STAGE_LABELS,
  priorityBadge,
  type CrmContactDto,
  type CrmDealDto,
} from "./CrmHome";

interface ActivityDto {
  id: string;
  kind: string;
  body: string | null;
  createdAt: string;
}

interface AnalysisDto {
  id: string;
  title: string | null;
  city: string | null;
  listingPrice: number | null;
  createdAt: string;
}

const KIND_ICONS: Record<string, string> = {
  note: "📝",
  call: "📞",
  email: "✉️",
  sms: "💬",
  meeting: "🤝",
  task: "✅",
  stage_change: "🔀",
  system: "⚙️",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function NewDealDialog({ contactId, onCreated }: { contactId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", side: "buy", propertyAddress: "", price: "" });

  async function submit() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/crm/deals", {
        contactId,
        title: form.title.trim(),
        side: form.side,
        propertyAddress: form.propertyAddress.trim() || null,
        price: form.price ? Number(form.price) : null,
      });
      setOpen(false);
      onCreated();
    } catch (error) {
      console.error("Failed to create deal", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Open Deal File</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a deal file</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="deal-title">Deal name</Label>
            <Input id="deal-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="123 Main St, Ottawa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Side</Label>
              <Select value={form.side} onValueChange={(v) => setForm({ ...form, side: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy side</SelectItem>
                  <SelectItem value="sell">Sell side</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deal-price">Price</Label>
              <Input id="deal-price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="deal-address">Property address</Label>
            <Input id="deal-address" value={form.propertyAddress} onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? "Creating…" : "Create with standard checklist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CrmContact() {
  const [, params] = useRoute("/crm/contacts/:id");
  const contactId = params?.id;

  const [contact, setContact] = useState<CrmContactDto | null>(null);
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [deals, setDeals] = useState<CrmDealDto[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisDto[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });

  const load = useCallback(async () => {
    if (!contactId) return;
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, { credentials: "include" });
      if (res.status === 401) {
        window.location.href = `/login?next=/crm/contacts/${contactId}`;
        return;
      }
      const data = await res.json();
      setContact(data.contact ?? null);
      setActivities(data.activities ?? []);
      setDeals(data.deals ?? []);
      setAnalyses(data.analyses ?? []);
    } catch (error) {
      console.error("Failed to load contact", error);
    }
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (contact?.nextStep.emailDraft) {
      setEmailDraft(contact.nextStep.emailDraft);
    }
  }, [contact]);

  async function executeStep(mode: "log" | "email") {
    if (!contactId) return;
    setBusy(true);
    try {
      const payload = mode === "email" ? { mode, subject: emailDraft.subject, body: emailDraft.body } : { mode };
      await apiRequest("POST", `/api/crm/contacts/${contactId}/next-step/execute`, payload);
      setEmailOpen(false);
      await load();
    } catch (error) {
      console.error("Failed to execute next step", error);
    } finally {
      setBusy(false);
    }
  }

  async function changeStage(stage: string) {
    if (!contactId) return;
    await apiRequest("PATCH", `/api/crm/contacts/${contactId}`, { stage });
    await load();
  }

  async function addNote() {
    if (!contactId || !note.trim()) return;
    await apiRequest("POST", `/api/crm/contacts/${contactId}/activities`, { kind: "note", body: note.trim() });
    setNote("");
    await load();
  }

  async function updateDealStage(dealId: string, stage: string) {
    await apiRequest("PATCH", `/api/crm/deals/${dealId}`, { stage });
    await load();
  }

  async function toggleChecklistItem(deal: CrmDealDto, index: number) {
    const checklist = (deal.checklist ?? []).map((item, i) =>
      i === index ? { ...item, done: !item.done } : item,
    );
    await apiRequest("PATCH", `/api/crm/deals/${deal.id}`, { checklist });
    await load();
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  }

  const canEmail = Boolean(contact.email && contact.consentEmail);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4">
          <Link href="/crm">
            <span className="cursor-pointer text-sm text-muted-foreground hover:underline">← Back to CRM</span>
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <p className="text-sm text-muted-foreground">
              {contact.email ?? "no email"} · {contact.phone ?? "no phone"} · {contact.contactType}
              {contact.targetMarket ? ` · ${contact.targetMarket}` : ""}
            </p>
          </div>
          <Select value={contact.stage} onValueChange={changeStage}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Next step — the heart of the CRM */}
        <Card className="mb-6 border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Next step {priorityBadge(contact.nextStep.priority)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{contact.nextStep.action}</p>
            <p className="mt-1 text-sm text-muted-foreground">{contact.nextStep.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(contact.nextStep.dueAt)}</p>
            <div className="mt-3 flex gap-2">
              {canEmail && contact.nextStep.emailDraft && (
                <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">Send email</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Review and send</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="email-subject">Subject</Label>
                        <Input id="email-subject" value={emailDraft.subject} onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="email-body">Body</Label>
                        <Textarea id="email-body" rows={10} value={emailDraft.body} onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })} />
                      </div>
                      <Button className="w-full" onClick={() => executeStep("email")} disabled={busy}>
                        {busy ? "Sending…" : `Send to ${contact.email}`}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button size="sm" variant="outline" onClick={() => executeStep("log")} disabled={busy}>
                Mark done ✓
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Deals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Deal files</CardTitle>
              <NewDealDialog contactId={contact.id} onCreated={load} />
            </CardHeader>
            <CardContent className="space-y-4">
              {deals.length === 0 && (
                <p className="text-sm text-muted-foreground">No deal files yet.</p>
              )}
              {deals.map((deal) => (
                <div key={deal.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{deal.title}</span>
                    <Select value={deal.stage} onValueChange={(v) => updateDealStage(deal.id, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DEAL_STAGE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(deal.checklist ?? []).map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleChecklistItem(deal, i)}
                        className="flex w-full items-center gap-2 text-left text-sm hover:opacity-80"
                      >
                        <span>{item.done ? "☑" : "☐"}</span>
                        <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Their analyses — the platform advantage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Their deal analyses</CardTitle>
            </CardHeader>
            <CardContent>
              {analyses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {contact.email
                    ? "No linked realist.ca account or no analyses yet."
                    : "Link this contact to a realist.ca user to see their analyses."}
                </p>
              ) : (
                <div className="space-y-2">
                  {analyses.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.title ?? "Untitled analysis"}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.city ?? "—"} · {a.listingPrice ? `$${a.listingPrice.toLocaleString()}` : "—"} · {formatDate(a.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                onKeyDown={(e) => e.key === "Enter" && addNote()}
              />
              <Button onClick={addNote} disabled={!note.trim()}>Add</Button>
            </div>
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <span>{KIND_ICONS[a.kind] ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words">{a.body ?? a.kind}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("en-CA")}</p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
