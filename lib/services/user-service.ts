/**
 * User service for managing users and user profiles
 * Business logic for ensuring users and user_profile rows exist
 */

import { getSupabaseAdminClient } from '@/lib/db';
import type { User, UserProfile, OnboardingStatus } from '@/lib/types';

/**
 * Ensures a user exists in the database, creating if necessary
 */
export async function ensureUserExists(
  userId: string,
  email: string
): Promise<User> {
  const supabase = getSupabaseAdminClient();

  // Check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 is "not found" - ignore it, we'll create the user
    throw new Error(`Error checking user existence: ${fetchError.message}`);
  }

  if (existingUser) {
    return existingUser as User;
  }

  // Create new user
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Error creating user: ${insertError.message}`);
  }

  if (!newUser) {
    throw new Error('Failed to create user');
  }

  return newUser as User;
}

/**
 * Ensures a user_profile exists for a user, creating with default status if necessary
 */
export async function ensureUserProfileExists(
  userId: string
): Promise<UserProfile> {
  const supabase = getSupabaseAdminClient();

  // Check if user_profile exists
  const { data: existingProfile, error: fetchError } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 is "not found" - ignore it, we'll create the profile
    throw new Error(`Error checking user profile existence: ${fetchError.message}`);
  }

  if (existingProfile) {
    return existingProfile as UserProfile;
  }

  // Create new user_profile with default onboarding_status
  const defaultStatus: OnboardingStatus = 'linkedin_url_pending';
  const now = new Date().toISOString();

  const { data: newProfile, error: insertError } = await supabase
    .from('user_profile')
    .insert({
      user_id: userId,
      onboarding_status: defaultStatus,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Error creating user profile: ${insertError.message}`);
  }

  if (!newProfile) {
    throw new Error('Failed to create user profile');
  }

  return newProfile as UserProfile;
}

/**
 * Gets the user profile for a user
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - return null
      return null;
    }
    throw new Error(`Error fetching user profile: ${error.message}`);
  }

  return data as UserProfile | null;
}

/**
 * Updates the onboarding status for a user
 */
export async function updateOnboardingStatus(
  userId: string,
  status: OnboardingStatus
): Promise<UserProfile> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('user_profile')
    .update({
      onboarding_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating onboarding status: ${error.message}`);
  }

  if (!data) {
    throw new Error(`User profile not found for user ${userId}`);
  }

  return data as UserProfile;
}

/**
 * Updates the LinkedIn URL for a user
 */
export async function updateLinkedInUrl(
  userId: string,
  linkedinUrl: string
): Promise<UserProfile> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('user_profile')
    .update({
      linkedin_url: linkedinUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating LinkedIn URL: ${error.message}`);
  }

  if (!data) {
    throw new Error(`User profile not found for user ${userId}`);
  }

  return data as UserProfile;
}

