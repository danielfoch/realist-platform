import { buildChallengeUnderwritingSharePrompt } from '../src/analysis-routes';

describe('challenge underwriting share prompt', () => {
  it('centers the viral underwriting loop CTA and qualified reward guardrails', () => {
    const prompt = buildChallengeUnderwritingSharePrompt(42);

    expect(prompt.cta).toBe('Challenge my underwriting.');
    expect(prompt.shareUrl).toBe('/analyses/42/challenge');
    expect(prompt.suggestedCopy).toContain('Challenge my underwriting');
    expect(prompt.qualifiedActionsRequired).toEqual([
      'unique_open',
      'challenge_or_fork',
      'signup',
      'saved_version',
    ]);
    expect(prompt.reward.creditType).toBe('google_sheets_export');
    expect(prompt.reward.guardrail).toContain('raw share clicks');
    expect(prompt.antiAbuse.rawClicksDoNotQualify).toBe(true);
    expect(prompt.antiAbuse.recipientTracking).toContain('recipient-specific');
    expect(prompt.antiAbuse.dailyCaps).toContain('daily caps');
  });
});
