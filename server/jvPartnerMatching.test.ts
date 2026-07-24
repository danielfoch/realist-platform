import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  db: {},
}));

vi.mock("./storage", () => ({
  storage: {},
}));

vi.mock("./auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

import { registerJvPartnerRoutes, type JvPartnerStorage } from "./jvPartnerMatching";
import type { JvPartnerListing, JvPartnerMatch } from "@shared/schema";

function makeListing(overrides: Partial<JvPartnerListing>): JvPartnerListing {
  return {
    id: `listing-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    title: "Test listing",
    description: null,
    partnerRoleOffered: "land",
    city: "Toronto",
    province: "ON",
    investmentMin: null,
    investmentMax: null,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// In-memory JvPartnerStorage so the HTTP layer can be exercised without a DB.
function createFakeStorage(seedListings: JvPartnerListing[] = []) {
  const listings: JvPartnerListing[] = [...seedListings];
  const matches: JvPartnerMatch[] = [];
  let matchSeq = 0;

  const store: JvPartnerStorage = {
    async createJvPartnerListing(listing) {
      const created = makeListing({ ...listing, id: `listing-${listings.length + 1}` } as JvPartnerListing);
      listings.push(created);
      return created;
    },
    async getJvPartnerListing(id) {
      return listings.find((l) => l.id === id);
    },
    async searchJvPartnerListings(filters) {
      return listings.filter((l) => {
        if (l.status !== (filters?.status ?? "active")) return false;
        if (filters?.role && l.partnerRoleOffered !== filters.role) return false;
        if (filters?.province && l.province?.toLowerCase() !== filters.province.toLowerCase()) return false;
        if (filters?.city && l.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
        if (filters?.excludeUserId && l.userId === filters.excludeUserId) return false;
        return true;
      });
    },
    async updateJvPartnerListingStatus(id, status) {
      const listing = listings.find((l) => l.id === id);
      if (!listing) return undefined;
      listing.status = status;
      return listing;
    },
    async createJvPartnerMatch(match) {
      const created: JvPartnerMatch = {
        id: `match-${++matchSeq}`,
        listingId: match.listingId,
        matchedUserId: match.matchedUserId,
        matchType: match.matchType ?? "auto",
        status: match.status ?? "suggested",
        createdAt: new Date("2026-01-01"),
      };
      matches.push(created);
      return created;
    },
    async getJvPartnerMatchByListingAndUser(listingId, userId, matchType) {
      return matches.find(
        (m) => m.listingId === listingId && m.matchedUserId === userId && (!matchType || m.matchType === matchType),
      );
    },
    async getJvPartnerMatchesForUser(userId) {
      return matches
        .filter((m) => {
          const listing = listings.find((l) => l.id === m.listingId);
          return m.matchedUserId === userId || listing?.userId === userId;
        })
        .map((m) => ({ match: m, listing: listings.find((l) => l.id === m.listingId)! }));
    },
  };

  return { store, listings, matches };
}

function buildApp(store: JvPartnerStorage, userId = "user-1"): Express {
  const app = express();
  app.use(express.json());
  registerJvPartnerRoutes(app, {
    storage: store,
    authMiddleware: (req: any, _res, next) => {
      req.session = { userId };
      next();
    },
  });
  return app;
}

describe("JV partner API", () => {
  let fake: ReturnType<typeof createFakeStorage>;
  let app: Express;

  beforeEach(() => {
    fake = createFakeStorage([
      makeListing({ id: "land-1", userId: "owner-1", partnerRoleOffered: "land", province: "ON" }),
      makeListing({ id: "cap-1", userId: "owner-2", partnerRoleOffered: "capital", province: "ON" }),
      makeListing({ id: "cap-bc", userId: "owner-3", partnerRoleOffered: "capital", province: "BC" }),
    ]);
    app = buildApp(fake.store, "user-1");
  });

  it("GET /api/jv-listings browses active listings publicly", async () => {
    const res = await request(app).get("/api/jv-listings");
    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(3);
  });

  it("GET /api/jv-listings filters by role and province", async () => {
    const res = await request(app).get("/api/jv-listings?role=capital&province=ON");
    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(1);
    expect(res.body.listings[0].id).toBe("cap-1");
  });

  it("GET /api/jv-listings/:id returns detail publicly", async () => {
    const res = await request(app).get("/api/jv-listings/land-1");
    expect(res.status).toBe(200);
    expect(res.body.listing.title).toBe("Test listing");
  });

  it("GET /api/jv-listings/:id returns 404 for unknown listings", async () => {
    const res = await request(app).get("/api/jv-listings/nope");
    expect(res.status).toBe(404);
  });

  it("POST /api/jv-listings creates a listing and stores complementary matches", async () => {
    const res = await request(app)
      .post("/api/jv-listings")
      .send({ title: "Development partner", partnerRoleOffered: "development", province: "ON" });

    expect(res.status).toBe(201);
    expect(res.body.listing.userId).toBe("user-1");
    // Complementary to land-1 and cap-1 in ON, not cap-bc in BC
    expect(res.body.matchCount).toBe(2);
    // Matches stored both directions (2 candidates × 2 rows)
    expect(fake.matches).toHaveLength(4);
    expect(fake.matches.every((m) => m.matchType === "auto" && m.status === "suggested")).toBe(true);
  });

  it("POST /api/jv-listings rejects invalid payloads", async () => {
    const res = await request(app)
      .post("/api/jv-listings")
      .send({ title: "", partnerRoleOffered: "money" });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/jv-listings/:id/status lets the owner close a listing", async () => {
    const mine = await request(app)
      .post("/api/jv-listings")
      .send({ title: "My capital", partnerRoleOffered: "capital", province: "ON" });
    const id = mine.body.listing.id;

    const res = await request(app).patch(`/api/jv-listings/${id}/status`).send({ status: "closed" });
    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe("closed");
  });

  it("PATCH /api/jv-listings/:id/status forbids non-owners", async () => {
    const res = await request(app).patch("/api/jv-listings/land-1/status").send({ status: "closed" });
    expect(res.status).toBe(403);
  });

  it("POST /api/jv-listings/:id/interest stores an explicit match", async () => {
    const res = await request(app).post("/api/jv-listings/land-1/interest");
    expect(res.status).toBe(201);
    expect(res.body.match.matchType).toBe("interest");
    expect(res.body.match.status).toBe("interested");
    expect(res.body.match.matchedUserId).toBe("user-1");
  });

  it("POST /api/jv-listings/:id/interest is idempotent per user", async () => {
    await request(app).post("/api/jv-listings/land-1/interest");
    const res = await request(app).post("/api/jv-listings/land-1/interest");
    expect(res.status).toBe(200);
    expect(res.body.alreadyInterested).toBe(true);
    expect(fake.matches.filter((m) => m.matchType === "interest")).toHaveLength(1);
  });

  it("POST /api/jv-listings/:id/interest rejects interest in your own listing", async () => {
    const mine = await request(app)
      .post("/api/jv-listings")
      .send({ title: "My land", partnerRoleOffered: "land", province: "ON" });
    const res = await request(app).post(`/api/jv-listings/${mine.body.listing.id}/interest`);
    expect(res.status).toBe(400);
  });

  it("GET /api/jv-matches returns matches involving the current user", async () => {
    await request(app)
      .post("/api/jv-listings")
      .send({ title: "Development partner", partnerRoleOffered: "development", province: "ON" });
    await request(app).post("/api/jv-listings/land-1/interest");

    const res = await request(app).get("/api/jv-matches");
    expect(res.status).toBe(200);
    expect(res.body.matches.length).toBeGreaterThan(0);
    expect(res.body.matches.every((row: any) =>
      row.match.matchedUserId === "user-1" || row.listing.userId === "user-1",
    )).toBe(true);
  });

  it("requires auth for protected endpoints when the session is missing", async () => {
    const unauthApp = express();
    unauthApp.use(express.json());
    // Real isAuthenticated semantics: no session userId -> 401
    registerJvPartnerRoutes(unauthApp, {
      storage: fake.store,
      authMiddleware: (req: any, res, next) => {
        if (req.session?.userId) return next();
        res.status(401).json({ message: "Unauthorized" });
      },
    });

    expect((await request(unauthApp).post("/api/jv-listings").send({})).status).toBe(401);
    expect((await request(unauthApp).get("/api/jv-matches")).status).toBe(401);
    expect((await request(unauthApp).post("/api/jv-listings/land-1/interest")).status).toBe(401);
  });
});
