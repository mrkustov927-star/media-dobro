'use client';

import { FormEvent, useState } from 'react';
import styles from './admin.module.css';
import type { ApplicationStatus, VacancyCategory } from '@/lib/blagotvori/types';

type AdminVacancy = {
  id: string;
  title: string;
  category: VacancyCategory;
  event_date: string;
  start_time: string;
  slots: number;
  is_active: boolean;
};

type AdminApplication = {
  id: string;
  volunteer_name: string;
  contact: string;
  status: ApplicationStatus;
  actual_minutes: number | null;
  admin_comment: string | null;
  hours_confirmed: boolean;
  dobro_hours_entered: boolean;
  vacancy: {
    id: string;
    title: string;
    event_date: string;
    start_time: string;
    estimated_minutes: number;
  } | null;
};

const statuses: ApplicationStatus[] = [
  'Заявка подана',
  'Участие подтверждено',
  'В работе',
  'Отчёт отправлен',
  'На доработке',
  'Часы зачтены',
  'Отменено',
  'Не участвовал'
];

const categories: VacancyCategory[] = [
  'Помощь людям',
  'Природа и животные',
  'Помощь на мероприятиях',
  'Медиа',
  'Дистанционные задания'
];

const confirmationTypes = [
  'Подтверждение организатора',
  'Ссылка на материал',
  'Фото результата',
  'Ссылка или файл'
];

function hoursToMinutes(value: string) {
  const hours = Number(value.replace(',', '.'));
  return Number.isFinite(hours) ? Math.round(hours * 60) : 0;
}

function minutesToHours(value: number | null) {
  if (!value) return '';
  const hours = value / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
}

export default function AdminBlagotvoriPage() {
  const [password, setPassword] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);

  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': password,
        ...(init.headers || {})
      },
      cache: 'no-store'
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Ошибка запроса.');
    return json;
  }

  async function loadCabinet() {
    setLoading(true);
    setMessage('');
    try {
      const json = await api('/api/blagotvori/admin');
      setVacancies(json.vacancies || []);
      setApplications(json.applications || []);
      setConnected(true);
    } catch (error: any) {
      setConnected(false);
      setMessage(error?.message || 'Не удалось открыть кабинет.');
    } finally {
      setLoading(false);
    }
  }

  async function createVacancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const duties = String(data.get('duties') || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);

    setLoading(true);
    setMessage('');
    try {
      await api('/api/blagotvori/admin', {
        method: 'POST',
        body: JSON.stringify({
          title: data.get('title'),
          category: data.get('category'),
          event_date: data.get('event_date'),
          start_time: data.get('start_time'),
          end_time: data.get('end_time') || null,
          place: data.get('place'),
          estimated_minutes: hoursToMinutes(String(data.get('hours') || '')),
          slots: Number(data.get('slots')),
          min_age: data.get('min_age') || null,
          max_age: data.get('max_age') || null,
          format: data.get('format'),
          confirmation_type: data.get('confirmation_type'),
          confirmation_text: data.get('confirmation_text'),
          description: data.get('description'),
          duties,
          take_with_you: data.get('take_with_you'),
          contact_person: data.get('contact_person')
        })
      });
      form.reset();
      setMessage('Вакансия создана и появилась в календаре.');
      await loadCabinet();
    } catch (error: any) {
      setMessage(error?.message || 'Не удалось создать вакансию.');
    } finally {
      setLoading(false);
    }
  }

  async function updateApplication(event: FormEvent<HTMLFormElement>, applicationId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setMessage('');

    try {
      await api('/api/blagotvori/admin', {
        method: 'PATCH',
        body: JSON.stringify({
          application_id: applicationId,
          status: data.get('status'),
          actual_minutes: hoursToMinutes(String(data.get('actual_hours') || '')) || null,
          admin_comment: data.get('admin_comment') || null,
          hours_confirmed: data.get('hours_confirmed') === 'on',
          dobro_hours_entered: data.get('dobro_hours_entered') === 'on'
        })
      });
      setMessage('Заявка обновлена.');
      await loadCabinet();
    } catch (error: any) {
      setMessage(error?.message || 'Не удалось обновить заявку.');
    } finally {
      setLoading(false);
    }
  }

  if (!connected) {
    return (
      <main className={styles.loginPage}>
        <section className={styles.loginCard}>
          <a href="/" className={styles.backLink}>← Вернуться к календарю</a>
          <span className={styles.kicker}>БлагоТвори. Кемь</span>
          <h1>Кабинет организатора</h1>
          <p>Введите отдельный пароль нового сайта. Пароль от «Добро.Медиа» здесь не используется автоматически.</p>
          <label>Пароль организатора<input type="password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') loadCabinet(); }} /></label>
          <button type="button" onClick={loadCabinet} disabled={loading || !password}>{loading ? 'Проверяем…' : 'Войти'}</button>
          {message && <div className={styles.alert}>{message}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>БлагоТвори. Кемь</span>
          <h1>Кабинет организатора</h1>
        </div>
        <div className={styles.headerActions}>
          <a href="/">Открыть календарь</a>
          <button type="button" onClick={loadCabinet}>Обновить</button>
        </div>
      </header>

      {message && <div className={styles.notice}>{message}</div>}

      <section className={styles.stats}>
        <article><span>Вакансий</span><b>{vacancies.length}</b></article>
        <article><span>Заявок</span><b>{applications.length}</b></article>
        <article><span>Часы зачтены</span><b>{applications.filter(item => item.hours_confirmed).length}</b></article>
        <article><span>Внесены на Добро.рф</span><b>{applications.filter(item => item.dobro_hours_entered).length}</b></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><span>01</span><h2>Создать вакансию</h2></div>
          <p>После сохранения вакансия сразу появится в календаре.</p>
        </div>
        <form className={styles.vacancyForm} onSubmit={createVacancy}>
          <label className={styles.wide}>Название вакансии<input name="title" required /></label>
          <label>Категория<select name="category" required>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Формат<select name="format" required><option>Очно</option><option>Дистанционно</option></select></label>
          <label>Дата<input name="event_date" type="date" required /></label>
          <label>Начало<input name="start_time" type="time" required /></label>
          <label>Окончание<input name="end_time" type="time" /></label>
          <label>Количество часов<input name="hours" inputMode="decimal" placeholder="Например: 3" required /></label>
          <label>Количество мест<input name="slots" type="number" min="1" defaultValue="1" required /></label>
          <label>Минимальный возраст<input name="min_age" type="number" min="6" max="35" /></label>
          <label>Максимальный возраст<input name="max_age" type="number" min="6" max="35" /></label>
          <label className={styles.wide}>Место<input name="place" required /></label>
          <label>Способ подтверждения<select name="confirmation_type" required>{confirmationTypes.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Ответственный<input name="contact_person" defaultValue="Евгений Валерьевич Кустов" /></label>
          <label className={styles.wide}>Краткое описание<textarea name="description" rows={3} required /></label>
          <label className={styles.wide}>Что предстоит делать<textarea name="duties" rows={4} placeholder="Каждое действие — с новой строки" required /></label>
          <label className={styles.wide}>Как подтвердить участие<textarea name="confirmation_text" rows={3} required /></label>
          <label className={styles.wide}>Что взять с собой<textarea name="take_with_you" rows={2} defaultValue="Ничего специального брать не нужно." /></label>
          <button type="submit" disabled={loading}>{loading ? 'Сохраняем…' : 'Создать вакансию'}</button>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><span>02</span><h2>Заявки волонтёров</h2></div>
          <p>Подтвердите участие, фактические часы и перенос на Добро.рф.</p>
        </div>

        <div className={styles.applicationList}>
          {!applications.length && <div className={styles.empty}>Заявок пока нет.</div>}
          {applications.map(application => (
            <form className={styles.applicationCard} key={application.id} onSubmit={event => updateApplication(event, application.id)}>
              <div className={styles.applicationTitle}>
                <div><b>{application.volunteer_name}</b><a href={application.contact.startsWith('http') ? application.contact : undefined}>{application.contact}</a></div>
                <span>{application.vacancy?.title || 'Вакансия удалена'}</span>
              </div>
              <div className={styles.applicationGrid}>
                <label>Статус<select name="status" defaultValue={application.status}>{statuses.map(item => <option key={item}>{item}</option>)}</select></label>
                <label>Фактические часы<input name="actual_hours" inputMode="decimal" defaultValue={minutesToHours(application.actual_minutes)} placeholder="Например: 3" /></label>
                <label className={styles.comment}>Комментарий организатора<textarea name="admin_comment" rows={2} defaultValue={application.admin_comment || ''} /></label>
              </div>
              <div className={styles.checks}>
                <label><input name="hours_confirmed" type="checkbox" defaultChecked={application.hours_confirmed} /> Часы подтверждены</label>
                <label><input name="dobro_hours_entered" type="checkbox" defaultChecked={application.dobro_hours_entered} /> Часы внесены на Добро.рф</label>
              </div>
              <button type="submit" disabled={loading}>Сохранить заявку</button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
