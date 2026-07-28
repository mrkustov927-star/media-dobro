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

function normalizeText(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function normalizeTime(value: unknown) {
  return String(value || '').slice(0, 5);
}

function normalizeContact(value: unknown) {
  const trimmed = String(value || '').trim().toLocaleLowerCase('ru-RU');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) return `phone:${digits.slice(-10)}`;
  return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function vacancyKey(vacancy: any) {
  return [
    normalizeText(vacancy.title),
    String(vacancy.event_date || ''),
    normalizeTime(vacancy.start_time),
    normalizeText(vacancy.place),
    normalizeText(vacancy.category)
  ].join('|');
}

function personKey(application: any) {
  return `${normalizeText(application.volunteer_name)}|${normalizeContact(application.contact)}`;
}

const statusRank: Record<string, number> = {
  'Отменено': 0,
  'Не участвовал': 1,
  'Заявка подана': 2,
  'Участие подтверждено': 3,
  'В работе': 4,
  'На доработке': 5,
  'Отчёт отправлен': 6,
  'Часы зачтены': 7
};

function combineText(first: unknown, second: unknown) {
  const values = [String(first || '').trim(), String(second || '').trim()].filter(Boolean);
  return Array.from(new Set(values)).join('\n\n') || null;
}

function mergedApplication(existing: any, incoming: any) {
  const existingRank = statusRank[String(existing.status || '')] ?? 0;
  const incomingRank = statusRank[String(incoming.status || '')] ?? 0;
  const preferred = incomingRank > existingRank ? incoming : existing;
  const other = preferred === existing ? incoming : existing;
  const actualMinutes = Math.max(Number(existing.actual_minutes) || 0, Number(incoming.actual_minutes) || 0);

  return {
    status: preferred.status,
    actual_minutes: actualMinutes || null,
    evidence_url: preferred.evidence_url || other.evidence_url || null,
    evidence_comment: combineText(preferred.evidence_comment, other.evidence_comment),
    admin_comment: combineText(preferred.admin_comment, other.admin_comment),
    hours_confirmed: Boolean(existing.hours_confirmed || incoming.hours_confirmed),
    dobro_hours_entered: Boolean(existing.dobro_hours_entered || incoming.dobro_hours_entered),
    updated_at: new Date().toISOString()
  };
}

async function cleanupDuplicateVacancies(supabase: any) {
  const [{ data: vacancies, error: vacanciesError }, { data: applications, error: applicationsError }] = await Promise.all([
    supabase.from('bt_vacancies').select('*').order('created_at', { ascending: true }),
    supabase.from('bt_applications').select('*').order('created_at', { ascending: true })
  ]);

  if (vacanciesError) throw vacanciesError;
  if (applicationsError) throw applicationsError;

  const vacancyRows: any[] = vacancies || [];
  const applicationRows: any[] = applications || [];
  const groups = new Map<string, any[]>();

  vacancyRows.forEach(vacancy => {
    const key = vacancyKey(vacancy);
    const group = groups.get(key) || [];
    group.push(vacancy);
    groups.set(key, group);
  });

  let removedVacancies = 0;
  let movedApplications = 0;
  let mergedApplications = 0;

  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;

    const countApplications = (vacancyId: string) =>
      applicationRows.filter(application => application.vacancy_id === vacancyId).length;

    const sorted = [...group].sort((left, right) => {
      const applicationDifference = countApplications(right.id) - countApplications(left.id);
      if (applicationDifference) return applicationDifference;
      const activeDifference = Number(Boolean(right.is_active)) - Number(Boolean(left.is_active));
      if (activeDifference) return activeDifference;
      return String(left.created_at || '').localeCompare(String(right.created_at || ''));
    });

    const keeper = sorted[0];
    const keeperApplications = applicationRows.filter(application => application.vacancy_id === keeper.id);

    for (const duplicate of sorted.slice(1)) {
      const duplicateApplications = applicationRows.filter(application => application.vacancy_id === duplicate.id);

      for (const application of duplicateApplications) {
        const samePerson = keeperApplications.find(candidate => personKey(candidate) === personKey(application));

        if (samePerson) {
          const merged = mergedApplication(samePerson, application);
          const { error: mergeError } = await supabase
            .from('bt_applications')
            .update(merged)
            .eq('id', samePerson.id);
          if (mergeError) throw mergeError;

          const { error: deleteApplicationError } = await supabase
            .from('bt_applications')
            .delete()
            .eq('id', application.id);
          if (deleteApplicationError) throw deleteApplicationError;

          Object.assign(samePerson, merged);
          mergedApplications += 1;
        } else {
          const { error: moveError } = await supabase
            .from('bt_applications')
            .update({ vacancy_id: keeper.id, updated_at: new Date().toISOString() })
            .eq('id', application.id);
          if (moveError) throw moveError;

          application.vacancy_id = keeper.id;
          keeperApplications.push(application);
          movedApplications += 1;
        }
      }

      const { error: deleteVacancyError } = await supabase
        .from('bt_vacancies')
        .delete()
        .eq('id', duplicate.id);
      if (deleteVacancyError) throw deleteVacancyError;
      removedVacancies += 1;
    }

    const maxSlots = Math.max(...group.map(vacancy => Number(vacancy.slots) || 1));
    const shouldBeActive = group.some(vacancy => Boolean(vacancy.is_active));
    const { error: keeperError } = await supabase
      .from('bt_vacancies')
      .update({ slots: maxSlots, is_active: shouldBeActive, updated_at: new Date().toISOString() })
      .eq('id', keeper.id);
    if (keeperError) throw keeperError;
  }

  return { removedVacancies, movedApplications, mergedApplications };
}

async function findDuplicateVacancy(supabase: any, payload: any, excludeId?: string) {
  const { data, error } = await supabase
    .from('bt_vacancies')
    .select('id,title,category,event_date,start_time,place')
    .eq('event_date', payload.event_date);

  if (error) throw error;
  const key = vacancyKey(payload);
  return (data || []).find((vacancy: any) => vacancy.id !== excludeId && vacancyKey(vacancy) === key) || null;
}

function vacancyPayload(body: any) {
  const required = ['title', 'category', 'event_date', 'start_time', 'place', 'estimated_minutes', 'slots', 'format', 'confirmation_type', 'confirmation_text', 'description'];
  const missing = required.find(key => body[key] === undefined || body[key] === null || String(body[key]).trim() === '');
  if (missing) throw new Error(`Не заполнено обязательное поле: ${missing}.`);

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
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString()
  };

  if (!Number.isFinite(payload.estimated_minutes) || payload.estimated_minutes <= 0) {
    throw new Error('Количество минут должно быть больше нуля.');
  }
  if (!Number.isInteger(payload.slots) || payload.slots <= 0) {
    throw new Error('Количество мест должно быть целым числом больше нуля.');
  }
  if (payload.min_age && payload.max_age && payload.min_age > payload.max_age) {
    throw new Error('Минимальный возраст не может быть больше максимального.');
  }
  return payload;
}

function errorStatus(error: any) {
  const message = String(error?.message || '');
  if (message.includes('Такая вакансия уже существует')) return 409;
  if (message.startsWith('Не заполнено') || message.includes('возраст') || message.includes('Количество')) return 400;
  return 500;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const supabase = getBlagotvoriAdmin();
    const cleanup = await cleanupDuplicateVacancies(supabase);
    const [{ data: vacancies, error: vacanciesError }, { data: applications, error: applicationsError }] = await Promise.all([
      supabase.from('bt_vacancies').select('*').order('event_date', { ascending: true }).order('start_time', { ascending: true }),
      supabase
        .from('bt_applications')
        .select('*, vacancy:bt_vacancies(id,title,event_date,start_time,estimated_minutes)')
        .order('created_at', { ascending: false })
    ]);

    if (vacanciesError) throw vacanciesError;
    if (applicationsError) throw applicationsError;
    return NextResponse.json({ vacancies: vacancies || [], applications: applications || [], cleanup });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось загрузить кабинет.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const body = await request.json();
    const payload = vacancyPayload(body);
    const supabase = getBlagotvoriAdmin();
    const duplicate = await findDuplicateVacancy(supabase, payload);
    if (duplicate) throw new Error('Такая вакансия уже существует в календаре. Откройте её и внесите изменения через редактирование.');

    const { data, error } = await supabase.from('bt_vacancies').insert(payload).select('*').single();
    if (error) throw error;
    return NextResponse.json({ vacancy: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось создать вакансию.' }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isBlagotvoriConfigured()) return unavailable();

  try {
    const body = await request.json();
    const supabase = getBlagotvoriAdmin();

    if (body.vacancy_id) {
      const vacancyId = String(body.vacancy_id).trim();
      if (!vacancyId) return NextResponse.json({ error: 'Не указана вакансия.' }, { status: 400 });

      if (body.action === 'toggle_active') {
        const { data, error } = await supabase
          .from('bt_vacancies')
          .update({ is_active: Boolean(body.is_active), updated_at: new Date().toISOString() })
          .eq('id', vacancyId)
          .select('*')
          .single();
        if (error) throw error;
        return NextResponse.json({ vacancy: data });
      }

      const payload = vacancyPayload(body);
      const duplicate = await findDuplicateVacancy(supabase, payload, vacancyId);
      if (duplicate) throw new Error('Такая вакансия уже существует в календаре. Измените название, дату, время или место.');

      const { data, error } = await supabase
        .from('bt_vacancies')
        .update(payload)
        .eq('id', vacancyId)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ vacancy: data });
    }

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

    const { data, error } = await supabase
      .from('bt_applications')
      .update(update)
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось сохранить изменения.' }, { status: errorStatus(error) });
  }
}
