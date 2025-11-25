/**
 * Memory summarizer service
 * Creates and updates long-term memory using LLM with STYLE/FACTS/INSTRUCTIONS structure
 */

import OpenAI from 'openai';
import { upsertMemory } from '@/lib/services/memory-service';
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
}

/**
 * Builds FACTS block for memory summarization
 */
function buildMemoryFactsBlock(
  profile: LinkedInProfile | null,
  posts: LinkedInPost[],
  chatMessages: ChatMessage[]
): string {
  const facts: string[] = [];

  // Add LinkedIn profile
  if (profile) {
    facts.push('LINKEDIN PROFILE:');
    if (profile.headline) facts.push(`Headline: ${profile.headline}`);
    if (profile.about) facts.push(`About: ${profile.about}`);
    if (profile.location) facts.push(`Location: ${profile.location}`);
  }

  // Add recent high-performing posts
  const highPerformingPosts = posts
    .filter((p) => p.is_high_performing)
    .slice(0, 5);
  if (highPerformingPosts.length > 0) {
    facts.push('\nHIGH-PERFORMING POSTS:');
    highPerformingPosts.forEach((post, idx) => {
      if (post.text) {
        facts.push(`Post ${idx + 1}: ${post.text}`);
      }
    });
  }

  // Add recent chat messages
  if (chatMessages.length > 0) {
    facts.push('\nRECENT CHAT MESSAGES:');
    chatMessages.slice(-10).forEach((msg) => {
      facts.push(`${msg.role}: ${msg.content}`);
    });
  }

  if (facts.length === 0) {
    return 'FACTS BLOCK:\nNo data available.';
  }

  return `FACTS BLOCK:\n${facts.join('\n')}\n\nIMPORTANT: Only use information from FACTS. Never invent biographical facts, roles, achievements, or years.`;
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

  const factsBlock = buildMemoryFactsBlock(profile, posts, chatMessages);
  const styleBlock = styleProfile
    ? `STYLE BLOCK:\nTone: ${styleProfile.tone}\nFormality: ${styleProfile.formality_level}/10\n\n`
    : 'STYLE BLOCK:\nNo style profile available.\n\n';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, create a concise persona summary (2-3 paragraphs) that captures:
- Professional identity and background
- Key values and communication style
- Notable characteristics or patterns

Use only information from FACTS. Do not invent facts. If information is missing, state that clearly.`;

  const prompt = `${styleBlock}${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent biographical facts, roles, achievements, or years.
2. Base summary only on provided FACTS.
3. If data is insufficient, create a minimal summary or note limitations.`;

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

  const facts: string[] = [];
  if (profile?.about) {
    facts.push(`LinkedIn About: ${profile.about}`);
  }
  if (chatMessages.length > 0) {
    facts.push(
      '\nChat Messages:\n' +
        chatMessages
          .slice(-20)
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join('\n')
    );
  }

  const factsBlock =
    facts.length > 0
      ? `FACTS BLOCK:\n${facts.join('\n')}\n\nIMPORTANT: Only use information from FACTS.`
      : 'FACTS BLOCK:\nNo data available.';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, extract and summarize the user's goals (1-2 paragraphs). Look for:
- Career objectives
- Content goals
- Professional aspirations
- What they want to achieve on LinkedIn

Use only information from FACTS. If no goals are mentioned, create a minimal summary noting that goals will be clarified through conversation.`;

  const prompt = `${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent goals or aspirations.
2. Base summary only on provided FACTS.
3. If no goals are mentioned, note that clearly.`;

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

  const facts: string[] = [];

  // Add high-performing posts
  const highPerforming = posts.filter((p) => p.is_high_performing);
  if (highPerforming.length > 0) {
    facts.push('HIGH-PERFORMING POSTS:');
    highPerforming.slice(0, 10).forEach((post, idx) => {
      if (post.text) {
        facts.push(`${idx + 1}. ${post.text}`);
      }
    });
  }

  // Add style profile topics
  if (styleProfile?.favorite_topics) {
    facts.push(`\nFavorite Topics: ${styleProfile.favorite_topics.join(', ')}`);
  }

  // Add relevant chat messages about strategy
  const strategyMessages = chatMessages.filter(
    (msg) =>
      msg.role === 'user' &&
      (msg.content.toLowerCase().includes('strategy') ||
        msg.content.toLowerCase().includes('theme') ||
        msg.content.toLowerCase().includes('topic'))
  );
  if (strategyMessages.length > 0) {
    facts.push('\nStrategy Discussions:');
    strategyMessages.forEach((msg) => {
      facts.push(`- ${msg.content}`);
    });
  }

  const factsBlock =
    facts.length > 0
      ? `FACTS BLOCK:\n${facts.join('\n')}\n\nIMPORTANT: Only use information from FACTS.`
      : 'FACTS BLOCK:\nNo data available.';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, create or update a content strategy summary (2-3 paragraphs) that includes:
- Effective content themes
- What types of posts perform well
- Recommended posting approaches
- Topics that resonate with the audience

Use only information from FACTS. Do not invent strategies.`;

  const prompt = `${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent strategies or themes.
2. Base strategy only on provided FACTS.
3. If data is insufficient, note limitations.`;

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

  const facts: string[] = [];

  // Add high-performing posts as wins
  const highPerforming = posts.filter((p) => p.is_high_performing);
  if (highPerforming.length > 0) {
    facts.push('HIGH-PERFORMING POSTS (WINS):');
    highPerforming
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, 10)
      .forEach((post, idx) => {
        if (post.text) {
          facts.push(
            `${idx + 1}. ${post.text}\n   Engagement: ${post.engagement_score.toFixed(1)} (${post.likes_count} likes, ${post.comments_count} comments, ${post.shares_count} shares)`
          );
        }
      });
  }

  // Add mentions of wins in chat
  const winMessages = chatMessages.filter(
    (msg) =>
      msg.role === 'user' &&
      (msg.content.toLowerCase().includes('win') ||
        msg.content.toLowerCase().includes('success') ||
        msg.content.toLowerCase().includes('achievement'))
  );
  if (winMessages.length > 0) {
    facts.push('\nMentioned Wins:');
    winMessages.forEach((msg) => {
      facts.push(`- ${msg.content}`);
    });
  }

  const factsBlock =
    facts.length > 0
      ? `FACTS BLOCK:\n${facts.join('\n')}\n\nIMPORTANT: Only use information from FACTS.`
      : 'FACTS BLOCK:\nNo data available.';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Based on the FACTS provided, create or update a past wins summary (1-2 paragraphs) that highlights:
- Successful posts and their performance
- What made them successful
- Patterns in high-performing content

Use only information from FACTS. Do not invent wins.`;

  const prompt = `${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent wins or achievements.
2. Base summary only on provided FACTS.
3. If no wins are available, note that clearly.`;

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

