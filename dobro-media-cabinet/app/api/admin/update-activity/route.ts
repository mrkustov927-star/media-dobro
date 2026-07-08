import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdminPin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const allowedFields = new Set([
  'title',
  'tag',
  'type',
  'description',
  'task',
  'how_to',
  'collect',
  'send_to_admin',
  'estimated_minutes',
  'is_active',
  'sort_order'
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const id = String(body.id || '');
    const field = String(body.field || '');

    if (!id || !allowedFields.has(field)) {
      return NextResponse.json({ error: 'Некорректные данные активности' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {};
    payload[field] = body.value;

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('activities')
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
