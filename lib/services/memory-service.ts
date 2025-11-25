/**
 * Memory service for managing long-term memory entries
 */

import { getDatabaseClient, queryDatabase } from '@/lib/db';
import type { LongTermMemory, SummaryType } from '@/lib/types';

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
  summaryType: SummaryType
): Promise<LongTermMemory[]> {
  return queryDatabase<LongTermMemory>(
    'SELECT * FROM long_term_memory WHERE user_id = $1 AND summary_type = $2 ORDER BY updated_at DESC',
    [userId, summaryType]
  );
}

/**
 * Gets a single memory entry by type (most recent)
 */
export async function getMemoryEntry(
  userId: string,
  summaryType: SummaryType
): Promise<LongTermMemory | null> {
  const entries = await getMemoryByType(userId, summaryType);
  return entries.length > 0 ? entries[0] : null;
}

/**
 * Creates or updates a memory entry
 */
export async function upsertMemory(
  userId: string,
  summaryType: SummaryType,
  content: string | Record<string, unknown>
): Promise<LongTermMemory> {
  const client = await getDatabaseClient();
  try {
    // Check if entry exists
    const existing = await getMemoryEntry(userId, summaryType);

    let result;
    if (existing) {
      // Update existing entry
      const contentValue =
        typeof content === 'string' ? content : JSON.stringify(content);
      result = await client.query<LongTermMemory>(
        `UPDATE long_term_memory
         SET content = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [contentValue, existing.id]
      );
    } else {
      // Create new entry
      const contentValue =
        typeof content === 'string' ? content : JSON.stringify(content);
      result = await client.query<LongTermMemory>(
        `INSERT INTO long_term_memory (user_id, summary_type, content, updated_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [userId, summaryType, contentValue]
      );
    }

    if (result.rows.length === 0) {
      throw new Error('Failed to upsert memory entry');
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

