import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

const STATUSES = [
  "new",
  "hot",
  "warm",
  "nurture",
  "contacted",
  "booked_call",
  "preapproval_started",
  "buyer_agency_signed",
  "showing_booked",
  "offer_submitted",
  "closed",
  "lost",
] as const;

const BANDS = ["all", "hot", "warm", "nurture"] as const;
type Band = (typeof BANDS)[number];

interface DashboardData {
  counts: {
    hot: number;
    warm: number;
    new_submissions: number;
    calls_booked: number;
    active: number;
    closed: number;
    lost: number;
    sla_breaches: number;
  };
  deals_analyzed_7d: number;
  lost_by_reason: { lost_reason: string; count: number }[];
  recent_events: { id: string; event: string; user_id: string | null; deal_id: string | null; created_at: string; email: string | null }[];
}

interface Opportunity {
  id: string;
  intent_score: number;
  deal_score: number | null;
  status: string;
  assigned_to: string | null;
  suggested_next_action: string | null;
  source: string | null;
  financing_help: boolean;
  buying_help: boolean;
  lost_reason: string | null;
  notes: string | null;
  first_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  deal_id: string | null;
  property_address: string | null;
  market: string | null;
  verdict: string | null;
  latest_activity: string | null;
  sla_breached: boolean;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminDealDesk() {
  const { toast } = useToast();
  const [band, setBand] = useState<Band>("all");
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null);
  const [assignDraft, setAssignDraft] = useState("");

  const opportunitiesUrl =
    band === "all" ? "/api/deal-desk/opportunities" : `/api/deal-desk/opportunities?band=${band}`;

  const {
    data: dashboardBody,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/deal-desk/dashboard"],
    retry: false,
  });

  const {
    data: opportunitiesBody,
    isLoading: opportunitiesLoading,
    refetch: refetchOpportunities,
  } = useQuery<{ success: boolean; data: Opportunity[] }>({
    queryKey: [opportunitiesUrl],
    retry: false,
  });

  const dashboard = dashboardBody?.data;
  const opportunities = opportunitiesBody?.data ?? [];
  const loading = dashboardLoading || opportunitiesLoading;

  const refreshAll = () => {
    refetchDashboard();
    refetchOpportunities();
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/dashboard"] });
    queryClient.invalidateQueries({ queryKey: [opportunitiesUrl] });
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, lostReason }: { id: string; status: string; lostReason?: string }) => {
      await apiRequest("PATCH", `/api/deal-desk/opportunities/${id}/status`, {
        status,
        lostReason,
        changedBy: "admin_ui",
      });
    },
    onSuccess: invalidateAll,
    onError: (error: Error) => {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
      await apiRequest("POST", `/api/deal-desk/opportunities/${id}/assign`, {
        assignedTo,
        assignedBy: "admin_ui",
      });
    },
    onSuccess: () => {
      setEditingAssignId(null);
      setAssignDraft("");
      invalidateAll();
    },
    onError: (error: Error) => {
      toast({ title: "Assign failed", description: error.message, variant: "destructive" });
    },
  });

  function changeStatus(opp: Opportunity, newStatus: string) {
    if (newStatus === opp.status) return;
    let lostReason: string | undefined;
    if (newStatus === "lost") {
      const reason = prompt("Lost reason (required):");
      if (!reason || !reason.trim()) return;
      lostReason = reason.trim();
    }
    statusMutation.mutate({ id: opp.id, status: newStatus, lostReason });
  }

  function saveAssignment(oppId: string) {
    if (!assignDraft.trim()) return;
    assignMutation.mutate({ id: oppId, assignedTo: assignDraft.trim() });
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16 max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Deal Desk Admin</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-deal-desk-admin-error">
            Admin access required. Log in with an admin account to view the Deal Desk.
          </p>
        </main>
      </div>
    );
  }

  const counts = dashboard?.counts;
  const summaryCards: { label: string; value: number | undefined; alert?: boolean }[] = [
    { label: "Hot", value: counts?.hot },
    { label: "Warm", value: counts?.warm },
    { label: "New", value: counts?.new_submissions },
    { label: "Calls Booked", value: counts?.calls_booked },
    { label: "Active", value: counts?.active },
    { label: "Closed", value: counts?.closed },
    { label: "Lost", value: counts?.lost },
    { label: "SLA Breaches", value: counts?.sla_breaches, alert: (counts?.sla_breaches ?? 0) > 0 },
    { label: "Deals analyzed (7d)", value: dashboard?.deals_analyzed_7d },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" data-testid="text-deal-desk-admin-title">Deal Desk Admin</h1>
          <div className="flex items-center gap-3">
            {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
            <Button variant="ghost" size="sm" onClick={refreshAll} data-testid="button-deal-desk-refresh">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-6">
          {summaryCards.map((c) => (
            <div
              key={c.label}
              className={`rounded-md border p-2 text-center ${
                c.alert ? "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800" : "bg-card"
              }`}
            >
              <div className={`text-lg font-bold ${c.alert ? "text-red-600 dark:text-red-400" : ""}`}>
                {c.value ?? "—"}
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Band filter tabs */}
        <div className="flex gap-1 mb-3 border-b">
          {BANDS.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className={`px-3 py-1.5 text-sm capitalize border-b-2 -mb-px ${
                band === b
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-deal-desk-band-${b}`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Opportunities table */}
        <div className="overflow-x-auto border rounded-md mb-6">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-2 py-2 font-medium">Contact</th>
                <th className="px-2 py-2 font-medium">Deal</th>
                <th className="px-2 py-2 font-medium">Intent</th>
                <th className="px-2 py-2 font-medium">Score</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Assigned</th>
                <th className="px-2 py-2 font-medium">Next action</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Last activity</th>
                <th className="px-2 py-2 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No opportunities found."}
                  </td>
                </tr>
              )}
              {opportunities.map((opp) => (
                <tr key={opp.id} className="border-t align-top hover:bg-muted/30">
                  <td className="px-2 py-2">
                    <div className="font-medium">{opp.full_name || "—"}</div>
                    <div className="text-muted-foreground">{opp.email || "—"}</div>
                    <div className="text-muted-foreground">{opp.phone || ""}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">{opp.property_address || "—"}</div>
                    <div className="text-muted-foreground">{opp.market || ""}</div>
                  </td>
                  <td className="px-2 py-2 font-mono">{opp.intent_score}</td>
                  <td className="px-2 py-2 font-mono">{opp.deal_score ?? "—"}</td>
                  <td className="px-2 py-2">
                    <select
                      value={opp.status}
                      onChange={(e) => changeStatus(opp, e.target.value)}
                      className="border rounded px-1 py-0.5 text-xs bg-background"
                      data-testid={`select-deal-desk-status-${opp.id}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {opp.status === "lost" && opp.lost_reason && (
                      <div className="text-muted-foreground mt-0.5">({opp.lost_reason})</div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {editingAssignId === opp.id ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          value={assignDraft}
                          onChange={(e) => setAssignDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveAssignment(opp.id);
                            if (e.key === "Escape") {
                              setEditingAssignId(null);
                              setAssignDraft("");
                            }
                          }}
                          className="border rounded px-1 py-0.5 text-xs w-24 bg-background"
                          placeholder="name"
                        />
                        <button
                          className="text-primary font-medium"
                          onClick={() => saveAssignment(opp.id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        className="underline decoration-dotted text-left"
                        onClick={() => {
                          setEditingAssignId(opp.id);
                          setAssignDraft(opp.assigned_to || "");
                        }}
                        title="Click to assign"
                        data-testid={`button-deal-desk-assign-${opp.id}`}
                      >
                        {opp.assigned_to || "unassigned"}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 max-w-[180px]">{opp.suggested_next_action || "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatTime(opp.created_at)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatTime(opp.latest_activity)}</td>
                  <td className="px-2 py-2">
                    {opp.sla_breached && (
                      <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0.5">
                        SLA
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lost by reason */}
          <div className="border rounded-md p-3">
            <h2 className="text-sm font-semibold mb-2">Lost by reason</h2>
            {(dashboard?.lost_by_reason?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No lost deals.</p>
            ) : (
              <ul className="space-y-1">
                {dashboard?.lost_by_reason.map((r) => (
                  <li key={r.lost_reason} className="flex justify-between text-xs">
                    <span>{r.lost_reason || "unspecified"}</span>
                    <span className="font-mono">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent events */}
          <div className="border rounded-md p-3">
            <h2 className="text-sm font-semibold mb-2">Recent events</h2>
            {(dashboard?.recent_events?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No recent events.</p>
            ) : (
              <ul className="space-y-1 max-h-72 overflow-y-auto">
                {dashboard?.recent_events.map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-2 text-xs border-b last:border-0 pb-1">
                    <span className="font-medium">{ev.event}</span>
                    <span className="text-muted-foreground truncate">{ev.email || "—"}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{formatTime(ev.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
