import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { minutesToHoursText, notifyAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activity_id = String(body.activity_id || '');
    const volunteer_name = String(body.volunteer_name || '').trim();
    const planned_minutes = Number(body.planned_minutes || 60);
    const topic_title = String(body.topic_title || '').trim();

    if (!activity_id || !volunteer_name) {
      return NextResponse.json({ error: 'Укажите активность и имя волонтёра' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .insert({
        activity_id,
        volunteer_name,
        planned_minutes,
        volunteer_comment: topic_title ? `Тема: ${topic_title}` : null,
        status: 'Взято в работу'
      })
      .select()
      .single();

    if (error) throw error;

    const { data: activity } = await supabaseAdmin
      .from('activities')
      .select('day,title')
      .eq('id', activity_id)
      .single();

    await notifyAdmin([
      'Добро.Медиа: активность взята',
      '',
      `Волонтёр: ${volunteer_name}`,
      topic_title ? `Тема: ${topic_title}` : null,
      `Активность: ${activity ? `${activity.day} июля — ${activity.title}` : activity_id}`,
      `Планируемое время: ${minutesToHoursText(planned_minutes)}`,
      '',
      'Проверьте запись в админке.'
    ].filter(Boolean).join('\n'));

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
