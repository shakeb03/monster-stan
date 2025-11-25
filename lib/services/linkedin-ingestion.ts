/**
 * LinkedIn ingestion service
 * Handles Apify actor execution, data parsing, and storage
 */

import { ApifyClient } from 'apify-client';
import { getDatabaseClient } from '@/lib/db';
import { updateOnboardingStatus } from '@/lib/services/user-service';
import { cleanLinkedInPostText } from '@/lib/utils/text-cleaning';
import type {
  LinkedInProfile,
  LinkedInPost,
  OnboardingStatus,
} from '@/lib/types';
import type {
  ApifyRun,
  ApifyDatasetItem,
  ApifyProfileOutput,
  ApifyPostOutput,
} from '@/lib/types/apify';

interface IngestionResult {
  success: boolean;
  error?: string;
}

/**
 * Gets Apify client instance
 */
function getApifyClient(): ApifyClient {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error('APIFY_TOKEN environment variable is required');
  }
  return new ApifyClient({ token });
}

/**
 * Triggers an Apify actor run
 */
async function triggerActor(
  actorId: string,
  linkedinUrl: string
): Promise<{ id: string; status: string }> {
  const client = getApifyClient();
  const run = await client.actor(actorId).start({
    startUrls: [{ url: linkedinUrl }],
  });
  // Return minimal info needed to track the run
  return {
    id: run.id,
    status: run.status,
  };
}

/**
 * Waits for an Apify run to complete by polling
 */
async function waitForRunCompletion(
  actorId: string,
  runId: string,
  maxWaitTime: number = 300000 // 5 minutes default
): Promise<{ id: string; defaultDatasetId: string | null }> {
  const client = getApifyClient();
  const startTime = Date.now();

  while (true) {
    const run = await client.run(runId).get();

    if (!run) {
      throw new Error(`Apify run ${runId} not found`);
    }

    if (run.status === 'SUCCEEDED') {
      return {
        id: run.id,
        defaultDatasetId: run.defaultDatasetId ?? null,
      };
    }

    if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
      throw new Error(`Apify run ${runId} failed with status: ${run.status}`);
    }

    if (Date.now() - startTime > maxWaitTime) {
      throw new Error(`Apify run ${runId} timed out after ${maxWaitTime}ms`);
    }

    // Wait 2 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Gets dataset items from a completed Apify run
 */
async function getDatasetItems(datasetId: string): Promise<ApifyDatasetItem[]> {
  const client = getApifyClient();

  if (!datasetId) {
    throw new Error(`Dataset ID is required`);
  }

  const { items } = await client.dataset(datasetId).listItems();
  return items as ApifyDatasetItem[];
}

/**
 * Parses Apify profile output and stores in linkedin_profiles
 */
async function storeProfileData(
  userId: string,
  profileData: ApifyProfileOutput
): Promise<LinkedInProfile> {
  const client = await getDatabaseClient();
  try {
    // Extract common fields from Apify output
    // Structure may vary by actor, so we extract what we can
    const headline =
      typeof profileData.headline === 'string' ? profileData.headline : null;
    const about =
      typeof profileData.about === 'string' ? profileData.about : null;
    const location =
      typeof profileData.location === 'string' ? profileData.location : null;
    const experience =
      profileData.experience && typeof profileData.experience === 'object'
        ? profileData.experience
        : null;

    // Check if profile already exists for this user
    const existing = await client.query<LinkedInProfile>(
      'SELECT * FROM linkedin_profiles WHERE user_id = $1',
      [userId]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing profile
      result = await client.query<LinkedInProfile>(
        `UPDATE linkedin_profiles SET
          headline = $2,
          about = $3,
          location = $4,
          experience_json = $5,
          raw_json = $6,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *`,
        [
          userId,
          headline,
          about,
          location,
          experience ? JSON.stringify(experience) : null,
          JSON.stringify(profileData),
        ]
      );
    } else {
      // Insert new profile
      result = await client.query<LinkedInProfile>(
        `INSERT INTO linkedin_profiles (
          user_id, headline, about, location, experience_json, raw_json, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`,
        [
          userId,
          headline,
          about,
          location,
          experience ? JSON.stringify(experience) : null,
          JSON.stringify(profileData),
        ]
      );
    }

    if (result.rows.length === 0) {
      throw new Error('Failed to insert profile data');
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Parses Apify posts output and stores in linkedin_posts
 */
async function storePostsData(
  userId: string,
  postsData: ApifyPostOutput[]
): Promise<LinkedInPost[]> {
  const client = await getDatabaseClient();
  try {
    const storedPosts: LinkedInPost[] = [];

    for (const postData of postsData) {
      // Extract post fields from Apify output
      const rawText =
        typeof postData.text === 'string' ? postData.text : null;
      const cleanedText = rawText ? cleanLinkedInPostText(rawText) : null;

      // Parse posted date if available
      let postedAt: string | null = null;
      if (postData.postedAt) {
        if (typeof postData.postedAt === 'string') {
          postedAt = postData.postedAt;
        } else if (postData.postedAt instanceof Date) {
          postedAt = postData.postedAt.toISOString();
        }
      }

      const likesCount =
        typeof postData.likes === 'number' ? postData.likes : 0;
      const commentsCount =
        typeof postData.comments === 'number' ? postData.comments : 0;
      const sharesCount =
        typeof postData.shares === 'number' ? postData.shares : 0;
      const impressionsCount =
        typeof postData.impressions === 'number'
          ? postData.impressions
          : null;

      // Calculate engagement score (simple sum for now)
      const engagementScore = likesCount + commentsCount + sharesCount;

      // Default values
      const isHighPerforming = false;
      const topicHint = null;

      const result = await client.query<LinkedInPost>(
        `INSERT INTO linkedin_posts (
          user_id, text, raw_text, posted_at, likes_count, comments_count,
          shares_count, impressions_count, engagement_score, is_high_performing,
          topic_hint, raw_json, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *`,
        [
          userId,
          cleanedText,
          rawText,
          postedAt,
          likesCount,
          commentsCount,
          sharesCount,
          impressionsCount,
          engagementScore,
          isHighPerforming,
          topicHint,
          JSON.stringify(postData),
        ]
      );

      if (result.rows.length > 0) {
        storedPosts.push(result.rows[0]);
      }
    }

    return storedPosts;
  } finally {
    client.release();
  }
}

/**
 * Main ingestion function
 * Triggers both actors concurrently, waits for completion, and stores results
 */
export async function ingestLinkedInData(
  userId: string,
  linkedinUrl: string
): Promise<IngestionResult> {
  const profileActorId = process.env.APIFY_LINKEDIN_PROFILE_ACTOR_ID;
  const postsActorId = process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID;

  if (!profileActorId || !postsActorId) {
    throw new Error(
      'APIFY_LINKEDIN_PROFILE_ACTOR_ID and APIFY_LINKEDIN_POSTS_ACTOR_ID must be set'
    );
  }

  try {
    // Trigger both actors concurrently
    const [profileRun, postsRun] = await Promise.all([
      triggerActor(profileActorId, linkedinUrl),
      triggerActor(postsActorId, linkedinUrl),
    ]);

    // Wait for both runs to complete
    const [completedProfileRun, completedPostsRun] = await Promise.all([
      waitForRunCompletion(profileActorId, profileRun.id),
      waitForRunCompletion(postsActorId, postsRun.id),
    ]);

    // Get dataset items from both runs
    if (!completedProfileRun.defaultDatasetId || !completedPostsRun.defaultDatasetId) {
      throw new Error('One or both runs completed without a dataset');
    }

    const [profileItems, postsItems] = await Promise.all([
      getDatasetItems(completedProfileRun.defaultDatasetId),
      getDatasetItems(completedPostsRun.defaultDatasetId),
    ]);

    // Store profile data (expecting single item or array with one item)
    if (profileItems.length > 0) {
      const profileData = Array.isArray(profileItems[0])
        ? profileItems[0]
        : profileItems[0];
      await storeProfileData(userId, profileData as ApifyProfileOutput);
    }

    // Store posts data (expecting array of items)
    // Apify typically returns an array, but we handle both cases
    const postsArray = Array.isArray(postsItems) ? postsItems : [postsItems];
    if (postsArray.length > 0 && postsArray[0] !== null && postsArray[0] !== undefined) {
      await storePostsData(userId, postsArray as ApifyPostOutput[]);
    }

    // Update onboarding status to analysis_in_progress
    const analysisStatus: OnboardingStatus = 'analysis_in_progress';
    await updateOnboardingStatus(userId, analysisStatus);

    return { success: true };
  } catch (error) {
    // Set onboarding status to error
    const errorStatus: OnboardingStatus = 'error';
    await updateOnboardingStatus(userId, errorStatus);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

