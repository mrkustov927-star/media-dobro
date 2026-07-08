import { createClient } from '@supabase/supabase-js';

function isValidUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const url = isValidUrl(rawUrl) ? rawUrl! : 'https://example.supabase.co';
const anonKey = rawAnonKey && !rawAnonKey.includes('из Supabase') ? rawAnonKey : 'missing-anon-key';

export const supabase = createClient(url, anonKey);

export const isSupabaseConfigured = Boolean(
  isValidUrl(rawUrl) && rawAnonKey && !rawAnonKey.includes('из Supabase')
);
