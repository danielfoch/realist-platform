import {
  computeIntentScore,
  intentBand,
  suggestedNextAction,
  computeDealScore,
  dealVerdict,
} from '../src/scoring';

const NOW = new Date('2026-06-10T12:00:00Z');

function event(name: string, daysAgo = 0, dealId?: number) {
  return {
    event: name,
    created_at: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    deal_id: dealId ?? null,
  };
}

describe('computeIntentScore', () => {
  it('returns 0 for no events and empty profile', () => {
    expect(computeIntentScore([], {}, NOW)).toBe(0);
  });

  it('scores a fresh deal submission at 40', () => {
    expect(computeIntentScore([event('deal_submitted')], {}, NOW)).toBe(40);
  });

  it('stacks events and profile bonuses into the hot band', () => {
    const score = computeIntentScore(
      [event('deal_submitted'), event('deal_desk_cta_clicked'), event('report_exported')],
      { hasPhone: true, financingHelp: true },
      NOW,
    );
    // 40 + 20 + 15 + 10 + 15 = 100
    expect(score).toBe(100);
    expect(intentBand(score)).toBe('hot');
  });

  it('decays old events ~10% per week', () => {
    const fresh = computeIntentScore([event('deal_submitted', 0)], {}, NOW);
    const stale = computeIntentScore([event('deal_submitted', 28)], {}, NOW);
    expect(stale).toBeLessThan(fresh);
    // 4 weeks: 40 * 0.9^4 ≈ 26
    expect(stale).toBe(26);
  });

  it('does not decay profile bonuses', () => {
    expect(computeIntentScore([], { hasPhone: true, buyingHelp: true }, NOW)).toBe(25);
  });

  it('caps assumption edits at 20 points per deal', () => {
    const edits = Array.from({ length: 10 }, () => event('assumption_edited', 0, 7));
    expect(computeIntentScore(edits, {}, NOW)).toBe(20);
  });

  it('counts assumption-edit caps per deal separately', () => {
    const edits = [
      ...Array.from({ length: 6 }, () => event('assumption_edited', 0, 1)),
      ...Array.from({ length: 6 }, () => event('assumption_edited', 0, 2)),
    ];
    expect(computeIntentScore(edits, {}, NOW)).toBe(40);
  });

  it('awards repeat-search bonus only at 3+ market searches', () => {
    expect(computeIntentScore([event('market_researched'), event('market_researched')], {}, NOW)).toBe(0);
    expect(
      computeIntentScore(
        [event('market_researched'), event('market_researched'), event('market_researched')],
        {},
        NOW,
      ),
    ).toBe(10);
  });

  it('treats deal rejection as engagement, not disinterest', () => {
    expect(computeIntentScore([event('deal_rejected')], {}, NOW)).toBe(5);
  });

  it('ignores unknown event types', () => {
    expect(computeIntentScore([event('page_view'), event('mystery_event')], {}, NOW)).toBe(0);
  });
});

describe('intentBand / suggestedNextAction', () => {
  it('maps scores to bands at the documented boundaries', () => {
    expect(intentBand(80)).toBe('hot');
    expect(intentBand(79)).toBe('warm');
    expect(intentBand(50)).toBe('warm');
    expect(intentBand(49)).toBe('nurture');
    expect(intentBand(20)).toBe('nurture');
    expect(intentBand(19)).toBe('audience');
  });

  it('returns an action for every band', () => {
    expect(suggestedNextAction('hot')).toMatch(/5 minutes/);
    expect(suggestedNextAction('warm')).toMatch(/24 hours/);
    expect(suggestedNextAction('nurture')).toMatch(/education/);
    expect(suggestedNextAction('audience')).toMatch(/Newsletter/);
  });
});

describe('computeDealScore', () => {
  it('returns neutral 50 with no inputs', () => {
    expect(computeDealScore({})).toBe(50);
  });

  it('scores a strong cash-flowing deal as submit', () => {
    const score = computeDealScore({
      cashFlowMonthly: 350,
      dscr: 1.35,
      capRate: 6.1,
      cityMedianCapRate: 5.2,
      askingPrice: 480000,
      maxOfferPrice: 510000,
      rentSource: 'user_edited',
    });
    expect(score).toBeGreaterThanOrEqual(75);
    expect(dealVerdict(score)).toBe('submit');
  });

  it('penalizes negative cash flow and weak DSCR', () => {
    const score = computeDealScore({
      cashFlowMonthly: -400,
      dscr: 0.85,
      askingPrice: 800000,
      maxOfferPrice: 600000,
      rentSource: 'default',
    });
    expect(score).toBeLessThan(25);
    expect(dealVerdict(score)).toBe('pass');
  });

  it('clamps to the 0-100 range', () => {
    const high = computeDealScore({
      cashFlowMonthly: 1000,
      dscr: 2,
      capRate: 9,
      cityMedianCapRate: 4,
      askingPrice: 100,
      maxOfferPrice: 1000,
      rentSource: 'comp_derived',
      marketListingCount: 500,
    });
    expect(high).toBeLessThanOrEqual(100);

    const low = computeDealScore({
      cashFlowMonthly: -2000,
      dscr: 0.4,
      askingPrice: 1000000,
      maxOfferPrice: 400000,
      rentSource: 'default',
    });
    expect(low).toBeGreaterThanOrEqual(0);
  });
});
