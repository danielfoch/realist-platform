import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import './UnderwritingSharePage.css';

type ShareAction = 'challenge' | 'fork' | 'saved_version';

type SharedAnalysis = {
  id: number;
  propertyAddress: string;
  city?: string | null;
  province?: string | null;
  metrics?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  verdictCheck?: string | null;
  notes?: string | null;
};

type ShareResponse = {
  token: string;
  cta: string;
  analysis: SharedAnalysis;
  visitorQualification?: {
    status: string;
    qualified: boolean;
    creditAmount: number;
  };
};

type ActionResponse = {
  success: boolean;
  status: string;
  qualified: boolean;
  creditAmount: number;
  savedAnalysisId?: number | null;
  onwardShare?: {
    shareUrl: string;
    cta: string;
  } | null;
};

const CHALLENGE_FIELDS = [
  'rent',
  'vacancy',
  'expenses',
  'cap rate',
  'renovation budget',
  'financing',
  'exit value',
];

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') {
    return Math.abs(value) >= 1000
      ? new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(value)
      : new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getEntries(record?: Record<string, unknown>) {
  return Object.entries(record || {}).filter(([, value]) => value != null && value !== '').slice(0, 8);
}

function toAbsoluteShareUrl(path?: string) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${window.location.origin}${path}`;
}

export function UnderwritingSharePage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const recipient = searchParams.get('recipient') || '';
  const [share, setShare] = useState<ShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['rent']);
  const [comment, setComment] = useState('');
  const [action, setAction] = useState<ShareAction>('challenge');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResponse | null>(null);

  useEffect(() => {
    async function loadShare() {
      setLoading(true);
      setError('');
      try {
        const query = recipient ? `?recipient=${encodeURIComponent(recipient)}` : '';
        const response = await fetch(`/api/underwriting-shares/${token}${query}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error(response.status === 404 ? 'This underwriting share is no longer available.' : `Failed to load share (${response.status})`);
        setShare(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load underwriting share');
      } finally {
        setLoading(false);
      }
    }

    loadShare();
  }, [recipient, token]);

  const metrics = useMemo(() => getEntries(share?.analysis.metrics), [share]);
  const inputs = useMemo(() => getEntries(share?.analysis.inputs), [share]);

  const toggleField = (field: string) => {
    setSelectedFields((current) => (
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    ));
  };

  const submitChallenge = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (selectedFields.length === 0 && comment.trim().length < 10) {
      setError('Pick at least one assumption or leave a 10+ character challenge so the action can qualify.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/underwriting-shares/${token}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          recipient: recipient || undefined,
          metadata: {
            challengedFields: selectedFields,
            comment: comment.trim(),
            notes: action === 'challenge' ? undefined : comment.trim(),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Challenge failed (${response.status})`);
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit challenge');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="underwriting-share-page"><div className="share-shell">Loading underwriting share…</div></div>;
  }

  if (error && !share) {
    return (
      <div className="underwriting-share-page">
        <div className="share-shell share-error">
          <h1>Share unavailable</h1>
          <p>{error}</p>
          <Link to="/properties">Browse deals on Realist.ca</Link>
        </div>
      </div>
    );
  }

  if (!share) return null;

  return (
    <div className="underwriting-share-page">
      <div className="share-shell">
        <section className="share-hero">
          <p className="eyebrow">Shared underwriting</p>
          <h1>{share.cta || 'Challenge my underwriting.'}</h1>
          <p className="hero-copy">
            Review the assumptions below, challenge what looks wrong, and save or fork your version to keep the loop going.
          </p>
          <div className="share-guardrail">
            Google Sheets export credits only unlock for qualified opens, challenges, forks, signups, or saved versions — never raw share clicks alone.
          </div>
        </section>

        <section className="deal-panel">
          <div>
            <p className="eyebrow">Deal</p>
            <h2>{share.analysis.propertyAddress}</h2>
            <p>{[share.analysis.city, share.analysis.province].filter(Boolean).join(', ')}</p>
          </div>
          {share.analysis.verdictCheck && <div className="verdict-pill">{share.analysis.verdictCheck}</div>}
        </section>

        <div className="share-grid">
          <section className="metric-card">
            <h3>Key metrics</h3>
            {metrics.length === 0 ? <p className="muted">No metrics were shared.</p> : metrics.map(([key, value]) => (
              <div className="metric-row" key={key}><span>{formatLabel(key)}</span><strong>{formatValue(value)}</strong></div>
            ))}
          </section>

          <section className="metric-card">
            <h3>Assumptions</h3>
            {inputs.length === 0 ? <p className="muted">No inputs were shared.</p> : inputs.map(([key, value]) => (
              <div className="metric-row" key={key}><span>{formatLabel(key)}</span><strong>{formatValue(value)}</strong></div>
            ))}
          </section>
        </div>

        {share.analysis.notes && (
          <section className="metric-card">
            <h3>Owner notes</h3>
            <p className="notes-copy">{share.analysis.notes}</p>
          </section>
        )}

        <section className="challenge-card">
          <div>
            <p className="eyebrow">Qualified action</p>
            <h2>Challenge the assumptions</h2>
            <p className="muted">A meaningful challenge can earn the sharer credits and gives you a version you can build on.</p>
          </div>

          <form onSubmit={submitChallenge}>
            <div className="field-chip-list" aria-label="Assumptions to challenge">
              {CHALLENGE_FIELDS.map((field) => (
                <button
                  type="button"
                  key={field}
                  className={selectedFields.includes(field) ? 'field-chip selected' : 'field-chip'}
                  onClick={() => toggleField(field)}
                >
                  {formatLabel(field)}
                </button>
              ))}
            </div>

            <label className="form-label" htmlFor="challenge-comment">What would you change?</label>
            <textarea
              id="challenge-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Example: I think the rent is aggressive by $250/month and vacancy should be 4%, not 2%."
            />

            <div className="action-choice" role="radiogroup" aria-label="Challenge action type">
              {([
                ['challenge', 'Submit challenge'],
                ['saved_version', 'Save my version'],
                ['fork', 'Fork assumptions'],
              ] as Array<[ShareAction, string]>).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" checked={action === value} onChange={() => setAction(value)} />
                  {label}
                </label>
              ))}
            </div>

            {error && <div className="inline-error">{error}</div>}

            <button className="submit-challenge" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : share.cta || 'Challenge my underwriting.'}
            </button>
          </form>
        </section>

        {result && (
          <section className="result-card">
            <h3>{result.qualified ? 'Qualified challenge recorded' : `Action recorded: ${result.status}`}</h3>
            <p>
              {result.qualified
                ? `This qualified action earned ${result.creditAmount} Google Sheets export credit${result.creditAmount === 1 ? '' : 's'} for the sharer.`
                : 'It was tracked, but did not earn credits because of duplicate or daily cap rules.'}
            </p>
            {result.onwardShare && (
              <div className="onward-share">
                <span>Your onward share link:</span>
                <a href={result.onwardShare.shareUrl}>{toAbsoluteShareUrl(result.onwardShare.shareUrl)}</a>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
