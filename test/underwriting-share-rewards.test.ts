import { decideShareReward, normalizeVisitorKey } from '../src/underwriting-share-rewards';

describe('underwriting share rewards', () => {
  it('does not grant credits for raw share clicks', () => {
    const decision = decideShareReward({
      actionType: 'share_click',
      visitorKey: 'visitor:abc',
    });

    expect(decision.qualified).toBe(false);
    expect(decision.creditDelta).toBe(0);
    expect(decision.status).toBe('unqualified');
  });

  it('grants export credits for qualified challenge actions', () => {
    const decision = decideShareReward({
      actionType: 'fork_challenge',
      visitorKey: 'visitor:def',
    });

    expect(decision.qualified).toBe(true);
    expect(decision.creditDelta).toBe(2);
    expect(decision.status).toBe('qualified');
  });

  it('caps qualified rewards after the daily cap', () => {
    const decision = decideShareReward({
      actionType: 'saved_version',
      actorUserId: 42,
      alreadyTrackedToday: 5,
    });

    expect(decision.qualified).toBe(true);
    expect(decision.creditDelta).toBe(0);
    expect(decision.status).toBe('capped');
  });

  it('requires a uniqueness signal before granting credits', () => {
    const decision = decideShareReward({ actionType: 'unique_open' });

    expect(decision.qualified).toBe(false);
    expect(decision.creditDelta).toBe(0);
    expect(decision.reason).toContain('unique visitor');
  });

  it('normalizes authenticated users before anonymous visitor IDs', () => {
    expect(normalizeVisitorKey({ actorUserId: 7, visitorId: 'browser-1' })).toBe('user:7');
  });
});
