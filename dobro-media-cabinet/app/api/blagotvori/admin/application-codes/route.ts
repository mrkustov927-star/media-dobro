import { NextRequest, NextResponse } from 'next/server';
import { applicationAccessCode } from '@/lib/blagotvori/accessCode';
import {
  checkBlagotvoriAdminPassword,
  getBlagotvoriAdmin,
  isBlagotvoriConfigured
} from '@/lib/blagotvori/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!checkBlagotvoriAdminPassword(request.headers.get('x-admin-password'))) {
    return NextResponse.json({ error: 'Неверный пароль организатора.' }, { status: 401 });
  }

  if (!isBlagotvoriConfigured()) {
    return NextResponse.json({ error: 'Отдельная база БлагоТвори пока не подключена.' }, { status: 503 });
  }

  try {
    const supabase = getBlagotvoriAdmin();
    const [{ data: vacancies, error: vacanciesError }, { data: applications, error: applicationsError }] = await Promise.all([
      supabase
        .from('bt_vacancies')
        .select('id,title,event_date,start_time,slots')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase
        .from('bt_applications')
        .select('id,vacancy_id,volunteer_name,contact,status')
        .order('created_at', { ascending: false })
    ]);

    if (vacanciesError) throw vacanciesError;
    if (applicationsError) throw applicationsError;

    return NextResponse.json(
      {
        vacancies: vacancies || [],
        applications: (applications || []).map(application => ({
          ...application,
          access_code: applicationAccessCode(String(application.id))
        }))
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Не удалось загрузить коды заявок.' }, { status: 500 });
  }
}
