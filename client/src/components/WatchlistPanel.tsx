import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, BellRing, Loader2, MapPin, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { authPath } from "@/lib/authReturn";
import { apiRequest } from "@/lib/queryClient";

interface WatchlistWatch {
  id: string;
  listingKey: string;
  sourceType: string;
  address: string | null;
  city: string | null;
  lastKnownPrice: number | null;
  lastAlertAt: string | null;
  createdAt: string;
}

interface WatchlistSavedSearch {
  id: string;
  name: string;
  criteria: {
    query?: string;
    city?: string;
    province?: string;
    propertyType?: string;
    minCap?: number;
    minPrice?: number;
    maxPrice?: number;
    country?: "CA" | "US";
  };
  frequency: string;
  lastRunAt: string | null;
  lastMatchCount: number;
  lastAlertAt: string | null;
  createdAt: string;
}

interface WatchlistResponse {
  watches: WatchlistWatch[];
  savedSearches: WatchlistSavedSearch[];
}

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

function formatDate(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "never" : date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/**
 * Legacy watcher rows were auto-created by retired passive tracking (listing
 * views / shortlist saves). They still alert until removed, so surface where
 * each watch came from and let the user delete any of them.
 */
function sourceLabel(sourceType: string): string | null {
  switch (sourceType) {
    case "watch_ddf":
    case "watch_us":
      return null; // explicit watch — no caveat needed
    case "view":
      return "auto-added from a listing view";
    case "saved_listing":
      return "auto-added from your shortlist";
    case "saved_deal":
      return "auto-added from a saved deal";
    default:
      return `added via ${sourceType.replace(/_/g, " ")}`;
  }
}

/**
 * Watched listings + saved searches with alert status and delete controls.
 * Backed by the real /api/watchlists data (listing_watchers + saved_searches).
 */
export function WatchlistPanel() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<WatchlistResponse>({
    queryKey: ["/api/watchlists"],
    enabled: isAuthenticated,
  });

  const deleteWatch = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/watchlists/watches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      toast({ title: "Watch removed", description: "No more alerts for that listing." });
    },
    onError: (error: Error) => toast({ title: "Could not remove watch", description: error.message, variant: "destructive" }),
  });

  const deleteSearch = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/watchlists/searches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      toast({ title: "Saved search removed", description: "No more match alerts for that search." });
    },
    onError: (error: Error) => toast({ title: "Could not remove search", description: error.message, variant: "destructive" }),
  });

  if (!authLoading && !isAuthenticated) {
    return (
      <Card data-testid="card-watchlist-signed-out">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" /> Watchlist
          </CardTitle>
          <CardDescription>
            Watch listings and save searches to get price-change and new-listing alerts by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => { window.location.href = authPath("/create-account"); }} data-testid="button-watchlist-signup">
            Create a free account to start watching
          </Button>
        </CardContent>
      </Card>
    );
  }

  const watches = data?.watches ?? [];
  const searches = data?.savedSearches ?? [];

  return (
    <Card data-testid="card-watchlist">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" /> Watchlist
        </CardTitle>
        <CardDescription>
          Price-change alerts for listings you watch and match alerts for saved searches — batched, never spammy.
          US price changes are near-real-time; Canadian (DDF) changes are detected on the data crawler's cadence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading || authLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Watched listings ({watches.length})
              </p>
              {watches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing watched yet. Open a listing on the{" "}
                  <Link href="/tools/cap-rates" className="text-primary underline">Cap Rates map</Link>{" "}
                  and hit “Watch for price changes”.
                </p>
              ) : (
                <ul className="space-y-2">
                  {watches.map((watch) => {
                    const caveat = sourceLabel(watch.sourceType);
                    return (
                      <li key={watch.id} className="flex items-start justify-between gap-3 rounded-md border p-3" data-testid={`watch-row-${watch.listingKey}`}>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {watch.address || `MLS ${watch.listingKey}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {[watch.city, watch.lastKnownPrice != null ? currency.format(watch.lastKnownPrice) : null]
                              .filter(Boolean)
                              .join(" · ") || `Listing ${watch.listingKey}`}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {watch.lastAlertAt ? (
                              <span className="inline-flex items-center gap-1">
                                <BellRing className="h-3 w-3" /> Last alert {formatDate(watch.lastAlertAt)}
                              </span>
                            ) : (
                              <span>No alerts yet</span>
                            )}
                            {caveat && <Badge variant="outline" className="text-[10px]">{caveat}</Badge>}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteWatch.mutate(watch.id)}
                          disabled={deleteWatch.isPending}
                          data-testid={`button-delete-watch-${watch.listingKey}`}
                        >
                          {deleteWatch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saved searches ({searches.length})
              </p>
              {searches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved searches. Set filters on the{" "}
                  <Link href="/tools/cap-rates" className="text-primary underline">Cap Rates map</Link>{" "}
                  and hit “Save Search” to get alerted when new matches appear.
                </p>
              ) : (
                <ul className="space-y-2">
                  {searches.map((search) => (
                    <li key={search.id} className="flex items-start justify-between gap-3 rounded-md border p-3" data-testid={`search-row-${search.id}`}>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{search.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{search.frequency}</Badge>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[
                            search.criteria.city,
                            search.criteria.propertyType,
                            search.criteria.minCap != null ? `${search.criteria.minCap}%+ cap` : null,
                            search.criteria.maxPrice != null ? `under ${currency.format(search.criteria.maxPrice)}` : null,
                          ].filter(Boolean).join(" · ") || search.criteria.query || "All listings"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last checked {formatDate(search.lastRunAt)} · {search.lastMatchCount} match{search.lastMatchCount === 1 ? "" : "es"}
                          {search.lastAlertAt ? ` · last alert ${formatDate(search.lastAlertAt)}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteSearch.mutate(search.id)}
                        disabled={deleteSearch.isPending}
                        data-testid={`button-delete-search-${search.id}`}
                      >
                        {deleteSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                Add more from the <Link href="/tools/cap-rates" className="text-primary underline">Cap Rates map</Link>.
                Unsubscribe links are in every alert email.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
