'use client';

import { FormEvent, useRef, useState } from 'react';
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

const categoryIcons: Record<VacancyCategory, string> = {
  'Помощь людям': '♥',
  'Природа и животные': '●',
  'Помощь на мероприятиях': '◆',
  'Медиа': '◉',
  'Дистанционные задания': '⌁'
};

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

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export default function AdminBlagotvoriPage() {
  const [password, setPassword] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'vacancies' | 'applications'>('overview');
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const vacancyFormRef = useRef<HTMLFormElement>(null);

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

  function closeCreate() {
    setCreateOpen(false);
    setCreateStep(1);
  }

  function validateStep(step: 1 | 2) {
    const form = vacancyFormRef.current;
    if (!form) return false;
    const names = step === 1
      ? ['title', 'category', 'event_date', 'start_time']
      : ['place', 'hours', 'slots', 'description'];

    for (const name of names) {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (field && !field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
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
          format: data.get('format') || 'Очно',
          confirmation_type: data.get('confirmation_type') || 'Подтверждение организатора',
          confirmation_text: data.get('confirmation_text') || 'Организатор подтвердит участие и фактически отработанное время.',
          description: data.get('description'),
          duties,
          take_with_you: data.get('take_with_you') || 'Ничего специального брать не нужно.',
          contact_person: data.get('contact_person') || 'Евгений Валерьевич Кустов'
        })
      });
      form.reset();
      closeCreate();
      setMessage('Вакансия опубликована и уже появилась на сайте.');
      await loadCabinet();
      setActiveSection('vacancies');
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
      setMessage('Изменения по заявке сохранены.');
      await loadCabinet();
      setActiveSection('applications');
    } catch (error: any) {
      setMessage(error?.message || 'Не удалось обновить заявку.');
    } finally {
      setLoading(false);
    }
  }

  if (!connected) {
    return (
      <main className={styles.loginPage}>
        <section className={styles.loginShell}>
          <aside className={styles.loginVisual}>
            <span className={styles.brandBadge}>Б</span>
            <div>
              <small>БлагоТвори. Кемь</small>
              <h1>Добрые дела —<br />без лишней рутины.</h1>
              <p>Публикуйте вакансии, принимайте заявки и подтверждайте часы в одном кабинете.</p>
            </div>
            <div className={styles.loginPoints}>
              <span>01 <b>Быстрая публикация</b></span>
              <span>02 <b>Все заявки рядом</b></span>
              <span>03 <b>Учёт волонтёрских часов</b></span>
            </div>
          </aside>
          <section className={styles.loginCard}>
            <a href="/" className={styles.backLink}>← На сайт для участников</a>
            <span className={styles.kicker}>Кабинет организатора</span>
            <h2>С возвращением</h2>
            <p>Введите пароль, который вы добавили в настройках Vercel.</p>
            <label>Пароль<input type="password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') loadCabinet(); }} autoFocus /></label>
            <button type="button" onClick={loadCabinet} disabled={loading || !password}>{loading ? 'Входим…' : 'Открыть кабинет'}</button>
            {message && <div className={styles.alert}>{message}</div>}
          </section>
        </section>
      </main>
    );
  }

  const activeVacancies = vacancies.filter(item => item.is_active);
  const newApplications = applications.filter(item => item.status === 'Заявка подана');
  const upcoming = activeVacancies.slice(0, 3);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.shell}>
          <button className={styles.logoButton} type="button" onClick={() => setActiveSection('overview')}>
            <span>Б</span><b>БлагоТвори</b><small>Кемский округ</small>
          </button>
          <div className={styles.topActions}>
            <a href="/" target="_blank" rel="noreferrer">Открыть сайт ↗</a>
            <button type="button" onClick={loadCabinet} disabled={loading}>{loading ? 'Обновляем…' : 'Обновить'}</button>
          </div>
        </div>
      </header>

      <div className={`${styles.shell} ${styles.workspace}`}>
        {message && <div className={styles.notice}>{message}</div>}

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span>Рабочий кабинет</span>
            <h1>Добрый день,<br />Евгений Валерьевич!</h1>
            <p>Здесь только главное: опубликовать дело, увидеть заявки и подтвердить часы.</p>
            <button type="button" onClick={() => { setCreateStep(1); setCreateOpen(true); }}>＋ Создать вакансию</button>
          </div>
          <div className={styles.heroStats}>
            <article><small>Активных дел</small><b>{activeVacancies.length}</b><span>сейчас на сайте</span></article>
            <article><small>Новых заявок</small><b>{newApplications.length}</b><span>{newApplications.length ? 'ждут решения' : 'всё обработано'}</span></article>
            <article><small>Часов подтверждено</small><b>{applications.filter(item => item.hours_confirmed).length}</b><span>заявок отмечено</span></article>
          </div>
        </section>

        <nav className={styles.workspaceNav} aria-label="Разделы кабинета">
          <button type="button" data-active={activeSection === 'overview'} onClick={() => setActiveSection('overview')}><span>⌂</span>Обзор</button>
          <button type="button" data-active={activeSection === 'vacancies'} onClick={() => setActiveSection('vacancies')}><span>{vacancies.length}</span>Вакансии</button>
          <button type="button" data-active={activeSection === 'applications'} onClick={() => setActiveSection('applications')}><span>{applications.length}</span>Заявки</button>
        </nav>

        {activeSection === 'overview' && (
          <>
            <section className={styles.quickGrid}>
              <button type="button" className={styles.quickPrimary} onClick={() => setCreateOpen(true)}>
                <span>＋</span><div><b>Новое доброе дело</b><small>Опубликовать за три коротких шага</small></div><em>→</em>
              </button>
              <button type="button" onClick={() => setActiveSection('applications')}>
                <span>◎</span><div><b>Разобрать заявки</b><small>{newApplications.length ? `${newApplications.length} новых` : 'Новых заявок нет'}</small></div><em>→</em>
              </button>
              <button type="button" onClick={() => setActiveSection('vacancies')}>
                <span>□</span><div><b>Все вакансии</b><small>Проверить опубликованные дела</small></div><em>→</em>
              </button>
            </section>

            <section className={styles.contentCard}>
              <div className={styles.cardHead}><div><span>Ближайшие дела</span><h2>Что запланировано</h2></div><button type="button" onClick={() => setActiveSection('vacancies')}>Смотреть все</button></div>
              <div className={styles.upcomingList}>
                {!upcoming.length && <div className={styles.empty}>Пока нет активных вакансий.</div>}
                {upcoming.map(vacancy => (
                  <article key={vacancy.id}>
                    <time><b>{vacancy.event_date.slice(8, 10)}</b><span>{formatDate(vacancy.event_date).split(' ')[1]}</span></time>
                    <i>{categoryIcons[vacancy.category]}</i>
                    <div><small>{vacancy.category}</small><h3>{vacancy.title}</h3><p>{vacancy.start_time.slice(0, 5)} · {vacancy.slots} мест</p></div>
                    <em>Опубликована</em>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === 'vacancies' && (
          <section className={styles.contentCard}>
            <div className={styles.cardHead}><div><span>Управление</span><h2>Опубликованные вакансии</h2></div><button type="button" onClick={() => setCreateOpen(true)}>＋ Добавить</button></div>
            <div className={styles.vacancyGrid}>
              {!vacancies.length && <div className={styles.empty}>Вакансий пока нет.</div>}
              {vacancies.map(vacancy => (
                <article className={styles.vacancyCard} key={vacancy.id}>
                  <div className={styles.vacancyTop}><i>{categoryIcons[vacancy.category]}</i><em data-active={vacancy.is_active}>{vacancy.is_active ? 'На сайте' : 'Скрыта'}</em></div>
                  <small>{vacancy.category}</small>
                  <h3>{vacancy.title}</h3>
                  <div className={styles.vacancyMeta}><span>{formatDate(vacancy.event_date)}</span><span>{vacancy.start_time.slice(0, 5)}</span><span>{vacancy.slots} мест</span></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'applications' && (
          <section className={styles.contentCard}>
            <div className={styles.cardHead}><div><span>Участники</span><h2>Заявки волонтёров</h2></div><small>Нажмите на заявку, чтобы обработать её</small></div>
            <div className={styles.applicationList}>
              {!applications.length && <div className={styles.empty}>Заявок пока нет. Когда участник откликнется, он появится здесь.</div>}
              {applications.map(application => (
                <details className={styles.applicationCard} key={application.id}>
                  <summary>
                    <span className={styles.personMark}>{application.volunteer_name.slice(0, 1).toUpperCase()}</span>
                    <div><b>{application.volunteer_name}</b><small>{application.vacancy?.title || 'Вакансия удалена'}</small></div>
                    <em data-status={application.status}>{application.status}</em>
                    <i>⌄</i>
                  </summary>
                  <form onSubmit={event => updateApplication(event, application.id)}>
                    <div className={styles.contactLine}><span>Контакт</span><a href={application.contact.startsWith('http') ? application.contact : undefined}>{application.contact}</a></div>
                    <div className={styles.applicationGrid}>
                      <label>Статус<select name="status" defaultValue={application.status}>{statuses.map(item => <option key={item}>{item}</option>)}</select></label>
                      <label>Фактические часы<input name="actual_hours" inputMode="decimal" defaultValue={minutesToHours(application.actual_minutes)} placeholder="Например: 3" /></label>
                      <label className={styles.comment}>Комментарий<textarea name="admin_comment" rows={2} defaultValue={application.admin_comment || ''} placeholder="Необязательно" /></label>
                    </div>
                    <div className={styles.checks}>
                      <label><input name="hours_confirmed" type="checkbox" defaultChecked={application.hours_confirmed} /> Часы подтверждены</label>
                      <label><input name="dobro_hours_entered" type="checkbox" defaultChecked={application.dobro_hours_entered} /> Внесены на Добро.рф</label>
                    </div>
                    <button type="submit" disabled={loading}>Сохранить изменения</button>
                  </form>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {createOpen && (
        <div className={styles.modalBackdrop} onMouseDown={closeCreate}>
          <section className={styles.createModal} role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={event => event.stopPropagation()}>
            <header className={styles.modalHead}>
              <div><span>Новая вакансия</span><h2 id="create-title">{createStep === 1 ? 'Что нужно сделать?' : createStep === 2 ? 'Когда и где?' : 'Последние детали'}</h2></div>
              <button type="button" onClick={closeCreate} aria-label="Закрыть">×</button>
            </header>

            <div className={styles.progress} aria-label={`Шаг ${createStep} из 3`}>
              {[1, 2, 3].map(step => <span key={step} data-active={step <= createStep}>{step}</span>)}
            </div>

            <form ref={vacancyFormRef} className={styles.wizardForm} onSubmit={createVacancy}>
              <fieldset hidden={createStep !== 1}>
                <p>Дайте делу короткое понятное название. Его увидят участники в календаре.</p>
                <label>Название<input name="title" required placeholder="Например: Помочь на семейном празднике" autoFocus /></label>
                <label>Категория<select name="category" required>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
                <div className={styles.twoColumns}>
                  <label>Дата<input name="event_date" type="date" required /></label>
                  <label>Начало<input name="start_time" type="time" required /></label>
                </div>
              </fieldset>

              <fieldset hidden={createStep !== 2}>
                <p>Укажите основные условия — этого уже достаточно для публикации.</p>
                <label>Место<input name="place" required placeholder="Центр культуры, библиотека или дистанционно" /></label>
                <div className={styles.twoColumns}>
                  <label>Сколько часов<input name="hours" inputMode="decimal" required placeholder="Например: 3" /></label>
                  <label>Сколько мест<input name="slots" type="number" min="1" defaultValue="1" required /></label>
                </div>
                <label>Что нужно сделать<textarea name="description" rows={4} required placeholder="Одним-двумя предложениями объясните задачу" /></label>
              </fieldset>

              <fieldset hidden={createStep !== 3}>
                <p>Эти поля необязательны. Готовые значения уже установлены.</p>
                <div className={styles.twoColumns}>
                  <label>Формат<select name="format" defaultValue="Очно"><option>Очно</option><option>Дистанционно</option></select></label>
                  <label>Окончание<input name="end_time" type="time" /></label>
                  <label>Возраст от<input name="min_age" type="number" min="6" max="99" /></label>
                  <label>Возраст до<input name="max_age" type="number" min="6" max="99" defaultValue="99" /></label>
                </div>
                <details className={styles.moreSettings}>
                  <summary>Добавить подробную инструкцию</summary>
                  <div>
                    <label>Что предстоит делать<textarea name="duties" rows={3} placeholder="Каждое действие — с новой строки" /></label>
                    <label>Как подтвердить участие<textarea name="confirmation_text" rows={2} defaultValue="Организатор подтвердит участие и фактически отработанное время." /></label>
                    <label>Что взять с собой<textarea name="take_with_you" rows={2} defaultValue="Ничего специального брать не нужно." /></label>
                    <label>Способ подтверждения<select name="confirmation_type" defaultValue="Подтверждение организатора">{confirmationTypes.map(item => <option key={item}>{item}</option>)}</select></label>
                    <label>Ответственный<input name="contact_person" defaultValue="Евгений Валерьевич Кустов" /></label>
                  </div>
                </details>
              </fieldset>

              <footer className={styles.wizardFooter}>
                <button type="button" className={styles.secondaryButton} onClick={() => createStep === 1 ? closeCreate() : setCreateStep((createStep - 1) as 1 | 2)}> {createStep === 1 ? 'Отмена' : 'Назад'} </button>
                {createStep < 3 ? (
                  <button type="button" className={styles.primaryButton} onClick={() => {
                    if (validateStep(createStep as 1 | 2)) setCreateStep((createStep + 1) as 2 | 3);
                  }}>Продолжить →</button>
                ) : (
                  <button type="submit" className={styles.primaryButton} disabled={loading}>{loading ? 'Публикуем…' : 'Опубликовать'}</button>
                )}
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
