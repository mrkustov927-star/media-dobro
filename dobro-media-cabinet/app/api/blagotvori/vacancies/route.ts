import { NextResponse } from 'next/server';
import { demoVacancies } from '@/lib/blagotvori/demoVacancies';
import { summerVacancies } from '@/lib/blagotvori/summerVacancies';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const occupiedStatuses = [
  'Заявка подана',
  'Участие подтверждено',
  'В работе',
  'Отчёт отправлен',
  'На доработке',
  'Часы зачтены'
];

let summerSeedPromise: Promise<void> | null = null;

function vacancyKey(title: string, eventDate: string) {
  return `${title.trim()}|${eventDate}`;
}

function ensureSummerVacancies() {
  if (!summerSeedPromise) {
    summerSeedPromise = (async () => {
      const supabase = getBlagotvoriAdmin();
      const titles = summerVacancies.map(item => item.title);
      const { data: existingRows, error: existingError } = await supabase
        .from('bt_vacancies')
        .select('title,event_date')
        .in('title', titles);

      if (existingError) throw existingError;

      const existing = new Set(
        (existingRows || []).map(row => vacancyKey(String(row.title || ''), String(row.event_date || '')))
      );
      const missing = summerVacancies.filter(item => !existing.has(vacancyKey(item.title, item.event_date)));

      if (!missing.length) return;

      const { error: insertError } = await supabase.from('bt_vacancies').insert(missing);
      if (insertError) throw insertError;
    })().catch(error => {
      summerSeedPromise = null;
      throw error;
    });
  }

  return summerSeedPromise;
}

function normalizePersonKey(name: string, contact: string) {
  return `${name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU')}|${contact.replace(/\s+/g, '').toLocaleLowerCase('ru-RU')}`;
}

function normalizeFullName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function toInitials(name: string) {
  const parts = normalizeFullName(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);

  return parts.map(part => `${part.charAt(0).toLocaleUpperCase('ru-RU')}.`).join(' ');
}

export async function GET() {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json(
      {
        mode: 'demo',
        vacancies: demoVacancies.map(vacancy => ({
          ...vacancy,
          occupied_slots: Math.max(0, Number(vacancy.slots) - Number(vacancy.free_slots)),
          participant_initials: [],
          participant_names: []
        }))
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  }

  try {
    try {
      await ensureSummerVacancies();
    } catch (seedError) {
      console.error('Не удалось автоматически добавить летние вакансии:', seedError);
    }

    const supabase = getBlagotvoriAdmin();
    const { data: vacancies, error: vacanciesError } = await supabase
      .from('bt_vacancies')
      .select('*')
      .eq('is_active', true)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (vacanciesError) throw vacanciesError;

    let applications: Array<{ vacancy_id: string; status: string; volunteer_name: string; contact: string }> = [];
    const { data: applicationRows, error: applicationsError } = await supabase
      .from('bt_applications')
      .select('vacancy_id,status,volunteer_name,contact')
      .in('status', occupiedStatuses);

    if (!applicationsError && Array.isArray(applicationRows)) {
      applications = applicationRows;
    }

    const peopleByVacancy = new Map<string, Map<string, { name: string; initials: string }>>();
    for (const application of applications) {
      const people = peopleByVacancy.get(application.vacancy_id) || new Map<string, { name: string; initials: string }>();
      const key = normalizePersonKey(application.volunteer_name, application.contact);
      if (!people.has(key)) {
        people.set(key, {
          name: normalizeFullName(application.volunteer_name),
          initials: toInitials(application.volunteer_name)
        });
      }
      peopleByVacancy.set(application.vacancy_id, people);
    }

    const result = (vacancies || []).map(vacancy => {
      const people = peopleByVacancy.get(vacancy.id) || new Map<string, { name: string; initials: string }>();
      const participants = Array.from(people.values());
      const initials = participants.map(person => person.initials).filter(Boolean);
      const names = participants.map(person => person.name).filter(Boolean);
      const occupiedSlots = participants.length;

      return {
        ...vacancy,
        duties: Array.isArray(vacancy.duties) ? vacancy.duties : [],
        occupied_slots: occupiedSlots,
        participant_initials: initials,
        participant_names: names,
        free_slots: Math.max(0, Number(vacancy.slots) - occupiedSlots)
      };
    });

    return NextResponse.json(
      {
        mode: 'live',
        vacancies: result,
        counts_available: !applicationsError
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Не удалось загрузить вакансии.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
      }
    );
  }
}
