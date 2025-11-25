/**
 * PostEmbedding type matching the post_embeddings table schema from DOC 02
 * The embedding field uses pgvector vector type
 */

export type PostEmbedding = {
  id: string; // PK
  post_id: string; // FK → linkedin_posts.id
  user_id: string; // FK → users.id
  embedding: number[]; // vector type from pgvector (stored as array of numbers)
  created_at: string; // timestamp
};

