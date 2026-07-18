import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { AskRealistPanel } from "@/components/AskRealistPanel";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  TrendingUp, Search, Building, BedDouble, Bath, Maximize,
  ChevronRight, ChevronLeft,
  Calculator, X, Loader2, ArrowRight, Map, LayoutGrid,
  RefreshCw, ChevronDown, ChevronUp, List, Users, MessageSquare,
  Send, PenLine, Sparkles,
  Star, Target, AlertTriangle, Gavel, DollarSign, TrendingDown,
  ExternalLink,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePersistedTab } from "@/hooks/use-persisted-tab";
import {
  getRecentViewedListingSignals,
  getSavedSearchSignals,
  getSavedListingSignals,
  persistRecentViewedListingSignal,
  persistSavedSearchSignal,
  persistSavedListingSignal,
  syncDiscoverySignalsWithAccount,
  track,
  type SavedSearchSignal,
  type SavedListingSignal,
} from "@/lib/analytics";
import { getCmhcRent } from "@shared/cmhcRents";
import { MiniDealAnalyzer } from "@/components/MiniDealAnalyzer";
import { WatchListingButton } from "@/components/WatchListingButton";
import { ReplacementCostEstimate } from "@/components/ReplacementCostEstimate";
import type { ListingAnalysisAggregate } from "@shared/schema";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapLayersPanel, DEFAULT_LAYERS, type MapLayer } from "@/components/MapLayersPanel";
import { NextStepBlock } from "@/components/NextStepBlock";
import { NeighbourhoodOverlay } from "@/components/NeighbourhoodOverlay";
import { CommunityAnalysisBadge } from "@/components/CommunityAnalysisBadge";
import { AnalysisVisibilityToggle } from "@/components/AnalysisVisibilityToggle";
import { AnalysisConsentNotice, type AnalysisConsentState } from "@/components/AnalysisConsentNotice";
import { CommunityMetricsSummary } from "@/components/CommunityMetricsSummary";
import { CommunityAnalysisModal } from "@/components/CommunityAnalysisModal";
import { ListingCommentsSection } from "@/components/ListingCommentsSection";
import { ListingEngagementStrip } from "@/components/ListingEngagementStats";
import { ListingCommentCountBadge } from "@/components/ListingCommentCountBadge";
import { PropertyQuestionWidget } from "@/components/PropertyQuestionWidget";
import { PropertyQuestionsPanel } from "@/components/PropertyQuestionsPanel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Home from "@/pages/Home";
import {
  calculateInvestmentMetrics,
  INVESTMENT_METRIC_FLAGS,
  metricLabel,
  type CalculatedInvestmentMetrics,
  type InvestmentMetricKey,
  type InvestmentMetricSource,
  type MetricConfidence,
  type ConsensusLabel,
} from "@shared/investmentMetrics";
import { type DistressResult } from "@shared/distressScoring";
import { isVacantLandLikeProperty } from "@shared/propertyEligibility";
import { authPath } from "@/lib/authReturn";
import { detectPossiblePlex } from "@shared/plexDetection";

interface RepliersListing {
  mlsNumber: string;
  listPrice: number | string;
  address: {
    area?: string;
    city?: string;
    country?: string;
    neighborhood?: string;
    streetDirection?: string;
    streetName?: string;
    streetNumber?: string;
    streetSuffix?: string;
    unitNumber?: string;
    zip?: string;
    state?: string;
    streetDirectionPrefix?: string;
  };
  map?: {
    latitude: number;
    longitude: number;
  };
  details?: {
    numBedrooms?: number;
    numBathroomsPlus?: number;
    numBathrooms?: number;
    sqft?: string;
    propertyType?: string;
    style?: string;
    yearBuilt?: string;
    description?: string;
    numGarageSpaces?: number;
    numParkingSpaces?: number;
    basement1?: string;
    extras?: string;
  };
  type?: string;
  class?: string;
  status?: string;
  images?: string[];
  lastStatus?: string;
  listDate?: string;
  daysOnMarket?: string | number;
  taxes?: {
    annualAmount?: number;
  };
}

interface ListingWithCapRate extends RepliersListing {
  grossYield: number | null;
  capRate: number;
  cashOnCashReturn: number | null;
  irr: number | null;
  monthlyCashFlow: number | null;
  dscr: number | null;
  estimatedMonthlyRent: number;
  annualNOI: number;
  annualOperatingExpenses: number | null;
  expenseRatio: number | null;
  metricConfidence: MetricConfidence;
  irrConfidence: MetricConfidence;
  assumptionsComplete: boolean;
  calculationWarnings: string[];
  assumptionsUsed: CalculatedInvestmentMetrics["assumptionsUsed"];
  rentSource: "market" | "estimated" | "actual" | "cmhc_city" | "cmhc_province";
  totalActualRent?: number;
  numberOfUnitsTotal?: number;
  kitchenCount?: number;
  plexConfidenceScore?: number;
  plexDetectionReason?: string;
  unitCount: number;
  dataSource?: "crea_ddf" | "repliers";
}

interface MultiplexListingScan {
  label: string;
  status: "likely" | "possible" | "underwrite";
  confidence: number;
  summary: string;
  evidence: string[];
  sourceNote: string;
  href: string;
}

interface RentPulseData {
  city: string;
  province: string;
  bedrooms: string;
  medianRent: number;
  averageRent?: number;
  sampleSize: number;
}

interface DistressListing {
  mlsNumber: string;
  listPrice: number;
  address: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    unitNumber?: string;
    city?: string;
    state?: string;
    zip?: string;
    neighborhood?: string;
  };
  map?: {
    latitude: number;
    longitude: number;
  };
  details?: {
    numBedrooms?: number;
    numBathrooms?: number;
    sqft?: string;
    propertyType?: string;
    yearBuilt?: string;
    description?: string;
  };
  images?: string[];
  daysOnMarket?: number;
  listDate?: string;
  distress: DistressResult;
  rawRemarks: string;
}

interface UsMapListing {
  id: string;
  source: string;
  sourceId: string;
  formattedAddress: string;
  sourceUrl?: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  listPrice?: number | null;
  daysOnMarket?: number | null;
  status?: string | null;
  isActive?: boolean;
  statusConfidence?: string | null;
  lastSeenAt?: string | null;
}

const MAP_WORKSPACE_STATE_KEY = "realist_cap_rates_workspace_state";

let markerClusterLoadPromise: Promise<void> | null = null;

function loadLeafletMarkerCluster(): Promise<void> {
  if ((L as any).markerClusterGroup) return Promise.resolve();

  (globalThis as any).L = L;
  markerClusterLoadPromise ??= import("leaflet.markercluster").then(() => undefined);
  return markerClusterLoadPromise;
}

interface MapWorkspaceState {
  selectedMls?: string;
  analyzerOpen?: boolean;
  analyzerSeedQuery?: string;
  analyzerTitle?: string;
  analyzerSubtitle?: string;
  savedAt?: number;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const EXPENSE_ASSUMPTIONS = {
  vacancyPercent: 5,
  maintenancePercent: 5,
  managementPercent: 8,
  insurancePerUnit: 100,
  propertyTaxPercent: 1.0,
};

const TORONTO_CENTER: [number, number] = [43.65, -79.38];
const DEFAULT_ZOOM = 11;

function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "$0";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPriceFull(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "$0";
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAddress(addr: RepliersListing["address"]): string {
  if (!addr) return "Unknown";
  const parts = [
    addr.streetNumber,
    addr.streetDirectionPrefix,
    addr.streetName,
    addr.streetSuffix,
    addr.streetDirection,
  ].filter(Boolean);
  const street = parts.join(" ");
  const unit = addr.unitNumber ? `#${addr.unitNumber}` : "";
  const cityState = [addr.city, addr.state || addr.zip].filter(Boolean).join(", ");
  return [street, unit, cityState].filter(Boolean).join(", ") || "Unknown";
}

function formatShortAddress(addr: RepliersListing["address"]): string {
  if (!addr) return "Unknown";
  const parts = [
    addr.streetNumber,
    addr.streetName,
    addr.streetSuffix,
  ].filter(Boolean);
  return parts.join(" ") || "Unknown";
}

function getImageUrl(images: string[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const img = images.find(i => i.startsWith("http") && !i.includes("youriguide") && !i.includes("virtualtour"));
  if (!img) {
    const first = images[0];
    if (first.startsWith("http")) return first;
    return `https://cdn.repliers.io/${first}`;
  }
  return img;
}

function getCapRateColor(rate: number): string {
  if (rate >= 8) return "text-green-600 dark:text-green-400";
  if (rate >= 6) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 4) return "text-yellow-600 dark:text-yellow-400";
  if (rate >= 2) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getCapRateBadgeVariant(rate: number): "default" | "secondary" | "outline" {
  if (rate >= 6) return "default";
  if (rate >= 4) return "secondary";
  return "outline";
}

function getCapRateMarkerColor(rate: number): string {
  if (rate >= 8) return "#16a34a";
  if (rate >= 6) return "#059669";
  if (rate >= 4) return "#ca8a04";
  if (rate >= 2) return "#ea580c";
  return "#dc2626";
}

function getCashFlowMarkerColor(value: number): string {
  if (value >= 500) return "#16a34a";
  if (value >= 0) return "#059669";
  if (value >= -250) return "#ca8a04";
  return "#dc2626";
}

function getDscrMarkerColor(value: number): string {
  if (value >= 1.35) return "#16a34a";
  if (value >= 1.2) return "#059669";
  if (value >= 1) return "#ca8a04";
  return "#dc2626";
}

function getConsensusMarkerColor(value?: string | null): string {
  if (value === "bullish") return "#16a34a";
  if (value === "neutral") return "#ca8a04";
  if (value === "bearish") return "#dc2626";
  return "#4b5563";
}

function formatCompactCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatPrice(Math.abs(value))}/mo`;
}

function getMetricConfidenceTone(confidence: MetricConfidence | null | undefined): string {
  if (confidence === "high") return "text-green-600";
  if (confidence === "medium") return "text-amber-600";
  return "text-muted-foreground";
}

function metricShortLabel(metric: InvestmentMetricKey): string {
  switch (metric) {
    case "gross_yield":
      return "yield";
    case "cap_rate":
      return "cap";
    case "cash_on_cash":
      return "CoC";
    case "dscr":
      return "DSCR";
    case "irr":
      return "IRR";
    case "monthly_cash_flow":
      return "CF";
    case "community_consensus":
      return "community";
    default:
      return "price";
  }
}

function formatMetricValue(metric: InvestmentMetricKey, value: number | null | undefined, consensusLabel?: string | null, analysisCount?: number | null): string {
  if (metric === "community_consensus") {
    if (consensusLabel) return consensusLabel[0].toUpperCase() + consensusLabel.slice(1);
    if (analysisCount && analysisCount > 0) return `${analysisCount} analyses`;
    return "No data";
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  if (metric === "price") return formatPrice(value);
  if (metric === "monthly_cash_flow") return formatCompactCurrency(value);
  if (metric === "dscr") return value.toFixed(2);
  return `${value.toFixed(1)}%`;
}

function getMetricMarkerColor(metric: InvestmentMetricKey, numericValue: number | null | undefined, consensusLabel?: string | null): string {
  if (metric === "monthly_cash_flow") return getCashFlowMarkerColor(numericValue || 0);
  if (metric === "dscr") return getDscrMarkerColor(numericValue || 0);
  if (metric === "community_consensus") return getConsensusMarkerColor(consensusLabel);
  if (metric === "price") return "#2563eb";
  return getCapRateMarkerColor(numericValue || 0);
}

function clusterMetricSummaryLabel(metric: InvestmentMetricKey, count: number): string {
  if (metric === "community_consensus") return `community · ${count}`;
  if (metric === "price") return `avg · ${count}`;
  return `${metricShortLabel(metric)} avg · ${count}`;
}

function getAggregateMetricValue(aggregate: ListingAnalysisAggregate | null | undefined, metric: InvestmentMetricKey): number | null {
  if (!aggregate) return null;
  switch (metric) {
    case "cap_rate":
      return aggregate.medianCapRate ?? null;
    case "cash_on_cash":
      return aggregate.medianCashOnCash ?? null;
    case "dscr":
      return typeof (aggregate as any).medianDscr === "number" ? (aggregate as any).medianDscr : null;
    case "monthly_cash_flow":
      return aggregate.medianMonthlyCashFlow ?? null;
    default:
      return null;
  }
}

function getListingMetricValue(
  listing: ListingWithCapRate,
  metric: InvestmentMetricKey,
  aggregate?: ListingAnalysisAggregate | null,
  source: InvestmentMetricSource = "realist_estimate",
  myMetrics?: Record<string, any> | null,
): number | null {
  if (source === "community_median") {
    return getAggregateMetricValue(aggregate, metric);
  }
  if (source === "my_saved_analyses") {
    switch (metric) {
      case "cap_rate":
        return typeof myMetrics?.medianCapRate === "number" ? myMetrics.medianCapRate : null;
      case "cash_on_cash":
        return typeof myMetrics?.medianCashOnCash === "number" ? myMetrics.medianCashOnCash : null;
      case "dscr":
        return typeof myMetrics?.medianDscr === "number" ? myMetrics.medianDscr : null;
      case "monthly_cash_flow":
        return typeof myMetrics?.medianMonthlyCashFlow === "number" ? myMetrics.medianMonthlyCashFlow : null;
      case "irr":
        return typeof myMetrics?.medianIrr === "number" ? myMetrics.medianIrr : null;
      default:
        return null;
    }
  }

  switch (metric) {
    case "price":
      return typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
    case "gross_yield":
      return listing.grossYield;
    case "cap_rate":
      return listing.capRate;
    case "cash_on_cash":
      return listing.cashOnCashReturn;
    case "dscr":
      return listing.dscr;
    case "irr":
      return listing.irr;
    case "monthly_cash_flow":
      return listing.monthlyCashFlow;
    default:
      return null;
  }
}

function getMetricPrimaryConfidence(
  listing: ListingWithCapRate,
  metric: InvestmentMetricKey,
): MetricConfidence | null {
  if (metric === "irr") return listing.irrConfidence;
  if (metric === "gross_yield" || metric === "cap_rate") return listing.metricConfidence;
  return null;
}

function buildListingSignal(listing: RepliersListing & {
  capRate?: number;
  estimatedMonthlyRent?: number;
  unitCount?: number;
}, source: string): SavedListingSignal {
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  return {
    id: listing.mlsNumber || `${formatShortAddress(listing.address)}-${source}`,
    createdAt: new Date().toISOString(),
    label: formatShortAddress(listing.address),
    listingId: listing.mlsNumber || undefined,
    address: formatAddress(listing.address),
    city: listing.address?.city || undefined,
    propertyType: listing.details?.propertyType || listing.type || undefined,
    price: Number.isFinite(price) ? price : undefined,
    capRate: typeof listing.capRate === "number" ? listing.capRate : undefined,
    source,
  };
}

function buildListingQuestionSnapshot(listing: ListingWithCapRate): Record<string, unknown> {
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  return {
    address: formatAddress(listing.address),
    shortAddress: formatShortAddress(listing.address),
    city: listing.address?.city,
    province: listing.address?.state,
    neighbourhood: listing.address?.neighborhood,
    price: Number.isFinite(price) ? price : undefined,
    beds: listing.details?.numBedrooms,
    baths: listing.details?.numBathrooms,
    sqft: listing.details?.sqft,
    propertyType: listing.details?.propertyType || listing.type,
    unitCount: listing.unitCount,
    capRate: listing.capRate,
    grossYield: listing.grossYield,
    monthlyCashFlow: listing.monthlyCashFlow,
    estimatedMonthlyRent: listing.estimatedMonthlyRent,
    latitude: listing.map?.latitude,
    longitude: listing.map?.longitude,
    sourcePage: "/tools/cap-rates",
  };
}

function buildDistressQuestionSnapshot(listing: DistressListing): Record<string, unknown> {
  return {
    address: formatAddress(listing.address as RepliersListing["address"]),
    shortAddress: formatShortAddress(listing.address as RepliersListing["address"]),
    city: listing.address?.city,
    province: listing.address?.state,
    neighbourhood: listing.address?.neighborhood,
    price: listing.listPrice,
    beds: listing.details?.numBedrooms,
    baths: listing.details?.numBathrooms,
    sqft: listing.details?.sqft,
    propertyType: listing.details?.propertyType,
    latitude: listing.map?.latitude,
    longitude: listing.map?.longitude,
    sourcePage: "/tools/cap-rates",
    distressScore: listing.distress.distressScore,
    distressConfidence: listing.distress.confidence,
    distressCategories: listing.distress.categoriesTriggered,
    matchedDistressTerms: listing.distress.matchedTerms.slice(0, 8).map((term) => term.term),
  };
}

function parseSqft(value?: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildMultiplexUnderwriterHref(listing: ListingWithCapRate): string {
  const params = new URLSearchParams();
  const address = formatAddress(listing.address);
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;

  params.set("address", address);
  if (Number.isFinite(price) && price > 0) params.set("price", String(Math.round(price)));
  if (listing.mlsNumber) params.set("mls", listing.mlsNumber);
  if (listing.address?.city) params.set("city", listing.address.city);
  if (listing.address?.state) params.set("state", listing.address.state);
  if (listing.details?.numBedrooms) params.set("beds", String(listing.details.numBedrooms));
  if (listing.details?.numBathrooms) params.set("baths", String(listing.details.numBathrooms));
  if (listing.details?.sqft) params.set("sqft", listing.details.sqft);

  return `/tools/multiplex-underwriter?${params.toString()}`;
}

function buildMultiplexListingScan(listing: ListingWithCapRate): MultiplexListingScan {
  const evidence: string[] = [];
  let confidence = 0;
  const propertyType = [
    listing.details?.propertyType,
    listing.details?.style,
    listing.type,
    listing.class,
  ].filter(Boolean).join(" ").toLowerCase();
  const city = listing.address?.city?.trim();
  const province = listing.address?.state?.trim();
  const sqft = parseSqft(listing.details?.sqft);

  if (listing.unitCount >= 3) {
    confidence += 45;
    evidence.push(`${listing.unitCount} units from listing/plex detection`);
  } else if (listing.unitCount === 2) {
    confidence += 28;
    evidence.push("2-unit setup detected");
  }

  if ((listing.kitchenCount || 0) > 1) {
    confidence += 18;
    evidence.push(`${listing.kitchenCount} kitchens detected`);
  }

  if ((listing.plexConfidenceScore || 0) >= 60) {
    confidence += 22;
    evidence.push(listing.plexDetectionReason || "strong plex signal in remarks");
  } else if ((listing.plexConfidenceScore || 0) >= 30) {
    confidence += 12;
    evidence.push(listing.plexDetectionReason || "possible plex signal in remarks");
  }

  if (/\b(duplex|triplex|fourplex|4plex|multiplex|multi[-\s]?family)\b/.test(propertyType)) {
    confidence += 18;
    evidence.push("plex property type/style");
  } else if (/\b(detached|semi|single family|residential)\b/.test(propertyType)) {
    confidence += 8;
    evidence.push("ground-oriented residential form");
  } else if (/\b(condo|apartment)\b/.test(propertyType)) {
    confidence -= 25;
    evidence.push("condo/apartment form needs extra caution");
  }

  if (sqft && sqft >= 2200) {
    confidence += 7;
    evidence.push(`${sqft.toLocaleString()} sqft reported`);
  }

  if (city && province) {
    confidence += 5;
    evidence.push(`${city}, ${province} listing`);
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const status: MultiplexListingScan["status"] =
    confidence >= 70 ? "likely" : confidence >= 40 ? "possible" : "underwrite";
  const label =
    status === "likely"
      ? "Multiplex scan: strong candidate"
      : status === "possible"
        ? "Multiplex scan: possible candidate"
        : "Multiplex scan: needs address underwrite";
  const summary =
    status === "likely"
      ? "Pre-screen flags this as worth a full multiplex build/hold/condo-exit run."
      : status === "possible"
        ? "Listing facts suggest enough signal to open the underwriter before dismissing it."
        : "No strong plex signal from listing facts. Run the address-first underwriter for zoning, tree/ravine, and takeout math.";

  return {
    label,
    status,
    confidence,
    summary,
    evidence: evidence.slice(0, 3),
    sourceNote: "Pre-screened from listing fields only. Full underwriter resolves zoning/by-law, tree/ravine screens, build configs, and CMHC MLI Select vs condo exit math.",
    href: buildMultiplexUnderwriterHref(listing),
  };
}

function createMetricMarkerIcon(input: {
  metric: InvestmentMetricKey;
  numericValue: number | null;
  label: string;
  isSelected: boolean;
  aggregate?: ListingAnalysisAggregate | null;
  consensusLabel?: string | null;
  isDistress?: boolean;
}): L.DivIcon {
  const color = getMetricMarkerColor(input.metric, input.numericValue, input.consensusLabel);
  const size = input.isSelected ? 46 : 38;
  const fontSize = input.isSelected ? 12 : 10;
  const border = input.isSelected ? "3px solid #2563eb" : "2px solid white";
  const shadow = input.isSelected ? "0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.3)";
  const zIndex = input.isSelected ? 1000 : 1;
  const communityCount = (input.aggregate?.publicAnalysisCount || 0) + (input.aggregate?.publicCommentCount || 0);
  const badgeHtml = communityCount > 0
    ? `<div style="
        position:absolute;
        right:-8px;
        bottom:-6px;
        min-width:18px;
        height:18px;
        padding:0 4px;
        border-radius:999px;
        background:#111827;
        color:white;
        font-size:10px;
        font-weight:800;
        display:flex;
        align-items:center;
        justify-content:center;
        border:2px solid white;
      ">${communityCount}</div>`
    : "";
  const distressRing = input.isDistress
    ? `<div style="
        position:absolute;
        inset:-4px;
        border-radius:999px;
        border:2px solid #dc2626;
        box-shadow:0 0 0 1px rgba(255,255,255,0.95);
      "></div>
      <div style="
        position:absolute;
        left:-6px;
        top:-6px;
        min-width:18px;
        height:18px;
        padding:0 4px;
        border-radius:999px;
        background:#dc2626;
        color:white;
        font-size:10px;
        font-weight:900;
        display:flex;
        align-items:center;
        justify-content:center;
        border:2px solid white;
      ">M</div>`
    : "";

  return L.divIcon({
    className: "cap-rate-marker",
    html: `<div style="position:relative"><div style="
      background: ${color};
      color: white;
      font-weight: 700;
      font-size: ${fontSize}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: ${border};
      box-shadow: ${shadow};
      z-index: ${zIndex};
      cursor: pointer;
      transition: transform 0.15s ease;
      line-height: 1;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 0 3px;
      text-align: center;
    ">${input.label}</div>${badgeHtml}${distressRing}</div>`,
    iconSize: [size + 10, size + 10],
    iconAnchor: [size / 2, size / 2],
  });
}

function createUsListingMarkerIcon(listing: UsMapListing, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 46 : 38;
  const priceLabel = listing.listPrice ? formatPrice(listing.listPrice) : "US";
  return L.divIcon({
    className: "us-listing-marker",
    html: `<div style="
      position:relative;
      width:${size}px;
      height:${size}px;
      border-radius:999px;
      background:#1d4ed8;
      border:${isSelected ? "3px solid #f8fafc" : "2px solid white"};
      box-shadow:${isSelected ? "0 0 0 2px #1d4ed8, 0 8px 18px rgba(15,23,42,0.28)" : "0 2px 8px rgba(15,23,42,0.24)"};
      color:white;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      font-family:system-ui,-apple-system,sans-serif;
      line-height:1;
      cursor:pointer;
    ">
      <span style="font-size:8px;font-weight:900;letter-spacing:0;">US</span>
      <span style="font-size:${isSelected ? 11 : 9}px;font-weight:900;margin-top:2px;">${escapeHtml(priceLabel)}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function getDistressSignalLabel(distress: DistressResult): string {
  if (distress.categoriesTriggered.foreclosure_pos) return "POS";
  if (distress.categoriesTriggered.vtb) return "VTB";
  if (distress.categoriesTriggered.motivated) return "MOT";
  return "DEAL";
}

function createDistressMarkerIcon(distress: DistressResult, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 44 : 38;
  const border = isSelected ? "3px solid #2563eb" : "2px solid white";
  const shadow = isSelected ? "0 0 0 2px #2563eb, 0 2px 10px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.3)";
  const score = distress.distressScore;
  const background = score >= 70 ? "#b91c1c" : score >= 40 ? "#ea580c" : "#d97706";
  const label = getDistressSignalLabel(distress);
  return L.divIcon({
    className: "distress-map-marker",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:999px 999px 999px 8px;
      background:${background};
      border:${border};
      box-shadow:${shadow};
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-family:system-ui,-apple-system,sans-serif;
      font-weight:900;
      font-size:${label.length > 3 ? 9 : isSelected ? 13 : 11}px;
      transform:rotate(45deg);
    "><span style="transform:rotate(-45deg)">${label}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type DealCategory = "power_of_sale" | "motivated" | "vtb";

const DEAL_CATEGORY_CONFIG: Array<{ id: DealCategory; label: string; description: string }> = [
  { id: "power_of_sale", label: "Power of Sale", description: "POS, foreclosure, bank-owned, court ordered" },
  { id: "motivated", label: "Motivated Seller", description: "Motivated, as-is, reduced, seller says sell" },
  { id: "vtb", label: "Vendor Take-Back", description: "Seller financing / VTB language" },
];

const DEAL_CATEGORY_URL_VALUES = new Set<DealCategory>(DEAL_CATEGORY_CONFIG.map((category) => category.id));

function parseDealCategoriesFromParams(params: URLSearchParams): DealCategory[] {
  const raw = params.get("deals") || params.get("dealCategories") || "";
  const normalized = raw
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/-/g, "_"))
    .map((value) => value === "pos" || value === "foreclosure" || value === "foreclosure_pos" ? "power_of_sale" : value)
    .filter((value): value is DealCategory => DEAL_CATEGORY_URL_VALUES.has(value as DealCategory));
  return Array.from(new Set(normalized));
}

function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function categoryMatchesDistress(listing: DistressListing, category: DealCategory): boolean {
  if (category === "power_of_sale") return Boolean(listing.distress?.categoriesTriggered?.foreclosure_pos);
  if (category === "motivated") return Boolean(listing.distress?.categoriesTriggered?.motivated);
  if (category === "vtb") return Boolean(listing.distress?.categoriesTriggered?.vtb);
  return false;
}

function matchesDealCategories(listing: DistressListing, categories: DealCategory[]): boolean {
  if (categories.length === 0) return true;
  return categories.some((category) => categoryMatchesDistress(listing, category));
}

interface FindDealsResult {
  id: string;
  mlsNumber: string;
  lat: number;
  lng: number;
  price: number;
  cap_rate: number;
  cash_on_cash: number;
  deal_score: number;
  final_score: number;
  explanation: string;
  address: RepliersListing["address"];
  details: RepliersListing["details"];
  images?: string[];
  daysOnMarket: number;
  monthlyRent: number;
  rentSource: string;
  listPrice: number | string;
  taxes?: RepliersListing["taxes"];
  numberOfUnitsTotal: number;
}

interface FindDealsResponse {
  listings: FindDealsResult[];
  bounds: { north: number; south: number; east: number; west: number; center: { lat: number; lng: number } } | null;
  filters_applied: Record<string, any>;
  total: number;
  query: string;
}

function getDealScoreColor(score: number): string {
  if (score >= 80) return "#f59e0b";
  if (score >= 65) return "#3b82f6";
  return "#6b7280";
}

function getDealScoreLabel(score: number): string {
  if (score >= 80) return "Top Deal";
  if (score >= 65) return "Good Deal";
  return "Fair";
}

function createDealScoreIcon(score: number, isSelected: boolean): L.DivIcon {
  const color = getDealScoreColor(score);
  const size = isSelected ? 48 : 40;
  const fontSize = isSelected ? 12 : 10;
  const border = isSelected ? "3px solid #2563eb" : "2px solid white";
  const shadow = isSelected ? "0 0 0 2px #2563eb, 0 2px 12px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.3)";

  return L.divIcon({
    className: "deal-score-marker",
    html: `<div style="
      background: ${color};
      color: white;
      font-weight: 700;
      font-size: ${fontSize}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: ${border};
      box-shadow: ${shadow};
      cursor: pointer;
      transition: transform 0.15s ease;
      line-height: 1;
      font-family: system-ui, -apple-system, sans-serif;
    ">${score}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function estimateMonthlyRent(
  bedrooms: number,
  city: string | undefined,
  country: string | undefined,
  rentData: RentPulseData[],
  province?: string
): { rent: number; source: "market" | "estimated" | "cmhc_city" | "cmhc_province" } {
  const bedroomStr = String(Math.max(1, bedrooms || 2));

  if (rentData.length > 0 && city) {
    const match = rentData.find(
      (r) => r.city.toLowerCase() === city.toLowerCase() && r.bedrooms === bedroomStr
    );
    if (match) {
      return { rent: match.medianRent, source: "market" };
    }
  }

  const cmhc = getCmhcRent(bedrooms, city, province, country);
  if (cmhc.source === "cmhc_city") return { rent: cmhc.rent, source: "cmhc_city" };
  if (cmhc.source === "cmhc_province") return { rent: cmhc.rent, source: "cmhc_province" };

  return { rent: cmhc.rent, source: "estimated" };
}

function MapEventHandler({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: MapBounds) => void;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedInitial = useRef(false);

  // Report the initial viewport so the map never opens empty — pins should
  // show on first paint (Zillow/Redfin behaviour), not only after a pan.
  const mountedMap = useMap();
  useEffect(() => {
    if (reportedInitial.current) return;
    reportedInitial.current = true;
    const b = mountedMap.getBounds();
    onBoundsChange({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, [mountedMap, onBoundsChange]);

  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const b = map.getBounds();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, 600);
    },
    zoomend: (e) => {
      const map = e.target;
      const b = map.getBounds();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, 600);
    },
  });

  return null;
}

function FlyToLocation({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 1.2 });
  }, [lat, lng, zoom, map]);
  return null;
}

function createClusterIcon(label: string, count: number, metric: InvestmentMetricKey, numericValue: number | null, consensusLabel?: string | null): L.DivIcon {
  const color = getMetricMarkerColor(metric, numericValue, consensusLabel);
  const width = count > 75 ? 78 : count > 24 ? 72 : 66;
  const height = count > 75 ? 52 : count > 24 ? 48 : 44;
  const metaLabel = clusterMetricSummaryLabel(metric, count);

  return L.divIcon({
    className: "yield-cluster-marker",
    html: `<div style="
      width:${width}px;
      height:${height}px;
      border-radius:999px;
      background:${color};
      border:3px solid rgba(255,255,255,0.95);
      box-shadow:0 6px 18px rgba(15,23,42,0.24);
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      color:white;
      font-family:system-ui,-apple-system,sans-serif;
      line-height:1.05;
    ">
      <span style="font-size:${count > 75 ? 13 : 12}px;font-weight:800;">${label}</span>
      <span style="font-size:${count > 75 ? 9 : 8}px;font-weight:800;opacity:0.95;white-space:nowrap;">${metaLabel}</span>
    </div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

function zoomToClusterBounds(map: L.Map, clusterLayer: any, maxZoom: number) {
  const bounds = clusterLayer.getBounds?.();
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding: [48, 48], maxZoom });
    return;
  }

  const latLng = clusterLayer.getLatLng?.();
  if (latLng) {
    map.setView(latLng, Math.min(map.getZoom() + 2, maxZoom));
  }
}

function ClusteredListingsLayer({
  listings,
  onSelectListing,
  aggregatesMap,
  metric,
  metricSource,
  myMetricsMap,
  distressMap,
}: {
  listings: ListingWithCapRate[];
  onSelectListing: (listing: ListingWithCapRate, source?: "map" | "list") => void;
  aggregatesMap: Record<string, ListingAnalysisAggregate>;
  metric: InvestmentMetricKey;
  metricSource: InvestmentMetricSource;
  myMetricsMap: Record<string, any>;
  distressMap: Record<string, DistressListing>;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    void loadLeafletMarkerCluster().then(() => {
      if (cancelled) return;

      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }

      const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 70,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      chunkedLoading: true,
      disableClusteringAtZoom: 14,
      animate: false,
      iconCreateFunction: (clusterGroup: any) => {
        const children = clusterGroup.getAllChildMarkers() as Array<L.Marker & { options: { metricValue?: number; consensusLabel?: string } }>;
        const values = children
          .map((child) => child.options.metricValue)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const avgValue = values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;
        const consensusCounts = children.reduce<Record<string, number>>((acc, child) => {
          if (child.options.consensusLabel) acc[child.options.consensusLabel] = (acc[child.options.consensusLabel] || 0) + 1;
          return acc;
        }, {});
        const dominantConsensus = Object.entries(consensusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        return createClusterIcon(
          formatMetricValue(metric, values.length ? avgValue : null, dominantConsensus, clusterGroup.getChildCount()),
          clusterGroup.getChildCount(),
          metric,
          values.length ? avgValue : null,
          dominantConsensus,
        );
      },
      });

      cluster.on("clusterclick", (event: any) => {
        zoomToClusterBounds(map, event.layer, 14);
      });

      for (const listing of listings) {
        if (!listing.map?.latitude || !listing.map?.longitude) continue;
        const aggregate = aggregatesMap[listing.mlsNumber];
        const metricValue = getListingMetricValue(listing, metric, aggregate, metricSource, myMetricsMap[listing.mlsNumber]);
        const consensusLabel = aggregate?.consensusLabel || null;
        const marker = L.marker(
          [listing.map.latitude, listing.map.longitude],
          {
            icon: createMetricMarkerIcon({
              metric,
              numericValue: metricValue,
              label: formatMetricValue(metric, metricValue, consensusLabel, aggregate?.publicAnalysisCount),
              isSelected: false,
              aggregate,
              consensusLabel,
              isDistress: Boolean(distressMap[listing.mlsNumber]),
            }),
            metricValue: metricValue ?? undefined,
            consensusLabel: consensusLabel ?? undefined,
          } as L.MarkerOptions & { metricValue?: number; consensusLabel?: string },
        );
        marker.on("click", () => onSelectListing(listing, "map"));
        cluster.addLayer(marker);
      }

      if (cancelled) {
        map.removeLayer(cluster);
        return;
      }

      map.addLayer(cluster);
      clusterRef.current = cluster;
    });

    return () => {
      cancelled = true;
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
      clusterRef.current = null;
    };
  }, [aggregatesMap, distressMap, listings, map, metric, metricSource, myMetricsMap, onSelectListing]);

  return null;
}

function DistressListingsLayer({
  listings,
  selectedMlsNumber,
  onSelectListing,
}: {
  listings: DistressListing[];
  selectedMlsNumber?: string | null;
  onSelectListing: (listing: DistressListing) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    void loadLeafletMarkerCluster().then(() => {
      if (cancelled) return;

      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }

      const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 65,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      chunkedLoading: true,
      disableClusteringAtZoom: 14,
      iconCreateFunction: (clusterGroup: any) => {
        const children = clusterGroup.getAllChildMarkers() as Array<L.Marker & { options: { distressScore?: number } }>;
        const scores = children.map((child) => child.options.distressScore).filter((v): v is number => typeof v === "number");
        const avgScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
        const background = avgScore >= 70 ? "#b91c1c" : avgScore >= 40 ? "#ea580c" : "#d97706";
        const size = clusterGroup.getChildCount() > 24 ? 48 : 40;
        return L.divIcon({
          className: "distress-cluster-marker",
          html: `<div style="
            width:${size}px;
            height:${size}px;
            border-radius:999px;
            background:${background};
            border:3px solid rgba(255,255,255,0.95);
            box-shadow:0 6px 18px rgba(15,23,42,0.24);
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            color:white;
            font-family:system-ui,-apple-system,sans-serif;
            line-height:1.05;
          ">
            <span style="font-size:11px;font-weight:900;">M</span>
            <span style="font-size:10px;font-weight:700;opacity:0.92;">${clusterGroup.getChildCount()}</span>
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
      });

      cluster.on("clusterclick", (event: any) => {
        zoomToClusterBounds(map, event.layer, 14);
      });

      for (const listing of listings) {
        if (!listing.map?.latitude || !listing.map?.longitude) continue;
        const marker = L.marker(
          [listing.map.latitude, listing.map.longitude],
          {
            icon: createDistressMarkerIcon(listing.distress, selectedMlsNumber === listing.mlsNumber),
            distressScore: listing.distress.distressScore,
          } as L.MarkerOptions & { distressScore?: number },
        );
        marker.on("click", () => onSelectListing(listing));
        cluster.addLayer(marker);
      }

      if (cancelled) {
        map.removeLayer(cluster);
        return;
      }

      map.addLayer(cluster);
      clusterRef.current = cluster;
    });

    return () => {
      cancelled = true;
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
      clusterRef.current = null;
    };
  }, [listings, map, onSelectListing, selectedMlsNumber]);

  return null;
}

function UsListingsLayer({
  listings,
  selectedListingId,
  onSelectListing,
}: {
  listings: UsMapListing[];
  selectedListingId?: string | null;
  onSelectListing: (listing: UsMapListing) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    void loadLeafletMarkerCluster().then(() => {
      if (cancelled) return;

      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }

      const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 65,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      chunkedLoading: true,
      disableClusteringAtZoom: 14,
      iconCreateFunction: (clusterGroup: any) => {
        const size = clusterGroup.getChildCount() > 24 ? 48 : 40;
        return L.divIcon({
          className: "us-listing-cluster-marker",
          html: `<div style="
            width:${size}px;
            height:${size}px;
            border-radius:999px;
            background:#1d4ed8;
            border:3px solid rgba(255,255,255,0.95);
            box-shadow:0 6px 18px rgba(15,23,42,0.24);
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            color:white;
            font-family:system-ui,-apple-system,sans-serif;
            line-height:1.05;
          ">
            <span style="font-size:11px;font-weight:900;">US</span>
            <span style="font-size:10px;font-weight:800;opacity:0.95;">${clusterGroup.getChildCount()}</span>
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
      });

      cluster.on("clusterclick", (event: any) => {
        zoomToClusterBounds(map, event.layer, 14);
      });

      for (const listing of listings) {
        if (!Number.isFinite(listing.lat) || !Number.isFinite(listing.lng)) continue;
        const marker = L.marker(
          [listing.lat, listing.lng],
          { icon: createUsListingMarkerIcon(listing, selectedListingId === listing.id) },
        );
        const details = [
          listing.beds != null ? `${listing.beds} bd` : null,
          listing.baths != null ? `${listing.baths} ba` : null,
          listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null,
        ].filter(Boolean).join(" · ");
        const sourceLink = listing.sourceUrl
          ? `<a href="${escapeHtml(listing.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;">Open source listing</a>`
          : "";
        marker.bindPopup(`
          <div style="min-width:220px;font-family:system-ui,-apple-system,sans-serif;">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:4px;">
              <strong style="font-size:14px;">${escapeHtml(listing.listPrice ? formatPriceFull(listing.listPrice) : "Price unavailable")}</strong>
              <span style="font-size:10px;font-weight:800;color:#1d4ed8;">US beta</span>
            </div>
            <div style="font-size:12px;color:#374151;margin-bottom:4px;">${escapeHtml(listing.formattedAddress)}</div>
            ${details ? `<div style="font-size:11px;color:#4b5563;margin-bottom:4px;">${escapeHtml(details)}</div>` : ""}
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">${escapeHtml([listing.propertyType, listing.status].filter(Boolean).join(" · ") || listing.source)}</div>
            ${sourceLink}
          </div>
        `);
        marker.on("click", () => onSelectListing(listing));
        cluster.addLayer(marker);
      }

      if (cancelled) {
        map.removeLayer(cluster);
        return;
      }

      map.addLayer(cluster);
      clusterRef.current = cluster;
    });

    return () => {
      cancelled = true;
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
      clusterRef.current = null;
    };
  }, [listings, map, onSelectListing, selectedListingId]);

  return null;
}

function MapQuickCardOverlay({
  listing,
  children,
}: {
  listing: ListingWithCapRate | null;
  children: ReactNode;
}) {
  const map = useMap();
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!listing?.map?.latitude || !listing?.map?.longitude) return;

    const updatePosition = () => {
      const point = map.latLngToContainerPoint([listing.map!.latitude, listing.map!.longitude]);
      const mapSize = map.getSize();
      const cardWidth = 320;
      const cardHeight = 190;
      const margin = 16;

      let left = point.x + 18;
      let top = point.y - 12;

      if (left + cardWidth > mapSize.x - margin) {
        left = point.x - cardWidth - 18;
      }
      if (left < margin) {
        left = Math.max(margin, Math.min(mapSize.x - cardWidth - margin, point.x - (cardWidth / 2)));
      }
      if (top + cardHeight > mapSize.y - margin) {
        top = mapSize.y - cardHeight - margin;
      }
      if (top < margin) {
        top = margin;
      }

      setStyle({
        left: `${left}px`,
        top: `${top}px`,
      });
    };

    updatePosition();
    map.on("move zoom resize", updatePosition);
    return () => {
      map.off("move zoom resize", updatePosition);
    };
  }, [listing, map]);

  if (!listing) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[950]">
      <div className="pointer-events-auto absolute w-[320px] max-w-[calc(100%-2rem)]" style={style}>
        {children}
      </div>
    </div>
  );
}

function SalePriceEstimatePrompt({
  listing,
  isAuthenticated,
}: {
  listing: ListingWithCapRate;
  isAuthenticated: boolean;
}) {
  const { toast } = useToast();
  const listingKey = listing.mlsNumber;
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  const [estimate, setEstimate] = useState("");
  const [confirmedOutOfRange, setConfirmedOutOfRange] = useState(false);

  const estimateQuery = useQuery<{
    estimate: { estimatePriceCents: number; status: string; lockedAt?: string | null } | null;
    resolution: { ddfAbsentSince?: string | null; resolutionStatus?: string | null } | null;
  }>({
    queryKey: ["/api/sale-estimates", listingKey],
    queryFn: async () => {
      const res = await fetch(`/api/sale-estimates/${encodeURIComponent(listingKey)}`, { credentials: "include" });
      if (res.status === 401) return { estimate: null, resolution: null };
      if (!res.ok) throw new Error("Failed to fetch prediction");
      return res.json();
    },
    enabled: Boolean(listingKey) && isAuthenticated,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const numeric = Number(estimate.replace(/[^0-9.]/g, ""));
      const estimatePriceCents = Math.round(numeric * 100);
      const res = await apiRequest("POST", "/api/sale-estimates", {
        listingKey,
        mlsNumber: listing.mlsNumber,
        province: listing.address?.state,
        estimatePriceCents,
        listPriceCents: Number.isFinite(price) ? Math.round(price * 100) : null,
        confirmedOutOfRange,
        estimateContext: {
          listPrice: price,
          propertyType: listing.details?.propertyType || listing.type || null,
          city: listing.address?.city || null,
          province: listing.address?.state || null,
          bedrooms: listing.details?.numBedrooms || null,
          bathrooms: listing.details?.numBathrooms || null,
          capturedAt: new Date().toISOString(),
        },
      });
      return res.json();
    },
    onSuccess: () => {
      setEstimate("");
      setConfirmedOutOfRange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sale-estimates", listingKey] });
      toast({ title: "Prediction saved" });
    },
    onError: (err: any) => {
      const message = err.message || "Failed to save prediction";
      if (message.includes("409") && message.includes("far from list price")) {
        setConfirmedOutOfRange(true);
        toast({ title: "Confirm unusual prediction", description: "Submit again to confirm this estimate is far from list price." });
        return;
      }
      toast({ title: "Prediction not saved", description: message, variant: "destructive" });
    },
  });

  const existing = estimateQuery.data?.estimate;
  const resolution = estimateQuery.data?.resolution;
  const locked = Boolean(existing?.lockedAt || existing?.status === "locked" || existing?.status === "resolved" || resolution?.ddfAbsentSince || resolution?.resolutionStatus === "resolved" || resolution?.resolutionStatus === "pending");
  const formatCents = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

  if (!listingKey) return null;
  if (!isAuthenticated) {
    return (
      <div className="mt-2 rounded-md border border-border/60 bg-muted/20 px-2 py-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
        <p className="font-medium">What do you think this property will sell for?</p>
        <a href={authPath("/login")} className="text-primary underline">Sign in to submit a prediction</a>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-muted/20 px-2 py-2" onClick={(e) => e.stopPropagation()} data-testid={`sale-estimate-prompt-${listingKey}`}>
      <p className="text-[10px] font-medium">What do you think this property will sell for?</p>
      {existing ? (
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
          <span>Your prediction: <strong>{formatCents(existing.estimatePriceCents)}</strong></span>
          {locked && <Badge variant="outline" className="text-[9px]">Locked</Badge>}
        </div>
      ) : (
        <p className="mt-0.5 text-[9px] text-muted-foreground">Your prediction is locked when the listing is sold or leaves the active feed.</p>
      )}
      {!locked && (
        <div className="mt-2 flex gap-1.5">
          <Input
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            placeholder={existing ? "Update $" : "$"}
            inputMode="decimal"
            className="h-8 text-xs"
            data-testid={`input-sale-estimate-${listingKey}`}
          />
          <Button
            size="sm"
            className="h-8 shrink-0 px-2 text-[10px]"
            disabled={saveMutation.isPending || !estimate.trim()}
            onClick={() => saveMutation.mutate()}
            data-testid={`button-submit-sale-estimate-${listingKey}`}
          >
            Submit prediction
          </Button>
        </div>
      )}
    </div>
  );
}

function ListingSentimentControls({ listing }: { listing: ListingWithCapRate }) {
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  const sendSentiment = (sentiment: "bullish" | "neutral" | "bearish" | "pass" | "watch" | "would_offer", sentimentScore: number) => {
    track({
      event: "listing_sentiment_selected",
      listing_id: listing.mlsNumber,
      sentiment,
      sentimentScore,
      city: listing.address?.city,
      province: listing.address?.state,
      property_type: listing.details?.propertyType || listing.type,
      price: Number.isFinite(price) ? price : undefined,
      source: "listing_card",
    });
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()} data-testid={`listing-sentiment-${listing.mlsNumber}`}>
      {[
        ["Bullish", "bullish", 0.8],
        ["Watch", "watch", 0.4],
        ["Pass", "pass", -0.8],
        ["Offer", "would_offer", 1],
      ].map(([label, sentiment, score]) => (
        <Button
          key={String(sentiment)}
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => sendSentiment(sentiment as "bullish" | "neutral" | "bearish" | "pass" | "watch" | "would_offer", Number(score))}
          data-testid={`button-sentiment-${listing.mlsNumber}-${sentiment}`}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export default function CapRates() {
  const search = useSearch();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("any");
  const [minUnits, setMinUnits] = useState("any");
  const [propertyType, setPropertyType] = useState("all");
  const [sortMetric, setSortMetric] = useState<InvestmentMetricKey>("cap_rate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [metricSource, setMetricSource] = useState<InvestmentMetricSource>("realist_estimate");
  const [minGrossYield, setMinGrossYield] = useState("");
  const [maxGrossYield, setMaxGrossYield] = useState("");
  const [minCapRate, setMinCapRate] = useState("");
  const [maxCapRate, setMaxCapRate] = useState("");
  const [minIrr, setMinIrr] = useState("");
  const [maxIrr, setMaxIrr] = useState("");
  const [minCashOnCash, setMinCashOnCash] = useState("");
  const [minMonthlyCashFlow, setMinMonthlyCashFlow] = useState("");
  const [minAnalysisCount, setMinAnalysisCount] = useState("");
  const [consensusLabelFilter, setConsensusLabelFilter] = useState<"any" | ConsensusLabel>("any");
  const [includeUnavailableMetrics, setIncludeUnavailableMetrics] = useState(false);
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<RepliersListing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ListingWithCapRate | null>(null);
  const [selectedDistressListing, setSelectedDistressListing] = useState<DistressListing | null>(null);
  const [analyzerSheetMeta, setAnalyzerSheetMeta] = useState<{ title: string; subtitle: string } | null>(null);
  const [analyzerSeedQuery, setAnalyzerSeedQuery] = useState("");
  const [dataSource, setDataSource] = useState<"crea_ddf" | "repliers" | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>(DEFAULT_LAYERS);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [detailTab, setDetailTab] = usePersistedTab("capRatesExplorer.activeTab", "overview", ["overview", "underwrite", "community"]);
  const [aggregatesMap, setAggregatesMap] = useState<Record<string, ListingAnalysisAggregate>>({});
  const listingRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInProgress = useRef(false);
  const initialQueryHandledRef = useRef(false);
  const workspaceRestoredRef = useRef(false);

  const [findDealsQuery, setFindDealsQuery] = useState("");
  const [findDealsResults, setFindDealsResults] = useState<FindDealsResult[]>([]);
  const [findDealsActive, setFindDealsActive] = useState(false);
  const [findDealsLoading, setFindDealsLoading] = useState(false);
  const [findDealsFilters, setFindDealsFilters] = useState<Record<string, any>>({});
  const [showTopDealsOnly, setShowTopDealsOnly] = useState(false);
  const [selectedDealResult, setSelectedDealResult] = useState<FindDealsResult | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const initialDealCategories = useMemo(() => (
    typeof window === "undefined" ? [] : parseDealCategoriesFromParams(new URLSearchParams(window.location.search))
  ), []);
  const [dealCategories, setDealCategories] = useState<DealCategory[]>(initialDealCategories);
  const [showDistressOverlay, setShowDistressOverlay] = useState(true);
  const [showDistressOnly, setShowDistressOnly] = useState(() => (
    typeof window === "undefined" ? false : parseBooleanParam(new URLSearchParams(window.location.search).get("distressOnly"))
  ));
  // Unified country filter: Canadian listings come from CREA DDF / Repliers,
  // US listings from the us_listings table (HomeHarvest). "all" shows both.
  const [countryFilter, setCountryFilter] = useState<"all" | "ca" | "us">("all");
  const showUsListingsLayer = countryFilter !== "ca";
  const [savedSearches, setSavedSearches] = useState<SavedSearchSignal[]>(() => getSavedSearchSignals().slice(0, 4));
  const [savedShortlist, setSavedShortlist] = useState<SavedListingSignal[]>(() => getSavedListingSignals().slice(0, 4));
  const [recentViewedListings, setRecentViewedListings] = useState<SavedListingSignal[]>(() => getRecentViewedListingSignals().slice(0, 4));

  const [uwUnitCount, setUwUnitCount] = useState("1");
  const [uwRentPerUnit, setUwRentPerUnit] = useState("");
  const [uwVacancy, setUwVacancy] = useState("5");
  const [uwExpenseRatio, setUwExpenseRatio] = useState("35");
  const [uwDownPaymentPercent, setUwDownPaymentPercent] = useState("20");
  const [uwInterestRate, setUwInterestRate] = useState("5.5");
  const [uwAmortizationYears, setUwAmortizationYears] = useState("25");
  const [uwNoteText, setUwNoteText] = useState("");
  const [analysisVisibility, setAnalysisVisibility] = useState<"public" | "private">("public");
  const [analysisConsent, setAnalysisConsent] = useState<AnalysisConsentState>({
    useForProductImprovement: false,
    useForAiTraining: false,
    useForAnonymizedMarketDataset: false,
    allowCommercialDataLicensing: false,
  });
  const [communityCommentSort, setCommunityCommentSort] = useState<"newest" | "oldest" | "most_helpful" | "pinned">("pinned");
  const [analysisSort, setAnalysisSort] = useState<"newest" | "most_useful" | "highest_cap_rate" | "most_conservative" | "most_bullish" | "most_bearish">("newest");
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  const { data: rentData = [] } = useQuery<RentPulseData[]>({
    queryKey: ["/api/rents/pulse"],
  });

  const { data: ddfStatus } = useQuery<{ configured: boolean; authenticated: boolean }>({
    queryKey: ["/api/ddf/status"],
  });

  const { data: distressData } = useQuery<{ listings: DistressListing[] }>({
    queryKey: ["/api/distress-deals", "cap-rates-overlay"],
    queryFn: async () => {
      const res = await fetch("/api/distress-deals?minScore=20");
      if (!res.ok) throw new Error("Failed to fetch distress listings");
      return res.json();
    },
    enabled: showDistressOverlay || showDistressOnly,
    staleTime: 15 * 60 * 1000,
  });

  const { data: usMapData, isFetching: usMapLoading } = useQuery<{ listings: UsMapListing[]; total: number; limit: number; offset: number }>({
    queryKey: [
      "/api/us-listings/map",
      mapBounds?.north,
      mapBounds?.south,
      mapBounds?.east,
      mapBounds?.west,
      minPrice,
      maxPrice,
      minBeds,
      propertyType,
      countryFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "750",
        isActive: "true",
        source: "homeharvest",
      });
      if (mapBounds) {
        params.set("north", String(mapBounds.north));
        params.set("south", String(mapBounds.south));
        params.set("east", String(mapBounds.east));
        params.set("west", String(mapBounds.west));
      }
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (minBeds !== "any") params.set("beds", minBeds);
      if (propertyType !== "all") params.set("propertyType", propertyType);
      const res = await fetch(`/api/us-listings/map?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch US listings map data");
      return res.json();
    },
    enabled: showUsListingsLayer && !findDealsActive,
    staleTime: 5 * 60 * 1000,
  });

  const selectedMls = selectedListing?.mlsNumber;

  const { data: publicAnalyses = [], refetch: refetchPublicAnalyses } = useQuery<any[]>({
    queryKey: ["/api/community/analyses", selectedMls, analysisSort],
    queryFn: async () => {
      if (!selectedMls) return [];
      const res = await fetch(`/api/community/analyses/${selectedMls}?sort=${analysisSort}`);
      return res.json();
    },
    enabled: !!selectedMls,
  });

  const { data: myAnalyses = [], refetch: refetchMyAnalyses } = useQuery<any[]>({
    queryKey: ["/api/community/my-analyses", selectedMls],
    queryFn: async () => {
      if (!selectedMls || !isAuthenticated) return [];
      const res = await fetch(`/api/community/my-analyses/${selectedMls}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedMls && isAuthenticated,
  });

  const { data: communityComments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["/api/community/comments", selectedMls, communityCommentSort],
    queryFn: async () => {
      if (!selectedMls) return [];
      const res = await fetch(`/api/community/comments/${selectedMls}?sort=${communityCommentSort}`);
      return res.json();
    },
    enabled: !!selectedMls,
  });

  const { data: privateNotes = [], refetch: refetchPrivateNotes } = useQuery<any[]>({
    queryKey: ["/api/community/private-notes", selectedMls],
    queryFn: async () => {
      if (!selectedMls || !isAuthenticated) return [];
      const res = await fetch(`/api/community/private-notes/${selectedMls}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedMls && isAuthenticated,
  });

  const { data: myAnalysisMetricsMap = {} } = useQuery<Record<string, any>>({
    queryKey: ["/api/community/my-analysis-metrics", listings.map((listing) => listing.mlsNumber).join(","), isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated || listings.length === 0) return {};
      const res = await apiRequest("POST", "/api/community/my-analysis-metrics", {
        mlsNumbers: listings.map((listing) => listing.mlsNumber).filter(Boolean),
      });
      return res.json();
    },
    enabled: isAuthenticated && listings.length > 0,
  });

  // Toast once per outage, not once per pan — this fetch re-fires every time
  // the listing set changes, and a down aggregates API shouldn't stack toasts.
  const aggregatesErrorNotifiedRef = useRef(false);
  const fetchAggregatesBatch = useCallback(async (mlsNumbers: string[]) => {
    if (mlsNumbers.length === 0) return;
    try {
      const res = await apiRequest("POST", "/api/community/aggregates", { mlsNumbers });
      const data: ListingAnalysisAggregate[] = await res.json();
      const map: Record<string, ListingAnalysisAggregate> = {};
      data.forEach((agg) => { map[agg.listingMlsNumber] = agg; });
      setAggregatesMap((prev) => ({ ...prev, ...map }));
      aggregatesErrorNotifiedRef.current = false;
    } catch (error) {
      // Don't silently swallow this — community medians/consensus quietly
      // vanishing looks like "nobody analyzed anything" instead of an outage.
      console.error("Error fetching community aggregates:", error);
      if (!aggregatesErrorNotifiedRef.current) {
        aggregatesErrorNotifiedRef.current = true;
        toast({
          title: "Couldn't load community data",
          description: "Community analysis counts and medians may be missing right now. They'll refresh on your next search.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    const mlsNumbers = listings.map((l) => l.mlsNumber).filter(Boolean);
    if (mlsNumbers.length > 0) {
      fetchAggregatesBatch(mlsNumbers);
    }
  }, [listings, fetchAggregatesBatch]);

  const submitAnalysisMutation = useMutation({
    mutationFn: async (data: {
      listingMlsNumber: string;
      title: string;
      summary: string;
      userNotes: string;
      city?: string;
      province?: string;
      market?: string;
      propertyType?: string;
      listingPrice?: number;
      visibility: "public" | "private";
      assumptions: Record<string, unknown>;
      calculatedMetrics: Record<string, unknown>;
      listingSnapshot: Record<string, unknown>;
      sourceContext: Record<string, unknown>;
      dataUseConsent: AnalysisConsentState;
    }) => {
      const res = await apiRequest("POST", "/api/community/analyses", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Analysis saved", description: variables.visibility === "public" ? "Visible to the community" : "Saved privately" });
      refetchPublicAnalyses();
      refetchMyAnalyses();
      setUwNoteText("");
      fetchAggregatesBatch([variables.listingMlsNumber]);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save analysis", variant: "destructive" });
    },
  });

  const submitCommentMutation = useMutation({
    mutationFn: async (data: { listingMlsNumber: string; body: string; visibility: "public" | "private"; parentCommentId?: string }) => {
      const res = await apiRequest("POST", "/api/community/comments", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.visibility === "private" ? "Private note saved" : "Comment posted" });
      refetchComments();
      refetchPrivateNotes();
      fetchAggregatesBatch([variables.listingMlsNumber]);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post comment", variant: "destructive" });
    },
  });

  const commentHelpfulMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("POST", `/api/community/comments/${commentId}/helpful`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
      if (selectedMls) fetchAggregatesBatch([selectedMls]);
    },
  });

  const commentReportMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("POST", `/api/community/comments/${commentId}/report`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("DELETE", `/api/community/comments/${commentId}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
      refetchPrivateNotes();
      if (selectedMls) fetchAggregatesBatch([selectedMls]);
    },
  });

  const analysisFeedbackMutation = useMutation({
    mutationFn: async ({ analysisId, feedbackType }: { analysisId: string; feedbackType: "useful" | "not_useful" | "disagree" }) => {
      const res = await apiRequest("POST", `/api/community/analyses/${analysisId}/feedback`, { feedbackType });
      return res.json();
    },
    onSuccess: () => {
      refetchPublicAnalyses();
    },
  });

  const duplicateAnalysisMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await apiRequest("POST", `/api/community/analyses/${analysisId}/duplicate`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchMyAnalyses();
      refetchPublicAnalyses();
      if (selectedMls) fetchAggregatesBatch([selectedMls]);
    },
  });

  const fetchListingsForBounds = useCallback(async (bounds: MapBounds, pageNum = 1) => {
    if (searchInProgress.current) return;
    searchInProgress.current = true;
    setIsSearching(true);
    setFetchError(false);
    try {
      const useDdf = ddfStatus?.configured && ddfStatus?.authenticated;

      if (useDdf) {
        const ddfBody: Record<string, any> = {
          resultsPerPage: 50,
          pageNum,
          latitudeMin: bounds.south,
          latitudeMax: bounds.north,
          longitudeMin: bounds.west,
          longitudeMax: bounds.east,
          excludeBusinessSales: true,
          excludeParking: true,
          excludeVacantLand: true,
        };

        if (minPrice) ddfBody.minPrice = parseInt(minPrice);
        if (maxPrice) ddfBody.maxPrice = parseInt(maxPrice);
        if (minBeds && minBeds !== "any") ddfBody.minBeds = parseInt(minBeds);
        if (minUnits && minUnits !== "any") ddfBody.minUnits = parseInt(minUnits);
        if (propertyType && propertyType !== "all") ddfBody.propertySubType = propertyType;

        try {
          const response = await apiRequest("POST", "/api/ddf/listings", ddfBody);
          const data = await response.json();

          if (data.listings) {
            setListings(data.listings);
            setTotalCount(data.count || 0);
            setNumPages(data.numPages || 0);
            setPage(data.page || 1);
            setDataSource("crea_ddf");
            setHasSearched(true);
            return;
          }
        } catch (ddfError) {
          console.warn("DDF search failed, falling back to Repliers:", ddfError);
        }
      }

      const body: Record<string, any> = {
        resultsPerPage: 50,
        pageNum,
        status: "A",
        class: "ResidentialProperty",
        map: `${bounds.south},${bounds.west}|${bounds.north},${bounds.east}`,
      };

      if (minPrice) body.minPrice = parseInt(minPrice);
      if (maxPrice) body.maxPrice = parseInt(maxPrice);
      if (minBeds && minBeds !== "any") body.minBeds = parseInt(minBeds);
      if (propertyType && propertyType !== "all") body.propertyType = propertyType;

      const response = await apiRequest("POST", "/api/repliers/listings", body);
      const data = await response.json();

      if (data.listings) {
        setListings(data.listings);
        setTotalCount(data.count || 0);
        setNumPages(data.numPages || 0);
        setPage(data.page || 1);
        setDataSource("repliers");
      } else {
        setListings([]);
        setTotalCount(0);
        setNumPages(0);
      }
      setHasSearched(true);
    } catch (error) {
      // Never let an API failure masquerade as "no properties found" — say
      // the platform had a problem, not that the inventory is empty.
      console.error("Error fetching listings:", error);
      setListings([]);
      setTotalCount(0);
      setFetchError(true);
      toast({
        title: "Couldn't load listings",
        description: "Something went wrong on our end. Move the map or hit retry to try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
      searchInProgress.current = false;
    }
  }, [minPrice, maxPrice, minBeds, minUnits, propertyType, ddfStatus, toast]);

  // Keep the selected listing pinned while the user repositions the map —
  // clearing it on pan made it impossible to review a property and move the
  // viewport at the same time.
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    fetchListingsForBounds(bounds, 1);
  }, [fetchListingsForBounds]);

  const listingsWithCapRates = useMemo((): ListingWithCapRate[] => {
    return listings
      .map((listing: any) => {
        if (isVacantLandLikeProperty(listing)) return null;
        const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
        if (!(price > 1)) return null;
        const bedrooms = listing.details?.numBedrooms || 2;
        const plexSignal = detectPossiblePlex({
          propertyType: listing.details?.propertyType || listing.type || listing.class,
          tags: [listing.details?.style, listing.details?.basement1],
          unitCount: listing.numberOfUnitsTotal,
          kitchenCount: listing.details?.numKitchens || listing.kitchenCount || listing.numKitchens,
          description: listing.details?.description,
          remarks: [listing.details?.extras, listing.remarks, listing.publicRemarks].filter(Boolean).join(" "),
        });
        const units = listing.numberOfUnitsTotal || plexSignal.estimated_unit_count || 1;

        let rent: number;
        let source: "market" | "estimated" | "actual" | "cmhc_city" | "cmhc_province";
        if (listing.totalActualRent && listing.totalActualRent > 0) {
          rent = listing.totalActualRent / 12;
          source = "actual";
        } else {
          const estimated = estimateMonthlyRent(
            bedrooms,
            listing.address?.city,
            listing.address?.country,
            rentData,
            listing.address?.state
          );
          rent = estimated.rent * units;
          source = estimated.source;
        }

        const metrics = calculateInvestmentMetrics(price, {
          monthlyRent: rent,
          unitCount: units,
          annualPropertyTax: listing.taxes?.annualAmount || null,
          annualInsurance: EXPENSE_ASSUMPTIONS.insurancePerUnit * units,
          vacancyPercent: EXPENSE_ASSUMPTIONS.vacancyPercent,
          maintenancePercent: EXPENSE_ASSUMPTIONS.maintenancePercent,
          managementPercent: EXPENSE_ASSUMPTIONS.managementPercent,
          rentSource: source,
          taxSource: listing.taxes?.annualAmount ? "listing" : "inferred",
        });
        return {
          ...listing,
          grossYield: metrics.grossYield,
          capRate: metrics.capRate || 0,
          cashOnCashReturn: metrics.cashOnCashReturn,
          irr: metrics.irr,
          monthlyCashFlow: metrics.monthlyCashFlow,
          dscr: metrics.dscr,
          estimatedMonthlyRent: rent,
          annualNOI: metrics.noi || 0,
          annualOperatingExpenses: metrics.annualOperatingExpenses,
          expenseRatio: metrics.expenseRatio,
          metricConfidence: metrics.capRateConfidence,
          irrConfidence: metrics.irrConfidence,
          assumptionsComplete: metrics.assumptionsComplete,
          calculationWarnings: metrics.calculationWarnings,
          assumptionsUsed: metrics.assumptionsUsed,
          rentSource: source,
          kitchenCount: plexSignal.kitchen_count || undefined,
          plexConfidenceScore: plexSignal.plex_confidence_score,
          plexDetectionReason: plexSignal.plex_detection_reason,
          unitCount: units,
        };
      })
      .filter((listing): listing is ListingWithCapRate => Boolean(listing))
      .filter((l) => {
        const aggregate = aggregatesMap[l.mlsNumber];
        const myMetrics = myAnalysisMetricsMap[l.mlsNumber];
        const selectedMetricValue = getListingMetricValue(l, sortMetric, aggregate, metricSource, myMetrics);
        if (!includeUnavailableMetrics && sortMetric !== "community_consensus" && selectedMetricValue == null) return false;
        if (minGrossYield && (l.grossYield == null || l.grossYield < parseFloat(minGrossYield))) return false;
        if (maxGrossYield && (l.grossYield == null || l.grossYield > parseFloat(maxGrossYield))) return false;
        if (minCapRate) {
          const value = getListingMetricValue(l, "cap_rate", aggregate, metricSource, myMetrics);
          if (value == null || value < parseFloat(minCapRate)) return false;
        }
        if (maxCapRate) {
          const value = getListingMetricValue(l, "cap_rate", aggregate, metricSource, myMetrics);
          if (value == null || value > parseFloat(maxCapRate)) return false;
        }
        if (minIrr) {
          const value = getListingMetricValue(l, "irr", aggregate, metricSource, myMetrics);
          if (value == null || value < parseFloat(minIrr)) return false;
        }
        if (maxIrr) {
          const value = getListingMetricValue(l, "irr", aggregate, metricSource, myMetrics);
          if (value == null || value > parseFloat(maxIrr)) return false;
        }
        if (minCashOnCash) {
          const value = getListingMetricValue(l, "cash_on_cash", aggregate, metricSource, myMetrics);
          if (value == null || value < parseFloat(minCashOnCash)) return false;
        }
        if (minMonthlyCashFlow) {
          const value = getListingMetricValue(l, "monthly_cash_flow", aggregate, metricSource, myMetrics);
          if (value == null || value < parseFloat(minMonthlyCashFlow)) return false;
        }
        if (minAnalysisCount && (aggregate?.publicAnalysisCount || 0) < parseFloat(minAnalysisCount)) return false;
        if (consensusLabelFilter !== "any" && aggregate?.consensusLabel !== consensusLabelFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const aggregateA = aggregatesMap[a.mlsNumber];
        const aggregateB = aggregatesMap[b.mlsNumber];
        const myMetricsA = myAnalysisMetricsMap[a.mlsNumber];
        const myMetricsB = myAnalysisMetricsMap[b.mlsNumber];
        if (sortMetric === "community_consensus") {
          const rank = (label?: string | null) => label === "bullish" ? 3 : label === "neutral" ? 2 : label === "bearish" ? 1 : 0;
          const comparison = rank(aggregateA?.consensusLabel) - rank(aggregateB?.consensusLabel);
          return sortDirection === "asc" ? comparison : -comparison;
        }
        const valueA = getListingMetricValue(a, sortMetric, aggregateA, metricSource, myMetricsA);
        const valueB = getListingMetricValue(b, sortMetric, aggregateB, metricSource, myMetricsB);
        if (valueA == null && valueB == null) return 0;
        if (valueA == null) return 1;
        if (valueB == null) return -1;
        const comparison = valueA - valueB;
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [
    aggregatesMap,
    consensusLabelFilter,
    includeUnavailableMetrics,
    listings,
    maxCapRate,
    maxGrossYield,
    maxIrr,
    metricSource,
    minAnalysisCount,
    minCapRate,
    minCashOnCash,
    minGrossYield,
    minIrr,
    minMonthlyCashFlow,
    myAnalysisMetricsMap,
    rentData,
    sortDirection,
    sortMetric,
  ]);

  const filteredDistressListings = useMemo(() => {
    return (distressData?.listings || []).filter((listing) => matchesDealCategories(listing, dealCategories));
  }, [dealCategories, distressData]);

  const distressMap = useMemo(() => {
    const entries = filteredDistressListings
      .filter((listing) => Boolean(listing.mlsNumber))
      .map((listing) => [listing.mlsNumber, listing] as const);
    return Object.fromEntries(entries) as Record<string, DistressListing>;
  }, [filteredDistressListings]);

  const distressListingsInView = useMemo(() => {
    if (!mapBounds) return [];
    return filteredDistressListings.filter((listing) => {
      const lat = listing.map?.latitude;
      const lng = listing.map?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return false;
      return lat >= mapBounds.south && lat <= mapBounds.north && lng >= mapBounds.west && lng <= mapBounds.east;
    });
  }, [filteredDistressListings, mapBounds]);

  const distressOnlyListingsInView = useMemo(() => {
    const normalMls = new Set(listingsWithCapRates.map((listing) => listing.mlsNumber));
    return distressListingsInView.filter((listing) => !normalMls.has(listing.mlsNumber));
  }, [distressListingsInView, listingsWithCapRates]);

  const displayedListings = useMemo(() => {
    // US-only mode hides the Canadian (DDF/Repliers) inventory entirely;
    // US listings render from usMapData as markers + simple cards.
    if (countryFilter === "us") return [];
    if (!showDistressOnly) return listingsWithCapRates;
    const distressMls = new Set(distressListingsInView.map((listing) => listing.mlsNumber));
    return listingsWithCapRates.filter((listing) => distressMls.has(listing.mlsNumber));
  }, [countryFilter, distressListingsInView, listingsWithCapRates, showDistressOnly]);

  const displayedMappableListings = useMemo(
    () => displayedListings.filter((l) => l.map?.latitude && l.map?.longitude),
    [displayedListings]
  );

  const saveWorkspaceState = useCallback((state: MapWorkspaceState) => {
    try {
      const existing = JSON.parse(sessionStorage.getItem(MAP_WORKSPACE_STATE_KEY) || "{}") as MapWorkspaceState;
      sessionStorage.setItem(
        MAP_WORKSPACE_STATE_KEY,
        JSON.stringify({ ...existing, ...state, savedAt: Date.now() }),
      );
    } catch {
      // Ignore storage failures; URL state still preserves the critical workflow.
    }
  }, []);

  const updateWorkspaceUrl = useCallback((state: { selectedMls?: string | null; analyzerOpen?: boolean | null }) => {
    const params = new URLSearchParams(window.location.search);
    if (state.selectedMls) params.set("selectedMls", state.selectedMls);
    if (state.selectedMls === null) params.delete("selectedMls");
    if (state.analyzerOpen) params.set("analyze", "1");
    if (state.analyzerOpen === false) params.delete("analyze");
    window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, []);

  useEffect(() => {
    if (workspaceRestoredRef.current || listingsWithCapRates.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    let stored: MapWorkspaceState = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(MAP_WORKSPACE_STATE_KEY) || "{}") as MapWorkspaceState;
    } catch {
      stored = {};
    }
    const selectedMls = params.get("selectedMls") || params.get("mls") || stored.selectedMls;
    if (!selectedMls) return;
    const listing = listingsWithCapRates.find((candidate) => candidate.mlsNumber === selectedMls);
    if (!listing) return;

    workspaceRestoredRef.current = true;
    setSelectedListing(listing);
    setSelectedDistressListing(null);
    setDetailTab("overview");
    setUwUnitCount(String(listing.unitCount || 1));
    const perUnitRent = listing.unitCount > 1
      ? Math.round(listing.estimatedMonthlyRent / listing.unitCount)
      : Math.round(listing.estimatedMonthlyRent);
    setUwRentPerUnit(String(perUnitRent));
    if (listing.map?.latitude && listing.map?.longitude) {
      setFlyTo({ lat: listing.map.latitude, lng: listing.map.longitude, zoom: 15 });
    }

    if (params.get("analyze") === "1" || stored.analyzerOpen) {
      const seedQuery = stored.analyzerSeedQuery || buildAnalyzerSeed(listing);
      setAnalyzerSeedQuery(seedQuery);
      setAnalyzerSheetMeta({
        title: stored.analyzerTitle || "Analyze in Map Workspace",
        subtitle: stored.analyzerSubtitle || `${formatShortAddress(listing.address)}${listing.address?.city ? `, ${listing.address.city}` : ""}`,
      });
      saveWorkspaceState({
        selectedMls: listing.mlsNumber,
        analyzerOpen: true,
        analyzerSeedQuery: seedQuery,
        analyzerTitle: stored.analyzerTitle || "Analyze in Map Workspace",
        analyzerSubtitle: stored.analyzerSubtitle || `${formatShortAddress(listing.address)}${listing.address?.city ? `, ${listing.address.city}` : ""}`,
      });
    }
  }, [listingsWithCapRates, saveWorkspaceState]);

  const handleFindDeals = useCallback(async () => {
    if (!findDealsQuery.trim()) return;
    setFindDealsLoading(true);
    setFindDealsActive(true);
    setSelectedListing(null);
    setSelectedDealResult(null);
    try {
      const response = await apiRequest("POST", "/api/find-deals", {
        query: findDealsQuery.trim(),
        bounds: mapBounds,
      });
      const data: FindDealsResponse = await response.json();

      setFindDealsResults(data.listings);
      setFindDealsFilters(data.filters_applied || {});

      if (data.filters_applied) {
        const f = data.filters_applied;
        if (f.minPrice) setMinPrice(String(f.minPrice));
        if (f.maxPrice) setMaxPrice(String(f.maxPrice));
        if (f.minBeds) setMinBeds(String(f.minBeds));
        if (f.propertyType) setPropertyType(f.propertyType);
      }

      if (data.bounds?.center) {
        setFlyTo({ lat: data.bounds.center.lat, lng: data.bounds.center.lng, zoom: 12 });
      }

      toast({
        title: `Found ${data.listings.length} deals`,
        description: data.listings.filter(l => l.deal_score >= 65).length + " scored as good or better",
      });
    } catch (error: any) {
      console.error("Find deals error:", error);
      toast({
        title: "Search failed",
        description: error.message || "Could not search for deals",
        variant: "destructive",
      });
    } finally {
      setFindDealsLoading(false);
    }
  }, [findDealsQuery, mapBounds, toast]);

  useEffect(() => {
    if (initialQueryHandledRef.current || !search) return;
    const params = new URLSearchParams(search);
    const q = params.get("q");
    const initialSortMetric = params.get("sortMetric") as InvestmentMetricKey | null;
    const initialSortDirection = params.get("sortDirection") as "asc" | "desc" | null;
    const initialMetricSource = params.get("metricSource") as InvestmentMetricSource | null;
    if (initialSortMetric) setSortMetric(initialSortMetric);
    if (initialSortDirection === "asc" || initialSortDirection === "desc") setSortDirection(initialSortDirection);
    if (initialMetricSource) setMetricSource(initialMetricSource);
    if (params.get("minGrossYield")) setMinGrossYield(params.get("minGrossYield") || "");
    if (params.get("maxGrossYield")) setMaxGrossYield(params.get("maxGrossYield") || "");
    if (params.get("minCapRate")) setMinCapRate(params.get("minCapRate") || "");
    if (params.get("maxCapRate")) setMaxCapRate(params.get("maxCapRate") || "");
    if (params.get("minIRR")) setMinIrr(params.get("minIRR") || "");
    if (params.get("maxIRR")) setMaxIrr(params.get("maxIRR") || "");
    if (params.get("minCashOnCash")) setMinCashOnCash(params.get("minCashOnCash") || "");
    if (params.get("minMonthlyCashFlow")) setMinMonthlyCashFlow(params.get("minMonthlyCashFlow") || "");
    if (params.get("minAnalysisCount")) setMinAnalysisCount(params.get("minAnalysisCount") || "");
    const consensus = params.get("consensusLabel");
    if (consensus === "bullish" || consensus === "neutral" || consensus === "bearish") setConsensusLabelFilter(consensus);
    setIncludeUnavailableMetrics(params.get("includeUnavailableMetrics") === "true");
    const initialDeals = parseDealCategoriesFromParams(params);
    if (initialDeals.length > 0) {
      setDealCategories(initialDeals);
      setShowDistressOverlay(true);
    }
    if (parseBooleanParam(params.get("distressOnly"))) {
      setShowDistressOnly(true);
      setShowDistressOverlay(true);
    }
    if (!q) {
      initialQueryHandledRef.current = true;
      return;
    }
    setFindDealsQuery(q);
  }, [search]);

  useEffect(() => {
    if (initialQueryHandledRef.current || !mapBounds || !findDealsQuery.trim()) return;
    initialQueryHandledRef.current = true;
    handleFindDeals();
  }, [findDealsQuery, mapBounds, handleFindDeals]);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncDiscoverySignalsWithAccount().then(() => {
      setSavedSearches(getSavedSearchSignals().slice(0, 4));
      setSavedShortlist(getSavedListingSignals().slice(0, 4));
      setRecentViewedListings(getRecentViewedListingSignals().slice(0, 4));
    });
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (findDealsQuery.trim()) params.set("q", findDealsQuery.trim());
    params.set("sortMetric", sortMetric);
    params.set("sortDirection", sortDirection);
    params.set("metricSource", metricSource);
    if (minGrossYield) params.set("minGrossYield", minGrossYield);
    if (maxGrossYield) params.set("maxGrossYield", maxGrossYield);
    if (minCapRate) params.set("minCapRate", minCapRate);
    if (maxCapRate) params.set("maxCapRate", maxCapRate);
    if (minIrr) params.set("minIRR", minIrr);
    if (maxIrr) params.set("maxIRR", maxIrr);
    if (minCashOnCash) params.set("minCashOnCash", minCashOnCash);
    if (minMonthlyCashFlow) params.set("minMonthlyCashFlow", minMonthlyCashFlow);
    if (minAnalysisCount) params.set("minAnalysisCount", minAnalysisCount);
    if (consensusLabelFilter !== "any") params.set("consensusLabel", consensusLabelFilter);
    if (includeUnavailableMetrics) params.set("includeUnavailableMetrics", "true");
    if (dealCategories.length > 0) params.set("deals", dealCategories.join(","));
    if (showDistressOnly) params.set("distressOnly", "1");
    if (selectedListing?.mlsNumber) params.set("selectedMls", selectedListing.mlsNumber);
    if (analyzerSheetMeta) params.set("analyze", "1");
    window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [
    analyzerSheetMeta,
    consensusLabelFilter,
    dealCategories,
    findDealsQuery,
    includeUnavailableMetrics,
    maxCapRate,
    maxGrossYield,
    maxIrr,
    metricSource,
    minAnalysisCount,
    minCapRate,
    minCashOnCash,
    minGrossYield,
    minIrr,
    minMonthlyCashFlow,
    selectedListing?.mlsNumber,
    showDistressOnly,
    sortDirection,
    sortMetric,
  ]);

  const handleClearFindDeals = () => {
    setFindDealsActive(false);
    setFindDealsResults([]);
    setFindDealsFilters({});
    setFindDealsQuery("");
    setSelectedDealResult(null);
    setShowTopDealsOnly(false);
  };

  const toggleDealCategory = (category: DealCategory) => {
    setDealCategories((current) => {
      const hasCategory = current.includes(category);
      const next = hasCategory
        ? current.filter((item) => item !== category)
        : [...current, category];
      if (next.length > 0) setShowDistressOverlay(true);
      return next;
    });
  };

  // Removing an "Understood:" chip drops that parsed constraint from the echo
  // and clears the matching workspace filter it was copied into, so the next
  // map move / refresh searches without it.
  const handleRemoveParsedFilter = (key: string) => {
    setFindDealsFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === "minPrice") setMinPrice("");
    if (key === "maxPrice") setMaxPrice("");
    if (key === "minBeds") setMinBeds("any");
    if (key === "propertyType") setPropertyType("all");
  };

  const handleSelectDealResult = (result: FindDealsResult) => {
    setSelectedDealResult(result);
    setSelectedListing(null);
    setFlyTo({ lat: result.lat, lng: result.lng, zoom: 15 });
  };

  const displayedDealResults = useMemo(() => {
    if (!findDealsActive) return [];
    const results = showTopDealsOnly
      ? findDealsResults.filter(r => r.deal_score >= 65)
      : findDealsResults;
    return results.slice(0, 20);
  }, [findDealsActive, findDealsResults, showTopDealsOnly]);

  // Echo back everything the NL parser extracted so its limits are visible:
  // a search that parsed nothing says so instead of silently degrading into
  // an unfiltered result list.
  const parsedFilterChips = useMemo(() => {
    const f = findDealsFilters || {};
    const chips: Array<{ key: string; label: string }> = [];
    if (f.city) chips.push({ key: "city", label: String(f.city) });
    if (f.propertyType) chips.push({ key: "propertyType", label: String(f.propertyType) });
    if (f.minPrice) chips.push({ key: "minPrice", label: `Over ${formatPrice(f.minPrice)}` });
    if (f.maxPrice) chips.push({ key: "maxPrice", label: `Under ${formatPrice(f.maxPrice)}` });
    if (f.minBeds) chips.push({ key: "minBeds", label: `${f.minBeds}+ beds` });
    const knownKeys = new Set(["city", "propertyType", "minPrice", "maxPrice", "minBeds"]);
    for (const [key, value] of Object.entries(f)) {
      if (knownKeys.has(key) || value == null || value === "" || typeof value === "object") continue;
      chips.push({ key, label: `${key}: ${String(value)}` });
    }
    return chips;
  }, [findDealsFilters]);

  const activeFilterCount = useMemo(() => {
    return [
      Boolean(minPrice),
      Boolean(maxPrice),
      minBeds !== "any",
      minUnits !== "any",
      propertyType !== "all",
      Boolean(minGrossYield),
      Boolean(maxGrossYield),
      Boolean(minCapRate),
      Boolean(maxCapRate),
      Boolean(minIrr),
      Boolean(maxIrr),
      Boolean(minCashOnCash),
      Boolean(minMonthlyCashFlow),
      Boolean(minAnalysisCount),
      consensusLabelFilter !== "any",
      includeUnavailableMetrics,
      dealCategories.length > 0,
      !showDistressOverlay,
      showDistressOnly,
      countryFilter !== "all",
      sortMetric !== "gross_yield",
      sortDirection !== "desc",
      metricSource !== "realist_estimate",
    ].filter(Boolean).length;
  }, [
    consensusLabelFilter,
    countryFilter,
    dealCategories.length,
    includeUnavailableMetrics,
    maxCapRate,
    maxGrossYield,
    maxIrr,
    metricSource,
    minAnalysisCount,
    minBeds,
    minCapRate,
    minCashOnCash,
    minGrossYield,
    minIrr,
    minMonthlyCashFlow,
    minPrice,
    minUnits,
    maxPrice,
    propertyType,
    showDistressOnly,
    showDistressOverlay,
    sortDirection,
    sortMetric,
  ]);

  useEffect(() => {
    if (!showDistressOverlay) {
      setSelectedDistressListing(null);
    }
  }, [showDistressOverlay]);

  const handleRefresh = () => {
    if (mapBounds) {
      fetchListingsForBounds(mapBounds, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (mapBounds) {
      fetchListingsForBounds(mapBounds, newPage);
    }
  };

  const buildAnalyzerSeed = (listing: ListingWithCapRate | DistressListing) => {
    const addr = formatAddress(listing.address as RepliersListing["address"]);
    const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
    const params = new URLSearchParams();
    params.set("address", addr);
    if (price) params.set("price", String(price));
    if (listing.details?.numBedrooms) params.set("beds", String(listing.details.numBedrooms));
    if (listing.details?.numBathrooms) params.set("baths", String(listing.details.numBathrooms));
    if (listing.details?.sqft) params.set("sqft", listing.details.sqft);
    const yearBuilt = (listing.details as { yearBuilt?: string } | undefined)?.yearBuilt;
    if (yearBuilt) params.set("yearBuilt", yearBuilt);
    if (listing.mlsNumber) params.set("mls", listing.mlsNumber);
    if (listing.address?.city) params.set("city", listing.address.city);
    if (listing.address?.state) params.set("state", listing.address.state);
    if ("estimatedMonthlyRent" in listing && listing.estimatedMonthlyRent) params.set("rent", String(listing.estimatedMonthlyRent));
    params.set("vacancy", String(EXPENSE_ASSUMPTIONS.vacancyPercent));
    params.set("maintenance", String(EXPENSE_ASSUMPTIONS.maintenancePercent));
    params.set("management", String(EXPENSE_ASSUMPTIONS.managementPercent));
    params.set("insurance", String(EXPENSE_ASSUMPTIONS.insurancePerUnit * Math.max(1, "unitCount" in listing ? listing.unitCount || 1 : 1)));
    const tax = "taxes" in listing && listing.taxes?.annualAmount
      ? listing.taxes.annualAmount
      : price
        ? price * EXPENSE_ASSUMPTIONS.propertyTaxPercent / 100
        : 0;
    if (tax) params.set("propertyTax", String(Math.round(tax)));
    return params.toString();
  };

  const handleAnalyzeListing = (listing: ListingWithCapRate) => {
    const seedQuery = buildAnalyzerSeed(listing);
    const meta = {
      title: "Analyze in Map Workspace",
      subtitle: `${formatShortAddress(listing.address)}${listing.address?.city ? `, ${listing.address.city}` : ""}`,
    };
    setSelectedListing(listing);
    setSelectedDistressListing(null);
    setAnalyzerSeedQuery(seedQuery);
    setAnalyzerSheetMeta(meta);
    saveWorkspaceState({
      selectedMls: listing.mlsNumber,
      analyzerOpen: true,
      analyzerSeedQuery: seedQuery,
      analyzerTitle: meta.title,
      analyzerSubtitle: meta.subtitle,
    });
    updateWorkspaceUrl({ selectedMls: listing.mlsNumber, analyzerOpen: true });
    track({ event: "underwriting_opened", listing_id: listing.mlsNumber, source: "map_workspace" });
    track({ event: "analysis_started", listing_id: listing.mlsNumber, source: "map_workspace" });
  };

  const handleAnalyzeDistressListing = (listing: DistressListing) => {
    const seedQuery = buildAnalyzerSeed(listing);
    const meta = {
      title: "Analyze Motivated Opportunity",
      subtitle: `${formatShortAddress(listing.address as RepliersListing["address"])}${listing.address?.city ? `, ${listing.address.city}` : ""}`,
    };
    setAnalyzerSeedQuery(seedQuery);
    setAnalyzerSheetMeta(meta);
    saveWorkspaceState({
      selectedMls: listing.mlsNumber,
      analyzerOpen: true,
      analyzerSeedQuery: seedQuery,
      analyzerTitle: meta.title,
      analyzerSubtitle: meta.subtitle,
    });
    updateWorkspaceUrl({ selectedMls: listing.mlsNumber, analyzerOpen: true });
  };

  const handleAnalyzerSheetOpenChange = (open: boolean) => {
    if (open) return;
    setAnalyzerSheetMeta(null);
    saveWorkspaceState({ analyzerOpen: false });
    updateWorkspaceUrl({ analyzerOpen: false });
  };

  const handleSaveCurrentSearch = () => {
    const normalizedQuery = findDealsQuery.trim();
    const inferredGeography = selectedListing?.address?.city || recentViewedListings[0]?.city || undefined;
    const savedSearch: SavedSearchSignal = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      label: normalizedQuery
        ? `Map search · ${normalizedQuery}`
        : [
            propertyType !== "all" ? propertyType : null,
            minCapRate ? `${minCapRate}%+ cap` : null,
            minGrossYield ? `${minGrossYield}%+ gross yield` : null,
            minPrice ? `from $${Number(minPrice).toLocaleString()}` : null,
            maxPrice ? `to $${Number(maxPrice).toLocaleString()}` : null,
          ].filter(Boolean).join(" · ") || "Saved map search",
      query: normalizedQuery || undefined,
      geography: inferredGeography,
      strategy: normalizedQuery.toLowerCase().includes("multiplex")
        ? "multiplex"
        : normalizedQuery.toLowerCase().includes("brrr")
          ? "brrr"
          : undefined,
      propertyType: propertyType !== "all" ? propertyType : undefined,
      budgetMax: maxPrice ? Number(maxPrice) : undefined,
      targetGrossYield: minGrossYield ? Number(minGrossYield) : minCapRate ? Number(minCapRate) : undefined,
      financingIntent: true,
      renovationIntent: normalizedQuery.toLowerCase().includes("flip") || normalizedQuery.toLowerCase().includes("brrr"),
    };

    persistSavedSearchSignal(savedSearch);
    setSavedSearches(getSavedSearchSignals().slice(0, 4));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
      // Also create the first-class saved search that powers email alerts
      // (server/watchlists.ts). Daily digest-style by default — one email per
      // window with every new match, never one email per listing.
      const toNumber = (value: string) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      };
      apiRequest("POST", "/api/watchlists/searches", {
        name: savedSearch.label.slice(0, 120),
        criteria: {
          query: savedSearch.query,
          city: inferredGeography,
          propertyType: savedSearch.propertyType,
          minCap: minCapRate ? toNumber(minCapRate) : undefined,
          minPrice: minPrice ? toNumber(minPrice) : undefined,
          maxPrice: maxPrice ? toNumber(maxPrice) : undefined,
          country: "CA",
        },
        frequency: "daily",
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      }).catch((error) => {
        console.error("Failed to save search for alerts:", error);
      });
    }
    track({
      event: "saved_search",
      geography: savedSearch.geography,
      filters: {
        query: savedSearch.query,
        strategy: savedSearch.strategy,
        propertyType: savedSearch.propertyType,
        budgetMax: savedSearch.budgetMax,
        targetGrossYield: savedSearch.targetGrossYield,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        minBeds,
        minUnits,
        sortMetric,
        metricSource,
      },
    });
    toast({
      title: "Search saved",
      description: isAuthenticated
        ? "You'll get an email when new listings match this search. Manage it on your watchlist."
        : "This search now appears in your investor workspace. Create an account to get new-match email alerts.",
    });
  };

  const handleSaveShortlist = (listing: ListingWithCapRate) => {
    const signal = buildListingSignal(listing, "map_shortlist");
    persistSavedListingSignal(signal);
    setSavedShortlist(getSavedListingSignals().slice(0, 4));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
    }
    track({
      event: "saved_listing",
      listing_id: listing.mlsNumber || signal.address,
      city: listing.address?.city || undefined,
      price: signal.price,
      property_type: signal.propertyType,
      source: "map_shortlist",
    });
    toast({
      title: "Saved to shortlist",
      description: "This property is saved as a discovery shortcut.",
    });
  };

  const handleSelectListing = (listing: ListingWithCapRate, source: "map" | "list" = "list") => {
    setSelectedListing(listing);
    setSelectedDistressListing(null);
    setDetailTab("overview");
    setUwUnitCount(String(listing.unitCount || 1));
    const perUnitRent = listing.unitCount > 1
      ? Math.round(listing.estimatedMonthlyRent / listing.unitCount)
      : Math.round(listing.estimatedMonthlyRent);
    setUwRentPerUnit(String(perUnitRent));
    if (source === "list" && listing.map?.latitude && listing.map?.longitude) {
      setFlyTo({ lat: listing.map.latitude, lng: listing.map.longitude });
    }
    saveWorkspaceState({ selectedMls: listing.mlsNumber, analyzerOpen: Boolean(analyzerSheetMeta) });
    updateWorkspaceUrl({ selectedMls: listing.mlsNumber });
    persistRecentViewedListingSignal(buildListingSignal(listing, "map_recent_view"));
    setRecentViewedListings(getRecentViewedListingSignals().slice(0, 4));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
    }
    track({
      event: "listing_card_opened",
      listing_id: listing.mlsNumber,
      city: listing.address?.city || undefined,
      property_type: listing.details?.propertyType || listing.type || undefined,
      price: typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice,
      source,
    });
    track({
      event: "listing_viewed",
      listing_id: listing.mlsNumber,
      city: listing.address?.city || undefined,
      property_type: listing.details?.propertyType || listing.type || undefined,
      price: typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice,
      gross_yield: listing.grossYield || undefined,
    });
    const ref = listingRefs.current[listing.mlsNumber];
    if (source === "list" && ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleSelectDistressListing = (listing: DistressListing) => {
    setSelectedListing(null);
    setSelectedDistressListing(listing);
    setDetailTab("overview");
    if (listing.map?.latitude && listing.map?.longitude) {
      setFlyTo({ lat: listing.map.latitude, lng: listing.map.longitude, zoom: 15 });
    }
  };

  // Lightweight card for US (HomeHarvest) listings in US-only mode. US rows
  // have no CREA yield metrics, so the card sticks to the facts + source link.
  const renderUsListingCard = (listing: UsMapListing) => {
    const details = [
      listing.beds != null ? `${listing.beds} bd` : null,
      listing.baths != null ? `${listing.baths} ba` : null,
      listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null,
    ].filter(Boolean).join(" · ");
    return (
      <div
        key={`us-${listing.id}`}
        className="rounded-lg border border-border transition-all hover:border-primary/50 hover:shadow-sm"
        data-testid={`card-us-listing-${listing.id}`}
      >
        <div className="flex flex-col gap-1 p-2.5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-bold" data-testid={`text-us-price-${listing.id}`}>
              {listing.listPrice ? formatPrice(listing.listPrice) : "Price unavailable"}
            </span>
            <Badge variant="outline" className="px-1 text-[9px] flex-shrink-0 border-blue-400 text-blue-700 dark:text-blue-300">
              US
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {listing.formattedAddress}
          </p>
          {details && <p className="text-[11px] text-muted-foreground">{details}</p>}
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {listing.propertyType || "Residential"}
              {listing.daysOnMarket != null ? ` · ${listing.daysOnMarket} DOM` : ""}
            </span>
            {listing.sourceUrl && (
              <a
                href={listing.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold text-blue-700 dark:text-blue-300"
                onClick={(event) => event.stopPropagation()}
              >
                Open source listing
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderListingCard = (listing: ListingWithCapRate) => {
    const imgUrl = getImageUrl(listing.images);
    const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
    const isSelected = selectedListing?.mlsNumber === listing.mlsNumber;
    const aggregate = aggregatesMap[listing.mlsNumber];
    const myMetrics = myAnalysisMetricsMap[listing.mlsNumber];
    const distressListing = distressMap[listing.mlsNumber];
    const primaryMetricValue = getListingMetricValue(listing, sortMetric, aggregate, metricSource, myMetrics);
    const primaryMetricLabel = metricLabel(sortMetric);
    const primaryMetricConfidence = getMetricPrimaryConfidence(listing, sortMetric);
    const multiplexScan = buildMultiplexListingScan(listing);
    const multiplexScanTone = multiplexScan.status === "likely"
      ? "border-ai/40 bg-ai/10 text-ai"
      : multiplexScan.status === "possible"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border/70 bg-muted/35 text-muted-foreground";
    const questionSnapshot = buildListingQuestionSnapshot(listing);

    return (
      <div
        key={listing.mlsNumber}
        ref={(el) => { listingRefs.current[listing.mlsNumber] = el; }}
        className={`rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border hover:border-primary/50 hover:shadow-sm"
        }`}
        onClick={() => handleSelectListing(listing, "list")}
        data-testid={`card-listing-${listing.mlsNumber}`}
      >
        <div className="flex gap-3 p-2.5">
          <div className="relative flex-shrink-0">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={formatShortAddress(listing.address)}
                className="w-24 h-20 object-cover rounded-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-24 h-20 bg-muted rounded-md flex items-center justify-center">
                <Building className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-bold" data-testid={`text-price-${listing.mlsNumber}`}>
                  {formatPrice(price)}
                </span>
                <Badge variant="outline" className="px-1 text-[9px] flex-shrink-0" data-testid={`badge-country-${listing.mlsNumber}`}>
                  CA
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={sortMetric === "price" ? "outline" : getCapRateBadgeVariant((typeof primaryMetricValue === "number" ? primaryMetricValue : listing.capRate) || 0)}
                  className="text-[10px] flex-shrink-0"
                  data-testid={`badge-cap-rate-${listing.mlsNumber}`}
                >
                  {formatMetricValue(sortMetric, primaryMetricValue, aggregate?.consensusLabel, aggregate?.publicAnalysisCount)}
                </Badge>
                <span className="text-[9px] text-muted-foreground">{primaryMetricLabel}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground truncate mb-1" data-testid={`text-address-${listing.mlsNumber}`}>
              {formatShortAddress(listing.address)}, {listing.address?.city}
            </p>

            {distressListing && (
              <div className="mb-1 flex items-center gap-1.5">
                {distressListing.distress.categoriesTriggered.foreclosure_pos && (
                  <Badge variant="outline" className="text-[10px] gap-1" data-testid={`badge-distress-${listing.mlsNumber}`}>
                    <Gavel className="h-3 w-3" />
                    POS/foreclosure
                  </Badge>
                )}
                {distressListing.distress.categoriesTriggered.vtb && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <DollarSign className="h-3 w-3" />
                    VTB
                  </Badge>
                )}
                {distressListing.distress.categoriesTriggered.motivated && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Motivated
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {listing.unitCount > 1 && (
                <span className="flex items-center gap-0.5 font-medium text-primary">
                  <Building className="h-3 w-3" />
                  {listing.unitCount}u
                </span>
              )}
              {listing.kitchenCount && listing.kitchenCount > 1 && (
                <span className="flex items-center gap-0.5 font-medium text-amber-600">
                  {listing.kitchenCount} kitchens
                </span>
              )}
              {listing.details?.numBedrooms != null && (
                <span className="flex items-center gap-0.5">
                  <BedDouble className="h-3 w-3" />
                  {listing.details.numBedrooms}
                </span>
              )}
              {listing.details?.numBathrooms != null && (
                <span className="flex items-center gap-0.5">
                  <Bath className="h-3 w-3" />
                  {listing.details.numBathrooms}
                </span>
              )}
              {listing.details?.sqft && (
                <span className="flex items-center gap-0.5">
                  <Maximize className="h-3 w-3" />
                  {listing.details.sqft}
                </span>
              )}
            </div>

            <div className="mt-1 rounded-md bg-muted/40 px-2 py-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{primaryMetricLabel}</span>
                <span className="font-semibold">
                  {formatMetricValue(sortMetric, primaryMetricValue, aggregate?.consensusLabel, aggregate?.publicAnalysisCount)}
                </span>
              </div>
              {primaryMetricConfidence && (
                <div className={`mt-1 text-[9px] ${getMetricConfidenceTone(primaryMetricConfidence)}`}>
                  {primaryMetricConfidence === "low" ? "Low-confidence estimate" : `${primaryMetricConfidence[0].toUpperCase()}${primaryMetricConfidence.slice(1)} confidence`}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
              <span>Gross yield: {listing.grossYield != null ? `${listing.grossYield.toFixed(1)}%` : "N/A"}</span>
              <span>Cap rate: {listing.capRate != null ? `${listing.capRate.toFixed(1)}%` : "N/A"}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
              <span>Rent: {formatPrice(listing.estimatedMonthlyRent)}/mo{listing.unitCount > 1 ? ` (${listing.unitCount}×${formatPrice(Math.round(listing.estimatedMonthlyRent / listing.unitCount))})` : ""}</span>
              <span>CF: {formatCompactCurrency(listing.monthlyCashFlow)}</span>
            </div>

            <ReplacementCostEstimate
              squareFootage={listing.details?.sqft}
              yearBuilt={listing.details?.yearBuilt}
              propertyType={listing.details?.propertyType || listing.type}
              listingKey={listing.mlsNumber}
            />

            <div className={`mt-2 rounded-md border px-2 py-1.5 ${multiplexScanTone}`} data-testid={`multiplex-scan-${listing.mlsNumber}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
                  <Sparkles className="h-3 w-3" />
                  {multiplexScan.label}
                </span>
                <span className="text-[9px] font-semibold">{multiplexScan.confidence}/100</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug opacity-90">{multiplexScan.summary}</p>
            </div>

            <SalePriceEstimatePrompt listing={listing} isAuthenticated={isAuthenticated} />
            <ListingSentimentControls listing={listing} />

            <div className="flex items-center justify-between mt-1">
              {(() => {
                if (aggregate && ((aggregate.publicAnalysisCount ?? 0) > 0 || (aggregate.publicCommentCount ?? 0) > 0)) {
                  return (
                    <div className="flex flex-col items-start gap-1">
                      <CommunityAnalysisBadge aggregate={aggregate} />
                      <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground" data-testid={`text-community-stats-${listing.mlsNumber}`}>
                        <span>By {aggregate.uniquePublicUserCount || 0} users</span>
                        {aggregate.medianCapRate != null && <span>{aggregate.medianCapRate.toFixed(1)}% median cap</span>}
                        {aggregate.medianMonthlyCashFlow != null && <span>${Math.round(aggregate.medianMonthlyCashFlow).toLocaleString()}/mo median CF</span>}
                      </div>
                    </div>
                  );
                }
                return (
                  <span className="text-[9px] text-primary cursor-pointer" data-testid={`link-first-analyze-${listing.mlsNumber}`}>
                    Be first to analyze
                  </span>
                );
              })()}
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors flex-shrink-0"
                data-testid={`badge-analyze-deal-${listing.mlsNumber}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyzeListing(listing);
                }}
              >
                <Calculator className="h-2.5 w-2.5 mr-0.5" />
                Analyze Deal
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {listing.mlsNumber && (
                <Link
                  href={`/listings/${encodeURIComponent(listing.mlsNumber)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  data-testid={`link-listing-page-${listing.mlsNumber}`}
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Listing page
                </Link>
              )}
              <Link
                href={multiplexScan.href}
                onClick={(e) => {
                  e.stopPropagation();
                  track({
                    event: "feature_used",
                    feature: "multiplex_underwriter",
                    details: {
                      listing_id: listing.mlsNumber,
                      source: "map_listing_card",
                      confidence: multiplexScan.confidence,
                    },
                  });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-ai/40 bg-ai/5 px-1.5 text-[10px] font-semibold text-ai transition-colors hover:bg-ai hover:text-white"
                data-testid={`link-multiplex-underwriter-${listing.mlsNumber}`}
              >
                <Sparkles className="h-2.5 w-2.5" />
                Full multiplex underwrite
              </Link>
              <ListingCommentCountBadge
                count={aggregatesMap[listing.mlsNumber]?.publicCommentCount}
                hasRecent={Boolean(aggregatesMap[listing.mlsNumber]?.latestPublicCommentAt)}
              />
              <div onClick={(e) => e.stopPropagation()} className="min-w-[132px]">
                <PropertyQuestionWidget
                  listingMlsNumber={listing.mlsNumber}
                  compact
                  buttonLabel="Ask question"
                  listingSnapshot={questionSnapshot}
                />
              </div>
              {(aggregatesMap[listing.mlsNumber]?.publicAnalysisCount || 0) > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectListing(listing);
                    setDetailTab("community");
                  }}
                >
                  View community analyses
                </Badge>
              )}
              {aggregatesMap[listing.mlsNumber]?.latestPublicAnalysisAt && (
                <Badge variant="outline" className="text-[10px]">
                  Last analyzed {new Date(aggregatesMap[listing.mlsNumber].latestPublicAnalysisAt as Date | string).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDistressCard = (listing: DistressListing) => {
    const imgUrl = getImageUrl(listing.images);
    const isSelected = selectedDistressListing?.mlsNumber === listing.mlsNumber;
    return (
      <div
        key={`distress-${listing.mlsNumber}`}
        className={`rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? "border-red-500 bg-red-500/5 ring-1 ring-red-500"
            : "border-border hover:border-red-500/50 hover:shadow-sm"
        }`}
        onClick={() => handleSelectDistressListing(listing)}
        data-testid={`card-distress-${listing.mlsNumber}`}
      >
        <div className="flex gap-3 p-2.5">
          <div className="relative flex-shrink-0">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={formatShortAddress(listing.address as RepliersListing["address"])}
                className="w-24 h-20 object-cover rounded-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-24 h-20 bg-muted rounded-md flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold">{formatPrice(listing.listPrice)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {formatShortAddress(listing.address as RepliersListing["address"])}, {listing.address?.city}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {listing.distress.categoriesTriggered.foreclosure_pos && <Badge variant="outline" className="text-[10px]">POS/foreclosure</Badge>}
              {listing.distress.categoriesTriggered.vtb && <Badge variant="outline" className="text-[10px]">VTB</Badge>}
              {listing.distress.categoriesTriggered.motivated && <Badge variant="outline" className="text-[10px]">Motivated</Badge>}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] text-muted-foreground">
              {listing.rawRemarks || listing.details?.description || "Motivated-seller indicators detected in listing remarks."}
            </p>
            <ReplacementCostEstimate
              squareFootage={listing.details?.sqft}
              yearBuilt={listing.details?.yearBuilt}
              propertyType={listing.details?.propertyType}
              listingKey={`distress-${listing.mlsNumber}`}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleSubmitUnderwriting = () => {
    if (!selectedListing || !isAuthenticated) return;
    const unitCount = parseInt(uwUnitCount) || 1;
    const rentPerUnit = parseFloat(uwRentPerUnit) || selectedListing.estimatedMonthlyRent;
    const price = typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice;
    const metrics = computeUwCapRate();
    submitAnalysisMutation.mutate({
      listingMlsNumber: selectedListing.mlsNumber,
      title: `${formatShortAddress(selectedListing.address)} underwriting`,
      summary: metrics.monthlyCashFlow > 0
        ? "Positive monthly cash flow under current underwriting."
        : "Negative monthly cash flow under current underwriting.",
      userNotes: uwNoteText,
      city: selectedListing.address?.city,
      province: selectedListing.address?.state,
      market: selectedListing.address?.city,
      propertyType: selectedListing.details?.propertyType || selectedListing.type,
      listingPrice: price,
      visibility: analysisVisibility,
      assumptions: {
        rent: {
          unitCount,
          rentPerUnit,
          projectedMonthlyRent: unitCount * rentPerUnit,
        },
        vacancy: { percent: parseFloat(uwVacancy) || 5 },
        expenses: { expenseRatio: parseFloat(uwExpenseRatio) || 35 },
        financing: {
          downPaymentPercent: parseFloat(uwDownPaymentPercent) || 20,
          interestRate: parseFloat(uwInterestRate) || 5.5,
          amortizationYears: parseFloat(uwAmortizationYears) || 25,
        },
      },
      calculatedMetrics: {
        capRate: metrics.capRate,
        annualNoi: metrics.noi,
        monthlyCashFlow: metrics.monthlyCashFlow,
        cashOnCash: metrics.cashOnCash,
        dscr: metrics.dscr,
        projectedRent: unitCount * rentPerUnit,
      },
      listingSnapshot: {
        address: selectedListing.address,
        listPrice: price,
        details: selectedListing.details,
        taxes: selectedListing.taxes,
        mlsNumber: selectedListing.mlsNumber,
      },
      sourceContext: {
        source: "cap_rates_map",
        selectedGrossYield: selectedListing.grossYield,
        selectedCapRate: selectedListing.capRate,
        selectedEstimatedRent: selectedListing.estimatedMonthlyRent,
      },
      dataUseConsent: analysisConsent,
    });
  };

  const handleSubmitComment = (body: string, visibility: "public" | "private", parentCommentId?: string) => {
    if (!selectedListing || !isAuthenticated || !body.trim()) return;
    submitCommentMutation.mutate({
      listingMlsNumber: selectedListing.mlsNumber,
      body,
      visibility,
      parentCommentId,
    });
  };

  const computeUwCapRate = () => {
    if (!selectedListing) return { capRate: 0, noi: 0, grossRent: 0, monthlyCashFlow: 0, cashOnCash: 0, dscr: 0, monthlyDebtService: 0 };
    const unitCount = parseInt(uwUnitCount) || 1;
    const rentPerUnit = parseFloat(uwRentPerUnit) || selectedListing.estimatedMonthlyRent;
    const vacancy = parseFloat(uwVacancy) || 5;
    const expenseRatio = parseFloat(uwExpenseRatio) || 35;
    const downPaymentPercent = parseFloat(uwDownPaymentPercent) || 20;
    const interestRate = parseFloat(uwInterestRate) || 5.5;
    const amortizationYears = parseFloat(uwAmortizationYears) || 25;
    const price = typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice;
    const grossRent = unitCount * rentPerUnit * 12;
    const effectiveRent = grossRent * (1 - vacancy / 100);
    const expenses = grossRent * (expenseRatio / 100);
    const noi = effectiveRent - expenses;
    const capRate = price > 0 ? (noi / price) * 100 : 0;
    const loanAmount = price * (1 - downPaymentPercent / 100);
    const monthlyRate = interestRate / 100 / 12;
    const amortizationMonths = amortizationYears * 12;
    const monthlyDebtService = monthlyRate > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths)) / (Math.pow(1 + monthlyRate, amortizationMonths) - 1)
      : loanAmount / Math.max(amortizationMonths, 1);
    const monthlyCashFlow = noi / 12 - monthlyDebtService;
    const cashInvested = price * (downPaymentPercent / 100);
    const cashOnCash = cashInvested > 0 ? ((monthlyCashFlow * 12) / cashInvested) * 100 : 0;
    const dscr = monthlyDebtService > 0 ? (noi / 12) / monthlyDebtService : 0;
    return { capRate: Math.max(0, capRate), noi, grossRent, monthlyCashFlow, cashOnCash, dscr, monthlyDebtService };
  };

  const renderDetailPanel = () => {
    if (!selectedListing) return null;
    const agg = aggregatesMap[selectedListing.mlsNumber];
    const myMetrics = myAnalysisMetricsMap[selectedListing.mlsNumber];
    const primaryMetricValue = getListingMetricValue(selectedListing, sortMetric, agg, metricSource, myMetrics);
    const primaryMetricConfidence = getMetricPrimaryConfidence(selectedListing, sortMetric);
    const uwCalc = computeUwCapRate();
    const multiplexScan = buildMultiplexListingScan(selectedListing);
    const questionSnapshot = buildListingQuestionSnapshot(selectedListing);
    const multiplexScanTone = multiplexScan.status === "likely"
      ? "border-ai/40 bg-ai/10"
      : multiplexScan.status === "possible"
        ? "border-amber-500/40 bg-amber-500/10"
        : "border-border/70 bg-muted/30";

    return (
      <div data-testid="panel-listing-detail">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CardTitle className="text-xl">
                    {formatPriceFull(selectedListing.listPrice)}
                  </CardTitle>
                  <Badge variant={getCapRateBadgeVariant((typeof primaryMetricValue === "number" ? primaryMetricValue : selectedListing.capRate) || 0)} data-testid="badge-detail-cap-rate">
                    {formatMetricValue(sortMetric, primaryMetricValue, agg?.consensusLabel, agg?.publicAnalysisCount)} {metricShortLabel(sortMetric)}
                  </Badge>
                  {agg?.medianCapRate != null && (
                    <Badge variant="secondary" className="text-[10px]" data-testid="badge-detail-community-cap">
                      <Users className="h-3 w-3 mr-0.5" />
                      {agg.medianCapRate.toFixed(1)}%
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {formatAddress(selectedListing.address)}
                </CardDescription>
                {selectedListing.mlsNumber && (
                  <Link
                    href={`/listings/${encodeURIComponent(selectedListing.mlsNumber)}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    data-testid="link-detail-listing-page"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Full listing page
                  </Link>
                )}
                <ListingEngagementStrip mlsNumber={selectedListing.mlsNumber} compact className="mt-1.5" />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedListing(null)}
                data-testid="button-close-detail"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
              <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
                <TabsTrigger value="overview" className="flex-1 rounded-none text-xs py-2" data-testid="tab-overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="underwrite" className="flex-1 rounded-none text-xs py-2" data-testid="tab-underwrite">
                  <PenLine className="h-3 w-3 mr-1" />
                  Underwrite
                </TabsTrigger>
                <TabsTrigger value="community" className="flex-1 rounded-none text-xs py-2" data-testid="tab-community">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Community
                  {agg && ((agg.publicAnalysisCount ?? 0) > 0 || (agg.publicCommentCount ?? 0) > 0) && (
                    <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                      {(agg.publicAnalysisCount ?? 0) + (agg.publicCommentCount ?? 0)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-4 space-y-4 mt-0">
                {selectedListing.images && selectedListing.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedListing.images.filter(img => img.startsWith("http") && !img.includes("youriguide") && !img.includes("virtualtour")).slice(0, 4).map((img, idx) => {
                      const url = img.startsWith("http") ? img : `https://cdn.repliers.io/${img}`;
                      return (
                        <img
                          key={idx}
                          src={url}
                          alt={`Photo ${idx + 1}`}
                          className={`rounded-md object-cover w-full ${idx === 0 ? "col-span-2 h-[160px]" : "h-[80px]"}`}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          data-testid={`img-detail-${idx}`}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {selectedListing.details?.numBedrooms != null && (
                    <div className="flex items-center gap-1">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedListing.details.numBedrooms}</span>
                      <span className="text-xs text-muted-foreground">beds</span>
                    </div>
                  )}
                  {selectedListing.details?.numBathrooms != null && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedListing.details.numBathrooms}</span>
                      <span className="text-xs text-muted-foreground">baths</span>
                    </div>
                  )}
                  {selectedListing.details?.sqft && (
                    <div className="flex items-center gap-1">
                      <Maximize className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedListing.details.sqft}</span>
                      <span className="text-xs text-muted-foreground">sqft</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedListing.details?.propertyType && (
                    <Badge variant="outline" className="text-xs">{selectedListing.details.propertyType}</Badge>
                  )}
                  {selectedListing.details?.style && (
                    <Badge variant="outline" className="text-xs">{selectedListing.details.style}</Badge>
                  )}
                  {selectedListing.details?.yearBuilt && (
                    <Badge variant="outline" className="text-xs">Built {selectedListing.details.yearBuilt}</Badge>
                  )}
                  {selectedListing.kitchenCount && selectedListing.kitchenCount > 1 && (
                    <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700">
                      {selectedListing.kitchenCount} kitchens detected
                    </Badge>
                  )}
                </div>
                {selectedListing.plexConfidenceScore && selectedListing.plexConfidenceScore >= 30 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    {selectedListing.plexDetectionReason}
                  </div>
                )}

                <div className={`rounded-lg border p-3 ${multiplexScanTone}`} data-testid="panel-multiplex-scan">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Sparkles className="h-4 w-4 text-ai" />
                        {multiplexScan.label}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{multiplexScan.summary}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {multiplexScan.confidence}/100
                    </Badge>
                  </div>
                  {multiplexScan.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {multiplexScan.evidence.map((item) => (
                        <Badge key={item} variant="outline" className="text-[10px]">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{multiplexScan.sourceNote}</p>
                  <Button asChild className="mt-3 w-full" data-testid="button-open-multiplex-underwriter">
                    <Link
                      href={multiplexScan.href}
                      onClick={() => track({
                        event: "feature_used",
                        feature: "multiplex_underwriter",
                        details: {
                          listing_id: selectedListing.mlsNumber,
                          source: "map_detail_panel",
                          confidence: multiplexScan.confidence,
                        },
                      })}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Open full multiplex underwriter
                    </Link>
                  </Button>
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleAnalyzeListing(selectedListing)}
                  data-testid="button-analyze-listing"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Analyze in Map Workspace
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSaveShortlist(selectedListing)}
                  data-testid="button-save-shortlist"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Save to shortlist
                </Button>
                {selectedListing.mlsNumber && (
                  <PropertyQuestionWidget
                    listingMlsNumber={selectedListing.mlsNumber}
                    listingSnapshot={questionSnapshot}
                    buttonLabel="Ask the experts"
                  />
                )}
                {selectedListing.mlsNumber && (
                  <WatchListingButton
                    className="w-full"
                    listingKey={selectedListing.mlsNumber}
                    source="ddf"
                    address={formatAddress(selectedListing.address)}
                    city={selectedListing.address?.city || undefined}
                    price={(() => {
                      const parsed = typeof selectedListing.listPrice === "string"
                        ? parseFloat(selectedListing.listPrice)
                        : selectedListing.listPrice;
                      return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
                    })()}
                  />
                )}
                <CommunityMetricsSummary aggregate={agg} />
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{metricLabel(sortMetric)}</span>
                    <span className="font-semibold">{formatMetricValue(sortMetric, primaryMetricValue, agg?.consensusLabel, agg?.publicAnalysisCount)}</span>
                  </div>
                  {metricSource === "realist_estimate" && (
                    <p className="mt-1 text-muted-foreground">Based on Realist assumptions.</p>
                  )}
                  {metricSource === "community_median" && (
                    <p className="mt-1 text-muted-foreground">Based on public community median where available.</p>
                  )}
                  {metricSource === "my_saved_analyses" && (
                    <p className="mt-1 text-muted-foreground">Based on your saved analyses where available.</p>
                  )}
                  {primaryMetricConfidence && (
                    <p className={`mt-1 ${getMetricConfidenceTone(primaryMetricConfidence)}`}>
                      {primaryMetricConfidence === "low" ? "Low-confidence estimate" : `${primaryMetricConfidence[0].toUpperCase()}${primaryMetricConfidence.slice(1)} confidence`}
                    </p>
                  )}
                </div>
                {(agg?.publicAnalysisCount || 0) > 0 && (
                  <Button variant="outline" className="w-full" onClick={() => setShowCommunityModal(true)}>
                    View community analyses
                  </Button>
                )}

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Estimated Metrics
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedListing.unitCount > 1 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Units</span>
                        <span className="font-medium">{selectedListing.unitCount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Rent{selectedListing.unitCount > 1 ? " (total)" : ""}</span>
                      <span className="font-medium">
                        {formatPriceFull(selectedListing.estimatedMonthlyRent)}
                        {selectedListing.unitCount > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({selectedListing.unitCount}×{formatPriceFull(Math.round(selectedListing.estimatedMonthlyRent / selectedListing.unitCount))})
                          </span>
                        )}
                        {selectedListing.rentSource === "estimated" && (
                          <span className="text-[10px] text-muted-foreground ml-1">(est.)</span>
                        )}
                        {selectedListing.rentSource === "actual" && (
                          <span className="text-[10px] text-green-600 ml-1">(actual)</span>
                        )}
                        {selectedListing.rentSource === "market" && (
                          <span className="text-[10px] text-blue-600 ml-1">(scraped)</span>
                        )}
                        {selectedListing.rentSource === "cmhc_city" && (
                          <span className="text-[10px] text-cyan-600 ml-1">(CMHC city)</span>
                        )}
                        {selectedListing.rentSource === "cmhc_province" && (
                          <span className="text-[10px] text-amber-600 ml-1">(CMHC prov.)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Annual Rent</span>
                      <span className="font-medium">{formatPriceFull(selectedListing.estimatedMonthlyRent * 12)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated gross yield</span>
                      <span className="font-medium">{selectedListing.grossYield != null ? `${selectedListing.grossYield.toFixed(2)}%` : "N/A"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Vacancy ({EXPENSE_ASSUMPTIONS.vacancyPercent}%)</span>
                      <span className="text-red-500">-{formatPriceFull(selectedListing.estimatedMonthlyRent * 12 * EXPENSE_ASSUMPTIONS.vacancyPercent / 100)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Maintenance ({EXPENSE_ASSUMPTIONS.maintenancePercent}%)</span>
                      <span className="text-red-500">-{formatPriceFull(selectedListing.estimatedMonthlyRent * 12 * EXPENSE_ASSUMPTIONS.maintenancePercent / 100)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Management ({EXPENSE_ASSUMPTIONS.managementPercent}%)</span>
                      <span className="text-red-500">-{formatPriceFull(selectedListing.estimatedMonthlyRent * 12 * EXPENSE_ASSUMPTIONS.managementPercent / 100)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Insurance</span>
                      <span className="text-red-500">-{formatPriceFull(EXPENSE_ASSUMPTIONS.insurancePerUnit * Math.max(1, selectedListing.unitCount || 1))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Property Tax</span>
                      <span className="text-red-500">
                        -{formatPriceFull(
                          selectedListing.taxes?.annualAmount ||
                          (typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice) * EXPENSE_ASSUMPTIONS.propertyTaxPercent / 100
                        )}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Annual NOI</span>
                      <span className={selectedListing.annualNOI >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatPriceFull(selectedListing.annualNOI)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Estimated cap rate</span>
                      <span className={getCapRateColor(selectedListing.capRate)}>
                        {selectedListing.capRate.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated monthly cash flow</span>
                      <span className={selectedListing.monthlyCashFlow != null && selectedListing.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCompactCurrency(selectedListing.monthlyCashFlow)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated cash-on-cash</span>
                      <span>{selectedListing.cashOnCashReturn != null ? `${selectedListing.cashOnCashReturn.toFixed(2)}%` : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DSCR</span>
                      <span>{selectedListing.dscr != null ? selectedListing.dscr.toFixed(2) : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated IRR</span>
                      <span>{selectedListing.irr != null ? `${selectedListing.irr.toFixed(2)}%` : "IRR unavailable"}</span>
                    </div>
                  </div>
                </div>

                <details className="rounded-lg border border-border/60 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold">View assumptions</summary>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Purchase price</span><span>{formatPriceFull(selectedListing.listPrice)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Estimated rent</span><span>{formatPriceFull(selectedListing.assumptionsUsed.monthlyRent)}/mo</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Vacancy</span><span>{selectedListing.assumptionsUsed.vacancyPercent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Maintenance</span><span>{selectedListing.assumptionsUsed.maintenancePercent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Management</span><span>{selectedListing.assumptionsUsed.managementPercent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Property tax</span><span>{formatPriceFull(selectedListing.assumptionsUsed.annualPropertyTax || 0)}/yr</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span>{formatPriceFull(selectedListing.assumptionsUsed.annualInsurance || 0)}/yr</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Down payment</span><span>{selectedListing.assumptionsUsed.downPaymentPercent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Interest rate</span><span>{selectedListing.assumptionsUsed.interestRate}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Amortization</span><span>{selectedListing.assumptionsUsed.amortizationYears} yrs</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Hold period</span><span>{selectedListing.assumptionsUsed.holdPeriodYears} yrs</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Exit appreciation</span><span>{selectedListing.assumptionsUsed.annualAppreciationPercent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Calculation version</span><span>{selectedListing.assumptionsComplete ? "realist-investment-metrics-v1" : "Missing assumptions"}</span></div>
                    {agg?.medianProjectedRent != null && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Community median rent</span><span>{formatPriceFull(agg.medianProjectedRent)}/mo</span></div>
                    )}
                    {agg?.medianExpenseRatio != null && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Community median expense ratio</span><span>{agg.medianExpenseRatio.toFixed(1)}%</span></div>
                    )}
                    {selectedListing.calculationWarnings.length > 0 && (
                      <div className="rounded-md bg-amber-50 p-2 text-amber-900">
                        {selectedListing.calculationWarnings.join(" ")}
                      </div>
                    )}
                  </div>
                </details>

                <Separator />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">MLS#</p>
                    <p className="font-medium">{selectedListing.mlsNumber}</p>
                  </div>
                  {selectedListing.address?.neighborhood && (
                    <div>
                      <p className="text-muted-foreground">Neighborhood</p>
                      <p className="font-medium">{selectedListing.address.neighborhood}</p>
                    </div>
                  )}
                  {selectedListing.daysOnMarket != null && (
                    <div>
                      <p className="text-muted-foreground">Days on Market</p>
                      <p className="font-medium">{selectedListing.daysOnMarket}</p>
                    </div>
                  )}
                  {selectedListing.details?.numParkingSpaces != null && (
                    <div>
                      <p className="text-muted-foreground">Parking</p>
                      <p className="font-medium">{selectedListing.details.numParkingSpaces} spaces</p>
                    </div>
                  )}
                </div>

                {selectedListing.details?.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium mb-1">Description</p>
                      <p className="text-xs text-muted-foreground line-clamp-4">
                        {selectedListing.details.description}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                <MiniDealAnalyzer
                  price={typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice}
                  monthlyRent={selectedListing.estimatedMonthlyRent}
                  annualPropertyTax={selectedListing.taxes?.annualAmount}
                  unitCount={selectedListing.unitCount}
                />
              </TabsContent>

              <TabsContent value="underwrite" className="p-4 space-y-4 mt-0">
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <PenLine className="h-4 w-4" />
                    Save Your Analysis
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Save structured underwriting to this listing. Public analyses appear in community history by default.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Unit Count</Label>
                    <Input
                      type="number"
                      min="1"
                      value={uwUnitCount}
                      onChange={(e) => setUwUnitCount(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-unit-count"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rent / Unit ($/mo)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder={String(Math.round(selectedListing.estimatedMonthlyRent))}
                      value={uwRentPerUnit}
                      onChange={(e) => setUwRentPerUnit(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-rent"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vacancy (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={uwVacancy}
                      onChange={(e) => setUwVacancy(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-vacancy"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expense Ratio (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={uwExpenseRatio}
                      onChange={(e) => setUwExpenseRatio(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-expense-ratio"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Down Payment (%)</Label>
                    <Input type="number" min="0" max="100" value={uwDownPaymentPercent} onChange={(e) => setUwDownPaymentPercent(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Interest Rate (%)</Label>
                    <Input type="number" min="0" max="25" value={uwInterestRate} onChange={(e) => setUwInterestRate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Amortization (yrs)</Label>
                    <Input type="number" min="1" max="40" value={uwAmortizationYears} onChange={(e) => setUwAmortizationYears(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Annual Rent</span>
                    <span className="font-medium">{formatPriceFull(uwCalc.grossRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vacancy ({uwVacancy || "5"}%)</span>
                    <span className="text-red-500">-{formatPriceFull(uwCalc.grossRent * (parseFloat(uwVacancy) || 5) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses ({uwExpenseRatio || "35"}%)</span>
                    <span className="text-red-500">-{formatPriceFull(uwCalc.grossRent * (parseFloat(uwExpenseRatio) || 35) / 100)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>NOI</span>
                    <span className={uwCalc.noi >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPriceFull(uwCalc.noi)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Debt Service / mo</span>
                    <span>{formatPriceFull(uwCalc.monthlyDebtService * 12)}/yr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Cash Flow</span>
                    <span className={uwCalc.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPriceFull(uwCalc.monthlyCashFlow * 12)}/yr
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Your Yield</span>
                    <span className={getCapRateColor(uwCalc.capRate)}>
                      {uwCalc.capRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash-on-Cash</span>
                    <span>{uwCalc.cashOnCash.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DSCR</span>
                    <span>{uwCalc.dscr.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Analysis notes</Label>
                  <Textarea
                    value={uwNoteText}
                    onChange={(e) => setUwNoteText(e.target.value)}
                    placeholder="Any context about your analysis..."
                    className="mt-1 text-xs resize-none"
                    rows={3}
                    data-testid="input-uw-note"
                  />
                </div>
                <AnalysisVisibilityToggle visibility={analysisVisibility} onChange={setAnalysisVisibility} />
                <AnalysisConsentNotice value={analysisConsent} onChange={setAnalysisConsent} />

                {isAuthenticated ? (
                  <Button
                    className="w-full"
                    onClick={handleSubmitUnderwriting}
                    disabled={submitAnalysisMutation.isPending}
                    data-testid="button-submit-underwriting"
                  >
                    {submitAnalysisMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Save analysis
                  </Button>
                ) : (
                  <div className="text-center text-xs text-muted-foreground p-3 border rounded-md">
                    <a href={authPath("/login")} className="text-primary underline" data-testid="link-login-underwrite">Sign in</a> to save your underwriting analysis
                  </div>
                )}
              </TabsContent>

              <TabsContent value="community" className="p-4 space-y-4 mt-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Community
                  </h4>
                  <div className="flex gap-2">
                    <Select value={analysisSort} onValueChange={(v) => setAnalysisSort(v as any)}>
                      <SelectTrigger className="h-8 w-[150px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest analyses</SelectItem>
                        <SelectItem value="most_useful">Most useful</SelectItem>
                        <SelectItem value="highest_cap_rate">Highest cap rate</SelectItem>
                        <SelectItem value="most_conservative">Most conservative</SelectItem>
                        <SelectItem value="most_bullish">Most bullish</SelectItem>
                        <SelectItem value="most_bearish">Most bearish</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setShowCommunityModal(true)}>
                      View community analyses
                    </Button>
                  </div>
                </div>

                <CommunityMetricsSummary aggregate={agg} />

                {selectedListing.mlsNumber && (
                  <PropertyQuestionsPanel
                    listingMlsNumber={selectedListing.mlsNumber}
                    listingSnapshot={questionSnapshot}
                  />
                )}

                {myAnalyses.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your saved analyses</p>
                    <div className="mt-2 space-y-2">
                      {myAnalyses.slice(0, 2).map((analysis) => (
                        <div key={analysis.id} className="rounded-md border border-border/60 p-2">
                          <p className="text-sm font-medium">{analysis.title || "Saved analysis"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(analysis.updatedAt || analysis.createdAt).toLocaleString()} · {analysis.visibility}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {privateNotes.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your private notes</p>
                    <div className="mt-2 space-y-2">
                      {privateNotes.slice(0, 3).map((note) => (
                        <div key={note.id} className="rounded-md border border-border/60 p-2">
                          <p className="text-sm">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ListingCommentsSection
                  comments={communityComments}
                  currentUserId={(user as any)?.id || null}
                  sort={communityCommentSort}
                  onSortChange={setCommunityCommentSort}
                  onSubmitComment={handleSubmitComment}
                  onHelpful={(commentId) => commentHelpfulMutation.mutate(commentId)}
                  onReport={(commentId) => commentReportMutation.mutate(commentId)}
                  onReply={(commentId, body) => handleSubmitComment(body, "public", commentId)}
                  onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                  isAuthenticated={isAuthenticated}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMapQuickCard = () => {
    if (!selectedListing) return null;
    const aggregate = aggregatesMap[selectedListing.mlsNumber];
    const myMetrics = myAnalysisMetricsMap[selectedListing.mlsNumber];
    const primaryMetricValue = getListingMetricValue(selectedListing, sortMetric, aggregate, metricSource, myMetrics);
    const imgUrl = getImageUrl(selectedListing.images);
    const multiplexScan = buildMultiplexListingScan(selectedListing);
    const questionSnapshot = buildListingQuestionSnapshot(selectedListing);

    return (
      <div className="rounded-2xl border border-border/70 bg-background/96 p-3 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={formatShortAddress(selectedListing.address)}
              className="h-20 w-24 rounded-lg object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-20 w-24 items-center justify-center rounded-lg bg-muted">
              <Building className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{formatShortAddress(selectedListing.address)}</p>
                <p className="text-xs text-muted-foreground">{selectedListing.address?.city}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedListing(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="outline">{formatPrice(selectedListing.listPrice)}</Badge>
              <Badge variant="secondary">{formatMetricValue(sortMetric, primaryMetricValue, aggregate?.consensusLabel, aggregate?.publicAnalysisCount)}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <span>Gross: {selectedListing.grossYield != null ? `${selectedListing.grossYield.toFixed(1)}%` : "N/A"}</span>
              <span>Cap: {selectedListing.capRate != null ? `${selectedListing.capRate.toFixed(1)}%` : "N/A"}</span>
              <span>CF: {formatCompactCurrency(selectedListing.monthlyCashFlow)}</span>
              <span>{aggregate?.publicAnalysisCount || 0} analyses</span>
            </div>
            <ReplacementCostEstimate
              squareFootage={selectedListing.details?.sqft}
              yearBuilt={selectedListing.details?.yearBuilt}
              propertyType={selectedListing.details?.propertyType || selectedListing.type}
              listingKey={`quick-${selectedListing.mlsNumber}`}
            />
            <div className="mt-2 rounded-md border border-ai/30 bg-ai/5 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1 font-semibold text-ai">
                  <Sparkles className="h-3 w-3" />
                  {multiplexScan.status === "likely" ? "Strong multiplex scan" : multiplexScan.status === "possible" ? "Possible multiplex scan" : "Run address underwrite"}
                </span>
                <span className="font-semibold text-muted-foreground">{multiplexScan.confidence}/100</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => handleAnalyzeListing(selectedListing)}>
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Analyze
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleSelectListing(selectedListing, "list")}>
            Open details
          </Button>
          <Button size="sm" variant="outline" className="shrink-0 px-2" asChild>
            <Link
              href={multiplexScan.href}
              aria-label="Open full multiplex underwriter"
              data-testid="link-quick-card-multiplex-underwriter"
              onClick={() => track({
                event: "feature_used",
                feature: "multiplex_underwriter",
                details: {
                  listing_id: selectedListing.mlsNumber,
                  source: "map_quick_card",
                  confidence: multiplexScan.confidence,
                },
              })}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {selectedListing.mlsNumber && (
            <Button size="sm" variant="outline" className="shrink-0 px-2" asChild>
              <Link
                href={`/listings/${encodeURIComponent(selectedListing.mlsNumber)}`}
                aria-label="Open full listing page"
                data-testid="link-quick-card-listing-page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
        {selectedListing.mlsNumber && (
          <div className="mt-2" onClick={(event) => event.stopPropagation()}>
            <PropertyQuestionWidget
              listingMlsNumber={selectedListing.mlsNumber}
              listingSnapshot={questionSnapshot}
              buttonLabel="Ask the experts"
              compact
            />
          </div>
        )}
      </div>
    );
  };

  const renderDistressDetailPanel = () => {
    if (!selectedDistressListing) return null;
    const imgUrl = getImageUrl(selectedDistressListing.images);
    const questionSnapshot = buildDistressQuestionSnapshot(selectedDistressListing);
    return (
      <div data-testid="panel-distress-detail">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CardTitle className="text-xl">{formatPriceFull(selectedDistressListing.listPrice)}</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {formatAddress(selectedDistressListing.address as RepliersListing["address"])}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDistressListing(null)}
                data-testid="button-close-distress-detail"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={formatShortAddress(selectedDistressListing.address as RepliersListing["address"])}
                className="h-48 w-full rounded-lg object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selectedDistressListing.distress.categoriesTriggered.foreclosure_pos && <Badge variant="outline">POS/foreclosure</Badge>}
              {selectedDistressListing.distress.categoriesTriggered.vtb && <Badge variant="outline">VTB</Badge>}
              {selectedDistressListing.distress.categoriesTriggered.motivated && <Badge variant="outline">Motivated seller</Badge>}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="font-medium mb-1">Why it is flagged</p>
              <p className="text-muted-foreground">
                Confidence: {selectedDistressListing.distress.confidence}. Matched terms: {selectedDistressListing.distress.matchedTerms.slice(0, 6).map((term) => term.term).join(", ") || "n/a"}.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="w-full" onClick={() => handleAnalyzeDistressListing(selectedDistressListing)}>
                <Calculator className="h-4 w-4 mr-2" />
                Analyze this distress deal
              </Button>
              {selectedDistressListing.mlsNumber && (
                <PropertyQuestionWidget
                  listingMlsNumber={selectedDistressListing.mlsNumber}
                  listingSnapshot={questionSnapshot}
                  buttonLabel="Ask the experts"
                />
              )}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="font-medium mb-1">Listing remarks</p>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {selectedDistressListing.rawRemarks || selectedDistressListing.details?.description || "No remarks available."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const usVisibleCount = usMapData?.listings?.length ?? 0;
  const resultSummaryLabel = countryFilter === "us"
    ? usMapLoading
      ? "Loading US listings…"
      : usVisibleCount > 0
        ? `${usVisibleCount} of ${(usMapData?.total ?? usVisibleCount).toLocaleString()} US listings`
        : "No US listings in view"
    : hasSearched
      ? totalCount > 0
        ? `${displayedListings.length} of ${totalCount.toLocaleString()} properties`
        : "No properties found"
      : "Move the map or run a search to start";
  const mobileResultSummaryLabel = countryFilter === "us"
    ? usVisibleCount > 0
      ? `${usVisibleCount} US`
      : "No US listings"
    : totalCount > 0
      ? `${displayedListings.length} of ${totalCount.toLocaleString()}`
      : showDistressOverlay && distressOnlyListingsInView.length > 0
        ? `${distressOnlyListingsInView.length} distress`
        : "No properties";

  const sidebarContent = (
    <>
      {selectedListing ? (
        <div className="h-full min-h-0 overflow-y-auto overscroll-contain p-3">
          {renderDetailPanel()}
          <NextStepBlock sourcePage="/tools/cap-rates" className="mt-3" />
        </div>
      ) : selectedDistressListing ? (
        <div className="h-full min-h-0 overflow-y-auto overscroll-contain p-3">
          {renderDistressDetailPanel()}
        </div>
      ) : (
        <div className="h-full p-3">
          <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-muted/10 p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Search results</p>
                <p className="text-sm font-medium" data-testid="text-results-panel-count">{resultSummaryLabel}</p>
              </div>
              {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {findDealsActive && (
            <AskRealistPanel
              compact
              initialQuestion={findDealsQuery}
              context={{
                city: findDealsFilters.city || undefined,
                price: findDealsFilters.maxPrice || undefined,
              }}
            />
          )}
          {(savedSearches.length > 0 || savedShortlist.length > 0 || recentViewedListings.length > 0) && (
            <Card className="border-border/60">
              <CardContent className="p-3 space-y-3">
                {savedSearches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saved searches</p>
                    {savedSearches.slice(0, 2).map((search) => (
                      <button
                        key={`saved-search-${search.id}`}
                        className="w-full rounded-md border border-border/60 px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                        onClick={() => {
                          setFindDealsQuery(search.query || "");
                          if (search.propertyType) setPropertyType(search.propertyType);
                          if (search.budgetMax) setMaxPrice(String(search.budgetMax));
                          if (search.targetGrossYield) setMinGrossYield(String(search.targetGrossYield));
                        }}
                        data-testid={`button-resume-saved-search-${search.id}`}
                      >
                        <p className="text-xs font-medium">{search.label}</p>
                        <p className="text-[11px] text-muted-foreground">{search.query || search.geography || "Saved search"}</p>
                      </button>
                    ))}
                  </div>
                )}
                {savedShortlist.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shortlist</p>
                    {savedShortlist.slice(0, 2).map((listing) => (
                      <div key={`shortlist-${listing.id}`} className="rounded-md border border-border/60 px-2.5 py-2">
                        <p className="text-xs font-medium">{listing.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[listing.city, listing.capRate != null ? `${listing.capRate.toFixed(1)}% cap` : null, listing.price ? formatPrice(listing.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {recentViewedListings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recently viewed</p>
                    {recentViewedListings.slice(0, 2).map((listing) => (
                      <div key={`recent-${listing.id}`} className="rounded-md border border-border/60 px-2.5 py-2">
                        <p className="text-xs font-medium">{listing.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[listing.city, listing.capRate != null ? `${listing.capRate.toFixed(1)}% cap` : null, listing.price ? formatPrice(listing.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {isSearching ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-2">
                <div className="flex gap-3">
                  <Skeleton className="w-24 h-20 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            ))
          ) : countryFilter === "us" ? (
            (usMapData?.listings?.length ?? 0) > 0 ? (
              <>{(usMapData?.listings ?? []).map((listing) => renderUsListingCard(listing))}</>
            ) : (
              <div className="rounded-lg border p-6 text-center">
                <Map className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold mb-2">{usMapLoading ? "Loading US Listings" : "No US Listings in View"}</h3>
                <p className="text-xs text-muted-foreground">
                  {usMapLoading
                    ? "Fetching HomeHarvest markers for this area."
                    : "Pan or zoom the map to a covered US market (HomeHarvest beta)."}
                </p>
              </div>
            )
          ) : displayedListings.length > 0 || (showDistressOverlay && distressOnlyListingsInView.length > 0) ? (
            <>
              {displayedListings.map((listing) => renderListingCard(listing))}

              {showDistressOverlay && distressOnlyListingsInView.length > 0 && (
                <Card className="border-red-500/20 bg-red-500/5">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Motivated matches</p>
                        <p className="text-xs text-muted-foreground">Additional motivated-seller opportunities in the current map view.</p>
                      </div>
                      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        {distressOnlyListingsInView.length}
                      </Badge>
                    </div>
                    {distressOnlyListingsInView.slice(0, 12).map((listing) => renderDistressCard(listing))}
                  </CardContent>
                </Card>
              )}

              {numPages > 1 && (
                <div className="flex items-center justify-between pt-2 pb-1">
                  <span className="text-xs text-muted-foreground">Page {page}/{numPages}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1 || isSearching}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= numPages || isSearching}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : fetchError ? (
            <div className="rounded-lg border border-destructive/40 p-6 text-center" data-testid="listings-error-state">
              <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-3" />
              <h3 className="text-sm font-semibold mb-2">We couldn't load listings</h3>
              <p className="text-xs text-muted-foreground mb-3">
                This is a problem on our end, not empty inventory.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => mapBounds && fetchListingsForBounds(mapBounds, 1)}
                disabled={isSearching || !mapBounds}
                data-testid="button-retry-listings"
              >
                Retry
              </Button>
            </div>
          ) : hasSearched ? (
            <div className="rounded-lg border p-6 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold mb-2">No Properties Found</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Try zooming out or adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-center">
              <Map className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold mb-2">Pan & Zoom to Search</h3>
              <p className="text-xs text-muted-foreground">
                Move the map to any area to see listings and yields.
              </p>
            </div>
          )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen h-[100dvh] bg-background flex flex-col overflow-hidden">
      <SEO
        title={SHARED_ROUTE_META["/tools/cap-rates"].title}
        description={SHARED_ROUTE_META["/tools/cap-rates"].description}
        canonicalUrl="/tools/cap-rates"
        keywords="cap rate map canada, cap rates by city, rental yield map, canadian real estate cap rates, investment property search"
      />
      <Navigation />

      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-[1000] relative shrink-0">
        <div className="px-3 py-3 space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="hidden md:block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Deal sourcing</p>
              <h1 className="text-sm font-bold tracking-tight">Yield Map of Canada</h1>
              <p className="hidden md:block text-sm text-muted-foreground">Browse listings by cap rate and rental yield — search broadly, shortlist quickly, then hand the winner into underwriting.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]" data-testid="badge-results-summary">
                {resultSummaryLabel}
              </Badge>
              {dataSource && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0" data-testid="badge-data-source">
                  {dataSource === "crea_ddf" ? "CREA DDF" : "Repliers"}
                </Badge>
              )}
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative w-full sm:w-auto sm:flex-1 min-w-0">
              <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
              <Input
                placeholder='Try: "duplexes in Hamilton under 600k" or "3 bed houses in Calgary"'
                value={findDealsQuery}
                onChange={(e) => setFindDealsQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFindDeals()}
                className="pl-9 h-9 text-sm"
                data-testid="input-find-deals"
              />
            </div>
            <Button
              size="sm"
              className="h-9 px-4"
              onClick={handleFindDeals}
              disabled={findDealsLoading || !findDealsQuery.trim()}
              data-testid="button-find-deals"
            >
              {findDealsLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Target className="h-4 w-4 mr-1.5" />
              )}
              Find Deals
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleSaveCurrentSearch}
              data-testid="button-save-current-search"
            >
              <Star className="h-3.5 w-3.5" />
              Save Search
            </Button>
            {findDealsActive && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleClearFindDeals}
                data-testid="button-clear-find-deals"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setShowAdvancedFilters((value) => !value)}
              data-testid="button-toggle-advanced-filters"
            >
              Filters
              {activeFilterCount > 0 && <Badge variant="secondary" className="px-1 py-0 text-[9px]">{activeFilterCount}</Badge>}
              {showAdvancedFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2" data-testid="deal-quick-filters">
            <div className="mr-1 min-w-[92px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quick search</p>
              <p className="text-[10px] text-muted-foreground">One map, deal flags on top.</p>
            </div>
            {DEAL_CATEGORY_CONFIG.map((category) => {
              const active = dealCategories.includes(category.id);
              const Icon = category.id === "power_of_sale" ? Gavel : category.id === "vtb" ? DollarSign : TrendingDown;
              return (
                <Button
                  key={category.id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-8 gap-1.5 text-xs"
                  title={category.description}
                  onClick={() => toggleDealCategory(category.id)}
                  data-testid={`button-deal-filter-${category.id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {category.label}
                </Button>
              );
            })}
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5">
              <Switch
                checked={showDistressOnly}
                onCheckedChange={(checked) => {
                  setShowDistressOnly(checked);
                  if (checked) setShowDistressOverlay(true);
                }}
                data-testid="switch-motivated-only"
              />
              <div>
                <p className="text-[11px] font-medium">Motivated only</p>
                <p className="text-[10px] text-muted-foreground">Hide unflagged yield listings.</p>
              </div>
            </div>
            {(dealCategories.length > 0 || showDistressOnly) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setDealCategories([]);
                  setShowDistressOnly(false);
                }}
                data-testid="button-clear-deal-filters"
              >
                Clear deal filters
              </Button>
            )}
          </div>

          {findDealsActive && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="parsed-filters-echo">
              <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" data-testid="badge-ai-filters">
                <Sparkles className="h-3 w-3" />
                Understood:
              </Badge>
              {parsedFilterChips.length > 0 ? (
                parsedFilterChips.map(({ key, label }) => (
                  <Badge key={key} variant="outline" className="text-[10px] gap-1 pr-0.5" data-testid={`chip-parsed-${key}`}>
                    {label}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-muted"
                      onClick={() => handleRemoveParsedFilter(key)}
                      aria-label={`Remove ${label} filter`}
                      data-testid={`button-remove-parsed-${key}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-[10px] text-muted-foreground" data-testid="text-parsed-filters-none">
                  No specific filters recognized in your search — showing nearby matches ranked by deal score. Try adding a city, price cap, or bed count.
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[9px] text-muted-foreground">80+</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[9px] text-muted-foreground">65–79</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-[9px] text-muted-foreground">&lt;65</span>
                </div>
              </div>
            </div>
          )}

          {showAdvancedFilters && (
          <div className="flex flex-wrap gap-2 items-end rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="min-w-[180px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Map metric / sort</Label>
              <Select value={sortMetric} onValueChange={(v) => setSortMetric(v as InvestmentMetricKey)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="gross_yield">Gross yield</SelectItem>
                  {INVESTMENT_METRIC_FLAGS.ENABLE_CAP_RATE_SEARCH && <SelectItem value="cap_rate">Cap rate</SelectItem>}
                  <SelectItem value="cash_on_cash">Cash-on-cash</SelectItem>
                  <SelectItem value="dscr">DSCR</SelectItem>
                  {INVESTMENT_METRIC_FLAGS.ENABLE_IRR_SEARCH && <SelectItem value="irr">IRR</SelectItem>}
                  <SelectItem value="monthly_cash_flow">Monthly cash flow</SelectItem>
                  <SelectItem value="community_consensus">Community consensus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Metric source</Label>
              <Select value={metricSource} onValueChange={(v) => setMetricSource(v as InvestmentMetricSource)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realist_estimate">Realist estimate</SelectItem>
                  {INVESTMENT_METRIC_FLAGS.ENABLE_COMMUNITY_METRIC_SEARCH && <SelectItem value="community_median">Community median</SelectItem>}
                  {INVESTMENT_METRIC_FLAGS.ENABLE_MY_ANALYSIS_SEARCH && <SelectItem value="my_saved_analyses">My saved analyses</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Direction</Label>
              <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as "asc" | "desc")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Highest first</SelectItem>
                  <SelectItem value="asc">Lowest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[100px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Price</Label>
              <Input
                type="number"
                placeholder="$0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-min-price"
              />
            </div>
            <div className="min-w-[100px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Max Price</Label>
              <Input
                type="number"
                placeholder="Any"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-max-price"
              />
            </div>
            <div className="min-w-[75px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Beds</Label>
              <Select value={minBeds} onValueChange={setMinBeds}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-beds">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="5">5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[75px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Units</Label>
              <Select value={minUnits} onValueChange={setMinUnits}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-units">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="6">6+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[100px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-property-type">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Detached">Detached</SelectItem>
                  <SelectItem value="Semi-Detached">Semi</SelectItem>
                  <SelectItem value="Townhouse">Townhouse</SelectItem>
                  <SelectItem value="Condo">Condo</SelectItem>
                  <SelectItem value="Duplex">Duplex</SelectItem>
                  <SelectItem value="Triplex">Triplex</SelectItem>
                  <SelectItem value="Multiplex">Multiplex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[92px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Gross Yield</Label>
              <Input type="number" placeholder="Any" value={minGrossYield} onChange={(e) => setMinGrossYield(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="min-w-[92px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Max Gross Yield</Label>
              <Input type="number" placeholder="Any" value={maxGrossYield} onChange={(e) => setMaxGrossYield(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="min-w-[92px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Cap Rate</Label>
              <Input type="number" placeholder="Any" value={minCapRate} onChange={(e) => setMinCapRate(e.target.value)} className="h-8 text-xs" data-testid="select-min-cap-rate" />
            </div>
            <div className="min-w-[92px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Max Cap Rate</Label>
              <Input type="number" placeholder="Any" value={maxCapRate} onChange={(e) => setMaxCapRate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="min-w-[92px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Cash-on-Cash</Label>
              <Input type="number" placeholder="Any" value={minCashOnCash} onChange={(e) => setMinCashOnCash(e.target.value)} className="h-8 text-xs" />
            </div>
            {INVESTMENT_METRIC_FLAGS.ENABLE_IRR_SEARCH && (
              <>
                <div className="min-w-[92px]">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min IRR</Label>
                  <Input type="number" placeholder="Any" value={minIrr} onChange={(e) => setMinIrr(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="min-w-[92px]">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Max IRR</Label>
                  <Input type="number" placeholder="Any" value={maxIrr} onChange={(e) => setMaxIrr(e.target.value)} className="h-8 text-xs" />
                </div>
              </>
            )}
            <div className="min-w-[110px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Monthly CF</Label>
              <Input type="number" placeholder="Any" value={minMonthlyCashFlow} onChange={(e) => setMinMonthlyCashFlow(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="min-w-[110px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Analyses</Label>
              <Input type="number" placeholder="Any" value={minAnalysisCount} onChange={(e) => setMinAnalysisCount(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="min-w-[130px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Consensus</Label>
              <Select value={consensusLabelFilter} onValueChange={(v) => setConsensusLabelFilter(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="bullish">Bullish</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="bearish">Bearish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[220px] items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2">
              <Switch checked={includeUnavailableMetrics} onCheckedChange={setIncludeUnavailableMetrics} />
              <div>
                <p className="text-[11px] font-medium">Include unavailable estimates</p>
                <p className="text-[10px] text-muted-foreground">Keep listings even when this metric is missing.</p>
              </div>
            </div>
            <div className="flex min-w-[220px] items-center gap-2 rounded-md border border-red-200 bg-background px-3 py-2">
              <Switch
                checked={showDistressOverlay}
                onCheckedChange={(checked) => {
                  setShowDistressOverlay(checked);
                  if (!checked) setShowDistressOnly(false);
                }}
              />
              <div>
                <p className="text-[11px] font-medium">Show motivated-seller overlay</p>
                <p className="text-[10px] text-muted-foreground">Red M markers and badges on motivated listings.</p>
              </div>
            </div>
            <div className="flex min-w-[220px] items-center gap-2 rounded-md border border-red-200 bg-background px-3 py-2">
              <Switch
                checked={showDistressOnly}
                onCheckedChange={(checked) => {
                  setShowDistressOnly(checked);
                  if (checked) setShowDistressOverlay(true);
                }}
              />
              <div>
                <p className="text-[11px] font-medium">Only show motivated deals</p>
                <p className="text-[10px] text-muted-foreground">Filter standard listings down to overlap with motivated matches.</p>
              </div>
            </div>
            <div className="flex min-w-[220px] items-center gap-2 rounded-md border border-blue-200 bg-background px-3 py-2">
              <div className="flex overflow-hidden rounded-md border border-border" data-testid="toggle-country-filter">
                {([
                  ["all", "All"],
                  ["ca", "Canada"],
                  ["us", "US"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCountryFilter(value)}
                    className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                      countryFilter === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`button-country-${value}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-medium">Country</p>
                <p className="text-[10px] text-muted-foreground">CREA (CA) + HomeHarvest US beta markers.</p>
              </div>
            </div>
            <Button
              size="sm"
              className="h-8"
              onClick={handleRefresh}
              disabled={isSearching || !mapBounds}
              data-testid="button-apply-filters"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setMinPrice("");
                setMaxPrice("");
                setMinBeds("any");
                setMinUnits("any");
                setPropertyType("all");
                setSortMetric("gross_yield");
                setSortDirection("desc");
                setMetricSource("realist_estimate");
                setMinGrossYield("");
                setMaxGrossYield("");
                setMinCapRate("");
                setMaxCapRate("");
                setMinIrr("");
                setMaxIrr("");
                setMinCashOnCash("");
                setMinMonthlyCashFlow("");
                setMinAnalysisCount("");
                setConsensusLabelFilter("any");
                setIncludeUnavailableMetrics(false);
                setDealCategories([]);
                setShowDistressOverlay(true);
                setShowDistressOnly(false);
                setCountryFilter("all");
              }}
              disabled={activeFilterCount === 0}
              data-testid="button-reset-filters"
            >
              Reset
            </Button>
          </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="relative flex-1 min-h-0" data-testid="map-container">
          {/* Single top-right column so the Map-metric card and the Layers
              button can never overlap, whatever height the explainer takes. */}
          <div className="absolute right-3 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
          {!findDealsActive && (
            <div className="flex flex-col gap-1 rounded-md border border-border/70 bg-background/95 p-2 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  Map metric
                </Label>
                <Select value={sortMetric} onValueChange={(v) => setSortMetric(v as InvestmentMetricKey)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs" data-testid="select-map-metric">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross_yield">Gross yield</SelectItem>
                    {INVESTMENT_METRIC_FLAGS.ENABLE_CAP_RATE_SEARCH && <SelectItem value="cap_rate">Cap rate</SelectItem>}
                    <SelectItem value="cash_on_cash">Cash-on-cash</SelectItem>
                    <SelectItem value="dscr">DSCR</SelectItem>
                    {INVESTMENT_METRIC_FLAGS.ENABLE_IRR_SEARCH && <SelectItem value="irr">IRR</SelectItem>}
                    <SelectItem value="monthly_cash_flow">Monthly cash flow</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="community_consensus">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="max-w-[240px] text-[10px] leading-snug text-muted-foreground">
                Markers show {metricShortLabel(sortMetric)}. Clusters show {sortMetric === "community_consensus" ? "consensus + listing count" : "average + listing count"}.
                {showUsListingsLayer ? ` US beta: ${usMapLoading ? "loading" : `${usMapData?.listings?.length ?? 0} visible`} HomeHarvest markers.` : ""}
              </p>
            </div>
          )}
          <MapLayersPanel layers={mapLayers} onLayersChange={setMapLayers} />
          </div>
          <MapContainer
            center={TORONTO_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ width: "100%", height: "100%" }}
            className="h-[50vh] lg:h-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Real estate listings powered by <a href="https://valery.ca" target="_blank" rel="noopener noreferrer">valery.ca</a> / Valery Real Estate Inc.'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {findDealsActive ? (
              displayedDealResults.map((result) => (
                <Marker
                  key={`deal-${result.id}`}
                  position={[result.lat, result.lng]}
                  icon={createDealScoreIcon(
                    result.deal_score,
                    selectedDealResult?.id === result.id
                  )}
                  eventHandlers={{
                    click: () => handleSelectDealResult(result),
                  }}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm">{formatPrice(result.price)}</p>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
                          background: getDealScoreColor(result.deal_score),
                          color: "white"
                        }}>
                          Score: {result.deal_score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{formatShortAddress(result.address)}, {result.address?.city}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="font-medium">{result.cap_rate}% cap</span>
                        <span className="font-medium">{result.cash_on_cash}% CoC</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{getDealScoreLabel(result.deal_score)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))
            ) : (
              <ClusteredListingsLayer
                listings={displayedMappableListings}
                onSelectListing={handleSelectListing}
                aggregatesMap={aggregatesMap}
                metric={sortMetric}
                metricSource={metricSource}
                myMetricsMap={myAnalysisMetricsMap}
                distressMap={distressMap}
              />
            )}
            {!findDealsActive && showDistressOverlay && countryFilter !== "us" && distressOnlyListingsInView.length > 0 && (
              <DistressListingsLayer
                listings={distressOnlyListingsInView}
                selectedMlsNumber={selectedDistressListing?.mlsNumber}
                onSelectListing={handleSelectDistressListing}
              />
            )}
            {!findDealsActive && showUsListingsLayer && (usMapData?.listings?.length ?? 0) > 0 && (
              <UsListingsLayer
                listings={usMapData?.listings ?? []}
                selectedListingId={null}
                onSelectListing={() => undefined}
              />
            )}
            <NeighbourhoodOverlay layers={mapLayers} />
            <MapEventHandler onBoundsChange={handleBoundsChange} />
            {flyTo && <FlyToLocation lat={flyTo.lat} lng={flyTo.lng} />}
            <MapQuickCardOverlay listing={selectedListing}>
              {renderMapQuickCard()}
            </MapQuickCardOverlay>
          </MapContainer>

          <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]">
            <Button
              size="sm"
              className="shadow-lg rounded-full px-4"
              onClick={() => setShowMobileList(!showMobileList)}
              data-testid="button-toggle-mobile-list"
            >
              <List className="h-4 w-4 mr-1.5" />
              {countryFilter === "us"
                ? usVisibleCount > 0
                  ? `${usVisibleCount} US listings`
                  : "Listings"
                : displayedListings.length > 0
                  ? `${displayedListings.length} listings`
                  : showDistressOverlay && distressOnlyListingsInView.length > 0
                    ? `${distressOnlyListingsInView.length} distress`
                    : "Listings"}
              {showMobileList ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronUp className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </div>

        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-shrink-0 flex-col min-h-0 border-l bg-background overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            {selectedListing ? (
              <div className="flex items-center justify-between gap-2 w-full">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected property</p>
                  <p className="text-sm font-medium truncate">{formatShortAddress(selectedListing.address)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSelectedListing(null)}
                  data-testid="button-back-to-results"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Results
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 w-full">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Map workspace</p>
                  <p className="text-sm font-medium" data-testid="text-sidebar-count">Browse and analyze without losing map position</p>
                </div>
              </div>
            )}
          </div>
          {sidebarContent}
        </div>

        {showMobileList && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-[1000] bg-background border-t rounded-t-2xl shadow-2xl max-h-[60dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium">
                  {mobileResultSummaryLabel}
                </p>
                {dataSource && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {dataSource === "crea_ddf" ? "DDF" : "Repliers"}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileList(false)}
                data-testid="button-close-mobile-list"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {sidebarContent}
            </div>
          </div>
        )}
      </div>
      <Sheet open={Boolean(analyzerSheetMeta)} onOpenChange={handleAnalyzerSheetOpenChange}>
        <SheetContent side="right" className="flex h-screen h-[100dvh] w-full flex-col overflow-hidden p-0 sm:max-w-3xl">
          <div className="shrink-0 border-b px-6 py-4">
            <SheetHeader className="pr-8">
              <SheetTitle>{analyzerSheetMeta?.title || "Analyze in Map Workspace"}</SheetTitle>
              <SheetDescription>
                {analyzerSheetMeta?.subtitle || "Run full underwriting without leaving the map."}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
            <Home embedded seedQuery={analyzerSeedQuery} />
          </div>
        </SheetContent>
      </Sheet>
      <CommunityAnalysisModal
        open={showCommunityModal}
        onOpenChange={setShowCommunityModal}
        analyses={publicAnalyses}
        onDuplicate={(analysisId) => duplicateAnalysisMutation.mutate(analysisId)}
        onFeedback={(analysisId, feedbackType) => analysisFeedbackMutation.mutate({ analysisId, feedbackType })}
      />
    </div>
  );
}
