/**
 * Memory summarizer service
 * Creates and updates long-term memory using LLM with STYLE/FACTS/INSTRUCTIONS structure
 */

import OpenAI from 'openai';
import { upsertMemory } from '@/lib/services/memory-service';
import {
  buildCompletePrompt,
  buildStyleBlock,
  buildFactsBlock,
  buildSafetyRules,
} from '@/lib/ai/prompt-builder';
import { getEnv } from '@/lib/config/env';
import type {
  SummaryType,
  LinkedInProfile,
  LinkedInPost,
  StyleJson,
  ChatMessage,
} from '@/lib/types';

/**
 * Gets OpenAI client
 */
function getOpenAIClient(): OpenAI {
  const env = getEnv();
  return new OpenAI({ apiKey: env.openaiApiKey });
}


/**
 * Generates persona summary
 */
export async function generatePersonaSummary(
  userId: string,
  profile: LinkedInProfile | null,
  posts: LinkedInPost[],
  chatMessages: ChatMessage[],
  styleProfile: StyleJson | null
): Promise<void> {
  const client = getOpenAIClient();

  // Use high-performing posts for persona
  const highPerformingPosts = posts
    .filter((p) => p.is_high_performing)
    .slice(0, 5);

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, create a concise persona summary (2-3 paragraphs) that captures:
- Professional identity and background (from LinkedIn profile and posts)
- Key values and communication style (from posts and chat messages)
- Notable characteristics or patterns (from writing style and content)

CRITICAL: Use only information from FACTS. Do not invent facts. If information is missing, state that clearly or create a minimal summary.`;

  const prompt = buildCompletePrompt(
    styleProfile,
    highPerformingPosts,
    profile,
    [], // memory not needed for initial persona
    chatMessages,
    instructionsBlock
  );

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a persona summarizer. Create summaries based only on verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  const summary = response.choices[0]?.message?.content || '';
  if (summary) {
    await upsertMemory(userId, 'persona', summary);
  }
}

/**
 * Generates goals summary
 */
export async function generateGoalsSummary(
  userId: string,
  profile: LinkedInProfile | null,
  chatMessages: ChatMessage[]
): Promise<void> {
  const client = getOpenAIClient();

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, extract and summarize the user's goals (1-2 paragraphs). Look for:
- Career objectives (from LinkedIn profile or chat messages)
- Content goals (from chat messages)
- Professional aspirations (from profile or messages)
- What they want to achieve on LinkedIn (from messages)

CRITICAL: Use only information from FACTS. If no goals are mentioned, create a minimal summary noting that goals will be clarified through conversation. Never invent goals.`;

  const prompt = buildCompletePrompt(
    null, // styleProfile not needed for goals
    [], // posts not needed for goals
    profile,
    [], // memory not needed for initial goals
    chatMessages,
    instructionsBlock
  );

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a goals extractor. Extract goals based only on verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  const summary = response.choices[0]?.message?.content || '';
  if (summary) {
    await upsertMemory(userId, 'goals', summary);
  }
}

/**
 * Updates content strategy summary
 */
export async function updateContentStrategy(
  userId: string,
  posts: LinkedInPost[],
  styleProfile: StyleJson | null,
  chatMessages: ChatMessage[]
): Promise<void> {
  const client = getOpenAIClient();

  // Use high-performing posts for strategy
  const highPerforming = posts.filter((p) => p.is_high_performing).slice(0, 10);

  // Filter relevant strategy messages
  const strategyMessages = chatMessages.filter(
    (msg) =>
      msg.role === 'user' &&
      (msg.content.toLowerCase().includes('strategy') ||
        msg.content.toLowerCase().includes('theme') ||
        msg.content.toLowerCase().includes('topic'))
  );

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, create or update a content strategy summary (2-3 paragraphs) that includes:
- Effective content themes (from high-performing posts and favorite topics)
- What types of posts perform well (from engagement data in FACTS)
- Recommended posting approaches (from style patterns and successful posts)
- Topics that resonate with the audience (from favorite topics and high-performing content)

CRITICAL: Use only information from FACTS. Do not invent strategies. If data is insufficient, note limitations.`;

  const prompt = buildCompletePrompt(
    styleProfile,
    highPerforming,
    null, // profile not needed for strategy
    [], // memory not needed (we're updating strategy itself)
    strategyMessages.length > 0 ? strategyMessages : chatMessages,
    instructionsBlock
  );

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a content strategy advisor. Create strategies based only on verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  const summary = response.choices[0]?.message?.content || '';
  if (summary) {
    await upsertMemory(userId, 'content_strategy', summary);
  }
}

/**
 * Updates past wins summary
 */
export async function updatePastWins(
  userId: string,
  posts: LinkedInPost[],
  chatMessages: ChatMessage[]
): Promise<void> {
  const client = getOpenAIClient();

  // Use high-performing posts as wins
  const highPerforming = posts
    .filter((p) => p.is_high_performing)
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 10);

  // Filter win-related messages
  const winMessages = chatMessages.filter(
    (msg) =>
      msg.role === 'user' &&
      (msg.content.toLowerCase().includes('win') ||
        msg.content.toLowerCase().includes('success') ||
        msg.content.toLowerCase().includes('achievement'))
  );

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, create or update a past wins summary (1-2 paragraphs) that highlights:
- Successful posts and their performance (from high-performing posts with engagement scores)
- What made them successful (from engagement metrics and content analysis)
- Patterns in high-performing content (from style and topic analysis)

CRITICAL: Use only information from FACTS. Do not invent wins. If no wins are available, note that clearly.`;

  const prompt = buildCompletePrompt(
    null, // styleProfile not needed for wins tracking
    highPerforming,
    null, // profile not needed
    [], // memory not needed
    winMessages.length > 0 ? winMessages : chatMessages,
    instructionsBlock
  );

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a wins tracker. Document wins based only on verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  const summary = response.choices[0]?.message?.content || '';
  if (summary) {
    await upsertMemory(userId, 'past_wins', summary);
  }
}

/**
 * Creates initial memory entries after onboarding
 */
export async function createInitialMemory(
  userId: string,
  profile: LinkedInProfile | null,
  posts: LinkedInPost[],
  styleProfile: StyleJson | null
): Promise<void> {
  // Create persona and goals summaries
  await Promise.all([
    generatePersonaSummary(userId, profile, posts, [], styleProfile),
    generateGoalsSummary(userId, profile, []),
  ]);
}

