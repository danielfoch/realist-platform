import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { createApiRouter } from '../src/api-routes';

const RAW_KEY = 'realist_live_testtoken';
const AUTH_HEADER = `Bearer ${RAW_KEY}`;
const KEY_HASH = crypto.createHash('sha256').update(RAW_KEY).digest('hex');

function createMockDb() {
  const query = jest.fn(async (text: string, params?: readonly unknown[]) => {
    if (text.includes('FROM api_keys')) {
      return {
        rows: params?.[0] === KEY_HASH
          ? [{ id: 'key-1', user_id: 'user-1', scopes: ['read'] }]
          : [],
      };
    }

    if (text.includes('COUNT(*) AS total')) {
      return { rows: [{ total: '1' }] };
    }

    if (text.includes('FROM listings l')) {
      return {
        rows: [
          {
            id: 1,
            mls_number: 'MLS123',
            address_city: 'Toronto',
            list_price: 500000,
            status: 'Active',
            photos: [],
          },
        ],
      };
    }

    return { rows: [] };
  });

  return {
    query: query as unknown as <T>(text: string, params?: readonly unknown[]) => Promise<{ rows: T[] }>,
  };
}

describe('api routes integration', () => {
  it('returns 400 for invalid query params', async () => {
    const app = express();
    app.use('/api', createApiRouter(createMockDb()));

    const response = await request(app).get('/api/listings?limit=1000');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('returns 400 for invalid query params after API key auth', async () => {
    const app = express();
    app.use('/api', createApiRouter(createMockDb()));

    const response = await request(app)
      .get('/api/listings?limit=1000')
      .set('Authorization', AUTH_HEADER);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('returns paginated listings for valid query', async () => {
    const app = express();
    app.use('/api', createApiRouter(createMockDb()));

    const response = await request(app)
      .get('/api/listings?city=Toronto&limit=20&page=1')
      .set('Authorization', AUTH_HEADER);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
  });
});
