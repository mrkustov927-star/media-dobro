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

function normalizePersonKey(name: string, contact: string) {
  return `${name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU')}|${contact.replace(/\s+/g, '').toLocaleLowerCase('ru-RU')}`;
}

function toInitials(name: string) {
  const parts = name
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
      const key = normalizePersonKey(application.volunteer_name, application.contact);
      if (!people.has(key)) people.set(key, toInitials(application.volunteer_name));
      peopleByVacancy.set(application.vacancy_id, people);
    }

    const result = (vacancies || []).map(vacancy => {
      const people = peopleByVacancy.get(vacancy.id) || new Map<string, string>();
      const initials = Array.from(people.values()).filter(Boolean);
      const occupiedSlots = initials.length;

      return {
        ...vacancy,
        duties: Array.isArray(vacancy.duties) ? vacancy.duties : [],
        occupied_slots: occupiedSlots,
        participant_initials: initials,
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
