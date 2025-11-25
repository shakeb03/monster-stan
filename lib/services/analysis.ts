/**
 * Analysis service
 * Computes engagement scores, generates embeddings, and creates style profiles
 */

import OpenAI from 'openai';
import { getSupabaseAdminClient } from '@/lib/db';
import { updateOnboardingStatus } from '@/lib/services/user-service';
import type {
  LinkedInPost,
  LinkedInProfile,
  PostEmbedding,
  StyleProfile,
  OnboardingStatus,
  StyleJson,
  DataConfidenceLevel,
} from '@/lib/types';

interface AnalysisResult {
  success: boolean;
  error?: string;
}

import { getEnv } from '@/lib/config/env';

/**
 * Gets OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  const env = getEnv();
  return new OpenAI({ apiKey: env.openaiApiKey });
}

/**
 * Computes engagement score for a post
 * Uses weighted formula: likes (1x) + comments (2x) + shares (3x) + impressions (0.1x)
 */
function computeEngagementScore(post: LinkedInPost): number {
  const likesWeight = 1;
  const commentsWeight = 2;
  const sharesWeight = 3;
  const impressionsWeight = 0.1;

  const baseScore =
    post.likes_count * likesWeight +
    post.comments_count * commentsWeight +
    post.shares_count * sharesWeight;

  const impressionsBonus =
    post.impressions_count !== null
      ? post.impressions_count * impressionsWeight
      : 0;

  return baseScore + impressionsBonus;
}

/**
 * Updates engagement scores for all posts and marks high-performing ones
 */
async function updateEngagementScores(
  userId: string,
  posts: LinkedInPost[]
): Promise<void> {
  if (posts.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();

  // Compute scores for all posts
  const postsWithScores = posts.map((post) => ({
    ...post,
    engagement_score: computeEngagementScore(post),
  }));

  // Sort by engagement score descending
  postsWithScores.sort((a, b) => b.engagement_score - a.engagement_score);

  // Mark top 25-35% as high performing (using 30% as middle ground)
  const topPercent = 0.3;
  const highPerformingCount = Math.max(
    1,
    Math.ceil(postsWithScores.length * topPercent)
  );

  // Update all posts with scores and high-performing flags
  const now = new Date().toISOString();
  for (let i = 0; i < postsWithScores.length; i++) {
    const post = postsWithScores[i];
    const isHighPerforming = i < highPerformingCount;

    const { error } = await supabase
      .from('linkedin_posts')
      .update({
        engagement_score: post.engagement_score,
        is_high_performing: isHighPerforming,
        updated_at: now,
      })
      .eq('id', post.id);

    if (error) {
      console.error(`Error updating engagement score for post ${post.id}:`, error);
    }
  }
}

/**
 * Generates embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  if (!response.data || response.data.length === 0) {
    throw new Error('Failed to generate embedding');
  }

  return response.data[0].embedding;
}

/**
 * Generates embeddings for all posts and profile about text
 */
async function generateAndStoreEmbeddings(
  userId: string,
  posts: LinkedInPost[],
  profileAbout: string | null
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // Generate embeddings for posts
  for (const post of posts) {
    if (!post.text || post.text.trim().length === 0) {
      continue;
    }

    try {
      const embedding = await generateEmbedding(post.text);

      // Check if embedding already exists
      const { data: existingData } = await supabase
        .from('post_embeddings')
        .select('*')
        .eq('post_id', post.id)
        .single();

      // pgvector expects the embedding as an array
      // Supabase will handle the conversion to vector type

      if (existingData) {
        // Update existing embedding
        const { error } = await supabase
          .from('post_embeddings')
          .update({
            embedding: embedding,
          })
          .eq('post_id', post.id);

        if (error) {
          console.error(`Error updating embedding for post ${post.id}:`, error);
        }
      } else {
        // Insert new embedding
        // Supabase accepts array format and casts to vector
        const { error } = await supabase
          .from('post_embeddings')
          .insert({
            post_id: post.id,
            user_id: userId,
            embedding: embedding,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error(`Error inserting embedding for post ${post.id}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error generating embedding for post ${post.id}:`, error);
      // Continue with other posts
    }
  }

  // Note: DOC 05 says to embed profile "about" section, but post_embeddings requires a post_id
  // The profile about text is used directly in style profile generation (see generateStyleProfile)
  // We don't store the profile embedding separately since there's no corresponding post
  // The style profile captures the writing style which includes profile information
}

/**
 * Selects candidate posts for style modeling
 * Uses high-performing posts, supplements with recent posts if needed
 */
function selectCandidatePosts(posts: LinkedInPost[]): LinkedInPost[] {
  // Get high-performing posts
  const highPerforming = posts.filter((p) => p.is_high_performing);

  // If we have enough high-performing posts (at least 5), use those
  if (highPerforming.length >= 5) {
    return highPerforming.slice(0, 10); // Top 10 high-performing
  }

  // Otherwise, supplement with recent posts
  const sortedByDate = [...posts].sort((a, b) => {
    const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return dateB - dateA;
  });

  // Combine high-performing with recent, up to 10 posts
  const candidateIds = new Set<string>();
  const candidates: LinkedInPost[] = [];

  // Add high-performing first
  for (const post of highPerforming) {
    if (candidates.length >= 10) break;
    candidateIds.add(post.id);
    candidates.push(post);
  }

  // Add recent posts to fill up to 10
  for (const post of sortedByDate) {
    if (candidates.length >= 10) break;
    if (!candidateIds.has(post.id)) {
      candidateIds.add(post.id);
      candidates.push(post);
    }
  }

  return candidates;
}

/**
 * Generates style profile JSON using LLM
 */
async function generateStyleProfile(
  candidatePosts: LinkedInPost[],
  profileAbout: string | null
): Promise<{ styleJson: StyleJson; confidence: DataConfidenceLevel }> {
  const client = getOpenAIClient();

  // Prepare post texts for analysis
  const postTexts = candidatePosts
    .map((p) => p.text)
    .filter((t): t is string => t !== null && t.trim().length > 0);

  if (postTexts.length === 0) {
    throw new Error('No post text available for style analysis');
  }

  // Determine confidence level based on data availability
  let confidence: DataConfidenceLevel = 'LOW';
  if (postTexts.length >= 10 && profileAbout) {
    confidence = 'HIGH';
  } else if (postTexts.length >= 5) {
    confidence = 'MEDIUM';
  }

  // Build FACTS block
  const facts: string[] = [];
  if (profileAbout) {
    facts.push(`PROFILE ABOUT SECTION:\n${profileAbout}`);
  }
  if (postTexts.length > 0) {
    facts.push('\nLINKEDIN POSTS:');
    postTexts.slice(0, 10).forEach((text, idx) => {
      facts.push(`Post ${idx + 1}:\n${text}`);
    });
  }

  const factsBlock =
    facts.length > 0
      ? `FACTS BLOCK:\n${facts.join('\n\n---\n\n')}\n\nCRITICAL: Only analyze style patterns from the provided posts. Do not invent facts about the user.`
      : 'FACTS BLOCK:\nNo posts available for style analysis.';

  // STYLE block not applicable for style extraction (we're extracting style, not applying it)
  const styleBlock = 'STYLE BLOCK:\nNot applicable - this is style extraction, not style application.';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Analyze the writing style from the FACTS provided (LinkedIn posts and profile about section).

Extract and return a JSON object with the following exact structure:
{
  "tone": "string describing the overall tone (e.g., 'professional', 'conversational', 'inspirational')",
  "formality_level": number from 1-10 where 1 is very casual and 10 is very formal,
  "average_length_words": number representing average word count per post,
  "emoji_usage": one of "none", "minimal", "moderate", or "heavy",
  "structure_patterns": array of strings describing common structural patterns (e.g., ["question hook", "story opening", "numbered list"]),
  "hook_patterns": array of strings describing how posts typically start (e.g., ["personal anecdote", "statistic", "question"]),
  "hashtag_style": string describing hashtag usage (e.g., "3-5 hashtags at end", "no hashtags", "hashtags integrated"),
  "favorite_topics": array of strings listing common topics/themes,
  "common_phrases_or_cadence_examples": array of strings with 2-3 example phrases that capture the writing cadence,
  "paragraph_density": one of "compact", "spaced", or "varied"
}

CRITICAL: Only extract style patterns from the provided FACTS. Do not invent style characteristics. If data is insufficient, use conservative defaults.

Return ONLY valid JSON, no additional text.`;

  const safetyRules = `SAFETY RULES:
1. Only extract style patterns that are clearly present in the FACTS.
2. Do not infer style characteristics not supported by the provided posts.
3. If data is insufficient, use conservative defaults (e.g., "professional" tone, formality_level 5).
4. Do not invent style patterns.`;

  const prompt = `${styleBlock}\n\n${factsBlock}\n\n${instructionsBlock}\n\n${safetyRules}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at analyzing writing styles. Extract style patterns and return valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in LLM response');
  }

  try {
    const parsed = JSON.parse(content) as StyleJson;

    // Validate structure matches DOC 05 exactly
    if (
      typeof parsed.tone !== 'string' ||
      typeof parsed.formality_level !== 'number' ||
      typeof parsed.average_length_words !== 'number' ||
      !['none', 'minimal', 'moderate', 'heavy'].includes(parsed.emoji_usage) ||
      !Array.isArray(parsed.structure_patterns) ||
      !Array.isArray(parsed.hook_patterns) ||
      typeof parsed.hashtag_style !== 'string' ||
      !Array.isArray(parsed.favorite_topics) ||
      !Array.isArray(parsed.common_phrases_or_cadence_examples) ||
      !['compact', 'spaced', 'varied'].includes(parsed.paragraph_density)
    ) {
      throw new Error('Invalid style JSON structure');
    }

    return { styleJson: parsed, confidence };
  } catch (error) {
    throw new Error(
      `Failed to parse style JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Stores or updates style profile
 */
async function storeStyleProfile(
  userId: string,
  styleJson: StyleJson,
  confidence: DataConfidenceLevel
): Promise<StyleProfile> {
  const supabase = getSupabaseAdminClient();

  // Check if profile exists
  const { data: existingData } = await supabase
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  const now = new Date().toISOString();

  if (existingData) {
    // Update existing
    const { data, error } = await supabase
      .from('style_profiles')
      .update({
        style_json: styleJson,
        data_confidence_level: confidence,
        last_updated_at: now,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating style profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update style profile');
    }

    return data as StyleProfile;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('style_profiles')
      .insert({
        user_id: userId,
        style_json: styleJson,
        data_confidence_level: confidence,
        last_updated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating style profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create style profile');
    }

    return data as StyleProfile;
  }
}

/**
 * Main analysis function
 * Performs all analysis steps and sets onboarding status to ready
 */
export async function analyzeUserData(userId: string): Promise<AnalysisResult> {
  try {
    const supabase = getSupabaseAdminClient();

    // Load posts and profile
    const { data: postsData, error: postsError } = await supabase
      .from('linkedin_posts')
      .select('*')
      .eq('user_id', userId)
      .order('posted_at', { ascending: false });

    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`);
    }

    const posts = (postsData as LinkedInPost[]) || [];

    const { data: profilesData, error: profilesError } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (profilesError && profilesError.code !== 'PGRST116') {
      throw new Error(`Error fetching profile: ${profilesError.message}`);
    }

    if (posts.length === 0) {
      throw new Error('No posts found for analysis');
    }

    const profile = profilesData as LinkedInProfile | null;
    const profileAbout = profile?.about ?? null;

    // Step 1: Compute engagement scores and mark high-performing posts
    await updateEngagementScores(userId, posts);

    // Reload posts with updated scores
    const { data: updatedPostsData, error: updatedPostsError } = await supabase
      .from('linkedin_posts')
      .select('*')
      .eq('user_id', userId)
      .order('engagement_score', { ascending: false });

    if (updatedPostsError) {
      throw new Error(`Error fetching updated posts: ${updatedPostsError.message}`);
    }

    const updatedPosts = (updatedPostsData as LinkedInPost[]) || [];

    // Step 2: Generate and store embeddings
    await generateAndStoreEmbeddings(userId, updatedPosts, profileAbout);

    // Step 3: Select candidate posts for style analysis
    const candidatePosts = selectCandidatePosts(updatedPosts);

    // Step 4: Generate style profile
    const { styleJson, confidence } = await generateStyleProfile(
      candidatePosts,
      profileAbout
    );

    // Step 5: Store style profile
    const storedStyleProfile = await storeStyleProfile(userId, styleJson, confidence);

    // Step 6: Set onboarding status to ready
    const readyStatus: OnboardingStatus = 'ready';
    await updateOnboardingStatus(userId, readyStatus);

    // Step 7: Create initial memory entries (persona and goals)
    try {
      const { createInitialMemory } = await import('@/lib/ai/memory-summarizer');
      // Use the stored style profile - validate it's a proper StyleJson
      let styleProfileForMemory: StyleJson | null = null;
      if (storedStyleProfile.style_json && typeof storedStyleProfile.style_json === 'object') {
        const json = storedStyleProfile.style_json as unknown;
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
          styleProfileForMemory = json as StyleJson;
        }
      }
      await createInitialMemory(userId, profile, updatedPosts, styleProfileForMemory);
    } catch (error) {
      console.error('Error creating initial memory:', error);
      // Don't fail the analysis if memory creation fails
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

