/**
 * LongTermMemory type matching the long_term_memory table schema from DOC 02
 */

export type SummaryType = 'persona' | 'goals' | 'content_strategy' | 'past_wins' | 'other';

export type LongTermMemory = {
  id: string; // PK
  user_id: string; // FK → users.id
  summary_type: SummaryType;
  content: string | Record<string, unknown>; // text or JSON
  updated_at: string; // timestamp
};

