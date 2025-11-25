/**
 * Memory service for managing long-term memory entries
 */

import { getSupabaseAdminClient } from '@/lib/db';
import type { LongTermMemory, SummaryType } from '@/lib/types';

/**
 * Gets all memory entries for a user
 */
export async function getUserMemory(userId: string): Promise<LongTermMemory[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('long_term_memory')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching user memory: ${error.message}`);
  }

  return (data as LongTermMemory[]) || [];
}

/**
 * Gets memory entries by summary type
 */
export async function getMemoryByType(
  userId: string,
  summaryType: SummaryType
): Promise<LongTermMemory[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('long_term_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('summary_type', summaryType)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching memory by type: ${error.message}`);
  }

  return (data as LongTermMemory[]) || [];
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
  const supabase = getSupabaseAdminClient();

  // Check if entry exists
  const existing = await getMemoryEntry(userId, summaryType);

  const contentValue =
    typeof content === 'string' ? content : JSON.stringify(content);
  const now = new Date().toISOString();

  if (existing) {
    // Update existing entry
    const { data, error } = await supabase
      .from('long_term_memory')
      .update({
        content: contentValue,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating memory entry: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update memory entry');
    }

    return data as LongTermMemory;
  } else {
    // Create new entry
    const { data, error } = await supabase
      .from('long_term_memory')
      .insert({
        user_id: userId,
        summary_type: summaryType,
        content: contentValue,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating memory entry: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create memory entry');
    }

    return data as LongTermMemory;
  }
}

