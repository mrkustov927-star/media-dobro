import { NextRequest, NextResponse } from 'next/server';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

export async function POST(request: NextRequest) {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json({ error: 'База БлагоТвори пока не подключена.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const vacancyId = String(body.vacancy_id || '').trim();
    const volunteerName = String(body.volunteer_name || '').trim().replace(/\s+/g, ' ');
    const contact = String(body.contact || '').trim();
    const evidenceUrl = String(body.evidence_url || '').trim();
    const evidenceComment = String(body.evidence_comment || '').trim();

    if (!vacancyId || !volunteerName || !contact || !evidenceComment) {
      return NextResponse.json(
        { error: 'Выберите доброе дело, укажите имя, контакт и расскажите о выполненной работе.' },
        { status: 400 }
      );
    }
    if (evidenceComment.length < 10 || evidenceComment.length > 2000) {
      return NextResponse.json({ error: 'Описание результата должно содержать от 10 до 2000 символов.' }, { status: 400 });
    }
    if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
      return NextResponse.json({ error: 'Ссылка должна начинаться с http:// или https://.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data: application, error: findError } = await supabase
      .from('bt_applications')
      .select('id,status')
      .eq('vacancy_id', vacancyId)
      .ilike('volunteer_name', volunteerName)
      .ilike('contact', contact)
      .not('status', 'in', '("Отменено","Не участвовал")')
      .maybeSingle();

    if (findError) throw findError;
    if (!application) {
      return NextResponse.json(
        { error: 'Заявка не найдена. Проверьте выбранное дело, имя и контакт — они должны совпадать с заявкой.' },
        { status: 404 }
      );
    }
    if (application.status === 'Часы зачтены') {
      return NextResponse.json({ error: 'По этой заявке часы уже зачтены. Изменить отчёт можно через организатора.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('bt_applications')
      .update({
        evidence_url: evidenceUrl || null,
        evidence_comment: evidenceComment,
        status: 'Отчёт отправлен',
        updated_at: new Date().toISOString()
      })
      .eq('id', application.id)
      .select('id,status')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, application: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось отправить отчёт.' }, { status: 500 });
  }
}
