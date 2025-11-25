/**
 * Memory updater service
 * Triggers memory updates at appropriate intervals
 */

import { updateContentStrategy, updatePastWins } from '@/lib/ai/memory-summarizer';
import { queryDatabase } from '@/lib/db';
import type { LinkedInPost, StyleProfile, StyleJson, ChatMessage } from '@/lib/types';

/**
 * Updates memory after user interactions
 * Should be called periodically or after significant events
 */
export async function updateMemoryAfterInteraction(
  userId: string,
  chatMessages: ChatMessage[]
): Promise<void> {
  try {
    // Get posts and style profile
    const posts = await queryDatabase<LinkedInPost>(
      'SELECT * FROM linkedin_posts WHERE user_id = $1 ORDER BY engagement_score DESC',
      [userId]
    );

    const styleProfiles = await queryDatabase<StyleProfile>(
      'SELECT * FROM style_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    // Validate and cast style_json
    let styleProfile: StyleJson | null = null;
    if (styleProfiles.length > 0 && styleProfiles[0].style_json && typeof styleProfiles[0].style_json === 'object') {
      const json = styleProfiles[0].style_json as unknown;
      if (
        json !== null &&
        typeof json === 'object' &&
        'tone' in json &&
        'formality_level' in json &&
        'average_length_words' in json &&
        'emoji_usage' in json &&
        'structure_patterns' in json &&
        'hook_patterns' in json &&
        'hashtag_style' in json &&
        'favorite_topics' in json &&
        'common_phrases_or_cadence_examples' in json &&
        'paragraph_density' in json
      ) {
        styleProfile = json as StyleJson;
      }
    }

    // Update content strategy and past wins
    // Only update if we have enough data
    if (posts.length >= 3 || chatMessages.length >= 5) {
      await Promise.all([
        updateContentStrategy(userId, posts, styleProfile, chatMessages),
        updatePastWins(userId, posts, chatMessages),
      ]);
    }
  } catch (error) {
    console.error('Error updating memory after interaction:', error);
    // Don't throw - memory updates are non-critical
  }
}

