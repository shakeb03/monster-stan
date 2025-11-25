/**
 * Database client for Supabase Postgres
 * Uses Supabase JS client library for all database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
} from '@/lib/config/env';

let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Gets or creates a Supabase admin client for server-side operations
 * Uses the service role key for elevated permissions
 * This client should only be used on the server side, never exposed to the client
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    const url = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    supabaseAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdminClient;
}

