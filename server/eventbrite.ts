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
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchEventsFromAPI(): Promise<EventbriteEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) {
    console.log("No EVENTBRITE_TOKEN configured, will use placeholder events");
    return [];
  }

  console.log("Fetching events from Eventbrite API...");

  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/organizers/${ORGANIZER_ID}/events/?status=live,started,ended&order_by=start_desc&expand=venue`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Eventbrite API error: ${response.status}`, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`Fetched ${data.events?.length || 0} events from Eventbrite`);
    
    return (data.events || []).map((e: any) => ({
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
    }));
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
    // Try to get cached events first
    let cached;
    try {
      cached = await storage.getDataCache(CACHE_KEY);
    } catch (cacheError) {
      console.log("Cache read failed, will fetch from API:", cacheError);
    }
    
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.fetchedAt).getTime();
      const isStale = cacheAge > CACHE_DURATION_MS;
      
      if (isStale) {
        refreshEventsAsync();
      }
      
      return {
        events: cached.valueJson as EventbriteEvent[],
        cached: true,
        lastFetched: cached.fetchedAt,
        source: cached.source || "cache",
      };
    }
    
    // No cache, fetch from API
    const apiEvents = await fetchEventsFromAPI();
    
    if (apiEvents.length > 0) {
      // Try to cache, but don't fail if caching fails
      try {
        await storage.setDataCache({
          key: CACHE_KEY,
          valueJson: apiEvents,
          source: "eventbrite_api",
        });
      } catch (cacheError) {
        console.log("Cache write failed, returning API data without caching:", cacheError);
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
    try {
      await storage.setDataCache({
        key: CACHE_KEY,
        valueJson: placeholderEvents,
        source: "placeholder",
      });
    } catch (cacheError) {
      console.log("Cache write for placeholders failed:", cacheError);
    }
    
    return {
      events: placeholderEvents,
      cached: false,
      lastFetched: new Date(),
      source: "placeholder",
    };
  } catch (error) {
    console.error("Error in getEvents:", error);
    return {
      events: getPlaceholderEvents(),
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
      await storage.setDataCache({
        key: CACHE_KEY,
        valueJson: events,
        source: "eventbrite_api_refresh",
      });
      console.log(`Refreshed ${events.length} events from Eventbrite API`);
    }
  } catch (error) {
    console.error("Background refresh failed:", error);
  }
}

export async function forceRefreshEvents(): Promise<{ events: EventbriteEvent[]; source: string }> {
  console.log("Force refreshing Eventbrite events...");
  
  const apiEvents = await fetchEventsFromAPI();
  
  if (apiEvents.length > 0) {
    await storage.setDataCache({
      key: CACHE_KEY,
      valueJson: apiEvents,
      source: "eventbrite_api_force",
    });
    return { events: apiEvents, source: "eventbrite_api" };
  }
  
  const placeholderEvents = getPlaceholderEvents();
  await storage.setDataCache({
    key: CACHE_KEY,
    valueJson: placeholderEvents,
    source: "placeholder_force",
  });
  
  return { events: placeholderEvents, source: "placeholder" };
}
