/**
 * Chat service for managing chats and messages
 * Business logic for chat operations
 */

import { getSupabaseAdminClient } from '@/lib/db';
import type { Chat, ChatMessage, ChatMessageRole } from '@/lib/types';

/**
 * Gets all active chats for a user
 */
export async function getUserChats(userId: string): Promise<Chat[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching user chats: ${error.message}`);
  }

  return (data as Chat[]) || [];
}

/**
 * Gets a single chat by ID
 */
export async function getChatById(
  chatId: string,
  userId: string
): Promise<Chat | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Error fetching chat: ${error.message}`);
  }

  return data as Chat | null;
}

/**
 * Creates a new chat
 */
export async function createChat(userId: string, title?: string): Promise<Chat> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title: title || null,
      created_at: now,
      updated_at: now,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating chat: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create chat');
  }

  return data as Chat;
}

/**
 * Gets all messages for a chat
 */
export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Error fetching chat messages: ${error.message}`);
  }

  return (data as ChatMessage[]) || [];
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
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  // Create the message
  const { data: messageData, error: messageError } = await supabase
    .from('chat_messages')
    .insert({
      chat_id: chatId,
      user_id: userId,
      role,
      content,
      metadata_json: metadata || null,
      created_at: now,
    })
    .select()
    .single();

  if (messageError) {
    throw new Error(`Error creating chat message: ${messageError.message}`);
  }

  if (!messageData) {
    throw new Error('Failed to create chat message');
  }

  // Update chat's updated_at timestamp
  await supabase
    .from('chats')
    .update({ updated_at: now })
    .eq('id', chatId);

  return messageData as ChatMessage;
}

/**
 * Updates chat title
 */
export async function updateChatTitle(
  chatId: string,
  userId: string,
  title: string
): Promise<Chat> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('chats')
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating chat title: ${error.message}`);
  }

  if (!data) {
    throw new Error('Chat not found or access denied');
  }

  return data as Chat;
}

