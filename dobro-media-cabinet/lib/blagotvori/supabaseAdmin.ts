import { createClient } from '@supabase/supabase-js';

export function isBlagotvoriConfigured() {
  return Boolean(
    process.env.BLAGOTVORI_SUPABASE_URL &&
    process.env.BLAGOTVORI_SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getBlagotvoriAdmin() {
  const url = process.env.BLAGOTVORI_SUPABASE_URL;
  const serviceRoleKey = process.env.BLAGOTVORI_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Отдельная база БлагоТвори пока не подключена.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function checkBlagotvoriAdminPassword(value: string | null) {
  const expected = process.env.BLAGOTVORI_ADMIN_PASSWORD;
  return Boolean(expected && value && value === expected);
}
