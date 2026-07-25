/**
 * Livestream market overlay for Restream / OBS browser sources.
 *
 *   GET /overlay/market                 — overlay page (this is the link to paste)
 *   GET /api/stream-overlay/data        — JSON feed the page polls every 60s
 *
 * Page query params:
 *   mode=ticker (default)  bottom lower-third scrolling bar, transparent page bg —
 *                          size the browser source ~1920x120 and pin it to the bottom
 *   mode=panel             full-screen dashboard scene to cut to — size 1920x1080
 *   bg=dark|transparent    override the background (ticker defaults transparent,
 *                          panel defaults dark)
 *   speed=<px per second>  ticker scroll speed, 30–300 (default 90)
 *   symbols=RY.TO,TD.TO    override the equity list (max 14 Yahoo Finance symbols)
 *
 * Live sources: Bank of Canada Valet (policy rates, GoC benchmark yields, posted
 * 5-yr mortgage) and Yahoo Finance quotes (delayed). House prices come from
 * shared/benchmarkHomePrices.ts, updated by hand after each board release.
 * No DB dependency — everything is in-memory cached and serves stale on upstream
 * failure so the overlay never blanks mid-stream.
 */
import type { Express, Request, Response } from "express";
import { BENCHMARK_HOME_PRICES } from "@shared/benchmarkHomePrices";

type RateKind = "policy" | "mortgage" | "bond";

interface OverlayRate {
  key: string;
  label: string; // long form for the panel
  ticker: string; // short form for the scrolling bar
  kind: RateKind;
  value: number; // percent
  changeBps: number | null; // vs previous observation
  asOf: string; // YYYY-MM-DD
}

interface OverlayQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

const BOC_SERIES: Record<string, { key: string; label: string; ticker: string; kind: RateKind }> = {
  V39079: { key: "overnight", label: "BoC Overnight Rate", ticker: "BoC O/N", kind: "policy" },
  V80691311: { key: "prime", label: "Prime Rate", ticker: "PRIME", kind: "policy" },
  V80691335: { key: "mortgage5y", label: "5-Yr Fixed Mortgage (Posted)", ticker: "5Y MTG POSTED", kind: "mortgage" },
  "BD.CDN.2YR.DQ.YLD": { key: "gc2", label: "GoC 2-Yr Bond Yield", ticker: "GoC 2Y", kind: "bond" },
  "BD.CDN.5YR.DQ.YLD": { key: "gc5", label: "GoC 5-Yr Bond Yield", ticker: "GoC 5Y", kind: "bond" },
  "BD.CDN.10YR.DQ.YLD": { key: "gc10", label: "GoC 10-Yr Bond Yield", ticker: "GoC 10Y", kind: "bond" },
};

/**
 * BoC fixed announcement dates — the Bank publishes each year's schedule the
 * preceding summer (2027 dates land ~Aug 2026; append them here when they do).
 * MPR months (Jan/Apr/Jul/Oct) also release the Monetary Policy Report.
 */
const BOC_DECISION_DATES = [
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-10",
  "2026-07-15", "2026-09-02", "2026-10-28", "2026-12-09",
];
const MPR_MONTHS = new Set(["01", "04", "07", "10"]);
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function nextBocDecision(): { date: string; label: string; mpr: boolean } | null {
  const todayEt = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const date = BOC_DECISION_DATES.find((d) => d >= todayEt);
  if (!date) return null;
  const [, m, day] = date.split("-");
  return { date, label: `${MONTH_ABBR[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`, mpr: MPR_MONTHS.has(m) };
}

const INDEX_SYMBOL = "^GSPTSE";
const USDCAD_SYMBOL = "CAD=X";
const WTI_SYMBOL = "CL=F";
const DEFAULT_SYMBOLS = [
  "RY.TO", "TD.TO", "BMO.TO", "BNS.TO", "CM.TO", "NA.TO", // Big 6
  "SHOP.TO", "ENB.TO", "BN.TO", "CNR.TO", // TSX heavyweights
];
const STOCK_NAMES: Record<string, string> = {
  "RY.TO": "Royal Bank",
  "TD.TO": "TD Bank",
  "BMO.TO": "Bank of Montreal",
  "BNS.TO": "Scotiabank",
  "CM.TO": "CIBC",
  "NA.TO": "National Bank",
  "SHOP.TO": "Shopify",
  "ENB.TO": "Enbridge",
  "BN.TO": "Brookfield",
  "CNR.TO": "CN Rail",
  "^GSPTSE": "S&P/TSX Composite",
  "CAD=X": "USD/CAD",
  "CL=F": "WTI Crude",
};

const SYMBOL_RE = /^[A-Z0-9.^=-]{1,12}$/;

function parseSymbols(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_SYMBOLS;
  const list = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => SYMBOL_RE.test(s)),
    ),
  ).slice(0, 14);
  return list.length ? list : DEFAULT_SYMBOLS;
}

async function fetchBocRates(): Promise<OverlayRate[]> {
  const ids = Object.keys(BOC_SERIES);
  const url = `https://www.bankofcanada.ca/valet/observations/${ids.join(",")}/json?recent=6`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Realist.ca Stream Overlay" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`BoC Valet responded ${res.status}`);
  const data = await res.json();
  const observations: Array<Record<string, any>> = data.observations ?? [];

  const rates: OverlayRate[] = [];
  for (const [seriesId, cfg] of Object.entries(BOC_SERIES)) {
    // Observations arrive merged across series and unordered; rebuild per series.
    const points = observations
      .filter((o) => o?.d && o[seriesId]?.v != null)
      .map((o) => ({ date: o.d as string, value: parseFloat(o[seriesId].v) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points[points.length - 1];
    if (!latest) continue;
    const prev = points[points.length - 2];
    rates.push({
      key: cfg.key,
      label: cfg.label,
      ticker: cfg.ticker,
      kind: cfg.kind,
      value: latest.value,
      changeBps: prev ? Math.round((latest.value - prev.value) * 100) : null,
      asOf: latest.date,
    });
  }
  if (!rates.length) throw new Error("BoC Valet returned no observations");
  return rates;
}

async function fetchQuote(symbol: string): Promise<OverlayQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Realist.ca stream overlay)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.chartPreviousClose;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;
    const hasPrev = typeof prevClose === "number" && prevClose > 0;
    const change = hasPrev ? price - prevClose : 0;
    return {
      symbol,
      name: STOCK_NAMES[symbol] ?? meta?.shortName ?? symbol,
      price,
      change,
      changePct: hasPrev ? (change / prevClose) * 100 : 0,
    };
  } catch (err: any) {
    console.error(`[stream-overlay] quote ${symbol} failed:`, err?.message ?? err);
    return null;
  }
}

interface OverlayEquities {
  index: OverlayQuote | null;
  stocks: OverlayQuote[];
  macro: { usdcad: OverlayQuote | null; wti: OverlayQuote | null };
}

async function fetchEquities(symbols: string[]): Promise<OverlayEquities> {
  const [index, usdcad, wti, ...stocks] = await Promise.all(
    [INDEX_SYMBOL, USDCAD_SYMBOL, WTI_SYMBOL, ...symbols].map(fetchQuote),
  );
  const ok = stocks.filter((q): q is OverlayQuote => q !== null);
  if (!index && !ok.length) throw new Error("no quotes returned");
  return { index, stocks: ok, macro: { usdcad, wti } };
}

/** TTL cache that serves the last good value when a refresh fails. */
function makeCache<T>(ttlMs: number, loader: () => Promise<T>): () => Promise<T | null> {
  let value: T | null = null;
  let fetchedAt = 0;
  let inflight: Promise<void> | null = null;
  return async () => {
    if (value !== null && Date.now() - fetchedAt < ttlMs) return value;
    inflight ??= loader()
      .then((v) => {
        value = v;
        fetchedAt = Date.now();
      })
      .catch((err) => {
        console.error("[stream-overlay] refresh failed:", err?.message ?? err);
      })
      .finally(() => {
        inflight = null;
      });
    await inflight;
    return value;
  };
}

const getRates = makeCache(10 * 60_000, fetchBocRates);

const MAX_QUOTE_CACHES = 24;
const quoteCaches = new Map<string, () => Promise<OverlayEquities | null>>();

function getEquities(symbols: string[]): Promise<OverlayEquities | null> {
  const key = symbols.join(",");
  let cache = quoteCaches.get(key);
  if (!cache) {
    if (quoteCaches.size >= MAX_QUOTE_CACHES) {
      const oldest = quoteCaches.keys().next().value;
      if (oldest !== undefined) quoteCaches.delete(oldest);
    }
    cache = makeCache(60_000, () => fetchEquities(symbols));
    quoteCaches.set(key, cache);
  }
  return cache();
}

export function registerStreamOverlayRoutes(app: Express) {
  app.get("/api/stream-overlay/data", async (req: Request, res: Response) => {
    try {
      const symbols = parseSymbols(req.query.symbols);
      const [rates, equities] = await Promise.all([getRates(), getEquities(symbols)]);
      res.set("Cache-Control", "public, max-age=30");
      res.json({
        updatedAt: new Date().toISOString(),
        rates: rates ?? [],
        equities: equities ?? { index: null, stocks: [], macro: { usdcad: null, wti: null } },
        housing: BENCHMARK_HOME_PRICES,
        nextBoc: nextBocDecision(),
      });
    } catch (err: any) {
      console.error("[stream-overlay] error:", err?.message ?? err);
      res.status(500).json({ error: "Failed to load market data" });
    }
  });

  app.get("/overlay/market", (req: Request, res: Response) => {
    const mode = req.query.mode === "panel" ? "panel" : "ticker";
    const bg =
      req.query.bg === "dark" || req.query.bg === "transparent"
        ? (req.query.bg as string)
        : mode === "panel"
          ? "dark"
          : "transparent";
    const rawSpeed = parseInt(String(req.query.speed ?? ""), 10);
    const speed = Math.min(300, Math.max(30, Number.isFinite(rawSpeed) ? rawSpeed : 90));
    const symbols = parseSymbols(req.query.symbols);
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex");
    res.type("html").send(renderOverlayHtml({ mode, bg, speed, symbols }));
  });
}

interface OverlayPageConfig {
  mode: "ticker" | "panel";
  bg: string;
  speed: number;
  symbols: string[];
}

function renderOverlayHtml(config: OverlayPageConfig): string {
  const safeConfig = JSON.stringify(config).replace(/</g, "\\u003c");
  const body =
    config.mode === "ticker"
      ? `
<div id="bar">
  <div class="badge">
    <div class="brand">realist<span class="tld">.ca</span></div>
    <div class="sub">MARKET DESK</div>
  </div>
  <div class="viewport"><div class="track" id="track"></div></div>
  <div class="stamp">
    <div class="time" id="clock">--:--</div>
    <div class="date" id="clock-date"></div>
  </div>
</div>`
      : `
<div id="panel">
  <header>
    <div class="hbrand">
      <span class="brand">realist<span class="tld">.ca</span></span>
      <span class="hdiv"></span>
      <span class="htitle">CANADIAN MARKET SNAPSHOT</span>
    </div>
    <div class="hright">
      <div class="hdate" id="clock-date"></div>
      <div class="htime" id="clock"></div>
    </div>
  </header>
  <main>
    <section>
      <h2>Rates, Bonds &amp; Macro</h2>
      <div class="rows" id="p-rates"></div>
    </section>
    <section>
      <h2>TSX &mdash; Banks &amp; Large Caps</h2>
      <div class="rows" id="p-equities"></div>
    </section>
    <section>
      <h2>Home Prices &mdash; Major Markets</h2>
      <div class="rows" id="p-housing"></div>
    </section>
  </main>
  <footer>
    <div>Rates: Bank of Canada &middot; Equities: Yahoo Finance (delayed) &middot; Housing: CREA / TRREB / GVR / CREB / QPAREB</div>
    <div id="p-updated"></div>
  </footer>
</div>`;

  return `<!DOCTYPE html>
<html class="m-${config.mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Realist Market Overlay</title>
<style>
:root{--red:hsl(356 100% 60%);--bg:#0b0d12;--card:rgba(255,255,255,.045);--line:rgba(255,255,255,.09);--text:#f4f6f8;--muted:#969eab;--up:#34d399;--down:#f87171}
*{margin:0;padding:0;box-sizing:border-box}
html.m-ticker{font-size:clamp(9px,12vh,18px)}
html.m-panel{font-size:clamp(9px,.833vw,19px)}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text);overflow:hidden;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
body.bg-transparent{background:transparent}
body.bg-dark{background:var(--bg)}
body.mode-panel.bg-dark{background:radial-gradient(90rem 45rem at 85% -10%,hsl(356 100% 60%/.10),transparent 60%),radial-gradient(70rem 40rem at -10% 115%,hsl(356 100% 60%/.06),transparent 55%),var(--bg)}
.up{color:var(--up)}.down{color:var(--down)}.flat{color:var(--muted)}
.brand{font-weight:800;letter-spacing:.01em}
.brand .tld{color:var(--red)}
/* ---- ticker ---- */
body.mode-ticker{display:flex;flex-direction:column;justify-content:flex-end}
#bar{display:flex;align-items:stretch;height:min(100vh,7.5rem);background:linear-gradient(180deg,rgba(17,19,26,.97),rgba(9,11,15,.97));border-top:.18rem solid var(--red);box-shadow:0 -.5rem 2rem rgba(0,0,0,.45)}
.badge{display:flex;flex-direction:column;justify-content:center;padding:0 1.6rem;background:rgba(0,0,0,.35);border-right:1px solid var(--line)}
.badge .brand{font-size:1.55rem;line-height:1.1}
.badge .sub{font-size:.62rem;letter-spacing:.4em;color:var(--muted);margin-top:.3rem}
.viewport{flex:1;overflow:hidden;display:flex;align-items:center;-webkit-mask-image:linear-gradient(90deg,transparent,#000 2rem,#000 calc(100% - 2rem),transparent);mask-image:linear-gradient(90deg,transparent,#000 2rem,#000 calc(100% - 2rem),transparent)}
.track{display:flex;width:max-content;animation:scroll 60s linear infinite}
@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.seq{display:flex;align-items:center}
.item{display:inline-flex;align-items:baseline;gap:.55rem;margin:0 1.1rem;white-space:nowrap}
.item .lbl{font-size:.95rem;color:var(--muted);letter-spacing:.06em;font-weight:600}
.item .val{font-size:1.5rem;font-weight:700}
.item .chg{font-size:.95rem;font-weight:700}
.group{font-size:.8rem;font-weight:800;letter-spacing:.2em;color:#fff;background:var(--red);padding:.32rem .6rem;border-radius:.35rem;margin:0 1.1rem;white-space:nowrap}
.sep{width:.28rem;height:.28rem;border-radius:50%;background:rgba(255,255,255,.22);flex:none}
.stamp{display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding:0 1.5rem;border-left:1px solid var(--line)}
.stamp .time{font-size:1.35rem;font-weight:700}
.stamp .date{font-size:.72rem;color:var(--muted);letter-spacing:.14em;margin-top:.25rem}
/* ---- panel ---- */
#panel{height:100%;display:flex;flex-direction:column;padding:2.2rem 2.6rem 1.5rem}
#panel header{display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:1.1rem;border-bottom:1px solid var(--line);margin-bottom:1.4rem}
.hbrand{display:flex;align-items:center;gap:1.1rem}
.hbrand .brand{font-size:2rem}
.hdiv{width:1px;height:1.8rem;background:var(--line)}
.htitle{font-size:.95rem;letter-spacing:.34em;color:var(--muted);font-weight:700}
.hright{text-align:right}
.hdate{font-size:.85rem;color:var(--muted);letter-spacing:.08em}
.htime{font-size:1.6rem;font-weight:800}
#panel main{flex:1;display:grid;grid-template-columns:1.02fr 1.08fr 1.18fr;gap:1.3rem;min-height:0}
#panel section{background:var(--card);border:1px solid var(--line);border-radius:1rem;padding:1.2rem 1.5rem;display:flex;flex-direction:column;min-height:0}
#panel h2{font-size:.8rem;letter-spacing:.24em;color:var(--muted);font-weight:800;text-transform:uppercase;padding-bottom:.8rem;border-bottom:1px solid var(--line)}
.rows{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;min-height:0}
.prow{display:flex;align-items:baseline;justify-content:space-between;gap:1rem}
.plbl{font-size:1.05rem;color:#c8cdd6;font-weight:600}
.psub{display:block;font-size:.72rem;color:var(--muted);font-weight:500;margin-top:.15rem;letter-spacing:.04em}
.pval{display:flex;align-items:baseline;gap:.7rem}
.pval .num{font-size:1.7rem;font-weight:800}
.chip{font-size:.85rem;font-weight:700;white-space:nowrap}
.qrow .plbl{font-size:1rem}
.qrow .num{font-size:1.2rem;font-weight:700}
.qrow.hero .num{font-size:1.6rem;font-weight:800}
.qrow.hero .plbl{font-size:1.1rem;color:var(--text)}
.hrow .num{font-size:1.55rem}
#panel footer{display:flex;justify-content:space-between;gap:1rem;color:var(--muted);font-size:.75rem;padding-top:1rem;letter-spacing:.05em}
</style>
</head>
<body class="mode-${config.mode} bg-${config.bg}">${body}
<script>window.__OVERLAY__=${safeConfig};</script>
<script>
(function(){
  var cfg = window.__OVERLAY__;
  var isTicker = cfg.mode === 'ticker';

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function arrow(v){ return v > 0 ? '\\u25B2' : v < 0 ? '\\u25BC' : '\\u2013'; }
  function dirClass(v){ return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
  function money0(n){ return n.toLocaleString('en-CA', {style:'currency', currency:'CAD', maximumFractionDigits:0}); }
  function compactPrice(n){ return n >= 1e6 ? '$' + (n/1e6).toFixed(2) + 'M' : '$' + (n/1e3).toFixed(1) + 'K'; }
  function bpsChg(bps){
    if (bps == null) return null;
    return { text: arrow(bps) + ' ' + Math.abs(bps) + ' bps', dir: dirClass(bps) };
  }
  function pctChg(pct, digits){
    return { text: arrow(pct) + ' ' + Math.abs(pct).toFixed(digits == null ? 2 : digits) + '%', dir: dirClass(pct) };
  }

  /* clock */
  var clockEl = document.getElementById('clock');
  var clockDateEl = document.getElementById('clock-date');
  function tickClock(){
    var now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-CA', {hour:'numeric', minute:'2-digit'});
    if (clockDateEl) clockDateEl.textContent = isTicker
      ? now.toLocaleDateString('en-CA', {month:'short', day:'numeric'}).toUpperCase()
      : now.toLocaleDateString('en-CA', {weekday:'long', month:'long', day:'numeric', year:'numeric'});
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---- ticker ---- */
  function tickerItems(d){
    var items = [];
    if (d.rates.length) items.push({group:'RATES'});
    d.rates.forEach(function(r){
      items.push({
        id: 'r-' + r.key,
        label: r.ticker,
        value: r.value.toFixed(2) + '%',
        chg: r.kind === 'bond' ? bpsChg(r.changeBps) : null
      });
    });
    var macro = d.equities.macro || {};
    if (macro.usdcad || macro.wti || d.nextBoc) items.push({group:'MACRO'});
    if (macro.usdcad) items.push({id:'m-usdcad', label:'USDCAD', value: macro.usdcad.price.toFixed(4), chg: pctChg(macro.usdcad.changePct)});
    if (macro.wti) items.push({id:'m-wti', label:'WTI', value: 'US$' + macro.wti.price.toFixed(2), chg: pctChg(macro.wti.changePct)});
    if (d.nextBoc) items.push({id:'m-boc', label:'NEXT BoC', value: d.nextBoc.label.toUpperCase(), chg: d.nextBoc.mpr ? {text:'+ MPR', dir:'flat'} : null});
    var ix = d.equities.index;
    if (ix || d.equities.stocks.length) items.push({group:'STOCKS'});
    if (ix) items.push({id:'q-index', label:'TSX', value: Math.round(ix.price).toLocaleString('en-CA'), chg: pctChg(ix.changePct)});
    d.equities.stocks.forEach(function(q){
      items.push({id:'q-' + q.symbol, label: q.symbol.replace(/\\.TO$/, ''), value: q.price.toFixed(2), chg: pctChg(q.changePct)});
    });
    if (d.housing.length) items.push({group:'HOUSING'});
    d.housing.forEach(function(h){
      items.push({
        id: 'h-' + h.market,
        label: h.market.toUpperCase(),
        value: compactPrice(h.price),
        chg: { text: arrow(h.yoyPct) + ' ' + Math.abs(h.yoyPct).toFixed(1) + '% Y/Y', dir: dirClass(h.yoyPct) }
      });
    });
    return items;
  }

  function buildSeq(items){
    var seq = el('div', 'seq');
    items.forEach(function(it){
      if (it.group){ seq.appendChild(el('span', 'group', it.group)); return; }
      var span = el('span', 'item');
      span.setAttribute('data-id', it.id);
      span.appendChild(el('span', 'lbl', it.label));
      span.appendChild(el('span', 'val', it.value));
      var chg = el('span', 'chg ' + (it.chg ? it.chg.dir : 'flat'), it.chg ? it.chg.text : '');
      if (!it.chg) chg.style.display = 'none';
      span.appendChild(chg);
      seq.appendChild(span);
      seq.appendChild(el('span', 'sep'));
    });
    return seq;
  }

  var builtSig = '';
  function setTickerSpeed(){
    var track = document.getElementById('track');
    if (!track || !track.children.length) return;
    var w = track.children[0].getBoundingClientRect().width;
    if (w > 0) track.style.animationDuration = Math.max(20, w / cfg.speed) + 's';
  }
  function renderTicker(d){
    var items = tickerItems(d);
    var sig = items.map(function(it){ return it.group || it.id; }).join('|');
    var track = document.getElementById('track');
    if (sig !== builtSig){
      builtSig = sig;
      track.innerHTML = '';
      track.appendChild(buildSeq(items));
      track.appendChild(buildSeq(items));
      requestAnimationFrame(setTickerSpeed);
    } else {
      items.forEach(function(it){
        if (it.group) return;
        track.querySelectorAll('[data-id="' + it.id + '"]').forEach(function(n){
          n.querySelector('.val').textContent = it.value;
          var c = n.querySelector('.chg');
          if (it.chg){ c.style.display = ''; c.className = 'chg ' + it.chg.dir; c.textContent = it.chg.text; }
          else { c.style.display = 'none'; }
        });
      });
    }
  }
  var resizeTimer = null;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setTickerSpeed, 250);
  });

  /* ---- panel ---- */
  function prow(cls, label, sub, num, chg){
    var row = el('div', 'prow ' + cls);
    var left = el('div', 'plbl', label);
    if (sub) left.appendChild(el('span', 'psub', sub));
    row.appendChild(left);
    var right = el('div', 'pval');
    right.appendChild(el('span', 'num', num));
    if (chg) right.appendChild(el('span', 'chip ' + chg.dir, chg.text));
    row.appendChild(right);
    return row;
  }
  function renderPanel(d){
    var rates = document.getElementById('p-rates');
    rates.innerHTML = '';
    d.rates.forEach(function(r){
      rates.appendChild(prow('', r.label, null, r.value.toFixed(2) + '%', r.kind === 'bond' ? bpsChg(r.changeBps) : null));
    });
    var macro = d.equities.macro || {};
    if (macro.usdcad) rates.appendChild(prow('', 'USD/CAD', null, macro.usdcad.price.toFixed(4), pctChg(macro.usdcad.changePct)));
    if (macro.wti) rates.appendChild(prow('', 'WTI Crude Oil', null, 'US$' + macro.wti.price.toFixed(2), pctChg(macro.wti.changePct)));
    if (d.nextBoc) rates.appendChild(prow('', 'Next BoC Decision', d.nextBoc.mpr ? 'with Monetary Policy Report' : null, d.nextBoc.label, null));

    var eq = document.getElementById('p-equities');
    eq.innerHTML = '';
    var ix = d.equities.index;
    if (ix) eq.appendChild(prow('qrow hero', ix.name, null, Math.round(ix.price).toLocaleString('en-CA'), pctChg(ix.changePct)));
    d.equities.stocks.forEach(function(q){
      eq.appendChild(prow('qrow', q.symbol.replace(/\\.TO$/, ''), q.name, q.price.toFixed(2), pctChg(q.changePct)));
    });

    var hs = document.getElementById('p-housing');
    hs.innerHTML = '';
    d.housing.forEach(function(h){
      var sub = (h.measure === 'benchmark' ? 'MLS HPI benchmark' : 'Average price') + ' \\u00B7 ' + h.asOf;
      hs.appendChild(prow('hrow', h.market, sub, money0(h.price), pctChg(h.yoyPct, 1)));
    });

    var upd = document.getElementById('p-updated');
    if (upd) upd.textContent = 'Updated ' + new Date(d.updatedAt).toLocaleTimeString('en-CA', {hour:'numeric', minute:'2-digit'});
  }

  /* ---- data loop ---- */
  var hadData = false;
  function refresh(){
    fetch('/api/stream-overlay/data?symbols=' + encodeURIComponent(cfg.symbols.join(',')))
      .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(d){
        hadData = true;
        if (isTicker) renderTicker(d); else renderPanel(d);
      })
      .catch(function(e){
        console.error('overlay refresh failed', e);
        if (!hadData) setTimeout(refresh, 5000);
      });
  }
  refresh();
  setInterval(refresh, 60000);
})();
</script>
</body>
</html>`;
}
