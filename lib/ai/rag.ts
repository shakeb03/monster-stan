/**
 * RAG service for retrieving relevant posts using vector similarity
 */

import { getDatabaseClient, queryDatabase } from '@/lib/db';
import type { LinkedInPost } from '@/lib/types';


/**
 * Retrieves top N relevant posts using vector similarity search
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  const openai = new OpenAI({ apiKey });
  
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText,
  });
  
  if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
    throw new Error('Failed to generate embedding for query');
  }
  
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Convert embedding to string format for pgvector
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const client = await getDatabaseClient();
  try {
    // Use cosine distance to find most relevant posts
    // pgvector <=> operator returns cosine distance (lower is more similar)
    // We'll order by distance ascending to get most similar first
    const result = await client.query<LinkedInPost & { distance: number }>(
      `SELECT 
        lp.*,
        pe.embedding <=> $1::vector as distance
       FROM post_embeddings pe
       JOIN linkedin_posts lp ON pe.post_id = lp.id
       WHERE pe.user_id = $2
       ORDER BY pe.embedding <=> $1::vector ASC
       LIMIT $3`,
      [embeddingString, userId, topK]
    );

    // Return posts (distance is just for ordering, we don't need it in the result)
    return result.rows.map(({ distance, ...post }) => post);
  } finally {
    client.release();
  }
}

