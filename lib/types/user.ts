/**
 * User type matching the users table schema from DOC 02
 */

export type User = {
  id: string; // PK, matches Clerk ID
  email: string;
  created_at: string; // timestamp
};
