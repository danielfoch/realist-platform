import { normalizeTrackProperties } from '../src/event-tracking';

jest.mock('../src/db', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../src/intent', () => ({
  recomputeIntentForUser: jest.fn(),
}));

jest.mock('../src/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('normalizeTrackProperties', () => {
  it('keeps analytics fields sent at the payload root', () => {
    expect(normalizeTrackProperties({
      event: 'underwriting_opened',
      session_id: 'sess_123',
      listing_id: 'MLS123',
      source: 'map_workspace',
      page: '/tools/cap-rates',
      ts: 1781440000000,
    })).toEqual({
      listing_id: 'MLS123',
      source: 'map_workspace',
      page: '/tools/cap-rates',
      ts: 1781440000000,
    });
  });

  it('merges explicit properties over root payload fields', () => {
    expect(normalizeTrackProperties({
      event: 'underwriting_inputs_changed',
      fields: ['rent'],
      properties: {
        fields: ['rent', 'rate'],
        confidenceScore: 0.82,
      },
    })).toEqual({
      fields: ['rent', 'rate'],
      confidenceScore: 0.82,
    });
  });

  it('returns null when only control fields are present', () => {
    expect(normalizeTrackProperties({
      event: 'page_view',
      session_id: 'sess_123',
      user_id: 10,
    })).toBeNull();
  });
});
