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

function isAuthorized(request: NextRequest) {
  return checkBlagotvoriAdminPassword(request.headers.get('x-admin-password'));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const supabase = getBlagotvoriAdmin();
    const [{ data: vacancies, error: vacanciesError }, { data: applications, error: applicationsError }] = await Promise.all([
      supabase.from('bt_vacancies').select('*').order('event_date', { ascending: true }),
      supabase
        .from('bt_applications')
        .select('*, vacancy:bt_vacancies(id,title,event_date,start_time,estimated_minutes)')
        .order('created_at', { ascending: false })
    ]);

    if (vacanciesError) throw vacanciesError;
    if (applicationsError) throw applicationsError;
    return NextResponse.json({ vacancies: vacancies || [], applications: applications || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось загрузить кабинет.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const body = await request.json();
    const required = ['title', 'category', 'event_date', 'start_time', 'place', 'estimated_minutes', 'slots', 'format', 'confirmation_type', 'confirmation_text', 'description'];
    const missing = required.find(key => body[key] === undefined || body[key] === null || String(body[key]).trim() === '');
    if (missing) {
      return NextResponse.json({ error: `Не заполнено обязательное поле: ${missing}.` }, { status: 400 });
    }

    const payload = {
      title: String(body.title).trim(),
      category: String(body.category),
      event_date: String(body.event_date),
      start_time: String(body.start_time),
      end_time: body.end_time ? String(body.end_time) : null,
      place: String(body.place).trim(),
      estimated_minutes: Number(body.estimated_minutes),
      slots: Number(body.slots),
      min_age: body.min_age ? Number(body.min_age) : null,
      max_age: body.max_age ? Number(body.max_age) : null,
      format: String(body.format),
      confirmation_type: String(body.confirmation_type),
      confirmation_text: String(body.confirmation_text).trim(),
      description: String(body.description).trim(),
      duties: Array.isArray(body.duties) ? body.duties.filter(Boolean) : [],
      take_with_you: String(body.take_with_you || 'Ничего специального брать не нужно.').trim(),
      contact_person: body.contact_person ? String(body.contact_person).trim() : null,
      is_active: body.is_active !== false
    };

    if (!Number.isFinite(payload.estimated_minutes) || payload.estimated_minutes <= 0) {
      return NextResponse.json({ error: 'Количество минут должно быть больше нуля.' }, { status: 400 });
    }
    if (!Number.isInteger(payload.slots) || payload.slots <= 0) {
      return NextResponse.json({ error: 'Количество мест должно быть целым числом больше нуля.' }, { status: 400 });
    }

    const supabase = getBlagotvoriAdmin();
    const { data, error } = await supabase.from('bt_vacancies').insert(payload).select('*').single();
    if (error) throw error;
    return NextResponse.json({ vacancy: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось создать вакансию.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const body = await request.json();
    const applicationId = String(body.application_id || '').trim();
    if (!applicationId) {
      return NextResponse.json({ error: 'Не указана заявка.' }, { status: 400 });
    }

    const allowed = [
      'status',
      'actual_minutes',
      'evidence_url',
      'evidence_comment',
      'admin_comment',
      'hours_confirmed',
      'dobro_hours_entered'
    ];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const supabase = getBlagotvoriAdmin();
    const { data, error } = await supabase
      .from('bt_applications')
      .update(update)
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось обновить заявку.' }, { status: 500 });
  }
}
