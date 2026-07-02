import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { authPath } from "@/lib/authReturn";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";

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

interface WatchlistResponse {
  watches: WatchlistWatch[];
  savedSearches: unknown[];
}

export interface WatchListingButtonProps {
  /** DDF listing key / MLS number (CA) or us_listings source id (US). */
  listingKey: string;
  source: "ddf" | "us";
  address?: string;
  city?: string;
  price?: number;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

/**
 * Explicit watch toggle — the ONLY way listing watches get created.
 * Anonymous users are routed into the existing create-account flow (same
 * authPath + returnUrl pattern as other gated actions) and land back here.
 */
export function WatchListingButton({
  listingKey,
  source,
  address,
  city,
  price,
  variant = "outline",
  size = "default",
  className,
}: WatchListingButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery<WatchlistResponse>({
    queryKey: ["/api/watchlists"],
    enabled: isAuthenticated,
  });
  const existingWatch = data?.watches.find((watch) => watch.listingKey === listingKey);

  const watchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/watchlists/watches", {
        listingKey,
        source,
        address,
        city,
        price,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      track({ event: "listing_watchlisted", listing_id: listingKey, city, price, source: "watch_button" });
      toast({
        title: "Watching this listing",
        description: "We'll email you when the price changes. Manage watches on your watchlist.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not watch listing", description: error.message, variant: "destructive" });
    },
  });

  const unwatchMutation = useMutation({
    mutationFn: async () => {
      if (!existingWatch) return null;
      const response = await apiRequest("DELETE", `/api/watchlists/watches/${existingWatch.id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      track({ event: "listing_unwatchlisted", listing_id: listingKey, city, price, source: "watch_button" });
      toast({ title: "Stopped watching", description: "No more alerts for this listing." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not remove watch", description: error.message, variant: "destructive" });
    },
  });

  const pending = watchMutation.isPending || unwatchMutation.isPending;

  const handleClick = () => {
    if (!isAuthenticated) {
      // Route anonymous users into the existing lead-capture/create-account
      // flow; returnUrl brings them back to this listing afterwards.
      window.location.href = authPath("/create-account");
      return;
    }
    if (existingWatch) {
      unwatchMutation.mutate();
    } else {
      watchMutation.mutate();
    }
  };

  return (
    <Button
      variant={existingWatch ? "secondary" : variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={pending}
      data-testid="button-watch-listing"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : existingWatch ? (
        <BellOff className="h-4 w-4 mr-2" />
      ) : (
        <Bell className="h-4 w-4 mr-2" />
      )}
      {existingWatch ? "Watching — stop alerts" : "Watch for price changes"}
    </Button>
  );
}
