import type { 
  RenoQuoteLineItem, 
  RenoQuoteAssumptions, 
  RenoQuotePricingResult,
  RenoQuotePersona
} from "@shared/schema";

interface BasePricing {
  unitCost: number;
  laborPercent: number;
  timelineWeeksPerUnit: number;
}

const BASE_PRICING: Record<string, BasePricing> = {
  paint: { unitCost: 3.50, laborPercent: 70, timelineWeeksPerUnit: 0.002 },
  flooring_lvp: { unitCost: 8, laborPercent: 50, timelineWeeksPerUnit: 0.003 },
  flooring_hardwood: { unitCost: 14, laborPercent: 50, timelineWeeksPerUnit: 0.004 },
  flooring_tile: { unitCost: 16, laborPercent: 60, timelineWeeksPerUnit: 0.005 },
  kitchen_refresh: { unitCost: 15000, laborPercent: 40, timelineWeeksPerUnit: 2 },
  kitchen_full: { unitCost: 45000, laborPercent: 50, timelineWeeksPerUnit: 6 },
  bathroom_refresh: { unitCost: 8000, laborPercent: 50, timelineWeeksPerUnit: 1.5 },
  bathroom_full: { unitCost: 25000, laborPercent: 55, timelineWeeksPerUnit: 3 },
  electrical_panel: { unitCost: 3500, laborPercent: 80, timelineWeeksPerUnit: 0.5 },
  electrical_roughin: { unitCost: 12, laborPercent: 85, timelineWeeksPerUnit: 0.003 },
  plumbing_roughin: { unitCost: 18, laborPercent: 85, timelineWeeksPerUnit: 0.004 },
  pot_lights: { unitCost: 250, laborPercent: 75, timelineWeeksPerUnit: 0.1 },
  windows: { unitCost: 800, laborPercent: 40, timelineWeeksPerUnit: 0.2 },
  doors: { unitCost: 450, laborPercent: 35, timelineWeeksPerUnit: 0.1 },
  roofing: { unitCost: 8, laborPercent: 55, timelineWeeksPerUnit: 0.003 },
  hvac: { unitCost: 8000, laborPercent: 70, timelineWeeksPerUnit: 1.5 },
  insulation: { unitCost: 3.50, laborPercent: 45, timelineWeeksPerUnit: 0.001 },
  drywall: { unitCost: 4.50, laborPercent: 65, timelineWeeksPerUnit: 0.002 },
  demolition: { unitCost: 5, laborPercent: 90, timelineWeeksPerUnit: 0.002 },
  dumpster: { unitCost: 600, laborPercent: 10, timelineWeeksPerUnit: 0 },
  permits: { unitCost: 1500, laborPercent: 0, timelineWeeksPerUnit: 0 },
  fire_separation: { unitCost: 8, laborPercent: 65, timelineWeeksPerUnit: 0.003 },
  egress_window: { unitCost: 6000, laborPercent: 60, timelineWeeksPerUnit: 1 },
  separate_entrance: { unitCost: 12000, laborPercent: 65, timelineWeeksPerUnit: 2 },
  electrical_split: { unitCost: 4500, laborPercent: 80, timelineWeeksPerUnit: 1 },
  sprinklers: { unitCost: 6, laborPercent: 70, timelineWeeksPerUnit: 0.003 },
  architect_engineering: { unitCost: 8000, laborPercent: 100, timelineWeeksPerUnit: 0 },
};

const QUALITY_MULTIPLIERS: Record<string, { low: number; base: number; high: number }> = {
  basic: { low: 0.7, base: 0.85, high: 1.0 },
  mid: { low: 0.9, base: 1.0, high: 1.15 },
  high: { low: 1.15, base: 1.35, high: 1.6 },
};

const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  easy: 0.85,
  standard: 1.0,
  complex: 1.25,
};

const REGIONAL_MULTIPLIERS: Record<string, Record<string, number>> = {
  canada: {
    ontario: 1.15,
    british_columbia: 1.20,
    alberta: 1.05,
    quebec: 1.0,
    manitoba: 0.95,
    saskatchewan: 0.95,
    nova_scotia: 0.90,
    new_brunswick: 0.88,
    newfoundland_and_labrador: 0.92,
    prince_edward_island: 0.88,
    northwest_territories: 1.30,
    yukon: 1.28,
    nunavut: 1.40,
    default: 1.0,
  },
  usa: {
    california: 1.35,
    new_york: 1.30,
    texas: 1.0,
    florida: 1.05,
    washington: 1.15,
    colorado: 1.10,
    massachusetts: 1.25,
    default: 1.0,
  },
};

const METRO_MULTIPLIERS: Record<string, number> = {
  toronto: 1.25,
  vancouver: 1.30,
  montreal: 1.05,
  calgary: 1.10,
  ottawa: 1.08,
  edmonton: 1.02,
  new_york: 1.40,
  los_angeles: 1.35,
  san_francisco: 1.45,
  seattle: 1.20,
  miami: 1.15,
  chicago: 1.10,
  boston: 1.25,
};

function getRegionalMultiplier(country: string, region: string, city: string): number {
  const countryData = REGIONAL_MULTIPLIERS[country.toLowerCase()] || REGIONAL_MULTIPLIERS.canada;
  const regionKey = region.toLowerCase().replace(/\s+/g, "_");
  let multiplier = countryData[regionKey] || countryData.default;
  
  const cityKey = city.toLowerCase().replace(/\s+/g, "_");
  if (METRO_MULTIPLIERS[cityKey]) {
    multiplier *= METRO_MULTIPLIERS[cityKey] / multiplier;
  }
  
  return multiplier;
}

function calculateLineItemCost(
  item: RenoQuoteLineItem,
  assumptions: RenoQuoteAssumptions
): {
  unitCostLow: number;
  unitCostBase: number;
  unitCostHigh: number;
  subtotalLow: number;
  subtotalBase: number;
  subtotalHigh: number;
  timelineContribution: number;
} {
  const basePricing = BASE_PRICING[item.itemType] || { unitCost: 100, laborPercent: 50, timelineWeeksPerUnit: 0.01 };
  const qualityMult = QUALITY_MULTIPLIERS[item.qualityLevel] || QUALITY_MULTIPLIERS.mid;
  const complexityMult = COMPLEXITY_MULTIPLIERS[item.complexity] || 1.0;
  
  let laborMult = 1.0;
  if (item.isDiy) {
    laborMult = 1 - (basePricing.laborPercent / 100) * 0.8;
  }
  
  const rushMult = assumptions.isRushTimeline ? 1.25 : 1.0;
  
  const adjustedBase = basePricing.unitCost * complexityMult * laborMult * rushMult * assumptions.regionalMultiplier;
  
  const unitCostLow = adjustedBase * qualityMult.low;
  const unitCostBase = adjustedBase * qualityMult.base;
  const unitCostHigh = adjustedBase * qualityMult.high;
  
  const subtotalLow = unitCostLow * item.quantity;
  const subtotalBase = unitCostBase * item.quantity;
  const subtotalHigh = unitCostHigh * item.quantity;
  
  const timelineContribution = basePricing.timelineWeeksPerUnit * item.quantity * (item.isDiy ? 1.5 : 1.0);
  
  return {
    unitCostLow,
    unitCostBase,
    unitCostHigh,
    subtotalLow,
    subtotalBase,
    subtotalHigh,
    timelineContribution,
  };
}

export function calculateRenoQuotePricing(
  lineItems: RenoQuoteLineItem[],
  assumptions: RenoQuoteAssumptions,
  propertyInfo: {
    country?: string;
    region?: string;
    city?: string;
    existingSqft?: number | null;
    persona?: RenoQuotePersona;
  }
): RenoQuotePricingResult {
  const regionalMultiplier = getRegionalMultiplier(
    propertyInfo.country || "canada",
    propertyInfo.region || "",
    propertyInfo.city || ""
  );
  
  const adjustedAssumptions = { ...assumptions, regionalMultiplier };
  
  let rawTotalLow = 0;
  let rawTotalBase = 0;
  let rawTotalHigh = 0;
  let totalTimelineWeeks = 0;
  
  const lineItemBreakdown = lineItems.map(item => {
    const costs = calculateLineItemCost(item, adjustedAssumptions);
    rawTotalLow += costs.subtotalLow;
    rawTotalBase += costs.subtotalBase;
    rawTotalHigh += costs.subtotalHigh;
    totalTimelineWeeks += costs.timelineContribution;
    
    return {
      id: item.id,
      label: item.label,
      quantity: item.quantity,
      unit: item.unit,
      unitCostLow: Math.round(costs.unitCostLow * 100) / 100,
      unitCostBase: Math.round(costs.unitCostBase * 100) / 100,
      unitCostHigh: Math.round(costs.unitCostHigh * 100) / 100,
      subtotalLow: Math.round(costs.subtotalLow),
      subtotalBase: Math.round(costs.subtotalBase),
      subtotalHigh: Math.round(costs.subtotalHigh),
    };
  });
  
  const contingencyLow = rawTotalLow * (assumptions.contingencyPercent / 100);
  const contingencyBase = rawTotalBase * (assumptions.contingencyPercent / 100);
  const contingencyHigh = rawTotalHigh * (assumptions.contingencyPercent / 100);
  
  const overheadLow = rawTotalLow * (assumptions.overheadProfitPercent / 100);
  const overheadBase = rawTotalBase * (assumptions.overheadProfitPercent / 100);
  const overheadHigh = rawTotalHigh * (assumptions.overheadProfitPercent / 100);
  
  const totalLow = Math.round(rawTotalLow + contingencyLow + overheadLow);
  const totalBase = Math.round(rawTotalBase + contingencyBase + overheadBase);
  const totalHigh = Math.round(rawTotalHigh + contingencyHigh + overheadHigh);
  
  const sqft = propertyInfo.existingSqft;
  const costPerSqft = {
    low: sqft ? Math.round((totalLow / sqft) * 100) / 100 : null,
    base: sqft ? Math.round((totalBase / sqft) * 100) / 100 : null,
    high: sqft ? Math.round((totalHigh / sqft) * 100) / 100 : null,
  };
  
  const baseTimeline = Math.max(2, Math.ceil(totalTimelineWeeks));
  const timelineWeeks = {
    low: Math.max(1, Math.ceil(baseTimeline * 0.8)),
    base: baseTimeline,
    high: Math.ceil(baseTimeline * 1.3),
  };
  
  const sortedItems = [...lineItemBreakdown].sort((a, b) => b.subtotalBase - a.subtotalBase);
  const topCostDrivers = sortedItems.slice(0, 5).map(item => ({
    label: item.label,
    percentage: Math.round((item.subtotalBase / rawTotalBase) * 100),
    amount: item.subtotalBase,
  }));
  
  return {
    totalLow,
    totalBase,
    totalHigh,
    costPerSqft,
    timelineWeeks,
    lineItemBreakdown,
    contingencyAmount: {
      low: Math.round(contingencyLow),
      base: Math.round(contingencyBase),
      high: Math.round(contingencyHigh),
    },
    overheadAmount: {
      low: Math.round(overheadLow),
      base: Math.round(overheadBase),
      high: Math.round(overheadHigh),
    },
    topCostDrivers,
  };
}

export const LINE_ITEM_CATALOG = [
  { itemType: "paint", label: "Paint (Interior)", unit: "sqft" as const, category: "general" },
  { itemType: "flooring_lvp", label: "Flooring - LVP", unit: "sqft" as const, category: "general" },
  { itemType: "flooring_hardwood", label: "Flooring - Hardwood", unit: "sqft" as const, category: "general" },
  { itemType: "flooring_tile", label: "Flooring - Tile", unit: "sqft" as const, category: "general" },
  { itemType: "kitchen_refresh", label: "Kitchen Refresh", unit: "each" as const, category: "general" },
  { itemType: "kitchen_full", label: "Full Kitchen Renovation", unit: "each" as const, category: "general" },
  { itemType: "bathroom_refresh", label: "Bathroom Refresh", unit: "each" as const, category: "general" },
  { itemType: "bathroom_full", label: "Full Bathroom Renovation", unit: "each" as const, category: "general" },
  { itemType: "electrical_panel", label: "Electrical Panel Upgrade", unit: "each" as const, category: "general" },
  { itemType: "electrical_roughin", label: "Electrical Rough-in", unit: "sqft" as const, category: "general" },
  { itemType: "plumbing_roughin", label: "Plumbing Rough-in", unit: "sqft" as const, category: "general" },
  { itemType: "pot_lights", label: "Pot Lights", unit: "each" as const, category: "general" },
  { itemType: "windows", label: "Windows", unit: "each" as const, category: "general" },
  { itemType: "doors", label: "Interior Doors", unit: "each" as const, category: "general" },
  { itemType: "roofing", label: "Roofing", unit: "sqft" as const, category: "general" },
  { itemType: "hvac", label: "HVAC System", unit: "each" as const, category: "general" },
  { itemType: "insulation", label: "Insulation", unit: "sqft" as const, category: "general" },
  { itemType: "drywall", label: "Drywall", unit: "sqft" as const, category: "general" },
  { itemType: "demolition", label: "Demolition", unit: "sqft" as const, category: "general" },
  { itemType: "dumpster", label: "Dumpster/Waste Removal", unit: "each" as const, category: "general" },
  { itemType: "permits", label: "Permits", unit: "each" as const, category: "general" },
  { itemType: "fire_separation", label: "Fire Separation/Soundproofing", unit: "sqft" as const, category: "investor" },
  { itemType: "egress_window", label: "Egress Window", unit: "each" as const, category: "investor" },
  { itemType: "separate_entrance", label: "Separate Entrance", unit: "each" as const, category: "investor" },
  { itemType: "electrical_split", label: "Electrical Meter Split", unit: "each" as const, category: "investor" },
  { itemType: "sprinklers", label: "Sprinkler System", unit: "sqft" as const, category: "multiplex" },
  { itemType: "architect_engineering", label: "Architect/Engineering", unit: "each" as const, category: "investor" },
];

export function getLineItemCatalog(persona: RenoQuotePersona) {
  if (persona === "homeowner") {
    return LINE_ITEM_CATALOG.filter(item => item.category === "general");
  }
  if (persona === "investor") {
    return LINE_ITEM_CATALOG.filter(item => item.category === "general" || item.category === "investor");
  }
  return LINE_ITEM_CATALOG;
}
