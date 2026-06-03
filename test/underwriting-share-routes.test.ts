import {
  createUnderwritingShareRecipientLinks,
  createUnderwritingShare,
  getActionPolicy,
  getExplicitRecipientHash,
  getGoogleSheetsExportCreditBalance,
  getRecipientInviteFunnel,
  getRewardPolicySnapshot,
  getShareActionSummary,
  getShareConversionInsights,
  getShareGrowthNudge,
  getQualifiedShareRewardBrief,
  getQualifiedShareLoopPlan,
  getQualifiedSharePlaybook,
  getQualifiedActionCatalog,
  getQualifiedActionProofGuide,
  getChallengeResponseNudges,
  getRecipientShareCoaching,
  getChallengeShareCard,
  getShareActionQualificationBlockReason,
  hasMeaningfulChallengePayload,
  previewQualifiedShareActionCredit,
  recordQualifiedShareAction,
  redeemGoogleSheetsExportCredits,
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

  it('blocks spoofed signup rewards unless the recipient is authenticated', () => {
    expect(getShareActionQualificationBlockReason('signup', {}, null)).toContain('authenticated');
    expect(getShareActionQualificationBlockReason('signup', {}, 77)).toBeNull();
    expect(getShareActionQualificationBlockReason('challenge', { comment: 'too short' }, 77)).toContain('10+ character comment');
    expect(getShareActionQualificationBlockReason('challenge', { comment: 'raise exit cap assumption' }, null)).toBeNull();
  });

  it('awards Google Sheets export credits for a qualified challenge', async () => {
    const db = createShareDb();

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'challenge',
      recipientHash: 'a'.repeat(64),
      metadata: { comment: 'raise vacancy and lower rent growth assumptions' },
    });

    expect(result.status).toBe('qualified');
    expect(result.creditAmount).toBe(getActionPolicy('challenge').creditAmount);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO premium_credit_ledger'),
      [42, 7, 100, getActionPolicy('challenge').creditAmount, 'Qualified underwriting share action: challenge'],
    );
  });

  it('blocks unqualified direct action recording before any credit mutation', async () => {
    const db = createShareDb();

    const emptyChallenge = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'challenge',
      recipientHash: 'b'.repeat(64),
      metadata: {},
    });

    expect(emptyChallenge).toMatchObject({
      status: 'blocked',
      qualified: false,
      creditAmount: 0,
      blockReason: expect.stringContaining('Challenge/fork/saved-version credits require changed assumptions'),
    });

    const anonymousSignup = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'signup',
      recipientHash: 'c'.repeat(64),
      metadata: {},
      authenticatedUserId: null,
    });

    expect(anonymousSignup).toMatchObject({
      status: 'blocked',
      qualified: false,
      creditAmount: 0,
      blockReason: expect.stringContaining('authenticated'),
    });
    expect(db.calls).toHaveLength(0);
  });

  it('does not grant duplicate credits for the same recipient/action/share', async () => {
    const db = createShareDb({ existing: { id: 1, qualified: true, credit_amount: 2 } });

    const result = await recordQualifiedShareAction(db, {
      shareId: 7,
      inviterUserId: 42,
      action: 'challenge',
      recipientHash: 'b'.repeat(64),
      metadata: { comment: 'raise vacancy and lower rent growth assumptions' },
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
      metadata: { assumptions: { rentGrowth: 0.01 } },
    });

    expect(result.status).toBe('capped');
    expect(result.qualified).toBe(false);
    expect(result.creditAmount).toBe(0);
    expect(db.calls.some((call) => call.text.includes('INSERT INTO premium_credit_ledger'))).toBe(false);
  });

  it('previews whether a challenge will earn credits without mutating ledgers', async () => {
    const db = createShareDb({ recipientCount: 1 });

    const preview = await previewQualifiedShareActionCredit(db, {
      shareId: 7,
      action: 'challenge',
      recipientHash: 'd'.repeat(64),
      metadata: { comment: 'raise vacancy and lower rent growth assumptions' },
    });

    expect(preview).toMatchObject({
      status: 'eligible',
      eligible: true,
      qualified: true,
      creditAmount: getActionPolicy('challenge').creditAmount,
      potentialCreditAmount: getActionPolicy('challenge').creditAmount,
      shareRemainingToday: getActionPolicy('challenge').dailyShareCap,
      recipientRemainingToday: getActionPolicy('challenge').dailyRecipientCap - 1,
      cta: 'Challenge my underwriting.',
    });
    expect(db.calls.some((call) => call.text.includes('INSERT INTO underwriting_share_actions'))).toBe(false);
    expect(db.calls.some((call) => call.text.includes('INSERT INTO premium_credit_ledger'))).toBe(false);
  });

  it('previews blocked and capped share actions before the recipient submits them', async () => {
    const blockedDb = createShareDb();
    const blocked = await previewQualifiedShareActionCredit(blockedDb, {
      shareId: 7,
      action: 'signup',
      recipientHash: 'e'.repeat(64),
      metadata: {},
      authenticatedUserId: null,
    });

    expect(blocked).toMatchObject({
      status: 'blocked',
      eligible: false,
      creditAmount: 0,
      blockReason: expect.stringContaining('authenticated'),
    });
    expect(blockedDb.calls).toHaveLength(0);

    const cappedDb = createShareDb({ shareCount: getActionPolicy('saved_version').dailyShareCap });
    const capped = await previewQualifiedShareActionCredit(cappedDb, {
      shareId: 7,
      action: 'saved_version',
      recipientHash: 'f'.repeat(64),
      metadata: { inputs: { rent: 3200 } },
    });

    expect(capped).toMatchObject({
      status: 'capped',
      eligible: false,
      creditAmount: 0,
      potentialCreditAmount: getActionPolicy('saved_version').creditAmount,
      shareRemainingToday: 0,
      blockReason: expect.stringContaining('Daily share or recipient caps'),
    });
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
    expect(summary.loopPlan).toMatchObject({
      cta: 'Challenge my underwriting.',
      phase: 'version_to_signup',
      nextQualifiedAction: 'signup',
      completedMilestones: 3,
      earnedCredits: 13,
      recommendedRecipientSource: expect.objectContaining({ source: 'manual' }),
      creditGuardrail: expect.stringContaining('never raw share clicks alone'),
    });
    expect(summary.loopPlan.nextMilestone).toMatchObject({ key: 'account_tied_loop', qualifiedAction: 'signup' });
    expect(summary.loopPlan.sharePlaybook.primaryStep).toMatchObject({ qualifiedAction: 'signup', status: 'ready' });
    expect(summary.sharePlaybook).toMatchObject({
      cta: 'Challenge my underwriting.',
      phase: 'version_to_signup',
      primaryStep: expect.objectContaining({ qualifiedAction: 'signup' }),
      creditGuardrail: expect.stringContaining('Raw share clicks alone never earn Google Sheets export credits'),
    });
    expect(summary.recipientCoaching[0]).toMatchObject({
      source: 'manual',
      stage: 'convert_to_accounts',
      nextQualifiedAction: 'signup',
    });
    expect(summary.recipientCoaching[0].creditGuardrail).toContain('never raw share clicks');
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
      shareCard: expect.objectContaining({
        cta: 'Challenge my underwriting.',
        nextQualifiedAction: 'challenge',
        antiAbuseGuardrail: expect.stringContaining('Raw share clicks alone never earn credits'),
      }),
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
      qualifiedActionCatalog: expect.arrayContaining([
        expect.objectContaining({ action: 'saved_version', recipientPrompt: expect.stringContaining('Save your version') }),
      ]),
    });
    expect(brief.bestNextReward).toEqual({ action: 'saved_version', creditAmount: 4, remainingToday: 3 });
  });

  it('builds recipient-specific Challenge my underwriting cards without promising raw-click credits', () => {
    const card = getChallengeShareCard({
      token: 'share-token',
      recipientKey: 'recipient key/with spaces',
      source: 'agent_dm',
      nextQualifiedAction: 'saved_version',
    });

    expect(card).toMatchObject({
      headline: 'Challenge my underwriting.',
      cta: 'Challenge my underwriting.',
      source: 'agent_dm',
      nextQualifiedAction: 'saved_version',
      rewardTeaser: 'Earn 4 Google Sheets export credits when this becomes a qualified saved version.',
      loopSteps: [
        'Analyze deal',
        'Share underwriting',
        'Recipient challenges or forks assumptions',
        'Save account-tied version',
        'Share onward',
      ],
      qualifiedActionsRequired: ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'],
    });
    expect(card.shareUrl).toBe('/underwriting/share-token?recipient=recipient%20key%2Fwith%20spaces');
    expect(card.recipientInstruction).toContain('Save your version');
    expect(card.proofGuide).toEqual([expect.objectContaining({ action: 'saved_version' })]);
    expect(card.antiAbuseGuardrail).toContain('Raw share clicks alone never earn credits');
  });

  it('builds a next-action playbook from qualified share caps and funnel bottlenecks', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: action === 'unique_open' ? 5 : action === 'challenge' ? 1 : 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: action === 'saved_version' ? 0 : 2,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getQualifiedSharePlaybook>[0]['byAction'];

    const playbook = getQualifiedSharePlaybook({
      byAction,
      invitedRecipientCount: 5,
      unopenedRecipientCount: 0,
      inviteFunnel: [
        {
          source: 'investor_dm',
          invitedCount: 5,
          openedCount: 5,
          challengedCount: 1,
          versionedCount: 0,
          signupCount: 0,
          creditAwarded: 7,
          openRate: 1,
          challengeRate: 0.2,
          versionRate: 0,
          signupRate: 0,
        },
      ],
    });

    expect(playbook).toMatchObject({
      headline: 'Next qualified share actions',
      cta: 'Challenge my underwriting.',
      phase: 'open_to_challenge',
      primaryStep: expect.objectContaining({
        qualifiedAction: 'challenge',
        status: 'ready',
        recipientSource: 'investor_dm',
        creditAmount: getActionPolicy('challenge').creditAmount,
      }),
      dailyCapSummary: expect.objectContaining({
        saved_version: expect.objectContaining({ remainingShareCreditsToday: 0 }),
      }),
    });
    expect(playbook.steps.find((step) => step.qualifiedAction === 'saved_version')).toMatchObject({ status: 'capped' });
    expect(playbook.creditGuardrail).toContain('Raw share clicks alone never earn Google Sheets export credits');
  });

  it('turns share funnel status into a qualified-only viral loop plan', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: action === 'unique_open' ? 4 : action === 'challenge' ? 2 : 0,
          qualifiedCount: action === 'unique_open' ? 4 : action === 'challenge' ? 2 : 0,
          cappedCount: 0,
          creditAwarded: action === 'unique_open' ? 4 : action === 'challenge' ? 4 : 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: 3,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getQualifiedShareLoopPlan>[0]['byAction'];

    const plan = getQualifiedShareLoopPlan({
      byAction,
      invitedRecipientCount: 6,
      unopenedRecipientCount: 1,
      inviteFunnel: [
        {
          source: 'realtor_partner_dm',
          invitedCount: 6,
          openedCount: 4,
          challengedCount: 2,
          versionedCount: 0,
          signupCount: 0,
          creditAwarded: 8,
          openRate: 0.6667,
          challengeRate: 0.5,
          versionRate: 0,
          signupRate: 0,
        },
      ],
    });

    expect(plan).toMatchObject({
      headline: 'Qualified sharing loop plan',
      cta: 'Challenge my underwriting.',
      phase: 'challenge_to_version',
      nextQualifiedAction: 'saved_version',
      completedMilestones: 2,
      earnedCredits: 8,
      recommendedRecipientSource: expect.objectContaining({ source: 'realtor_partner_dm' }),
      sharePrompt: expect.stringContaining('share it onward'),
      challengeResponseNudges: expect.arrayContaining([
        expect.objectContaining({
          nextQualifiedAction: 'saved_version',
          recipientSource: 'realtor_partner_dm',
          rewardCopy: expect.stringContaining('qualified saved version'),
        }),
      ]),
    });
    expect(plan.nextMilestone).toMatchObject({ key: 'first_version', qualifiedAction: 'saved_version' });
    expect(plan.creditGuardrail).toContain('never raw share clicks alone');
    expect(plan.milestones.map((milestone) => milestone.qualifiedAction)).toEqual([
      'unique_open',
      'challenge',
      'saved_version',
      'signup',
    ]);
  });

  it('builds challenge response nudges without using raw clicks as a reward trigger', () => {
    const byAction = Object.fromEntries(
      ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'].map((action) => [
        action,
        {
          totalCount: 0,
          qualifiedCount: 0,
          cappedCount: 0,
          creditAwarded: 0,
          dailyQualifiedCount: 0,
          dailyRemainingShareCap: action === 'challenge' ? 0 : 2,
          lastActionAt: null,
        },
      ]),
    ) as Parameters<typeof getChallengeResponseNudges>[0]['byAction'];

    const nudges = getChallengeResponseNudges({
      byAction,
      inviteFunnel: [
        {
          source: 'agent_dm',
          invitedCount: 5,
          openedCount: 5,
          challengedCount: 1,
          versionedCount: 0,
          signupCount: 0,
          creditAwarded: 7,
          openRate: 1,
          challengeRate: 0.2,
          versionRate: 0,
          signupRate: 0,
        },
      ],
    });

    expect(nudges).toHaveLength(3);
    expect(nudges[0]).toMatchObject({
      rank: 1,
      nextQualifiedAction: 'saved_version',
      recipientSource: 'agent_dm',
      prompt: expect.stringContaining('Save your version'),
      rewardCopy: expect.stringContaining('qualified saved version'),
      antiAbuseGuardrail: expect.stringContaining('meaningful changed payload'),
    });
    expect(nudges.map((nudge) => nudge.nextQualifiedAction)).not.toContain('challenge');
    expect(nudges.map((nudge) => nudge.rewardCopy).join(' ')).not.toContain('raw share clicks');
  });

  it('ranks recipient-source coaching by the next qualified underwriting loop action', () => {
    const coaching = getRecipientShareCoaching([
      {
        source: 'agent_dm',
        invitedCount: 8,
        openedCount: 0,
        challengedCount: 0,
        versionedCount: 0,
        signupCount: 0,
        creditAwarded: 0,
        openRate: 0,
        challengeRate: 0,
        versionRate: 0,
        signupRate: 0,
      },
      {
        source: 'investor_group',
        invitedCount: 5,
        openedCount: 5,
        challengedCount: 4,
        versionedCount: 1,
        signupCount: 0,
        creditAwarded: 13,
        openRate: 1,
        challengeRate: 0.8,
        versionRate: 0.25,
        signupRate: 0,
      },
    ]);

    expect(coaching[0]).toMatchObject({
      source: 'agent_dm',
      stage: 'get_opens',
      nextQualifiedAction: 'unique_open',
      suggestedCopy: expect.stringContaining('Challenge my underwriting'),
    });
    expect(coaching[1]).toMatchObject({
      source: 'investor_group',
      stage: 'convert_to_versions',
      nextQualifiedAction: 'saved_version',
    });
    expect(coaching.every((item) => item.creditGuardrail.includes('never raw share clicks'))).toBe(true);
  });

  it('exposes the current Google Sheets export reward policy snapshot', () => {
    expect(getRewardPolicySnapshot().fork).toEqual(getActionPolicy('fork'));
    expect(getRewardPolicySnapshot().challenge.creditAmount).toBe(2);
  });

  it('documents the qualified action catalog for Challenge my underwriting CTAs', () => {
    const catalog = getQualifiedActionCatalog();

    expect(catalog).toHaveLength(5);
    expect(catalog.find((item) => item.action === 'challenge')).toMatchObject({
      creditAmount: getActionPolicy('challenge').creditAmount,
      recipientPrompt: expect.stringContaining('Challenge my underwriting'),
      qualifiesWhen: expect.stringContaining('specific disagreement'),
      antiAbuseRule: expect.stringContaining('meaningful challenge evidence'),
    });
    expect(catalog.every((item) => item.dailyShareCap > 0 && item.dailyRecipientCap > 0)).toBe(true);
  });

  it('exposes proof requirements for qualified recipient actions', () => {
    const allProof = getQualifiedActionProofGuide();
    const challengeProof = getQualifiedActionProofGuide('challenge');

    expect(allProof).toHaveLength(5);
    expect(challengeProof).toEqual([
      expect.objectContaining({
        action: 'challenge',
        creditAmount: getActionPolicy('challenge').creditAmount,
        requiredEvidence: expect.arrayContaining([expect.stringContaining('10+ character')]),
        acceptedMetadataKeys: expect.arrayContaining(['challengedFields', 'assumptions', 'comment']),
        sampleMetadata: expect.objectContaining({ challengedFields: ['rent', 'vacancy'] }),
        qualificationCopy: expect.stringContaining('Challenge my underwriting'),
        antiAbuseGuardrail: expect.stringContaining('meaningful challenge evidence'),
      }),
    ]);
    expect(allProof.find((item) => item.action === 'signup')).toMatchObject({
      acceptedMetadataKeys: ['userId'],
      qualificationCopy: expect.stringContaining('authentication'),
    });
  });

  it('calculates Google Sheets export credit balance from earned minus redeemed credits', async () => {
    const query = jest.fn(async () => ({ rows: [{ earned_credits: '14', redeemed_credits: '3' }] }));

    const balance = await getGoogleSheetsExportCreditBalance({ query }, 42);

    expect(balance).toMatchObject({
      creditType: 'google_sheets_export',
      earnedCredits: 14,
      redeemedCredits: 3,
      availableCredits: 11,
      cta: 'Challenge my underwriting.',
    });
    expect(balance.antiAbuseGuardrail).toContain('never raw share clicks alone');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('premium_credit_redemptions'), [42, 'google_sheets_export']);
  });

  it('redeems Google Sheets export credits only when a qualified earned balance exists', async () => {
    const query = jest.fn(async () => ({
      rows: [{ available_credits_before: '5', id: 909, credit_amount: '1', created_at: '2026-05-24T05:15:00.000Z' }],
    }));

    const redemption = await redeemGoogleSheetsExportCredits({ query }, {
      userId: 42,
      creditAmount: 1,
      reason: 'Export challenge comparison',
      metadata: { analysisId: 123 },
    });

    expect(redemption).toMatchObject({
      status: 'redeemed',
      redeemed: true,
      redemptionId: 909,
      creditAmount: 1,
      availableCreditsBefore: 5,
      availableCreditsAfter: 4,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO premium_credit_redemptions'),
      [42, 'google_sheets_export', 1, 'Export challenge comparison', { analysisId: 123 }],
    );
  });

  it('blocks Google Sheets export redemption when earned credits are insufficient', async () => {
    const query = jest.fn(async () => ({ rows: [{ available_credits_before: '0', id: null }] }));

    const redemption = await redeemGoogleSheetsExportCredits({ query }, { userId: 42, creditAmount: 2 });

    expect(redemption).toMatchObject({
      status: 'insufficient_credits',
      redeemed: false,
      creditAmount: 2,
      availableCreditsBefore: 0,
      availableCreditsAfter: 0,
      cta: 'Challenge my underwriting.',
    });
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
