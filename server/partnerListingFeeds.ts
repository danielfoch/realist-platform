/**
 * Partner IDX/VOW listing feeds.
 *
 * Two onboarding paths (both sign the IDX feed agreement):
 * - repliers_idx: licensed feed provisioned through Repliers/Valery. Created
 *   as awaiting_provisioning; an admin activates it once Dan confirms data
 *   costs with Repliers and the partner approves them in writing.
 * - own_idx_site: we import schema.org JSON-LD listings from the partner's
 *   existing IDX website (partner warrants display rights in the agreement).
 *   Initial sync runs immediately; a daily job re-syncs active feeds and
 *   marks listings that disappeared from the source as removed.
 *
 * Public surface: GET /api/partner-listings serves active partner listings
 * with the attribution block ("Listing provided by NAME via IDX — BOARD",
 * partner contact info, and the listing brokerage name).
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { z } from "zod";
import { and, desc, eq, inArray, notInArray, sql as dsql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated, isAdmin } from "./auth";
import { logUserActivity } from "./userActivity";
import {
  industryPartners,
  partnerListingFeeds,
  partnerListings,
  users,
  type PartnerListingFeed,
} from "@shared/schema";
import { buildIdxFeedAgreement, isListingFeedType, LISTING_FEED_TYPES } from "@shared/partnerNetwork";
import { extractIdxListings } from "@shared/idxListingExtract";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MANUAL_SYNC_COOLDOWN_MS = 10 * 60 * 1000;

const createFeedSchema = z.object({
  feedType: z.enum(LISTING_FEED_TYPES),
  idxSiteUrl: z.string().trim().url().max(500).optional(),
  boardName: z.string().trim().max(200).optional(),
  signedName: z.string().trim().min(1, "Full legal name is required"),
  signatureDataUrl: z.string().min(1, "Signature is required"),
});

/** Reject URLs that could reach internal services (basic SSRF guard). */
function isFetchableIdxUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // numeric IPv4 / IPv6 hosts: block private and loopback ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return false;
    }
  }
  if (host.includes(":")) return false;
  return true;
}

async function fetchIdxHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "RealistPartnerFeedBot/1.0 (+https://realist.ca/join/realtors)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`Source returned HTTP ${res.status}`);
    }
    const text = await res.text();
    if (text.length > MAX_HTML_BYTES) {
      return text.slice(0, MAX_HTML_BYTES);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Import listings from a partner's own IDX site. Returns counts for the UI. */
export async function syncOwnIdxFeed(feed: PartnerListingFeed): Promise<{ imported: number; removed: number }> {
  if (feed.feedType !== "own_idx_site" || !feed.idxSiteUrl) {
    throw new Error("Feed is not an own-site IDX feed");
  }
  if (!isFetchableIdxUrl(feed.idxSiteUrl)) {
    throw new Error("Feed URL is not fetchable");
  }

  try {
    const html = await fetchIdxHtml(feed.idxSiteUrl);
    const extracted = extractIdxListings(html, feed.idxSiteUrl);
    const now = new Date();

    for (const listing of extracted) {
      await db
        .insert(partnerListings)
        .values({
          feedId: feed.id,
          userId: feed.userId,
          externalId: listing.externalId,
          sourceUrl: listing.sourceUrl,
          mlsNumber: listing.mlsNumber,
          address: listing.address,
          city: listing.city,
          region: listing.region,
          postalCode: listing.postalCode,
          listPrice: listing.listPrice,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          propertyType: listing.propertyType,
          photoUrl: listing.photoUrl,
          description: listing.description,
          listingBrokerage: listing.listingBrokerage,
          status: "active",
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [partnerListings.feedId, partnerListings.externalId],
          set: {
            sourceUrl: listing.sourceUrl,
            mlsNumber: listing.mlsNumber,
            address: listing.address,
            city: listing.city,
            region: listing.region,
            postalCode: listing.postalCode,
            listPrice: listing.listPrice,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            propertyType: listing.propertyType,
            photoUrl: listing.photoUrl,
            description: listing.description,
            listingBrokerage: listing.listingBrokerage,
            status: "active",
            lastSeenAt: now,
          },
        });
    }

    // Listings that vanished from the source page are no longer active.
    // An empty extraction is treated as a soft failure (site change, JS-only
    // render, temporary outage) — existing listings are kept, not wiped.
    const activeIds = extracted.map((l) => l.externalId);
    const removedResult =
      activeIds.length > 0
        ? await db
            .update(partnerListings)
            .set({ status: "removed" })
            .where(
              and(
                eq(partnerListings.feedId, feed.id),
                eq(partnerListings.status, "active"),
                notInArray(partnerListings.externalId, activeIds),
              ),
            )
            .returning({ id: partnerListings.id })
        : [];

    await db
      .update(partnerListingFeeds)
      .set({
        status: "active",
        lastSyncAt: now,
        lastSyncStatus: extracted.length > 0 ? "ok" : "no_listings_found",
        lastSyncError: null,
        // keep the previous count on an empty extraction — listings were kept
        ...(extracted.length > 0 ? { listingsImported: extracted.length } : {}),
        updatedAt: now,
      })
      .where(eq(partnerListingFeeds.id, feed.id));

    return { imported: extracted.length, removed: removedResult.length };
  } catch (err: any) {
    await db
      .update(partnerListingFeeds)
      .set({
        status: "error",
        lastSyncAt: new Date(),
        lastSyncStatus: "error",
        lastSyncError: String(err?.message || err).slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(partnerListingFeeds.id, feed.id));
    throw err;
  }
}

export function registerPartnerListingFeedRoutes(app: Express): void {
  // Partner: my feeds
  app.get("/api/partner-network/listing-feeds", isAuthenticated, async (req: any, res: Response) => {
    try {
      const feeds = await db
        .select()
        .from(partnerListingFeeds)
        .where(eq(partnerListingFeeds.userId, req.session.userId))
        .orderBy(desc(partnerListingFeeds.createdAt));
      const feedIds = feeds.map((f) => f.id);
      const listings = feedIds.length
        ? await db
            .select()
            .from(partnerListings)
            .where(and(inArray(partnerListings.feedId, feedIds), eq(partnerListings.status, "active")))
            .orderBy(desc(partnerListings.lastSeenAt))
        : [];
      res.json({ feeds, listings });
    } catch (error) {
      console.error("Error fetching listing feeds:", error);
      res.status(500).json({ error: "Failed to fetch listing feeds" });
    }
  });

  // Partner: create a feed (signs the IDX agreement)
  app.post("/api/partner-network/listing-feeds", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const parsed = createFeedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const data = parsed.data;

      if (data.feedType === "own_idx_site") {
        if (!data.idxSiteUrl) {
          return res.status(400).json({ error: "Your IDX website URL is required" });
        }
        if (!isFetchableIdxUrl(data.idxSiteUrl)) {
          return res.status(400).json({ error: "That URL can't be imported — use your public IDX listings page" });
        }
      }

      const existing = await db
        .select()
        .from(partnerListingFeeds)
        .where(and(eq(partnerListingFeeds.userId, userId), eq(partnerListingFeeds.feedType, data.feedType)));
      if (existing.some((f) => f.status !== "disabled")) {
        return res.status(400).json({ error: "You already have a feed of this type" });
      }

      const partner = await storage.getIndustryPartner(userId);
      const signedAt = new Date();
      const agreement = buildIdxFeedAgreement({
        feedType: data.feedType,
        signedName: data.signedName,
        brokerageName: partner?.companyName || "",
        realEstateBoard: data.boardName || null,
        idxSiteUrl: data.idxSiteUrl || null,
        signedAtIso: signedAt.toISOString(),
      });

      const [feed] = await db
        .insert(partnerListingFeeds)
        .values({
          userId,
          partnerId: partner?.id || null,
          feedType: data.feedType,
          status: data.feedType === "repliers_idx" ? "awaiting_provisioning" : "active",
          idxSiteUrl: data.idxSiteUrl || null,
          boardName: data.boardName || null,
          agreementVersion: agreement.version,
          agreementText: agreement.text,
          agreementSignedAt: signedAt,
          agreementSignature: data.signatureDataUrl,
          agreementSignedName: data.signedName,
        })
        .returning();

      logUserActivity(req, {
        userId,
        eventName: "partner_listing_feed_created",
        source: "partner_network",
        metadata: {
          feedId: feed.id,
          feedType: data.feedType,
          boardName: data.boardName || null,
          agreementVersion: agreement.version,
        },
      }).catch((err) => console.error("partner_listing_feed_created event error:", err));

      let sync: { imported: number; removed: number } | null = null;
      if (feed.feedType === "own_idx_site") {
        try {
          sync = await syncOwnIdxFeed(feed);
        } catch (err) {
          console.error("Initial IDX feed sync failed:", err);
        }
      }

      res.json({ feed, sync });
    } catch (error) {
      console.error("Error creating listing feed:", error);
      res.status(500).json({ error: "Failed to create listing feed" });
    }
  });

  // Partner: manual re-sync (throttled)
  app.post("/api/partner-network/listing-feeds/:id/sync", isAuthenticated, async (req: any, res: Response) => {
    try {
      const [feed] = await db
        .select()
        .from(partnerListingFeeds)
        .where(and(eq(partnerListingFeeds.id, req.params.id), eq(partnerListingFeeds.userId, req.session.userId)));
      if (!feed) return res.status(404).json({ error: "Feed not found" });
      if (feed.feedType !== "own_idx_site") {
        return res.status(400).json({ error: "Only IDX website feeds can be manually synced" });
      }
      if (feed.lastSyncAt && Date.now() - new Date(feed.lastSyncAt).getTime() < MANUAL_SYNC_COOLDOWN_MS) {
        return res.status(429).json({ error: "Feed was synced recently — try again in a few minutes" });
      }
      const result = await syncOwnIdxFeed(feed);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing listing feed:", error);
      res.status(500).json({ error: error?.message || "Failed to sync feed" });
    }
  });

  // Partner: disable a feed (removes listings from active display)
  app.post("/api/partner-network/listing-feeds/:id/disable", isAuthenticated, async (req: any, res: Response) => {
    try {
      const [feed] = await db
        .select()
        .from(partnerListingFeeds)
        .where(and(eq(partnerListingFeeds.id, req.params.id), eq(partnerListingFeeds.userId, req.session.userId)));
      if (!feed) return res.status(404).json({ error: "Feed not found" });
      await db
        .update(partnerListingFeeds)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(partnerListingFeeds.id, feed.id));
      await db
        .update(partnerListings)
        .set({ status: "removed" })
        .where(eq(partnerListings.feedId, feed.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error disabling listing feed:", error);
      res.status(500).json({ error: "Failed to disable feed" });
    }
  });

  // Admin: all feeds (for Repliers provisioning queue)
  app.get("/api/admin/partner-listing-feeds", isAdmin, async (_req: Request, res: Response) => {
    try {
      const feeds = await db
        .select({
          feed: partnerListingFeeds,
          partnerEmail: users.email,
          partnerFirstName: users.firstName,
          partnerLastName: users.lastName,
          companyName: industryPartners.companyName,
        })
        .from(partnerListingFeeds)
        .leftJoin(users, eq(partnerListingFeeds.userId, users.id))
        .leftJoin(industryPartners, eq(partnerListingFeeds.partnerId, industryPartners.id))
        .orderBy(desc(partnerListingFeeds.createdAt));
      res.json(feeds);
    } catch (error) {
      console.error("Error fetching admin listing feeds:", error);
      res.status(500).json({ error: "Failed to fetch feeds" });
    }
  });

  // Admin: activate a repliers feed after provisioning + fee approval
  app.post("/api/admin/partner-listing-feeds/:id/activate", isAdmin, async (req: Request, res: Response) => {
    try {
      const [feed] = await db
        .update(partnerListingFeeds)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(partnerListingFeeds.id, req.params.id))
        .returning();
      if (!feed) return res.status(404).json({ error: "Feed not found" });
      res.json({ success: true, feed });
    } catch (error) {
      console.error("Error activating listing feed:", error);
      res.status(500).json({ error: "Failed to activate feed" });
    }
  });

  // Public: partner-sourced listings with attribution + partner contact info
  app.get("/api/partner-listings", async (req: Request, res: Response) => {
    try {
      const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
      const conditions = [eq(partnerListings.status, "active"), eq(partnerListingFeeds.status, "active")];
      if (city) {
        conditions.push(dsql`LOWER(${partnerListings.city}) = LOWER(${city})`);
      }
      const rows = await db
        .select({
          listing: partnerListings,
          feedBoard: partnerListingFeeds.boardName,
          partnerSignedName: partnerListingFeeds.agreementSignedName,
          partnerCompany: industryPartners.companyName,
          partnerPublicEmail: industryPartners.publicEmail,
          partnerPhone: industryPartners.phone,
          partnerFirstName: users.firstName,
          partnerLastName: users.lastName,
          partnerEmail: users.email,
        })
        .from(partnerListings)
        .innerJoin(partnerListingFeeds, eq(partnerListings.feedId, partnerListingFeeds.id))
        .leftJoin(industryPartners, eq(partnerListingFeeds.partnerId, industryPartners.id))
        .leftJoin(users, eq(partnerListings.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(partnerListings.lastSeenAt))
        .limit(200);

      res.json(
        rows.map((row) => {
          const partnerName =
            row.partnerSignedName ||
            `${row.partnerFirstName || ""} ${row.partnerLastName || ""}`.trim() ||
            row.partnerCompany ||
            "Realist Partner";
          return {
            ...row.listing,
            attribution: {
              partnerName,
              partnerCompany: row.partnerCompany || null,
              partnerEmail: row.partnerPublicEmail || row.partnerEmail || null,
              partnerPhone: row.partnerPhone || null,
              board: row.feedBoard || null,
              caption: `Listing provided by ${partnerName} via IDX${row.feedBoard ? ` — ${row.feedBoard}` : ""}`,
              listingBrokerage: row.listing.listingBrokerage || null,
            },
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching partner listings:", error);
      res.status(500).json({ error: "Failed to fetch partner listings" });
    }
  });
}

/** Daily re-sync of active own-site feeds, mirroring the other interval jobs. */
export function schedulePartnerListingFeedJobs(log: (msg: string, tag?: string) => void): void {
  const sweep = async () => {
    try {
      const feeds = await db
        .select()
        .from(partnerListingFeeds)
        .where(and(eq(partnerListingFeeds.feedType, "own_idx_site"), inArray(partnerListingFeeds.status, ["active", "error"])));
      let synced = 0;
      for (const feed of feeds) {
        try {
          await syncOwnIdxFeed(feed);
          synced++;
        } catch (err: any) {
          log(`Feed ${feed.id} sync error: ${err.message}`, "partner-feeds");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (feeds.length > 0) {
        log(`Partner IDX feed sweep: ${synced}/${feeds.length} synced`, "partner-feeds");
      }
    } catch (err: any) {
      log(`Partner feed sweep error: ${err.message}`, "partner-feeds");
    }
  };
  // First run shortly after boot, then daily.
  setTimeout(sweep, 10 * 60 * 1000);
  setInterval(sweep, 24 * 60 * 60 * 1000);
}
