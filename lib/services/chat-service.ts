/**
 * Chat service for managing chats and messages
 * Business logic for chat operations
 */

import { getDatabaseClient, queryDatabase } from '@/lib/db';
import type { Chat, ChatMessage, ChatMessageRole } from '@/lib/types';

/**
 * Gets all active chats for a user
 */
export async function getUserChats(userId: string): Promise<Chat[]> {
  return queryDatabase<Chat>(
    `SELECT * FROM chats 
     WHERE user_id = $1 AND is_active = true 
     ORDER BY updated_at DESC`,
    [userId]
  );
}

/**
 * Gets a single chat by ID
 */
export async function getChatById(
  chatId: string,
  userId: string
): Promise<Chat | null> {
  const chats = await queryDatabase<Chat>(
    'SELECT * FROM chats WHERE id = $1 AND user_id = $2 AND is_active = true',
    [chatId, userId]
  );
  return chats.length > 0 ? chats[0] : null;
}

/**
 * Creates a new chat
 */
export async function createChat(userId: string, title?: string): Promise<Chat> {
  const client = await getDatabaseClient();
  try {
    const result = await client.query<Chat>(
      `INSERT INTO chats (user_id, title, created_at, updated_at, is_active)
       VALUES ($1, $2, NOW(), NOW(), true)
       RETURNING *`,
      [userId, title || null]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create chat');
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Gets all messages for a chat
 */
export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  return queryDatabase<ChatMessage>(
    `SELECT * FROM chat_messages 
     WHERE chat_id = $1 
     ORDER BY created_at ASC`,
    [chatId]
  );
}

/**
 * Creates a new chat message
 */
export async function createChatMessage(
  chatId: string,
  userId: string | null,
  role: ChatMessageRole,
  content: string,
  metadata?: Record<string, unknown>
): Promise<ChatMessage> {
  const client = await getDatabaseClient();
  try {
    // Create the message
    const messageResult = await client.query<ChatMessage>(
      `INSERT INTO chat_messages (chat_id, user_id, role, content, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [chatId, userId, role, content, metadata ? JSON.stringify(metadata) : null]
    );

    if (messageResult.rows.length === 0) {
      throw new Error('Failed to create chat message');
    }

    // Update chat's updated_at timestamp
    await client.query(
      'UPDATE chats SET updated_at = NOW() WHERE id = $1',
      [chatId]
    );

    return messageResult.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Updates chat title
 */
export async function updateChatTitle(
  chatId: string,
  userId: string,
  title: string
): Promise<Chat> {
  const client = await getDatabaseClient();
  try {
    const result = await client.query<Chat>(
      `UPDATE chats 
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [title, chatId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Chat not found or access denied');
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

