import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { initialActivities } from '@/lib/initialActivities';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { count, error: countError } = await supabaseAdmin
      .from('activities')
      .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const { data, error } = await supabaseAdmin
      .from('activities')
      .insert(initialActivities.map(item => ({ ...item, month: 7 })))
      .select('id');

    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: data?.length || 0 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
