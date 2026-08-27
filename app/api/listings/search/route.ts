import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isDdfConfigured,
  normalizeDdfListing,
  searchDdfListings,
} from "@/lib/ddf/client";
import {
  underwriteDdfListing,
  type RentMemo,
} from "@/lib/underwriting/underwriteListing";

export const maxDuration = 60;

/** Cards per page — one DDF page per request, well under the API's 100 cap. */
const PAGE_SIZE = 24;

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
  page: z.number().int().min(1).max(200).default(1),
});

export async function POST(request: NextRequest) {
  if (!isDdfConfigured()) {
    return NextResponse.json({ error: "listings_unconfigured" }, { status: 503 });
  }

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

  try {
    const result = await searchDdfListings({
      city: params.city,
      stateOrProvince: params.province,
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
      top: PAGE_SIZE,
      skip: (params.page - 1) * PAGE_SIZE,
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

    return NextResponse.json({
      listings,
      count: result.count,
      page: params.page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("[api/listings/search]", error);
    return NextResponse.json(
      { error: "Listing search failed — please try again." },
      { status: 502 },
    );
  }
}
