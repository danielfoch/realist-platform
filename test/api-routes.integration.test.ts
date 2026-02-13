import express from 'express';
import request from 'supertest';
import { createApiRouter } from '../src/api-routes';

function createMockDb() {
  const query = jest.fn(async (text: string) => {
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
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('returns paginated listings for valid query', async () => {
    const app = express();
    app.use('/api', createApiRouter(createMockDb()));

    const response = await request(app).get('/api/listings?city=Toronto&limit=20&page=1');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
  });
});
