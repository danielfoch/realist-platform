import { useEffect } from "react";
import { useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";

// The stats explorer is hosted separately (Vite + ECharts on Vercel) at
// stats.realist.ca. We embed it here behind the Realist login so members get
// the full tool inside an authenticated page. Direct stats.realist.ca access
// stays public — this is a soft, account-encouraging gate, not access control.
const STATS_URL = "https://stats.realist.ca/";

export default function Stats() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation(authPath("/login", "/stats"));
    }
  }, [user, authLoading, setLocation]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO
        title="Canadian Housing Stats Explorer | Realist"
        description="Explore Canadian housing statistics — prices, sales, inventory, vacancy, rents and macro data — with interactive charts. Members-only."
        canonicalUrl="/tools/stats"
        noIndex
      />
      <Navigation />
      {!user ? (
        <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
          {authLoading ? "Loading…" : "Redirecting to sign in…"}
        </div>
      ) : (
        <iframe
          src={STATS_URL}
          title="Canadian Housing Stats Explorer"
          className="w-full flex-1 border-0"
          style={{ minHeight: "calc(100vh - 4rem)" }}
          allow="clipboard-write; fullscreen"
        />
      )}
    </div>
  );
}
