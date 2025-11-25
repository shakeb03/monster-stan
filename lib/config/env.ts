/**
 * Centralized environment variable configuration
 * Provides typed access to all environment variables
 */

interface EnvConfig {
  // Clerk
  clerkPublishableKey: string;
  clerkSecretKey: string;

  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;

  // OpenAI
  openaiApiKey: string;

  // Apify
  apifyApiToken: string;
  apifyLinkedInProfileActorId: string;
  apifyLinkedInPostsActorId: string;
}

/**
 * Validates and returns environment configuration
 * Throws error if required variables are missing
 */
function getEnvConfig(): EnvConfig {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const apifyApiToken = process.env.APIFY_API_TOKEN;
  const apifyLinkedInProfileActorId = process.env.APIFY_LINKEDIN_PROFILE_ACTOR_ID;
  const apifyLinkedInPostsActorId = process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID;

  if (!clerkPublishableKey) {
    throw new Error('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable is required');
  }
  if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY environment variable is required');
  }
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  }
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  }
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  if (!apifyApiToken) {
    throw new Error('APIFY_API_TOKEN environment variable is required');
  }
  if (!apifyLinkedInProfileActorId) {
    throw new Error('APIFY_LINKEDIN_PROFILE_ACTOR_ID environment variable is required');
  }
  if (!apifyLinkedInPostsActorId) {
    throw new Error('APIFY_LINKEDIN_POSTS_ACTOR_ID environment variable is required');
  }

  return {
    clerkPublishableKey,
    clerkSecretKey,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    openaiApiKey,
    apifyApiToken,
    apifyLinkedInProfileActorId,
    apifyLinkedInPostsActorId,
  };
}

// Cache the config
let cachedConfig: EnvConfig | null = null;

/**
 * Gets the environment configuration (cached)
 */
export function getEnv(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = getEnvConfig();
  }
  return cachedConfig;
}

/**
 * Gets Supabase URL for client initialization
 */
export function getSupabaseUrl(): string {
  const env = getEnv();
  return env.supabaseUrl;
}

/**
 * Gets Supabase anonymous key for client-side operations
 */
export function getSupabaseAnonKey(): string {
  const env = getEnv();
  return env.supabaseAnonKey;
}

/**
 * Gets Supabase service role key for server-side admin operations
 * This key has elevated permissions and should NEVER be exposed to the client
 */
export function getSupabaseServiceRoleKey(): string {
  const env = getEnv();
  return env.supabaseServiceRoleKey;
}

