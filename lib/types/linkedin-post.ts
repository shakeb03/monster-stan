/**
 * LinkedInPost type matching the linkedin_posts table schema from DOC 02
 */

export type LinkedInPost = {
  id: string; // PK
  user_id: string; // FK → users.id
  text: string | null; // cleaned text
  raw_text: string | null;
  posted_at: string | null; // timestamp
  likes_count: number;
  comments_count: number;
  shares_count: number;
  impressions_count: number | null;
  engagement_score: number;
  is_high_performing: boolean;
  topic_hint: string | null;
  raw_json: Record<string, unknown> | null;
  created_at: string; // timestamp
  updated_at: string; // timestamp
};

