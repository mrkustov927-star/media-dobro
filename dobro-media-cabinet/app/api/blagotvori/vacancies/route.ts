import { NextResponse } from 'next/server';
import { demoVacancies } from '@/lib/blagotvori/demoVacancies';
import { getBlagotvoriAdmin, isBlagotvoriConfigured } from '@/lib/blagotvori/supabaseAdmin';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ mode: 'demo', vacancies: demoVacancies });
  }

  try {
    const supabase = getBlagotvoriAdmin();
    const [{ data: vacancies, error: vacanciesError }, { data: applications, error: applicationsError }] = await Promise.all([
      supabase
        .from('bt_vacancies')
        .select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase
        .from('bt_applications')
        .select('vacancy_id,status')
        .in('status', occupiedStatuses)
    ]);

    if (vacanciesError) throw vacanciesError;
    if (applicationsError) throw applicationsError;

    const counts = new Map<string, number>();
    for (const application of applications || []) {
      counts.set(application.vacancy_id, (counts.get(application.vacancy_id) || 0) + 1);
    }

    const result = (vacancies || []).map(vacancy => ({
      ...vacancy,
      duties: Array.isArray(vacancy.duties) ? vacancy.duties : [],
      free_slots: Math.max(0, Number(vacancy.slots) - (counts.get(vacancy.id) || 0))
    }));

    return NextResponse.json(
      { mode: 'live', vacancies: result },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось загрузить вакансии.' }, { status: 500 });
  }
}
