import { NextRequest, NextResponse } from 'next/server';
import {
  checkBlagotvoriAdminPassword,
  isBlagotvoriConfigured
} from '@/lib/blagotvori/supabaseAdmin';
import {
  formatBlagotvoriDate,
  formatBlagotvoriTime,
  sendBlagotvoriVk
} from '@/lib/blagotvori/vkNotify';

function unauthorized() {
  return NextResponse.json({ error: 'Неверный пароль организатора.' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  if (!checkBlagotvoriAdminPassword(request.headers.get('x-admin-password'))) return unauthorized();
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json({ error: 'База БлагоТвори пока не подключена.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const action = String(body.action || '');
    const vacancy = body.vacancy || {};
    const vacancyId = String(vacancy.id || '').trim();
    const title = String(vacancy.title || '').trim();

    if (!vacancyId || !title) {
      return NextResponse.json({ error: 'Не переданы данные вакансии.' }, { status: 400 });
    }

    if (action === 'vacancy_created') {
      const result = await sendBlagotvoriVk(
        [
          '🆕 Опубликована новая вакансия',
          '',
          `Название: ${title}`,
          `Категория: ${vacancy.category || 'не указана'}`,
          `Дата: ${formatBlagotvoriDate(vacancy.event_date)}, ${formatBlagotvoriTime(vacancy.start_time)}`,
          `Место: ${vacancy.place || 'не указано'}`,
          `Количество мест: ${Number(vacancy.slots) || 1}`
        ],
        `vacancy:${vacancyId}:created`
      );

      return NextResponse.json({ ok: true, notification: result });
    }

    if (action === 'vacancy_toggled') {
      const isActive = Boolean(vacancy.is_active);
      const result = await sendBlagotvoriVk(
        [
          isActive ? '🟢 Вакансия снова открыта' : '⚫ Вакансия закрыта',
          '',
          `Название: ${title}`,
          `Дата: ${formatBlagotvoriDate(vacancy.event_date)}, ${formatBlagotvoriTime(vacancy.start_time)}`,
          `Место: ${vacancy.place || 'не указано'}`,
          isActive ? 'Вакансия снова отображается на сайте.' : 'Вакансия скрыта с сайта организатором.'
        ],
        `vacancy:${vacancyId}:active:${isActive}`
      );

      return NextResponse.json({ ok: true, notification: result });
    }

    return NextResponse.json({ error: 'Неизвестный тип уведомления.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Не удалось отправить уведомление ВК.' },
      { status: 500 }
    );
  }
}
