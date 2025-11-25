/**
 * StyleProfile type matching the style_profiles table schema from DOC 02
 */

export type DataConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type StyleProfile = {
  id: string; // PK
  user_id: string; // FK → users.id (unique)
  style_json: Record<string, unknown> | null; // structure defined in DOC 05
  data_confidence_level: DataConfidenceLevel;
  last_updated_at: string; // timestamp
};

