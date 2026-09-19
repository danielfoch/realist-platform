import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ddfListingSnapshots, leads, users, type User } from "@/lib/db/schema";
import { houseDefaults } from "@/lib/underwriting/underwriter";
import { useTestDb } from "@/lib/test/db";
import type { Actor } from "./actor";
import { announceBuyBox, dealsForBox, getBuyBox } from "./buyBox";
import { getMarketDecisionLine, rebuildLearnedAssumptions } from "./learn";
import { saveAnalysis } from "./store";
import { describeBuyBox } from "./thesis";

let ctx: Awaited<ReturnType<typeof useTestDb>>;
const member = (id: string): Actor => ({ key: `user:${id}`, user: { id } as Actor["user"], sessionId: null });

/** A Hamilton triplex whose rent sets the cap rate we want the person to be looking at. */
async function underwriteAt(id: string, n: string, price: number, rent: number, verdict: "pursue" | "pass" | "watch", city = "Hamilton") {
  const base = houseDefaults({ price, units: 3, monthlyRent: rent, annualPropertyTax: 6000, province: "ON", city });
  return saveAnalysis(member(id), {
    dealKey: `mls:${n}`, source: "listing", mlsNumber: n, address: `${n} Test St, ${city}, ON`, city, province: "ON",
    inputs: { ...base, vacancyPercent: 4 }, defaults: base, verdict,
  });
}

beforeAll(async () => {
  ctx = await useTestDb();
  await ctx.db.insert(users).values(
    Array.from({ length: 12 }, (_, i) => ({ id: `t${i + 1}`, email: `t${i + 1}@example.com`, name: `Tess ${"ABCDEFGHIJKL"[i]}`, emailVerifiedAt: new Date() })),
  );
}, 60_000);
afterAll(async () => ctx.close());

describe("a member's buy box", () => {
  it("doesn't exist until there is a pattern, then describes them", async () => {
    await underwriteAt("t1", "A1", 640_000, 5100, "pursue");
    await underwriteAt("t1", "A2", 700_000, 5400, "pursue");
    expect(await getBuyBox("t1")).toBeNull();
    await underwriteAt("t1", "A3", 660_000, 5300, "pursue");
    await underwriteAt("t1", "A4", 900_000, 5000, "pass");
    const box = (await getBuyBox("t1"))!;
    expect(box).toMatchObject({ pursued: 3, calls: 4 });
    expect(box.markets[0].city).toBe("Hamilton");
    expect(describeBuyBox(box)).toMatch(/^You pursue 3-unit properties in Hamilton, between \$/);
  });

  it("suggests active listings inside the box that they haven't looked at — brokerage attribution included", async () => {
    const snapshot = (mls: string, city: string, price: number, netYield: number, office: string | null) => ({
      listingKey: `LK-${mls}`, mlsNumber: mls, city, province: "ON", listPrice: price, numberOfUnits: 3, bedroomsTotal: 6,
      estimatedMonthlyRent: 5200, grossYield: netYield + 3, netYield, standardStatus: "Active", streetAddress: `${mls} Snapshot Ave`,
      snapshotMonth: "2026-09", rawJson: office ? { listOfficeName: office } : {},
    });
    await ctx.db.insert(ddfListingSnapshots).values([
      snapshot("FIT1", "Hamilton", 650_000, 6.6, "Steel City Realty"),
      snapshot("FIT2", "Hamilton", 690_000, 6.2, "Steel City Realty"),
      snapshot("A1", "Hamilton", 640_000, 6.5, "Steel City Realty"), // already underwritten by t1
      snapshot("LOWYIELD", "Hamilton", 660_000, 3.1, "Steel City Realty"),
      snapshot("FARAWAY", "Calgary", 650_000, 7.5, "Bow Valley Realty"),
      snapshot("NOBROKER", "Hamilton", 655_000, 7.0, null),
      // Not seen by the crawl in three weeks: sold or pulled, so it is never suggested.
      { ...snapshot("STALE", "Hamilton", 650_000, 6.9, "Steel City Realty"), snapshotMonth: "2026-08", capturedAt: new Date(Date.now() - 21 * 86_400_000) },
    ]);
    const box = (await getBuyBox("t1"))!;
    const deals = await dealsForBox("t1", box);
    expect(deals.map((listing) => listing.mlsNumber)).toEqual(["FIT1", "FIT2"]);
    expect(deals.every((listing) => listing.listOfficeName)).toBe(true);
  });

  it("tells the CRM what they buy once, and again only when it changes", async () => {
    const [user] = await ctx.db.select().from(users).where(eq(users.id, "t1"));
    const box = (await getBuyBox("t1"))!;
    expect(await announceBuyBox(user as User, box)).toBeTruthy();
    expect(await announceBuyBox(user as User, box)).toBeNull();
    const [lead] = await ctx.db.select().from(leads).where(eq(leads.kind, "buy_box"));
    expect(lead).toMatchObject({ email: "t1@example.com", city: "Hamilton", routing: "in_house" });
    // Written for the agent who will call them, so it talks ABOUT the member.
    expect(String(lead.context?.buyBox)).toMatch(/^Pursues 3-unit properties in Hamilton/);
    expect(lead.context?.markets).toEqual(["Hamilton"]);
  });

  it("doesn't tell the CRM about drift more than weekly — but says so at once when WHERE they buy changes", async () => {
    const [user] = await ctx.db.select().from(users).where(eq(users.id, "t1"));
    const box = (await getBuyBox("t1"))!;
    const drifted = { ...box, priceHigh: box.priceHigh + 5_000 };
    expect(await announceBuyBox(user as User, drifted)).toBeNull();
    // Eight days on, the same drift is worth a line.
    await ctx.sql.exec("UPDATE leads SET created_at = created_at - interval '8 days' WHERE kind = 'buy_box'");
    expect(await announceBuyBox(user as User, drifted)).toBeTruthy();
    // An hour later they start buying in a new city: no waiting for next week.
    await ctx.sql.exec("UPDATE leads SET created_at = created_at - interval '1 hour' WHERE kind = 'buy_box'");
    const moved = { ...drifted, markets: [...drifted.markets, { city: "Brantford", province: "ON", share: 0.2 }] };
    expect(await announceBuyBox(user as User, moved)).toBeTruthy();
    expect(await announceBuyBox(user as User, { ...moved, priceLow: moved.priceLow - 5_000 })).toBeNull();
  });
});

describe("a market's decision line", () => {
  it("is where its members say yes, and where they walk away — once enough of them have", async () => {
    for (let i = 2; i <= 6; i += 1) await underwriteAt(`t${i}`, `P${i}`, 640_000, 5000 + i * 40, "pursue");
    for (let i = 7; i <= 11; i += 1) await underwriteAt(`t${i}`, `N${i}`, 900_000, 4600 + i * 20, "pass");
    // Four pursue calls in St. Catharines: not enough to speak for that market.
    for (let i = 2; i <= 5; i += 1) await underwriteAt(`t${i}`, `S${i}`, 600_000, 5200, "pursue", "St. Catharines");
    await rebuildLearnedAssumptions();

    const hamilton = (await getMarketDecisionLine("Hamilton", "ON"))!;
    expect(hamilton.scopeLabel).toBe("Hamilton");
    expect(hamilton.pursueAt).toBeGreaterThan(hamilton.passAt!);
    expect(hamilton.calls).toBeGreaterThanOrEqual(10);

    // No local line yet → the province's, clearly labelled as such.
    expect((await getMarketDecisionLine("St. Catharines", "ON"))!.scopeLabel).toBe("Ontario");
    expect(await getMarketDecisionLine(null, null)).toMatchObject({ scopeLabel: "Canada" });
  });
});
