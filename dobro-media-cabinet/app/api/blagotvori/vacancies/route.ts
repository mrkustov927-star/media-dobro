import { NextResponse } from 'next/server';
import { demoVacancies } from '@/lib/blagotvori/demoVacancies';
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

function normalizeText(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function normalizeTime(value: unknown) {
  return String(value || '').slice(0, 5);
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

function normalizePersonKey(name: string, contact: string) {
  return `${normalizeText(name)}|${String(contact || '').replace(/\s+/g, '').toLocaleLowerCase('ru-RU')}`;
}

function toInitials(name: string) {
  const parts = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
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
          participant_initials: []
        }))
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  }

  try {
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

    const peopleByVacancy = new Map<string, Map<string, string>>();
    for (const application of applications) {
      const people = peopleByVacancy.get(application.vacancy_id) || new Map<string, string>();
      const personKey = normalizePersonKey(application.volunteer_name, application.contact);
      if (!people.has(personKey)) people.set(personKey, toInitials(application.volunteer_name));
      peopleByVacancy.set(application.vacancy_id, people);
    }

    const groups = new Map<string, any[]>();
    for (const vacancy of vacancies || []) {
      const key = vacancyKey(vacancy);
      const group = groups.get(key) || [];
      group.push(vacancy);
      groups.set(key, group);
    }

    const result = Array.from(groups.values()).map(group => {
      const keeper = group[0];
      const people = new Map<string, string>();

      for (const vacancy of group) {
        const vacancyPeople = peopleByVacancy.get(vacancy.id);
        vacancyPeople?.forEach((initials, personKey) => {
          if (!people.has(personKey)) people.set(personKey, initials);
        });
      }

      const initials = Array.from(people.values()).filter(Boolean);
      const occupiedSlots = initials.length;
      const slots = Math.max(...group.map(vacancy => Number(vacancy.slots) || 0), 1);

      return {
        ...keeper,
        slots,
        duties: Array.isArray(keeper.duties) ? keeper.duties : [],
        occupied_slots: occupiedSlots,
        participant_initials: initials,
        free_slots: Math.max(0, slots - occupiedSlots)
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
