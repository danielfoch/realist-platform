import type { Express, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import {
  createJvListingSchema,
  findJvListingMatches,
  jvListingSearchSchema,
  updateJvListingStatusSchema,
} from "@shared/jvPartnerMatching";

// The subset of storage the JV partner routes depend on, injectable so the
// HTTP layer can be tested without a database.
export interface JvPartnerStorage {
  createJvPartnerListing: typeof storage.createJvPartnerListing;
  getJvPartnerListing: typeof storage.getJvPartnerListing;
  searchJvPartnerListings: typeof storage.searchJvPartnerListings;
  updateJvPartnerListingStatus: typeof storage.updateJvPartnerListingStatus;
  createJvPartnerMatch: typeof storage.createJvPartnerMatch;
  getJvPartnerMatchByListingAndUser: typeof storage.getJvPartnerMatchByListingAndUser;
  getJvPartnerMatchesForUser: typeof storage.getJvPartnerMatchesForUser;
}

interface JvPartnerRouteDeps {
  storage?: JvPartnerStorage;
  authMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
}

// Fire-and-forget like ensureAuthSchema: routes must still register if the
// DB is briefly unreachable, and every clause is idempotent.
export async function ensureJvPartnerTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "jv_partner_listings" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL REFERENCES "users"("id"),
      "title" text NOT NULL,
      "description" text,
      "partner_role_offered" text NOT NULL,
      "city" text,
      "province" text,
      "investment_min" real,
      "investment_max" real,
      "status" text DEFAULT 'active' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "jv_partner_matches" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "listing_id" varchar NOT NULL REFERENCES "jv_partner_listings"("id"),
      "matched_user_id" varchar NOT NULL REFERENCES "users"("id"),
      "match_type" text DEFAULT 'auto' NOT NULL,
      "status" text DEFAULT 'suggested' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);
}

function userIdFrom(req: Request): string {
  return req.session.userId as string;
}

function zodErrorResponse(res: Response, error: ZodError) {
  return res.status(400).json({
    message: "Validation failed",
    errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
  });
}

export function registerJvPartnerRoutes(app: Express, deps: JvPartnerRouteDeps = {}): void {
  const store = deps.storage ?? storage;
  const requireAuth = deps.authMiddleware ?? isAuthenticated;

  // Create a listing (auth required). After creating, run the simple
  // matching pass: complementary role + overlapping location against every
  // other active listing, and store the matches explicitly (both
  // directions) so each user can manage them in the portal.
  app.post("/api/jv-listings", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = createJvListingSchema.parse(req.body);
      const userId = userIdFrom(req);

      const listing = await store.createJvPartnerListing({ ...data, userId });

      const candidates = await store.searchJvPartnerListings({
        status: "active",
        excludeUserId: userId,
      });
      const matches = findJvListingMatches(listing, candidates);
      for (const candidate of matches) {
        await store.createJvPartnerMatch({
          listingId: listing.id,
          matchedUserId: candidate.userId,
          matchType: "auto",
          status: "suggested",
        });
        await store.createJvPartnerMatch({
          listingId: candidate.id,
          matchedUserId: userId,
          matchType: "auto",
          status: "suggested",
        });
      }

      res.status(201).json({ listing, matchCount: matches.length });
    } catch (error) {
      if (error instanceof ZodError) return zodErrorResponse(res, error);
      console.error("Error creating JV listing:", error);
      res.status(500).json({ message: "Failed to create JV listing" });
    }
  });

  // Search/filter listings (public browse)
  app.get("/api/jv-listings", async (req: Request, res: Response) => {
    try {
      const filters = jvListingSearchSchema.parse(req.query);
      const listings = await store.searchJvPartnerListings({ ...filters, status: "active" });
      res.json({ listings });
    } catch (error) {
      if (error instanceof ZodError) return zodErrorResponse(res, error);
      console.error("Error searching JV listings:", error);
      res.status(500).json({ message: "Failed to search JV listings" });
    }
  });

  // Listing detail (public)
  app.get("/api/jv-listings/:id", async (req: Request, res: Response) => {
    try {
      const listing = await store.getJvPartnerListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      res.json({ listing });
    } catch (error) {
      console.error("Error fetching JV listing:", error);
      res.status(500).json({ message: "Failed to fetch JV listing" });
    }
  });

  // Mark a listing closed (auth, owner only)
  app.patch("/api/jv-listings/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const { status } = updateJvListingStatusSchema.parse(req.body);
      const listing = await store.getJvPartnerListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      if (listing.userId !== userIdFrom(req)) {
        return res.status(403).json({ message: "Only the listing owner can change its status" });
      }
      const updated = await store.updateJvPartnerListingStatus(listing.id, status);
      res.json({ listing: updated });
    } catch (error) {
      if (error instanceof ZodError) return zodErrorResponse(res, error);
      console.error("Error updating JV listing status:", error);
      res.status(500).json({ message: "Failed to update JV listing status" });
    }
  });

  // Express interest in a listing (auth required) — stores an explicit match
  app.post("/api/jv-listings/:id/interest", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = userIdFrom(req);
      const listing = await store.getJvPartnerListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      if (listing.status !== "active") {
        return res.status(400).json({ message: "This listing is closed" });
      }
      if (listing.userId === userId) {
        return res.status(400).json({ message: "You cannot express interest in your own listing" });
      }

      const existing = await store.getJvPartnerMatchByListingAndUser(listing.id, userId, "interest");
      if (existing) {
        return res.json({ match: existing, alreadyInterested: true });
      }

      const match = await store.createJvPartnerMatch({
        listingId: listing.id,
        matchedUserId: userId,
        matchType: "interest",
        status: "interested",
      });
      res.status(201).json({ match });
    } catch (error) {
      console.error("Error expressing interest:", error);
      res.status(500).json({ message: "Failed to express interest" });
    }
  });

  // Matches for the logged-in user (as listing owner or matched user)
  app.get("/api/jv-matches", requireAuth, async (req: Request, res: Response) => {
    try {
      const matches = await store.getJvPartnerMatchesForUser(userIdFrom(req));
      res.json({ matches });
    } catch (error) {
      console.error("Error fetching JV matches:", error);
      res.status(500).json({ message: "Failed to fetch JV matches" });
    }
  });
}
