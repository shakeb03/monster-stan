/**
 * AI Orchestrator
 * Handles intent classification, RAG retrieval, and response generation
 */

import OpenAI from 'openai';
import { retrieveRelevantPosts } from '@/lib/ai/rag';
import { getUserMemory } from '@/lib/services/memory-service';
import { getSupabaseAdminClient } from '@/lib/db';
import {
  buildCompletePrompt,
  buildStyleBlock,
  buildFactsBlock,
  buildSafetyRules,
  validateAgainstFacts,
} from '@/lib/ai/prompt-builder';
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

import { getEnv } from '@/lib/config/env';

/**
 * Gets OpenAI client
 */
function getOpenAIClient(): OpenAI {
  const env = getEnv();
  return new OpenAI({ apiKey: env.openaiApiKey });
}

/**
 * Classifies user message intent
 * Uses STYLE/FACTS/INSTRUCTIONS pattern
 */
async function classifyIntent(
  userMessage: string,
  chatHistory: ChatMessage[]
): Promise<IntentClassification> {
  const client = getOpenAIClient();

  // Build FACTS block from chat history
  const factsBlock = chatHistory.length > 0
    ? `FACTS BLOCK:\nRECENT CHAT HISTORY:\n${chatHistory
        .slice(-5)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n')}\n\nCRITICAL: Only use information from FACTS.`
    : 'FACTS BLOCK:\nNo previous chat history available.';

  // STYLE block not needed for classification, but we include it for consistency
  const styleBlock = 'STYLE BLOCK:\nNot applicable for intent classification.';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Classify the user's message into one of these intents: "WRITE_POST", "ANALYZE_PROFILE", "STRATEGY", or "OTHER".

User message: ${userMessage}

Return a JSON object with this exact structure:
{
  "intent": "WRITE_POST" | "ANALYZE_PROFILE" | "STRATEGY" | "OTHER",
  "needs_clarification": boolean,
  "missing_fields": string[],
  "requires_rag": boolean,
  "proposed_follow_ups": string[]
}

Classification rules:
- WRITE_POST: User wants to create a LinkedIn post
  - Set requires_rag to true if message mentions career, experience, achievements, or personal journey
  - Set needs_clarification to true if topic, angle, or key points are missing
  - missing_fields should list what's needed (e.g., ["topic", "target_audience"])
  - proposed_follow_ups should be 1-3 clarifying questions

- ANALYZE_PROFILE: User wants analysis of their LinkedIn profile
  - Set requires_rag to true
  - needs_clarification should typically be false

- STRATEGY: User wants content strategy recommendations
  - Set requires_rag to true
  - needs_clarification should typically be false

- OTHER: Any other request
  - Set requires_rag based on whether the request needs LinkedIn data
  - needs_clarification based on whether more info is needed

Return ONLY valid JSON, no additional text.`;

  const prompt = `${styleBlock}\n\n${factsBlock}\n\n${instructionsBlock}\n\n${buildSafetyRules()}`;

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
 * Generates response for WRITE_POST intent
 */
async function generateWritePostResponse(
  classification: IntentClassification,
  styleProfile: StyleJson | null,
  ragPosts: LinkedInPost[],
  profile: LinkedInProfile | null,
  memory: LongTermMemory[],
  userMessage: string,
  chatHistory: ChatMessage[]
): Promise<string> {
  const client = getOpenAIClient();

  if (classification.needs_clarification) {
    // Generate clarifying question using STYLE/FACTS/INSTRUCTIONS
    const factsBlock = buildFactsBlock(ragPosts, profile, memory, chatHistory);
    const styleBlock = buildStyleBlock(styleProfile);
    const instructionsBlock = `INSTRUCTIONS BLOCK:
The user wants to write a LinkedIn post but needs clarification.

User request: ${userMessage}
Missing fields: ${classification.missing_fields.join(', ')}
Proposed follow-ups: ${classification.proposed_follow_ups.join(', ')}

Generate a concise, friendly clarifying question (1-2 sentences max) asking for the missing information.`;

    const prompt = `${styleBlock}\n\n${factsBlock}\n\n${instructionsBlock}\n\n${buildSafetyRules()}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that asks clarifying questions. Be concise and friendly. Never invent facts.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'Could you provide more details about what you\'d like to write about?';
  }

  // Generate post draft using STYLE/FACTS/INSTRUCTIONS
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

  const prompt = buildCompletePrompt(
    styleProfile,
    ragPosts,
    profile,
    memory,
    chatHistory, // Include chat history for context
    instructionsBlock
  );

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
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  let generatedText = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';

  // Two-pass validation for sensitive content (career posts, bios, about sections)
  // Check if the post mentions career, experience, achievements, or personal journey
  const isSensitiveContent =
    userMessage.toLowerCase().includes('career') ||
    userMessage.toLowerCase().includes('experience') ||
    userMessage.toLowerCase().includes('achievement') ||
    userMessage.toLowerCase().includes('bio') ||
    userMessage.toLowerCase().includes('about') ||
    userMessage.toLowerCase().includes('journey') ||
    generatedText.toLowerCase().includes('worked') ||
    generatedText.toLowerCase().includes('years of') ||
    generatedText.toLowerCase().includes('achieved');

  if (isSensitiveContent) {
    const factsBlockForValidation = buildFactsBlock(ragPosts, profile, memory, chatHistory);
    const validation = await validateAgainstFacts(generatedText, factsBlockForValidation);
    if (!validation.isValid && validation.unsupportedClaims.length > 0) {
      // Refactor the prompt to remove unsupported claims
      const refactorPrompt = `${buildStyleBlock(styleProfile)}\n\n${factsBlockForValidation}\n\nINSTRUCTIONS BLOCK:
The previous draft contained unsupported claims: ${validation.unsupportedClaims.join(', ')}

Regenerate the LinkedIn post draft, ensuring:
1. Remove or rewrite any claims not supported by FACTS
2. Keep the same structure (Hook/Body/CTA)
3. Match the user's style
4. Only use verified information from FACTS

User request: ${userMessage}

${buildSafetyRules()}`;

      const refactoredResponse = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a LinkedIn content assistant. Remove any unsupported claims and regenerate using only verified facts.',
          },
          {
            role: 'user',
            content: refactorPrompt,
          },
        ],
        temperature: 0.7,
      });

      generatedText = refactoredResponse.choices[0]?.message?.content || generatedText;
    }
  }

  return generatedText;
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

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Analyze the user's LinkedIn profile and posts.

Based ONLY on the FACTS provided, produce:
1. Strengths - What's working well
2. Weaknesses - Areas for improvement
3. What to improve - Specific actionable recommendations

CRITICAL: Only use information from FACTS. Never invent facts. If information is missing, state that clearly.`;

  const prompt = buildCompletePrompt(
    styleProfile,
    ragPosts,
    profile,
    [], // memory not needed for profile analysis
    [], // chatHistory not needed for profile analysis
    instructionsBlock
  );

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
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  let generatedText = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t analyze your profile. Please try again.';

  // Two-pass validation for profile analysis (sensitive - involves biographical analysis)
  const factsBlockForValidation = buildFactsBlock(ragPosts, profile, [], []);
  const validation = await validateAgainstFacts(generatedText, factsBlockForValidation);
  
  if (!validation.isValid && validation.unsupportedClaims.length > 0) {
    // Refactor to remove unsupported claims
    const refactorPrompt = `${buildStyleBlock(styleProfile)}\n\n${factsBlockForValidation}\n\nINSTRUCTIONS BLOCK:
The previous analysis contained unsupported claims: ${validation.unsupportedClaims.join(', ')}

Regenerate the profile analysis, ensuring:
1. Remove or rewrite any claims not supported by FACTS
2. Keep the same structure (Strengths/Weaknesses/What to improve)
3. Only use verified information from FACTS

${buildSafetyRules()}`;

    const refactoredResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a LinkedIn profile analyst. Remove any unsupported claims and regenerate using only verified facts.',
        },
        {
          role: 'user',
          content: refactorPrompt,
        },
      ],
      temperature: 0.5,
    });

    generatedText = refactoredResponse.choices[0]?.message?.content || generatedText;
  }

  return generatedText;
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

  const favoriteTopics =
    styleProfile?.favorite_topics.join(', ') || 'general professional topics';

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Generate a content strategy for the user.

Use information from FACTS:
- Favorite topics: ${favoriteTopics}
- High-performing posts (if available in FACTS)
- User goals from memory (if available in FACTS)

Generate:
1. Themes - 3-5 content themes
2. Post ideas - 3-5 post ideas per theme

CRITICAL: Only use information from FACTS. Never invent facts. If data is insufficient, state limitations clearly.`;

  const prompt = buildCompletePrompt(
    styleProfile,
    ragPosts,
    null, // profile not needed for strategy
    memory,
    [], // chatHistory not needed for strategy
    instructionsBlock
  );

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
        content: prompt,
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
  styleProfile: StyleJson | null,
  memory: LongTermMemory[]
): Promise<string> {
  const client = getOpenAIClient();

  const instructionsBlock = `INSTRUCTIONS BLOCK:
User message: ${userMessage}

Provide a helpful response. If you need more information, ask clarifying questions.
Use information from FACTS if relevant, but never invent facts.`;

  const prompt = buildCompletePrompt(
    styleProfile,
    [], // ragPosts not needed for general responses
    null, // profile not needed
    memory,
    [], // chatHistory not needed for general responses
    instructionsBlock
  );

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
        content: prompt,
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
    try {
      ragPosts = await retrieveRelevantPosts(userId, userMessage, 5);
    } catch (error) {
      // Log error but continue without RAG posts
      // The FACTS block will note that no relevant posts were found
      console.error('Error retrieving RAG posts:', error instanceof Error ? error.message : 'Unknown error');
      ragPosts = [];
    }
  }

  // Step 3: Load LinkedIn profile if needed
  let profile: LinkedInProfile | null = null;
  if (
    classification.intent === 'ANALYZE_PROFILE' ||
    classification.intent === 'WRITE_POST'
  ) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!error && data) {
      profile = data as LinkedInProfile;
    }
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
        userMessage,
        chatHistory
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
      response = await generateOtherResponse(userMessage, styleProfile, memory);
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

