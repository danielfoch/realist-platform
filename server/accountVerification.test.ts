/**
 * Tests for the verification policy (server/accountVerification.ts).
 *
 * These cover the parts where a mistake locks real people out of a live site:
 * who the requirement applies to, that a skipped phone doesn't count as done,
 * that the guard fails OPEN, and that tokens are stored hashed and single-use.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  userRows: [] as Record<string, unknown>[],
  tokenRows: [] as Record<string, unknown>[],
  countRows: [{ n: 0 }] as Record<string, unknown>[],
  selectThrows: false,
  inserted: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
};

vi.mock("./db", () => {
  const chainFor = (rows: () => Record<string, unknown>[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = async () => rows();
    (chain as any).then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      try {
        resolve(rows());
      } catch (e) {
        reject(e);
      }
    };
    return chain;
  };
  return {
    db: {
      select: (shape?: Record<string, unknown>) =>
        chainFor(() => {
          if (state.selectThrows) throw new Error("db boom");
          if (shape && "n" in shape) return state.countRows;
          if (shape && "createdAt" in shape) return state.userRows;
          return state.tokenRows;
        }),
      insert: () => ({
        values: async (v: Record<string, unknown>) => {
          state.inserted.push(v);
        },
      }),
      update: () => ({
        set: (v: Record<string, unknown>) => ({
          where: async () => {
            state.updates.push(v);
          },
        }),
      }),
    },
  };
});

vi.mock("./auth", () => ({ appBaseUrl: () => "https://realist.ca" }));

const {
  VERIFICATION_ENFORCED_FROM,
  getVerificationState,
  requireVerified,
  issueEmailVerificationLink,
  consumeEmailVerificationToken,
} = await import("./accountVerification");

const BEFORE = new Date(VERIFICATION_ENFORCED_FROM.getTime() - 86_400_000);
const AFTER = new Date(VERIFICATION_ENFORCED_FROM.getTime() + 86_400_000);

function userRow(over: Record<string, unknown> = {}) {
  return { createdAt: AFTER, emailVerified: false, phoneVerified: false, ...over };
}

beforeEach(() => {
  state.userRows = [];
  state.tokenRows = [];
  state.countRows = [{ n: 0 }];
  state.selectThrows = false;
  state.inserted = [];
  state.updates = [];
});

describe("VERIFICATION_ENFORCED_FROM", () => {
  it("does not predate the code that sends verification emails", () => {
    // The cutoff shipped at 2026-07-25 while the deploy was 2026-07-28, which
    // would have gated three days of accounts that never received an email
    // because signup did not yet send one. A cutoff in the past strands people;
    // one in the future merely exempts them.
    expect(VERIFICATION_ENFORCED_FROM.getTime()).toBeGreaterThanOrEqual(
      new Date("2026-07-28T00:00:00-04:00").getTime(),
    );
  });

  it("is a valid date", () => {
    expect(Number.isNaN(VERIFICATION_ENFORCED_FROM.getTime())).toBe(false);
  });
});

describe("getVerificationState", () => {
  it("grandfathers accounts created before the cutoff", async () => {
    state.userRows = [userRow({ createdAt: BEFORE })];
    const s = await getVerificationState("u1");
    expect(s.required).toBe(false);
    expect(s.satisfied).toBe(true);
    expect(s.missing).toEqual([]);
  });

  it("requires both from a new account that has verified neither", async () => {
    state.userRows = [userRow()];
    const s = await getVerificationState("u1");
    expect(s.required).toBe(true);
    expect(s.satisfied).toBe(false);
    expect(s.missing).toEqual(["email", "phone"]);
  });

  it("reports only what is still outstanding", async () => {
    state.userRows = [userRow({ emailVerified: true })];
    const s = await getVerificationState("u1");
    expect(s.missing).toEqual(["phone"]);
    expect(s.satisfied).toBe(false);
  });

  it("is satisfied once both are done", async () => {
    state.userRows = [userRow({ emailVerified: true, phoneVerified: true })];
    const s = await getVerificationState("u1");
    expect(s.satisfied).toBe(true);
  });

  it("treats a null createdAt as grandfathered rather than locking the row out", async () => {
    state.userRows = [userRow({ createdAt: null })];
    const s = await getVerificationState("u1");
    expect(s.required).toBe(false);
    expect(s.satisfied).toBe(true);
  });

  it("does not fail closed on a missing user", async () => {
    state.userRows = [];
    const s = await getVerificationState("ghost");
    expect(s.satisfied).toBe(true);
  });
});

describe("requireVerified", () => {
  function ctx(userId?: string) {
    const req: any = { session: userId ? { userId } : {} };
    const res: any = {
      statusCode: 0,
      body: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(b: any) {
        this.body = b;
        return this;
      },
    };
    return { req, res };
  }

  it("lets anonymous callers straight through", async () => {
    const { req, res } = ctx();
    const next = vi.fn();
    await requireVerified(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it("lets a grandfathered user through", async () => {
    state.userRows = [userRow({ createdAt: BEFORE })];
    const { req, res } = ctx("u1");
    const next = vi.fn();
    await requireVerified(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("403s an unverified new account with the outstanding steps", async () => {
    state.userRows = [userRow({ emailVerified: true })];
    const { req, res } = ctx("u1");
    const next = vi.fn();
    await requireVerified(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("verification_required");
    expect(res.body.missing).toEqual(["phone"]);
    expect(res.body.message).toContain("phone");
  });

  it("does not treat a skipped phone as verified", async () => {
    // phone_verification_skipped_at exists so OAuth stops re-prompting, not as
    // a way out of the requirement.
    state.userRows = [userRow({ emailVerified: true, phoneVerified: false })];
    const { req, res } = ctx("u1");
    await requireVerified(req, res, vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it("fails OPEN when the lookup errors", async () => {
    state.selectThrows = true;
    const { req, res } = ctx("u1");
    const next = vi.fn();
    await requireVerified(req, res, next);
    // Blocking every verified user during a database blip is worse than letting
    // one unverified underwrite through.
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});

describe("email verification tokens", () => {
  it("emails a raw token but stores only its hash", async () => {
    const link = await issueEmailVerificationLink("u1");
    const raw = new URL(link).searchParams.get("token")!;

    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    const stored = state.inserted[0].token as string;
    expect(stored).not.toBe(raw);
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(state.inserted[0].type).toBe("email");
  });

  it("invalidates outstanding links before issuing a new one", async () => {
    await issueEmailVerificationLink("u1");
    // The pre-insert update is the invalidation sweep.
    expect(state.updates[0]).toHaveProperty("verifiedAt");
  });

  it("rejects a malformed token without touching the database", async () => {
    const result = await consumeEmailVerificationToken("not-a-token");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired token", async () => {
    state.tokenRows = [{
      id: "t1", userId: "u1", type: "email",
      token: "x", expiresAt: new Date(Date.now() - 1000), verifiedAt: null,
    }];
    const result = await consumeEmailVerificationToken("a".repeat(64));
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token that was already used", async () => {
    state.tokenRows = [{
      id: "t1", userId: "u1", type: "email",
      token: "x", expiresAt: new Date(Date.now() + 60_000), verifiedAt: new Date(),
    }];
    const result = await consumeEmailVerificationToken("a".repeat(64));
    expect(result).toEqual({ ok: false, reason: "already_used" });
  });

  it("marks the address verified on a good token", async () => {
    state.tokenRows = [{
      id: "t1", userId: "u1", type: "email",
      token: "x", expiresAt: new Date(Date.now() + 60_000), verifiedAt: null,
    }];
    const result = await consumeEmailVerificationToken("a".repeat(64));
    expect(result).toEqual({ ok: true, userId: "u1" });
    expect(state.updates.some(u => u.emailVerified === true)).toBe(true);
  });
});
