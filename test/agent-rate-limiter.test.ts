import { createKeyRateLimiter } from '../server/services/rateLimiter';

const MINUTE = 60_000;
const DAY = 24 * 60 * 60 * 1000;

describe('createKeyRateLimiter', () => {
  it('allows requests under the per-minute limit and counts down remaining', () => {
    const limiter = createKeyRateLimiter({ perMinute: 3, perDay: 100 });
    const t0 = 1_000_000;

    expect(limiter.check('key-a', t0)).toMatchObject({ allowed: true, remainingMinute: 2 });
    expect(limiter.check('key-a', t0 + 1)).toMatchObject({ allowed: true, remainingMinute: 1 });
    expect(limiter.check('key-a', t0 + 2)).toMatchObject({ allowed: true, remainingMinute: 0 });
  });

  it('rejects with the minute window once the burst limit is hit', () => {
    const limiter = createKeyRateLimiter({ perMinute: 2, perDay: 100 });
    const t0 = 1_000_000;
    limiter.check('key-a', t0);
    limiter.check('key-a', t0 + 1);

    const rejected = limiter.check('key-a', t0 + 2);
    expect(rejected.allowed).toBe(false);
    expect(rejected.limitExceeded).toBe('minute');
    expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
    expect(rejected.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('resets the minute window after 60s but keeps counting the day window', () => {
    const limiter = createKeyRateLimiter({ perMinute: 1, perDay: 3 });
    const t0 = 1_000_000;

    expect(limiter.check('key-a', t0).allowed).toBe(true);
    expect(limiter.check('key-a', t0 + 1).allowed).toBe(false);

    const afterReset = limiter.check('key-a', t0 + MINUTE);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remainingDay).toBe(1); // 2 of 3 daily calls used
  });

  it('rejects with the day window once the daily quota is exhausted', () => {
    const limiter = createKeyRateLimiter({ perMinute: 100, perDay: 2 });
    const t0 = 1_000_000;
    limiter.check('key-a', t0);
    limiter.check('key-a', t0 + 1);

    const rejected = limiter.check('key-a', t0 + MINUTE * 2);
    expect(rejected.allowed).toBe(false);
    expect(rejected.limitExceeded).toBe('day');
    expect(rejected.remainingDay).toBe(0);
    expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
    expect(rejected.retryAfterSeconds).toBeLessThanOrEqual(DAY / 1000);
  });

  it('resets the day window after 24h', () => {
    const limiter = createKeyRateLimiter({ perMinute: 100, perDay: 1 });
    const t0 = 1_000_000;
    limiter.check('key-a', t0);
    expect(limiter.check('key-a', t0 + 1).allowed).toBe(false);
    expect(limiter.check('key-a', t0 + DAY).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createKeyRateLimiter({ perMinute: 1, perDay: 10 });
    const t0 = 1_000_000;
    expect(limiter.check('key-a', t0).allowed).toBe(true);
    expect(limiter.check('key-a', t0 + 1).allowed).toBe(false);
    expect(limiter.check('key-b', t0 + 2).allowed).toBe(true);
  });

  it('a rejected request does not consume quota', () => {
    const limiter = createKeyRateLimiter({ perMinute: 1, perDay: 2 });
    const t0 = 1_000_000;
    limiter.check('key-a', t0);
    // Hammer the minute limit; these rejections must not eat the day quota.
    for (let i = 1; i <= 5; i++) {
      expect(limiter.check('key-a', t0 + i).allowed).toBe(false);
    }
    expect(limiter.check('key-a', t0 + MINUTE).allowed).toBe(true);
    expect(limiter.check('key-a', t0 + MINUTE * 2).allowed).toBe(false); // day quota (2) now spent
  });

  it('evicts idle keys but keeps active ones', () => {
    const limiter = createKeyRateLimiter({ perMinute: 10, perDay: 100 });
    const t0 = 1_000_000;
    limiter.check('idle-key', t0);
    limiter.check('active-key', t0);
    limiter.check('active-key', t0 + 2 * DAY);
    limiter.evictIdle(t0 + 2 * DAY + 1);
    expect(limiter.size()).toBe(1);
  });
});
