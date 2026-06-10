import { signState, verifyState } from '../src/google-sheets';

describe('Google OAuth state signing', () => {
  it('round-trips a user id', () => {
    const state = signState(42);
    expect(verifyState(state)).toBe(42);
  });

  it('rejects tampered state', () => {
    const state = signState(42);
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const tampered = Buffer.from(decoded.replace('42', '43')).toString('base64url');
    expect(verifyState(tampered)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyState('not-a-state')).toBeNull();
    expect(verifyState('')).toBeNull();
    expect(verifyState(Buffer.from('a.b.c').toString('base64url'))).toBeNull();
  });

  it('rejects non-positive user ids', () => {
    const state = signState(0);
    expect(verifyState(state)).toBeNull();
  });
});
