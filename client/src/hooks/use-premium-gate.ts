import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

function getVisitorId(): string {
  let id = localStorage.getItem("realist_visitor_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("realist_visitor_id", id);
  }
  return id;
}

export type GatedFeature = 
  | "stress_test"
  | "proforma"
  | "charts"
  | "sources_uses"
  | "metric_irr"
  | "metric_dscr";

const EXPERIMENT_KEY = "premium_gate_v1";

const VARIANT_GATES: Record<string, GatedFeature[]> = {
  A: ["stress_test", "proforma"],
  B: ["charts", "sources_uses"],
  C: ["metric_irr", "metric_dscr", "proforma"],
};

export function usePremiumGate() {
  const [variant, setVariant] = useState<string | null>(null);
  const visitorId = getVisitorId();

  const { data: premiumStatus } = useQuery<{
    tier: string;
    isPremium: boolean;
  }>({
    queryKey: ["/api/subscription/status"],
    staleTime: 60000,
  });

  useEffect(() => {
    const cached = localStorage.getItem(`experiment_${EXPERIMENT_KEY}`);
    if (cached) {
      setVariant(cached);
      return;
    }

    fetch("/api/experiments/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, experimentKey: EXPERIMENT_KEY }),
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.variant) {
          setVariant(data.variant);
          localStorage.setItem(`experiment_${EXPERIMENT_KEY}`, data.variant);
        }
      })
      .catch(() => {
        setVariant("A");
      });
  }, [visitorId]);

  const isPremium = premiumStatus?.isPremium === true;

  const isFeatureGated = useCallback(
    (feature: GatedFeature): boolean => {
      if (isPremium) return false;
      if (!variant) return false;
      const gates = VARIANT_GATES[variant] || [];
      return gates.includes(feature);
    },
    [isPremium, variant]
  );

  const trackConversion = useCallback(() => {
    fetch("/api/experiments/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, experimentKey: EXPERIMENT_KEY }),
      credentials: "include",
    }).catch(() => {});
  }, [visitorId]);

  return {
    isPremium,
    variant,
    isFeatureGated,
    trackConversion,
    visitorId,
  };
}
