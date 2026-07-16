import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { minutesToHoursText, notifyAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getMoscowDateParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function isPastActivityDay(day: number) {
  const now = getMoscowDateParts();
  if (now.year > 2026) return true;
  if (now.year < 2026) return false;
  if (now.month > 7) return true;
  if (now.month < 7) return false;
  return now.day > day;
}

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

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ data: existing, duplicate: true });

    const { data: activity, error: activityError } = await supabaseAdmin
      .from('activities')
      .select('day,title,is_active')
      .eq('id', activity_id)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity || !activity.is_active) {
      return NextResponse.json({ error: 'Эта активность сейчас недоступна' }, { status: 409 });
    }

    if (isPastActivityDay(Number(activity.day))) {
      return NextResponse.json({
        error: 'Срок активности прошёл. Новые участники уже не могут взять её, но ранее взятые работы можно продолжать и сдавать.'
      }, { status: 409 });
    }

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
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();

      if (duplicateError) throw duplicateError;
      if (duplicate) return NextResponse.json({ data: duplicate, duplicate: true });
    }

    if (error) throw error;

    await notifyAdmin([
      'Добро.Медиа: активность взята',
      '',
      `Волонтёр: ${volunteer_name}`,
      topic_title ? `Тема: ${topic_title}` : null,
      `Активность: ${activity.day} июля — ${activity.title}`,
      `Планируемое время: ${minutesToHoursText(planned_minutes)}`,
      '',
      'Проверьте запись в админке.'
    ].filter(Boolean).join('\n'), `claim:${data.id}`);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
