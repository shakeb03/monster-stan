/**
 * Memory updater service
 * Triggers memory updates at appropriate intervals
 */

import { updateContentStrategy, updatePastWins } from '@/lib/ai/memory-summarizer';
import { getSupabaseAdminClient } from '@/lib/db';
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
    const supabase = getSupabaseAdminClient();

    // Get posts
    const { data: postsData, error: postsError } = await supabase
      .from('linkedin_posts')
      .select('*')
      .eq('user_id', userId)
      .order('engagement_score', { ascending: false });

    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`);
    }

    const posts = (postsData as LinkedInPost[]) || [];

    // Get style profile
    const { data: styleProfilesData, error: styleError } = await supabase
      .from('style_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    // Validate and cast style_json
    let styleProfile: StyleJson | null = null;
    if (!styleError && styleProfilesData) {
      const profile = styleProfilesData as StyleProfile;
      if (profile.style_json && typeof profile.style_json === 'object') {
        const json = profile.style_json as unknown;
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

