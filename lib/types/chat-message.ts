/**
 * ChatMessage type matching the chat_messages table schema from DOC 02
 */

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string; // PK
  chat_id: string; // FK → chats.id
  user_id: string | null; // FK → users.id (nullable for assistant messages)
  role: ChatMessageRole;
  content: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string; // timestamp
};
