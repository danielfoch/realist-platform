import { useEffect } from "react";
import { useLocation } from "wouter";
import { trackTrafficEvent } from "@/lib/trafficAnalytics";

export function TrafficAnalyticsTracker() {
  const [location] = useLocation();

  useEffect(() => {
    trackTrafficEvent({
      eventName: "page_view",
      page: `${window.location.pathname}${window.location.search}`,
      path: window.location.pathname,
      component: "spa_router",
    });
  }, [location]);

  return null;
}
