import { NextResponse } from 'next/server';
import { requireAdminPin, supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const day = Number(body.day || 0);
    const title = String(body.title || '').trim();

    if (!day || !title) {
      return NextResponse.json({ error: 'Укажите дату и название активности' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('activities')
      .insert({
        day,
        title,
        month: 7,
        tag: body.tag || 'Своя тема',
        type: body.type || 'd',
        description: body.description || 'Краткое описание активности.',
        task: body.task || 'Выполни задание по теме и подготовь материал.',
        how_to: body.how_to || 'Сними фото или видео, собери факты и подготовь черновик.',
        collect: body.collect || 'Фото, видео, дата, место, краткое описание.',
        send_to_admin: body.send_to_admin || 'Отправь материалы Кустову Евгению Валерьевичу на проверку.',
        estimated_minutes: Number(body.estimated_minutes || 60),
        sort_order: Number(body.sort_order || day * 10),
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
