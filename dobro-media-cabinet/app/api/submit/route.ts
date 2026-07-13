import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { minutesToHoursText, notifyAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function getTopicFromComment(comment?: string | null) {
  const firstLine = String(comment || '').split('\n')[0]?.trim() || '';
  return firstLine.startsWith('Тема:') ? firstLine.replace(/^Тема:\s*/, '').trim() : '';
}

function buildVolunteerComment(topic: string, comment: string) {
  const lines: string[] = [];
  if (topic) lines.push(`Тема: ${topic}`);
  if (comment) lines.push(topic ? `Комментарий: ${comment}` : comment);
  return lines.join('\n');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const assignment_id = String(body.assignment_id || '');
    const spent_minutes = Number(body.spent_minutes || 0);
    const material_url = String(body.material_url || '').trim();
    const volunteer_comment = String(body.volunteer_comment || '').trim();

    if (!assignment_id) {
      return NextResponse.json({ error: 'Сначала выберите свою запись' }, { status: 400 });
    }

    if (!Number.isFinite(spent_minutes) || spent_minutes <= 0) {
      return NextResponse.json({ error: 'Укажите потраченное время в часах' }, { status: 400 });
    }

    if (!material_url) {
      return NextResponse.json({ error: 'Добавьте ссылку на материалы' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('assignments')
      .select('*')
      .eq('id', assignment_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
    }

    if (existing.status === 'Материал сдан') {
      return NextResponse.json({ data: existing, duplicate: true });
    }

    const topicTitle = getTopicFromComment(existing?.volunteer_comment);
    const savedVolunteerComment = buildVolunteerComment(topicTitle, volunteer_comment);

    const updatePayload = {
      spent_minutes,
      material_link: material_url,
      volunteer_comment: savedVolunteerComment,
      status: 'Материал сдан',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(updatePayload)
      .eq('id', assignment_id)
      .neq('status', 'Материал сдан')
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: current, error: currentError } = await supabaseAdmin
        .from('assignments')
        .select('*')
        .eq('id', assignment_id)
        .maybeSingle();

      if (currentError) throw currentError;
      if (current?.status === 'Материал сдан') {
        return NextResponse.json({ data: current, duplicate: true });
      }

      return NextResponse.json({ error: 'Запись изменилась. Обновите страницу и попробуйте снова.' }, { status: 409 });
    }

    let activityTitle = data?.activity_id || 'не указано';
    if (data?.activity_id) {
      const { data: activity } = await supabaseAdmin
        .from('activities')
        .select('day,title')
        .eq('id', data.activity_id)
        .single();
      if (activity) activityTitle = `${activity.day} июля — ${activity.title}`;
    }

    const messageLines = [
      'Добро.Медиа: материал сдан на проверку',
      '',
      `Волонтёр: ${data?.volunteer_name || 'не указано'}`,
      topicTitle ? `Тема: ${topicTitle}` : null,
      `Активность: ${activityTitle}`,
      `Потраченное время: ${minutesToHoursText(spent_minutes)}`,
      'Ссылка на материалы указана в админке.',
      volunteer_comment ? `Комментарий: ${volunteer_comment}` : 'Комментарий не указан.',
      '',
      'Материал ждёт проверки в админке.'
    ];

    await notifyAdmin(messageLines.filter(Boolean).join('\n'), `submit:${data.id}:${data.updated_at}`);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
