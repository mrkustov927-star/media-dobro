'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { initialActivities } from '@/lib/initialActivities';
import type { Activity, Assignment } from '@/lib/types';

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const weeks = [
  ['1–5 июля', [null, null, 1, 2, 3, 4, 5]],
  ['6–12 июля', [6, 7, 8, 9, 10, 11, 12]],
  ['13–19 июля', [13, 14, 15, 16, 17, 18, 19]],
  ['20–26 июля', [20, 21, 22, 23, 24, 25, 26]],
  ['27–31 июля', [27, 28, 29, 30, 31, null, null]]
] as const;

function fallbackActivities(): Activity[] {
  return initialActivities.map((item, index) => ({
    id: `start-${item.day}-${index}`,
    month: 7,
    title: item.title,
    day: item.day,
    tag: item.tag,
    type: item.type as Activity['type'],
    description: item.description,
    task: item.task,
    how_to: item.how_to,
    collect: item.collect,
    send_to_admin: item.send_to_admin,
    estimated_minutes: item.estimated_minutes,
    is_active: item.is_active,
    sort_order: item.sort_order
  }));
}

export default function Page() {
  const [activities, setActivities] = useState<Activity[]>(fallbackActivities());
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
    await fetch('/api/bootstrap-calendar', { method: 'POST' }).catch(() => null);
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from('activities').select('*').order('sort_order'),
      supabase.from('assignments').select('*').order('created_at', { ascending: false })
    ]);
    setActivities(((a && a.length) ? a : fallbackActivities()) as Activity[]);
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
    if (!name.trim()) {
      setMessage('Напиши имя и фамилию, чтобы взять активность.');
      return;
    }
    if (selected.id.startsWith('start-')) {
      await loadData();
      setMessage('Календарь обновляется. Открой активность ещё раз и нажми кнопку повторно.');
      return;
    }
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: selected.id, volunteer_name: name, planned_minutes: Number(planned) })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось взять активность. Попробуй ещё раз.');
    else {
      setMessage('Активность взята. Теперь она видна всем ребятам.');
      setName('');
      await loadData();
    }
  }

  async function sendMaterial() {
    setMessage('');
    if (!submitAssignment) {
      setMessage('Сначала выбери свою запись в списке.');
      return;
    }
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: submitAssignment, spent_minutes: Number(spent), material_url: materialUrl, volunteer_comment: comment })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось сдать материал. Попробуй ещё раз.');
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
              <p className="lead">Здесь ты выбираешь задание, снимаешь репортаж, пишешь пост или монтируешь короткое видео. Готовый материал отправляется на проверку Кустову Евгению Валерьевичу.</p>
            </div>
            <div className="hero-panel">
              <h3>Как всё работает</h3>
              <ol>
                <li>Открой календарь и выбери активность.</li>
                <li>Прочитай подсказку и нажми «Взять активность».</li>
                <li>Сними фото, видео, собери факты и комментарии.</li>
                <li>Напиши пост или смонтируй ролик.</li>
                <li>Сдай материал на проверку.</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="section" id="calendar">
          <div className="wrap">
            <div className="head">
              <h2 className="title">Календарь <span className="red">заданий</span></h2>
              <p className="note">Нажми на активность внутри даты: откроется карточка с объяснением, заданием и подсказками.</p>
            </div>
            <div className="calendar-help"><b>Активности начинаются с 8 июля.</b><span>В календаре видно, кто уже взял задание и на каком оно статусе.</span></div>
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
              <p className="note">Памятка для самостоятельной работы: что снять, как написать, как смонтировать и что отправить.</p>
            </div>
            <div className="grid3">
              <div className="card"><h3>1. Разберись в событии</h3><p>Ответь на вопросы: что произошло, где, когда, кто участвовал, почему это важно и что хочется показать другим.</p></div>
              <div className="card"><h3>2. Сними историю</h3><p>Нужны общий план, участники в действии, эмоции, детали и финальный кадр. Хороший репортаж — это маленькая история.</p></div>
              <div className="card"><h3>3. Собери факты</h3><p>Запиши дату, место, участников, главное действие, результат, благодарности и реальные комментарии.</p></div>
            </div>
            <br />
            <div className="grid3">
              <div className="card"><h3>Фото</h3><p>Сними 10–15 кадров: место, действие, эмоции, детали, общий финальный кадр. Удали размытые и неудачные фото.</p></div>
              <div className="card"><h3>Видео</h3><p>Снимай короткими фрагментами по 5–10 секунд. Держи телефон устойчиво. Для клипов чаще подходит вертикальный формат.</p></div>
              <div className="card"><h3>Интервью</h3><p>Задай 2–3 простых вопроса: что запомнилось, почему это важно, какое настроение, что хочется пожелать другим.</p></div>
            </div>
            <br />
            <div className="grid3">
              <div className="card"><h3>Пост</h3><p>Структура: что произошло, где и когда, кто участвовал, что делали, почему это важно, живой момент, благодарность.</p></div>
              <div className="card"><h3>Монтаж</h3><p>Ролик лучше делать 20–40 секунд: сильный первый кадр, процесс, эмоции, детали и финал. Не перегружай эффектами.</p></div>
              <div className="card"><h3>Отправка</h3><p>Прикрепи пост, фото, видео, комментарии и ссылку на материалы. Всё отправляется Кустову Евгению Валерьевичу на проверку.</p></div>
            </div>
          </div>
        </section>

        <section className="section" id="rules">
          <div className="wrap">
            <div className="head">
              <h2 className="title">Правила <span className="red">медиа-волонтёра</span></h2>
              <p className="note">Мы рассказываем о людях уважительно, честно и аккуратно.</p>
            </div>
            <div className="grid3">
              <div className="card"><h3>Не публикуем сами</h3><p>Материалы сначала отправляются на проверку. Публикация возможна только после согласования.</p></div>
              <div className="card"><h3>Не придумываем</h3><p>Факты, имена и цитаты должны быть настоящими. Если не уверен — лучше уточнить.</p></div>
              <div className="card"><h3>Снимаем уважительно</h3><p>Не используем неудачные фото людей, не снимаем слишком близко без согласия и не публикуем личные данные.</p></div>
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
  return <header className="top"><div className="wrap topin"><a className="brand" href="/"><div className="brand-word">Первые</div><div className="brand-line"/><div className="brand-sub">Добро.Медиа · кабинет медиа-волонтёра</div></a><nav className="nav"><a href="#calendar">Календарь</a><a href="#manual">Инструкция</a><a href="#rules">Правила</a></nav></div></header>;
}
