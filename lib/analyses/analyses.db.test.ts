import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "@/lib/db/schema";
import { houseDefaults, type UnderwriterInputs } from "@/lib/underwriting/underwriter";
import { useTestDb } from "@/lib/test/db";
import type { Actor } from "./actor";
import { getActorStats, getDealConsensus, getLeaderboard, getRanks } from "./community";
import { getLearnedDefaults, rebuildLearnedAssumptions } from "./learn";
import { claimAnonymousAnalyses, saveAnalysis, sharePathFor } from "./store";

let ctx: Awaited<ReturnType<typeof useTestDb>>;

const member = (id: string): Actor => ({ key: `user:${id}`, user: { id } as Actor["user"], sessionId: null });
const guest = (sid: string): Actor => ({ key: `sid:${sid}`, user: null, sessionId: sid });

const base = houseDefaults({ price: 700_000, units: 3, monthlyRent: 5000, annualPropertyTax: 6000 });
const deal = (n: number | string, inputs: UnderwriterInputs, extra: Record<string, unknown> = {}) => ({
  dealKey: `mls:H${n}`,
  source: "listing" as const,
  mlsNumber: `H${n}`,
  address: `${n} Barton St E, Hamilton, ON`,
  city: "Hamilton",
  province: "ON",
  inputs,
  defaults: base,
  ...extra,
});

beforeAll(async () => {
  ctx = await useTestDb();
  await ctx.db.insert(users).values(
    Array.from({ length: 30 }, (_, i) => ({ id: `m${i + 1}`, email: `m${i + 1}@example.com`, name: `Member ${"ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"[i]}`, city: "Hamilton", emailVerifiedAt: new Date() })),
  );
  // Signed up with a password, never proved the inbox: has an account, counts for nothing public.
  await ctx.db.insert(users).values({ id: "unproven", email: "unproven@example.com", name: "Un Proven" });
  // Came over from the previous site: trusted without a fresh verification.
  await ctx.db.insert(users).values({ id: "legacy1", email: "legacy1@example.com", name: "Lee Gacy", legacy: { role: "investor" } });
}, 60_000);

afterAll(async () => ctx.close());

describe("the analysis log", () => {
  it("keeps one row per person per deal, recomputed on the server", async () => {
    const first = await saveAnalysis(member("m1"), deal(1, { ...base, monthlyRent: 5400 }));
    const again = await saveAnalysis(member("m1"), deal(1, { ...base, monthlyRent: 5600 }));
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.analysis.id).toBe(first.analysis.id);
    expect(again.analysis.monthlyRent).toBe(5600);
    expect(again.analysis.edited).toEqual(["monthlyRent"]);
    expect(again.analysis.capRate).toBeGreaterThan(first.analysis.capRate!);
    expect((await getActorStats("user:m1")).deals).toBe(1);
  });

  it("refuses a page view dressed up as an analysis", async () => {
    await expect(saveAnalysis(member("m1"), deal("noop", base))).rejects.toThrow(/nothing changed/);
    // …but agreeing with our numbers and making a call IS an analysis — a small one.
    const { analysis } = await saveAnalysis(member("m29"), deal("call", base, { verdict: "pass" }));
    expect(analysis).toMatchObject({ eligible: true, quality: 0.25, edited: [] });
  });

  it("never re-publishes an analysis the person made private", async () => {
    await saveAnalysis(member("m28"), deal("private", { ...base, vacancyPercent: 4 }, { isPublic: false }));
    const resaved = await saveAnalysis(member("m28"), deal("private", { ...base, vacancyPercent: 3 }));
    expect(resaved.analysis.isPublic).toBe(false);
  });

  it("logs fantasy numbers but never counts them", async () => {
    const { analysis } = await saveAnalysis(member("m1"), deal("fantasy", { ...base, monthlyRent: 95_000 }));
    expect(analysis.eligible).toBe(false);
    expect((await getActorStats("user:m1")).deals).toBe(1);
  });

  it("hands a guest's work to their new account, keeping the member's version on a clash", async () => {
    await saveAnalysis(guest("abc123abc123abc1"), deal(2, { ...base, vacancyPercent: 3 }));
    await saveAnalysis(guest("abc123abc123abc1"), deal(1, { ...base, monthlyRent: 1 }));
    await claimAnonymousAnalyses("m1", "abc123abc123abc1");
    const stats = await getActorStats("user:m1");
    expect(stats.deals).toBe(2);
    // Deal 1 already belonged to the member: their 5,600 survives, the guest's 1 does not.
    const mine = await saveAnalysis(member("m1"), deal(1, { ...base, monthlyRent: 5600 }));
    expect(mine.created).toBe(false);
  });

  it("shares only with the owner's say-so", async () => {
    expect(await sharePathFor("user:m2", "mls:H1")).toBeNull();
    const path = await sharePathFor("user:m1", "mls:H1");
    expect(path).toMatch(/^\/a\/[A-Za-z0-9_-]{10,}$/);
    expect(await sharePathFor("user:m1", "mls:H1")).toBe(path);
  });
});

describe("what other people see", () => {
  it("shows medians on a deal only once three members stand behind them — guests never count", async () => {
    await saveAnalysis(member("m2"), deal(1, { ...base, monthlyRent: 5000 }, { verdict: "pass" }));
    await saveAnalysis(guest("fffefffefffefffe"), deal(1, { ...base, monthlyRent: 9000 }));
    const two = await getDealConsensus("mls:H1");
    expect(two.analysts).toBe(2);
    expect(two.medians).toBeNull();

    await saveAnalysis(member("m3"), deal(1, { ...base, monthlyRent: 5200 }, { verdict: "pursue" }));
    const three = await getDealConsensus("mls:H1");
    expect(three.analysts).toBe(3);
    // m2 left our rent alone, so only two people WORKED this deal: still no medians.
    expect(three.medians).toBeNull();

    await saveAnalysis(member("m5"), deal(1, { ...base, monthlyRent: 5300 }));
    const four = await getDealConsensus("mls:H1");
    // The median rent is of the rents people actually set (5600, 5200, 5300) — never our untouched estimate.
    expect(four.medians?.monthlyRent).toBe(5300);
    expect(four.verdicts).toEqual({ pursue: 1, watch: 0, pass: 1 });
  });

  it("ranks members by quality-weighted unique deals, and agrees with itself", async () => {
    for (let n = 10; n < 14; n += 1) await saveAnalysis(member("m4"), deal(n, { ...base, vacancyPercent: 4, managementPercent: 6, interestRate: 5 }));
    const board = await getLeaderboard("all");
    expect(board[0]).toMatchObject({ userId: "m4", rank: 1, deals: 4, name: "Member D." });
    expect(board.every((row) => !row.userId.startsWith("sid:"))).toBe(true);
    const ranks = await getRanks("m4");
    expect(ranks).toEqual({ week: 1, month: 1, all: 1 });
    expect((await getRanks("m26")).all).toBeNull();
  });

  it("counts only people who have proven an inbox — accounts are otherwise free to mint", async () => {
    for (let n = 40; n < 48; n += 1) await saveAnalysis(member("unproven"), deal(n, { ...base, vacancyPercent: 4, managementPercent: 6, interestRate: 5 }));
    await saveAnalysis(member("legacy1"), deal(48, { ...base, vacancyPercent: 4 }));
    const board = await getLeaderboard("all");
    expect(board.some((row) => row.userId === "unproven")).toBe(false);
    expect(board.some((row) => row.userId === "legacy1")).toBe(true);
    expect((await getRanks("unproven")).all).toBeNull();
    // Their own history still works — this is about what OTHER people see.
    expect((await getActorStats("user:unproven")).deals).toBe(8);
  });

  it("lets a member step off the board", async () => {
    const { eq } = await import("drizzle-orm");
    await ctx.db.update(users).set({ showOnLeaderboard: false }).where(eq(users.id, "m4"));
    expect((await getLeaderboard("all")).some((row) => row.userId === "m4")).toBe(false);
    expect((await getRanks("m4")).all).toBeNull();
    await ctx.db.update(users).set({ showOnLeaderboard: true }).where(eq(users.id, "m4"));
  });
});

describe("the flywheel's evidence rules", () => {
  it("does not learn a default nobody touched — that would teach us our own defaults back", async () => {
    // Six members work Calgary deals, each changing ONLY vacancy.
    for (let i = 5; i <= 10; i += 1) {
      await saveAnalysis(member(`m${i}`), { ...deal(`C${i}`, { ...base, vacancyPercent: 3 }), city: "Calgary", province: "AB" });
    }
    await rebuildLearnedAssumptions();
    const learned = await getLearnedDefaults("Calgary", "AB");
    expect(learned.vacancyPercent).toMatchObject({ value: 3, scopeLabel: "Calgary" });
    expect(learned.managementPercent).toBeUndefined();
    expect(learned.interestRate).toBeUndefined();
  });

  it("needs five different members — four is an anecdote", async () => {
    for (let i = 11; i <= 14; i += 1) {
      await saveAnalysis(member(`m${i}`), { ...deal(`R${i}`, { ...base, managementPercent: 10 }), city: "Regina", province: "SK" });
    }
    await rebuildLearnedAssumptions();
    expect((await getLearnedDefaults("Regina", "SK")).managementPercent?.scopeLabel).not.toBe("Regina");
  });

  it("ignores guests entirely: a session costs nothing to mint", async () => {
    for (let i = 0; i < 8; i += 1) {
      await saveAnalysis(guest(`${i}`.repeat(16)), { ...deal(`G${i}`, { ...base, vacancyPercent: 19 }), city: "Guelph", province: "ON" });
    }
    await rebuildLearnedAssumptions();
    expect((await getLearnedDefaults("Guelph", "ON")).vacancyPercent?.scopeLabel).not.toBe("Guelph");
  });

  it("learns how far members move OUR rent estimate — and never from a reported rent", async () => {
    for (let i = 15; i <= 20; i += 1) {
      await saveAnalysis(member(`m${i}`), {
        ...deal(`W${i}`, { ...base, monthlyRent: 4500 }),
        city: "Windsor",
        rentSource: "Rent comps",
        rentEstimate: 5000,
      });
    }
    // A member correcting a REPORTED rent says nothing about our estimates.
    await saveAnalysis(member("m21"), { ...deal("W21", { ...base, monthlyRent: 2000 }), city: "Windsor", rentSource: "Actual rent", rentEstimate: null });
    await rebuildLearnedAssumptions();
    const learned = await getLearnedDefaults("Windsor", "ON");
    expect(learned.rentVsEstimate).toMatchObject({ value: 0.9, sampleSize: 6, scopeLabel: "Windsor" });
    expect(houseDefaults({ price: 700_000, monthlyRent: 5000, rentIsEstimate: true }, learned).monthlyRent).toBe(4500);
  });

  it("stays stable once it is right: keeping a learned value confirms it", async () => {
    // The Windsor default is now good, so newcomers keep the adjusted rent and edit something else.
    // Without the confirmation rule the rent's editors fall under a quarter of engaged members and the
    // learned value would vanish — precisely because it was working.
    const adjusted = { ...base, monthlyRent: 4500 };
    for (let i = 22; i <= 30; i += 1) {
      await saveAnalysis(member(`m${i}`), {
        ...deal(`K${i}`, { ...adjusted, amortizationYears: 30 }),
        defaults: adjusted,
        city: "Windsor",
        rentSource: "Rent comps",
        rentEstimate: 5000,
        learnedApplied: ["rentVsEstimate"],
      });
    }
    // Make the editors a clear minority of everyone engaged in Windsor.
    await rebuildLearnedAssumptions();
    const learned = await getLearnedDefaults("Windsor", "ON");
    expect(learned.rentVsEstimate).toMatchObject({ value: 0.9, scopeLabel: "Windsor" });
    expect(learned.rentVsEstimate!.sampleSize).toBe(15);
    expect(learned.amortizationYears).toMatchObject({ value: 30, scopeLabel: "Windsor" });
  });
});
