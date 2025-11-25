/**
 * AI Orchestrator
 * Handles intent classification, RAG retrieval, and response generation
 */

import OpenAI from 'openai';
import { retrieveRelevantPosts } from '@/lib/ai/rag';
import { getUserMemory } from '@/lib/services/memory-service';
import { queryDatabase } from '@/lib/db';
import type {
  IntentClassification,
  Intent,
  StyleJson,
  LinkedInProfile,
  LinkedInPost,
  LongTermMemory,
  ChatMessage,
} from '@/lib/types';

interface OrchestratorInput {
  userId: string;
  userMessage: string;
  chatHistory: ChatMessage[];
  styleProfile: StyleJson | null;
  memory: LongTermMemory[];
}

interface OrchestratorOutput {
  response: string;
  intent: Intent;
  metadata?: Record<string, unknown>;
}

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
 * Classifies user message intent
 */
async function classifyIntent(
  userMessage: string,
  chatHistory: ChatMessage[]
): Promise<IntentClassification> {
  const client = getOpenAIClient();

  const historyContext = chatHistory
    .slice(-5) // Last 5 messages for context
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n');

  const prompt = `Classify the user's message into one of these intents: "WRITE_POST", "ANALYZE_PROFILE", "STRATEGY", or "OTHER".

Recent chat history:
${historyContext || 'No previous messages'}

User message: ${userMessage}

Return a JSON object with this exact structure:
{
  "intent": "WRITE_POST" | "ANALYZE_PROFILE" | "STRATEGY" | "OTHER",
  "needs_clarification": boolean,
  "missing_fields": string[],
  "requires_rag": boolean,
  "proposed_follow_ups": string[]
}

For WRITE_POST intent:
- Set requires_rag to true if the message mentions career, experience, achievements, or personal journey
- Set needs_clarification to true if topic, angle, or key points are missing
- missing_fields should list what's needed (e.g., ["topic", "target_audience"])
- proposed_follow_ups should be 1-3 clarifying questions

For ANALYZE_PROFILE or STRATEGY:
- Set requires_rag to true
- needs_clarification should typically be false

Return ONLY valid JSON, no additional text.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an intent classifier. Return only valid JSON matching the exact structure specified.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in intent classification response');
  }

  try {
    const parsed = JSON.parse(content) as IntentClassification;

    // Validate intent is one of the allowed values
    if (
      !['WRITE_POST', 'ANALYZE_PROFILE', 'STRATEGY', 'OTHER'].includes(
        parsed.intent
      )
    ) {
      throw new Error(`Invalid intent: ${parsed.intent}`);
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse intent classification: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Builds STYLE block from style profile
 */
function buildStyleBlock(styleProfile: StyleJson | null): string {
  if (!styleProfile) {
    return 'STYLE BLOCK:\nNo style profile available. Use a professional, clear writing style.';
  }

  return `STYLE BLOCK:
Tone: ${styleProfile.tone}
Formality Level: ${styleProfile.formality_level}/10
Average Length: ${styleProfile.average_length_words} words
Emoji Usage: ${styleProfile.emoji_usage}
Structure Patterns: ${styleProfile.structure_patterns.join(', ')}
Hook Patterns: ${styleProfile.hook_patterns.join(', ')}
Hashtag Style: ${styleProfile.hashtag_style}
Favorite Topics: ${styleProfile.favorite_topics.join(', ')}
Common Phrases/Cadence Examples:
${styleProfile.common_phrases_or_cadence_examples.map((p) => `- ${p}`).join('\n')}
Paragraph Density: ${styleProfile.paragraph_density}

IMPORTANT: STYLE only controls HOW to write (voice, tone, structure), NOT WHAT to write (content, facts).`;
}

/**
 * Builds FACTS block from RAG posts, profile, and memory
 */
function buildFactsBlock(
  ragPosts: LinkedInPost[],
  profile: LinkedInProfile | null,
  memory: LongTermMemory[]
): string {
  const facts: string[] = [];

  // Add RAG posts
  if (ragPosts.length > 0) {
    facts.push('RELEVANT POSTS FROM USER\'S LINKEDIN:');
    ragPosts.forEach((post, idx) => {
      if (post.text) {
        facts.push(`Post ${idx + 1}: ${post.text}`);
        if (post.posted_at) {
          facts.push(`Posted: ${new Date(post.posted_at).toLocaleDateString()}`);
        }
      }
    });
  }

  // Add LinkedIn profile
  if (profile) {
    facts.push('\nLINKEDIN PROFILE:');
    if (profile.headline) facts.push(`Headline: ${profile.headline}`);
    if (profile.about) facts.push(`About: ${profile.about}`);
    if (profile.location) facts.push(`Location: ${profile.location}`);
  }

  // Add memory
  if (memory.length > 0) {
    facts.push('\nLONG-TERM MEMORY:');
    memory.forEach((mem) => {
      const content =
        typeof mem.content === 'string'
          ? mem.content
          : JSON.stringify(mem.content);
      facts.push(`${mem.summary_type}: ${content}`);
    });
  }

  if (facts.length === 0) {
    return 'FACTS BLOCK:\nNo verified data available.';
  }

  return `FACTS BLOCK:\n${facts.join('\n')}\n\nIMPORTANT: Only use information from FACTS. Never invent biographical facts, roles, achievements, or years. If data is missing, ask the user or produce generic statements.`;
}

/**
 * Generates response for WRITE_POST intent
 */
async function generateWritePostResponse(
  classification: IntentClassification,
  styleProfile: StyleJson | null,
  ragPosts: LinkedInPost[],
  profile: LinkedInProfile | null,
  memory: LongTermMemory[],
  userMessage: string
): Promise<string> {
  const client = getOpenAIClient();

  if (classification.needs_clarification) {
    // Generate clarifying question
    const clarificationPrompt = `The user wants to write a LinkedIn post but needs clarification.

User request: ${userMessage}
Missing fields: ${classification.missing_fields.join(', ')}
Proposed follow-ups: ${classification.proposed_follow_ups.join(', ')}

Generate a concise, friendly clarifying question (1-2 sentences max) asking for the missing information.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that asks clarifying questions. Be concise and friendly.',
        },
        {
          role: 'user',
          content: clarificationPrompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'Could you provide more details about what you\'d like to write about?';
  }

  // Generate post draft
  const styleBlock = buildStyleBlock(styleProfile);
  const factsBlock = buildFactsBlock(ragPosts, profile, memory);
  const instructionsBlock = `INSTRUCTIONS BLOCK:
User wants to write a LinkedIn post.
User request: ${userMessage}

Generate a LinkedIn post draft with three clear sections:
1. Hook - Opening that grabs attention
2. Body - Main content
3. CTA - Call to action

Use the STYLE block to match the user's writing voice.
Use only information from the FACTS block - never invent facts.
If information is missing, ask the user or use generic statements.`;

  const fullPrompt = `${styleBlock}\n\n${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent biographical facts, roles, achievements, or years.
2. If data is missing, ask a question or use generic statements.
3. STYLE only controls voice, not content.
4. FACTS override STYLE.
5. Do not infer identity details from tone.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a LinkedIn content assistant. Generate posts that match the user\'s style while using only verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
}

/**
 * Generates response for ANALYZE_PROFILE intent
 */
async function generateAnalyzeProfileResponse(
  styleProfile: StyleJson | null,
  ragPosts: LinkedInPost[],
  profile: LinkedInProfile | null
): Promise<string> {
  const client = getOpenAIClient();

  const factsBlock = buildFactsBlock(ragPosts, profile, []);
  const instructionsBlock = `INSTRUCTIONS BLOCK:
Analyze the user's LinkedIn profile and posts.

Based ONLY on the FACTS provided, produce:
1. Strengths - What's working well
2. Weaknesses - Areas for improvement
3. What to improve - Specific actionable recommendations

IMPORTANT: Only use information from FACTS. Never invent facts. If information is missing, state that clearly.`;

  const fullPrompt = `${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent biographical facts, roles, achievements, or years.
2. Base analysis only on provided FACTS.
3. If data is insufficient, state limitations clearly.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a LinkedIn profile analyst. Provide analysis based only on verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.5,
  });

  return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t analyze your profile. Please try again.';
}

/**
 * Generates response for STRATEGY intent
 */
async function generateStrategyResponse(
  styleProfile: StyleJson | null,
  ragPosts: LinkedInPost[],
  memory: LongTermMemory[]
): Promise<string> {
  const client = getOpenAIClient();

  const factsBlock = buildFactsBlock(ragPosts, null, memory);
  const styleBlock = buildStyleBlock(styleProfile);

  const favoriteTopics =
    styleProfile?.favorite_topics.join(', ') || 'general professional topics';
  const highPerformingPosts = ragPosts.filter((p) => p.is_high_performing);

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Generate a content strategy for the user.

Use:
- Favorite topics: ${favoriteTopics}
- High-performing posts (if available)
- User goals from memory

Generate:
1. Themes - 3-5 content themes
2. Post ideas - 3-5 post ideas per theme

IMPORTANT: Only use information from FACTS. Never invent facts.`;

  const fullPrompt = `${styleBlock}\n\n${factsBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent biographical facts, roles, achievements, or years.
2. Base strategy only on provided FACTS.
3. If data is insufficient, state limitations clearly.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a content strategy advisor. Provide strategy based only on verified facts. Never hallucinate.',
      },
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a strategy. Please try again.';
}

/**
 * Generates response for OTHER intent
 */
async function generateOtherResponse(
  userMessage: string,
  styleProfile: StyleJson | null
): Promise<string> {
  const client = getOpenAIClient();

  const styleBlock = buildStyleBlock(styleProfile);
  const instructionsBlock = `INSTRUCTIONS BLOCK:
User message: ${userMessage}

Provide a helpful response. If you need more information, ask clarifying questions.`;

  const fullPrompt = `${styleBlock}\n\n${instructionsBlock}\n\nSAFETY RULES:
1. Never invent biographical facts, roles, achievements, or years.
2. If you don't know something, ask the user.
3. Be helpful and professional.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Be professional and never invent facts.',
      },
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t process your request. Please try again.';
}

/**
 * Main orchestrator function
 */
export async function orchestrateResponse(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  const { userId, userMessage, chatHistory, styleProfile, memory } = input;

  // Step 1: Classify intent
  const classification = await classifyIntent(userMessage, chatHistory);

  // Step 2: Retrieve RAG posts if needed
  let ragPosts: LinkedInPost[] = [];
  if (classification.requires_rag) {
    ragPosts = await retrieveRelevantPosts(userId, userMessage, 5);
  }

  // Step 3: Load LinkedIn profile if needed
  let profile: LinkedInProfile | null = null;
  if (
    classification.intent === 'ANALYZE_PROFILE' ||
    classification.intent === 'WRITE_POST'
  ) {
    const profiles = await queryDatabase<LinkedInProfile>(
      'SELECT * FROM linkedin_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    profile = profiles.length > 0 ? profiles[0] : null;
  }

  // Step 4: Generate response based on intent
  let response: string;
  switch (classification.intent) {
    case 'WRITE_POST':
      response = await generateWritePostResponse(
        classification,
        styleProfile,
        ragPosts,
        profile,
        memory,
        userMessage
      );
      break;
    case 'ANALYZE_PROFILE':
      response = await generateAnalyzeProfileResponse(
        styleProfile,
        ragPosts,
        profile
      );
      break;
    case 'STRATEGY':
      response = await generateStrategyResponse(styleProfile, ragPosts, memory);
      break;
    case 'OTHER':
    default:
      response = await generateOtherResponse(userMessage, styleProfile);
      break;
  }

  return {
    response,
    intent: classification.intent,
    metadata: {
      needs_clarification: classification.needs_clarification,
      requires_rag: classification.requires_rag,
      rag_posts_count: ragPosts.length,
    },
  };
}

