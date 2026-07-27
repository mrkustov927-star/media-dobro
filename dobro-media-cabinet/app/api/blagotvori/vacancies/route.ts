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

export async function GET() {
  if (!isBlagotvoriConfigured()) {
    return NextResponse.json(
      {
        mode: 'demo',
        vacancies: demoVacancies.map(vacancy => ({
          ...vacancy,
          occupied_slots: Math.max(0, Number(vacancy.slots) - Number(vacancy.free_slots))
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

    let applications: Array<{ vacancy_id: string; status: string }> = [];
    const { data: applicationRows, error: applicationsError } = await supabase
      .from('bt_applications')
      .select('vacancy_id,status')
      .in('status', occupiedStatuses);

    if (!applicationsError && Array.isArray(applicationRows)) {
      applications = applicationRows;
    }

    const counts = new Map<string, number>();
    for (const application of applications) {
      counts.set(application.vacancy_id, (counts.get(application.vacancy_id) || 0) + 1);
    }

    const result = (vacancies || []).map(vacancy => {
      const occupiedSlots = counts.get(vacancy.id) || 0;
      return {
        ...vacancy,
        duties: Array.isArray(vacancy.duties) ? vacancy.duties : [],
        occupied_slots: occupiedSlots,
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
