import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SharedPreview {
  propertyAddress: string;
  city: string | null;
  province: string | null;
  propertyType: string | null;
  verdict: string | null;
  ownerName: string | null;
}

interface SharedAnalysis {
  id: number;
  propertyAddress: string;
  city: string | null;
  province: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  verdict: string | null;
  metrics: Record<string, unknown>;
  inputs: Record<string, unknown>;
  notes: string | null;
  analyzedAt: string;
  ownerName: string | null;
}

function formatMetricValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString('en-CA') : value.toFixed(2);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SharedAnalysisPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<SharedPreview | null>(null);
  const [analysis, setAnalysis] = useState<SharedAnalysis | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const authToken =
          localStorage.getItem('realist_token') || localStorage.getItem('investor_token') || '';
        const res = await fetch(`/api/shares/view/${token}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data?.error || 'This share link is invalid or has been revoked.');
          return;
        }
        if (data.data.requiresAccount) {
          setPreview(data.data.preview);
          // Remember where to come back to after signup
          sessionStorage.setItem('pending_share_path', `/shared/${token}`);
        } else {
          setAnalysis(data.data.analysis);
        }
      } catch {
        setError('Failed to load the shared analysis.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Loading shared analysis…
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center">
        <h1 className="text-2xl font-bold mb-2">Share unavailable</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link to="/">
          <Button>Go to Realist.ca</Button>
        </Link>
      </div>
    );
  }

  // Account gate
  if (preview) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-xl">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">
              {preview.ownerName || 'A Realist investor'} shared a deal analysis with you
            </p>
            <h1 className="text-2xl font-bold mb-1">{preview.propertyAddress}</h1>
            <p className="text-muted-foreground mb-4">
              {[preview.city, preview.province].filter(Boolean).join(', ')}
              {preview.propertyType ? ` · ${preview.propertyType}` : ''}
            </p>
            {preview.verdict && (
              <p className="mb-6 text-sm">
                Verdict: <span className="font-semibold">{preview.verdict}</span>
              </p>
            )}
            <div className="rounded-md border bg-muted/40 p-4 mb-6 text-sm text-muted-foreground">
              The full underwriting — cash flow, cap rate, assumptions, and notes — is available
              with a free Realist account. After signing up, reopen this link.
            </div>
            <div className="flex gap-3">
              <Link to="/investor">
                <Button>Create a free account</Button>
              </Link>
              <Link to="/investor/login">
                <Button variant="outline">Sign in</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis) return null;

  const metricEntries = Object.entries(analysis.metrics || {});
  const inputEntries = Object.entries(analysis.inputs || {});

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <p className="text-sm text-muted-foreground mb-1">
        Shared by {analysis.ownerName || 'a Realist investor'} ·{' '}
        {new Date(analysis.analyzedAt).toLocaleDateString('en-CA')}
      </p>
      <h1 className="text-3xl font-bold mb-1">{analysis.propertyAddress}</h1>
      <p className="text-muted-foreground mb-6">
        {[analysis.city, analysis.province].filter(Boolean).join(', ')}
        {analysis.propertyType ? ` · ${analysis.propertyType}` : ''}
        {analysis.bedrooms ? ` · ${analysis.bedrooms} bd` : ''}
        {analysis.bathrooms ? ` / ${analysis.bathrooms} ba` : ''}
        {analysis.sqft ? ` · ${analysis.sqft.toLocaleString()} sqft` : ''}
      </p>

      {analysis.verdict && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Verdict</p>
            <p className="text-xl font-semibold">{analysis.verdict}</p>
          </CardContent>
        </Card>
      )}

      {metricEntries.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Metrics</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {metricEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between border-b border-dashed py-1">
                  <dt className="text-muted-foreground">{formatKey(key)}</dt>
                  <dd className="font-medium">{formatMetricValue(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {inputEntries.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Assumptions</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {inputEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between border-b border-dashed py-1">
                  <dt className="text-muted-foreground">{formatKey(key)}</dt>
                  <dd className="font-medium">{formatMetricValue(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {analysis.notes && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-2">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{analysis.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground">
        Realist.ca model outputs — estimates, not investment advice. Run your own numbers at{' '}
        <Link to="/" className="underline">
          realist.ca
        </Link>
        .
      </div>
    </div>
  );
}
