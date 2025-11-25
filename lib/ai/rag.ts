/**
 * RAG service for retrieving relevant posts using vector similarity
 */

import { getSupabaseAdminClient } from '@/lib/db';
import type { LinkedInPost } from '@/lib/types';

/**
 * Retrieves top N relevant posts using vector similarity search
 * Uses Supabase RPC function for vector similarity search
 */
export async function retrieveRelevantPosts(
  userId: string,
  queryText: string,
  topK: number = 5
): Promise<LinkedInPost[]> {
  if (!queryText || queryText.trim().length === 0) {
    return [];
  }

  // Generate embedding for query text using OpenAI
  const OpenAI = (await import('openai')).default;
  const { getEnv } = await import('@/lib/config/env');
  const env = getEnv();
  const openai = new OpenAI({ apiKey: env.openaiApiKey });
  
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText,
  });
  
  if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
    console.error('Failed to generate embedding for query');
    return [];
  }
  
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Validate query embedding is a number array
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.error('Invalid query embedding format');
    return [];
  }

  const supabase = getSupabaseAdminClient();

  // Use Supabase RPC to call a database function for vector similarity search
  // The function should be created in the database schema
  // For now, we'll use a workaround: fetch all embeddings and compute similarity in memory
  // In production, create a database function for better performance

  // Get all post embeddings for the user
  const { data: embeddingsData, error: embeddingsError } = await supabase
    .from('post_embeddings')
    .select('post_id, embedding')
    .eq('user_id', userId);

  if (embeddingsError) {
    // Log error but return empty array to allow orchestrator to continue
    console.error(`Error fetching embeddings: ${embeddingsError.message}`);
    return [];
  }

  if (!embeddingsData || embeddingsData.length === 0) {
    return [];
  }

  // Calculate cosine similarity for each embedding with robust type guards
  const similarities: Array<{ postId: string; similarity: number }> = [];

  for (const item of embeddingsData) {
    const raw = item.embedding;
    let embedding: number[] | null = null;

    // Type guard: check if embedding is a valid number array
    if (Array.isArray(raw) && raw.length > 0 && raw.every((v) => typeof v === 'number')) {
      embedding = raw;
    } else if (typeof raw === 'string') {
      // Try to parse legacy string-encoded embeddings
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((v) => typeof v === 'number')) {
          embedding = parsed;
        }
      } catch {
        // Ignore parse errors, skip this item
      }
    }

    // Skip invalid embeddings
    if (!embedding) {
      continue;
    }

    // Ensure embedding length matches query embedding length
    // Truncate to minimum length if they don't match
    const minLength = Math.min(embedding.length, queryEmbedding.length);
    if (minLength === 0) {
      continue;
    }

    const truncatedEmbedding = embedding.slice(0, minLength);
    const truncatedQuery = queryEmbedding.slice(0, minLength);

    try {
      // Cosine similarity: dot product / (norm1 * norm2)
      const dotProduct = truncatedEmbedding.reduce(
        (sum, val, i) => sum + val * truncatedQuery[i],
        0
      );
      const norm1 = Math.sqrt(
        truncatedEmbedding.reduce((sum, val) => sum + val * val, 0)
      );
      const norm2 = Math.sqrt(
        truncatedQuery.reduce((sum, val) => sum + val * val, 0)
      );

      // Avoid division by zero
      if (norm1 === 0 || norm2 === 0) {
        continue;
      }

      const similarity = dotProduct / (norm1 * norm2);
      similarities.push({ postId: item.post_id, similarity });
    } catch (error) {
      // Skip this item if similarity calculation fails
      console.warn(`Error calculating similarity for post ${item.post_id}:`, error);
      continue;
    }
  }

  // If no valid similarities found, return empty array
  if (similarities.length === 0) {
    return [];
  }

  // Sort by similarity descending and take top K
  similarities.sort((a, b) => b.similarity - a.similarity);
  const topPostIds = similarities.slice(0, topK).map((s) => s.postId);

  // If no post IDs, return empty array
  if (topPostIds.length === 0) {
    return [];
  }

  // Fetch the actual posts
  const { data: postsData, error: postsError } = await supabase
    .from('linkedin_posts')
    .select('*')
    .in('id', topPostIds);

  if (postsError) {
    // Log error but don't throw - return empty array to allow orchestrator to continue
    console.error(`Error fetching posts: ${postsError.message}`);
    return [];
  }

  // Return posts in the order of similarity
  const postMap = new Map((postsData || []).map((post) => [post.id, post]));
  return topPostIds
    .map((id) => postMap.get(id))
    .filter((post): post is LinkedInPost => post !== undefined);
}

