import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const REPORT_KEY = '6e1d8a75f0b24f43b6c9e20260727';
const SUBMITTED_STATUSES = new Set([
  'Материал сдан',
  'На доработке',
  'Проверено',
  'Зачтено'
]);

function normalizeName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== REPORT_KEY) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: assignments, error: assignmentsError }, { data: activities, error: activitiesError }] = await Promise.all([
      supabase
        .from('assignments')
        .select('id,activity_id,volunteer_name,status,spent_minutes,material_link,updated_at')
        .order('updated_at', { ascending: true }),
      supabase
        .from('activities')
        .select('id,day,title')
    ]);

    if (assignmentsError) throw assignmentsError;
    if (activitiesError) throw activitiesError;

    const activityMap = new Map((activities || []).map((activity: any) => [activity.id, activity]));
    const submitted = (assignments || []).filter((assignment: any) => {
      const minutes = Number(assignment.spent_minutes || 0);
      const link = String(assignment.material_link || '').trim();
      return SUBMITTED_STATUSES.has(String(assignment.status)) && minutes > 0 && Boolean(link);
    });

    const grouped = new Map<string, any>();
    for (const assignment of submitted as any[]) {
      const displayName = normalizeName(assignment.volunteer_name) || 'Имя не указано';
      const key = displayName.toLocaleLowerCase('ru-RU');
      const activity: any = activityMap.get(assignment.activity_id);
      const minutes = Number(assignment.spent_minutes || 0);
      const current = grouped.get(key) || {
        volunteer_name: displayName,
        total_minutes: 0,
        submitted_count: 0,
        statuses: {},
        activities: []
      };

      current.total_minutes += minutes;
      current.submitted_count += 1;
      current.statuses[assignment.status] = (current.statuses[assignment.status] || 0) + 1;
      current.activities.push({
        day: activity?.day ?? null,
        title: activity?.title || 'Активность не найдена',
        status: assignment.status,
        spent_minutes: minutes,
        updated_at: assignment.updated_at
      });
      grouped.set(key, current);
    }

    const people = Array.from(grouped.values())
      .map((person: any) => ({
        ...person,
        total_hours: Math.round((person.total_minutes / 60) * 100) / 100
      }))
      .sort((a: any, b: any) => b.total_minutes - a.total_minutes || a.volunteer_name.localeCompare(b.volunteer_name, 'ru'));

    const totalMinutes = people.reduce((sum: number, person: any) => sum + person.total_minutes, 0);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      criteria: 'Статус: Материал сдан / На доработке / Проверено / Зачтено; spent_minutes > 0; ссылка на материал указана',
      totals: {
        volunteers: people.length,
        submitted_activities: submitted.length,
        total_minutes: totalMinutes,
        total_hours: Math.round((totalMinutes / 60) * 100) / 100
      },
      people
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Ошибка отчёта' }, { status: 500 });
  }
}
