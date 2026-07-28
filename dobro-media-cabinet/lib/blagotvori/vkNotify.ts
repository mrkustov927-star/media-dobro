import { sendVkAdminMessage } from '@/lib/notify';

function normalizeSiteUrl(value: string | undefined) {
  return String(value || '').trim().replace(/\/$/, '');
}

export function blagotvoriSiteUrl() {
  const explicit = normalizeSiteUrl(process.env.BLAGOTVORI_SITE_URL);
  if (explicit) return explicit;

  const netlify = normalizeSiteUrl(process.env.URL);
  if (netlify) return netlify;

  const vercel = normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;

  return 'https://blagotvori-kem.netlify.app';
}

export function formatBlagotvoriDate(value: string) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return value || 'дата не указана';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatBlagotvoriTime(value: string | null | undefined) {
  return value ? String(value).slice(0, 5) : 'время не указано';
}

export async function sendBlagotvoriVk(lines: Array<string | null | undefined | false>, eventKey: string) {
  const message = [
    ...lines.filter((line): line is string => Boolean(line)),
    '',
    `Кабинет организатора: ${blagotvoriSiteUrl()}/admin-blagotvori`
  ].join('\n');

  return sendVkAdminMessage(message, `blagotvori:${eventKey}`);
}
