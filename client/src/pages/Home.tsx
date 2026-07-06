import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { SEO, organizationSchema, websiteSchema, softwareSchema } from "@/components/SEO";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { Navigation } from "@/components/Navigation";
import { AnalysesCounter } from "@/components/AnalysesCounter";
import { AddressInput } from "@/components/AddressInput";
import { StrategySelector } from "@/components/StrategySelector";
import { CalculatorSelector, type CalculatorType } from "@/components/CalculatorSelector";
import { DealInputs } from "@/components/DealInputs";
import { LeaderboardEligibilityNotice } from "@/components/LeaderboardEligibilityNotice";
import { MetricCards } from "@/components/MetricCards";
import { AnalysisCharts } from "@/components/AnalysisCharts";
import { ResultsSummary } from "@/components/ResultsSummary";
import { NextStepBlock } from "@/components/NextStepBlock";
import { SourcesUsesWaterfall } from "@/components/SourcesUsesWaterfall";
import { ProformaTable } from "@/components/ProformaTable";
import { DealTimeline } from "@/components/DealTimeline";
import { AskRealistPanel } from "@/components/AskRealistPanel";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";
import { RentVsBuyCalculator } from "@/components/RentVsBuyCalculator";
import { RenoQuoteWizard } from "@/components/RenoQuoteWizard";
import { MLISelectCalculator } from "@/components/MLISelectCalculator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { calculateBuyHoldAnalysis, calculateStressTest, formatCurrency } from "@/lib/calculations";
import {
  captureInvestorPreference,
  getSavedListingSignals,
  getSavedSearchSignals,
  persistSavedListingSignal,
  persistSavedSearchSignal,
  syncDiscoverySignalsWithAccount,
  track,
  trackRealistEvent,
  type SavedListingSignal,
  type SavedSearchSignal,
} from "@/lib/analytics";
import { loadPropertyContext, savePropertyContext } from "@/lib/propertyContext";
import { apiRequest } from "@/lib/queryClient";
import type { BuyHoldInputs, AnalysisResults } from "@shared/schema";
import { detectPossiblePlex } from "@shared/plexDetection";
import type { SimilarListingCandidate } from "@shared/similarListings";
import { Calculator, FileDown, BarChart3, Save, Loader2, FileSpreadsheet, Table, FileSignature, ArrowRight, Sparkles, MapPinned, Target, ClipboardCheck, Building2 } from "lucide-react";
import { exportToPDF } from "@/lib/pdfExport";

function getSessionId(): string {
  let sessionId = localStorage.getItem("realist_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("realist_session_id", sessionId);
  }
  return sessionId;
}


const defaultInputs: BuyHoldInputs = {
  purchasePrice: 500000,
  closingCosts: 15000,
  downPaymentPercent: 20,
  interestRate: 5.5,
  amortizationYears: 25,
  loanTermYears: 5,
  monthlyRent: 3000,
  vacancyPercent: 5,
  propertyTax: 4000,
  insurance: 2000,
  utilities: 0,
  maintenancePercent: 5,
  managementPercent: 5,
  capexReservePercent: 5,
  otherExpenses: 0,
  rentGrowthPercent: 0,
  expenseInflationPercent: 2,
  appreciationPercent: 2,
  holdingPeriodYears: 10,
  sellingCostsPercent: 5,
  isCmhcMliSelect: false,
  cmhcMliPoints: 0,
};

// The fabricated "similar deals" mock (invented comps with made-up investor
// scores) was removed in PR #66. Its honest replacement is the "Similar
// listings" strip below the metric cards: real active comparables from
// ddf_listing_snapshots via GET /api/listings/similar, linking to real
// listing pages — and rendering nothing at all when there are no genuine comps.
type SimilarListingResult = SimilarListingCandidate & {
  /** Site path to the live listing page (/listings/:mlsNumber). */
  path: string;
};

type HomeProps = {
  embedded?: boolean;
  seedQuery?: string;
  [key: string]: unknown;
};

export default function Home({ embedded, seedQuery }: HomeProps = {}) {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const searchString = useSearch();
  const [location] = useLocation();
  const isStandaloneTool = location === "/tools/analyzer" || location === "/deal-analyzer";
  const analyzerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState<"canada" | "usa">("canada");
  const [postalCode, setPostalCode] = useState("");
  const [strategy, setStrategy] = useState("buy_hold");
  const [calculatorType, setCalculatorType] = useState<CalculatorType>("deal_analyzer");
  const [inputs, setInputs] = useState<BuyHoldInputs>(defaultInputs);
  const [showResults, setShowResults] = useState(false);
  // Snapshot of the ANALYZED inputs, captured when results are shown. The
  // similar-listings query derives from this — never from live input state —
  // so editing the form doesn't fire a request per keystroke (each city
  // character would be a distinct server cache key = a DB query), and the
  // strip always reflects the analysis on screen, not a half-typed price.
  const [similarContext, setSimilarContext] = useState<{
    city: string;
    country: string;
    type: string;
    price: number;
    address: string;
    mlsNumber: string;
  } | null>(null);
  const snapshotSimilarContext = () =>
    setSimilarContext({
      city: city.trim(),
      country,
      type: propertyType.trim(),
      price: inputs.purchasePrice,
      address: address.trim(),
      mlsNumber: mlsNumber.trim(),
    });
  const [isCalculating, setIsCalculating] = useState(false);
  const [leadCaptureOpen, setLeadCaptureOpen] = useState(false);
  const [leadCapturedLocal, setLeadCapturedLocal] = useState(() => {
    const savedLead = localStorage.getItem("realist_lead_info");
    return !!savedLead;
  });
  
  const leadCaptured = isAuthenticated || leadCapturedLocal;
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dealName, setDealName] = useState("");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  const [mlsNumber, setMlsNumber] = useState("");
  const [shareWithCommunity, setShareWithCommunity] = useState(true);
  const [nlPrompt, setNlPrompt] = useState("");
  const [entrySource, setEntrySource] = useState("direct");
  const [propertyType, setPropertyType] = useState("");
  const [recentSavedSearches, setRecentSavedSearches] = useState<SavedSearchSignal[]>(() => getSavedSearchSignals().slice(0, 3));
  const [recentSavedListings, setRecentSavedListings] = useState<SavedListingSignal[]>(() => getSavedListingSignals().slice(0, 3));
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [inspectionType, setInspectionType] = useState("investor_rental_inspection");
  const [inspectionPreferredTimes, setInspectionPreferredTimes] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [inspectionContactName, setInspectionContactName] = useState("");
  const [inspectionContactEmail, setInspectionContactEmail] = useState(user?.email || "");
  const [inspectionContactPhone, setInspectionContactPhone] = useState(user?.phone || "");
  const [autoSavedAnalysisId, setAutoSavedAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncDiscoverySignalsWithAccount().then(() => {
      setRecentSavedSearches(getSavedSearchSignals().slice(0, 3));
      setRecentSavedListings(getSavedListingSignals().slice(0, 3));
    });
  }, [isAuthenticated]);

  const appliedSeedRef = useRef<string>("");
  const contextHydratedRef = useRef(false);

  // When no URL seed brought the user here, hydrate the address from the
  // shared property context so the property follows them between tools.
  useEffect(() => {
    if (embedded || contextHydratedRef.current) return;
    const params = new URLSearchParams(searchString || "");
    if (params.get("address") || params.get("price") || params.get("q") || params.get("mls")) return;
    const ctx = loadPropertyContext();
    if (!ctx?.address) return;
    contextHydratedRef.current = true;
    setAddress(ctx.address);
    if (ctx.city) setCity(ctx.city);
    if (ctx.province) setRegion(ctx.province);
    if (ctx.mlsNumber) setMlsNumber(ctx.mlsNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const activeSeed = embedded && seedQuery != null ? seedQuery : searchString;
    if (!activeSeed || activeSeed === appliedSeedRef.current) return;
    const params = new URLSearchParams(activeSeed);
    const addr = params.get("address");
    const price = params.get("price");
    const rent = params.get("rent");
    const mls = params.get("mls");
    const prompt = params.get("q");
    const cityParam = params.get("city");
    const stateParam = params.get("state");
    const vacancy = params.get("vacancy");
    const maintenance = params.get("maintenance");
    const management = params.get("management");
    const insurance = params.get("insurance");
    const propertyTax = params.get("propertyTax");

    if (prompt) {
      setNlPrompt(prompt);
      setEntrySource("homepage_nl_query");
      captureInvestorPreference({
        search_query: prompt,
        financing_intent: true,
      });
      const normalized = prompt.toLowerCase();
      if (normalized.includes("brrr")) setStrategy("brrr");
      if (normalized.includes("flip")) setStrategy("flip");
      if (normalized.includes("multiplex") || normalized.includes("triplex") || normalized.includes("fourplex") || normalized.includes("plex")) {
        setStrategy("multiplex");
      }
      if (normalized.includes("rent vs buy")) setCalculatorType("rent_vs_buy");
      if (normalized.includes("reno")) setCalculatorType("reno_quote");
      if (normalized.includes("mli")) setCalculatorType("mli_select");
    }

    if (!addr && !price && !prompt) return;
    appliedSeedRef.current = activeSeed;
    contextHydratedRef.current = true;

    if (addr) setAddress(addr);
    if (cityParam) setCity(cityParam);
    if (stateParam) setRegion(stateParam);
    if (mls) setMlsNumber(mls);
    setShowResults(false);

    const priceNum = price ? parseFloat(price) : 0;
    const rentNum = rent ? parseFloat(rent) : 0;

    if (priceNum > 0) {
      setListingPrice(priceNum);
      setInputs((prev) => ({
        ...prev,
        purchasePrice: priceNum,
        closingCosts: Math.round(priceNum * 0.03),
        monthlyRent: rentNum > 0 ? rentNum : prev.monthlyRent,
        vacancyPercent: vacancy ? parseFloat(vacancy) : prev.vacancyPercent,
        maintenancePercent: maintenance ? parseFloat(maintenance) : prev.maintenancePercent,
        managementPercent: management ? parseFloat(management) : prev.managementPercent,
        insurance: insurance ? parseFloat(insurance) : prev.insurance,
        propertyTax: propertyTax ? parseFloat(propertyTax) : prev.propertyTax,
      }));

      track({
        event: "listing_viewed",
        listing_id: mls || [addr, cityParam, stateParam].filter(Boolean).join(", ") || String(priceNum),
        city: cityParam || undefined,
        price: priceNum,
      });
    }
  }, [embedded, searchString, seedQuery]);
  
  const getSavedLeadInfo = () => {
    // If user is logged in, use their info
    if (isAuthenticated && user) {
      return {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
      };
    }
    // Otherwise check localStorage
    const saved = localStorage.getItem("realist_lead_info");
    if (saved) {
      try {
        return JSON.parse(saved) as { firstName?: string; lastName?: string; name?: string; email: string; phone: string };
      } catch {
        return null;
      }
    }
    return null;
  };

  const results = useMemo<AnalysisResults>(() => {
    return calculateBuyHoldAnalysis(inputs);
  }, [inputs]);

  const propertyLabel = [address, city, region].filter(Boolean).join(", ") || "Your Property";
  const resultVerdict = useMemo(() => {
    if (results.monthlyCashFlow >= 250 && results.capRate >= 5.5) {
      return {
        title: "Promising at first pass",
        description: "The current assumptions show positive cash flow and a yield that is worth carrying into the next decision.",
        tone: "text-emerald-600",
      };
    }
    if (results.monthlyCashFlow >= 0) {
      return {
        title: "Borderline, but workable",
        description: "The deal is close enough that financing, rent upside, or negotiated price could change the outcome.",
        tone: "text-amber-600",
      };
    }
    return {
      title: "Needs a tighter basis",
      description: "The current numbers suggest this opportunity needs a lower entry price, stronger rent, or a different strategy.",
      tone: "text-rose-600",
    };
  }, [results.capRate, results.monthlyCashFlow]);

  const inferredIntentChips = useMemo(() => {
    return [
      city ? `Market: ${city}` : region ? `Market: ${region}` : null,
      strategy ? `Strategy: ${strategy.replace(/_/g, " ")}` : null,
      propertyType ? `Property: ${propertyType}` : null,
      inputs.purchasePrice ? `Budget: up to ${formatCurrency(inputs.purchasePrice)}` : null,
      Number.isFinite(results.capRate) ? `Target yield: ${results.capRate.toFixed(1)}%` : null,
      strategy === "brrr" || strategy === "flip" ? "Renovation intent" : "Stabilized hold intent",
    ].filter(Boolean) as string[];
  }, [city, region, strategy, propertyType, inputs.purchasePrice, results.capRate]);

  const stressTestResults = useMemo(() => {
    return calculateStressTest(inputs);
  }, [inputs]);

  const plexDetection = useMemo(() => detectPossiblePlex({
    propertyType,
    kitchenCount: strategy === "multiplex" ? 2 : undefined,
    description: [address, propertyType, nlPrompt, strategy].filter(Boolean).join(" "),
  }), [address, propertyType, nlPrompt, strategy]);

  // Real comparables for the results view — only fetched once an analysis has
  // a city and a price, and only for Canadian analyses (the DDF snapshot
  // store is CA-only). An empty response renders nothing: no placeholder
  // ever stands in for a genuine comp. Derived from the analyzed snapshot,
  // not live inputs (see similarContext above).
  const similarListingsEnabled =
    showResults &&
    similarContext !== null &&
    similarContext.country === "canada" &&
    similarContext.city.length > 0 &&
    similarContext.price > 0;
  const similarListingsParams = new URLSearchParams({
    city: similarContext?.city ?? "",
    price: String(similarContext?.price ?? 0),
  });
  if (similarContext?.type) similarListingsParams.set("type", similarContext.type);
  // Exclusion: exact MLS number when the analysis came from a listing page
  // (loose address matching can miss abbreviation variants and show the
  // subject as its own comp); typed address as the fallback.
  if (similarContext?.mlsNumber) similarListingsParams.set("exclude", similarContext.mlsNumber);
  else if (similarContext?.address) similarListingsParams.set("exclude", similarContext.address);
  const { data: similarListingsData } = useQuery<{
    success: boolean;
    data: SimilarListingResult[];
  }>({
    queryKey: [`/api/listings/similar?${similarListingsParams.toString()}`],
    enabled: similarListingsEnabled,
  });
  const similarListings = similarListingsEnabled
    ? similarListingsData?.data ?? []
    : [];

  const [listingPrice, setListingPrice] = useState<number | null>(null);
  const lastTrackedRef = useRef<string>("");
  const leadSavedAnalysisRef = useRef<boolean>(false);
  const lastCompletedTrackRef = useRef<string>("");

  useEffect(() => {
    track({
      event: "page_viewed",
      path: isStandaloneTool ? location : "/",
      title: isStandaloneTool ? "Deal Analyzer" : "Home",
    });
  }, [isStandaloneTool, location]);

  useEffect(() => {
    if (!showResults || !results || inputs.purchasePrice <= 0) return;
    const trackKey = `${inputs.purchasePrice}-${inputs.monthlyRent}-${strategy}-${city}`;
    if (trackKey === lastTrackedRef.current) return;
    if (leadSavedAnalysisRef.current) {
      leadSavedAnalysisRef.current = false;
      lastTrackedRef.current = trackKey;
      return;
    }
    lastTrackedRef.current = trackKey;

    const formattedAddress = [address, city, region].filter(Boolean).join(", ");
    fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        countryMode: country,
        strategyType: strategy,
        inputsJson: { ...inputs, listingPrice },
        resultsJson: results,
        address: formattedAddress || null,
        city: city || null,
        province: region || null,
        sessionId: getSessionId(),
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setAutoSavedAnalysisId(data.id); })
      .catch((err) => console.error("Auto-save analysis error:", err));
  }, [showResults, results, inputs.purchasePrice, inputs.monthlyRent, strategy, city]);

  useEffect(() => {
    if (!showResults || !leadCaptured || calculatorType !== "deal_analyzer") return;

    const completionKey = [
      strategy,
      inputs.purchasePrice,
      inputs.monthlyRent,
      city,
      region,
      results.capRate,
      results.cashOnCash,
      results.irr,
    ].join("|");

    if (completionKey === lastCompletedTrackRef.current) return;
    lastCompletedTrackRef.current = completionKey;

    track({
      event: "analyzer_completed",
      strategy,
      price: inputs.purchasePrice,
      city: city || undefined,
      province: region || undefined,
      property_type: propertyType || undefined,
      gross_yield: results.capRate,
      cash_on_cash: results.cashOnCash,
      irr: typeof results.irr === "number" ? results.irr : undefined,
      cap_rate: results.capRate,
    });

    captureInvestorPreference({
      strategy: strategy as "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb",
      geography: city || undefined,
      preferred_geographies: [city, [city, region].filter(Boolean).join(", ")].filter(Boolean) as string[],
      province: region || undefined,
      budget_max: inputs.purchasePrice || undefined,
      property_type: propertyType || undefined,
      property_types: propertyType ? [propertyType] : undefined,
      target_returns: [
        Number.isFinite(results.capRate) ? `cap_rate:${results.capRate.toFixed(1)}` : undefined,
        Number.isFinite(results.cashOnCash) ? `cash_on_cash:${results.cashOnCash.toFixed(1)}` : undefined,
      ].filter(Boolean) as string[],
      target_gross_yield: Number.isFinite(results.capRate) ? results.capRate : undefined,
      target_coc: Number.isFinite(results.cashOnCash) ? results.cashOnCash : undefined,
      target_irr: typeof results.irr === "number" && Number.isFinite(results.irr) ? results.irr : undefined,
      financing_intent: true,
      renovation_intent: strategy === "brrr" || strategy === "flip",
      development_intent: strategy === "multiplex",
      search_query: nlPrompt || undefined,
    });
  }, [showResults, leadCaptured, calculatorType, strategy, inputs.purchasePrice, inputs.monthlyRent, city, region, propertyType, results.capRate, results.cashOnCash, results.irr]);

  const leadMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone?: string; consent: boolean }) => {
      const formattedAddress = [address, city, region, country === "canada" ? "Canada" : "USA", postalCode]
        .filter(Boolean)
        .join(", ");

      const fullName = `${data.firstName} ${data.lastName}`;

      leadSavedAnalysisRef.current = true;
      const response = await apiRequest("POST", "/api/leads", {
        lead: {
          name: fullName,
          email: data.email,
          phone: data.phone,
          consent: data.consent,
          leadSource: "Deal Analyzer",
          firstName: data.firstName,
          lastName: data.lastName,
        },
        property: {
          formattedAddress,
          streetAddress: address,
          city,
          region,
          country: country === "canada" ? "Canada" : "USA",
          postalCode,
        },
        analysis: {
          countryMode: country,
          strategyType: strategy,
          inputsJson: { ...inputs, listingPrice: listingPrice },
          resultsJson: results,
        },
        sessionId: getSessionId(),
      });
      
      // Auto-enroll happens server-side inside POST /api/leads (one welcome
      // email, one 14-day setup link). A second client-side call to
      // /api/auth/lead-enroll used to fire here too, sending the same person
      // TWO welcome emails with different expiries — removed.
      try {
        const leadResult = await response.clone().json();
        const isNewUser = Boolean(leadResult?.data?.isNewUser);
        localStorage.setItem("realist_lead_info", JSON.stringify({
          name: fullName,
          email: data.email,
          phone: data.phone,
          isNewUser,
          // New auto-enrolled accounts are passwordless until the user opts in.
          needsPassword: isNewUser,
        }));
      } catch {
        // Couldn't parse enrollment status, still save lead info
        localStorage.setItem("realist_lead_info", JSON.stringify({
          name: fullName,
          email: data.email,
          phone: data.phone,
        }));
      }

      return response;
    },
    onSuccess: () => {
      setLeadCapturedLocal(true);
      // The modal stays open here: LeadCaptureModal advances to its Deal Room
      // step after submit and closes itself when the user picks a next step.
      setShowResults(true);
      snapshotSimilarContext();
      track({
        event: "lead_captured",
        source: "deal_analyzer",
        strategy,
        geography: [city, region].filter(Boolean).join(", ") || undefined,
        budget_max: inputs.purchasePrice || undefined,
      });
      
      // Check if user needs to set password
      const leadInfo = getSavedLeadInfo();
      if (leadInfo && (leadInfo as any).needsPassword) {
        toast({
          title: "Analysis Ready!",
          description: "Create a password to save your analysis and track your deals.",
        });
      } else {
        toast({
          title: "Analysis Ready!",
          description: "Your complete deal analysis is now available.",
        });
      }
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDealDeskCta = () => {
    const formattedAddress = [address, city, region].filter(Boolean).join(", ");
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ eventType: "deal_desk_cta_clicked", analysisId: autoSavedAnalysisId, dealId: autoSavedAnalysisId }),
    }).catch(() => {});
    track({ event: "cta_clicked", cta: "deal_desk_review", location: "analysis_results" });
    const params = new URLSearchParams();
    if (formattedAddress) params.set("address", formattedAddress);
    if (inputs.purchasePrice) params.set("price", String(inputs.purchasePrice));
    if (inputs.monthlyRent) params.set("rent", String(inputs.monthlyRent));
    if (autoSavedAnalysisId) params.set("dealId", autoSavedAnalysisId);
    window.location.href = `/tools/deal-desk${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const handleMakeOffer = () => {
    const formattedAddress = [address, city, region].filter(Boolean).join(", ");
    track({ event: "cta_clicked", cta: "make_offer", location: "analysis_results", destination: "/offer" });
    const params = new URLSearchParams();
    if (formattedAddress) params.set("address", formattedAddress);
    if (city) params.set("city", city);
    if (region) params.set("province", region);
    if (mlsNumber) params.set("listingId", mlsNumber);
    if (inputs.purchasePrice) params.set("price", String(inputs.purchasePrice));
    if (autoSavedAnalysisId) params.set("dealId", autoSavedAnalysisId);
    window.location.href = `/offer${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const handleAnalyzeAnother = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    analyzerRef.current?.scrollIntoView({ behavior: "smooth" });
    track({ event: "cta_clicked", cta: "analyze_another_property", location: "results_next_steps" });
  };

  const handleSearchMatchingDeals = () => {
    const prompt = [
      strategy.replace(/_/g, " "),
      propertyType || null,
      city || null,
      inputs.purchasePrice ? `under $${Math.round(inputs.purchasePrice).toLocaleString()}` : null,
      typeof results.capRate === "number" && Number.isFinite(results.capRate)
        ? `around ${results.capRate.toFixed(1)}% cap`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    track({
      event: "cta_clicked",
      cta: "find_matching_deals",
      location: "results_next_steps",
      destination: "/tools/cap-rates",
    });
    window.location.href = `/tools/cap-rates${prompt ? `?q=${encodeURIComponent(prompt)}` : ""}`;
  };

  const handleOpenInspectionRequest = () => {
    trackRealistEvent("inspection.checkout_started", {
      listing_id: mlsNumber || propertyLabel,
      city: city || undefined,
      inspection_type: inspectionType,
      amount_cents: 50000,
    });
    setInspectionDialogOpen(true);
  };

  const handleSaveSearch = () => {
    const savedSearch: SavedSearchSignal = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      label: [city, propertyType || strategy.replace(/_/g, " ")].filter(Boolean).join(" · ") || "Saved investment intent",
      query: nlPrompt || undefined,
      geography: [city, region].filter(Boolean).join(", ") || undefined,
      strategy,
      budgetMax: inputs.purchasePrice || undefined,
      propertyType: propertyType || undefined,
      targetGrossYield: Number.isFinite(results.capRate) ? results.capRate : undefined,
      targetCashOnCash: Number.isFinite(results.cashOnCash) ? results.cashOnCash : undefined,
      targetIrr: typeof results.irr === "number" && Number.isFinite(results.irr) ? results.irr : undefined,
      financingIntent: true,
      renovationIntent: strategy === "brrr" || strategy === "flip",
    };

    persistSavedSearchSignal(savedSearch);
    setRecentSavedSearches(getSavedSearchSignals().slice(0, 3));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
    }
    track({
      event: "saved_search",
      geography: savedSearch.geography,
      filters: {
        query: savedSearch.query,
        strategy: savedSearch.strategy,
        budgetMax: savedSearch.budgetMax,
        propertyType: savedSearch.propertyType,
        targetGrossYield: savedSearch.targetGrossYield,
        targetCashOnCash: savedSearch.targetCashOnCash,
        targetIrr: savedSearch.targetIrr,
        financingIntent: savedSearch.financingIntent,
        renovationIntent: savedSearch.renovationIntent,
      },
    });
    trackRealistEvent("saved_search.created", {
      geography: savedSearch.geography,
      filters: {
        query: savedSearch.query,
        strategy: savedSearch.strategy,
        budgetMax: savedSearch.budgetMax,
        propertyType: savedSearch.propertyType,
        targetGrossYield: savedSearch.targetGrossYield,
      },
    }, { idempotencyKey: `realist:saved_search.created:${savedSearch.id}` });

    captureInvestorPreference({
      strategy: strategy as "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb",
      geography: city || undefined,
      preferred_geographies: [city, [city, region].filter(Boolean).join(", ")].filter(Boolean) as string[],
      province: region || undefined,
      budget_max: inputs.purchasePrice || undefined,
      property_type: propertyType || undefined,
      property_types: propertyType ? [propertyType] : undefined,
      target_gross_yield: Number.isFinite(results.capRate) ? results.capRate : undefined,
      target_coc: Number.isFinite(results.cashOnCash) ? results.cashOnCash : undefined,
      target_irr: typeof results.irr === "number" && Number.isFinite(results.irr) ? results.irr : undefined,
      financing_intent: true,
      renovation_intent: strategy === "brrr" || strategy === "flip",
      development_intent: strategy === "multiplex",
      search_query: nlPrompt || undefined,
    });

    toast({
      title: "Search Saved",
      description: leadCaptured
        ? "Your current criteria are saved for follow-up and repeat underwriting."
        : "Your current criteria are saved in this browser now. Create an account later to sync them across sessions.",
    });
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    savePropertyContext({
      address: address || undefined,
      city: city || undefined,
      province: region || undefined,
      price: inputs.purchasePrice || undefined,
      monthlyRent: inputs.monthlyRent || undefined,
      mlsNumber: mlsNumber || undefined,
    });
    track({
      event: "analyzer_started",
      address: [address, city, region].filter(Boolean).join(", ") || undefined,
      strategy,
      geography: [city, region].filter(Boolean).join(", ") || undefined,
      budget_max: inputs.purchasePrice || undefined,
      property_type: propertyType || undefined,
      source: nlPrompt ? entrySource : (isStandaloneTool ? "standalone_tool" : "homepage_embed"),
    });
    trackRealistEvent("calculator.started", {
      address: [address, city, region].filter(Boolean).join(", ") || undefined,
      strategy,
      geography: [city, region].filter(Boolean).join(", ") || undefined,
      source: nlPrompt ? entrySource : (isStandaloneTool ? "standalone_tool" : "homepage_embed"),
    });

    captureInvestorPreference({
      strategy: strategy as "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb",
      geography: city || undefined,
      preferred_geographies: [city, [city, region].filter(Boolean).join(", ")].filter(Boolean) as string[],
      province: region || undefined,
      budget_max: inputs.purchasePrice || undefined,
      property_type: propertyType || undefined,
      property_types: propertyType ? [propertyType] : undefined,
      financing_intent: true,
      renovation_intent: strategy === "brrr" || strategy === "flip",
      development_intent: strategy === "multiplex",
      search_query: nlPrompt || undefined,
    });

    setShowResults(true);
    snapshotSimilarContext();
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      await Promise.allSettled([
        new Promise((resolve) => setTimeout(resolve, 450)),
        (async () => {
          if (!leadCaptured) return;
          if (isAuthenticated && user && user.email) {
            try {
              await leadMutation.mutateAsync({
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email,
                phone: user.phone || "",
                consent: true,
              });
            } catch (err) {
              // Silently continue if lead capture fails - don't block the analysis
              console.error("Auto lead capture error:", err);
            }
          }
        })(),
      ]);
    } finally {
      trackRealistEvent("calculator.completed", {
        strategy,
        city: city || undefined,
        province: region || undefined,
        cap_rate: results.capRate,
        cash_on_cash: results.cashOnCash,
        monthly_cash_flow: results.monthlyCashFlow,
      });
      setIsCalculating(false);
    }
  };

  const handleLeadSubmit = async (data: { firstName: string; lastName: string; email: string; phone?: string; consent: boolean }) => {
    await leadMutation.mutateAsync(data);
  };

  const saveDealMutation = useMutation({
    mutationFn: async (name: string) => {
      const formattedAddress = [address, city, region].filter(Boolean).join(", ") || "Unnamed Property";
      const response = await apiRequest("POST", "/api/saved-deals", {
        name,
        address: formattedAddress,
        city: city || undefined,
        province: region || undefined,
        countryMode: country,
        strategyType: strategy,
        mlsNumber: mlsNumber || undefined,
        inputsJson: inputs,
        resultsJson: results,
        shareWithCommunity,
        sessionId: getSessionId(),
      });
      return response;
    },
    onSuccess: () => {
      setSaveDialogOpen(false);
      setDealName("");
      const draftLabel = [address, city].filter(Boolean).join(", ") || "Saved deal";
      persistSavedListingSignal({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        label: draftLabel,
        listingId: mlsNumber || undefined,
        address: propertyLabel,
        city: city || undefined,
        strategy,
        propertyType: propertyType || undefined,
        price: inputs.purchasePrice || undefined,
        monthlyCashFlow: results.monthlyCashFlow,
        capRate: results.capRate,
        source: "account_saved_deal",
      });
      setRecentSavedListings(getSavedListingSignals().slice(0, 3));
      if (isAuthenticated) {
        void syncDiscoverySignalsWithAccount();
      }
      track({
        event: "saved_listing",
        listing_id: mlsNumber || [address, city, region].filter(Boolean).join(", ") || dealName,
        city: city || undefined,
        price: inputs.purchasePrice || undefined,
        strategy,
        property_type: propertyType || undefined,
        source: "account_saved_deal",
      });
      trackRealistEvent("saved_deal.created", {
        listing_id: mlsNumber || [address, city, region].filter(Boolean).join(", ") || dealName,
        city: city || undefined,
        strategy,
      });
      trackRealistEvent("analysis.assumptions_saved", {
        source_listing_id: mlsNumber || propertyLabel,
        city: city || undefined,
        strategy,
      });
      toast({
        title: "Deal Saved!",
        description: shareWithCommunity && mlsNumber
          ? "Your analysis has been shared with the community."
          : "You can now compare this deal with others.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save deal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const inspectionRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/inspection-requests", {
        propertyAddress: [address, city, region].filter(Boolean).join(", ") || propertyLabel,
        city: city || undefined,
        province: region || undefined,
        listingId: mlsNumber || undefined,
        inspectionType,
        preferredTimes: inspectionPreferredTimes || undefined,
        contactName: inspectionContactName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
        contactEmail: inspectionContactEmail || user?.email || undefined,
        contactPhone: inspectionContactPhone || user?.phone || undefined,
        notes: inspectionNotes || undefined,
        amountCents: 50000,
        currency: "cad",
        sessionId: getSessionId(),
        metadata: {
          source: "deal_analyzer_results",
          defaultProduct: "inspection_500_cad",
          calculatorInputs: inputs,
          calculatorResults: results,
        },
      });
      return response.json() as Promise<{ success: boolean; checkoutUrl?: string | null }>;
    },
    onSuccess: (data) => {
      trackRealistEvent("inspection.requested", {
        listing_id: mlsNumber || propertyLabel,
        city: city || undefined,
        inspection_type: inspectionType,
        amount_cents: 50000,
      });
      setInspectionDialogOpen(false);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      toast({
        title: "Inspection request captured",
        description: "Checkout could not be started automatically. The Realist team can follow up from this request.",
      });
    },
    onError: () => {
      toast({
        title: "Inspection request failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveDeal = () => {
    if (!leadCaptured) {
      const draftLabel = [address, city].filter(Boolean).join(", ") || `Deal ${new Date().toLocaleDateString()}`;
      persistSavedListingSignal({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        label: draftLabel,
        listingId: mlsNumber || undefined,
        address: propertyLabel,
        city: city || undefined,
        strategy,
        propertyType: propertyType || undefined,
        price: inputs.purchasePrice || undefined,
        monthlyCashFlow: results.monthlyCashFlow,
        capRate: results.capRate,
        source: "local_draft",
      });
      setRecentSavedListings(getSavedListingSignals().slice(0, 3));
      if (isAuthenticated) {
        void syncDiscoverySignalsWithAccount();
      }
      track({
        event: "saved_listing",
        listing_id: mlsNumber || propertyLabel,
        city: city || undefined,
        price: inputs.purchasePrice || undefined,
        strategy,
        property_type: propertyType || undefined,
        source: "local_draft",
      });
      trackRealistEvent("saved_deal.created", {
        listing_id: mlsNumber || propertyLabel,
        city: city || undefined,
        strategy,
      });
      trackRealistEvent("analysis.assumptions_saved", {
        source_listing_id: mlsNumber || propertyLabel,
        city: city || undefined,
        strategy,
      });
      captureInvestorPreference({
        strategy: strategy as "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb",
        geography: city || undefined,
        province: region || undefined,
        preferred_geographies: [city, [city, region].filter(Boolean).join(", ")].filter(Boolean) as string[],
        budget_max: inputs.purchasePrice || undefined,
        property_type: propertyType || undefined,
        property_types: propertyType ? [propertyType] : undefined,
        target_gross_yield: Number.isFinite(results.capRate) ? results.capRate : undefined,
        target_coc: Number.isFinite(results.cashOnCash) ? results.cashOnCash : undefined,
        target_irr: typeof results.irr === "number" && Number.isFinite(results.irr) ? results.irr : undefined,
        financing_intent: true,
        renovation_intent: strategy === "brrr" || strategy === "flip",
      });
      toast({
        title: "Deal Draft Saved",
        description: "Saved in this browser now. Create an account when you want synced deals, exports, and follow-up support.",
      });
      return;
    }
    const defaultName = [address, city].filter(Boolean).join(", ") || `Deal ${new Date().toLocaleDateString()}`;
    setDealName(defaultName);
    setSaveDialogOpen(true);
  };

  const handleConfirmSave = () => {
    if (dealName.trim()) {
      saveDealMutation.mutate(dealName.trim());
    }
  };

  const handleExportPDF = async () => {
    if (!leadCaptured) {
      setLeadCaptureOpen(true);
      return;
    }
    setIsExportingPDF(true);
    try {
      const propertyAddress = [address, city, region].filter(Boolean).join(", ") || "Property Analysis";
      await exportToPDF({
        address: propertyAddress,
        inputs,
        results,
        strategy,
        stressTest: stressTestResults,
      });
      toast({
        title: "PDF Exported!",
        description: "Your analysis has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportSheets = async () => {
    if (!leadCaptured) {
      setLeadCaptureOpen(true);
      return;
    }
    setIsExportingSheets(true);
    try {
      const propertyAddress = [address, city, region].filter(Boolean).join(", ") || "Property Analysis";
      const response = await fetch("/api/export/google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: propertyAddress,
          strategy,
          inputs,
          results,
        }),
      });

      const data = await response.json();

      // Logged-in but Google not connected: run the connect hop, then the
      // user retries the export after the OAuth redirect lands back here.
      if (response.status === 409 && data.code === "GOOGLE_NOT_CONNECTED") {
        const authRes = await fetch(data.authUrlEndpoint || "/api/integrations/google/auth-url", {
          credentials: "include",
        });
        const authData = await authRes.json().catch(() => null);
        if (authRes.ok && authData?.url) {
          toast({
            title: "Connect Google",
            description: "Connect your Google account, then export again — the sheet will land in your own Drive.",
          });
          window.location.href = authData.url;
          return;
        }
        throw new Error(data.message || "Connect your Google account to export.");
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || `Export failed (${response.status})`);
      }

      if (data.success && data.url) {
        window.open(data.url, "_blank");
        toast({
          title: "Spreadsheet Created!",
          description: data.exportedToUserAccount
            ? "Your financial model was exported to your Google Drive."
            : "Your financial model was exported to Google Sheets.",
        });
      } else {
        throw new Error(data.message || "Export failed");
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Could not export to Google Sheets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingSheets(false);
    }
  };

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, softwareSchema]
  };

  if (embedded) {
    return (
      <div className="min-h-full overflow-x-hidden pb-8" data-testid="embedded-deal-analyzer">
        <div className="flex justify-center mb-8">
          <CalculatorSelector
            selected={calculatorType}
            onSelect={setCalculatorType}
          />
        </div>

        {calculatorType === "rent_vs_buy" ? (
          <RentVsBuyCalculator country={country} />
        ) : calculatorType === "mli_select" ? (
          <MLISelectCalculator />
        ) : calculatorType === "reno_quote" ? (
          <RenoQuoteWizard />
        ) : (
          <>
            <div className="max-w-2xl mx-auto space-y-6">
              <AddressInput
                address={address}
                city={city}
                region={region}
                country={country}
                postalCode={postalCode}
                onAddressChange={setAddress}
                onCityChange={setCity}
                onRegionChange={setRegion}
                onCountryChange={setCountry}
                onPostalCodeChange={setPostalCode}
              />
              <StrategySelector
                country={country}
                selectedStrategy={strategy}
                onStrategyChange={setStrategy}
              />
              <LeaderboardEligibilityNotice variant="compact" />
              <DealInputs
                inputs={inputs}
                onChange={setInputs}
                strategy={strategy}
                country={country}
                city={city}
                region={region}
              />
              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                onClick={handleCalculate}
                disabled={isCalculating}
                data-testid="button-embedded-calculate"
              >
                {isCalculating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5" />
                )}
                {isCalculating ? "Running Analysis..." : leadCaptured ? "Update Analysis" : "Analyze This Deal"}
              </Button>
            </div>

            {/* Mirror the standalone analyzer: anonymous users always get the
                headline metrics after Calculate; the deeper charts stay behind
                the same save-your-progress capture as the standalone path. */}
            {showResults && (
              <div className="mt-10 space-y-6">
                <MetricCards
                  capRate={results.capRate}
                  cashOnCash={results.cashOnCash}
                  dscr={results.dscr}
                  irr={results.irr}
                  monthlyCashFlow={results.monthlyCashFlow}
                />
                {leadCaptured ? (
                  <AnalysisCharts results={results} />
                ) : (
                  <Card className="border-dashed border-primary/30 bg-background/80">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold">Want the full model and saved workflow?</h3>
                          <p className="text-sm text-muted-foreground">
                            Save your progress to unlock deeper charts, exports, and repeat-use shortcuts.
                          </p>
                        </div>
                        <Button
                          onClick={() => setLeadCaptureOpen(true)}
                          className="gap-2 shrink-0"
                          data-testid="button-embedded-unlock-breakdown"
                        >
                          Save My Progress
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        <LeadCaptureModal
          open={leadCaptureOpen}
          onOpenChange={setLeadCaptureOpen}
          onSubmit={handleLeadSubmit}
          isSubmitting={leadMutation.isPending}
          defaultValues={getSavedLeadInfo() || undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        // Title/description come from the shared route meta map so the client
        // Helmet layer can never disagree with the server head tags again.
        title={isStandaloneTool
          ? SHARED_ROUTE_META["/tools/analyzer"].title
          : "Canadian Real Estate Deal Analyzer - Toronto Property Calculator"}
        description={isStandaloneTool
          ? SHARED_ROUTE_META["/tools/analyzer"].description
          : "Free real estate analyzer for Canadian investors. Calculate yields, IRR, cash-on-cash for Toronto, Vancouver, Calgary. Home of Daniel Foch's podcast."}
        keywords="canadian real estate, toronto real estate, real estate investing in canada, daniel foch, yield calculator canada, BRRR strategy, multiplex investing"
        // `/deal-analyzer` now 301s to `/tools/analyzer` at the Express level,
        // so the standalone tool canonicalizes to `/tools/analyzer` even if a
        // client-side navigation lands on the legacy path.
        canonicalUrl={isStandaloneTool ? "/tools/analyzer" : "/"}
        structuredData={combinedSchema}
      />
      <Navigation />
      
      <main>
        <section
          ref={analyzerRef}
          className={isStandaloneTool ? "py-8 md:py-12" : "py-16 md:py-24 border-t border-border/50"}
          id="analyzer"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 overflow-x-hidden">
            {nlPrompt && (
              <Card className="mb-8 border-primary/25 bg-gradient-to-r from-primary/8 via-background to-accent/8">
                <CardContent className="p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search Brief</p>
                    <p className="text-sm md:text-base font-medium">“{nlPrompt}”</p>
                    <p className="text-sm text-muted-foreground">
                      You were routed into underwriting. If you want sourcing instead, jump directly into deal discovery tools.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Link href="/tools/motivated-deals">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => track({ event: "cta_clicked", cta: "find_deals_from_nl_prompt", location: "analyzer_entry", destination: "/tools/motivated-deals" })}
                      >
                        Find Deals
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/tools/cap-rates">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => track({ event: "cta_clicked", cta: "yield_map_from_nl_prompt", location: "analyzer_entry", destination: "/tools/cap-rates" })}
                      >
                        Open Yield Map
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  Deal analyzer
                </p>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Real Estate Deal Analyzer for Canadian Investors
                </h1>
                <p className="text-lg text-muted-foreground mt-3">
                  Underwrite a property without the noise. Start with a listing, address, or rough deal thesis. We&apos;ll get you to first-pass cash flow and yield quickly.
                </p>
                <AnalysesCounter className="mt-4" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Link href="/tools/cap-rates">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => track({ event: "cta_clicked", cta: "switch_to_map_from_analyzer", location: "analyzer_header", destination: "/tools/cap-rates" })}
                  >
                    Search the map instead
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/tools/motivated-deals">
                  <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={() => track({ event: "cta_clicked", cta: "switch_to_motivated_from_analyzer", location: "analyzer_header", destination: "/tools/motivated-deals" })}
                  >
                    Browse motivated deals
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex justify-center mb-8">
              <CalculatorSelector
                selected={calculatorType}
                onSelect={setCalculatorType}
              />
            </div>

            {calculatorType === "rent_vs_buy" ? (
              <RentVsBuyCalculator country={country} />
            ) : calculatorType === "mli_select" ? (
              <MLISelectCalculator />
            ) : calculatorType === "reno_quote" ? (
              <RenoQuoteWizard />
            ) : (
              <>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Property details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <AddressInput
                      address={address}
                      city={city}
                      region={region}
                      country={country}
                      postalCode={postalCode}
                      onAddressChange={setAddress}
                      onCityChange={setCity}
                      onRegionChange={setRegion}
                      onCountryChange={setCountry}
                      onPostalCodeChange={setPostalCode}
                    />
                    <StrategySelector
                      country={country}
                      selectedStrategy={strategy}
                      onStrategyChange={setStrategy}
                    />
                  </CardContent>
                </Card>

                <LeaderboardEligibilityNotice variant="compact" />
                <DealInputs
                  inputs={inputs}
                  onChange={setInputs}
                  country={country}
                  strategy={strategy}
                  region={region}
                  city={city}
                  address={[address, city, region].filter(Boolean).join(", ")}
                  defaultLeadInfo={getSavedLeadInfo() || undefined}
                />

                <Button
                  size="lg"
                  className="w-full h-14 text-lg gap-2"
                  onClick={handleCalculate}
                  disabled={isCalculating}
                  data-testid="button-calculate"
                >
                  {isCalculating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Calculator className="h-5 w-5" />
                  )}
                  {isCalculating ? "Running Analysis..." : leadCaptured ? "Update Analysis" : "Calculate & View Results"}
                </Button>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Purchase Price</span>
                          <span className="font-mono">{formatCurrency(inputs.purchasePrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Down Payment</span>
                          <span className="font-mono">{formatCurrency(inputs.purchasePrice * inputs.downPaymentPercent / 100)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Mortgage Rate</span>
                          <span className="font-mono">{inputs.interestRate.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Monthly Rent</span>
                          <span className="font-mono">{formatCurrency(inputs.monthlyRent)}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border/50 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Est. Cash Flow</span>
                          <span className={`font-mono font-bold ${results.monthlyCashFlow >= 0 ? "text-accent" : "text-destructive"}`}>
                            {formatCurrency(results.monthlyCashFlow)}/mo
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Gross Yield</span>
                          <span className="font-mono font-bold">{results.capRate.toFixed(1)}%</span>
                        </div>
                      </div>
                      {!leadCaptured && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          Your first-pass numbers appear below. Save, export, and follow-up actions unlock after account capture.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Need to source first?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        If you don&apos;t have a specific property yet, switch into discovery and come back here once you find something worth underwriting.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Link href="/tools/cap-rates">
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                            onClick={() => track({ event: "cta_clicked", cta: "open_map_from_sidebar", location: "analyzer_sidebar", destination: "/tools/cap-rates" })}
                          >
                            Open yield map
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href="/tools/motivated-deals">
                          <Button
                            variant="ghost"
                            className="w-full justify-between"
                            onClick={() => track({ event: "cta_clicked", cta: "open_motivated_from_sidebar", location: "analyzer_sidebar", destination: "/tools/motivated-deals" })}
                          >
                            Browse motivated deals
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {(recentSavedListings.length > 0 || recentSavedSearches.length > 0) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Resume recent work</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {recentSavedListings[0] && (
                          <div className="rounded-lg border border-border/60 px-3 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent deal</p>
                            <p className="text-sm font-medium mt-2">{recentSavedListings[0].label}</p>
                            <p className="text-xs text-muted-foreground">
                              {[recentSavedListings[0].city, recentSavedListings[0].strategy?.replace(/_/g, " "), recentSavedListings[0].capRate != null ? `${recentSavedListings[0].capRate.toFixed(1)}% cap` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        )}
                        {recentSavedSearches[0] && (
                          <div className="rounded-lg border border-border/60 px-3 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent search</p>
                            <p className="text-sm font-medium mt-2">{recentSavedSearches[0].label}</p>
                            <p className="text-xs text-muted-foreground">
                              {[recentSavedSearches[0].geography, recentSavedSearches[0].query || recentSavedSearches[0].strategy?.replace(/_/g, " "), recentSavedSearches[0].budgetMax ? `Up to ${formatCurrency(recentSavedSearches[0].budgetMax)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        </section>

        {showResults && calculatorType === "deal_analyzer" && (
          <section 
            ref={resultsRef}
            className="py-16 md:py-24 border-t border-border/50 bg-muted/30"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold">Analysis Results</h2>
                  <p className="text-muted-foreground mt-1">
                    {propertyLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-2" onClick={handleSaveDeal} data-testid="button-save-deal">
                    <Save className="h-4 w-4" />
                    Save deal
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-2" onClick={handleSaveSearch} data-testid="button-save-search">
                    <MapPinned className="h-4 w-4" />
                    Save Search
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2" 
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    data-testid="button-export"
                  >
                    {isExportingPDF ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    {isExportingPDF ? "Exporting..." : "Export PDF"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2" 
                    onClick={handleExportSheets}
                    disabled={isExportingSheets}
                    data-testid="button-export-sheets"
                  >
                    {isExportingSheets ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {isExportingSheets ? "Exporting..." : "Google Sheets"}
                  </Button>
                </div>
              </div>

              <Card className="border-primary/25 bg-gradient-to-r from-background via-primary/5 to-accent/10">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 max-w-3xl">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className={`h-4 w-4 ${resultVerdict.tone}`} />
                        <span className={resultVerdict.tone}>{resultVerdict.title}</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Your results</h3>
                        <p className="text-muted-foreground mt-1">
                          {resultVerdict.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {inferredIntentChips.map((chip) => (
                          <Badge key={`results-${chip}`} variant="secondary" className="text-xs">
                            {chip}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
                      {!leadCaptured ? (
                        <Button className="gap-2" onClick={() => setLeadCaptureOpen(true)} data-testid="button-next-capture-account">
                          <Target className="h-4 w-4" />
                          Save progress
                        </Button>
                      ) : (
                        <Link href="/investor">
                          <Button className="gap-2 w-full" data-testid="button-next-investor-portal">
                            <Target className="h-4 w-4" />
                            Open investor portal
                          </Button>
                        </Link>
                      )}
                      <Button variant="outline" className="gap-2" onClick={handleSaveDeal} data-testid="button-next-save-deal">
                        <Save className="h-4 w-4" />
                        Save this deal
                      </Button>
                      <Button variant="ghost" className="gap-2" onClick={handleSearchMatchingDeals} data-testid="button-next-search-matching">
                        <MapPinned className="h-4 w-4" />
                        Find matching deals
                      </Button>
                      <Button variant="ghost" className="gap-2" onClick={handleSaveSearch} data-testid="button-next-save-search">
                        <MapPinned className="h-4 w-4" />
                        Save search
                      </Button>
                      <Button variant="ghost" className="gap-2" onClick={handleAnalyzeAnother} data-testid="button-next-analyze-another">
                        <ArrowRight className="h-4 w-4" />
                        Analyze another property
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={handleOpenInspectionRequest} data-testid="button-next-book-inspection">
                        <ClipboardCheck className="h-4 w-4" />
                        Book inspection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isCalculating ? (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-5">
                      {[...Array(5)].map((_, index) => (
                        <Skeleton key={index} className="h-24 rounded-xl" />
                      ))}
                    </div>
                    <Skeleton className="h-40 rounded-xl" />
                  </CardContent>
                </Card>
              ) : (
                <MetricCards
                  capRate={results.capRate}
                  cashOnCash={results.cashOnCash}
                  dscr={results.dscr}
                  irr={results.irr}
                  monthlyCashFlow={results.monthlyCashFlow}
                />
              )}

              {/* Real comparables (live DDF snapshots) — the fabricated
                  similar-deals card that used to sit here was removed in
                  PR #66. This strip only ever shows genuine active listings
                  linking to their real listing pages, and renders nothing
                  when there are none. */}
              {!isCalculating && similarListings.length > 0 && (
                <Card data-testid="card-similar-listings">
                  <CardHeader>
                    <CardTitle>Similar listings</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Active listings in {city.trim()} within 25% of your purchase price, from live MLS data.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {similarListings.map((listing) => (
                        <Link
                          key={listing.mlsNumber}
                          href={listing.path}
                          className="block rounded-lg border overflow-hidden hover-elevate"
                          data-testid={`link-similar-listing-${listing.mlsNumber}`}
                        >
                          {listing.photoUrl && (
                            <img
                              src={listing.photoUrl}
                              alt={listing.address || `MLS ${listing.mlsNumber}`}
                              className="h-32 w-full object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="p-4 space-y-1.5">
                            {listing.price != null && (
                              <div className="font-semibold">{formatCurrency(listing.price)}</div>
                            )}
                            <div className="text-sm font-medium truncate">
                              {listing.address || `MLS ${listing.mlsNumber}`}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {[listing.city, listing.province].filter(Boolean).join(", ")}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {listing.bedrooms != null && <span>{listing.bedrooms} bed</span>}
                              {listing.bathrooms != null && <span>{listing.bathrooms} bath</span>}
                              {listing.propertyType && <span className="truncate">{listing.propertyType}</span>}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!isCalculating && (
                <Card className="border-amber-500/25" data-testid="card-plex-detection">
                  <CardHeader>
                    <CardTitle>Possible plex signal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {plexDetection.estimated_unit_count ? (
                        <Badge variant="secondary">Possible {plexDetection.estimated_unit_count}-unit setup</Badge>
                      ) : (
                        <Badge variant="outline">No strong plex signal</Badge>
                      )}
                      <Badge variant="outline">{plexDetection.plex_confidence_score}/100 confidence</Badge>
                      {plexDetection.needs_manual_review && <Badge variant="outline">Manual review</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plexDetection.plex_detection_reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unit count and legal status are estimated from available fields and text. Verify legal status before underwriting or waiving conditions.
                    </p>
                  </CardContent>
                </Card>
              )}

              {!isCalculating && (
                <ResultsSummary
                  inputs={inputs}
                  results={results}
                  address={[address, city, region].filter(Boolean).join(", ")}
                  stressTest={stressTestResults}
                />
              )}

              {!isCalculating && <NextStepBlock sourcePage="/tools/analyzer" className="mt-8" />}

              {!isCalculating && (leadCaptured ? (
                <>
                  <SourcesUsesWaterfall
                    inputs={inputs}
                    results={results}
                    strategy={strategy}
                  />

                  <AnalysisCharts results={results} />

                  <div className="hidden sm:block">
                    <ProformaTable results={results} inputs={inputs} />
                  </div>

                  <div className="sm:hidden">
                    {showProforma ? (
                      <div>
                        <ProformaTable results={results} inputs={inputs} />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-4"
                          onClick={() => setShowProforma(false)}
                          data-testid="button-hide-proforma"
                        >
                          Hide Proforma Table
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full gap-2"
                        onClick={() => setShowProforma(true)}
                        data-testid="button-show-proforma"
                      >
                        <Table className="h-4 w-4" />
                        Show 10-Year Proforma Table
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Card className="border-dashed border-primary/30 bg-background/80">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Want the full model and saved workflow?</h3>
                        <p className="text-muted-foreground max-w-2xl">
                          Save your progress to unlock the full pro forma, deeper charts, exports, and repeat-use shortcuts.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => setLeadCaptureOpen(true)}
                          className="gap-2"
                          data-testid="button-unlock-breakdown"
                        >
                          Save My Progress
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSaveSearch}
                          className="gap-2"
                          data-testid="button-save-search-gated"
                        >
                          Save Search
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!isCalculating && <DealTimeline />}

              {!isCalculating && showResults && calculatorType === "deal_analyzer" && (
                <AskRealistPanel
                  context={{
                    address: address || undefined,
                    city: city || undefined,
                    province: region || undefined,
                    strategy,
                    price: inputs.purchasePrice || undefined,
                    monthlyRent: inputs.monthlyRent || undefined,
                    capRate: Number.isFinite(results.capRate) ? results.capRate : undefined,
                    cashOnCash: Number.isFinite(results.cashOnCash) ? results.cashOnCash : undefined,
                    monthlyCashFlow: Number.isFinite(results.monthlyCashFlow) ? results.monthlyCashFlow : undefined,
                    dscr: typeof results.dscr === "number" && Number.isFinite(results.dscr) ? results.dscr : undefined,
                  }}
                />
              )}

              {!isCalculating && showResults && calculatorType === "deal_analyzer" && (
              <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-background to-amber-500/5">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                        <Building2 className="h-4 w-4" />
                        <span>Deal Desk</span>
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold" data-testid="text-deal-desk-cta-title">
                        Take this deal forward
                      </h3>
                      <p className="text-muted-foreground max-w-lg">
                        Your numbers carry over automatically. A Realist advisor will review the deal, flag risks,
                        and match you with a vetted local realtor or mortgage pro to see it through.{" "}
                        <Link href="/work-with-realist" className="underline hover:text-foreground">
                          How this works
                        </Link>
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="gap-2 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleDealDeskCta}
                      data-testid="button-deal-desk-cta"
                    >
                      <Building2 className="h-4 w-4" />
                      Take it forward
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              )}

              {!isCalculating && leadCaptured && (
              <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-background to-primary/5">
                <CardContent className="p-6 md:p-8">
                  <div className="text-center space-y-4">
                    <h3 className="text-xl md:text-2xl font-bold" data-testid="text-get-matched-title">
                      Ready to move on this deal?
                    </h3>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                      Start your offer and a Realist advisor will connect you with a realtor to draft and submit it on this property.
                    </p>
                    <div className="flex items-center justify-center">
                      <Button
                        size="lg"
                        className="gap-2 w-full sm:w-auto"
                        data-testid="button-make-offer"
                        onClick={handleMakeOffer}
                      >
                        <FileSignature className="h-4 w-4" />
                        Make an Offer
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </section>
        )}
      </main>


      <LeadCaptureModal
        open={leadCaptureOpen}
        onOpenChange={setLeadCaptureOpen}
        onSubmit={handleLeadSubmit}
        isSubmitting={leadMutation.isPending}
        defaultValues={getSavedLeadInfo() || undefined}
      />

      <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send an inspector</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
              <p className="font-medium">{propertyLabel}</p>
              <p className="text-muted-foreground">Checkout starts at {formatCurrency(500)} CAD. After payment, Realist routes the request to an inspector or contractor partner for confirmation.</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Inspection type</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={inspectionType}
                onChange={(event) => setInspectionType(event.target.value)}
                data-testid="select-inspection-type"
              >
                <option value="standard_home_inspection">Standard home inspection</option>
                <option value="investor_rental_inspection">Investor/rental inspection</option>
                <option value="plex_multi_unit_inspection">Plex/multi-unit inspection</option>
                <option value="pre_offer_walkthrough">Pre-offer walkthrough</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Contact name</label>
                <Input value={inspectionContactName} onChange={(e) => setInspectionContactName(e.target.value)} placeholder="Name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Contact email</label>
                <Input value={inspectionContactEmail} onChange={(e) => setInspectionContactEmail(e.target.value)} placeholder="Email" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Contact phone</label>
              <Input value={inspectionContactPhone} onChange={(e) => setInspectionContactPhone(e.target.value)} placeholder="Phone" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Preferred dates/times</label>
              <Input value={inspectionPreferredTimes} onChange={(e) => setInspectionPreferredTimes(e.target.value)} placeholder="Example: Tuesday afternoon or Friday morning" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Access notes</label>
              <Textarea value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Listing agent, lockbox, access constraints, known concerns" />
            </div>
            <p className="text-xs text-muted-foreground">
              Certified inspectors and contractor partners can onboard from signup and are manually verified before dispatch.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inspectionRequestMutation.mutate()}
              disabled={inspectionRequestMutation.isPending}
              data-testid="button-submit-inspection-request"
            >
              {inspectionRequestMutation.isPending ? "Starting checkout..." : "Checkout - $500"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Deal for Comparison</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Deal Name</label>
              <Input
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Enter a name for this deal"
                data-testid="input-deal-name"
              />
            </div>
            {mlsNumber && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <Checkbox
                  id="share-community"
                  checked={shareWithCommunity}
                  onCheckedChange={(checked) => setShareWithCommunity(!!checked)}
                  data-testid="checkbox-share-community"
                />
                <div className="grid gap-1">
                  <label htmlFor="share-community" className="text-sm font-medium cursor-pointer">
                    Share analysis with community
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Your analysis will appear on the Yield Map for MLS# {mlsNumber}, helping other investors evaluate this property.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSave} 
              disabled={!dealName.trim() || saveDealMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveDealMutation.isPending ? "Saving..." : "Save Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
