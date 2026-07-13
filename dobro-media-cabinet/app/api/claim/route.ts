import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { minutesToHoursText, notifyAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activity_id = String(body.activity_id || '');
    const volunteer_name = String(body.volunteer_name || '').trim();
    const planned_minutes = Number(body.planned_minutes || 60);
    const topic_title = String(body.topic_title || '').trim();
    const request_id = String(body.request_id || '').trim();

    if (!activity_id || !volunteer_name) {
      return NextResponse.json({ error: 'Укажите активность и имя волонтёра' }, { status: 400 });
    }

    if (!UUID_PATTERN.test(request_id)) {
      return NextResponse.json({ error: 'Обновите страницу перед отправкой заявки' }, { status: 409 });
    }

    const assignmentId = request_id;
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .insert({
        id: assignmentId,
        activity_id,
        volunteer_name,
        planned_minutes,
        volunteer_comment: topic_title ? `Тема: ${topic_title}` : null,
        status: 'Взято в работу'
      })
      .select()
      .single();

    if (error?.code === '23505') {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return NextResponse.json({ data: existing, duplicate: true });
    }

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
    ].filter(Boolean).join('\n'), `claim:${data.id}`);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
