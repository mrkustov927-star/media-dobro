import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activity_id = String(body.activity_id || '');
    const volunteer_name = String(body.volunteer_name || '').trim();
    const planned_minutes = Number(body.planned_minutes || 60);

    if (!activity_id || !volunteer_name) {
      return NextResponse.json({ error: 'Укажите активность и имя волонтёра' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('assignments')
      .insert({
        activity_id,
        volunteer_name,
        planned_minutes,
        status: 'Взято в работу'
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
