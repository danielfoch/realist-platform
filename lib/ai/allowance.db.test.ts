import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { takeToken } from "@/lib/auth/throttle";
import { useTestDb } from "@/lib/test/db";
import { aiAllowance } from "./allowance";

let ctx: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => {
  ctx = await useTestDb();
}, 60_000);
afterAll(async () => ctx.close());
afterEach(() => vi.unstubAllEnvs());

const proven = (id: string) => ({ id, emailVerifiedAt: new Date(), legacy: null });
const unproven = (id: string) => ({ id, emailVerifiedAt: null, legacy: null });

describe("takeToken", () => {
  it("counts and decides in one statement, so a parallel burst can't all slip under the limit", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => takeToken("burst-test", 15)));
    expect(results.filter(Boolean)).toHaveLength(15);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const then = new Date(Date.now() - 20 * 60_000);
    for (let i = 0; i < 3; i += 1) await takeToken("window-test", 3, { now: then });
    expect(await takeToken("window-test", 3, { now: then })).toBe(false);
    expect(await takeToken("window-test", 3)).toBe(true);
  });
});

describe("what one person, and the whole site, may spend on model calls", () => {
  it("gives an account that hasn't proven its inbox a taste, then asks it to confirm", async () => {
    const calls = [];
    for (let i = 0; i < 4; i += 1) calls.push(await aiAllowance(unproven("new-1")));
    expect(calls.map((call) => call.ok)).toEqual([true, true, true, false]);
    expect(calls[3]).toMatchObject({ status: 403, error: expect.stringContaining("Confirm your email") });
  });

  it("lets a proven member work, within a burst limit", async () => {
    const calls = await Promise.all(Array.from({ length: 25 }, () => aiAllowance(proven("member-1"))));
    expect(calls.filter((call) => call.ok)).toHaveLength(15);
    expect(calls.find((call) => !call.ok)).toMatchObject({ status: 429 });
  });

  it("stops for everyone once the day's budget is spent — a bad night costs a known amount", async () => {
    vi.stubEnv("AI_DAILY_BUDGET", "2");
    await ctx.sql.exec("DELETE FROM auth_throttle WHERE key = 'ai-global'");
    const calls = [];
    for (let i = 0; i < 3; i += 1) calls.push(await aiAllowance(proven(`budget-${i}`)));
    expect(calls.map((call) => call.ok)).toEqual([true, true, false]);
    expect(calls[2]).toMatchObject({ status: 503 });
  });

  it("is off entirely at a budget of zero", async () => {
    vi.stubEnv("AI_DAILY_BUDGET", "0");
    expect((await aiAllowance(proven("anyone"))).ok).toBe(false);
  });
});
