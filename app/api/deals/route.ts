import { NextRequest, NextResponse } from "next/server";
import {
  filterDistressListings,
  readDistressCache,
  triggerBackgroundScan,
  isDistressScanInProgress,
  type DistressFilterOptions,
} from "@/lib/distress/scan";

export const maxDuration = 60;

/**
 * Serves the motivated-deals feed from the scan cache: fresh cache is served
 * as-is, a stale cache is served immediately while a background rescan warms,
 * and a missing cache returns {warming:true} so the client can poll.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const options: DistressFilterOptions = {};
  const categories = params.get("categories");
  if (categories) options.categories = categories.split(",").filter(Boolean);
  const minScore = Number(params.get("minScore"));
  if (Number.isFinite(minScore) && minScore > 0) options.minScore = minScore;
  const exclude = params.get("exclude");
  if (exclude) options.excludeKeywords = exclude.split(",").filter(Boolean);
  const province = params.get("province");

  try {
    const cached = await readDistressCache();
    if (!cached) {
      triggerBackgroundScan();
      return NextResponse.json({ warming: true, scanning: isDistressScanInProgress() });
    }
    if (!cached.fresh) triggerBackgroundScan();

    let listings = filterDistressListings(cached.data.listings, options);
    if (province) {
      listings = listings.filter(
        (listing) => (listing.address?.state ?? "").toLowerCase() === province.toLowerCase(),
      );
    }

    return NextResponse.json({
      listings: listings.slice(0, 250),
      total: listings.length,
      totalScanned: cached.data.totalDdfScanned,
      updatedAt: cached.updatedAt,
      stale: !cached.fresh,
    });
  } catch (error) {
    console.error("[api/deals]", error);
    return NextResponse.json(
      { error: "Deal feed unavailable — try again shortly." },
      { status: 503 },
    );
  }
}
