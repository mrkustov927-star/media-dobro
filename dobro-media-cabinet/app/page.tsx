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

function assignmentLabel(assignment: Assignment) {
  const topic = getAssignmentTopic(assignment);
  return topic ? `${assignment.volunteer_name} — ${topic}` : assignment.volunteer_name;
}

export default function Page() {
  const [activities, setActivities] = useState<Activity[]>(fallbackActivities());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [name, setName] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [planned, setPlanned] = useState('');
  const [submitAssignment, setSubmitAssignment] = useState('');
  const [spent, setSpent] = useState('');
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
  const selectedSubmitAssignment = selectedAssignments.find(a => a.id === submitAssignment);
  const selectedAdminComment = selectedSubmitAssignment?.admin_comment?.trim();
  const selectedIsOwnTopic = selected?.type === 'd';

  async function claimActivity() {
    if (!selected) return;
    setMessage('');
    if (!name.trim()) {
      setMessage('Напиши имя и фамилию, чтобы взять активность.');
      return;
    }
    if (selectedIsOwnTopic && !topicTitle.trim()) {
      setMessage('Напиши название своей темы, например: Игры, Интервью, Летний двор.');
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
      body: JSON.stringify({
        activity_id: selected.id,
        volunteer_name: name,
        topic_title: selectedIsOwnTopic ? topicTitle : '',
        planned_minutes: hoursToMinutes(planned, 1)
      })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось взять активность. Попробуй ещё раз.');
    else {
      setMessage('Активность взята. Теперь она видна всем ребятам.');
      setName('');
      setTopicTitle('');
      setPlanned('');
      await loadData();
    }
  }

  async function sendMaterial() {
    setMessage('');
    if (!submitAssignment) {
      setMessage('Сначала выбери свою запись в списке.');
      return;
    }

    const spentHours = Number(String(spent || '').replace(',', '.'));
    if (!Number.isFinite(spentHours) || spentHours <= 0) {
      setMessage('Укажи потраченное время в часах, например: 1 или 1,5.');
      return;
    }

    if (!materialUrl.trim()) {
      setMessage('Добавь ссылку на материалы: фото, видео или документ.');
      return;
    }

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment_id: submitAssignment,
        spent_minutes: Math.round(spentHours * 60),
        material_url: materialUrl,
        volunteer_comment: comment
      })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Не удалось сдать материал. Попробуй ещё раз.');
    else {
      setMessage('Материал отправлен на проверку Кустову Евгению Валерьевичу.');
      setSubmitAssignment('');
      setMaterialUrl('');
      setComment('');
      setSpent('');
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
              <p className="lead">Информационный и рабочий сайт для ребят, которые хотят попробовать себя в фото, видео, интервью, текстах, монтаже и подготовке материалов о событиях Первых Кемского муниципального округа.</p>
              <div className="actions"><a className="btn primary" href="#calendar">Выбрать задание</a><a className="btn ghost" href="#workflow">Как это устроено</a></div>
              <div className="facts"><div className="fact"><span>Период участия</span><b>8–31 июля 2026</b></div><div className="fact"><span>Формат</span><b>Очно-дистанционный</b></div><div className="fact"><span>Где</span><b>Кемский муниципальный округ</b></div></div>
            </div>
            <div className="hero-panel">
              <h3>Главное правило</h3>
              <p>Ребята самостоятельно снимают репортажи, пишут посты и монтируют короткие ролики. Готовые материалы отправляются Кустову Евгению Валерьевичу на проверку. Самостоятельно ничего не публикуем.</p>
            </div>
          </div>
        </section>

        <section className="section" id="about">
          <div className="wrap">
            <div className="head"><h2 className="title">Что такое <span className="red">Добро.Медиа</span></h2><p className="note">Это медиакоманда, которая помогает рассказывать о людях, событиях, добрых делах и летней жизни Движения Первых в Кемском округе.</p></div>
            <div className="grid3">
              <div className="card"><h3>Замечать важное</h3><p>Находить живые сюжеты: человек, событие, доброе дело, место, настроение, результат.</p></div>
              <div className="card"><h3>Собирать материал</h3><p>Снимать фото и видео, брать короткие комментарии, уточнять факты, готовить черновики постов.</p></div>
              <div className="card"><h3>Работать в команде</h3><p>Брать активности в календаре, видеть, кто что делает, и отправлять материалы на проверку.</p></div>
            </div>
          </div>
        </section>

        <section className="section" id="roles">
          <div className="wrap">
            <div className="head"><h2 className="title">Что можно <span className="red">делать</span></h2><p className="note">Можно выбрать одно направление или пробовать разные роли.</p></div>
            <div className="grid3">
              <div className="card"><h3>Фотограф</h3><p>Снимает общий план, действия, эмоции, детали и финальный кадр.</p></div>
              <div className="card"><h3>Видеограф</h3><p>Снимает короткие фрагменты для клипа или репортажа.</p></div>
              <div className="card"><h3>Интервьюер</h3><p>Задаёт 2–3 простых вопроса и фиксирует настоящие ответы участников.</p></div>
              <div className="card"><h3>Автор поста</h3><p>Собирает факты и пишет понятный, живой и честный текст.</p></div>
              <div className="card"><h3>Монтажёр</h3><p>Собирает короткий ролик: начало, процесс, эмоции, детали, финал.</p></div>
              <div className="card"><h3>Редактор материалов</h3><p>Проверяет, всё ли подписано: дата, место, участники, ссылки, комментарии.</p></div>
            </div>
          </div>
        </section>

        <section className="section" id="workflow">
          <div className="wrap">
            <div className="head"><h2 className="title">Как <span className="red">работаем</span></h2><p className="note">Путь от выбора задания до проверки материала.</p></div>
            <div className="steps">
              <div className="step"><h3>Выбери активность</h3><p>Открой календарь, нажми на дату или задание и прочитай карточку-подсказку.</p></div>
              <div className="step"><h3>Возьми в работу</h3><p>Укажи имя, тему для своего сюжета и планируемое время в часах.</p></div>
              <div className="step"><h3>Собери материал</h3><p>Сними фото, видео, возьми комментарий, уточни дату, место и участников.</p></div>
              <div className="step"><h3>Подготовь черновик</h3><p>Напиши пост или собери короткий ролик. Не придумывай факты и цитаты.</p></div>
              <div className="step"><h3>Сдай на проверку</h3><p>Укажи затраченное время в часах, прикрепи ссылку на материалы и напиши, что получилось.</p></div>
              <div className="step"><h3>Доработай</h3><p>Если будет комментарий, исправь материал и отправь обновлённую версию.</p></div>
            </div>
          </div>
        </section>

        <section className="section" id="calendar">
          <div className="wrap">
            <div className="head"><h2 className="title">Календарь <span className="red">заданий</span></h2><p className="note">Нажми на активность внутри даты: откроется карточка с объяснением, заданием и подсказками.</p></div>
            <div className="calendar-help"><b>Активности начинаются с 8 июля.</b><span>В календаре видно, кто уже взял задание, какую тему выбрал и на каком оно статусе.</span></div>
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
                        return <button className="activity-pill" key={item.id} onClick={() => { setSelected(item); setTopicTitle(''); setMessage(''); }}>
                          <span className={`tag ${item.type}`}>{item.tag}</span>
                          <b>{item.title}</b>
                          <span>{taken.length ? `Взяли: ${taken.map(assignmentLabel).join(', ')}` : 'Свободно'}</span>
                        </button>;
                      })}
                    </div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="templates">
          <div className="wrap">
            <div className="head"><h2 className="title">Шпаргалки <span className="red">медиа-волонтёра</span></h2><p className="note">Одна памятка на весь путь: от идеи и съёмки до текста, проверки и доработки.</p></div>
            <div className="grid3">
              <div className="card"><h3>С чего начать</h3><p>Ответь на вопросы: что произошло, где, когда, кто участвовал, почему это важно и что хочется показать другим.</p></div>
              <div className="card"><h3>Что снять</h3><p>Фото: общий план, действие, эмоции, детали, финальный кадр. Видео: короткие фрагменты по 5–10 секунд, устойчивый телефон, хороший свет и звук.</p></div>
              <div className="card"><h3>Что спросить</h3><p>Что произошло? Что запомнилось? Почему это важно? Что хочется пожелать другим ребятам?</p></div>
            </div><br />
            <div className="grid3">
              <div className="card"><h3>Как писать</h3><p>Пиши просто, доброжелательно и по делу. Покажи пользу, участие ребят, команду, действие и результат.</p></div>
              <div className="card"><h3>Проверь факты</h3><p>Дата, место, имена, название события и цифры должны быть точными. Если сомневаешься — напиши куратору, что нужно уточнить.</p></div>
              <div className="card"><h3>Снимай уважительно</h3><p>Перед съёмкой людей спроси разрешение, особенно для крупного портрета. Не выбирай неудачные кадры, не снимай личные данные и не мешай событию.</p></div>
            </div><br />
            <div className="grid2">
              <div className="check"><h3>Шаблон поста</h3><div className="template">Заголовок:{'\n'}Что произошло:{'\n'}Когда и где:{'\n'}Кто участвовал:{'\n'}Что делали:{'\n'}Почему это важно:{'\n'}Живой момент или цитата:{'\n'}Кого благодарим:{'\n'}Какие фото/видео есть:</div></div>
              <div className="check"><h3>Перед отправкой</h3><ul className="tick-list"><li>Файлы открываются по ссылке.</li><li>Фото и видео подписаны понятно.</li><li>Тема и имя автора указаны.</li><li>Черновик текста приложен или написан в комментарии.</li><li>Вопросы к куратору написаны отдельно.</li></ul></div>
            </div><br />
            <div className="grid3">
              <div className="card"><h3>Не публикуем сами</h3><p>Материалы сначала отправляются на проверку. Публикация возможна только после согласования.</p></div>
              <div className="card"><h3>Не придумываем</h3><p>Факты, имена и цитаты должны быть настоящими. Если не уверен — лучше уточнить.</p></div>
              <div className="card"><h3>Доработка — это нормально</h3><p>Если куратор вернул материал с комментарием, исправь текст, фото или ссылку и отправь обновлённую версию.</p></div>
            </div>
          </div>
        </section>

        <section className="section" id="hashtags">
          <div className="wrap hashtag-box">
            <span>#ДвижениеПервых10</span><span>#ПервыеКемь</span><span>#КемскийОкруг</span>
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
            {selectedAssignments.length ? <div className="modal-block modal-wide"><h4>Кто взял активность</h4><div className="assignments">{selectedAssignments.map(a => {
              const adminComment = a.admin_comment?.trim();
              const topic = getAssignmentTopic(a);
              return <div className={`assignment ${a.status === 'На доработке' ? 'needs-work' : ''}`} key={a.id}>
                <div className="assignment-row"><b>{a.volunteer_name}</b><span className="status">{a.status}</span>{a.spent_minutes ? <span> · {minutesToHours(a.spent_minutes)} ч.</span> : null}</div>
                {topic ? <div className="topic-note"><b>Тема</b><span>{topic}</span></div> : null}
                {adminComment ? <div className="admin-comment"><strong>{a.status === 'На доработке' ? 'Что нужно доработать' : 'Комментарий администратора'}</strong><p>{adminComment}</p></div> : null}
              </div>;
            })}</div></div> : null}
          </div>
          <div className="form">
            <h3>Взять активность</h3>
            <label><b>Имя и фамилия</b><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Например: Иванова Анна" /></label>
            {selectedIsOwnTopic ? <label><b>Название своей темы</b><input className="input" value={topicTitle} onChange={e => setTopicTitle(e.target.value)} placeholder="Например: Игры, интервью, летний двор" /></label> : null}
            <label><b>Планируемое время, часы</b><input className="input" value={planned} onChange={e => setPlanned(e.target.value)} placeholder="Например: 1" type="number" step="0.5" /></label>
            <button className="btn primary" onClick={claimActivity}>Взять активность</button>
          </div>
          <div className="form">
            <h3>Сдать материал</h3>
            <label><b>Кто сдаёт</b><select value={submitAssignment} onChange={e => setSubmitAssignment(e.target.value)}><option value="">Выбери свою запись</option>{selectedAssignments.map(a => <option key={a.id} value={a.id}>{assignmentLabel(a)} — {a.status}</option>)}</select></label>
            {selectedAdminComment ? <div className="revision-note"><b>{selectedSubmitAssignment?.status === 'На доработке' ? 'Нужно доработать' : 'Комментарий администратора'}</b><p>{selectedAdminComment}</p></div> : null}
            <label><b>Потраченное время, часы</b><input className="input" value={spent} onChange={e => setSpent(e.target.value)} placeholder="Например: 1,5" type="number" step="0.5" /></label>
            <label><b>Ссылка на материалы</b><input className="input" value={materialUrl} onChange={e => setMaterialUrl(e.target.value)} placeholder="Обязательно: ссылка на фото, видео или документ" /></label>
            <label><b>Комментарий</b><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Что сделал(а), что приложено, что нужно проверить" /></label>
            <button className="btn primary" onClick={sendMaterial}>Сдать на проверку</button>
          </div>
          {message && <p><b>{message}</b></p>}
        </div>
      </div>}
    </>
  );
}

function Header() {
  return <header className="top"><div className="wrap topin"><a className="brand" href="/"><div className="brand-word">Первые</div><div className="brand-line"/><div className="brand-sub">Добро.Медиа · кабинет медиа-волонтёра</div></a><nav className="nav"><a href="#about">О проекте</a><a href="#roles">Роли</a><a href="#workflow">Как работаем</a><a href="#calendar">Календарь</a><a href="#templates">Шпаргалки</a><a href="/admin">Администратор</a></nav></div></header>;
}
