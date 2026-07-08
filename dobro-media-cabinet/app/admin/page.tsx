'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Activity, Assignment, AssignmentStatus } from '@/lib/types';

const statuses: AssignmentStatus[] = ['Взято в работу','Материал сдан','На доработке','Проверено','Зачтено','Отменено'];

export default function AdminPage() {
  const [pin, setPin] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [message, setMessage] = useState('');

  async function loadData() {
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from('activities').select('*').order('sort_order'),
      supabase.from('assignments').select('*').order('created_at', { ascending: false })
    ]);
    setActivities((a || []) as Activity[]);
    setAssignments((s || []) as Assignment[]);
  }

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('dobro-media-admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const activityById = useMemo(() => new Map(activities.map(a => [a.id, a])), [activities]);

  async function updateAssignment(id: string, field: string, value: any) {
    const current = assignments.find(a => a.id === id);
    if (!current) return;
    setMessage('');
    const payload = {
      pin,
      id,
      status: field === 'status' ? value : current.status,
      spent_minutes: field === 'spent_minutes' ? value : current.spent_minutes,
      admin_comment: field === 'admin_comment' ? value : current.admin_comment
    };
    const res = await fetch('/api/admin/update-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось сохранить');
    else {
      setMessage('Изменение сохранено. Ребята увидят его на сайте.');
      await loadData();
    }
  }

  return <>
    <header className="top"><div className="wrap topin"><a className="brand" href="/"><div className="brand-word">Первые</div><div className="brand-line"/><div className="brand-sub">Добро.Медиа · администратор</div></a><nav className="nav"><a href="/">Кабинет ребят</a></nav></div></header>
    <main>
      <section className="hero"><div className="wrap hero-card"><div><div className="kicker">Админ-панель</div><h1>Живой учёт <span className="red">активностей</span></h1><p className="lead">Здесь Кустов Евгений Валерьевич может менять статусы, фиксировать время и оставлять комментарии. Изменения сразу видны ребятам.</p></div><div className="hero-panel"><h3>Доступ администратора</h3><input className="input" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Введите ADMIN_PIN"/><p>PIN хранится в переменных окружения Vercel и не публикуется в коде.</p></div></div></section>
      <section className="section"><div className="wrap"><div className="head"><h2 className="title">Заявки <span className="red">волонтёров</span></h2><p className="note">Меняйте статус, время и комментарий прямо здесь. Для сохранения нужен PIN администратора.</p></div>{message && <p><b>{message}</b></p>}<div className="admin-grid"><table className="table"><thead><tr><th>Дата / активность</th><th>Волонтёр</th><th>Статус</th><th>Время</th><th>Материал</th><th>Комментарий администратора</th></tr></thead><tbody>{assignments.map(a => { const activity = activityById.get(a.activity_id); return <tr key={a.id}><td><b>{activity ? `${activity.day} июля` : '—'}</b><br/>{activity?.title || 'Активность не найдена'}</td><td>{a.volunteer_name}<br/><small>План: {a.planned_minutes || '—'} мин.</small></td><td><select value={a.status} onChange={e => updateAssignment(a.id, 'status', e.target.value)}>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></td><td><input className="input" type="number" defaultValue={a.spent_minutes || ''} placeholder="мин." onBlur={e => updateAssignment(a.id, 'spent_minutes', e.target.value ? Number(e.target.value) : null)}/></td><td>{a.material_link ? <a href={a.material_link} target="_blank">Открыть</a> : '—'}<br/><small>{a.volunteer_comment}</small></td><td><textarea defaultValue={a.admin_comment || ''} onBlur={e => updateAssignment(a.id, 'admin_comment', e.target.value)} placeholder="Комментарий для ребят"/></td></tr>; })}</tbody></table></div></div></section>
    </main>
  </>;
}
