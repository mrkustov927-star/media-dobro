import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdminPin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const id = String(body.id || '');
    if (!id) {
      return NextResponse.json({ error: 'Не указан ID записи' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      status: body.status,
      spent_minutes: body.spent_minutes === '' ? null : body.spent_minutes,
      admin_comment: body.admin_comment || null,
      updated_at: new Date().toISOString()
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка' }, { status: 500 });
  }
}
