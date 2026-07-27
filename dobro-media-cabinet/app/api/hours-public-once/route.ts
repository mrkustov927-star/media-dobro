import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const submittedStatuses = new Set([
  'Материал сдан',
  'На доработке',
  'Проверено',
  'Зачтено'
]);

function surnameFromName(value: unknown) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized.split(' ')[0] || 'Не указана';
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('assignments')
      .select('volunteer_name,status,spent_minutes,material_link');

    if (error) throw error;

    const totals = new Map<string, number>();

    for (const row of data || []) {
      const minutes = Number(row.spent_minutes || 0);
      const link = String(row.material_link || '').trim();
      if (!submittedStatuses.has(String(row.status)) || minutes <= 0 || !link) continue;
      const surname = surnameFromName(row.volunteer_name);
      totals.set(surname, (totals.get(surname) || 0) + minutes);
    }

    const people = Array.from(totals.entries())
      .map(([surname, minutes]) => ({ surname, hours: formatHours(minutes), minutes }))
      .sort((a, b) => b.minutes - a.minutes || a.surname.localeCompare(b.surname, 'ru'))
      .map(({ surname, hours }) => ({ surname, hours }));

    return NextResponse.json(
      { people },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Ошибка' }, { status: 500 });
  }
}
