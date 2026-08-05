import { NextRequest, NextResponse } from 'next/server';
import {
  checkBlagotvoriAdminPassword,
  getBlagotvoriAdmin,
  isBlagotvoriConfigured
} from '@/lib/blagotvori/supabaseAdmin';

function unauthorized() {
  return NextResponse.json({ error: 'Неверный пароль организатора.' }, { status: 401 });
}

function unavailable() {
  return NextResponse.json({ error: 'Отдельная база БлагоТвори пока не подключена.' }, { status: 503 });
}

export async function DELETE(request: NextRequest) {
  if (!checkBlagotvoriAdminPassword(request.headers.get('x-admin-password'))) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const body = await request.json();
    const vacancyId = String(body.vacancy_id || '').trim();
    const deleteApplications = body.delete_applications === true;

    if (!vacancyId) {
      return NextResponse.json({ error: 'Не указана активность для удаления.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data: vacancy, error: vacancyError } = await supabase
      .from('bt_vacancies')
      .select('id,title')
      .eq('id', vacancyId)
      .maybeSingle();

    if (vacancyError) throw vacancyError;
    if (!vacancy) {
      return NextResponse.json({ error: 'Активность уже удалена или не найдена.' }, { status: 404 });
    }

    const { count: applicationCount, error: countError } = await supabase
      .from('bt_applications')
      .select('id', { count: 'exact', head: true })
      .eq('vacancy_id', vacancyId);

    if (countError) throw countError;
    const relatedCount = applicationCount || 0;

    if (relatedCount > 0 && !deleteApplications) {
      return NextResponse.json(
        {
          error: 'У активности есть связанные заявки или отчёты.',
          requires_confirmation: true,
          application_count: relatedCount,
          vacancy_title: vacancy.title
        },
        { status: 409 }
      );
    }

    if (relatedCount > 0) {
      const { error: applicationsError } = await supabase
        .from('bt_applications')
        .delete()
        .eq('vacancy_id', vacancyId);
      if (applicationsError) throw applicationsError;
    }

    const { error: deleteError } = await supabase
      .from('bt_vacancies')
      .delete()
      .eq('id', vacancyId);
    if (deleteError) throw deleteError;

    return NextResponse.json({
      ok: true,
      deleted_vacancy: vacancy.title,
      deleted_applications: relatedCount
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Не удалось удалить активность.' },
      { status: 500 }
    );
  }
}
