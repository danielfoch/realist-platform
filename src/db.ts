/**
 * Database connection using Drizzle ORM
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Simple query interface
export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>> => pool.query<T>(text, params ? [...params] : undefined),
  getClient: () => pool.connect(),
  transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  end: () => pool.end(),
};

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err);
});

export default db;
