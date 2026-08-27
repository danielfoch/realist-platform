export interface OfferFunnelContext {
  listingId?: string | null;
  underwritingId?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  price?: number | null;
  estimatedMonthlyRent?: number | null;
  capRate?: number | null;
  monthlyCashFlow?: number | null;
  recommendedUnits?: number | null;
  maxLandPrice?: number | null;
  recommendedTakeout?: string | null;
  source?: string | null;
  signals?: string[] | null;
}

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  const cleaned = value?.trim().slice(0, maxLength);
  return cleaned || null;
}

function cleanNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildOfferFunnelHref(context: OfferFunnelContext): string {
  const params = new URLSearchParams();
  const textFields: Array<[string, string | null]> = [
    ["listingId", cleanText(context.listingId, 100)],
    ["underwritingId", cleanText(context.underwritingId, 100)],
    ["address", cleanText(context.address, 240)],
    ["city", cleanText(context.city, 100)],
    ["province", cleanText(context.province, 40)],
    ["source", cleanText(context.source, 80)],
    ["recommendedTakeout", cleanText(context.recommendedTakeout, 80)],
  ];
  for (const [key, value] of textFields) {
    if (value) params.set(key, value);
  }

  const numericFields: Array<[string, number | null]> = [
    ["price", cleanNumber(context.price)],
    ["estimatedMonthlyRent", cleanNumber(context.estimatedMonthlyRent)],
    ["capRate", cleanNumber(context.capRate)],
    ["monthlyCashFlow", cleanNumber(context.monthlyCashFlow)],
    ["recommendedUnits", cleanNumber(context.recommendedUnits)],
    ["maxLandPrice", cleanNumber(context.maxLandPrice)],
  ];
  for (const [key, value] of numericFields) {
    if (value !== null) params.set(key, String(value));
  }

  const signals = (context.signals ?? [])
    .map((signal) => cleanText(signal, 60))
    .filter((signal): signal is string => Boolean(signal))
    .slice(0, 8);
  if (signals.length > 0) params.set("signals", signals.join(","));

  const query = params.toString();
  return query ? `/offer?${query}` : "/offer";
}

export function parseOfferFunnelSearch(search: string): OfferFunnelContext {
  const params = new URLSearchParams(search);
  const numberParam = (name: string): number | null => {
    const value = params.get(name);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    listingId: cleanText(params.get("listingId"), 100),
    underwritingId: cleanText(params.get("underwritingId"), 100),
    address: cleanText(params.get("address"), 240),
    city: cleanText(params.get("city"), 100),
    province: cleanText(params.get("province"), 40),
    price: numberParam("price"),
    estimatedMonthlyRent: numberParam("estimatedMonthlyRent"),
    capRate: numberParam("capRate"),
    monthlyCashFlow: numberParam("monthlyCashFlow"),
    recommendedUnits: numberParam("recommendedUnits"),
    maxLandPrice: numberParam("maxLandPrice"),
    recommendedTakeout: cleanText(params.get("recommendedTakeout"), 80),
    source: cleanText(params.get("source"), 80),
    signals: (params.get("signals") || "")
      .split(",")
      .map((signal) => cleanText(signal, 60))
      .filter((signal): signal is string => Boolean(signal))
      .slice(0, 8),
  };
}

export function buildOfferDealSummary(context: OfferFunnelContext) {
  return {
    schemaVersion: 1,
    source: cleanText(context.source, 80) || "direct_offer_form",
    listing: {
      id: cleanText(context.listingId, 100),
      address: cleanText(context.address, 240),
      city: cleanText(context.city, 100),
      province: cleanText(context.province, 40),
      listPrice: cleanNumber(context.price),
    },
    underwriting: {
      estimatedMonthlyRent: cleanNumber(context.estimatedMonthlyRent),
      capRate: cleanNumber(context.capRate),
      monthlyCashFlow: cleanNumber(context.monthlyCashFlow),
    },
    multiplex: {
      underwritingId: cleanText(context.underwritingId, 100),
      recommendedUnits: cleanNumber(context.recommendedUnits),
      maxLandPrice: cleanNumber(context.maxLandPrice),
      recommendedTakeout: cleanText(context.recommendedTakeout, 80),
    },
    signals: (context.signals ?? []).slice(0, 8),
  };
}
