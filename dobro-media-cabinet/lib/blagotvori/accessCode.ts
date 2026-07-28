import { createHmac } from 'crypto';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function secret() {
  const value =
    process.env.BLAGOTVORI_ACCESS_SECRET ||
    process.env.BLAGOTVORI_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.BLAGOTVORI_ADMIN_PASSWORD ||
    '';

  if (!value) throw new Error('Не настроен секрет для кодов заявок.');
  return value;
}

export function normalizeApplicationAccessCode(value: unknown) {
  return String(value || '')
    .toLocaleUpperCase('ru-RU')
    .replace(/[^A-Z2-9]/g, '');
}

export function applicationAccessCode(applicationId: string) {
  const digest = createHmac('sha256', secret())
    .update(`blagotvori-application:${applicationId}`)
    .digest();

  const symbols = Array.from({ length: 12 }, (_, index) => alphabet[digest[index] & 31]).join('');
  return `${symbols.slice(0, 4)}-${symbols.slice(4, 8)}-${symbols.slice(8, 12)}`;
}

export function applicationAccessCodeMatches(applicationId: string, value: unknown) {
  return normalizeApplicationAccessCode(applicationAccessCode(applicationId)) === normalizeApplicationAccessCode(value);
}
