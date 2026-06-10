import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Flame, TrendingUp, Inbox, XCircle, Download, RefreshCw, Users, Phone, BarChart2, Activity, FileText, Mail, CheckCircle, AlertCircle, Clock, CheckSquare, Settings } from "lucide-react";
import { Link } from "wouter";

type Opportunity = {
  opportunity: {
    id: string;
    intentScore: number;
    status: string;
    assignedTo: string | null;
    suggestedNextAction: string;
    source: string;
    lostReason: string | null;
    adminNotes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  lead: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
  deal: {
    id: string;
    address: string;
    market: string | null;
    propertyType: string | null;
    purchasePrice: number | null;
    financingHelpWanted: boolean;
    buyingHelpWanted: boolean;
    userNotes: string | null;
  } | null;
};

type Stats = {
  hot: number;
  warm: number;
  new: number;
  lost: number;
  total: number;
  callsBooked: number;
  dealsAnalyzed: number;
  lostByReason: { reason: string; count: number }[];
};

type ActivityEvent = {
  id: string;
  eventName: string;
  eventTimestamp: string;
  sourcePage: string | null;
  dealId: string | null;
  source: string | null;
  metadata: Record<string, any> | null;
};

type EmailTrigger = {
  id: string;
  leadId: string | null;
  opportunityId: string | null;
  triggerType: string;
  status: string;
  sentAt: string | null;
  failureReason: string | null;
  payload: Record<string, any> | null;
  createdAt: string;
};

const STATUSES = [
  "new", "hot", "warm", "nurture", "contacted", "qualified",
  "booked_call", "preapproval_started", "buyer_agency_signed",
  "showing_booked", "offer_submitted", "closed", "lost",
];

function statusBadge(status: string) {
  const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
    hot: "destructive",
    warm: "default",
    new: "outline",
    nurture: "secondary",
    closed: "default",
    lost: "secondary",
    booked_call: "default",
  };
  return <Badge variant={variants[status] ?? "outline"} data-testid={`badge-status-${status}`}>{status}</Badge>;
}

function scoreBadge(score: number) {
  const color = score >= 80 ? "text-red-500" : score >= 50 ? "text-amber-500" : "text-muted-foreground";
  return <span className={`font-bold ${color}`} data-testid="text-intent-score">{score}</span>;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminDealDesk() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/deal-desk/stats"],
  });

  const { data: opportunities = [], isLoading: oppsLoading, refetch } = useQuery<Opportunity[]>({
    queryKey: ["/api/deal-desk/opportunities", statusFilter],
    queryFn: () => {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return apiRequest<Opportunity[]>("GET", `/api/deal-desk/opportunities${qs}`);
    },
  });

  const { data: activityFeed = [], isLoading: activityLoading } = useQuery<ActivityEvent[]>({
    queryKey: ["/api/deal-desk/activity"],
  });

  type DealDeskSettings = {
    notifyEmail: string | null;
    envFallback: string | null;
    effectiveEmail: string | null;
  };

  const { data: settingsData, refetch: refetchSettings } = useQuery<{ ok: boolean; settings: DealDeskSettings }>({
    queryKey: ["/api/deal-desk/settings"],
  });
  const [notifyEmailInput, setNotifyEmailInput] = useState<string>("");
  const settingsLoaded = settingsData?.settings;

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: { notifyEmail: string }) =>
      apiRequest("PUT", "/api/deal-desk/settings", payload),
    onSuccess: () => {
      refetchSettings();
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to save settings", variant: "destructive" });
    },
  });

  const { data: emailTriggers = [], isLoading: triggersLoading } = useQuery<EmailTrigger[]>({
    queryKey: ["/api/deal-desk/email-triggers"],
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; status: string; assignedTo?: string; lostReason?: string; adminNotes?: string | null }) =>
      apiRequest("PATCH", `/api/deal-desk/opportunities/${payload.id}`, {
        status: payload.status,
        assignedTo: payload.assignedTo,
        lostReason: payload.lostReason,
        adminNotes: payload.adminNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/activity"] });
      setEditingOpp(null);
      toast({ title: "Opportunity updated" });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const retryTriggerMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/deal-desk/email-triggers/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/email-triggers"] });
      toast({ title: "Retry queued — email will send on the next worker cycle" });
    },
    onError: () => {
      toast({ title: "Retry failed", variant: "destructive" });
    },
  });

  const inlineStatusMutation = useMutation({
    mutationFn: (payload: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/deal-desk/opportunities/${payload.id}/status`, {
        status: payload.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/stats"] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (payload: { ids: string[]; status: string }) =>
      apiRequest("PATCH", `/api/deal-desk/opportunities/bulk-status`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/activity"] });
      setSelectedIds(new Set());
      setBulkStatus("");
      toast({ title: `${variables.ids.length} opportunit${variables.ids.length === 1 ? "y" : "ies"} moved to "${variables.status}"` });
    },
    onError: () => {
      toast({ title: "Bulk update failed", variant: "destructive" });
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === opportunities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(opportunities.map(o => o.opportunity.id)));
    }
  }

  function applyBulkStatus() {
    if (!bulkStatus || selectedIds.size === 0) return;
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkStatus });
  }

  function openEdit(opp: Opportunity) {
    setEditingOpp(opp);
    setNewStatus(opp.opportunity.status);
    setNewAssignedTo(opp.opportunity.assignedTo || "");
    setLostReason(opp.opportunity.lostReason || "");
    setAdminNotes(opp.opportunity.adminNotes || "");
  }

  function saveEdit() {
    if (!editingOpp) return;
    updateMutation.mutate({
      id: editingOpp.opportunity.id,
      status: newStatus,
      assignedTo: newAssignedTo || undefined,
      lostReason: newStatus === "lost" ? lostReason : undefined,
      adminNotes: adminNotes !== "" ? adminNotes : null,
    });
  }

  const hotCount = stats?.hot ?? 0;
  const warmCount = stats?.warm ?? 0;
  const newCount = stats?.new ?? 0;
  const lostCount = stats?.lost ?? 0;
  const total = stats?.total ?? 0;
  const callsBooked = stats?.callsBooked ?? 0;
  const dealsAnalyzed = stats?.dealsAnalyzed ?? 0;
  const lostByReason = stats?.lostByReason ?? [];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6" data-testid="admin-deal-desk">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Desk</h1>
          <p className="text-muted-foreground text-sm">Transaction funnel — opportunities and leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/stats"] }); queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/activity"] }); }} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Link href="/admin">
            <Button variant="ghost" size="sm">Admin Home</Button>
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card data-testid="stat-total">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "…" : total}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-deals-analyzed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <BarChart2 className="h-4 w-4" /> Analyzed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "…" : dealsAnalyzed}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-hot">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Flame className="h-4 w-4 text-red-500" /> Hot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{statsLoading ? "…" : hotCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-warm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-amber-500" /> Warm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{statsLoading ? "…" : warmCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-new">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Inbox className="h-4 w-4" /> New
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "…" : newCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-calls-booked">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Phone className="h-4 w-4 text-green-500" /> Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statsLoading ? "…" : callsBooked}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-lost">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-muted-foreground" /> Lost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{statsLoading ? "…" : lostCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lost-by-reason breakdown */}
      {lostByReason.length > 0 && (
        <Card data-testid="card-lost-by-reason">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Lost by Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lostByReason.map(r => (
                <Badge key={r.reason} variant="secondary" data-testid={`badge-lost-reason-${r.reason}`}>
                  {r.reason} ({r.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="opportunities">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity Feed</TabsTrigger>
            <TabsTrigger value="email-queue" data-testid="tab-email-queue">
              <Mail className="h-3 w-3 mr-1" />
              Email Queue
              {emailTriggers.filter(t => t.status === "pending").length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1" data-testid="badge-email-pending">
                  {emailTriggers.filter(t => t.status === "pending").length} pending
                </Badge>
              )}
              {emailTriggers.filter(t => t.status === "failed").length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1" data-testid="badge-email-failed">
                  {emailTriggers.filter(t => t.status === "failed").length} failed
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-3 w-3 mr-1" />
              Settings
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="opportunities" className="mt-4">
          {oppsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-opportunities">
              No opportunities yet. Submit a deal at <a href="/deal-desk" className="underline">/deal-desk</a>.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2" data-testid="bulk-action-bar">
                  <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-bulk-status">
                        <SelectValue placeholder="Move to…" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!bulkStatus || bulkStatusMutation.isPending}
                      onClick={applyBulkStatus}
                      data-testid="button-apply-bulk-status"
                    >
                      {bulkStatusMutation.isPending ? "Updating…" : "Apply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIds(new Set())}
                      data-testid="button-clear-selection"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={opportunities.length > 0 && selectedIds.size === opportunities.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Latest Activity</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((row) => {
                    const latestEvent = activityFeed.find(e => e.dealId === row.deal?.id);
                    const isSelected = selectedIds.has(row.opportunity.id);
                    return (
                      <TableRow key={row.opportunity.id} data-testid={`row-opportunity-${row.opportunity.id}`} className={isSelected ? "bg-muted/40" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(row.opportunity.id)}
                            aria-label={`Select opportunity ${row.opportunity.id}`}
                            data-testid={`checkbox-select-${row.opportunity.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{row.lead?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{row.lead?.email ?? "—"}</div>
                          {row.lead?.phone && <div className="text-xs text-muted-foreground">{row.lead.phone}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-40 truncate">{row.deal?.address ?? "—"}</div>
                          {row.deal?.market && <div className="text-xs text-muted-foreground">{row.deal.market}</div>}
                        </TableCell>
                        <TableCell>{scoreBadge(row.opportunity.intentScore)}</TableCell>
                        <TableCell>
                          <Select
                            value={row.opportunity.status}
                            onValueChange={(val) => inlineStatusMutation.mutate({ id: row.opportunity.id, status: val })}
                          >
                            <SelectTrigger className="h-7 w-36 text-xs" data-testid={`select-inline-status-${row.opportunity.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(s => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground max-w-36">{row.opportunity.suggestedNextAction}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">{row.opportunity.assignedTo ?? <span className="text-muted-foreground">Unassigned</span>}</div>
                        </TableCell>
                        <TableCell>
                          {row.opportunity.adminNotes ? (
                            <div className="text-xs text-muted-foreground max-w-32 truncate" title={row.opportunity.adminNotes} data-testid={`text-notes-${row.opportunity.id}`}>
                              <FileText className="inline h-3 w-3 mr-1 shrink-0" />
                              {row.opportunity.adminNotes}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {latestEvent ? (
                            <div className="text-xs text-muted-foreground" data-testid={`text-latest-activity-${row.opportunity.id}`}>
                              <span className="font-medium text-foreground">{latestEvent.eventName}</span>
                              <br />{fmtTime(latestEvent.eventTimestamp)}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">{fmt(row.opportunity.createdAt)}</div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)} data-testid={`button-edit-${row.opportunity.id}`}>
                            Notes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Recent Deal Desk Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : activityFeed.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-activity">
                  No deal desk activity recorded yet.
                </div>
              ) : (
                <div className="space-y-2" data-testid="activity-feed">
                  {activityFeed.map(event => (
                    <div key={event.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0" data-testid={`activity-event-${event.id}`}>
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{event.eventName}</span>
                          {event.source && <Badge variant="outline" className="text-xs">{event.source}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {fmtTime(event.eventTimestamp)}
                          {event.dealId && <span className="ml-2">deal: <code className="font-mono">{event.dealId.slice(0, 8)}…</code></span>}
                          {event.metadata?.status && <span className="ml-2">→ <strong>{event.metadata.status}</strong></span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-queue" className="mt-4">
          <Card data-testid="card-email-queue">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email Queue
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {emailTriggers.length} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {triggersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : emailTriggers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-email-triggers">
                  No email triggers yet. They appear when deals are submitted.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Sent / Failed</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailTriggers.map((t) => (
                        <TableRow key={t.id} data-testid={`row-trigger-${t.id}`}>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.triggerType}</code>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              {t.payload?.email || t.payload?.name || <span className="italic">team</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {t.status === "sent" && (
                              <span className="flex items-center gap-1 text-green-600 text-xs font-medium" data-testid={`status-sent-${t.id}`}>
                                <CheckCircle className="h-3 w-3" /> sent
                              </span>
                            )}
                            {t.status === "pending" && (
                              <span className="flex items-center gap-1 text-amber-500 text-xs font-medium" data-testid={`status-pending-${t.id}`}>
                                <Clock className="h-3 w-3" /> pending
                              </span>
                            )}
                            {t.status === "failed" && (
                              <span className="flex items-center gap-1 text-red-500 text-xs font-medium" data-testid={`status-failed-${t.id}`}>
                                <AlertCircle className="h-3 w-3" /> failed
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">{fmtTime(t.createdAt)}</div>
                          </TableCell>
                          <TableCell>
                            {t.sentAt && (
                              <div className="text-xs text-green-600">{fmtTime(t.sentAt)}</div>
                            )}
                            {t.failureReason && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="text-xs text-red-500 max-w-48 truncate cursor-help underline decoration-dotted underline-offset-2"
                                      data-testid={`failure-reason-${t.id}`}
                                    >
                                      {t.failureReason}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    className="max-w-sm break-words text-xs"
                                    data-testid={`tooltip-failure-${t.id}`}
                                  >
                                    {t.failureReason}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {!t.sentAt && !t.failureReason && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.status === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                data-testid={`button-retry-${t.id}`}
                                disabled={retryTriggerMutation.isPending}
                                onClick={() => retryTriggerMutation.mutate(t.id)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export for Clyde</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Download data as CSV or JSON. Use the bearer token <code className="bg-muted px-1 rounded text-xs">DEAL_DESK_EXPORT_TOKEN</code> to automate via the API.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {["contacts", "deals", "opportunities", "events"].map(entity => (
                  <a key={entity} href={`/api/deal-desk/export?entity=${entity}&format=csv`} download>
                    <Button variant="outline" size="sm" className="w-full" data-testid={`button-export-${entity}`}>
                      <Download className="h-3 w-3 mr-1" /> {entity}
                    </Button>
                  </a>
                ))}
              </div>
              <div className="mt-4 rounded bg-muted p-3 text-xs font-mono text-muted-foreground">
                GET /api/deal-desk/export?entity=opportunities&format=json<br />
                Authorization: Bearer DEAL_DESK_EXPORT_TOKEN
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Team notification email</p>
                <p className="text-sm text-muted-foreground">
                  All team alerts (hot leads, warm follow-ups, financing requests) go to this address.
                  Overrides the <code className="bg-muted px-1 rounded text-xs">DEAL_DESK_NOTIFY_EMAIL</code> environment variable.
                </p>

                {settingsLoaded?.envFallback && !settingsLoaded?.notifyEmail && (
                  <div className="rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    Currently using env fallback: <strong>{settingsLoaded.envFallback}</strong>. Save an email below to override it.
                  </div>
                )}
                {!settingsLoaded?.envFallback && !settingsLoaded?.notifyEmail && (
                  <div className="rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-800 dark:text-red-300">
                    No notification email is configured — team alerts will be dropped until one is set.
                  </div>
                )}
                {settingsLoaded?.effectiveEmail && (
                  <div className="rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-800 dark:text-green-300">
                    Active: <strong>{settingsLoaded.effectiveEmail}</strong>
                    {settingsLoaded.notifyEmail ? " (set via admin)" : " (from environment variable)"}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Input
                    type="email"
                    placeholder={settingsLoaded?.envFallback ?? "team@example.com"}
                    value={notifyEmailInput}
                    onChange={e => setNotifyEmailInput(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-notify-email"
                  />
                  <Button
                    onClick={() => saveSettingsMutation.mutate({ notifyEmail: notifyEmailInput })}
                    disabled={saveSettingsMutation.isPending}
                    data-testid="button-save-notify-email"
                  >
                    {saveSettingsMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                  {settingsLoaded?.notifyEmail && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNotifyEmailInput("");
                        saveSettingsMutation.mutate({ notifyEmail: "" });
                      }}
                      disabled={saveSettingsMutation.isPending}
                      data-testid="button-clear-notify-email"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingOpp} onOpenChange={open => { if (!open) setEditingOpp(null); }}>
        <DialogContent data-testid="dialog-edit-opportunity">
          <DialogHeader>
            <DialogTitle>Update Opportunity</DialogTitle>
          </DialogHeader>
          {editingOpp && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <div className="font-medium">{editingOpp.lead?.name}</div>
                <div className="text-muted-foreground">{editingOpp.deal?.address}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned to</label>
                <Input
                  value={newAssignedTo}
                  onChange={e => setNewAssignedTo(e.target.value)}
                  placeholder="Team member name"
                  data-testid="input-assigned-to"
                />
              </div>
              {newStatus === "lost" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lost reason</label>
                  <Input
                    value={lostReason}
                    onChange={e => setLostReason(e.target.value)}
                    placeholder="e.g. Price too high, went with competitor"
                    data-testid="input-lost-reason"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Admin Notes
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Internal notes visible only to the team…"
                  rows={4}
                  data-testid="textarea-admin-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingOpp(null)} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-status">
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
