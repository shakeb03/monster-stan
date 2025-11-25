/**
 * User service for managing users and user profiles
 * Business logic for ensuring users and user_profile rows exist
 */

import { getDatabaseClient, queryDatabase } from '@/lib/db';
import type { User, UserProfile, OnboardingStatus } from '@/lib/types';

/**
 * Ensures a user exists in the database, creating if necessary
 */
export async function ensureUserExists(
  userId: string,
  email: string
): Promise<User> {
  const client = await getDatabaseClient();
  try {
    // Check if user exists
    const existingUser = await client.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length > 0) {
      return existingUser.rows[0];
    }

    // Create new user
    const result = await client.query<User>(
      'INSERT INTO users (id, email, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [userId, email]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Ensures a user_profile exists for a user, creating with default status if necessary
 */
export async function ensureUserProfileExists(
  userId: string
): Promise<UserProfile> {
  const client = await getDatabaseClient();
  try {
    // Check if user_profile exists
    const existingProfile = await client.query<UserProfile>(
      'SELECT * FROM user_profile WHERE user_id = $1',
      [userId]
    );

    if (existingProfile.rows.length > 0) {
      return existingProfile.rows[0];
    }

    // Create new user_profile with default onboarding_status
    const defaultStatus: OnboardingStatus = 'linkedin_url_pending';
    const result = await client.query<UserProfile>(
      `INSERT INTO user_profile (user_id, onboarding_status, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [userId, defaultStatus]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Gets the user profile for a user
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const profiles = await queryDatabase<UserProfile>(
    'SELECT * FROM user_profile WHERE user_id = $1',
    [userId]
  );

  return profiles.length > 0 ? profiles[0] : null;
}

/**
 * Updates the onboarding status for a user
 */
export async function updateOnboardingStatus(
  userId: string,
  status: OnboardingStatus
): Promise<UserProfile> {
  const client = await getDatabaseClient();
  try {
    const result = await client.query<UserProfile>(
      `UPDATE user_profile
       SET onboarding_status = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [status, userId]
    );

    if (result.rows.length === 0) {
      throw new Error(`User profile not found for user ${userId}`);
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Updates the LinkedIn URL for a user
 */
export async function updateLinkedInUrl(
  userId: string,
  linkedinUrl: string
): Promise<UserProfile> {
  const client = await getDatabaseClient();
  try {
    const result = await client.query<UserProfile>(
      `UPDATE user_profile
       SET linkedin_url = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [linkedinUrl, userId]
    );

    if (result.rows.length === 0) {
      throw new Error(`User profile not found for user ${userId}`);
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

