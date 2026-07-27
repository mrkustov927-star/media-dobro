import Link from 'next/link';
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

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours} ч ${rest} мин`;
  if (hours) return `${hours} ч`;
  return `${rest} мин`;
}

export default async function HoursPage() {
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
    .map(([surname, minutes]) => ({ surname, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.surname.localeCompare(b.surname, 'ru'));

  return (
    <main className="wrap section">
      <div className="head">
        <div>
          <p className="kicker">Добро.Медиа</p>
          <h1 className="title">Отработанные часы</h1>
        </div>
        <Link className="btn" href="/">На главную</Link>
      </div>

      <div className="card">
        {people.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Фамилия</th>
                <th>Часы</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.surname}>
                  <td><b>{person.surname}</b></td>
                  <td>{formatTime(person.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Сданных активностей с указанным фактическим временем пока нет.</p>
        )}
      </div>
    </main>
  );
}
