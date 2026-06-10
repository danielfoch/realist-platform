import fs from "fs";
import path from "path";

const FLOORPLANS_CSV = path.join(process.cwd(), "server", "data", "precon", "floorplans.csv");
const PROJECTS_CSV = path.join(process.cwd(), "server", "data", "precon", "projects.csv");

const REBATE_BENCHMARK_PCT = 13.0;

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.length === headers.length).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => obj[h] = r[i] ?? "");
    return obj;
  });
}

function num(v: string): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface Floorplan {
  project_name: string;
  developer_name: string;
  city: string;
  region: string;
  building_category: string;
  floorplan_name: string;
  bed_type: string;
  from_psf: number;
  to_psf: number;
  delta_pct: number;
  direction: "CUT" | "RAISE" | "FLAT";
  from_date: string;
  to_date: string;
}

interface Project {
  project_name: string;
  developer_name: string;
  city: string;
  region: string;
  building_category: string;
  floorplans_total: number;
  floorplans_raised: number;
  floorplans_cut: number;
  floorplans_flat: number;
  avg_delta_pct: number;
  max_raise_pct: number | null;
  max_cut_pct: number | null;
}

export interface PreconPricingReport {
  generatedAt: string;
  windowFrom: string;
  windowTo: string;
  rebateBenchmarkPct: number;
  totals: {
    floorplans: number;
    projects: number;
    projectsWithMovement: number;
    cuts: number;
    raises: number;
    flat: number;
    cutSharePct: number;
    raiseSharePct: number;
    flatSharePct: number;
    cutToRaiseRatio: number | null;
    avgCutPct: number;
    avgRaisePct: number;
    medianCutPct: number;
    medianRaisePct: number;
    biggestCutPct: number;
    biggestRaisePct: number;
    raisesAboveRebate: number;
    raisesBelowRebate: number;
  };
  distribution: Array<{ band: string; count: number }>;
  byRegion: Array<{
    region: string;
    floorplans: number;
    cuts: number;
    raises: number;
    flat: number;
    avgDeltaPct: number;
    cutToRaiseRatio: number | null;
  }>;
  byCity: Array<{
    city: string;
    region: string;
    floorplans: number;
    cuts: number;
    raises: number;
    flat: number;
    avgDeltaPct: number;
  }>;
  byBuildingCategory: Array<{
    category: string;
    floorplans: number;
    cuts: number;
    raises: number;
    flat: number;
    avgDeltaPct: number;
  }>;
  byBedType: Array<{
    bed: string;
    floorplans: number;
    cuts: number;
    raises: number;
    flat: number;
    avgDeltaPct: number;
  }>;
  byDeveloper: Array<{
    developer: string;
    floorplans: number;
    cuts: number;
    raises: number;
    avgDeltaPct: number;
  }>;
  topCuts: Array<{
    project: string;
    developer: string;
    city: string;
    region: string;
    floorplan: string;
    bed: string;
    fromPsf: number;
    toPsf: number;
    deltaPct: number;
  }>;
  topRaises: Array<{
    project: string;
    developer: string;
    city: string;
    region: string;
    floorplan: string;
    bed: string;
    fromPsf: number;
    toPsf: number;
    deltaPct: number;
  }>;
  raisesAboveRebate: Array<{
    project: string;
    developer: string;
    city: string;
    floorplan: string;
    bed: string;
    deltaPct: number;
  }>;
  projectsMostCuts: Array<{
    project: string;
    developer: string;
    city: string;
    region: string;
    cuts: number;
    total: number;
    avgDeltaPct: number;
    maxCutPct: number | null;
  }>;
  projectsMostRaises: Array<{
    project: string;
    developer: string;
    city: string;
    region: string;
    raises: number;
    total: number;
    avgDeltaPct: number;
    maxRaisePct: number | null;
  }>;
  developersDeepestCuts: Array<{
    developer: string;
    floorplansCut: number;
    avgCutPct: number;
    deepestCutPct: number;
  }>;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function loadFloorplans(): Floorplan[] {
  const text = fs.readFileSync(FLOORPLANS_CSV, "utf8");
  const raw = parseCsv(text);
  return raw.map(r => ({
    project_name: r.project_name,
    developer_name: r.developer_name,
    city: r.city,
    region: r.region,
    building_category: r.building_category,
    floorplan_name: r.floorplan_name,
    bed_type: r.bed_type,
    from_psf: num(r.from_psf) ?? 0,
    to_psf: num(r.to_psf) ?? 0,
    delta_pct: num(r.delta_pct) ?? 0,
    direction: (r.direction as any) || "FLAT",
    from_date: r.from_date,
    to_date: r.to_date,
  })).filter(f => f.project_name && f.from_psf > 0 && f.to_psf > 0);
}

function loadProjects(): Project[] {
  const text = fs.readFileSync(PROJECTS_CSV, "utf8");
  const raw = parseCsv(text);
  return raw.map(r => ({
    project_name: r.project_name,
    developer_name: r.developer_name,
    city: r.city,
    region: r.region,
    building_category: r.building_category,
    floorplans_total: num(r.floorplans_total) ?? 0,
    floorplans_raised: num(r.floorplans_raised) ?? 0,
    floorplans_cut: num(r.floorplans_cut) ?? 0,
    floorplans_flat: num(r.floorplans_flat) ?? 0,
    avg_delta_pct: num(r.avg_delta_pct) ?? 0,
    max_raise_pct: num(r.max_raise_pct),
    max_cut_pct: num(r.max_cut_pct),
  })).filter(p => p.project_name);
}

let cached: PreconPricingReport | null = null;
let allFloorplansCache: Floorplan[] | null = null;
let allProjectsCache: Project[] | null = null;

function getAllFloorplans(): Floorplan[] {
  if (!allFloorplansCache) allFloorplansCache = loadFloorplans();
  return allFloorplansCache;
}
function getAllProjects(): Project[] {
  if (!allProjectsCache) allProjectsCache = loadProjects();
  return allProjectsCache;
}

export function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface ProjectSummary {
  slug: string;
  project: string;
  developer: string;
  city: string;
  region: string;
  category: string;
  totalFloorplans: number;
  cuts: number;
  raises: number;
  flat: number;
  avgDeltaPct: number;
  maxCutPct: number | null;
  maxRaisePct: number | null;
}

export function getProjectSummaries(): ProjectSummary[] {
  const projects = getAllProjects();
  return projects.map(p => ({
    slug: slugify(`${p.project_name}-${p.city}`),
    project: p.project_name,
    developer: p.developer_name,
    city: p.city,
    region: p.region,
    category: p.building_category,
    totalFloorplans: p.floorplans_total,
    cuts: p.floorplans_cut,
    raises: p.floorplans_raised,
    flat: p.floorplans_flat,
    avgDeltaPct: p.avg_delta_pct,
    maxCutPct: p.max_cut_pct,
    maxRaisePct: p.max_raise_pct,
  }));
}

export interface ProjectDetail {
  summary: ProjectSummary;
  floorplans: Array<{
    floorplan: string;
    bed: string;
    fromPsf: number;
    toPsf: number;
    deltaPct: number;
    direction: "CUT" | "RAISE" | "FLAT";
    fromDate: string;
    toDate: string;
  }>;
  comparableProjects: ProjectSummary[];
}

export function getProjectDetail(slug: string): ProjectDetail | null {
  const summaries = getProjectSummaries();
  const summary = summaries.find(s => s.slug === slug);
  if (!summary) return null;
  const fps = getAllFloorplans()
    .filter(f => f.project_name === summary.project && f.city === summary.city)
    .map(f => ({
      floorplan: f.floorplan_name,
      bed: f.bed_type,
      fromPsf: f.from_psf,
      toPsf: f.to_psf,
      deltaPct: f.delta_pct,
      direction: f.direction,
      fromDate: f.from_date,
      toDate: f.to_date,
    }))
    .sort((a, b) => a.deltaPct - b.deltaPct);
  // Comparables: same region + same category, excluding self
  const comparableProjects = summaries
    .filter(s => s.region === summary.region && s.category === summary.category && s.slug !== slug)
    .sort((a, b) => Math.abs(a.avgDeltaPct - summary.avgDeltaPct) - Math.abs(b.avgDeltaPct - summary.avgDeltaPct))
    .slice(0, 6);
  return { summary, floorplans: fps, comparableProjects };
}

export interface MarketScopeReport {
  scope: string;
  scopeLabel: string;
  totals: PreconPricingReport["totals"];
  byCity: PreconPricingReport["byCity"];
  byBuildingCategory: PreconPricingReport["byBuildingCategory"];
  byBedType: PreconPricingReport["byBedType"];
  topCuts: PreconPricingReport["topCuts"];
  topRaises: PreconPricingReport["topRaises"];
  projectsMostCuts: PreconPricingReport["projectsMostCuts"];
  windowFrom: string;
  windowTo: string;
}

export function getScopedPreconReport(opts: { city?: string; region?: string; scopeLabel: string }): MarketScopeReport {
  const all = getAllFloorplans();
  const allProjects = getAllProjects();
  const floorplans = all.filter(f =>
    (opts.city ? f.city.toLowerCase() === opts.city.toLowerCase() : true) &&
    (opts.region ? f.region.toLowerCase() === opts.region.toLowerCase() : true)
  );
  const projects = allProjects.filter(p =>
    (opts.city ? p.city.toLowerCase() === opts.city.toLowerCase() : true) &&
    (opts.region ? p.region.toLowerCase() === opts.region.toLowerCase() : true)
  );
  const cuts = floorplans.filter(f => f.direction === "CUT");
  const raises = floorplans.filter(f => f.direction === "RAISE");
  const flat = floorplans.filter(f => f.direction === "FLAT");
  const cutPcts = cuts.map(f => f.delta_pct);
  const raisePcts = raises.map(f => f.delta_pct);
  const allFromDates = floorplans.map(f => f.from_date).filter(Boolean).sort();
  const allToDates = floorplans.map(f => f.to_date).filter(Boolean).sort();

  function groupBy<T extends string>(key: (f: Floorplan) => T) {
    const m = new Map<T, Floorplan[]>();
    for (const f of floorplans) { const k = key(f); if (!m.has(k)) m.set(k, []); m.get(k)!.push(f); }
    return m;
  }
  const cityMap = groupBy(f => `${f.city}|${f.region}`);
  const byCity = Array.from(cityMap.entries()).map(([key, list]) => {
    const [city, region] = key.split("|");
    return {
      city, region,
      floorplans: list.length,
      cuts: list.filter(f => f.direction === "CUT").length,
      raises: list.filter(f => f.direction === "RAISE").length,
      flat: list.filter(f => f.direction === "FLAT").length,
      avgDeltaPct: list.reduce((s, f) => s + f.delta_pct, 0) / list.length,
    };
  }).filter(c => c.floorplans >= 2).sort((a, b) => a.avgDeltaPct - b.avgDeltaPct);

  const catMap = groupBy(f => f.building_category);
  const byBuildingCategory = Array.from(catMap.entries()).map(([category, list]) => ({
    category,
    floorplans: list.length,
    cuts: list.filter(f => f.direction === "CUT").length,
    raises: list.filter(f => f.direction === "RAISE").length,
    flat: list.filter(f => f.direction === "FLAT").length,
    avgDeltaPct: list.reduce((s, f) => s + f.delta_pct, 0) / list.length,
  })).sort((a, b) => b.floorplans - a.floorplans);

  const bedMap = groupBy(f => f.bed_type);
  const byBedType = Array.from(bedMap.entries()).map(([bed, list]) => ({
    bed,
    floorplans: list.length,
    cuts: list.filter(f => f.direction === "CUT").length,
    raises: list.filter(f => f.direction === "RAISE").length,
    flat: list.filter(f => f.direction === "FLAT").length,
    avgDeltaPct: list.reduce((s, f) => s + f.delta_pct, 0) / list.length,
  })).filter(b => b.floorplans >= 2).sort((a, b) => b.floorplans - a.floorplans);

  const topCuts = [...cuts].sort((a, b) => a.delta_pct - b.delta_pct).slice(0, 15).map(f => ({
    project: f.project_name, developer: f.developer_name, city: f.city, region: f.region,
    floorplan: f.floorplan_name, bed: f.bed_type, fromPsf: f.from_psf, toPsf: f.to_psf, deltaPct: f.delta_pct,
  }));
  const topRaises = [...raises].sort((a, b) => b.delta_pct - a.delta_pct).slice(0, 15).map(f => ({
    project: f.project_name, developer: f.developer_name, city: f.city, region: f.region,
    floorplan: f.floorplan_name, bed: f.bed_type, fromPsf: f.from_psf, toPsf: f.to_psf, deltaPct: f.delta_pct,
  }));

  const projectsMostCuts = [...projects]
    .filter(p => p.floorplans_cut > 0)
    .sort((a, b) => b.floorplans_cut - a.floorplans_cut || a.avg_delta_pct - b.avg_delta_pct)
    .slice(0, 15)
    .map(p => ({
      project: p.project_name, developer: p.developer_name, city: p.city, region: p.region,
      cuts: p.floorplans_cut, total: p.floorplans_total, avgDeltaPct: p.avg_delta_pct, maxCutPct: p.max_cut_pct,
    }));

  return {
    scope: opts.city || opts.region || "all",
    scopeLabel: opts.scopeLabel,
    totals: {
      floorplans: floorplans.length,
      projects: projects.length,
      projectsWithMovement: projects.filter(p => p.floorplans_cut > 0 || p.floorplans_raised > 0).length,
      cuts: cuts.length,
      raises: raises.length,
      flat: flat.length,
      cutSharePct: floorplans.length > 0 ? (cuts.length / floorplans.length) * 100 : 0,
      raiseSharePct: floorplans.length > 0 ? (raises.length / floorplans.length) * 100 : 0,
      flatSharePct: floorplans.length > 0 ? (flat.length / floorplans.length) * 100 : 0,
      cutToRaiseRatio: raises.length > 0 ? cuts.length / raises.length : null,
      avgCutPct: cutPcts.length > 0 ? cutPcts.reduce((s, n) => s + n, 0) / cutPcts.length : 0,
      avgRaisePct: raisePcts.length > 0 ? raisePcts.reduce((s, n) => s + n, 0) / raisePcts.length : 0,
      medianCutPct: median(cutPcts),
      medianRaisePct: median(raisePcts),
      biggestCutPct: cutPcts.length > 0 ? Math.min(...cutPcts) : 0,
      biggestRaisePct: raisePcts.length > 0 ? Math.max(...raisePcts) : 0,
      raisesAboveRebate: raises.filter(f => f.delta_pct > REBATE_BENCHMARK_PCT).length,
      raisesBelowRebate: raises.filter(f => f.delta_pct <= REBATE_BENCHMARK_PCT).length,
    },
    byCity, byBuildingCategory, byBedType, topCuts, topRaises, projectsMostCuts,
    windowFrom: allFromDates[0] || "",
    windowTo: allToDates[allToDates.length - 1] || "",
  };
}

export function getPreconPricingReport(): PreconPricingReport {
  if (cached) return cached;

  const floorplans = loadFloorplans();
  const projects = loadProjects();

  const cuts = floorplans.filter(f => f.direction === "CUT");
  const raises = floorplans.filter(f => f.direction === "RAISE");
  const flat = floorplans.filter(f => f.direction === "FLAT");

  const cutPcts = cuts.map(f => f.delta_pct);
  const raisePcts = raises.map(f => f.delta_pct);

  const projectsWithMovement = projects.filter(p => p.floorplans_cut > 0 || p.floorplans_raised > 0).length;

  const allFromDates = floorplans.map(f => f.from_date).filter(Boolean).sort();
  const allToDates = floorplans.map(f => f.to_date).filter(Boolean).sort();

  // Distribution bands
  const bands = [
    { band: "≤ −20%", min: -Infinity, max: -20 },
    { band: "−20% to −15%", min: -20, max: -15 },
    { band: "−15% to −10%", min: -15, max: -10 },
    { band: "−10% to −5%", min: -10, max: -5 },
    { band: "−5% to 0%", min: -5, max: 0 },
    { band: "0% (flat)", min: 0, max: 0 },
    { band: "0% to +5%", min: 0, max: 5 },
    { band: "+5% to +10%", min: 5, max: 10 },
    { band: "+10% to +15%", min: 10, max: 15 },
    { band: "≥ +15%", min: 15, max: Infinity },
  ];
  const distribution = bands.map(b => {
    let count = 0;
    if (b.band === "0% (flat)") {
      count = floorplans.filter(f => f.delta_pct === 0).length;
    } else if (b.min < 0) {
      count = floorplans.filter(f => f.delta_pct > b.min && f.delta_pct <= b.max && f.delta_pct < 0).length;
    } else {
      count = floorplans.filter(f => f.delta_pct > b.min && f.delta_pct <= b.max && f.delta_pct > 0).length;
    }
    return { band: b.band, count };
  });

  // Group helper
  function group<T extends string>(key: (f: Floorplan) => T) {
    const map = new Map<T, Floorplan[]>();
    for (const f of floorplans) {
      const k = key(f);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    }
    return map;
  }

  const regionMap = group(f => f.region);
  const byRegion = Array.from(regionMap.entries()).map(([region, list]) => {
    const c = list.filter(f => f.direction === "CUT").length;
    const r = list.filter(f => f.direction === "RAISE").length;
    const fl = list.filter(f => f.direction === "FLAT").length;
    const avg = list.reduce((s, f) => s + f.delta_pct, 0) / list.length;
    return {
      region,
      floorplans: list.length,
      cuts: c, raises: r, flat: fl,
      avgDeltaPct: avg,
      cutToRaiseRatio: r > 0 ? c / r : null,
    };
  }).sort((a, b) => b.floorplans - a.floorplans);

  const cityMap = group(f => `${f.city}|${f.region}`);
  const byCity = Array.from(cityMap.entries()).map(([key, list]) => {
    const [city, region] = key.split("|");
    const c = list.filter(f => f.direction === "CUT").length;
    const r = list.filter(f => f.direction === "RAISE").length;
    const fl = list.filter(f => f.direction === "FLAT").length;
    const avg = list.reduce((s, f) => s + f.delta_pct, 0) / list.length;
    return { city, region, floorplans: list.length, cuts: c, raises: r, flat: fl, avgDeltaPct: avg };
  }).filter(c => c.floorplans >= 3).sort((a, b) => a.avgDeltaPct - b.avgDeltaPct);

  const catMap = group(f => f.building_category);
  const byBuildingCategory = Array.from(catMap.entries()).map(([category, list]) => {
    const c = list.filter(f => f.direction === "CUT").length;
    const r = list.filter(f => f.direction === "RAISE").length;
    const fl = list.filter(f => f.direction === "FLAT").length;
    const avg = list.reduce((s, f) => s + f.delta_pct, 0) / list.length;
    return { category, floorplans: list.length, cuts: c, raises: r, flat: fl, avgDeltaPct: avg };
  }).sort((a, b) => b.floorplans - a.floorplans);

  const bedMap = group(f => f.bed_type);
  const byBedType = Array.from(bedMap.entries()).map(([bed, list]) => {
    const c = list.filter(f => f.direction === "CUT").length;
    const r = list.filter(f => f.direction === "RAISE").length;
    const fl = list.filter(f => f.direction === "FLAT").length;
    const avg = list.reduce((s, f) => s + f.delta_pct, 0) / list.length;
    return { bed, floorplans: list.length, cuts: c, raises: r, flat: fl, avgDeltaPct: avg };
  }).filter(b => b.floorplans >= 3).sort((a, b) => b.floorplans - a.floorplans);

  const devMap = group(f => f.developer_name);
  const byDeveloper = Array.from(devMap.entries()).map(([developer, list]) => {
    const c = list.filter(f => f.direction === "CUT").length;
    const r = list.filter(f => f.direction === "RAISE").length;
    const avg = list.reduce((s, f) => s + f.delta_pct, 0) / list.length;
    return { developer, floorplans: list.length, cuts: c, raises: r, avgDeltaPct: avg };
  }).filter(d => d.floorplans >= 3).sort((a, b) => a.avgDeltaPct - b.avgDeltaPct);

  const topCuts = [...cuts].sort((a, b) => a.delta_pct - b.delta_pct).slice(0, 15).map(f => ({
    project: f.project_name, developer: f.developer_name, city: f.city, region: f.region,
    floorplan: f.floorplan_name, bed: f.bed_type, fromPsf: f.from_psf, toPsf: f.to_psf, deltaPct: f.delta_pct,
  }));

  const topRaises = [...raises].sort((a, b) => b.delta_pct - a.delta_pct).slice(0, 15).map(f => ({
    project: f.project_name, developer: f.developer_name, city: f.city, region: f.region,
    floorplan: f.floorplan_name, bed: f.bed_type, fromPsf: f.from_psf, toPsf: f.to_psf, deltaPct: f.delta_pct,
  }));

  const raisesAboveRebate = raises.filter(f => f.delta_pct > REBATE_BENCHMARK_PCT)
    .sort((a, b) => b.delta_pct - a.delta_pct)
    .map(f => ({
      project: f.project_name, developer: f.developer_name, city: f.city,
      floorplan: f.floorplan_name, bed: f.bed_type, deltaPct: f.delta_pct,
    }));

  const projectsMostCuts = [...projects]
    .filter(p => p.floorplans_cut > 0)
    .sort((a, b) => b.floorplans_cut - a.floorplans_cut || a.avg_delta_pct - b.avg_delta_pct)
    .slice(0, 15)
    .map(p => ({
      project: p.project_name, developer: p.developer_name, city: p.city, region: p.region,
      cuts: p.floorplans_cut, total: p.floorplans_total, avgDeltaPct: p.avg_delta_pct, maxCutPct: p.max_cut_pct,
    }));

  const projectsMostRaises = [...projects]
    .filter(p => p.floorplans_raised > 0)
    .sort((a, b) => b.floorplans_raised - a.floorplans_raised || b.avg_delta_pct - a.avg_delta_pct)
    .slice(0, 15)
    .map(p => ({
      project: p.project_name, developer: p.developer_name, city: p.city, region: p.region,
      raises: p.floorplans_raised, total: p.floorplans_total, avgDeltaPct: p.avg_delta_pct, maxRaisePct: p.max_raise_pct,
    }));

  const developersDeepestCuts = byDeveloper
    .filter(d => d.cuts >= 3)
    .sort((a, b) => a.avgDeltaPct - b.avgDeltaPct)
    .slice(0, 15)
    .map(d => {
      const devCuts = floorplans.filter(f => f.developer_name === d.developer && f.direction === "CUT");
      const deepest = devCuts.length > 0 ? Math.min(...devCuts.map(f => f.delta_pct)) : 0;
      const avgCut = devCuts.length > 0 ? devCuts.reduce((s, f) => s + f.delta_pct, 0) / devCuts.length : 0;
      return {
        developer: d.developer,
        floorplansCut: d.cuts,
        avgCutPct: avgCut,
        deepestCutPct: deepest,
      };
    });

  cached = {
    generatedAt: new Date().toISOString(),
    windowFrom: allFromDates[0] || "",
    windowTo: allToDates[allToDates.length - 1] || "",
    rebateBenchmarkPct: REBATE_BENCHMARK_PCT,
    totals: {
      floorplans: floorplans.length,
      projects: projects.length,
      projectsWithMovement,
      cuts: cuts.length,
      raises: raises.length,
      flat: flat.length,
      cutSharePct: (cuts.length / floorplans.length) * 100,
      raiseSharePct: (raises.length / floorplans.length) * 100,
      flatSharePct: (flat.length / floorplans.length) * 100,
      cutToRaiseRatio: raises.length > 0 ? cuts.length / raises.length : null,
      avgCutPct: cutPcts.length > 0 ? cutPcts.reduce((s, n) => s + n, 0) / cutPcts.length : 0,
      avgRaisePct: raisePcts.length > 0 ? raisePcts.reduce((s, n) => s + n, 0) / raisePcts.length : 0,
      medianCutPct: median(cutPcts),
      medianRaisePct: median(raisePcts),
      biggestCutPct: cutPcts.length > 0 ? Math.min(...cutPcts) : 0,
      biggestRaisePct: raisePcts.length > 0 ? Math.max(...raisePcts) : 0,
      raisesAboveRebate: raisesAboveRebate.length,
      raisesBelowRebate: raises.length - raisesAboveRebate.length,
    },
    distribution,
    byRegion,
    byCity,
    byBuildingCategory,
    byBedType,
    byDeveloper,
    topCuts,
    topRaises,
    raisesAboveRebate,
    projectsMostCuts,
    projectsMostRaises,
    developersDeepestCuts,
  };

  return cached;
}
