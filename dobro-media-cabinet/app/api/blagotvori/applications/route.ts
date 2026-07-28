import { NextRequest, NextResponse } from 'next/server';
import { applicationAccessCode } from '@/lib/blagotvori/accessCode';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

function normalizeContact(value: string) {
  const trimmed = value.trim().toLowerCase();
  const digits = trimmed.replace(/\D/g, '');

  // Телефоны сравниваем в едином виде, чтобы +7 911... и 8 911...
  // не считались разными контактами.
  if (digits.length >= 10) {
    const lastTen = digits.slice(-10);
    return `phone:${lastTen}`;
  }

  return trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

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

    const { data: activeApplications, error: applicationsError } = await supabase
      .from('bt_applications')
      .select('id,status,volunteer_name,contact')
      .eq('vacancy_id', vacancyId)
      .not('status', 'in', '("Отменено","Не участвовал")');

    if (applicationsError) throw applicationsError;

    const normalizedName = volunteerName.toLocaleLowerCase('ru-RU');
    const normalizedContact = normalizeContact(contact);
    const duplicate = (activeApplications || []).find(application =>
      String(application.volunteer_name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU') === normalizedName &&
      normalizeContact(String(application.contact || '')) === normalizedContact
    );

    if (duplicate) {
      return NextResponse.json(
        {
          error: 'Вы уже подали заявку на это доброе дело. Сохраните персональный код и проверьте статус в разделе «Мои заявки и часы».',
          duplicate: true,
          status: duplicate.status,
          access_code: applicationAccessCode(String(duplicate.id))
        },
        { status: 409 }
      );
    }

    if ((activeApplications || []).length >= Number(vacancy.slots)) {
      return NextResponse.json({ error: 'Свободных мест уже нет.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('bt_applications')
      .insert({ vacancy_id: vacancyId, volunteer_name: volunteerName, contact })
      .select('id,status')
      .single();

    if (error) throw error;
    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        application: data,
        access_code: applicationAccessCode(String(data.id))
      },
      { status: 201 }
    );
  } catch (error: any) {
    const message = error?.code === '23505'
      ? 'Вы уже подали заявку на это доброе дело.'
      : error?.message || 'Не удалось отправить заявку.';
    return NextResponse.json({ error: message }, { status: error?.code === '23505' ? 409 : 500 });
  }
}
