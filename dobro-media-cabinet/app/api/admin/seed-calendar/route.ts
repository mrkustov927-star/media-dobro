import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdminPin } from '@/lib/supabaseAdmin';
import { initialActivities } from '@/lib/initialActivities';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireAdminPin(body.pin);

    const supabaseAdmin = getSupabaseAdmin();
    const { count, error: countError } = await supabaseAdmin
      .from('activities')
      .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'Календарь уже заполнен.' });
    }

    const { data, error } = await supabaseAdmin
      .from('activities')
      .insert(initialActivities.map(item => ({ ...item, month: 7 })))
      .select('id');

    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: data?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Ошибка' }, { status: 500 });
  }
}
