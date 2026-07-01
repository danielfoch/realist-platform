/**
 * Per-key fixed-window rate limiter for the agent API.
 *
 * Pure in-memory logic with injected clock — no Express, no database — so it
 * can be unit-tested and later swapped for a Redis/Postgres store without
 * touching call sites. Two windows are enforced per key: a per-minute burst
 * limit and a per-day quota. Counters reset on process restart, which is an
 * accepted v1 trade-off on a single-instance deployment.
 */

export interface RateLimitConfig {
  perMinute: number;
  perDay: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Which window rejected the request (undefined when allowed). */
  limitExceeded?: "minute" | "day";
  retryAfterSeconds?: number;
  remainingMinute: number;
  remainingDay: number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

interface KeyState {
  minute: WindowState;
  day: WindowState;
  lastSeen: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Evict keys idle longer than this so the map cannot grow unbounded. */
const IDLE_EVICTION_MS = 2 * DAY_MS;

export function createKeyRateLimiter(config: RateLimitConfig) {
  const states = new Map<string, KeyState>();

  function roll(state: WindowState, windowMs: number, now: number) {
    if (now - state.windowStart >= windowMs) {
      state.count = 0;
      state.windowStart = now;
    }
  }

  function check(keyId: string, now: number = Date.now()): RateLimitDecision {
    let state = states.get(keyId);
    if (!state) {
      state = {
        minute: { count: 0, windowStart: now },
        day: { count: 0, windowStart: now },
        lastSeen: now,
      };
      states.set(keyId, state);
    }
    state.lastSeen = now;
    roll(state.minute, MINUTE_MS, now);
    roll(state.day, DAY_MS, now);

    if (state.day.count >= config.perDay) {
      return {
        allowed: false,
        limitExceeded: "day",
        retryAfterSeconds: Math.max(1, Math.ceil((state.day.windowStart + DAY_MS - now) / 1000)),
        remainingMinute: Math.max(0, config.perMinute - state.minute.count),
        remainingDay: 0,
      };
    }
    if (state.minute.count >= config.perMinute) {
      return {
        allowed: false,
        limitExceeded: "minute",
        retryAfterSeconds: Math.max(1, Math.ceil((state.minute.windowStart + MINUTE_MS - now) / 1000)),
        remainingMinute: 0,
        remainingDay: Math.max(0, config.perDay - state.day.count),
      };
    }

    state.minute.count++;
    state.day.count++;
    return {
      allowed: true,
      remainingMinute: Math.max(0, config.perMinute - state.minute.count),
      remainingDay: Math.max(0, config.perDay - state.day.count),
    };
  }

  function evictIdle(now: number = Date.now()) {
    for (const [keyId, state] of states.entries()) {
      if (now - state.lastSeen > IDLE_EVICTION_MS) states.delete(keyId);
    }
  }

  return { check, evictIdle, size: () => states.size };
}

export type KeyRateLimiter = ReturnType<typeof createKeyRateLimiter>;
