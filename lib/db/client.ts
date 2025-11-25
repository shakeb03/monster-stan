/**
 * Database client for Supabase Postgres
 * Uses the DATABASE_URL environment variable for direct Postgres connection
 */

import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Gets or creates a Postgres connection pool
 */
export function getDatabasePool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

/**
 * Gets a database client from the pool
 * Use this for database queries
 */
export async function getDatabaseClient(): Promise<PoolClient> {
  const pool = getDatabasePool();
  return pool.connect();
}

/**
 * Executes a query with proper error handling
 */
export async function queryDatabase<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getDatabaseClient();
  try {
    const result = await client.query(query, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

