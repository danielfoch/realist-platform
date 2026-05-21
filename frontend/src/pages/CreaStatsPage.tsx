import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Share2, TrendingUp, TrendingDown, MapPin, BarChart3 } from 'lucide-react';

const API_BASE = '/api/crea';

const MEASURES = [
  { value: 'Average Price', label: 'Average Price', format: 'currency' },
  { value: 'Unit Sales', label: 'Unit Sales', format: 'number' },
  { value: 'Dollar Volume', label: 'Dollar Volume', format: 'currency' },
  { value: 'New Listings', label: 'New Listings', format: 'number' },
  { value: 'Active Listings', label: 'Active Listings', format: 'number' },
  { value: 'Sales / New Listings Ratio', label: 'SNLR', format: 'ratio' },
  { value: 'Months of Inventory', label: 'Months of Inventory', format: 'number' },
  { value: 'Number of Sales', label: 'Number of Sales', format: 'number' },
  { value: 'Median Sale Price', label: 'Median Sale Price', format: 'currency' },
  { value: 'Average Days on Market (sales)', label: 'Avg DOM', format: 'number' },
];

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

function formatValue(val: number | null, format: string): string {
  if (val === null || val === undefined) return '—';
  if (format === 'currency') {
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  }
  if (format === 'ratio') return (val as number).toFixed(3);
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(0);
}

const PRESETS = [
  { label: 'Toronto Avg Price', geography: 'Toronto', measure: 'Average Price' },
  { label: 'Vancouver Sales', geography: 'Greater Vancouver', measure: 'Unit Sales' },
  { label: 'Calgary MOI', geography: 'Calgary', measure: 'Months of Inventory' },
  { label: 'Canada SNLR', geography: 'Canada', measure: 'Sales / New Listings Ratio' },
];

export default function CreaStatsPage() {
  const [markets, setMarkets] = useState<string[]>([]);
  const [geography, setGeography] = useState('Toronto');
  const [measure, setMeasure] = useState('Average Price');
  const [propertyType, setPropertyType] = useState('Residential');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [last, setLast] = useState(24);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [compareMarkets, setCompareMarkets] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    fetch(`${API_BASE}/markets`).then(r => r.json()).then(d => {
      setMarkets(d.markets || []);
    }).catch(() => {});
    fetch(`${API_BASE}/property-types`).then(r => r.json()).then(d => {
      setPropertyTypes(d.property_types || []);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (compareMode && compareMarkets) {
        params.set('markets', compareMarkets);
        params.set('measure', measure);
        if (propertyType) params.set('property_type', propertyType);
        if (last) params.set('last', String(last));
        const r = await fetch(`${API_BASE}/compare?${params}`);
        const d = await r.json();
        setData(d.data || []);
      } else {
        params.set('geography', geography);
        params.set('measure', measure);
        if (propertyType) params.set('property_type', propertyType);
        if (last) params.set('last', String(last));
        const r = await fetch(`${API_BASE}/stats?${params}`);
        const d = await r.json();
        setData(d.data || []);
      }
    } catch { setData([]); }
    setLoading(false);
  }, [geography, measure, propertyType, last, compareMode, compareMarkets]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const measureInfo = MEASURES.find(m => m.value === measure) || MEASURES[0];

  const chartData = data.map(row => ({
    month: row.month?.substring(0, 7),
    value: row.value,
    geography: row.geography,
  }));

  const shareLink = compareMode && compareMarkets
    ? `${window.location.origin}/insights/crea-stats?compare=${encodeURIComponent(compareMarkets)}&measure=${encodeURIComponent(measure)}&property_type=${encodeURIComponent(propertyType)}&last=${last}`
    : `${window.location.origin}/insights/crea-stats?geography=${encodeURIComponent(geography)}&measure=${encodeURIComponent(measure)}&property_type=${encodeURIComponent(propertyType)}&last=${last}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareUrl('Copied!');
      setTimeout(() => setShareUrl(''), 2000);
    } catch { setShareUrl(shareLink); }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('geography')) setGeography(params.get('geography')!);
    if (params.get('measure')) setMeasure(params.get('measure')!);
    if (params.get('property_type')) setPropertyType(params.get('property_type')!);
    if (params.get('last')) setLast(Number(params.get('last')));
    if (params.get('compare')) { setCompareMode(true); setCompareMarkets(params.get('compare')!); }
  }, []);

  const lastValue = data.length > 0 ? data[data.length - 1].value : null;
  const prevValue = data.length > 1 ? data[data.length - 2].value : null;
  const change = lastValue !== null && prevValue !== null && prevValue !== 0 ? ((lastValue - prevValue) / Math.abs(prevValue)) * 100 : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-8 h-8 text-blue-500" />
        <h1 className="text-3xl font-bold text-slate-900">CREA Market Stats</h1>
      </div>
      <p className="text-slate-500 mb-6">Canadian MLS statistics — explore, chart, and share</p>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => { setGeography(p.geography); setMeasure(p.measure); setCompareMode(false); }}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 transition-colors">
            {p.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1"><MapPin className="w-3 h-3 inline mr-1" />Market</label>
            <select value={geography} onChange={e => { setGeography(e.target.value); setCompareMode(false); }}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm">
              {markets.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Measure</label>
            <select value={measure} onChange={e => setMeasure(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm">
              {MEASURES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select value={propertyType} onChange={e => setPropertyType(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm">
              {propertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            {[{ l: '6M', n: 6 }, { l: '1Y', n: 12 }, { l: '2Y', n: 24 }, { l: '5Y', n: 60 }, { l: 'All', n: 0 }].map(r => (
              <button key={r.l} onClick={() => setLast(r.n || 600)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${last === (r.n || 600) ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                {r.l}
              </button>
            ))}
          </div>
          <button onClick={() => setCompareMode(!compareMode)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${compareMode ? 'bg-purple-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
            Compare
          </button>
          <button onClick={handleShare} className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />Share
          </button>
        </div>

        {compareMode && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Compare markets (comma-separated)</label>
            <input value={compareMarkets} onChange={e => setCompareMarkets(e.target.value)}
              placeholder="Toronto, Greater Vancouver, Calgary"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button onClick={() => setChartType('line')} className={`px-3 py-1 text-xs rounded ${chartType === 'line' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Line</button>
          <button onClick={() => setChartType('bar')} className={`px-3 py-1 text-xs rounded ${chartType === 'bar' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Bar</button>
        </div>
        {shareUrl && <p className="mt-2 text-xs text-green-600">{shareUrl}</p>}
      </div>

      {/* Summary card */}
      {lastValue !== null && data.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm flex items-center gap-6">
          <div>
            <div className="text-sm text-slate-500">{geography} · {measureInfo.label} · {propertyType}</div>
            <div className="text-3xl font-bold text-slate-900">{formatValue(lastValue, measureInfo.format)}</div>
          </div>
          {change !== null && (
            <div className={`flex items-center gap-1 text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {change >= 0 ? '+' : ''}{change.toFixed(2)}% MoM
            </div>
          )}
          <div className="text-xs text-slate-400">{data[data.length - 1]?.month}</div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-80 text-slate-400">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-80 text-slate-400">No data — select a market and measure</div>
        ) : compareMode ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: number) => formatValue(v, measureInfo.format)} />
              <Legend />
              {Array.from(new Set(chartData.map(d => d.geography))).values().map((g, i) => (
                <Line key={g} type="monotone" dataKey="value" data={chartData.filter(d => d.geography === g)} name={g} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: number) => formatValue(v, measureInfo.format)} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: number) => formatValue(v, measureInfo.format)} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-xl border border-slate-200 mt-6 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-600">
          {geography} · {measureInfo.label} · {propertyType}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Month</th>
                <th className="text-right px-4 py-2 text-slate-500 font-medium">Value</th>
                {compareMode && <th className="text-left px-4 py-2 text-slate-500 font-medium">Market</th>}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{row.month}</td>
                  <td className="text-right px-4 py-2 font-mono text-slate-900">{formatValue(row.value, measureInfo.format)}</td>
                  {compareMode && <td className="px-4 py-2 text-slate-500">{row.geography}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}