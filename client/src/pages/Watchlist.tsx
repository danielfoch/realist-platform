import { Link } from "wouter";
import { Map, TrendingUp } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { WatchlistPanel } from "@/components/WatchlistPanel";

/**
 * Real watchlist page — watched listings + saved searches with alerts,
 * backed by /api/watchlists (listing_watchers + saved_searches).
 *
 * Replaces the prototype "Investor OS" demo that previously answered
 * /watchlist with hardcoded sample deals.
 */
export default function Watchlist() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="My Watchlist — Price & New-Listing Alerts | Realist.ca"
        description="Watch listings for price changes and save searches for new-listing alerts across Canadian and US investment properties."
        canonicalUrl="/watchlist"
        noIndex
      />
      <Navigation />
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">My Watchlist</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Your product-created reasons to come back: price drops on listings you watch and
              fresh inventory matching your saved searches, delivered by email.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/tools/cap-rates">
              <Button className="gap-2"><Map className="h-4 w-4" /> Open the map</Button>
            </Link>
            <Link href="/tools/analyzer">
              <Button variant="outline" className="gap-2"><TrendingUp className="h-4 w-4" /> Analyzer</Button>
            </Link>
          </div>
        </div>

        <WatchlistPanel />
      </main>
    </div>
  );
}
