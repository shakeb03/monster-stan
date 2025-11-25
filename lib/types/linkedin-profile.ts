/**
 * LinkedInProfile type matching the linkedin_profiles table schema from DOC 02
 */

export type LinkedInProfile = {
  id: string; // PK
  user_id: string; // FK → users.id
  headline: string | null;
  about: string | null;
  location: string | null;
  experience_json: Record<string, unknown> | null;
  raw_json: Record<string, unknown> | null;
  created_at: string; // timestamp
  updated_at: string; // timestamp
};

