import { storage } from "./storage";

export interface EventbriteEvent {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  imageUrl: string;
  eventUrl: string;
  status: string;
}

const ORGANIZER_ID = "87580319633";
const CACHE_KEY = "eventbrite:events";
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

// In-memory cache as primary cache (works in production without database)
let memoryCache: {
  events: EventbriteEvent[];
  fetchedAt: Date;
  source: string;
} | null = null;

function mapEventbriteEvent(e: any): EventbriteEvent {
  return {
    id: e.id,
    name: e.name?.text || "Untitled Event",
    description: e.description?.text?.substring(0, 300) || "",
    startDate: e.start?.utc || "",
    endDate: e.end?.utc || "",
    timezone: e.start?.timezone || "America/Toronto",
    venueName: e.venue?.name || "Online",
    venueAddress: e.venue?.address?.localized_address_display || "",
    imageUrl: e.logo?.url || "",
    eventUrl: e.url || `https://www.eventbrite.ca/e/${e.id}`,
    status: e.status || "live",
  };
}

async function fetchEventsFromAPI(): Promise<EventbriteEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) {
    console.log("No EVENTBRITE_TOKEN configured, will use placeholder events");
    return [];
  }

  console.log("Fetching events from Eventbrite API...");

  try {
    const allEvents: EventbriteEvent[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const response = await fetch(
        `https://www.eventbriteapi.com/v3/organizers/${ORGANIZER_ID}/events/?status=live,started,ended&order_by=start_desc&expand=venue&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Eventbrite API error on page ${page}: ${response.status}`, errorText);
        break;
      }

      const data = await response.json();
      const pageEvents = (data.events || []).map(mapEventbriteEvent);
      allEvents.push(...pageEvents);

      hasMore = data.pagination?.has_more_items === true;
      page++;
    }

    console.log(`Fetched ${allEvents.length} total events from Eventbrite (${page - 1} pages)`);
    return allEvents;
  } catch (error) {
    console.error("Eventbrite API error:", error);
    return [];
  }
}

function getPlaceholderEvents(): EventbriteEvent[] {
  return [
    {
      id: "placeholder-1",
      name: "Real Estate Investment Masterclass",
      description: "Join The Canadian Real Estate Investor Podcast team for an exclusive deep-dive into multiplex investing strategies. Learn how to analyze deals, secure financing, and build wealth through real estate.",
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Toronto",
      venueName: "Online Event",
      venueAddress: "Virtual",
      imageUrl: "",
      eventUrl: "https://www.eventbrite.ca/o/the-canadian-real-estate-investor-podcast-87580319633",
      status: "live",
    },
    {
      id: "placeholder-2",
      name: "BRRR Strategy Workshop",
      description: "Master the Buy, Rehab, Rent, Refinance, Repeat strategy with hands-on examples and real deal analysis. Perfect for investors looking to scale their portfolio efficiently.",
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Toronto",
      venueName: "Online Event",
      venueAddress: "Virtual",
      imageUrl: "",
      eventUrl: "https://www.eventbrite.ca/o/the-canadian-real-estate-investor-podcast-87580319633",
      status: "live",
    },
    {
      id: "placeholder-3",
      name: "Networking Night - Toronto Investors",
      description: "Connect with fellow real estate investors in the Greater Toronto Area. Share experiences, discuss market trends, and build valuable relationships in the industry.",
      startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Toronto",
      venueName: "Toronto Downtown",
      venueAddress: "Toronto, ON",
      imageUrl: "",
      eventUrl: "https://www.eventbrite.ca/o/the-canadian-real-estate-investor-podcast-87580319633",
      status: "live",
    },
  ];
}

export async function getEvents(): Promise<{ events: EventbriteEvent[]; cached: boolean; lastFetched: Date | null; source: string }> {
  try {
    // Check in-memory cache first (most reliable, works in production)
    // BUT: Don't use cached placeholder events - always try to fetch real events
    if (memoryCache && !memoryCache.source.includes("placeholder") && !memoryCache.source.includes("fallback")) {
      const cacheAge = Date.now() - memoryCache.fetchedAt.getTime();
      const isStale = cacheAge > CACHE_DURATION_MS;
      
      if (!isStale) {
        console.log("Returning events from in-memory cache");
        return {
          events: memoryCache.events,
          cached: true,
          lastFetched: memoryCache.fetchedAt,
          source: memoryCache.source + "_memory",
        };
      }
      // Cache is stale, refresh in background but return stale data
      refreshEventsAsync();
      return {
        events: memoryCache.events,
        cached: true,
        lastFetched: memoryCache.fetchedAt,
        source: memoryCache.source + "_memory_stale",
      };
    }
    
    // If we have placeholder cache, try to fetch fresh first
    if (memoryCache && (memoryCache.source.includes("placeholder") || memoryCache.source.includes("fallback"))) {
      console.log("Have placeholder cache, attempting fresh fetch from Eventbrite...");
    }
    
    // No memory cache, try database cache as fallback
    let dbCached;
    try {
      dbCached = await storage.getDataCache(CACHE_KEY);
      if (dbCached) {
        console.log("Loaded events from database cache");
        // Populate memory cache from database
        memoryCache = {
          events: dbCached.valueJson as EventbriteEvent[],
          fetchedAt: dbCached.fetchedAt,
          source: dbCached.source || "database",
        };
        
        const cacheAge = Date.now() - new Date(dbCached.fetchedAt).getTime();
        if (cacheAge > CACHE_DURATION_MS) {
          refreshEventsAsync();
        }
        
        return {
          events: memoryCache.events,
          cached: true,
          lastFetched: memoryCache.fetchedAt,
          source: memoryCache.source,
        };
      }
    } catch (cacheError) {
      console.log("Database cache read failed, will fetch from API:", cacheError);
    }
    
    // No cache available, fetch from API
    const apiEvents = await fetchEventsFromAPI();
    
    if (apiEvents.length > 0) {
      // Store in memory cache (always works)
      memoryCache = {
        events: apiEvents,
        fetchedAt: new Date(),
        source: "eventbrite_api",
      };
      
      // Try to persist to database cache (may fail in production)
      try {
        await storage.setDataCache({
          key: CACHE_KEY,
          valueJson: apiEvents,
          source: "eventbrite_api",
        });
      } catch (cacheError) {
        console.log("Database cache write failed, events stored in memory only:", cacheError);
      }
      
      return {
        events: apiEvents,
        cached: false,
        lastFetched: new Date(),
        source: "eventbrite_api",
      };
    }
    
    // API returned no events, use placeholders
    const placeholderEvents = getPlaceholderEvents();
    memoryCache = {
      events: placeholderEvents,
      fetchedAt: new Date(),
      source: "placeholder",
    };
    
    return {
      events: placeholderEvents,
      cached: false,
      lastFetched: new Date(),
      source: "placeholder",
    };
  } catch (error) {
    console.error("Error in getEvents:", error);
    // Even on error, return placeholder events
    const placeholderEvents = getPlaceholderEvents();
    memoryCache = {
      events: placeholderEvents,
      fetchedAt: new Date(),
      source: "fallback",
    };
    return {
      events: placeholderEvents,
      cached: false,
      lastFetched: null,
      source: "fallback",
    };
  }
}

async function refreshEventsAsync() {
  try {
    console.log("Refreshing Eventbrite events in background...");
    const events = await fetchEventsFromAPI();
    
    if (events.length > 0) {
      // Always update memory cache
      memoryCache = {
        events,
        fetchedAt: new Date(),
        source: "eventbrite_api_refresh",
      };
      
      // Try database cache but don't fail if it errors
      try {
        await storage.setDataCache({
          key: CACHE_KEY,
          valueJson: events,
          source: "eventbrite_api_refresh",
        });
      } catch (dbError) {
        console.log("Database cache update failed during refresh:", dbError);
      }
      
      console.log(`Refreshed ${events.length} events from Eventbrite API`);
    }
  } catch (error) {
    console.error("Background refresh failed:", error);
  }
}

export function clearEventCache(): void {
  console.log("Clearing event memory cache...");
  memoryCache = null;
}

export async function forceRefreshEvents(): Promise<{ events: EventbriteEvent[]; source: string }> {
  console.log("Force refreshing Eventbrite events...");
  
  // Clear memory cache first to ensure fresh fetch
  memoryCache = null;
  
  const apiEvents = await fetchEventsFromAPI();
  
  if (apiEvents.length > 0) {
    // Always update memory cache
    memoryCache = {
      events: apiEvents,
      fetchedAt: new Date(),
      source: "eventbrite_api_force",
    };
    
    // Try database cache
    try {
      await storage.setDataCache({
        key: CACHE_KEY,
        valueJson: apiEvents,
        source: "eventbrite_api_force",
      });
    } catch (dbError) {
      console.log("Database cache update failed during force refresh:", dbError);
    }
    
    return { events: apiEvents, source: "eventbrite_api" };
  }
  
  const placeholderEvents = getPlaceholderEvents();
  memoryCache = {
    events: placeholderEvents,
    fetchedAt: new Date(),
    source: "placeholder_force",
  };
  
  try {
    await storage.setDataCache({
      key: CACHE_KEY,
      valueJson: placeholderEvents,
      source: "placeholder_force",
    });
  } catch (dbError) {
    console.log("Database cache update failed for placeholders:", dbError);
  }
  
  return { events: placeholderEvents, source: "placeholder" };
}
