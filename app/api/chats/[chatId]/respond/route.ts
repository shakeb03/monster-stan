/**
 * API endpoint for orchestrator
 * Processes user message and generates assistant response
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { orchestrateResponse } from '@/lib/ai/orchestrator';
import {
  getChatById,
  getChatMessages,
  createChatMessage,
} from '@/lib/services/chat-service';
import { getUserMemory } from '@/lib/services/memory-service';
import { getSupabaseAdminClient } from '@/lib/db';
import type { StyleProfile, StyleJson } from '@/lib/types';

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
    const { userMessage } = body as { userMessage: string };

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'User message is required' },
        { status: 400 }
      );
    }

    // Get chat history
    const chatHistory = await getChatMessages(chatId);

    // Get style profile
    const supabase = getSupabaseAdminClient();
    const { data: styleProfileData } = await supabase
      .from('style_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();
    const styleProfile = styleProfileData as StyleProfile | null;
    // Validate and cast style_json
    let styleJson: StyleJson | null = null;
    if (styleProfile?.style_json && typeof styleProfile.style_json === 'object') {
      try {
        // Type guard: check if it has required StyleJson fields
        const json = styleProfile.style_json as unknown;
        if (
          json !== null &&
          typeof json === 'object' &&
          'tone' in json &&
          'formality_level' in json &&
          'average_length_words' in json &&
          'emoji_usage' in json &&
          'structure_patterns' in json &&
          'hook_patterns' in json &&
          'hashtag_style' in json &&
          'favorite_topics' in json &&
          'common_phrases_or_cadence_examples' in json &&
          'paragraph_density' in json
        ) {
          styleJson = json as StyleJson;
        }
      } catch {
        // Invalid style_json, leave as null
        styleJson = null;
      }
    }

    // Get memory
    const memory = await getUserMemory(userId);

    // Run orchestrator
    const orchestratorOutput = await orchestrateResponse({
      userId,
      userMessage,
      chatHistory,
      styleProfile: styleJson,
      memory,
    });

    // Save assistant response
    const assistantMessage = await createChatMessage(
      chatId,
      null, // user_id is null for assistant messages
      'assistant',
      orchestratorOutput.response,
      orchestratorOutput.metadata
    );

    // Update memory in background (non-blocking)
    // This runs asynchronously and won't block the response
    const { updateMemoryAfterInteraction } = await import(
      '@/lib/services/memory-updater'
    );
    const updatedHistory = [...chatHistory, assistantMessage];
    updateMemoryAfterInteraction(userId, updatedHistory).catch((error) => {
      console.error('Error updating memory:', error);
    });

    return NextResponse.json({
      message: assistantMessage,
      intent: orchestratorOutput.intent,
    });
  } catch (error) {
    console.error('Error in orchestrator:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

