import { NextResponse } from 'next/server';
import { requireAdminPin } from '@/lib/supabaseAdmin';
import { notifyAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function getClientInfo(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'не определён';

  const userAgent = (request.headers.get('user-agent') || 'не определён')
    .replace(/\s+/g, ' ')
    .slice(0, 220);

  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());

  return { ip, userAgent, time };
}

function buildLoginMessage(
  result: 'success' | 'failure',
  client: ReturnType<typeof getClientInfo>
) {
  const heading = result === 'success'
    ? '✅ Добро.Медиа: успешный вход в админ-панель'
    : '❌ Добро.Медиа: неверный PIN администратора';

  return [
    heading,
    '',
    `Время: ${client.time} (МСК)`,
    `IP: ${client.ip}`,
    `Браузер: ${client.userAgent}`,
    '',
    'Введённый PIN в уведомление не передаётся.'
  ].join('\n');
}

export async function POST(request: Request) {
  const client = getClientInfo(request);

  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    await notifyAdmin(buildLoginMessage('success', client));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    await notifyAdmin(buildLoginMessage('failure', client));
    return NextResponse.json(
      { ok: false, error: error.message || 'Ошибка' },
      { status: 401 }
    );
  }
}
