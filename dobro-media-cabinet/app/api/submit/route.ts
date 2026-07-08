import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { minutesToHoursText, notifyAdmin } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const assignment_id = String(body.assignment_id || '');
    const spent_minutes = Number(body.spent_minutes || 0);
    const material_url = String(body.material_url || '').trim();
    const volunteer_comment = String(body.volunteer_comment || '').trim();

    if (!assignment_id || !spent_minutes) {
      return NextResponse.json({ error: 'Укажите задание и потраченное время' }, { status: 400 });
    }

    const updatePayload = {
      spent_minutes,
      material_link: material_url,
      volunteer_comment,
      status: 'Материал сдан',
      updated_at: new Date().toISOString()
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(updatePayload)
      .eq('id', assignment_id)
      .select()
      .single();

    if (error) throw error;

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
      `Активность: ${activityTitle}`,
      `Потраченное время: ${minutesToHoursText(spent_minutes)}`,
      material_url ? 'Ссылка на материалы указана в админке.' : 'Ссылка на материалы не указана.',
      volunteer_comment ? `Комментарий: ${volunteer_comment}` : 'Комментарий не указан.',
      '',
      'Материал ждёт проверки в админке.'
    ];

    await notifyAdmin(messageLines.join('\n'));

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
