import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ''
  );
}

function resolveServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();

  if (!supabaseUrl) {
    throw new Error(
      'Supabase URL is missing. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) in backend environment.',
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing in backend environment.',
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
}