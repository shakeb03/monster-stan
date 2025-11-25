/**
 * Database module exports
 */

export {
  getDatabasePool,
  getDatabaseClient,
  queryDatabase,
} from './client';

export type { Pool, PoolClient } from 'pg';

