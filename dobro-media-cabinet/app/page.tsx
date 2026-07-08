'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Activity, Assignment } from '@/lib/types';

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const weeks = [
  ['1–5 июля', [null, null, 1, 2, 3, 4, 5]],
  ['6–12 июля', [6, 7, 8, 9, 10, 11, 12]],
  ['13–19 июля', [13, 14, 15, 16, 17, 18, 19]],
  ['20–26 июля', [20, 21, 22, 23, 24, 25, 26]],
  ['27–31 июля', [27, 28, 29, 30, 31, null, null]]
] as const;

export default function Page() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [name, setName] = useState('');
  const [planned, setPlanned] = useState('60');
  const [submitAssignment, setSubmitAssignment] = useState('');
  const [spent, setSpent] = useState('60');
  const [materialUrl, setMaterialUrl] = useState('');
  const [comment, setComment] = useState('');
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
      .channel('dobro-media-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<number, Activity[]>();
    activities.filter(a => a.is_active).forEach(a => {
      const list = map.get(a.day) || [];
      list.push(a);
      map.set(a.day, list);
    });
    return map;
  }, [activities]);

  const selectedAssignments = selected ? assignments.filter(a => a.activity_id === selected.id) : [];

  async function claimActivity() {
    if (!selected) return;
    setMessage('');
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: selected.id, volunteer_name: name, planned_minutes: Number(planned) })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось взять активность');
    else {
      setMessage('Активность взята. Теперь она видна всем ребятам.');
      setName('');
      await loadData();
    }
  }

  async function sendMaterial() {
    setMessage('');
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: submitAssignment, spent_minutes: Number(spent), material_url: materialUrl, volunteer_comment: comment })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось сдать материал');
    else {
      setMessage('Материал отправлен на проверку Кустову Евгению Валерьевичу.');
      setSubmitAssignment('');
      setMaterialUrl('');
      setComment('');
      await loadData();
    }
  }

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="wrap hero-card">
            <div>
              <div className="kicker">Добро.Медиа</div>
              <h1>Кабинет <span className="red">медиа-волонтёра</span></h1>
              <p className="lead">Выбирай активность в календаре, снимай репортаж, пиши пост или монтируй видео. Готовый материал отправляй на проверку Кустову Евгению Валерьевичу.</p>
            </div>
            <div className="hero-panel">
              <h3>Как работать</h3>
              <ol>
                <li>Открой календарь и выбери активность.</li>
                <li>Нажми «Взять активность».</li>
                <li>Сними, напиши или смонтируй материал.</li>
                <li>Сдай материал на проверку.</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="section" id="calendar">
          <div className="wrap">
            <div className="head">
              <h2 className="title">Календарь <span className="red">заданий</span></h2>
              <p className="note">Нажми на активность внутри даты: откроется подсказка, что делать, как делать и что отправить на проверку.</p>
            </div>
            <div className="calendar-help"><b>Активности начинаются с 8 июля.</b><span>Ребята видят, кто уже взял задание и на каком оно статусе.</span></div>
            <div className="calendar">
              <div className="cal-head"><div>Неделя</div>{weekDays.map(d => <div key={d}>{d}</div>)}</div>
              {weeks.map(([label, days]) => (
                <div className="cal-row" key={label}>
                  <div className="week">{label}</div>
                  {days.map((day, idx) => {
                    const list = day ? byDay.get(day) || [] : [];
                    return <div className={day && day >= 8 ? 'day' : 'day muted'} key={idx}>
                      {day && <span className="num">{day}</span>}
                      {list.map(item => {
                        const taken = assignments.filter(a => a.activity_id === item.id);
                        return <button className="activity-pill" key={item.id} onClick={() => { setSelected(item); setMessage(''); }}>
                          <span className={`tag ${item.type}`}>{item.tag}</span>
                          <b>{item.title}</b>
                          <span>{taken.length ? `Взяли: ${taken.map(t => t.volunteer_name).join(', ')}` : 'Свободно'}</span>
                        </button>;
                      })}
                    </div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="manual">
          <div className="wrap">
            <div className="head">
              <h2 className="title">Инструкция <span className="red">для ребят</span></h2>
              <p className="note">Короткая памятка: как снять репортаж, написать пост, смонтировать ролик и отправить всё на проверку.</p>
            </div>
            <div className="grid3">
              <div className="card"><h3>Сними историю</h3><p>Общий план, действие, эмоции, детали и финальный кадр. Лучше 10–15 фото и 5–7 коротких видео.</p></div>
              <div className="card"><h3>Собери факты</h3><p>Дата, место, кто участвовал, что происходило, почему это важно, кого благодарим.</p></div>
              <div className="card"><h3>Отправь на проверку</h3><p>Пост, фото, видео и комментарии отправляй Кустову Евгению Валерьевичу. Самостоятельно не публикуем.</p></div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer"><div className="wrap">Добро.Медиа · Кемский муниципальный округ</div></footer>
      {selected && <div className="modal open">
        <div className="modal-card">
          <div className="modal-top">
            <div><div className="modal-date">{selected.day} июля 2026</div><h3 className="modal-title">{selected.title}</h3></div>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
          </div>
          <div className="modal-body">
            <div className="modal-block"><h4>О чём это</h4><p>{selected.description}</p></div>
            <div className="modal-block"><h4>Твоё задание</h4><p>{selected.task}</p></div>
            <div className="modal-block"><h4>Как делать</h4><p>{selected.how_to}</p></div>
            <div className="modal-block"><h4>Что собрать</h4><p>{selected.collect}</p></div>
            <div className="modal-block modal-wide"><h4>Что отправить</h4><p>{selected.send_to_admin}</p></div>
            <div className="modal-block modal-wide"><h4>Кто взял активность</h4><div className="assignments">{selectedAssignments.length ? selectedAssignments.map(a => <div className="assignment" key={a.id}><b>{a.volunteer_name}</b><span className="status">{a.status}</span>{a.spent_minutes ? <span> · {a.spent_minutes} мин.</span> : null}</div>) : <p>Пока никто не взял. Можно быть первым.</p>}</div></div>
          </div>
          <div className="form">
            <h3>Взять активность</h3>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Твоё имя и фамилия" />
            <input className="input" value={planned} onChange={e => setPlanned(e.target.value)} placeholder="Сколько минут планируешь" type="number" />
            <button className="btn primary" onClick={claimActivity}>Взять активность</button>
          </div>
          <div className="form">
            <h3>Сдать материал</h3>
            <select value={submitAssignment} onChange={e => setSubmitAssignment(e.target.value)}>
              <option value="">Выбери свою запись</option>
              {selectedAssignments.map(a => <option key={a.id} value={a.id}>{a.volunteer_name} — {a.status}</option>)}
            </select>
            <input className="input" value={spent} onChange={e => setSpent(e.target.value)} placeholder="Сколько минут потратил(а)" type="number" />
            <input className="input" value={materialUrl} onChange={e => setMaterialUrl(e.target.value)} placeholder="Ссылка на материалы, если есть" />
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий: что сделал(а), что проверить" />
            <button className="btn primary" onClick={sendMaterial}>Сдать на проверку</button>
          </div>
          {message && <p><b>{message}</b></p>}
        </div>
      </div>}
    </>
  );
}

function Header() {
  return <header className="top"><div className="wrap topin"><a className="brand" href="/"><div className="brand-word">Первые</div><div className="brand-line"/><div className="brand-sub">Добро.Медиа · кабинет медиа-волонтёра</div></a><nav className="nav"><a href="#calendar">Календарь</a><a href="#manual">Инструкция</a><a href="/admin">Администратор</a></nav></div></header>;
}
