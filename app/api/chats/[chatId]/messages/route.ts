/**
 * API endpoint for managing chat messages
 * GET: Get all messages for a chat
 * POST: Create a new message in a chat
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getChatMessages, createChatMessage, getChatById } from '@/lib/services/chat-service';
import type { ChatMessageRole } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;

    // Verify chat belongs to user
    const chat = await getChatById(chatId, userId);
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const messages = await getChatMessages(chatId);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;

    // Verify chat belongs to user
    const chat = await getChatById(chatId, userId);
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content, role, metadata } = body as {
      content: string;
      role?: ChatMessageRole;
      metadata?: Record<string, unknown>;
    };

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Default to user role if not specified
    const messageRole: ChatMessageRole = role || 'user';

    const message = await createChatMessage(
      chatId,
      messageRole === 'user' ? userId : null,
      messageRole,
      content,
      metadata
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

