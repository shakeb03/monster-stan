/**
 * LinkedIn ingestion service
 * Handles Apify actor execution via direct HTTP calls, data parsing, and storage
 */

import { getSupabaseAdminClient } from '@/lib/db';
import { updateOnboardingStatus } from '@/lib/services/user-service';
import { cleanLinkedInPostText } from '@/lib/utils/text-cleaning';
import { analyzeUserData } from '@/lib/services/analysis';
import { getEnv } from '@/lib/config/env';
import type {
  LinkedInProfile,
  LinkedInPost,
  OnboardingStatus,
} from '@/lib/types';
import type {
  ApifyRun,
  ApifyRunStatus,
  ApifyLinkedinProfileResponse,
  ApifyLinkedinProfile,
  ApifyLinkedinPostsResponse,
  ApifyLinkedinPost,
} from '@/lib/types/apify';

interface IngestionResult {
  success: boolean;
  error?: string;
}

/**
 * Triggers the profile actor via HTTP POST
 */
async function triggerProfileActor(
  linkedinUrl: string
): Promise<{ id: string }> {
  const env = getEnv();
  const url = `https://api.apify.com/v2/acts/apimaestro~linkedin-profile-detail/runs?token=${encodeURIComponent(env.apifyApiToken)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      includeEmail: false,
      username: linkedinUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger profile actor: ${response.status} ${errorText}`);
  }

  const runData = (await response.json()) as ApifyRun;
  return { id: runData.data.id };
}

/**
 * Triggers the posts actor via HTTP POST
 */
async function triggerPostsActor(
  linkedinUrl: string
): Promise<{ id: string }> {
  const env = getEnv();
  const url = `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/runs?token=${encodeURIComponent(env.apifyApiToken)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deepScrape: true,
      limitPerSource: 10,
      rawData: false,
      urls: [linkedinUrl],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger posts actor: ${response.status} ${errorText}`);
  }

  const runData = (await response.json()) as ApifyRun;
  return { id: runData.data.id };
}

/**
 * Waits for an Apify run to complete by polling
 */
async function waitForRunCompletion(
  runId: string,
  maxWaitTime: number = 300000 // 5 minutes default
): Promise<{ defaultDatasetId: string | null }> {
  const env = getEnv();
  const startTime = Date.now();

  while (true) {
    const url = `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(env.apifyApiToken)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get run status: ${response.status}`);
    }

    const runData = (await response.json()) as ApifyRun;
    const status = runData.data.status as ApifyRunStatus;

    if (status === 'SUCCEEDED') {
      return {
        defaultDatasetId: runData.data.defaultDatasetId ?? null,
      };
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${runId} failed with status: ${status}`);
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
async function getDatasetItems<T>(datasetId: string): Promise<T[]> {
  const env = getEnv();
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(env.apifyApiToken)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get dataset items: ${response.status}`);
  }

  const items = (await response.json()) as T[];
  return items;
}

/**
 * Parses Apify profile output and stores in linkedin_profiles
 */
async function storeProfileData(
  userId: string,
  profileData: ApifyLinkedinProfile
): Promise<LinkedInProfile> {
  const supabase = getSupabaseAdminClient();

  // Extract fields from Apify profile response structure
  const basicInfo = profileData.basic_info || {};
  const headline = typeof basicInfo.headline === 'string' ? basicInfo.headline : null;
  const about = typeof basicInfo.about === 'string' ? basicInfo.about : null;
  const location = basicInfo.location?.full && typeof basicInfo.location.full === 'string'
    ? basicInfo.location.full
    : null;
  const experience = Array.isArray(profileData.experience) ? profileData.experience : null;

  // Check if profile already exists for this user
  const { data: existingData } = await supabase
    .from('linkedin_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  const now = new Date().toISOString();

  if (existingData) {
    // Update existing profile
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .update({
        headline,
        about,
        location,
        experience_json: experience || null,
        raw_json: profileData,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update profile data');
    }

    return data as LinkedInProfile;
  } else {
    // Insert new profile
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .insert({
        user_id: userId,
        headline,
        about,
        location,
        experience_json: experience || null,
        raw_json: profileData,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to insert profile data');
    }

    return data as LinkedInProfile;
  }
}

/**
 * Parses Apify posts output and stores in linkedin_posts
 * Only inserts posts where text is a non-empty string
 */
async function storePostsData(
  userId: string,
  postsData: ApifyLinkedinPost[]
): Promise<LinkedInPost[]> {
  const supabase = getSupabaseAdminClient();
  const storedPosts: LinkedInPost[] = [];
  const now = new Date().toISOString();

  for (const postData of postsData) {
    // Only insert posts where text is a non-empty string
    const rawText = typeof postData.text === 'string' && postData.text.trim().length > 0
      ? postData.text
      : null;

    if (!rawText) {
      continue; // Skip posts without text
    }

    const cleanedText = cleanLinkedInPostText(rawText);

    // Parse posted date from postedAtISO
    let postedAt: string | null = null;
    if (postData.postedAtISO && typeof postData.postedAtISO === 'string') {
      postedAt = postData.postedAtISO;
    }

    // Map response fields to database fields
    const likesCount = typeof postData.numLikes === 'number' ? postData.numLikes : 0;
    const commentsCount = typeof postData.numComments === 'number' ? postData.numComments : 0;
    const sharesCount = typeof postData.numShares === 'number' ? postData.numShares : 0;
    // impressions_count is not present in response, set to null
    const impressionsCount = null;

    // engagement_score and is_high_performing will be set later in analysis step
    // topic_hint will be set later
    const engagementScore = 0; // Will be calculated in analysis
    const isHighPerforming = false; // Will be set in analysis
    const topicHint = null; // Will be set later

    const { data, error } = await supabase
      .from('linkedin_posts')
      .insert({
        user_id: userId,
        text: cleanedText,
        raw_text: rawText,
        posted_at: postedAt,
        likes_count: likesCount,
        comments_count: commentsCount,
        shares_count: sharesCount,
        impressions_count: impressionsCount,
        engagement_score: engagementScore,
        is_high_performing: isHighPerforming,
        topic_hint: topicHint,
        raw_json: postData,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error(`Error inserting post: ${error.message}`);
      continue;
    }

    if (data) {
      storedPosts.push(data as LinkedInPost);
    }
  }

  return storedPosts;
}

/**
 * Main ingestion function
 * Triggers both actors concurrently, waits for completion, and stores results
 */
export async function ingestLinkedInData(
  userId: string,
  linkedinUrl: string
): Promise<IngestionResult> {
  try {
    // Set onboarding status to scraping_in_progress at start
    const scrapingStatus: OnboardingStatus = 'scraping_in_progress';
    await updateOnboardingStatus(userId, scrapingStatus);

    // Trigger both actors concurrently
    const [profileRun, postsRun] = await Promise.all([
      triggerProfileActor(linkedinUrl),
      triggerPostsActor(linkedinUrl),
    ]);

    // Wait for both runs to complete
    const [completedProfileRun, completedPostsRun] = await Promise.all([
      waitForRunCompletion(profileRun.id),
      waitForRunCompletion(postsRun.id),
    ]);

    // Get dataset items from both runs
    if (!completedProfileRun.defaultDatasetId || !completedPostsRun.defaultDatasetId) {
      throw new Error('One or both runs completed without a dataset');
    }

    const [profileResponse, postsResponse] = await Promise.all([
      getDatasetItems<ApifyLinkedinProfile>(completedProfileRun.defaultDatasetId),
      getDatasetItems<ApifyLinkedinPost>(completedPostsRun.defaultDatasetId),
    ]);

    // Store profile data - response is an array, use the first element
    if (profileResponse.length > 0) {
      const profileData = profileResponse[0];
      await storeProfileData(userId, profileData);
    } else {
      throw new Error('Profile actor returned no data');
    }

    // Store posts data - response is an array of posts
    if (postsResponse.length > 0) {
      await storePostsData(userId, postsResponse);
    }

    // Update onboarding status to analysis_in_progress on success
    const analysisStatus: OnboardingStatus = 'analysis_in_progress';
    await updateOnboardingStatus(userId, analysisStatus);

    // Trigger analysis in background (don't await - let it run asynchronously)
    // The analysis service will update the status when complete
    analyzeUserData(userId).catch((error) => {
      console.error('Error in background analysis:', error);
      // Set status to error if analysis fails
      const errorStatus: OnboardingStatus = 'error';
      updateOnboardingStatus(userId, errorStatus).catch((updateError) => {
        console.error('Error updating status to error:', updateError);
      });
    });

    return { success: true };
  } catch (error) {
    // Set onboarding status to error on failure
    const errorStatus: OnboardingStatus = 'error';
    await updateOnboardingStatus(userId, errorStatus).catch((updateError) => {
      console.error('Error updating status to error:', updateError);
    });

    // Log error safely (no tokens)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('LinkedIn ingestion error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

