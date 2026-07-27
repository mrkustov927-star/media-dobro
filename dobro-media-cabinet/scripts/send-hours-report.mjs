import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const emailFrom = process.env.EMAIL_FROM;

if (!url || !serviceRoleKey || !resendKey || !adminEmail || !emailFrom) {
  console.log('Hours report skipped: required environment variables are missing.');
  process.exit(0);
}

const submittedStatuses = new Set([
  'Материал сдан',
  'На доработке',
  'Проверено',
  'Зачтено'
]);

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
});

const [{ data: assignments, error: assignmentsError }, { data: activities, error: activitiesError }] = await Promise.all([
  supabase
    .from('assignments')
    .select('id,activity_id,volunteer_name,status,spent_minutes,material_link,updated_at')
    .order('updated_at', { ascending: true }),
  supabase
    .from('activities')
    .select('id,day,title')
]);

if (assignmentsError) throw assignmentsError;
if (activitiesError) throw activitiesError;

const activityMap = new Map((activities || []).map(activity => [activity.id, activity]));
const submitted = (assignments || []).filter(assignment => {
  const minutes = Number(assignment.spent_minutes || 0);
  const link = String(assignment.material_link || '').trim();
  return submittedStatuses.has(String(assignment.status)) && minutes > 0 && Boolean(link);
});

const peopleMap = new Map();
for (const assignment of submitted) {
  const displayName = String(assignment.volunteer_name || 'Имя не указано').trim().replace(/\s+/g, ' ');
  const key = displayName.toLocaleLowerCase('ru-RU');
  const activity = activityMap.get(assignment.activity_id);
  const minutes = Number(assignment.spent_minutes || 0);
  const person = peopleMap.get(key) || {
    volunteer_name: displayName,
    total_minutes: 0,
    submitted_count: 0,
    statuses: {},
    activities: []
  };

  person.total_minutes += minutes;
  person.submitted_count += 1;
  person.statuses[assignment.status] = (person.statuses[assignment.status] || 0) + 1;
  person.activities.push({
    day: activity?.day ?? null,
    title: activity?.title || 'Активность не найдена',
    status: assignment.status,
    spent_minutes: minutes
  });
  peopleMap.set(key, person);
}

const people = Array.from(peopleMap.values()).sort((a, b) => b.total_minutes - a.total_minutes || a.volunteer_name.localeCompare(b.volunteer_name, 'ru'));
const totalMinutes = people.reduce((sum, person) => sum + person.total_minutes, 0);

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours} ч ${rest} мин`;
  if (hours) return `${hours} ч`;
  return `${rest} мин`;
}

const lines = [
  'ДОБРО.МЕДИА — ОТЧЁТ ПО ФАКТИЧЕСКИ ОТРАБОТАННОМУ ВРЕМЕНИ',
  '',
  'Критерий включения: материал сдан, находится на доработке, проверен или зачтён; указаны фактическое время и ссылка на материал.',
  `Волонтёров: ${people.length}`,
  `Сданных активностей: ${submitted.length}`,
  `Общее время: ${formatMinutes(totalMinutes)}`,
  '',
  ...people.flatMap((person, index) => [
    `${index + 1}. ${person.volunteer_name} — ${formatMinutes(person.total_minutes)}; активностей: ${person.submitted_count}`,
    `   Статусы: ${Object.entries(person.statuses).map(([status, count]) => `${status}: ${count}`).join(', ')}`,
    ...person.activities.map(activity => `   • ${activity.day ? `${activity.day} июля — ` : ''}${activity.title} — ${formatMinutes(activity.spent_minutes)} — ${activity.status}`),
    ''
  ])
];

const subject = `Добро.Медиа — технический отчёт по часам — ${new Date().toISOString()}`;
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${resendKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: emailFrom,
    to: [adminEmail],
    subject,
    text: lines.join('\n')
  })
});

if (!response.ok) {
  const details = await response.text();
  throw new Error(`Resend report failed: ${response.status} ${details}`);
}

console.log(`Hours report sent successfully: ${people.length} volunteers, ${submitted.length} activities, ${totalMinutes} minutes.`);
