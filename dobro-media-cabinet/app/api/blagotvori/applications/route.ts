import { NextRequest, NextResponse } from 'next/server';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

export async function POST(request: NextRequest) {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json(
      { error: 'Новая база ещё не подключена. Заявка не сохранена.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const vacancyId = String(body.vacancy_id || '').trim();
    const volunteerName = String(body.volunteer_name || '').trim().replace(/\s+/g, ' ');
    const contact = String(body.contact || '').trim();

    if (!vacancyId || !volunteerName || !contact) {
      return NextResponse.json({ error: 'Заполни имя, контакт и выбери вакансию.' }, { status: 400 });
    }

    if (volunteerName.length < 4 || volunteerName.length > 120) {
      return NextResponse.json({ error: 'Проверь имя и фамилию.' }, { status: 400 });
    }

    if (contact.length < 4 || contact.length > 200) {
      return NextResponse.json({ error: 'Проверь контакт для связи.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data: vacancy, error: vacancyError } = await supabase
      .from('bt_vacancies')
      .select('id,slots,is_active,event_date')
      .eq('id', vacancyId)
      .maybeSingle();

    if (vacancyError) throw vacancyError;
    if (!vacancy || !vacancy.is_active) {
      return NextResponse.json({ error: 'Эта вакансия больше недоступна.' }, { status: 404 });
    }

    const { count, error: countError } = await supabase
      .from('bt_applications')
      .select('id', { count: 'exact', head: true })
      .eq('vacancy_id', vacancyId)
      .not('status', 'in', '("Отменено","Не участвовал")');

    if (countError) throw countError;
    if ((count || 0) >= Number(vacancy.slots)) {
      return NextResponse.json({ error: 'Свободных мест уже нет.' }, { status: 409 });
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from('bt_applications')
      .select('id,status')
      .eq('vacancy_id', vacancyId)
      .ilike('volunteer_name', volunteerName)
      .ilike('contact', contact)
      .not('status', 'in', '("Отменено","Не участвовал")')
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, status: duplicate.status });
    }

    const { data, error } = await supabase
      .from('bt_applications')
      .insert({ vacancy_id: vacancyId, volunteer_name: volunteerName, contact })
      .select('id,status')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, duplicate: false, application: data }, { status: 201 });
  } catch (error: any) {
    const message = error?.code === '23505'
      ? 'Такая заявка уже отправлена.'
      : error?.message || 'Не удалось отправить заявку.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
