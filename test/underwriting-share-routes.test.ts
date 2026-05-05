import {
  createUnderwritingShareRecipientLinks,
  createUnderwritingShare,
  getActionPolicy,
  getExplicitRecipientHash,
  getRecipientInviteFunnel,
  getRewardPolicySnapshot,
  getShareActionSummary,
  getShareConversionInsights,
  getShareGrowthNudge,
  getQualifiedShareRewardBrief,
  hasMeaningfulChallengePayload,
  recordQualifiedShareAction,
} from '../src/underwriting-share-routes';

function createShareDb(options: { existing?: any; shareCount?: number; recipientCount?: number } = {}) {
  const calls: Array<{ text: string; params?: readonly unknown[] }> = [];
  let actionId = 100;

  const query = jest.fn(async (text: string, params?: readonly unknown[]) => {
    calls.push({ text, params });

    if (text.includes('FROM underwriting_share_actions') && text.includes('LIMIT 1')) {
      return { rows: options.existing ? [options.existing] : [] };
    }

    if (text.includes('WHERE share_id = $1') && text.includes('created_at >= CURRENT_DATE')) {
      return { rows: [{ count: String(options.shareCount || 0) }] };
    }

    if (text.includes('WHERE recipient_hash = $1') && text.includes('created_at >= CURRENT_DATE')) {
      return { rows: [{ count: String(options.recipientCount || 0) }] };
    }

    if (text.includes('INSERT INTO underwriting_share_actions')) {
      return { rows: [{ id: actionId++ }] };
    }

    return { rows: [] };
  });

  return { query, calls };
}

describe('viral underwriting share qualification', () => {
  it('requires a meaningful challenge payload before share actions can qualify', () => {
    expect(hasMeaningfulChallengePayload('challenge', {})).toBe(false);
    expect(hasMeaningfulChallengePayload('fork', { comment: 'too short' })).toBe(false);
    expect(hasMeaningfulChallengePayload('challenge', { challengedFields: ['rent', 'vacancy'] })).toBe(true);
    expect(hasMeaningfulChallengePayload('saved_version', { inputs: { rent: 3200 } })).toBe(true);
    expect(hasMeaningfulChallengePayload('signup', undefined)).toBe(true);
  });

  it('awards Google Sheets export credits for a qualified challenge', async () => {
    const db = createShareDb();

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'challenge',
      recipientHash: 'a'.repeat(64),
    });

    expect(result.status).toBe('qualified');
    expect(result.creditAmount).toBe(getActionPolicy('challenge').creditAmount);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO premium_credit_ledger'),
      [42, 7, 100, getActionPolicy('challenge').creditAmount, 'Qualified underwriting share action: challenge'],
    );
  });

  it('does not grant duplicate credits for the same recipient/action/share', async () => {
    const db = createShareDb({ existing: { id: 1, qualified: true, credit_amount: 2 } });

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'challenge',
      recipientHash: 'b'.repeat(64),
    });

    expect(result.status).toBe('duplicate');
    expect(result.creditAmount).toBe(2);
    expect(db.calls.some((call) => call.text.includes('INSERT INTO premium_credit_ledger'))).toBe(false);
  });

  it('tracks capped actions without awarding premium credits', async () => {
    const db = createShareDb({ shareCount: getActionPolicy('fork').dailyShareCap });

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'fork',
      recipientHash: 'c'.repeat(64),
    });

    expect(result.status).toBe('capped');
    expect(result.qualified).toBe(false);
    expect(result.creditAmount).toBe(0);
    expect(db.calls.some((call) => call.text.includes('INSERT INTO premium_credit_ledger'))).toBe(false);
  });

  it('summarizes share status by qualified action without exposing recipient hashes', async () => {
    const query = jest.fn(async (text: string) => {
      if (text.includes('GROUP BY action')) {
        return {
          rows: [
            {
              action: 'unique_open',
              total_count: '5',
              qualified_count: '5',
              capped_count: '0',
              daily_qualified_count: '3',
              credit_awarded: '5',
              last_action_at: '2026-04-29T04:50:00.000Z',
            },
            {
              action: 'challenge',
              total_count: '3',
              qualified_count: '2',
              capped_count: '1',
              daily_qualified_count: '2',
              credit_awarded: '4',
              last_action_at: '2026-04-29T05:00:00.000Z',
            },
            {
              action: 'saved_version',
              total_count: '1',
              qualified_count: '1',
              capped_count: '0',
              daily_qualified_count: '1',
              credit_awarded: '4',
              last_action_at: '2026-04-29T05:05:00.000Z',
            },
          ],
        };
      }

      if (text.includes('COUNT(DISTINCT recipient_hash)')) {
        return { rows: [{ unique_recipient_count: '6', qualified_recipient_count: '5' }] };
      }

      if (text.includes('ORDER BY created_at DESC')) {
        return {
          rows: [
            {
              id: 11,
              action: 'saved_version',
              qualified: true,
              credit_type: 'google_sheets_export',
              credit_amount: 4,
              metadata: { savedAnalysisId: 123 },
              created_at: '2026-04-29T05:05:00.000Z',
            },
          ],
        };
      }

      if (text.includes('LEFT JOIN underwriting_share_actions')) {
        return {
          rows: [
            {
              source: 'manual',
              invited_count: '3',
              opened_count: '1',
              challenged_count: '1',
              versioned_count: '1',
              signup_count: '0',
              credit_awarded: '7',
            },
          ],
        };
      }

      if (text.includes('FROM underwriting_share_recipients')) {
        return { rows: [{ invited_recipient_count: '3', unopened_recipient_count: '2' }] };
      }

      return { rows: [] };
    });

    const summary = await getShareActionSummary({ query }, 7, 5);

    expect(summary.byAction.challenge).toEqual({
      totalCount: 3,
      qualifiedCount: 2,
      cappedCount: 1,
      creditAwarded: 4,
      dailyQualifiedCount: 2,
      dailyRemainingShareCap: getActionPolicy('challenge').dailyShareCap - 2,
      lastActionAt: '2026-04-29T05:00:00.000Z',
    });
    expect(summary.byAction.unique_open.dailyRemainingShareCap).toBe(2);
    expect(summary.totals).toEqual({
      totalCount: 9,
      qualifiedCount: 8,
      cappedCount: 1,
      creditAwarded: 13,
    });
    expect(summary.uniqueRecipientCount).toBe(6);
    expect(summary.qualifiedRecipientCount).toBe(5);
    expect(summary.invitedRecipientCount).toBe(3);
    expect(summary.unopenedRecipientCount).toBe(2);
    expect(summary.inviteFunnel).toEqual([
      {
        source: 'manual',
        invitedCount: 3,
        openedCount: 1,
        challengedCount: 1,
        versionedCount: 1,
        signupCount: 0,
        creditAwarded: 7,
        openRate: 0.3333,
        challengeRate: 1,
        versionRate: 1,
        signupRate: 0,
      },
    ]);
    expect(summary.conversionRates).toEqual({
      openToChallenge: 0.4,
      challengeToForkOrSavedVersion: 0.5,
      forkOrSavedVersionToSignup: 0,
    });
    expect(summary.growthNudge.stage).toBe('convert_versions_to_accounts');
    expect(summary.conversionInsights).toMatchObject({
      bottleneck: 'version_to_signup',
      nextQualifiedAction: 'signup',
      openedInvites: 1,
      unopenedInviteRate: 0.6667,
      creditGuardrail: expect.stringContaining('never raw share clicks alone'),
    });
    expect(summary.conversionInsights.remainingCreditsToday).toBeGreaterThan(0);
    expect(summary.rewardBrief).toMatchObject({
      cta: 'Challenge my underwriting.',
      earnedCredits: 13,
      qualifiedActions: ['unique_open', 'challenge', 'saved_version'],
      antiAbuseGuardrail: expect.stringContaining('never granted for raw clicks alone'),
    });
    expect(summary.rewardBrief.bestNextReward).toMatchObject({ action: 'signup', creditAmount: 5 });
    expect(summary.recentActions[0]).not.toHaveProperty('recipientHash');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT recipient_hash)'), [7]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [7, 5]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM underwriting_share_recipients'), [7]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN underwriting_share_actions'), [7]);
  });

  it('segments recipient-specific invite performance without exposing visitor identity', async () => {
    const query = jest.fn(async () => ({
      rows: [
        {
          source: 'agent_dm',
          invited_count: '5',
          opened_count: '4',
          challenged_count: '2',
          versioned_count: '1',
          signup_count: '1',
          credit_awarded: '16',
        },
      ],
    }));

    const funnel = await getRecipientInviteFunnel({ query }, 7);

    expect(funnel).toEqual([
      {
        source: 'agent_dm',
        invitedCount: 5,
        openedCount: 4,
        challengedCount: 2,
        versionedCount: 1,
        signupCount: 1,
        creditAwarded: 16,
        openRate: 0.8,
        challengeRate: 0.5,
        versionRate: 0.5,
        signupRate: 1,
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT r.id)'), [7]);
    expect(query).toHaveBeenCalledWith(expect.not.stringContaining('recipient_hash AS'), expect.anything());
  });

  it('creates recipient-specific share links without awarding credits', async () => {
    const query = jest.fn(async (text: string, params?: readonly unknown[]) => {
      expect(text).not.toContain('premium_credit_ledger');
      return { rows: [{ id: 201, created_at: '2026-05-02T05:10:00.000Z' }] };
    });

    const links = await createUnderwritingShareRecipientLinks({ query }, {
      shareId: 7,
      token: 'share-token',
      createdByUserId: 42,
      recipients: ['Investor A'],
    });

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      id: 201,
      shareUrl: expect.stringContaining('/underwriting/share-token?recipient='),
      cta: 'Challenge my underwriting.',
      qualifiedActionsRequired: ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'],
    });
    expect(links[0].recipientHash).toBe(getExplicitRecipientHash(links[0].recipientKey));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO underwriting_share_recipients'),
      [7, links[0].recipientHash, expect.any(String), 'manual', 42],
    );
  });

  it('returns stage-specific growth nudges for the underwriting loop', () => {
    const emptySummary = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: 5,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getShareGrowthNudge>[0];

    expect(getShareGrowthNudge(emptySummary).stage).toBe('get_first_qualified_open');

    const challengedSummary = {
      ...emptySummary,
      unique_open: { ...emptySummary.unique_open, qualifiedCount: 4 },
      challenge: { ...emptySummary.challenge, qualifiedCount: 2 },
    };
    expect(getShareGrowthNudge(challengedSummary).stage).toBe('convert_challenges_to_versions');
  });

  it('identifies the next qualified action bottleneck without rewarding raw clicks', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: 5,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getShareConversionInsights>[0]['byAction'];

    const unopened = getShareConversionInsights({
      byAction,
      invitedRecipientCount: 4,
      unopenedRecipientCount: 4,
    });
    expect(unopened).toMatchObject({
      bottleneck: 'recipient_distribution',
      nextQualifiedAction: 'unique_open',
      healthScore: 0,
    });

    const challengedNoVersion = getShareConversionInsights({
      byAction: {
        ...byAction,
        unique_open: { ...byAction.unique_open, qualifiedCount: 5 },
        challenge: { ...byAction.challenge, qualifiedCount: 3 },
      },
      invitedRecipientCount: 5,
      unopenedRecipientCount: 1,
    });
    expect(challengedNoVersion.bottleneck).toBe('challenge_to_version');
    expect(challengedNoVersion.nextQualifiedAction).toBe('saved_version');
    expect(challengedNoVersion.creditGuardrail).toContain('never raw share clicks alone');
  });

  it('builds a qualified-only reward brief for share status CTAs', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: action === 'challenge' ? 2 : 0,
          cappedCount: 0,
          creditAwarded: action === 'challenge' ? 4 : 0,
          dailyQualifiedCount: action === 'challenge' ? 2 : 0,
          dailyRemainingShareCap: action === 'signup' ? 0 : 3,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getQualifiedShareRewardBrief>[0];

    const brief = getQualifiedShareRewardBrief(byAction);

    expect(brief).toMatchObject({
      cta: 'Challenge my underwriting.',
      earnedCredits: 4,
      remainingCreditsToday: 12,
      qualifiedActions: ['challenge'],
      sharePrompt: expect.stringContaining('fork the assumptions'),
      antiAbuseGuardrail: expect.stringContaining('raw clicks'),
    });
    expect(brief.bestNextReward).toEqual({ action: 'saved_version', creditAmount: 4, remainingToday: 3 });
  });

  it('exposes the current Google Sheets export reward policy snapshot', () => {
    expect(getRewardPolicySnapshot().fork).toEqual(getActionPolicy('fork'));
    expect(getRewardPolicySnapshot().challenge.creditAmount).toBe(2);
  });

  it('creates lineage-aware onward shares for challenged versions', async () => {
    const query = jest.fn(async () => ({
      rows: [{ id: 55, token: 'next-share-token', share_depth: 2 }],
    }));

    const share = await createUnderwritingShare({ query }, {
      analysisId: 123,
      inviterUserId: 77,
      source: 'challenger_fork',
      parentShareId: 44,
      parentShareActionId: 99,
      parentShareDepth: 1,
    });

    expect(share).toMatchObject({
      id: 55,
      token: 'next-share-token',
      shareDepth: 2,
      shareUrl: '/underwriting/next-share-token',
      cta: 'Challenge my underwriting.',
    });
    expect(share.rewardPolicy.saved_version.creditAmount).toBe(4);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('parent_share_id, parent_share_action_id, share_depth'),
      [123, 77, expect.any(String), 'challenger_fork', 44, 99, 2],
    );
  });
});
