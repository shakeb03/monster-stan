-- Database schema for Monster Stan
-- Based on DOC 02: Data Model & Database Schema
-- Run this in Supabase SQL Editor

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- matches Clerk ID
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: user_profile
CREATE TYPE onboarding_status_enum AS ENUM (
  'linkedin_url_pending',
  'scraping_in_progress',
  'analysis_in_progress',
  'ready',
  'error'
);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  linkedin_url TEXT,
  onboarding_status onboarding_status_enum NOT NULL DEFAULT 'linkedin_url_pending',
  goals_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: linkedin_profiles
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT,
  about TEXT,
  location TEXT,
  experience_json JSONB,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: linkedin_posts
CREATE TABLE IF NOT EXISTS linkedin_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT, -- cleaned text
  raw_text TEXT,
  posted_at TIMESTAMPTZ,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  impressions_count INTEGER,
  engagement_score NUMERIC NOT NULL DEFAULT 0,
  is_high_performing BOOLEAN NOT NULL DEFAULT false,
  topic_hint TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: post_embeddings
CREATE TABLE IF NOT EXISTS post_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES linkedin_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL, -- OpenAI embeddings are typically 1536 dimensions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: style_profiles
CREATE TYPE data_confidence_level_enum AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW'
);

CREATE TABLE IF NOT EXISTS style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  style_json JSONB,
  data_confidence_level data_confidence_level_enum NOT NULL DEFAULT 'LOW',
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: chats
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Table: chat_messages
CREATE TYPE chat_message_role_enum AS ENUM (
  'user',
  'assistant',
  'system'
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- nullable for assistant messages
  role chat_message_role_enum NOT NULL,
  content TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: long_term_memory
CREATE TYPE summary_type_enum AS ENUM (
  'persona',
  'goals',
  'content_strategy',
  'past_wins',
  'other'
);

CREATE TABLE IF NOT EXISTS long_term_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary_type summary_type_enum NOT NULL,
  content JSONB NOT NULL, -- can store text or JSON
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_user_id ON linkedin_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_posted_at ON linkedin_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_post_embeddings_post_id ON post_embeddings(post_id);
CREATE INDEX IF NOT EXISTS idx_post_embeddings_user_id ON post_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_user_id ON style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_is_active ON chats(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memory_user_id ON long_term_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memory_summary_type ON long_term_memory(summary_type);

-- Create vector index for similarity search on embeddings
CREATE INDEX IF NOT EXISTS idx_post_embeddings_embedding ON post_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

