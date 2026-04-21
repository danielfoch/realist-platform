import { useState, useEffect } from 'react';

interface Analysis {
  id: string;
  propertyAddress: string;
  city?: string;
  propertyType?: string;
  listingId?: string;
  bedrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  metrics: Record<string, unknown>;
  inputs: Record<string, unknown>;
  analyzedAt: string;
}

export function AnalysisHistory() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('investor_token');
    if (!token) {
      setError('Please sign in to view your analysis history.');
      setLoading(false);
      return;
    }

    fetch('/api/analyses', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load analyses');
        return res.json();
      })
      .then((data) => {
        setAnalyses(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setLoading(false);
      });
  }, []);

  const filtered = analyses.filter((a) =>
    a.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.city || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="analysis-history-page">
        <div className="hero-section">
          <h1>Your Analyses</h1>
          <p>Loading your underwriting history...</p>
        </div>
        <div className="loading-spinner" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error && analyses.length === 0) {
    return (
      <div className="analysis-history-page">
        <div className="hero-section">
          <h1>Your Analyses</h1>
        </div>
        <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-history-page">
      <div className="hero-section">
        <h1>Your Analyses</h1>
        <p>
          Your underwriting history — every deal you've analyzed, captured so
          you can learn, compare, and refine your investment strategy.
        </p>
      </div>

      <div className="history-content">
        {analyses.length > 5 && (
          <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Search by property or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'rgba(30,30,46,0.8)',
                color: '#f8fafc',
                fontSize: '0.9rem',
              }}
            />
          </div>
        )}

        {filtered.length === 0 && (
          <div className="empty-state" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
            {searchQuery ? 'No matches found.' : 'No analyses yet. Start analyzing deals to build your history.'}
          </div>
        )}

        <ul className="history-list">
          {filtered.map((a) => {
            const listPrice = a.metrics?.listPrice;
            const cashFlow = a.metrics?.cashFlow;
            const cashOnCash = a.metrics?.cashOnCash;
            const date = new Date(a.analyzedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

            // Derive check color from metrics or verdict
            let checkColor = '#22c55e';
            const vc = (a.metrics?.verdictCheck || a.metrics?.verdict_check) as string | undefined;
            if (vc?.toLowerCase().includes('weak')) checkColor = '#ef4444';
            else if (vc?.toLowerCase().includes('neutral')) checkColor = '#f59e0b';
            else if (cashOnCash && (cashOnCash as number) < 0) checkColor = '#ef4444';
            else if (cashOnCash && (cashOnCash as number) < 5) checkColor = '#f59e0b';

            return (
              <li key={a.id} className="history-item">
                <div className="history-item-main">
                  <span className="property-address">{a.propertyAddress}</span>
                  <span className="history-item-meta">
                    {a.city && a.propertyType && `${a.city} • ${a.propertyType}`}
                    {a.city && !a.propertyType && a.city}
                    {!a.city && a.propertyType && a.propertyType}
                  </span>
                </div>
                <div className="history-item-metrics">
                  {listPrice && (
                    <span className="metric">
                      Price: <strong>${Number(listPrice).toLocaleString()}</strong>
                    </span>
                  )}
                  {cashFlow !== undefined && cashFlow !== null && (
                    <span className="metric">
                      CF: <strong>${Number(cashFlow).toLocaleString(undefined, {maximumFractionDigits: 0})}/mo</strong>
                    </span>
                  )}
                  {cashOnCash !== undefined && cashOnCash !== null && (
                    <span className="metric">
                      CoC: <strong>{Number(cashOnCash).toFixed(1)}%</strong>
                    </span>
                  )}
                  <span className="check-icon" style={{ color: checkColor }}>
                    {(vc && ['Strong', 'Fair', 'Weak'].find((v) => (vc as string).includes(v))) || '✅'}
                  </span>
                  <span className="analyzed-at">{date}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="history-summary" style={{ marginTop: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          {filtered.length} analysis{filtered.length !== 1 ? 'es' : ''}
        </div>
      </div>
    </div>
  );
}
