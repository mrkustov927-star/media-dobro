import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdminPin } from '@/lib/supabaseAdmin';
import { initialActivities } from '@/lib/initialActivities';

export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as any).message);
  return 'Ошибка';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('activities')
      .select('id')
      .limit(1);

    if (existingError) throw existingError;

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'Календарь уже заполнен.' });
    }

    const { data, error } = await supabaseAdmin
      .from('activities')
      .insert(initialActivities.map(item => ({ ...item, month: 7 })))
      .select('id');

    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: data?.length || 0 });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('seed-calendar failed:', message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
