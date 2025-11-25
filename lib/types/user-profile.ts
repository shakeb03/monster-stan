/**
 * UserProfile type matching the user_profile table schema from DOC 02
 */

export type OnboardingStatus =
  | 'linkedin_url_pending'
  | 'scraping_in_progress'
  | 'analysis_in_progress'
  | 'ready'
  | 'error';

export type UserProfile = {
  user_id: string; // PK, FK → users.id
  linkedin_url: string | null;
  onboarding_status: OnboardingStatus;
  goals_json: Record<string, unknown> | null;
  created_at: string; // timestamp
  updated_at: string; // timestamp
};
