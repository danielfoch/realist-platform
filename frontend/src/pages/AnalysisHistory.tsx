import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AnalysisHistory.css';

interface Analysis {
  id: number;
  listing_id: string | null;
  address: string;
  property_type: string | null;
  purchase_price: number | null;
  after_repair_value: number | null;
  cap_rate: number | null;
  irr: number | null;
  total_roi: number | null;
  verdict_check: string | null;
  analyzed_at: string;
  user_id: number | null;
  session_id: string | null;
  notes: string | null;
}

interface AnalysisListResponse {
  success: boolean;
  data: {
    analyses: Analysis[];
    total: number;
    page: number;
    limit: number;
  };
}

const PAGE_SIZE = 20;

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

function getVerdictBadge(verdict: string | null): { label: string; className: string } {
  if (!verdict) return { label: '—', className: 'badge-neutral' };
  const lower = verdict.toLowerCase();
  if (lower.includes('strong') || lower.includes('✅')) {
    return { label: 'Strong', className: 'badge-strong' };
  }
  if (lower.includes('weak') || lower.includes('caution') || lower.includes('❌')) {
    return { label: 'Weak', className: 'badge-weak' };
  }
  if (lower.includes('moderate') || lower.includes('fair') || lower.includes('⚠️')) {
    return { label: 'Moderate', className: 'badge-moderate' };
  }
  return { label: verdict, className: 'badge-neutral' };
}

function getShortAddress(address: string): string {
  if (address.length <= 45) return address;
  return address.slice(0, 42) + '...';
}

export function AnalysisHistoryPage() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  useEffect(() => {
    fetchAnalyses(page);
  }, [page]);

  const fetchAnalyses = async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const res = await fetch(
        `/api/analyses?limit=${PAGE_SIZE}&offset=${offset}`,
        { credentials: 'include' },
      );
      if (res.status === 401) {
        navigate('/investor');
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch analyses (${res.status})`);
      }
      const data = await res.json();
      if (data.analyses) {
        setAnalyses(data.analyses);
        setTotal(data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this analysis? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Refresh current page, or go back one if page is now empty
        const remaining = total - 1;
        const lastPage = Math.ceil(remaining / PAGE_SIZE);
        const targetPage = Math.max(1, Math.min(page, lastPage || 1));
        fetchAnalyses(targetPage);
        if (targetPage !== page) setPage(targetPage);
      }
    } catch {
      setError('Failed to delete analysis');
    }
  };

  const handleSaveNote = async (id: number) => {
    try {
      const res = await fetch(`/api/analyses/${id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editingNoteText || null }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setAnalyses((prev) =>
        prev.map((a) => (a.id === id ? { ...a, notes: editingNoteText || null } : a)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setEditingNoteId(null);
      setEditingNoteText("");
    }
  };

  const startEditingNote = (id: number, currentNotes: string | null) => {
    setEditingNoteId(id);
    setEditingNoteText(currentNotes || "");
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasData = total > 0;

  return (
    <div className="analysis-history-page">
      <div className="history-header">
        <div>
          <h1>Your Analysis History</h1>
          <p className="subtitle">
            {total === 0
              ? 'No analyses yet — start analyzing deals to build your underwriting memory.'
              : `${total} deal${total > 1 ? 's' : ''} analyzed — your underwriting memory grows every time.`}
          </p>
        </div>
        <button className="cta-btn" onClick={() => navigate('/listings')}>
          Browse Listings
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {!hasData && !loading && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 13 9 13 11" />
            </svg>
          </div>
          <h3>Start analyzing deals</h3>
          <p>Find a listing and hit Analyze to build your underwriting track record.</p>
        </div>
      )}

      {hasData && (
        <>
          <div className="analysis-list">
            {loading && analyses.length === 0 ? (
              <div className="loader">
                <div className="spinner"></div>
                <span>Loading your analyses...</span>
              </div>
            ) : (
              analyses.map((a) => {
                const badge = getVerdictBadge(a.verdict_check);
                return (
                  <div
                    key={a.id}
                    className="analysis-card"
                    onClick={() =>
                      setExpandedNotes(expandedNotes === a.id ? null : a.id)
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <div className="analysis-left">
                      <div className="analysis-address">
                        {getShortAddress(a.address)}
                      </div>
                      <div className="analysis-meta">
                        <span>{a.property_type || 'Property'}</span>
                        <span className="dot">•</span>
                        <span>{formatDate(a.analyzed_at)}</span>
                      </div>
                    </div>
                    <div className="analysis-stats">
                      <div className="stat">
                        <span className="stat-label">Price</span>
                        <span className="stat-value">
                          {formatCurrency(a.purchase_price)}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Cap Rate</span>
                        <span className="stat-value">
                          {formatPercent(a.cap_rate)}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">IRR</span>
                        <span className="stat-value">
                          {formatPercent(a.irr)}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">ROI</span>
                        <span className="stat-value">
                          {formatPercent(a.total_roi)}
                        </span>
                      </div>
                      <span className={`verdict-badge ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    {a.notes && (
                      <div
                        className="analysis-expand"
                        style={{
                          display: expandedNotes === a.id ? 'block' : 'none',
                        }}
                      >
                        {editingNoteId === a.id ? (
                          <div className="note-editor" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              maxLength={500}
                              className="note-editor-textarea"
                              placeholder="Add your underwriting notes..."
                            />
                            <div className="note-editor-actions">
                              <span className="note-char-count">{editingNoteText.length}/500</span>
                              <div>
                                <button
                                  className="note-btn-save"
                                  onClick={() => handleSaveNote(a.id)}
                                >
                                  Save
                                </button>
                                <button
                                  className="note-btn-cancel"
                                  onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="analysis-note-text">{a.notes}</p>
                            <button
                              className="note-edit-toggle"
                              onClick={(e) => { e.stopPropagation(); startEditingNote(a.id, a.notes); }}
                            >
                              ✎ Edit
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="analysis-actions">
                      <button
                        className="text-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/deal-analyzer?address=${encodeURIComponent(a.address)}`,
                          );
                        }}
                      >
                        Analyze Again
                      </button>
                      <button
                        className="text-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(a.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
