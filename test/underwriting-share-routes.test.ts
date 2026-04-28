import {
  getActionPolicy,
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
});
