/**
 * Style JSON type matching DOC 05 exactly
 * Must not add or remove fields
 */

export type EmojiUsage = 'none' | 'minimal' | 'moderate' | 'heavy';
export type ParagraphDensity = 'compact' | 'spaced' | 'varied';

export interface StyleJson {
  tone: string;
  formality_level: number;
  average_length_words: number;
  emoji_usage: EmojiUsage;
  structure_patterns: string[];
  hook_patterns: string[];
  hashtag_style: string;
  favorite_topics: string[];
  common_phrases_or_cadence_examples: string[];
  paragraph_density: ParagraphDensity;
}

