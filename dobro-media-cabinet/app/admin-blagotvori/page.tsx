'use client';

import { FormEvent, useState } from 'react';
import styles from './admin.module.css';
import type { ApplicationStatus, VacancyCategory } from '@/lib/blagotvori/types';

type AdminVacancy = {
  id: string; title: string; category: VacancyCategory; event_date: string;
  start_time: string; end_time: string | null; place: string;
  estimated_minutes: number; slots: number; min_age: number | null;
  max_age: number | null; format: string; confirmation_type: string;
  confirmation_text: string; description: string; duties: string[];
  take_with_you: string; contact_person: string | null; is_active: boolean;
};

type AdminApplication = {
  id: string; volunteer_name: string; contact: string; status: ApplicationStatus;
  actual_minutes: number | null; evidence_url: string | null; evidence_comment: string | null;
  admin_comment: string | null; hours_confirmed: boolean; dobro_hours_entered: boolean;
  vacancy: { id: string; title: string; event_date: string; start_time: string; estimated_minutes: number } | null;
};

const categories: VacancyCategory[] = ['Помощь людям','Природа и животные','Помощь на мероприятиях','Медиа','Дистанционные задания'];
const statuses: ApplicationStatus[] = ['Заявка подана','Участие подтверждено','В работе','Отчёт отправлен','На доработке','Часы зачтены','Отменено','Не участвовал'];
const confirmationTypes = ['Подтверждение организатора','Ссылка на материал','Фото результата','Ссылка или файл'];
const categoryIcons: Record<VacancyCategory, string> = {
  'Помощь людям': '♥', 'Природа и животные': '●', 'Помощь на мероприятиях': '◆', 'Медиа': '◉', 'Дистанционные задания': '⌁'
};

function hoursToMinutes(value: string) {
  const hours = Number(value.replace(',', '.'));
  return Number.isFinite(hours) ? Math.round(hours * 60) : 0;
}
function minutesToHours(value: number | null) {
  if (!value) return '';
  const hours = value / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
}
function formatDate(value: string) {
  const [y,m,d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(Date.UTC(y,m-1,d)));
}
function formPayload(data: FormData) {
  return {
    title: data.get('title'), category: data.get('category'), event_date: data.get('event_date'),
    start_time: data.get('start_time'), end_time: data.get('end_time') || null,
    place: data.get('place'), estimated_minutes: hoursToMinutes(String(data.get('hours') || '')),
    slots: Number(data.get('slots')), min_age: data.get('min_age') || null,
    max_age: data.get('max_age') || null, format: data.get('format') || 'Очно',
    confirmation_type: data.get('confirmation_type') || 'Подтверждение организатора',
    confirmation_text: data.get('confirmation_text') || 'Организатор подтвердит участие и фактически отработанное время.',
    description: data.get('description'),
    duties: String(data.get('duties') || '').split('\n').map(v => v.trim()).filter(Boolean),
    take_with_you: data.get('take_with_you') || 'Ничего специального брать не нужно.',
    contact_person: data.get('contact_person') || 'Евгений Валерьевич Кустов',
    is_active: data.get('is_active') !== 'false'
  };
}

export default function AdminBlagotvoriPage() {
  const [password,setPassword] = useState('');
  const [connected,setConnected] = useState(false);
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState('');
  const [vacancies,setVacancies] = useState<AdminVacancy[]>([]);
  const [applications,setApplications] = useState<AdminApplication[]>([]);
  const [section,setSection] = useState<'overview'|'vacancies'|'applications'>('overview');
  const [creating,setCreating] = useState(false);
  const [editing,setEditing] = useState<AdminVacancy|null>(null);

  async function api(init: RequestInit = {}) {
    const response = await fetch('/api/blagotvori/admin', {
      ...init,
      headers: {'Content-Type':'application/json','x-admin-password':password,...(init.headers || {})},
      cache:'no-store'
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Ошибка запроса.');
    return json;
  }

  async function loadCabinet() {
    setLoading(true); setMessage('');
    try {
      const json = await api();
      setVacancies(json.vacancies || []); setApplications(json.applications || []); setConnected(true);
    } catch (error:any) { setConnected(false); setMessage(error?.message || 'Не удалось открыть кабинет.'); }
    finally { setLoading(false); }
  }

  async function createVacancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      await api({method:'POST',body:JSON.stringify(formPayload(new FormData(event.currentTarget)))});
      setCreating(false); setMessage('Вакансия опубликована.'); await loadCabinet(); setSection('vacancies');
    } catch (error:any) { setMessage(error?.message || 'Не удалось создать вакансию.'); }
    finally { setLoading(false); }
  }

  async function saveVacancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setLoading(true); setMessage('');
    try {
      await api({method:'PATCH',body:JSON.stringify({vacancy_id:editing.id,...formPayload(new FormData(event.currentTarget))})});
      setEditing(null); setMessage('Изменения вакансии сохранены.'); await loadCabinet(); setSection('vacancies');
    } catch (error:any) { setMessage(error?.message || 'Не удалось сохранить вакансию.'); }
    finally { setLoading(false); }
  }

  async function toggleVacancy(vacancy: AdminVacancy) {
    setLoading(true); setMessage('');
    try {
      await api({method:'PATCH',body:JSON.stringify({vacancy_id:vacancy.id,action:'toggle_active',is_active:!vacancy.is_active})});
      setMessage(vacancy.is_active ? 'Вакансия скрыта с сайта.' : 'Вакансия снова опубликована.');
      await loadCabinet(); setSection('vacancies');
    } catch (error:any) { setMessage(error?.message || 'Не удалось изменить видимость.'); }
    finally { setLoading(false); }
  }

  async function updateApplication(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setLoading(true); setMessage('');
    try {
      await api({method:'PATCH',body:JSON.stringify({
        application_id:id, status:data.get('status'),
        actual_minutes:hoursToMinutes(String(data.get('actual_hours') || '')) || null,
        admin_comment:data.get('admin_comment') || null,
        hours_confirmed:data.get('hours_confirmed') === 'on',
        dobro_hours_entered:data.get('dobro_hours_entered') === 'on'
      })});
      setMessage('Изменения по заявке сохранены.'); await loadCabinet(); setSection('applications');
    } catch (error:any) { setMessage(error?.message || 'Не удалось обновить заявку.'); }
    finally { setLoading(false); }
  }

  if (!connected) return (
    <main className={styles.loginPage}><section className={styles.loginShell}>
      <aside className={styles.loginVisual}><span className={styles.brandBadge}>Б</span><div><small>БлагоТвори. Кемь</small><h1>Добрые дела —<br/>без лишней рутины.</h1><p>Публикуйте вакансии, принимайте заявки и подтверждайте часы.</p></div></aside>
      <section className={styles.loginCard}><a href="/" className={styles.backLink}>← На сайт</a><span className={styles.kicker}>Кабинет организатора</span><h2>С возвращением</h2><label>Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')loadCabinet();}} autoFocus /></label><button type="button" onClick={loadCabinet} disabled={loading||!password}>{loading?'Входим…':'Открыть кабинет'}</button>{message&&<div className={styles.alert}>{message}</div>}</section>
    </section></main>
  );

  const activeVacancies = vacancies.filter(v=>v.is_active);
  const newApplications = applications.filter(a=>a.status==='Заявка подана');

  return <main className={styles.page}>
    <header className={styles.topbar}><div className={styles.shell}><button className={styles.logoButton} onClick={()=>setSection('overview')}><span>Б</span><b>БлагоТвори</b><small>Кемский округ</small></button><div className={styles.topActions}><a href="/" target="_blank">Открыть сайт ↗</a><button onClick={loadCabinet} disabled={loading}>Обновить</button></div></div></header>
    <div className={`${styles.shell} ${styles.workspace}`}>
      {message&&<div className={styles.notice}>{message}</div>}
      <section className={styles.hero}><div className={styles.heroCopy}><span>Рабочий кабинет</span><h1>Добрый день,<br/>Евгений Валерьевич!</h1><p>Создавайте и редактируйте вакансии, обрабатывайте заявки и отчёты.</p><button onClick={()=>setCreating(true)}>＋ Создать вакансию</button></div><div className={styles.heroStats}><article><small>Активных дел</small><b>{activeVacancies.length}</b><span>на сайте</span></article><article><small>Новых заявок</small><b>{newApplications.length}</b><span>ждут решения</span></article><article><small>Отчётов</small><b>{applications.filter(a=>a.status==='Отчёт отправлен').length}</b><span>на проверке</span></article></div></section>
      <nav className={styles.workspaceNav}><button data-active={section==='overview'} onClick={()=>setSection('overview')}><span>⌂</span>Обзор</button><button data-active={section==='vacancies'} onClick={()=>setSection('vacancies')}><span>{vacancies.length}</span>Вакансии</button><button data-active={section==='applications'} onClick={()=>setSection('applications')}><span>{applications.length}</span>Заявки и отчёты</button></nav>

      {section==='overview'&&<section className={styles.contentCard}><div className={styles.cardHead}><div><span>Быстрые действия</span><h2>Что сделать сейчас</h2></div></div><div className={styles.quickGrid}><button className={styles.quickPrimary} onClick={()=>setCreating(true)}><span>＋</span><div><b>Новая вакансия</b><small>Опубликовать доброе дело</small></div><em>→</em></button><button onClick={()=>setSection('vacancies')}><span>✎</span><div><b>Изменить вакансии</b><small>Дата, время, места и условия</small></div><em>→</em></button><button onClick={()=>setSection('applications')}><span>◎</span><div><b>Проверить отчёты</b><small>Подтвердить результат и часы</small></div><em>→</em></button></div></section>}

      {section==='vacancies'&&<section className={styles.contentCard}><div className={styles.cardHead}><div><span>Управление</span><h2>Все вакансии</h2></div><button onClick={()=>setCreating(true)}>＋ Добавить</button></div><div className={styles.vacancyGrid}>{vacancies.map(v=><article className={styles.vacancyCard} key={v.id}><div className={styles.vacancyTop}><i>{categoryIcons[v.category]}</i><em data-active={v.is_active}>{v.is_active?'На сайте':'Скрыта'}</em></div><small>{v.category}</small><h3>{v.title}</h3><div className={styles.vacancyMeta}><span>{formatDate(v.event_date)}</span><span>{v.start_time.slice(0,5)}</span><span>{v.slots} мест</span></div><div className="vacancy-edit-actions"><button type="button" onClick={()=>setEditing(v)}>✎ Редактировать</button><button type="button" onClick={()=>toggleVacancy(v)} disabled={loading}>{v.is_active?'Скрыть':'Показать'}</button></div></article>)}</div></section>}

      {section==='applications'&&<section className={styles.contentCard}><div className={styles.cardHead}><div><span>Участники</span><h2>Заявки и отчёты</h2></div></div><div className={styles.applicationList}>{applications.map(a=><details className={styles.applicationCard} key={a.id}><summary><span className={styles.personMark}>{a.volunteer_name.slice(0,1).toUpperCase()}</span><div><b>{a.volunteer_name}</b><small>{a.vacancy?.title||'Вакансия удалена'}</small></div><em data-status={a.status}>{a.status}</em><i>⌄</i></summary><form onSubmit={e=>updateApplication(e,a.id)}><div className={styles.contactLine}><span>Контакт</span><a>{a.contact}</a></div>{a.evidence_comment&&<div className="report-box"><b>Отчёт участника</b><p>{a.evidence_comment}</p>{a.evidence_url&&<a href={a.evidence_url} target="_blank">Открыть подтверждение ↗</a>}</div>}<div className={styles.applicationGrid}><label>Статус<select name="status" defaultValue={a.status}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Фактические часы<input name="actual_hours" defaultValue={minutesToHours(a.actual_minutes)} /></label><label className={styles.comment}>Комментарий<textarea name="admin_comment" defaultValue={a.admin_comment||''} /></label></div><div className={styles.checks}><label><input name="hours_confirmed" type="checkbox" defaultChecked={a.hours_confirmed}/> Часы подтверждены</label><label><input name="dobro_hours_entered" type="checkbox" defaultChecked={a.dobro_hours_entered}/> Внесены на Добро.рф</label></div><button type="submit" disabled={loading}>Сохранить изменения</button></form></details>)}</div></section>}
    </div>

    {(creating||editing)&&<div className={styles.modalBackdrop} onMouseDown={()=>{setCreating(false);setEditing(null);}}><section className={styles.createModal} onMouseDown={e=>e.stopPropagation()}><header className={styles.modalHead}><div><span>{editing?'Редактирование':'Новая вакансия'}</span><h2>{editing?'Изменить вакансию':'Создать вакансию'}</h2></div><button onClick={()=>{setCreating(false);setEditing(null);}}>×</button></header><form className={styles.wizardForm} onSubmit={editing?saveVacancy:createVacancy}>
      <label>Название<input name="title" required defaultValue={editing?.title||''}/></label>
      <div className={styles.twoColumns}><label>Категория<select name="category" defaultValue={editing?.category||categories[0]}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Формат<select name="format" defaultValue={editing?.format||'Очно'}><option>Очно</option><option>Дистанционно</option></select></label></div>
      <div className={styles.twoColumns}><label>Дата<input name="event_date" type="date" required defaultValue={editing?.event_date||''}/></label><label>Начало<input name="start_time" type="time" required defaultValue={editing?.start_time?.slice(0,5)||''}/></label><label>Окончание<input name="end_time" type="time" defaultValue={editing?.end_time?.slice(0,5)||''}/></label><label>Место<input name="place" required defaultValue={editing?.place||''}/></label></div>
      <div className={styles.twoColumns}><label>Количество часов<input name="hours" required defaultValue={minutesToHours(editing?.estimated_minutes||null)}/></label><label>Количество мест<input name="slots" type="number" min="1" required defaultValue={editing?.slots||1}/></label><label>Возраст от<input name="min_age" type="number" min="6" max="99" defaultValue={editing?.min_age||''}/></label><label>Возраст до<input name="max_age" type="number" min="6" max="99" defaultValue={editing?.max_age||99}/></label></div>
      <label>Описание<textarea name="description" required rows={4} defaultValue={editing?.description||''}/></label>
      <label>Что предстоит делать<textarea name="duties" rows={3} defaultValue={editing?.duties?.join('\n')||''}/></label>
      <label>Как подтвердить участие<textarea name="confirmation_text" rows={2} defaultValue={editing?.confirmation_text||'Организатор подтвердит участие и фактически отработанное время.'}/></label>
      <div className={styles.twoColumns}><label>Способ подтверждения<select name="confirmation_type" defaultValue={editing?.confirmation_type||confirmationTypes[0]}>{confirmationTypes.map(c=><option key={c}>{c}</option>)}</select></label><label>Ответственный<input name="contact_person" defaultValue={editing?.contact_person||'Евгений Валерьевич Кустов'}/></label></div>
      <label>Что взять с собой<textarea name="take_with_you" rows={2} defaultValue={editing?.take_with_you||'Ничего специального брать не нужно.'}/></label>
      <input type="hidden" name="is_active" value={String(editing?.is_active ?? true)}/>
      <footer className={styles.wizardFooter}><button type="button" className={styles.secondaryButton} onClick={()=>{setCreating(false);setEditing(null);}}>Отмена</button><button type="submit" className={styles.primaryButton} disabled={loading}>{loading?'Сохраняем…':editing?'Сохранить изменения':'Опубликовать'}</button></footer>
    </form></section></div>}
  </main>;
}
