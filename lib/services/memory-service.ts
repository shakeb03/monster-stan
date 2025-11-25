/**
 * Memory service for retrieving long-term memory entries
 */

import { queryDatabase } from '@/lib/db';
import type { LongTermMemory } from '@/lib/types';

/**
 * Gets all memory entries for a user
 */
export async function getUserMemory(userId: string): Promise<LongTermMemory[]> {
  return queryDatabase<LongTermMemory>(
    'SELECT * FROM long_term_memory WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
}

/**
 * Gets memory entries by summary type
 */
export async function getMemoryByType(
  userId: string,
  summaryType: LongTermMemory['summary_type']
): Promise<LongTermMemory[]> {
  return queryDatabase<LongTermMemory>(
    'SELECT * FROM long_term_memory WHERE user_id = $1 AND summary_type = $2 ORDER BY updated_at DESC',
    [userId, summaryType]
  );
}

