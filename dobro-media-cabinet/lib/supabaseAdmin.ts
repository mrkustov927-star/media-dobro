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

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidUrl(url) || !serviceRoleKey || serviceRoleKey.includes('из Supabase')) {
    throw new Error('Подключение к базе не настроено. Проверьте значения Supabase в Vercel.');
  }

  return createClient(url!, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export function requireAdminPin(pin: unknown) {
  const expected = process.env.ADMIN_PIN?.trim();
  const received = typeof pin === 'string' ? pin.trim() : '';
  if (!expected || received !== expected) {
    throw new Error('Нет доступа администратора');
  }
}
