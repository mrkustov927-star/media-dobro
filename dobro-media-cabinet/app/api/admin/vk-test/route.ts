import { NextResponse } from 'next/server';
import { requireAdminPin } from '@/lib/supabaseAdmin';
import { sendVkAdminMessage } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const result = await sendVkAdminMessage([
      'Добро.Медиа: тестовое уведомление ВКонтакте',
      '',
      'Связь сайта с сообщениями сообщества работает.',
      'Теперь сюда будут приходить уведомления о действиях ребят.'
    ].join('\n'));

    if (!result.sent) {
      return NextResponse.json({ error: result.error || 'Не удалось отправить сообщение ВКонтакте' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
