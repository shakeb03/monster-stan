/**
 * Prompt builder utility
 * Ensures all LLM calls follow STYLE/FACTS/INSTRUCTIONS pattern with safety rules
 */

import type {
  StyleJson,
  LinkedInProfile,
  LinkedInPost,
  LongTermMemory,
  ChatMessage,
} from '@/lib/types';

interface PromptBlocks {
  styleBlock: string;
  factsBlock: string;
  instructionsBlock: string;
  safetyRules: string;
}

/**
 * Builds STYLE block from style profile
 */
export function buildStyleBlock(styleProfile: StyleJson | null): string {
  if (!styleProfile) {
    return `STYLE BLOCK:
No style profile available. Use a professional, clear writing style.

IMPORTANT: STYLE only controls HOW to write (voice, tone, structure), NOT WHAT to write (content, facts).`;
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

CRITICAL: STYLE only controls HOW to write (voice, tone, structure, cadence), NOT WHAT to write (content, facts, biographical details). STYLE does not override FACTS.`;
}

/**
 * Builds FACTS block from various data sources
 */
export function buildFactsBlock(
  ragPosts: LinkedInPost[],
  profile: LinkedInProfile | null,
  memory: LongTermMemory[],
  chatHistory: ChatMessage[]
): string {
  const facts: string[] = [];

  // Add RAG-selected posts
  if (ragPosts.length > 0) {
    facts.push('RELEVANT POSTS FROM USER\'S LINKEDIN:');
    ragPosts.forEach((post, idx) => {
      if (post.text) {
        facts.push(`Post ${idx + 1}: ${post.text}`);
        if (post.posted_at) {
          facts.push(`Posted: ${new Date(post.posted_at).toLocaleDateString()}`);
        }
        if (post.is_high_performing) {
          facts.push(`Performance: High-performing (${post.engagement_score.toFixed(1)} engagement score)`);
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
    if (profile.experience_json) {
      facts.push(`Experience: ${JSON.stringify(profile.experience_json)}`);
    }
  }

  // Add long-term memory
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

  // Add recent chat history (last 10 messages for context)
  if (chatHistory.length > 0) {
    facts.push('\nRECENT CHAT HISTORY:');
    chatHistory.slice(-10).forEach((msg) => {
      facts.push(`${msg.role}: ${msg.content}`);
    });
  }

  if (facts.length === 0) {
    return `FACTS BLOCK:
No verified data available.

CRITICAL: Since no FACTS are available, you must ask the user for information or produce generic statements. Never invent facts.`;
  }

  return `FACTS BLOCK:
${facts.join('\n')}

CRITICAL RULES FOR USING FACTS:
1. Only use information explicitly stated in FACTS above.
2. Never invent biographical facts, roles, achievements, years, or personal details.
3. Never assume or infer information not present in FACTS.
4. If information is missing, ask the user a question or state that the information is not available.
5. FACTS override STYLE - truth always comes before voice.
6. Do not infer identity details from tone or style patterns.`;
}

/**
 * Builds standard safety rules block
 */
export function buildSafetyRules(): string {
  return `SAFETY RULES (MANDATORY - MUST FOLLOW):

1. NEVER invent biographical facts, roles, achievements, years, or personal details.
2. NEVER assume information not explicitly stated in FACTS.
3. If data is missing → ask a question to the user.
4. STYLE only controls VOICE (how to write), not CONTENT (what to write).
5. FACTS override STYLE - truth always comes before voice matching.
6. If FACTS are insufficient → produce generic statements or ask the user.
7. Do NOT infer identity details from tone or writing style.
8. Avoid confident assertions without grounding in FACTS.
9. When in doubt, ask the user rather than guessing.
10. If you cannot verify a claim from FACTS, do not include it.`;
}

/**
 * Builds complete prompt with STYLE/FACTS/INSTRUCTIONS structure
 */
export function buildCompletePrompt(
  styleProfile: StyleJson | null,
  ragPosts: LinkedInPost[],
  profile: LinkedInProfile | null,
  memory: LongTermMemory[],
  chatHistory: ChatMessage[],
  instructions: string
): string {
  const styleBlock = buildStyleBlock(styleProfile);
  const factsBlock = buildFactsBlock(ragPosts, profile, memory, chatHistory);
  const safetyRules = buildSafetyRules();

  return `${styleBlock}\n\n${factsBlock}\n\nINSTRUCTIONS BLOCK:\n${instructions}\n\n${safetyRules}`;
}

/**
 * Validates generated text against FACTS to detect hallucinations
 */
import { getEnv } from '@/lib/config/env';

export async function validateAgainstFacts(
  generatedText: string,
  factsBlock: string
): Promise<{ isValid: boolean; unsupportedClaims: string[] }> {
  const OpenAI = (await import('openai')).default;
  const env = getEnv();
  const client = new OpenAI({ apiKey: env.openaiApiKey });

  // Build validation prompt using STYLE/FACTS/INSTRUCTIONS structure
  const styleBlock = 'STYLE BLOCK:\nNot applicable for fact validation.';
  
  const validationFactsBlock = `${factsBlock}

GENERATED TEXT TO VALIDATE:
${generatedText}`;

  const instructionsBlock = `INSTRUCTIONS BLOCK:
Analyze the generated text above. List any claims, statements, or assertions that are NOT supported by the FACTS block.

For each unsupported claim:
- Quote the exact text from the generated content
- Explain why it's not supported by FACTS

If all claims are supported by FACTS, set allSupported to true and unsupportedClaims to an empty array.

Return your response as a JSON object with this structure:
{
  "unsupportedClaims": ["claim 1", "claim 2", ...],
  "allSupported": boolean
}

CRITICAL: Be strict - if a claim cannot be verified from FACTS, it is unsupported.`;

  const safetyRules = `SAFETY RULES:
1. Only mark claims as supported if they can be directly verified from FACTS.
2. If a claim is inferred, assumed, or not explicitly stated in FACTS, mark it as unsupported.
3. Be thorough - check every factual claim in the generated text.`;

  const validationPrompt = `${styleBlock}\n\n${validationFactsBlock}\n\n${instructionsBlock}\n\n${safetyRules}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a fact-checker. Identify any claims in the text that are not supported by the provided FACTS. Be strict - if a claim cannot be verified from FACTS, it is unsupported.',
      },
      {
        role: 'user',
        content: validationPrompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { isValid: false, unsupportedClaims: ['Unable to validate'] };
  }

  try {
    const parsed = JSON.parse(content) as {
      unsupportedClaims: string[];
      allSupported: boolean;
    };

    return {
      isValid: parsed.allSupported,
      unsupportedClaims: parsed.unsupportedClaims || [],
    };
  } catch {
    return { isValid: false, unsupportedClaims: ['Validation failed'] };
  }
}

