import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { track } from '../lib/event-tracking';

interface AnalysisDetail {
  id: number;
  propertyAddress: string;
  city: string | null;
  province: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  metrics: Record<string, number | string> | null;
  inputs: Record<string, number | string> | null;
  notes: string | null;
  analyzedAt: string;
}

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  const fixed = value.toFixed(2);
  return `${fixed.endsWith('0') ? value.toFixed(1) : fixed}%`;
}

function formatRatio(value: number): string {
  return value.toFixed(2);
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Find the first present, parseable number among candidate keys across metrics then inputs. */
function pickNumber(
  sources: Array<Record<string, number | string> | null | undefined>,
  keys: string[],
): number | null {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      if (key in source) {
        const n = toNumber(source[key]);
        if (n !== null) return n;
      }
    }
  }
  return null;
}

function formatAssumptionValue(key: string, value: number | string): string {
  const n = toNumber(value);
  if (n === null) return String(value);
  const lower = key.toLowerCase();
  if (/rate|percent|pct|interest|vacancy|appreciation|growth/.test(lower)) {
    return formatPercent(n);
  }
  if (
    /price|rent|cost|payment|tax|insurance|fee|value|income|expense|capex|maintenance|cash|offer/.test(
      lower,
    )
  ) {
    return formatCurrency(n);
  }
  return Number.isInteger(n) ? n.toLocaleString('en-CA') : n.toFixed(2);
}

const PRINT_STYLES = `
@media print {
  header { display: none !important; }
  body { background: #ffffff !important; }
  .pitch-deck-page { background: #ffffff !important; padding: 0 !important; }
  .pitch-deck-toolbar { display: none !important; }
  .deck-slide {
    break-inside: avoid;
    page-break-inside: avoid;
    box-shadow: none !important;
    border-color: #e5e7eb !important;
  }
  .deck-cover {
    break-after: page;
    page-break-after: always;
  }
}
`;

export function DealPitchDeckPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token =
          localStorage.getItem('realist_token') || localStorage.getItem('investor_token') || '';
        const res = await fetch(`/api/analyses/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 401) {
          navigate('/investor');
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load analysis (${res.status})`);
        }
        const data: AnalysisDetail = await res.json();
        setAnalysis(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handlePrint = () => {
    track('report_exported', { destination: 'pitch_deck' }, Number(id));
    window.print();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Preparing pitch deck…
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center">
        <h1 className="text-2xl font-bold mb-2">Pitch deck unavailable</h1>
        <p className="text-muted-foreground mb-6">
          {error || 'This analysis could not be found.'}
        </p>
        <Link
          to="/investor/analyses"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to My Analyses
        </Link>
      </div>
    );
  }

  const metrics = analysis.metrics || {};
  const inputs = analysis.inputs || {};

  // --- Key numbers ---
  const purchasePrice = pickNumber([metrics, inputs], [
    'purchase_price',
    'list_price',
    'asking_price',
    'price',
  ]);
  const monthlyRent = pickNumber([metrics, inputs], [
    'monthly_rent',
    'rent_monthly',
    'gross_rent_monthly',
    'rent',
  ]);
  const monthlyCashFlow = pickNumber([metrics, inputs], [
    'cash_flow_monthly',
    'monthly_cash_flow',
    'cash_flow',
  ]);
  const capRate = pickNumber([metrics, inputs], ['cap_rate', 'capitalization_rate']);
  const cashOnCash = pickNumber([metrics, inputs], [
    'cash_on_cash',
    'cash_on_cash_return',
    'coc_return',
    'coc',
  ]);
  const dscr = pickNumber([metrics, inputs], ['dscr', 'debt_service_coverage_ratio']);
  const maxOfferPrice = pickNumber([metrics, inputs], ['max_offer_price', 'max_offer']);
  const cashRequired = pickNumber([metrics, inputs], [
    'cash_required',
    'cash_to_close',
    'total_cash_required',
    'total_cash_invested',
  ]);

  const statTiles: Array<{ label: string; value: string }> = [];
  if (purchasePrice !== null)
    statTiles.push({ label: 'Purchase Price', value: formatCurrency(purchasePrice) });
  if (monthlyRent !== null)
    statTiles.push({ label: 'Monthly Rent', value: formatCurrency(monthlyRent) });
  if (monthlyCashFlow !== null)
    statTiles.push({ label: 'Monthly Cash Flow', value: formatCurrency(monthlyCashFlow) });
  if (capRate !== null) statTiles.push({ label: 'Cap Rate', value: formatPercent(capRate) });
  if (cashOnCash !== null)
    statTiles.push({ label: 'Cash-on-Cash Return', value: formatPercent(cashOnCash) });
  if (dscr !== null) statTiles.push({ label: 'DSCR', value: formatRatio(dscr) });
  if (maxOfferPrice !== null)
    statTiles.push({ label: 'Max Offer Price', value: formatCurrency(maxOfferPrice) });
  if (cashRequired !== null)
    statTiles.push({ label: 'Cash Required', value: formatCurrency(cashRequired) });

  // --- Investment thesis ---
  const propertyTypeLabel = analysis.propertyType || 'property';
  const locationLabel = analysis.city || analysis.propertyAddress;
  let thesisHeadline: string;
  if (monthlyCashFlow !== null && monthlyCashFlow > 0 && capRate !== null) {
    thesisHeadline = `Cash-flowing ${propertyTypeLabel.toLowerCase()} in ${locationLabel} at a ${formatPercent(capRate)} cap rate.`;
  } else if (capRate !== null) {
    thesisHeadline = `${propertyTypeLabel} in ${locationLabel} modeled at a ${formatPercent(capRate)} cap rate.`;
  } else if (monthlyCashFlow !== null && monthlyCashFlow > 0) {
    thesisHeadline = `Cash-flowing ${propertyTypeLabel.toLowerCase()} in ${locationLabel}.`;
  } else {
    thesisHeadline = `${propertyTypeLabel} investment analysis for ${locationLabel}.`;
  }

  const thesisPoints: string[] = [];
  if (monthlyCashFlow !== null) {
    thesisPoints.push(
      `Projected monthly cash flow of ${formatCurrency(monthlyCashFlow)} after modeled operating expenses and debt service.`,
    );
  }
  if (monthlyRent !== null) {
    thesisPoints.push(`Modeled gross rent of ${formatCurrency(monthlyRent)} per month.`);
  }
  if (cashOnCash !== null) {
    thesisPoints.push(`Cash-on-cash return of ${formatPercent(cashOnCash)} on invested capital.`);
  }
  if (dscr !== null) {
    thesisPoints.push(`Debt service coverage ratio of ${formatRatio(dscr)}.`);
  }
  if (maxOfferPrice !== null) {
    thesisPoints.push(
      `Model supports a maximum offer price of ${formatCurrency(maxOfferPrice)} at these assumptions.`,
    );
  }
  if (cashRequired !== null) {
    thesisPoints.push(`Estimated cash required to close: ${formatCurrency(cashRequired)}.`);
  }

  // --- Assumptions ---
  const assumptionEntries = Object.entries(inputs).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );

  const propertyLine = [
    [analysis.city, analysis.province].filter(Boolean).join(', '),
    analysis.propertyType,
    analysis.bedrooms ? `${analysis.bedrooms} bd` : null,
    analysis.bathrooms ? `${analysis.bathrooms} ba` : null,
    analysis.sqft ? `${analysis.sqft.toLocaleString('en-CA')} sqft` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const analyzedDate = new Date(analysis.analyzedAt).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="pitch-deck-page min-h-screen bg-gray-100 px-4 py-8">
      <style>{PRINT_STYLES}</style>

      {/* Toolbar (hidden in print) */}
      <div className="pitch-deck-toolbar print:hidden max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <Link
          to="/investor/analyses"
          className="text-sm font-medium text-muted-foreground hover:text-primary"
        >
          ← Back to My Analyses
        </Link>
        <button
          onClick={handlePrint}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Download PDF / Print
        </button>
      </div>

      <div className="space-y-6">
        {/* Slide 1: Cover */}
        <section className="deck-slide deck-cover max-w-4xl mx-auto rounded-lg border bg-white p-12 shadow-sm text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground mb-6">
            Investment Opportunity
          </p>
          <h1 className="text-4xl font-bold mb-4">{analysis.propertyAddress}</h1>
          {propertyLine && <p className="text-lg text-muted-foreground mb-8">{propertyLine}</p>}
          <p className="text-sm text-muted-foreground">Analysis date: {analyzedDate}</p>
          <p className="text-sm text-muted-foreground mt-1">Prepared with Realist.ca</p>
        </section>

        {/* Slide 2: Investment thesis */}
        <section className="deck-slide max-w-4xl mx-auto rounded-lg border bg-white p-10 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Investment Thesis</h2>
          <p className="text-2xl font-medium mb-6">{thesisHeadline}</p>
          {thesisPoints.length > 0 && (
            <ul className="space-y-2 text-base text-gray-700 list-disc pl-5">
              {thesisPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Slide 3: Key numbers */}
        {statTiles.length > 0 && (
          <section className="deck-slide max-w-4xl mx-auto rounded-lg border bg-white p-10 shadow-sm">
            <h2 className="text-xl font-semibold mb-6">Key Numbers</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {statTiles.map((tile) => (
                <div key={tile.label} className="rounded-md border bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {tile.label}
                  </p>
                  <p className="text-xl font-bold">{tile.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Slide 4: Assumptions */}
        {assumptionEntries.length > 0 && (
          <section className="deck-slide max-w-4xl mx-auto rounded-lg border bg-white p-10 shadow-sm">
            <h2 className="text-xl font-semibold mb-6">Assumptions</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 text-sm">
              {assumptionEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between border-b border-dashed py-1.5">
                  <dt className="text-muted-foreground">{humanizeKey(key)}</dt>
                  <dd className="font-medium text-right">{formatAssumptionValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Slide 5: Analyst notes */}
        {analysis.notes && (
          <section className="deck-slide max-w-4xl mx-auto rounded-lg border bg-white p-10 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Analyst Notes</h2>
            <p className="text-base text-gray-700 whitespace-pre-wrap">{analysis.notes}</p>
          </section>
        )}

        {/* Slide 6: Disclaimer */}
        <section className="deck-slide max-w-4xl mx-auto rounded-lg border bg-white p-10 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Disclaimer</h2>
          <p className="text-sm text-muted-foreground">
            Model outputs from Realist.ca — estimates, not investment advice or an appraisal.
            Verify all assumptions independently.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            <a
              href="https://realist.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              realist.ca
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
