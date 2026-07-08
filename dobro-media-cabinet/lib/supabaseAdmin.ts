import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export function requireAdminPin(pin: unknown) {
  const expected = process.env.ADMIN_PIN;
  if (!expected || typeof pin !== 'string' || pin !== expected) {
    throw new Error('Нет доступа администратора');
  }
}
