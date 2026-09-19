import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ddfAdaptations, isDdfConfigured, normalizeDdfListing, searchDdfListings } from "@/lib/ddf/client";
import {
  underwriteDdfListing,
  type RentMemo,
} from "@/lib/underwriting/underwriteListing";
import { PROVINCE_NAMES, searchByYield } from "@/lib/ddf/yieldSearch";

export const maxDuration = 60;

/** Cards per page — one DDF page per request, well under the API's 100 cap. */
const PAGE_SIZE = 24;
/** How many of the newest matching listings are underwritten and ranked when the yield index has nothing for a search. */
const LIVE_RANK_POOL = 100;

const boundsSchema = z
  .object({
    north: z.number().min(-90).max(90),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    west: z.number().min(-180).max(180),
  })
  .refine((b) => b.south <= b.north, { message: "south must be <= north" });

const searchSchema = z.object({
  city: z.string().trim().min(1).max(80).optional(),
  province: z.string().trim().min(2).max(40).optional(),
  minPrice: z.number().positive().max(1_000_000_000).optional(),
  maxPrice: z.number().positive().max(1_000_000_000).optional(),
  minBeds: z.number().int().min(0).max(20).optional(),
  minUnits: z.number().int().min(1).max(200).optional(),
  propertySubType: z.string().trim().min(1).max(60).optional(),
  bounds: boundsSchema.optional(),
  /** "yield" = highest net yield first, from the crawler's snapshots; default is the live feed's own order. */
  sort: z.enum(["newest", "yield"]).default("newest"),
  minYield: z.number().min(0).max(20).optional(),
  page: z.number().int().min(1).max(200).default(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const params = parsed.data;

  // Yield-sorted browse reads our own index (the crawl's snapshots); it doesn't need the live feed to be up.
  const wantsYield = params.sort === "yield" || Boolean(params.minYield);
  if (wantsYield) {
    try {
      const { listings, count } = await searchByYield({ ...params, pageSize: PAGE_SIZE });
      // An empty index is not an empty market. Where the crawl hasn't reached yet (a new database,
      // a city it hasn't got to) fall through and rank what the live feed has, and say so.
      if (count > 0 || !isDdfConfigured()) return NextResponse.json({ listings, count, page: params.page, pageSize: PAGE_SIZE, sort: "yield" });
    } catch (error) {
      console.error("[api/listings/search] yield search:", (error as Error).message);
      if (!isDdfConfigured()) return NextResponse.json({ error: "Listing search failed — please try again." }, { status: 502 });
    }
  }

  // The door never closes because CREA's feed is down: the last week of our own
  // crawl is a complete, already-underwritten set of active listings.
  const fromSnapshots = async () => {
    try {
      const { listings, count } = await searchByYield({ ...params, pageSize: PAGE_SIZE });
      return count > 0 ? NextResponse.json({ listings, count, page: params.page, pageSize: PAGE_SIZE, sort: "yield", source: "snapshots" }) : null;
    } catch {
      return null;
    }
  };

  if (!isDdfConfigured()) {
    return (await fromSnapshots()) ?? NextResponse.json({ error: "listings_unconfigured" }, { status: 503 });
  }

  try {
    const result = await searchDdfListings({
      city: params.city,
      // CREA knows provinces by name; links and saved searches often carry the two-letter code.
      stateOrProvince: params.province ? (PROVINCE_NAMES[params.province.trim().toUpperCase()] ?? params.province) : undefined,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minBeds: params.minBeds,
      minUnits: params.minUnits,
      propertySubType: params.propertySubType,
      latitudeMin: params.bounds?.south,
      latitudeMax: params.bounds?.north,
      longitudeMin: params.bounds?.west,
      longitudeMax: params.bounds?.east,
      excludeBusinessSales: true,
      excludeParking: true,
      excludeVacantLand: true,
      // Ranking by yield without the index: take a deeper cut of the newest matches, underwrite them all, keep the best.
      top: wantsYield ? LIVE_RANK_POOL : PAGE_SIZE,
      skip: wantsYield ? 0 : (params.page - 1) * PAGE_SIZE,
    });

    // Pre-underwrite every card. One rent memo per request so a page of
    // listings in the same city costs one estimator query, and one bad
    // listing can never kill the whole response.
    const memo: RentMemo = new Map();
    const listings = (
      await Promise.all(
        result.listings.map(async (raw) => {
          try {
            const normalized = normalizeDdfListing(raw);
            let underwrite = null;
            try {
              underwrite = await underwriteDdfListing(raw, memo);
            } catch (error) {
              console.warn(`[api/listings/search] underwrite failed for ${raw.ListingKey}:`, error);
            }
            return { ...normalized, underwrite };
          } catch (error) {
            console.warn(`[api/listings/search] skipping malformed listing ${raw?.ListingKey}:`, error);
            return null;
          }
        }),
      )
    ).filter(Boolean);

    if (wantsYield) {
      type Ranked = { underwrite: { netYield: number | null } | null };
      const floor = params.minYield ?? -Infinity;
      const ranked = (listings as Ranked[])
        .filter((listing) => listing.underwrite?.netYield != null && listing.underwrite.netYield >= floor && listing.underwrite.netYield <= 25)
        .sort((a, b) => (b.underwrite!.netYield as number) - (a.underwrite!.netYield as number));
      return NextResponse.json({
        listings: ranked.slice((params.page - 1) * PAGE_SIZE, params.page * PAGE_SIZE),
        count: ranked.length,
        page: params.page,
        pageSize: PAGE_SIZE,
        sort: "yield",
        // The honest label: best of the newest, not best of the market — until the index reaches this search.
        source: "live-ranked",
        pool: LIVE_RANK_POOL,
        feed: ddfAdaptations(),
      });
    }

    return NextResponse.json({
      listings,
      count: result.count,
      page: params.page,
      pageSize: PAGE_SIZE,
      // What CREA's feed has made us give up (field and filter names only) — shows up on /admin too.
      feed: ddfAdaptations(),
    });
  } catch (error) {
    console.error("[api/listings/search]", error);
    return (
      (await fromSnapshots()) ??
      NextResponse.json({ error: "Listing search failed — please try again." }, { status: 502 })
    );
  }
}
