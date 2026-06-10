import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_KEY_STORAGE = 'realist_admin_key';

const STATUSES = [
  'new',
  'hot',
  'warm',
  'nurture',
  'contacted',
  'booked_call',
  'preapproval_started',
  'buyer_agency_signed',
  'showing_booked',
  'offer_submitted',
  'closed',
  'lost',
] as const;

const BANDS = ['all', 'hot', 'warm', 'nurture'] as const;
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
  recent_events: { id: number; event: string; user_id: number | null; deal_id: number | null; created_at: string; email: string | null }[];
}

interface Opportunity {
  id: number;
  intent_score: number;
  deal_score: number;
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
  user_id: number | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  deal_id: number | null;
  property_address: string | null;
  market: string | null;
  verdict: string | null;
  latest_activity: string | null;
  sla_breached: boolean;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminDealDeskPage() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(API_KEY_STORAGE));
  const [keyInput, setKeyInput] = useState('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [band, setBand] = useState<Band>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingAssignId, setEditingAssignId] = useState<number | null>(null);
  const [assignDraft, setAssignDraft] = useState('');

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey(null);
    setDashboard(null);
    setOpportunities([]);
    setError('API key rejected. Enter a valid key.');
  }, []);

  const fetchAll = useCallback(async (key: string, currentBand: Band) => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'x-api-key': key };
      const oppUrl =
        currentBand === 'all'
          ? '/api/deal-desk/opportunities'
          : `/api/deal-desk/opportunities?band=${currentBand}`;
      const [dashRes, oppRes] = await Promise.all([
        fetch('/api/deal-desk/dashboard', { headers }),
        fetch(oppUrl, { headers }),
      ]);
      if (dashRes.status === 401 || oppRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!dashRes.ok || !oppRes.ok) {
        throw new Error(`Fetch failed (${dashRes.status}/${oppRes.status})`);
      }
      const dashBody = await dashRes.json();
      const oppBody = await oppRes.json();
      setDashboard(dashBody.data as DashboardData);
      setOpportunities((oppBody.data ?? []) as Opportunity[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (apiKey) {
      fetchAll(apiKey, band);
    }
  }, [apiKey, band, fetchAll]);

  function saveKey() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(API_KEY_STORAGE, trimmed);
    setApiKey(trimmed);
    setKeyInput('');
    setError('');
  }

  async function changeStatus(opp: Opportunity, newStatus: string) {
    if (!apiKey || newStatus === opp.status) return;
    let lostReason: string | undefined;
    if (newStatus === 'lost') {
      const reason = prompt('Lost reason (required):');
      if (!reason || !reason.trim()) return;
      lostReason = reason.trim();
    }
    try {
      const res = await fetch(`/api/deal-desk/opportunities/${opp.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ status: newStatus, lostReason, changedBy: 'admin_ui' }),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Status update failed (${res.status})`);
      }
      await fetchAll(apiKey, band);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  async function saveAssignment(oppId: number) {
    if (!apiKey) return;
    try {
      const res = await fetch(`/api/deal-desk/opportunities/${oppId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ assignedTo: assignDraft.trim(), assignedBy: 'admin_ui' }),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Assign failed (${res.status})`);
      }
      setEditingAssignId(null);
      setAssignDraft('');
      await fetchAll(apiKey, band);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    }
  }

  if (!apiKey) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md">
        <h1 className="text-xl font-bold mb-4">Deal Desk Admin</h1>
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="admin-key">API key</Label>
          <div className="flex gap-2">
            <Input
              id="admin-key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveKey();
              }}
              placeholder="Enter admin API key"
            />
            <Button onClick={saveKey} disabled={!keyInput.trim()}>
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const counts = dashboard?.counts;
  const summaryCards: { label: string; value: number | undefined; alert?: boolean }[] = [
    { label: 'Hot', value: counts?.hot },
    { label: 'Warm', value: counts?.warm },
    { label: 'New', value: counts?.new_submissions },
    { label: 'Calls Booked', value: counts?.calls_booked },
    { label: 'Active', value: counts?.active },
    { label: 'Closed', value: counts?.closed },
    { label: 'Lost', value: counts?.lost },
    { label: 'SLA Breaches', value: counts?.sla_breaches, alert: (counts?.sla_breaches ?? 0) > 0 },
    { label: 'Deals analyzed (7d)', value: dashboard?.deals_analyzed_7d },
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Deal Desk Admin</h1>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => fetchAll(apiKey, band)}
          >
            Refresh
          </button>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={handleUnauthorized}
          >
            Change key
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-6">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className={`rounded-md border p-2 text-center ${
              c.alert ? 'border-red-300 bg-red-50' : 'bg-white'
            }`}
          >
            <div className={`text-lg font-bold ${c.alert ? 'text-red-600' : ''}`}>
              {c.value ?? '—'}
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
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
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
                  {loading ? 'Loading…' : 'No opportunities found.'}
                </td>
              </tr>
            )}
            {opportunities.map((opp) => (
              <tr key={opp.id} className="border-t align-top hover:bg-muted/30">
                <td className="px-2 py-2">
                  <div className="font-medium">{opp.full_name || '—'}</div>
                  <div className="text-muted-foreground">{opp.email || '—'}</div>
                  <div className="text-muted-foreground">{opp.phone || ''}</div>
                </td>
                <td className="px-2 py-2">
                  <div className="font-medium">{opp.property_address || '—'}</div>
                  <div className="text-muted-foreground">{opp.market || ''}</div>
                </td>
                <td className="px-2 py-2 font-mono">{opp.intent_score}</td>
                <td className="px-2 py-2 font-mono">{opp.deal_score}</td>
                <td className="px-2 py-2">
                  <select
                    value={opp.status}
                    onChange={(e) => changeStatus(opp, e.target.value)}
                    className="border rounded px-1 py-0.5 text-xs bg-background"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {opp.status === 'lost' && opp.lost_reason && (
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
                          if (e.key === 'Enter') saveAssignment(opp.id);
                          if (e.key === 'Escape') {
                            setEditingAssignId(null);
                            setAssignDraft('');
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
                        setAssignDraft(opp.assigned_to || '');
                      }}
                      title="Click to assign"
                    >
                      {opp.assigned_to || 'unassigned'}
                    </button>
                  )}
                </td>
                <td className="px-2 py-2 max-w-[180px]">{opp.suggested_next_action || '—'}</td>
                <td className="px-2 py-2 whitespace-nowrap">{formatTime(opp.created_at)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{formatTime(opp.latest_activity)}</td>
                <td className="px-2 py-2">
                  {opp.sla_breached && (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                      SLA
                    </span>
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
                  <span>{r.lost_reason || 'unspecified'}</span>
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
                  <span className="text-muted-foreground truncate">{ev.email || '—'}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{formatTime(ev.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
