import { decideShareReward, normalizeVisitorKey, summarizeShareRewardStatus } from '../src/underwriting-share-rewards';

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



  it('grants signup credits only as a qualified tracked action', () => {
    const decision = decideShareReward({
      actionType: 'signup',
      actorUserId: 101,
    });

    expect(decision.qualified).toBe(true);
    expect(decision.creditDelta).toBe(3);
    expect(decision.status).toBe('qualified');
  });

  it('summarizes reward progress without treating raw clicks as next-step progress', () => {
    const summary = summarizeShareRewardStatus({
      qualifiedActionCount: 1,
      exportCreditBalance: 2,
      creditedActionsToday: 1,
      actionCounts: [
        { actionType: 'share_click', status: 'unqualified', count: 3, creditDelta: 0 },
        { actionType: 'fork_challenge', status: 'qualified', count: 1, creditDelta: 2 },
      ],
    });

    expect(summary.cta).toBe('Challenge my underwriting.');
    expect(summary.rewardStatus).toBe('earning');
    expect(summary.remainingCreditsToday).toBe(4);
    expect(summary.nextQualifiedActions).toEqual(['unique_open', 'signup', 'saved_version']);
    expect(summary.premiumCreditUse).toBe('Google Sheets export credits');
  });

  it('marks reward progress capped when the daily credit cap is exhausted', () => {
    const summary = summarizeShareRewardStatus({
      qualifiedActionCount: 5,
      exportCreditBalance: 12,
      creditedActionsToday: 5,
      actionCounts: [],
    });

    expect(summary.rewardStatus).toBe('capped');
    expect(summary.remainingCreditsToday).toBe(0);
  });

  it('normalizes authenticated users before anonymous visitor IDs', () => {
    expect(normalizeVisitorKey({ actorUserId: 7, visitorId: 'browser-1' })).toBe('user:7');
  });
});
