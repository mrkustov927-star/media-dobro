import { NextRequest, NextResponse } from 'next/server';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

function normalizeContact(value: string) {
  const trimmed = value.trim().toLowerCase();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) return `phone:${digits.slice(-10)}`;
  return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

export async function POST(request: NextRequest) {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json({ error: 'Сервис временно недоступен.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const applicationId = String(body.application_id || '').trim();
    const volunteerName = String(body.volunteer_name || '').trim();
    const contact = String(body.contact || '').trim();
    const completionType = String(body.completion_type || '').trim();

    if (!applicationId || !volunteerName || !contact) {
      return NextResponse.json({ error: 'Не удалось определить заявку участника.' }, { status: 400 });
    }

    if (!['attended', 'material'].includes(completionType)) {
      return NextResponse.json({ error: 'Выберите способ выполнения доброго дела.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data: application, error: applicationError } = await supabase
      .from('bt_applications')
      .select('id,volunteer_name,contact,status')
      .eq('id', applicationId)
      .maybeSingle();

    if (applicationError) throw applicationError;
    if (!application) {
      return NextResponse.json({ error: 'Заявка не найдена.' }, { status: 404 });
    }

    const samePerson =
      normalizeName(String(application.volunteer_name || '')) === normalizeName(volunteerName) &&
      normalizeContact(String(application.contact || '')) === normalizeContact(contact);

    if (!samePerson) {
      return NextResponse.json({ error: 'Данные не совпадают с заявкой.' }, { status: 403 });
    }

    if (['Отменено', 'Не участвовал'].includes(String(application.status || ''))) {
      return NextResponse.json({ error: 'Для отменённой заявки нельзя отправить отметку.' }, { status: 409 });
    }

    if (application.status === 'Часы зачтены') {
      return NextResponse.json({
        ok: true,
        application: { id: application.id, status: application.status },
        message: 'Часы по этой заявке уже зачтены.'
      });
    }

    const evidenceComment = completionType === 'attended'
      ? 'Отметка участника: был(а) на мероприятии.'
      : 'Отметка участника: материал сдан.';

    const { data, error } = await supabase
      .from('bt_applications')
      .update({
        status: 'Отчёт отправлен',
        evidence_url: null,
        evidence_comment: evidenceComment,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select('id,status,evidence_comment')
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      application: data,
      message: completionType === 'attended'
        ? 'Организатор увидит, что вы участвовали.'
        : 'Организатор увидит, что материал сдан.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Не удалось отправить отметку.' },
      { status: 500 }
    );
  }
}
