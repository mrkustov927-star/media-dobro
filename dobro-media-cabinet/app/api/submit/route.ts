import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
