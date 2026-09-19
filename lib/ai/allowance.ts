import { takeToken } from "@/lib/auth/throttle";
import type { User } from "@/lib/db/schema";

/**
 * What one person, and the whole site, may spend on model calls. Every paid
 * route asks here first. Three ceilings, each counted atomically:
 *
 *  - a member who has proven their inbox (or came over from v1): a burst limit and a daily one;
 *  - an account that hasn't: a taste — enough to see what it does, not enough to be worth
 *    minting accounts for;
 *  - everyone together: AI_DAILY_BUDGET calls a day (default 2,000). The switch that means a
 *    bad night costs a known amount. Set it to 0 to turn the paid features off.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const BURST = 15;
const PROVEN_PER_DAY = 60;
const UNPROVEN_PER_DAY = 3;

export type Allowance = { ok: true } | { ok: false; status: 403 | 429 | 503; error: string };

export function dailyBudget(): number {
  const raw = Number(process.env.AI_DAILY_BUDGET);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 2000;
}

export async function aiAllowance(user: Pick<User, "id" | "emailVerifiedAt" | "legacy">): Promise<Allowance> {
  const proven = Boolean(user.emailVerifiedAt || user.legacy);
  if (!(await takeToken(`ai-day:${user.id}`, proven ? PROVEN_PER_DAY : UNPROVEN_PER_DAY, { windowMs: DAY_MS }))) {
    return proven
      ? { ok: false, status: 429, error: "That's today's limit — it resets tomorrow. The numbers and the memo above still update as you type." }
      : { ok: false, status: 403, error: "Confirm your email to keep going — the link is in your inbox, and there's a fresh one in your account." };
  }
  if (!(await takeToken(`ai-burst:${user.id}`, BURST))) return { ok: false, status: 429, error: "That's a lot at once — give it a few minutes." };
  if (!(await takeToken("ai-global", dailyBudget(), { windowMs: DAY_MS }))) return { ok: false, status: 503, error: "The AI is resting for today. Everything else works as usual." };
  return { ok: true };
}
