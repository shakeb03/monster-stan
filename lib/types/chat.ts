/**
 * Chat type matching the chats table schema from DOC 02
 */

export type Chat = {
  id: string; // PK
  user_id: string; // FK → users.id
  title: string | null;
  created_at: string; // timestamp
  updated_at: string; // timestamp
  is_active: boolean;
};
