import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdminPin } from '@/lib/supabaseAdmin';
import { minutesToHoursText, sendVkAdminMessage } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function getTopic(comment?: string | null) {
  const firstLine = String(comment || '').split('\n')[0]?.trim() || '';
  return firstLine.startsWith('Тема:') ? firstLine.replace(/^Тема:\s*/, '').trim() : '';
}

function getVolunteerComment(comment?: string | null) {
  return String(comment || '')
    .split('\n')
    .filter((line, index) => !(index === 0 && line.trim().startsWith('Тема:')))
    .join('\n')
    .replace(/^Комментарий:\s*/, '')
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Не выбрана заявка' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .select('*')
      .eq('id', id)
      .single();

    if (assignmentError || !assignment) {
      throw assignmentError || new Error('Заявка не найдена');
    }

    const { data: activity } = await supabaseAdmin
      .from('activities')
      .select('day,title')
      .eq('id', assignment.activity_id)
      .single();

    const topic = getTopic(assignment.volunteer_comment);
    const volunteerComment = getVolunteerComment(assignment.volunteer_comment);
    const message = [
      'Добро.Медиа: заявка из админки',
      '',
      `Волонтёр: ${assignment.volunteer_name}`,
      topic ? `Тема: ${topic}` : null,
      `Активность: ${activity ? `${activity.day} июля — ${activity.title}` : assignment.activity_id}`,
      `Статус: ${assignment.status}`,
      `План: ${minutesToHoursText(assignment.planned_minutes)}`,
      `Факт: ${minutesToHoursText(assignment.spent_minutes)}`,
      assignment.material_link ? `Материал: ${assignment.material_link}` : 'Материал: ссылка не указана',
      volunteerComment ? `Комментарий ребёнка: ${volunteerComment}` : null,
      assignment.admin_comment ? `Комментарий руководителя: ${assignment.admin_comment}` : null
    ].filter(Boolean).join('\n');

    const result = await sendVkAdminMessage(message);
    if (!result.sent) {
      return NextResponse.json({ error: result.error || 'Не удалось отправить сообщение ВКонтакте' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
