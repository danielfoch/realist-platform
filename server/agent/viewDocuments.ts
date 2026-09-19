/**
 * Builders that turn a tool result into a hosted view document, plus
 * attachView(), which persists it and returns the `view` block (URL +
 * instructions) that rides back to the agent.
 *
 * Creating a view is always best-effort: the tool result is the product, the
 * link is a bonus. A storage failure is logged and the call still succeeds.
 */
import type { BuyHoldInputs } from "@shared/schema";
import {
  AGENT_VIEW_DISCLAIMER,
  AGENT_VIEW_DOCUMENT_VERSION,
  agentViewPath,
  type AgentViewDocument,
  type AgentViewLink,
  type AgentViewRef,
  type AgentViewSection,
  type ReportViewDocument,
  type UnderwritingViewDocument,
  type UnderwritingViewProperty,
} from "@shared/agentViews";
import type { RentEstimate } from "@shared/rentEstimator";
import { publicBaseUrl, type AgentContext } from "./context";
import { getAgentViewStore } from "./viewStore";
import type { ResolvedRent } from "./underwriting";

const VIEW_INSTRUCTIONS: Record<AgentViewDocument["kind"], string> = {
  underwriting:
    "Give this link to the user. It opens an interactive spreadsheet of this underwriting on realist.ca: they can edit any assumption, see the 10-year pro forma, charts and a bear/base/bull stress test recalculate live, and download an Excel model with working formulas.",
  report:
    "Give this link to the user. It opens these results on realist.ca as a visual report with charts and sortable tables they can explore and share.",
};

export function viewUrlForToken(token: string): string {
  return `${publicBaseUrl()}${agentViewPath(token)}`;
}

export async function attachView(
  ctx: AgentContext,
  document: AgentViewDocument,
  opts: { analysisId?: string | null } = {},
): Promise<AgentViewRef | null> {
  try {
    const stored = await getAgentViewStore().create({
      document,
      userId: ctx.userId,
      apiKeyId: ctx.keyId,
      analysisId: opts.analysisId ?? null,
      tool: document.tool,
      channel: ctx.channel,
    });
    return {
      url: viewUrlForToken(stored.token),
      kind: document.kind,
      title: document.title,
      instructions: VIEW_INSTRUCTIONS[document.kind],
    };
  } catch (error: any) {
    console.error(`[agent-views] could not create a view for ${document.tool}:`, error?.message || error);
    return null;
  }
}

// ---------- underwriting ----------

function analyzerSeedUrl(address: string | null, inputs: BuyHoldInputs): string {
  // The web analyzer accepts these seed params (client/src/pages/Home.tsx).
  const params = new URLSearchParams();
  if (address) params.set("address", address);
  params.set("price", String(Math.round(inputs.purchasePrice)));
  params.set("rent", String(Math.round(inputs.monthlyRent)));
  params.set("vacancy", String(inputs.vacancyPercent));
  params.set("maintenance", String(inputs.maintenancePercent));
  params.set("management", String(inputs.managementPercent));
  params.set("insurance", String(Math.round(inputs.insurance)));
  params.set("propertyTax", String(Math.round(inputs.propertyTax)));
  return `/tools/analyzer?${params.toString()}`;
}

function dealDeskUrl(address: string | null, inputs: BuyHoldInputs): string {
  const params = new URLSearchParams();
  if (address) params.set("address", address);
  params.set("price", String(Math.round(inputs.purchasePrice)));
  params.set("rent", String(Math.round(inputs.monthlyRent)));
  return `/tools/deal-desk?${params.toString()}`;
}

const STRATEGY_LABELS: Record<string, string> = {
  buyHold: "Buy & hold",
  brrr: "BRRRR",
  flip: "Flip",
  airbnb: "Short-term rental",
  multiplex: "Multiplex",
};

export function buildUnderwritingViewDocument(input: {
  tool: string;
  property: UnderwritingViewProperty;
  strategyType: string;
  countryMode: "CA" | "US";
  inputs: BuyHoldInputs;
  rent: ResolvedRent;
  notes: string[];
  analysisId: string | null;
}): UnderwritingViewDocument {
  const { property } = input;
  const place = [property.city, property.province].filter(Boolean).join(", ");
  const title = property.address
    ? [property.address, place].filter(Boolean).join(", ")
    : property.mlsNumber
      ? `MLS ${property.mlsNumber}`
      : "Underwriting";
  const bits = [
    STRATEGY_LABELS[input.strategyType] ?? input.strategyType,
    property.units > 1 ? `${property.units} units` : null,
    property.propertyType,
    property.mlsNumber ? `MLS ${property.mlsNumber}` : null,
  ].filter(Boolean);

  const links: AgentViewLink[] = [
    { label: "Open in the full Realist analyzer", href: analyzerSeedUrl(property.address, input.inputs), primary: true },
    { label: "Get a second opinion from the Realist Deal Desk", href: dealDeskUrl(title, input.inputs) },
  ];
  if (property.mlsNumber) links.push({ label: "View the listing", href: `/listings/${encodeURIComponent(property.mlsNumber)}` });

  return {
    version: AGENT_VIEW_DOCUMENT_VERSION,
    kind: "underwriting",
    title,
    subtitle: bits.join(" · "),
    generatedAt: new Date().toISOString(),
    tool: input.tool,
    disclaimer: AGENT_VIEW_DISCLAIMER,
    links,
    property,
    strategyType: input.strategyType,
    countryMode: input.countryMode,
    inputs: input.inputs,
    rent: { source: input.rent.source, detail: input.rent.detail },
    assumptionNotes: input.notes,
    analysisId: input.analysisId,
  };
}

// ---------- generic reports ----------

function reportDocument(tool: string, title: string, subtitle: string, sections: AgentViewSection[], links: AgentViewLink[]): ReportViewDocument {
  return {
    version: AGENT_VIEW_DOCUMENT_VERSION,
    kind: "report",
    title,
    subtitle,
    generatedAt: new Date().toISOString(),
    tool,
    disclaimer: AGENT_VIEW_DISCLAIMER,
    links,
    sections,
  };
}

export interface DealSearchListing {
  mlsNumber: string;
  addressLine: string;
  city: string | null;
  listPrice: number | null;
  capRate: number | null;
  cashOnCash: number | null;
  dealScore: number | null;
  monthlyRent: number | null;
  units: number | null;
  daysOnMarket: number | null;
  explanation: string | null;
}

export function buildDealSearchViewDocument(tool: string, query: string, total: number, listings: DealSearchListing[]): ReportViewDocument {
  const withCap = listings.filter((l) => l.capRate != null);
  const best = [...withCap].sort((x, y) => (y.capRate ?? 0) - (x.capRate ?? 0))[0];
  const prices = listings.map((l) => l.listPrice).filter((p): p is number => p != null && p > 0).sort((x, y) => x - y);
  const medianPrice = prices.length ? prices[Math.floor(prices.length / 2)] : null;

  const sections: AgentViewSection[] = [
    {
      type: "statGrid",
      stats: [
        { label: "Matches", value: String(total), detail: `Top ${listings.length} shown, ranked by deal score` },
        { label: "Best cap rate", value: best?.capRate != null ? `${best.capRate.toFixed(1)}%` : "—", detail: best?.addressLine },
        { label: "Median list price", value: medianPrice != null ? `$${Math.round(medianPrice).toLocaleString("en-CA")}` : "—" },
      ],
    },
  ];
  if (withCap.length >= 2) {
    sections.push({
      type: "chart",
      chartType: "bar",
      title: "Estimated cap rate by listing",
      caption: "Screening estimates from list price, rent data and default expenses — underwrite before acting.",
      xKey: "label",
      format: "percent",
      series: [{ key: "capRate", label: "Cap rate" }],
      // Short labels: the chart only angles them past 8 bars, and full addresses collide before that.
      data: withCap.slice(0, 15).map((l) => ({ label: l.addressLine.length > 16 ? `${l.addressLine.slice(0, 15)}…` : l.addressLine, capRate: l.capRate as number })),
    });
  }
  sections.push({
    type: "table",
    heading: "Listings",
    caption: "Select an address to open the listing on realist.ca. Listing data: CREA DDF®.",
    hrefKey: "href",
    columns: [
      { key: "address", label: "Address" },
      { key: "listPrice", label: "List price", format: "currency", align: "right" },
      { key: "capRate", label: "Cap rate", format: "percent", align: "right" },
      { key: "cashOnCash", label: "Cash-on-cash", format: "percent", align: "right" },
      { key: "monthlyRent", label: "Rent / mo", format: "currency", align: "right" },
      { key: "units", label: "Units", format: "number", align: "right" },
      { key: "dealScore", label: "Deal score", format: "number", align: "right" },
      { key: "daysOnMarket", label: "DOM", format: "number", align: "right" },
    ],
    rows: listings.map((l) => ({
      address: [l.addressLine, l.city].filter(Boolean).join(", "),
      href: `/listings/${encodeURIComponent(l.mlsNumber)}`,
      listPrice: l.listPrice,
      capRate: l.capRate,
      cashOnCash: l.cashOnCash,
      monthlyRent: l.monthlyRent,
      units: l.units,
      dealScore: l.dealScore,
      daysOnMarket: l.daysOnMarket,
    })),
  });
  const notes = listings.filter((l) => l.explanation).slice(0, 5);
  if (notes.length) {
    sections.push({
      type: "narrative",
      heading: "Why these ranked well",
      body: notes.map((l) => `- **${l.addressLine}** — ${l.explanation}`).join("\n"),
    });
  }

  return reportDocument(tool, `Deal search: “${query.slice(0, 120)}”`, "Ranked Canadian listings from the Realist deal finder", sections, [
    { label: "Explore these on the yield map", href: "/tools/cap-rates", primary: true },
    { label: "Underwrite one in the analyzer", href: "/tools/analyzer" },
  ]);
}

export function buildRentEstimateViewDocument(
  tool: string,
  subject: { bedrooms: number | string; city?: string | null; province?: string | null },
  estimate: RentEstimate,
): ReportViewDocument {
  const place = [subject.city, subject.province].filter(Boolean).join(", ") || "this location";
  const perUnit = estimate.units > 1 ? Math.round(estimate.monthlyRent / estimate.units) : null;
  const methodLabel: Record<string, string> = {
    comps_radius: "Nearby rental comps",
    city_comps: "City-wide rental comps",
    city_aggregate: "City rent aggregates",
    cmhc_baseline: "CMHC survey baseline",
  };
  const currency = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
  const sections: AgentViewSection[] = [
    {
      type: "statGrid",
      stats: [
        { label: "Estimated rent", value: `${currency(estimate.monthlyRent)}/mo`, detail: perUnit ? `${currency(perUnit)} × ${estimate.units} units` : undefined },
        { label: "Likely range", value: `${currency(estimate.rangeLow)} – ${currency(estimate.rangeHigh)}` },
        { label: "Confidence", value: estimate.confidence[0].toUpperCase() + estimate.confidence.slice(1), detail: `${estimate.compCount} comparable${estimate.compCount === 1 ? "" : "s"}` },
        { label: "Method", value: methodLabel[estimate.method] ?? estimate.method, detail: estimate.radiusKm != null ? `within ${estimate.radiusKm} km` : undefined },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      title: "Rent range",
      xKey: "label",
      format: "currency",
      series: [{ key: "rent", label: "Monthly rent" }],
      data: [
        { label: "Low", rent: estimate.rangeLow },
        { label: "Estimate", rent: estimate.monthlyRent },
        { label: "High", rent: estimate.rangeHigh },
      ],
    },
    {
      type: "callout",
      tone: estimate.confidence === "low" ? "warning" : "info",
      heading: "How to use this",
      body: estimate.confidence === "low"
        ? "Thin data for this market: treat the estimate as a starting point and confirm with live rental listings or a local property manager."
        : "Model estimate from observed asking rents. Actual achievable rent depends on condition, parking, utilities and lease terms.",
    },
  ];
  return reportDocument(tool, `Rent estimate — ${subject.bedrooms}-bedroom in ${place}`, `Model ${estimate.modelKey} ${estimate.modelVersion}`, sections, [
    { label: "Underwrite a deal with this rent", href: `/tools/analyzer?rent=${Math.round(estimate.monthlyRent)}`, primary: true },
  ]);
}

export interface MarketSnapshotRow {
  city: string;
  province: string | null;
  month: string;
  dealCount: number | null;
  avgCapRate: number | null;
  medianCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
  avgPurchasePrice: number | null;
  medianPurchasePrice: number | null;
  avgRentPerUnit: number | null;
  cmhcOneBed: number | null;
  cmhcTwoBed: number | null;
}

/** A month only counts as data if something was actually measured in it. */
export function snapshotHasData(row: MarketSnapshotRow): boolean {
  return (row.dealCount ?? 0) > 0
    || row.medianCapRate != null
    || row.avgCapRate != null
    || row.medianPurchasePrice != null
    || row.avgPurchasePrice != null;
}

export function buildMarketReportViewDocument(tool: string, city: string, history: MarketSnapshotRow[]): ReportViewDocument {
  const ordered = [...history].sort((x, y) => x.month.localeCompare(y.month));
  // Months with no underwritten deals exist as empty rows. Never headline one,
  // and never plot its blanks as zeros — that draws a crash that did not happen.
  const measured = ordered.filter(snapshotHasData);
  const latest = measured[measured.length - 1] ?? ordered[ordered.length - 1];
  const prior = measured[measured.length - 2];
  const emptyAfterLatest = ordered.filter((row) => row.month > latest.month).length;
  const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(2)}%`);
  const currency = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-CA")}`);
  const trend = (now?: number | null, before?: number | null) =>
    now == null || before == null || now === before ? "flat" as const : now > before ? "up" as const : "down" as const;
  const latestCap = latest.medianCapRate ?? latest.avgCapRate;
  const priorCap = prior ? prior.medianCapRate ?? prior.avgCapRate : null;
  const latestPrice = latest.medianPurchasePrice ?? latest.avgPurchasePrice;
  const priorPrice = prior ? prior.medianPurchasePrice ?? prior.avgPurchasePrice : null;

  const sections: AgentViewSection[] = [
    {
      type: "statGrid",
      heading: `Latest month with data — ${latest.month}`,
      stats: [
        { label: "Median cap rate", value: pct(latestCap), trend: trend(latestCap, priorCap), detail: prior ? `${pct(priorCap)} in ${prior.month}` : undefined },
        { label: "Median purchase price", value: currency(latestPrice), trend: trend(latestPrice, priorPrice), detail: prior ? `${currency(priorPrice)} in ${prior.month}` : undefined },
        { label: "Avg rent per unit", value: currency(latest.avgRentPerUnit) },
        { label: "Avg DSCR", value: latest.avgDscr != null ? `${latest.avgDscr.toFixed(2)}x` : "—" },
        { label: "Deals analyzed", value: String(latest.dealCount ?? 0), detail: "Underwritings on realist.ca that month" },
      ],
    },
  ];
  if (emptyAfterLatest > 0) {
    sections.push({
      type: "callout",
      tone: "warning",
      body: `No deals have been underwritten in ${city} since ${latest.month}, so ${emptyAfterLatest === 1 ? "the most recent month is" : `the ${emptyAfterLatest} most recent months are`} empty and left off the charts.`,
    });
  }
  const capSeries = measured.filter((row) => (row.medianCapRate ?? row.avgCapRate) != null);
  if (capSeries.length >= 2) {
    sections.push({
      type: "chart",
      chartType: "line",
      title: `Cap rate trend — ${city}`,
      xKey: "month",
      format: "percent",
      series: [
        { key: "medianCapRate", label: "Median cap rate" },
        // Muted, so the two lines stay distinguishable (chart-1 and chart-2 are both reds).
        { key: "avgCapRate", label: "Average cap rate", color: "hsl(var(--muted-foreground))" },
      ],
      data: capSeries.map((row) => ({
        month: row.month,
        ...(row.medianCapRate != null ? { medianCapRate: row.medianCapRate } : {}),
        ...(row.avgCapRate != null ? { avgCapRate: row.avgCapRate } : {}),
      })),
    });
  }
  const priceSeries = measured.filter((row) => (row.medianPurchasePrice ?? row.avgPurchasePrice) != null);
  if (priceSeries.length >= 2) {
    sections.push({
      type: "chart",
      chartType: "line",
      title: `Median purchase price — ${city}`,
      xKey: "month",
      format: "currency",
      series: [{ key: "medianPurchasePrice", label: "Median purchase price" }],
      data: priceSeries.map((row) => ({ month: row.month, medianPurchasePrice: (row.medianPurchasePrice ?? row.avgPurchasePrice) as number })),
    });
  }
  sections.push({
    type: "table",
    heading: "Monthly history",
    columns: [
      { key: "month", label: "Month" },
      { key: "dealCount", label: "Deals", format: "number", align: "right" },
      { key: "medianCapRate", label: "Median cap", format: "percent", align: "right" },
      { key: "avgCashOnCash", label: "Avg CoC", format: "percent", align: "right" },
      { key: "medianPurchasePrice", label: "Median price", format: "currency", align: "right" },
      { key: "avgRentPerUnit", label: "Rent / unit", format: "currency", align: "right" },
      { key: "cmhcTwoBed", label: "CMHC 2-bed", format: "currency", align: "right" },
    ],
    rows: [...ordered].reverse().map((row) => ({
      month: row.month,
      dealCount: row.dealCount,
      medianCapRate: row.medianCapRate ?? row.avgCapRate,
      avgCashOnCash: row.avgCashOnCash,
      medianPurchasePrice: row.medianPurchasePrice ?? row.avgPurchasePrice,
      avgRentPerUnit: row.avgRentPerUnit,
      cmhcTwoBed: row.cmhcTwoBed,
    })),
  });
  sections.push({
    type: "callout",
    tone: "info",
    heading: "About this data",
    body: "Aggregated from deals underwritten on realist.ca, alongside CMHC rental survey benchmarks. Thin months (few deals) are noisy — read the trend, not a single point.",
  });

  return reportDocument(tool, `${city} market report`, [latest.province, `${ordered.length} month${ordered.length === 1 ? "" : "s"} of data`].filter(Boolean).join(" · "), sections, [
    { label: `Find deals in ${city}`, href: `/tools/cap-rates`, primary: true },
    { label: "All Realist market reports", href: "/reports" },
  ]);
}
