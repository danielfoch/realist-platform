import {
  createUnderwritingShareRecipientLinks,
  createUnderwritingShare,
  getActionPolicy,
  getChallengePromptPack,
  getExplicitRecipientHash,
  getPublicShareRewardLadder,
  getQualifiedShareAssist,
  getQualifiedShareDigest,
  getRecipientInviteFollowUps,
  getQualifiedRecipientInvitePlan,
  getRecipientChallengeCoach,
  getRecipientInviteFunnel,
  getRewardPolicySnapshot,
  getShareActionSummary,
  getShareConversionCards,
  getShareConversionInsights,
  getShareGrowthNudge,
  getQualifiedShareRewardBrief,
  getShareRewardEligibilitySummary,
  hasMeaningfulChallengePayload,
  recordQualifiedShareAction,
  resolveShareRecipientHash,
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
  it('builds recipient-facing challenge prompts from saved underwriting assumptions', () => {
    const promptPack = getChallengePromptPack({
      inputs: { monthlyRent: 3200, vacancyRate: 0.04 },
      metrics: { capRate: 4.7, cashFlow: -125 },
      verdictCheck: 'tight but possible',
    });

    expect(promptPack).toMatchObject({
      cta: 'Challenge my underwriting.',
      requiredActionEndpoint: 'POST /api/underwriting-shares/:token/actions',
      qualifiedActionReminder: expect.stringContaining('raw share clicks do not earn credits'),
      requiredPayload: {
        action: 'challenge',
        metadata: {
          challengedFields: ['monthlyRent'],
          comment: expect.any(String),
        },
      },
    });
    expect(promptPack.prompts.map((prompt) => prompt.field)).toEqual([
      'monthlyRent',
      'vacancyRate',
      'capRate',
      'cashFlow',
    ]);
    expect(promptPack.prompts[0]).toMatchObject({
      label: 'Market rent',
      currentValue: 3200,
      challengeQuestion: expect.stringContaining('rent'),
      payloadHint: expect.stringContaining('metadata.challengedFields'),
    });
  });

  it('falls back to a note challenge when assumptions are unavailable', () => {
    const promptPack = getChallengePromptPack({ verdictCheck: 'needs review' });

    expect(promptPack.prompts).toEqual([
      expect.objectContaining({
        field: 'notes',
        currentValue: 'needs review',
        challengeQuestion: expect.stringContaining('single assumption'),
      }),
    ]);
  });

  it('coaches recipients toward qualified challenges instead of raw clicks', () => {
    const coach = getRecipientChallengeCoach({
      inputs: { monthlyRent: 3100 },
      metrics: { cashFlow: -75 },
      verdictCheck: 'close call',
    });

    expect(coach).toMatchObject({
      cta: 'Challenge my underwriting.',
      headline: expect.stringContaining('must change or question an assumption'),
      primaryPrompt: expect.objectContaining({ field: 'monthlyRent' }),
      exampleChallengePayload: {
        action: 'challenge',
        metadata: {
          challengedFields: ['monthlyRent'],
          comment: expect.stringContaining('Market rent'),
        },
      },
      exampleSavedVersionPayload: {
        action: 'saved_version',
        metadata: {
          challengedFields: ['monthlyRent'],
          inputs: { monthlyRent: 'your changed assumption' },
          notes: expect.stringContaining('Saved after challenging'),
        },
      },
      creditDisclaimer: expect.stringContaining('raw share link alone is not enough'),
    });
    expect(coach.qualifiedActions).toEqual(['challenge', 'fork', 'saved_version', 'signup']);
  });

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

  it('tracks generic opens but does not award credits for raw share clicks', async () => {
    const db = createShareDb();

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'unique_open',
      recipientHash: 'd'.repeat(64),
      metadata: {
        trackingSource: 'visitor_fingerprint',
        explicitRecipientAccepted: false,
      },
    });

    expect(result).toMatchObject({
      status: 'unqualified',
      qualified: false,
      creditAmount: 0,
      creditQualificationReason: 'unique_open_credit_requires_issued_recipient_link',
    });
    expect(db.calls.some((call) => call.text.includes('INSERT INTO premium_credit_ledger'))).toBe(false);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO underwriting_share_actions'),
      [
        7,
        'unique_open',
        'd'.repeat(64),
        false,
        0,
        expect.objectContaining({
          trackingSource: 'visitor_fingerprint',
          creditQualificationReason: 'unique_open_credit_requires_issued_recipient_link',
        }),
      ],
    );
  });

  it('does not award premium credits when the inviter records their own qualified action', async () => {
    const db = createShareDb();

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      actorUserId: 42,
      action: 'challenge',
      recipientHash: 'f'.repeat(64),
      metadata: {
        challengedFields: ['monthlyRent'],
        comment: 'Owner testing their own share should not earn credits.',
      },
    });

    expect(result).toMatchObject({
      status: 'unqualified',
      qualified: false,
      creditAmount: 0,
      creditQualificationReason: 'inviter_self_action_not_credit_eligible',
    });
    expect(db.calls.some((call) => call.text.includes('INSERT INTO premium_credit_ledger'))).toBe(false);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO underwriting_share_actions'),
      [
        7,
        'challenge',
        'f'.repeat(64),
        false,
        0,
        expect.objectContaining({
          challengedFields: ['monthlyRent'],
          creditQualificationReason: 'inviter_self_action_not_credit_eligible',
        }),
      ],
    );
  });

  it('awards unique-open credits only for issued recipient links', async () => {
    const db = createShareDb();

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'unique_open',
      recipientHash: 'e'.repeat(64),
      metadata: {
        trackingSource: 'recipient_link',
        explicitRecipientAccepted: true,
      },
    });

    expect(result.status).toBe('qualified');
    expect(result.creditAmount).toBe(getActionPolicy('unique_open').creditAmount);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO premium_credit_ledger'),
      [42, 7, 100, getActionPolicy('unique_open').creditAmount, 'Qualified underwriting share action: unique_open'],
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

      if (text.includes('GROUP BY r.source')) {
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

      if (text.includes('GROUP BY r.id')) {
        return {
          rows: [
            {
              id: 301,
              source: 'manual',
              created_at: '2026-04-29T04:00:00.000Z',
              last_opened_at: '2026-04-29T04:20:00.000Z',
              has_challenge: false,
              has_version: false,
              has_signup: false,
              credit_awarded: '1',
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
    expect(summary.inviteFollowUps).toEqual([
      {
        recipientLinkId: 301,
        source: 'manual',
        status: 'opened',
        nextQualifiedAction: 'challenge',
        suggestedCopy: expect.stringContaining('Challenge my underwriting'),
        creditAwarded: 1,
        createdAt: '2026-04-29T04:00:00.000Z',
        lastOpenedAt: '2026-04-29T04:20:00.000Z',
        guardrail: expect.stringContaining('never award credits for raw clicks'),
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
    expect(summary.qualifiedShareAssist).toMatchObject({
      cta: 'Challenge my underwriting.',
      stage: 'version_to_signup',
      nextQualifiedAction: 'signup',
      suggestedMessage: expect.stringContaining('Challenge my underwriting'),
      followUpTrigger: '2 recipient-specific invites have not opened yet.',
      earnedCredits: 13,
    });
    expect(summary.qualifiedShareAssist.antiAbuseChecklist.join(' ')).toContain('raw clicks');
    expect(summary.rewardBrief).toMatchObject({
      cta: 'Challenge my underwriting.',
      earnedCredits: 13,
      qualifiedActions: ['unique_open', 'challenge', 'saved_version'],
      antiAbuseGuardrail: expect.stringContaining('never granted for raw clicks alone'),
    });
    expect(summary.rewardEligibility).toMatchObject({
      cta: 'Challenge my underwriting.',
      rawClickPolicy: expect.stringContaining('unqualified for credits'),
      recipientLinkCoverage: {
        invitedRecipientCount: 3,
        unopenedRecipientCount: 2,
        needsRecipientLinksForOpenCredits: false,
      },
    });
    expect(summary.rewardEligibility.actionEligibility.unique_open).toMatchObject({
      canEarnToday: true,
      dailyRemainingForShare: 2,
      blockedReason: null,
    });
    expect(summary.rewardEligibility.actionEligibility.challenge.requirements.join(' ')).toContain('10+ character note');
    expect(summary.rewardBrief.bestNextReward).toMatchObject({ action: 'signup', creditAmount: 5 });
    expect(summary.qualifiedShareDigest).toMatchObject({
      cta: 'Challenge my underwriting.',
      nextQualifiedAction: 'signup',
      earnedGoogleSheetsExportCredits: 13,
      remainingGoogleSheetsExportCreditsToday: expect.any(Number),
      suggestedCopy: expect.stringContaining('Challenge my underwriting'),
    });
    expect(summary.qualifiedShareDigest.antiAbuse.join(' ')).toContain('raw share clicks');
    expect(summary.recentActions[0]).not.toHaveProperty('recipientHash');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT recipient_hash)'), [7]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [7, 5]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM underwriting_share_recipients'), [7]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN underwriting_share_actions'), [7]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [7, 25]);
  });

  it('prioritizes recipient follow-ups by next qualified action without exposing hashes', async () => {
    const query = jest.fn(async () => ({
      rows: [
        {
          id: 10,
          source: 'agent_dm',
          created_at: '2026-05-19T01:00:00.000Z',
          last_opened_at: null,
          has_challenge: false,
          has_version: false,
          has_signup: false,
          credit_awarded: '0',
        },
        {
          id: 11,
          source: 'agent_dm',
          created_at: '2026-05-19T01:05:00.000Z',
          last_opened_at: '2026-05-19T01:10:00.000Z',
          has_challenge: true,
          has_version: false,
          has_signup: false,
          credit_awarded: '3',
        },
      ],
    }));

    const followUps = await getRecipientInviteFollowUps({ query }, 7, 10);

    expect(followUps).toEqual([
      expect.objectContaining({
        recipientLinkId: 10,
        status: 'unopened',
        nextQualifiedAction: 'unique_open',
        suggestedCopy: expect.stringContaining('open this tracked link'),
      }),
      expect.objectContaining({
        recipientLinkId: 11,
        status: 'challenged',
        nextQualifiedAction: 'saved_version',
        creditAwarded: 3,
      }),
    ]);
    expect(followUps[0]).not.toHaveProperty('recipientHash');
    expect(followUps[0]?.guardrail).toContain('never award credits for raw clicks');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('GROUP BY r.id'), [7, 10]);
    expect(query).toHaveBeenCalledWith(expect.not.stringContaining('recipient_hash AS'), expect.anything());
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

  it('accepts only issued recipient keys for explicit recipient tracking', async () => {
    const recipientKey = 'issued-recipient-key';
    const recipientHash = getExplicitRecipientHash(recipientKey);
    const query = jest.fn(async (_text: string, params?: readonly unknown[]) => ({
      rows: params?.[1] === recipientHash ? [{ id: 301 }] : [],
    }));
    const req = {
      ip: '203.0.113.10',
      headers: { 'user-agent': 'jest-recipient-browser' },
      socket: {},
    } as any;

    const accepted = await resolveShareRecipientHash({ query }, {
      shareId: 7,
      req,
      explicitRecipient: recipientKey,
    });
    const rejected = await resolveShareRecipientHash({ query }, {
      shareId: 7,
      req,
      explicitRecipient: 'forged-recipient-key',
    });

    expect(accepted).toEqual({
      recipientHash,
      trackingSource: 'recipient_link',
      explicitRecipientAccepted: true,
    });
    expect(rejected).toEqual({
      recipientHash: expect.not.stringMatching(recipientHash),
      trackingSource: 'visitor_fingerprint',
      explicitRecipientAccepted: false,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM underwriting_share_recipients'),
      [7, recipientHash],
    );
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

  it('builds conversion cards that show the next qualified share action without rewarding raw clicks', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: action === 'unique_open' ? 4 : action === 'challenge' ? 1 : 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: action === 'saved_version' ? 0 : 5,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getShareConversionCards>[0]['byAction'];

    const cards = getShareConversionCards({
      byAction,
      invitedRecipientCount: 5,
      unopenedRecipientCount: 1,
    });

    expect(cards.map((card) => card.key)).toEqual([
      'recipient_open',
      'assumption_challenge',
      'saved_version',
      'account_loop',
    ]);
    expect(cards[1]).toMatchObject({
      cta: 'Challenge my underwriting.',
      qualifiedAction: 'challenge',
      status: 'active',
      progressRate: 0.5,
      creditType: 'google_sheets_export',
      creditReward: getActionPolicy('challenge').creditAmount,
      guardrail: expect.stringContaining('No credits for raw share clicks'),
    });
    expect(cards[2]).toMatchObject({
      qualifiedAction: 'saved_version',
      status: 'capped',
      dailyRemainingForAction: 0,
      qualifiedRequirement: expect.stringContaining('changed assumptions'),
    });
  });

  it('builds a qualified share assist playbook with recipient targeting and anti-abuse guardrails', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: action === 'challenge' ? 6 : 5,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getQualifiedShareAssist>[0]['byAction'];

    const unopenedAssist = getQualifiedShareAssist({
      byAction,
      invitedRecipientCount: 3,
      unopenedRecipientCount: 3,
    });

    expect(unopenedAssist).toMatchObject({
      cta: 'Challenge my underwriting.',
      stage: 'recipient_distribution',
      nextQualifiedAction: 'unique_open',
      dailyRemainingForNextAction: 5,
      followUpTrigger: '3 recipient-specific invites have not opened yet.',
    });
    expect(unopenedAssist.suggestedRecipients).toEqual([
      'One investor who knows the neighbourhood rents',
      'One realtor who has sold a comparable property nearby',
      'One lender or mortgage broker who can sanity-check financing assumptions',
    ]);
    expect(unopenedAssist.rewardAngle).toContain('Google Sheets export credit');
    expect(unopenedAssist.antiAbuseChecklist.join(' ')).toContain('Do not award credits for raw clicks');

    const challengeAssist = getQualifiedShareAssist({
      byAction: {
        ...byAction,
        unique_open: { ...byAction.unique_open, qualifiedCount: 4 },
      },
      invitedRecipientCount: 4,
      unopenedRecipientCount: 0,
    });
    expect(challengeAssist).toMatchObject({
      stage: 'open_to_challenge',
      nextQualifiedAction: 'challenge',
      suggestedMessage: expect.stringContaining('rent, vacancy, expenses, exit cap'),
      dailyRemainingForNextAction: 6,
    });
  });

  it('plans recipient-specific invite batches without rewarding raw share clicks', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: action === 'unique_open' ? 4 : action === 'challenge' ? 1 : 0,
          cappedCount: 0,
          creditAwarded: action === 'unique_open' ? 4 : action === 'challenge' ? 2 : 0,
          dailyQualifiedCount: action === 'unique_open' ? 2 : 0,
          dailyRemainingShareCap: action === 'unique_open' ? 3 : 5,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getQualifiedRecipientInvitePlan>[0]['byAction'];

    const plan = getQualifiedRecipientInvitePlan({
      byAction,
      invitedRecipientCount: 0,
      unopenedRecipientCount: 0,
    });

    expect(plan).toMatchObject({
      cta: 'Challenge my underwriting.',
      recommendedNewRecipientLinks: 3,
      remainingUniqueOpenCreditsToday: 3,
      openedWithoutChallenge: 3,
      challengedWithoutVersion: 1,
      inviteCopy: expect.stringContaining('save or fork your version'),
      followUpCopy: expect.stringContaining('challenge one rent'),
      qualificationRule: expect.stringContaining('Raw share clicks and link creation do not earn credits'),
      nextOwnerStep: 'Create 3 recipient-specific links before asking for more opens.',
    });
    expect(plan.recipientPersonas.map((recipient) => recipient.persona)).toEqual([
      'neighbourhood rent skeptic',
      'active listing or buyer agent',
      'lender or mortgage broker',
      'operator or property manager',
    ]);

    const waitingPlan = getQualifiedRecipientInvitePlan({
      byAction,
      invitedRecipientCount: 4,
      unopenedRecipientCount: 2,
    });
    expect(waitingPlan).toMatchObject({
      recommendedNewRecipientLinks: 0,
      nextOwnerStep: 'Wait for or follow up with 2 unopened recipient-specific invites; do not create duplicate links for the same person.',
    });
  });

  it('builds an owner digest around the next qualified action instead of vanity clicks', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: action === 'unique_open' ? 5 : action === 'challenge' ? 1 : 0,
          cappedCount: 0,
          creditAwarded: action === 'unique_open' ? 5 : action === 'challenge' ? 2 : 0,
          dailyQualifiedCount: action === 'unique_open' ? 5 : action === 'challenge' ? 1 : 0,
          dailyRemainingShareCap: action === 'unique_open' ? 0 : 4,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getQualifiedShareDigest>[0]['byAction'];

    const digest = getQualifiedShareDigest({
      byAction,
      invitedRecipientCount: 6,
      unopenedRecipientCount: 1,
    });

    expect(digest).toMatchObject({
      cta: 'Challenge my underwriting.',
      headline: 'Next best qualified action: challenge.',
      nextQualifiedAction: 'challenge',
      suggestedCopy: expect.stringContaining('rent, vacancy, expenses'),
      recommendedNewRecipientLinks: 0,
      openedWithoutChallenge: 4,
      challengedWithoutVersion: 1,
      earnedGoogleSheetsExportCredits: 7,
    });
    expect(digest.blockers.join(' ')).toContain('issued recipient link');
    expect(digest.blockers.join(' ')).toContain('qualified openers');
    expect(digest.antiAbuse.join(' ')).toContain('Never grant credits for raw share clicks');
  });

  it('builds reward eligibility guardrails for each qualified share action', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: action === 'saved_version' ? 0 : 3,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getShareRewardEligibilitySummary>[0]['byAction'];

    const noLinks = getShareRewardEligibilitySummary({
      byAction,
      invitedRecipientCount: 0,
      unopenedRecipientCount: 0,
    });

    expect(noLinks).toMatchObject({
      cta: 'Challenge my underwriting.',
      rawClickPolicy: expect.stringContaining('Generic opens/raw clicks'),
      recipientLinkCoverage: {
        invitedRecipientCount: 0,
        unopenedRecipientCount: 0,
        needsRecipientLinksForOpenCredits: true,
      },
    });
    expect(noLinks.actionEligibility.unique_open).toMatchObject({
      canEarnToday: false,
      blockedReason: 'issued_recipient_link_required_for_unique_open_credit',
      creditType: 'google_sheets_export',
    });
    expect(noLinks.actionEligibility.saved_version).toMatchObject({
      canEarnToday: false,
      blockedReason: 'daily_share_cap_reached',
    });
    expect(noLinks.actionEligibility.challenge).toMatchObject({
      canEarnToday: true,
      blockedReason: null,
      dailyRecipientCap: getActionPolicy('challenge').dailyRecipientCap,
    });
    expect(noLinks.actionEligibility.challenge.guardrail).toContain('raw share clicks');
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

  it('builds a public reward ladder that explains qualified actions without rewarding raw clicks', () => {
    const ladder = getPublicShareRewardLadder();

    expect(ladder).toHaveLength(5);
    expect(ladder.map((step) => step.action)).toEqual(['unique_open', 'challenge', 'fork', 'signup', 'saved_version']);
    expect(ladder.find((step) => step.action === 'challenge')).toMatchObject({
      label: 'Meaningful challenge',
      creditType: 'google_sheets_export',
      creditAmount: 2,
      dailyShareCap: getActionPolicy('challenge').dailyShareCap,
      qualifiesWhen: expect.stringContaining('substantive note'),
    });
    expect(ladder.map((step) => step.qualifiesWhen).join(' ')).not.toContain('raw click');
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
