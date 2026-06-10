import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Flame, TrendingUp, Inbox, XCircle, Download, RefreshCw, Users } from "lucide-react";
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
};

const STATUSES = [
  "new", "hot", "warm", "nurture", "contacted",
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

export default function AdminDealDesk() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [lostReason, setLostReason] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; status: string; assignedTo?: string; lostReason?: string }) =>
      apiRequest("PATCH", `/api/deal-desk/opportunities/${payload.id}`, {
        status: payload.status,
        assignedTo: payload.assignedTo,
        lostReason: payload.lostReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/stats"] });
      setEditingOpp(null);
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  function openEdit(opp: Opportunity) {
    setEditingOpp(opp);
    setNewStatus(opp.opportunity.status);
    setNewAssignedTo(opp.opportunity.assignedTo || "");
    setLostReason(opp.opportunity.lostReason || "");
  }

  function saveEdit() {
    if (!editingOpp) return;
    updateMutation.mutate({
      id: editingOpp.opportunity.id,
      status: newStatus,
      assignedTo: newAssignedTo || undefined,
      lostReason: newStatus === "lost" ? lostReason : undefined,
    });
  }

  const hotCount = stats?.hot ?? 0;
  const warmCount = stats?.warm ?? 0;
  const newCount = stats?.new ?? 0;
  const lostCount = stats?.lost ?? 0;
  const total = stats?.total ?? 0;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6" data-testid="admin-deal-desk">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Desk</h1>
          <p className="text-muted-foreground text-sm">Transaction funnel — opportunities and leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Link href="/admin">
            <Button variant="ghost" size="sm">Admin Home</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card data-testid="stat-total">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "…" : total}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-hot">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Flame className="h-4 w-4 text-red-500" /> Hot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{statsLoading ? "…" : hotCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-warm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-amber-500" /> Warm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{statsLoading ? "…" : warmCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-new">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Inbox className="h-4 w-4" /> New
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "…" : newCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-lost">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-muted-foreground" /> Lost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{statsLoading ? "…" : lostCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="opportunities">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((row, i) => (
                    <TableRow key={row.opportunity.id} data-testid={`row-opportunity-${row.opportunity.id}`}>
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
                      <TableCell>{statusBadge(row.opportunity.status)}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground max-w-36">{row.opportunity.suggestedNextAction}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">{row.opportunity.assignedTo ?? <span className="text-muted-foreground">Unassigned</span>}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{fmt(row.opportunity.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)} data-testid={`button-edit-${row.opportunity.id}`}>
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
