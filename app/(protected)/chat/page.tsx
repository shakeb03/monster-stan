/**
 * Chat page
 * Main chat interface with sidebar, message list, and composer
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { MessageList } from '@/components/chat/message-list';
import { MessageComposer } from '@/components/chat/message-composer';
import type { Chat, ChatMessage } from '@/lib/types';

interface ChatsResponse {
  chats: Chat[];
}

interface MessagesResponse {
  messages: ChatMessage[];
}

interface ChatResponse {
  chat: Chat;
}

export default function ChatPage(): React.ReactElement {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, []);

  // Load messages when active chat changes
  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  const loadChats = async (): Promise<void> => {
    try {
      const response = await fetch('/api/chats');
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error('Failed to load chats');
      }
      const data = (await response.json()) as ChatsResponse;
      setChats(data.chats);

      // Auto-select first chat if available and none selected
      if (data.chats.length > 0 && !activeChatId) {
        setActiveChatId(data.chats[0].id);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (chatId: string): Promise<void> => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const data = (await response.json()) as MessagesResponse;
      setMessages(data.messages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleNewChat = async (): Promise<void> => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat');
      }

      const data = (await response.json()) as ChatResponse;
      const newChat = data.chat;

      // Add to chats list and select it
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const handleChatSelect = (chatId: string): void => {
    setActiveChatId(chatId);
  };

  const handleSendMessage = async (content: string): Promise<void> => {
    if (!activeChatId) {
      // Create a new chat if none is active
      await handleNewChat();
      // Wait a bit for the chat to be created, then retry
      setTimeout(() => {
        if (activeChatId) {
          sendMessageToChat(activeChatId, content);
        }
      }, 100);
      return;
    }

    await sendMessageToChat(activeChatId, content);
  };

  const sendMessageToChat = async (
    chatId: string,
    content: string
  ): Promise<void> => {
    try {
      // First, save the user message
      const userMessageResponse = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          role: 'user',
        }),
      });

      if (!userMessageResponse.ok) {
        throw new Error('Failed to send message');
      }

      const userMessageData = (await userMessageResponse.json()) as {
        message: ChatMessage;
      };
      const userMessage = userMessageData.message;

      // Add user message to list immediately
      setMessages((prev) => [...prev, userMessage]);

      // Then, get AI response from orchestrator
      const orchestratorResponse = await fetch(`/api/chats/${chatId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: content,
        }),
      });

      if (!orchestratorResponse.ok) {
        throw new Error('Failed to get AI response');
      }

      const orchestratorData = (await orchestratorResponse.json()) as {
        message: ChatMessage;
      };
      const assistantMessage = orchestratorData.message;

      // Add assistant message to list
      setMessages((prev) => [...prev, assistantMessage]);

      // Refresh chats to update last updated time
      await loadChats();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
      />
      <div className="flex flex-1 flex-col">
        {activeChatId ? (
          <>
            <div className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {chats.find((c) => c.id === activeChatId)?.title || 'New Chat'}
              </h2>
            </div>
            {isLoadingMessages ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Loading messages...
                  </p>
                </div>
              </div>
            ) : (
              <MessageList messages={messages} />
            )}
            <MessageComposer onSend={handleSendMessage} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                No chat selected
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Select a chat from the sidebar or create a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
