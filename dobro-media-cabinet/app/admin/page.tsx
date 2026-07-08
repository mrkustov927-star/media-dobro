'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Activity, Assignment, AssignmentStatus } from '@/lib/types';

const statuses: AssignmentStatus[] = ['Взято в работу', 'Материал сдан', 'На доработке', 'Проверено', 'Зачтено', 'Отменено'];
const activityTypes = [
  ['r', 'Важная акция'],
  ['b', 'Тематическое задание'],
  ['d', 'Своя тема']
] as const;

function hoursToMinutes(value: string, fallbackHours = 1) {
  const normalized = String(value || '').replace(',', '.');
  const hours = Number(normalized);
  if (!Number.isFinite(hours) || hours <= 0) return Math.round(fallbackHours * 60);
  return Math.round(hours * 60);
}

function minutesToHours(minutes?: number | null) {
  if (!minutes) return '';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
}

function getAssignmentTopic(assignment: Assignment) {
  const firstLine = String(assignment.volunteer_comment || '').split('\n')[0]?.trim() || '';
  return firstLine.startsWith('Тема:') ? firstLine.replace(/^Тема:\s*/, '').trim() : '';
}

export default function AdminPage() {
  const [pin, setPin] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [message, setMessage] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [assignActivityId, setAssignActivityId] = useState('');
  const [assignName, setAssignName] = useState('');
  const [assignTopic, setAssignTopic] = useState('');
  const [assignHours, setAssignHours] = useState('1');

  async function loadData() {
    await fetch('/api/bootstrap-calendar', { method: 'POST' }).catch(() => null);
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from('activities').select('*').order('sort_order'),
      supabase.from('assignments').select('*').order('created_at', { ascending: false })
    ]);

    const loadedActivities = (a || []) as Activity[];
    setActivities(loadedActivities);
    setAssignments((s || []) as Assignment[]);
    if (!assignActivityId && loadedActivities.length) setAssignActivityId(loadedActivities[0].id);
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

  async function checkPin() {
    setMessage('');
    const res = await fetch('/api/admin/check-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (res.ok) {
      setPinStatus('ok');
      setMessage('Пароль принят. Можно сохранять изменения.');
    } else {
      setPinStatus('bad');
      setMessage('Пароль не принят. Проверьте введённое значение.');
    }
  }

  async function seedCalendar() {
    setMessage('');
    const res = await fetch('/api/admin/seed-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const json = await res.json();
    if (!res.ok) {
      setPinStatus('bad');
      setMessage('Календарь не удалось заполнить. Проверьте пароль администратора.');
    } else {
      setPinStatus('ok');
      setMessage(json.inserted ? 'Календарь на июль заполнен.' : 'Календарь уже заполнен.');
      await loadData();
    }
  }

  async function createAssignment() {
    setMessage('');
    if (!assignActivityId || !assignName.trim()) {
      setMessage('Выберите активность и укажите имя волонтёра.');
      return;
    }
    const res = await fetch('/api/admin/create-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin,
        activity_id: assignActivityId,
        volunteer_name: assignName,
        topic_title: assignTopic,
        planned_minutes: hoursToMinutes(assignHours, 1)
      })
    });
    const json = await res.json();
    if (!res.ok) {
      setPinStatus('bad');
      setMessage(json.error || 'Не удалось назначить активность.');
    } else {
      setPinStatus('ok');
      setMessage('Активность назначена волонтёру.');
      setAssignName('');
      setAssignTopic('');
      setAssignHours('1');
      await loadData();
    }
  }

  async function updateAssignment(id: string, field: string, value: unknown) {
    const current = assignments.find(a => a.id === id);
    if (!current) return;
    setMessage('');
    const payload = {
      pin,
      id,
      status: field === 'status' ? value : current.status,
      spent_minutes: field === 'spent_hours' ? hoursToMinutes(String(value || ''), 1) : current.spent_minutes,
      admin_comment: field === 'admin_comment' ? value : current.admin_comment
    };
    const res = await fetch('/api/admin/update-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      setPinStatus('bad');
      setMessage(json.error || 'Не удалось сохранить изменение.');
    } else {
      setPinStatus('ok');
      setMessage('Изменение сохранено.');
      await loadData();
    }
  }

  async function deleteAssignment(id: string, volunteerName: string) {
    setMessage('');
    const approved = window.confirm(`Удалить назначение для волонтёра «${volunteerName}»? Это действие уберёт запись из кабинета ребят.`);
    if (!approved) return;

    const res = await fetch('/api/admin/delete-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, id })
    });
    const json = await res.json();
    if (!res.ok) {
      setPinStatus('bad');
      setMessage(json.error || 'Не удалось удалить назначение.');
    } else {
      setPinStatus('ok');
      setMessage('Назначенная активность удалена.');
      await loadData();
    }
  }

  async function updateActivity(id: string, field: string, value: unknown) {
    setMessage('');
    const res = await fetch('/api/admin/update-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, id, field, value })
    });
    const json = await res.json();
    if (!res.ok) {
      setPinStatus('bad');
      setMessage(json.error || 'Не удалось сохранить активность.');
    } else {
      setPinStatus('ok');
      setMessage('Активность обновлена.');
      await loadData();
    }
  }

  async function createActivity() {
    setMessage('');
    const res = await fetch('/api/admin/create-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, day: newDay, title: newTitle })
    });
    const json = await res.json();
    if (!res.ok) {
      setPinStatus('bad');
      setMessage(json.error || 'Не удалось добавить активность.');
    } else {
      setPinStatus('ok');
      setMessage('Активность добавлена.');
      setNewDay('');
      setNewTitle('');
      await loadData();
    }
  }

  return <>
    <header className="top"><div className="wrap topin"><a className="brand" href="/"><div className="brand-word">Первые</div><div className="brand-line"/><div className="brand-sub">Добро.Медиа · администратор</div></a><nav className="nav"><a href="/">Кабинет ребят</a></nav></div></header>
    <main>
      <section className="hero"><div className="wrap hero-card"><div><div className="kicker">Админ-панель</div><h1>Живой учёт <span className="red">активностей</span></h1><p className="lead">Здесь можно назначать задания ребятам, удалять ошибочные назначения, менять статусы, время в часах, комментарии и корректировать календарь.</p></div><div className="hero-panel"><h3>Доступ администратора</h3><div className="form"><input className="input" type="password" value={pin} onChange={e => { setPin(e.target.value); setPinStatus('idle'); }} placeholder="Введите пароль"/><button className="btn primary" onClick={checkPin}>Проверить пароль</button></div><p>{pinStatus === 'ok' ? 'Пароль принят.' : pinStatus === 'bad' ? 'Пароль не принят.' : 'Введите пароль администратора.'}</p></div></div></section>

      <section className="section"><div className="wrap">{message && <div className="card"><p><b>{message}</b></p></div>}</div></section>

      <section className="section"><div className="wrap"><div className="head"><h2 className="title">Назначить <span className="red">активность</span></h2><p className="note">Выберите готовое задание из календаря и назначьте его конкретному волонтёру.</p></div><div className="card"><div className="form"><select value={assignActivityId} onChange={e => setAssignActivityId(e.target.value)}><option value="">Выберите активность</option>{activities.map(a => <option key={a.id} value={a.id}>{a.day} июля — {a.title}</option>)}</select><input className="input" value={assignName} onChange={e => setAssignName(e.target.value)} placeholder="ФИО волонтёра"/><input className="input" value={assignTopic} onChange={e => setAssignTopic(e.target.value)} placeholder="Название темы, если это своя тема"/><input className="input" type="number" step="0.5" value={assignHours} onChange={e => setAssignHours(e.target.value)} placeholder="Планируемое время, часы"/><button className="btn primary" onClick={createAssignment}>Назначить</button></div></div></div></section>

      <section className="section"><div className="wrap"><div className="head"><h2 className="title">Заявки <span className="red">волонтёров</span></h2><p className="note">Меняйте статус, затраченное время в часах, комментарий или удаляйте ошибочные назначения.</p></div>{assignments.length === 0 ? <div className="card"><h3>Заявок пока нет</h3><p>Когда ребята возьмут активности или вы назначите задание, записи появятся здесь.</p></div> : <div className="admin-card-list">{assignments.map(a => { const activity = activityById.get(a.activity_id); const topic = getAssignmentTopic(a); return <article className="admin-edit-card" key={a.id}><div className="admin-edit-head"><div><div className="admin-date">{activity ? `${activity.day} июля` : '—'}</div><h3>{activity?.title || 'Активность'}</h3></div><button className="btn danger" onClick={() => deleteAssignment(a.id, a.volunteer_name)}>Удалить</button></div><div className="admin-fields assignment-fields"><label><span>Волонтёр</span><b>{a.volunteer_name}</b>{topic ? <small className="admin-topic">Тема: {topic}</small> : null}<small>План: {minutesToHours(a.planned_minutes) || '—'} ч.</small></label><label><span>Статус</span><select value={a.status} onChange={e => updateAssignment(a.id, 'status', e.target.value)}>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></label><label><span>Факт, часы</span><input className="input" type="number" step="0.5" defaultValue={minutesToHours(a.spent_minutes)} placeholder="Например: 1,5" onBlur={e => updateAssignment(a.id, 'spent_hours', e.target.value)}/></label><label><span>Материал</span>{a.material_link ? <a className="admin-link" href={a.material_link} target="_blank">Открыть материал</a> : <b>—</b>}<small>{a.volunteer_comment}</small></label><label className="wide"><span>Комментарий администратора</span><textarea defaultValue={a.admin_comment || ''} onBlur={e => updateAssignment(a.id, 'admin_comment', e.target.value)} placeholder="Комментарий для ребят"/></label></div></article>; })}</div>}</div></section>

      <section className="section"><div className="wrap"><div className="head"><h2 className="title">Редактировать <span className="red">календарь</span></h2><p className="note">Календарь уже заполнен заданиями. Здесь можно точечно менять формулировки, добавлять новые активности и скрывать лишние.</p></div><div className="card"><h3>Добавить активность</h3><div className="form"><input className="input" value={newDay} onChange={e => setNewDay(e.target.value)} placeholder="Дата июля, например 22 или 22.07"/><input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название активности"/><button className="btn primary" onClick={createActivity}>Добавить</button></div></div><br/>{activities.length === 0 ? <div className="card"><h3>Календарь пока пуст</h3><p>Нажмите кнопку, чтобы добавить стартовые задания на июль.</p><button className="btn primary" onClick={seedCalendar}>Заполнить календарь на июль</button></div> : <div className="admin-card-list calendar-edit-list">{activities.map(a => <article className="admin-edit-card calendar-edit-card" key={a.id}><div className="admin-edit-head"><div><div className="admin-date">{a.day} июля</div><label><span>Название активности</span><input className="input" defaultValue={a.title} onBlur={e => updateActivity(a.id, 'title', e.target.value)}/></label></div><label className="switch-line"><input type="checkbox" defaultChecked={a.is_active} onChange={e => updateActivity(a.id, 'is_active', e.target.checked)}/> Показывать ребятам</label></div><div className="admin-fields calendar-fields"><label><span>Метка</span><input className="input" defaultValue={a.tag} onBlur={e => updateActivity(a.id, 'tag', e.target.value)}/></label><label><span>Вид</span><select defaultValue={a.type} onChange={e => updateActivity(a.id, 'type', e.target.value)}>{activityTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Плановое время, часы</span><input className="input" type="number" step="0.5" defaultValue={minutesToHours(a.estimated_minutes)} onBlur={e => updateActivity(a.id, 'estimated_minutes', hoursToMinutes(e.target.value, 1))} placeholder="ч."/></label><label className="wide"><span>О чём это</span><textarea defaultValue={a.description} onBlur={e => updateActivity(a.id, 'description', e.target.value)} /></label><label className="wide"><span>Твоё задание</span><textarea defaultValue={a.task} onBlur={e => updateActivity(a.id, 'task', e.target.value)} /></label><label className="wide"><span>Как делать</span><textarea defaultValue={a.how_to} onBlur={e => updateActivity(a.id, 'how_to', e.target.value)} /></label><label className="wide"><span>Что собрать</span><textarea defaultValue={a.collect} onBlur={e => updateActivity(a.id, 'collect', e.target.value)} /></label><label className="wide"><span>Что отправить</span><textarea defaultValue={a.send_to_admin} onBlur={e => updateActivity(a.id, 'send_to_admin', e.target.value)} /></label></div></article>)}</div>}</div></section>
    </main>
  </>;
}
