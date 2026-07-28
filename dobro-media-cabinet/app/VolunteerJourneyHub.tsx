'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Vacancy, VacancyCategory } from '@/lib/blagotvori/types';
import styles from './journey-hub.module.css';

type JourneyApplication = {
  id: string;
  volunteer_name: string;
  access_code: string;
  status: string;
  actual_minutes: number | null;
  hours_confirmed: boolean;
  dobro_hours_entered: boolean;
  admin_comment: string | null;
  evidence_comment: string | null;
  evidence_url: string | null;
  vacancy: {
    id: string;
    title: string;
    event_date: string;
    start_time: string;
    place: string;
    format: string;
    confirmation_text: string;
  } | null;
};

type StoredReceipt = {
  access_code: string;
  vacancy_id?: string;
  title?: string;
  volunteer_name?: string;
  saved_at?: string;
};

type Props = {
  vacancies: Vacancy[];
  onOpenVacancy: (vacancy: Vacancy) => void;
};

const personalStorageKey = 'blagotvori_application_receipts_v1';
const mentorStorageKey = 'blagotvori_mentor_codes_v1';

const categoryOptions: Array<{ value: VacancyCategory | 'Любое'; label: string; icon: string }> = [
  { value: 'Любое', label: 'Хочу попробовать разное', icon: '✨' },
  { value: 'Помощь людям', label: 'Помогать людям', icon: '❤' },
  { value: 'Помощь на мероприятиях', label: 'Быть в центре событий', icon: '🎪' },
  { value: 'Медиа', label: 'Снимать и создавать', icon: '📷' },
  { value: 'Природа и животные', label: 'Заботиться о природе', icon: '🌿' },
  { value: 'Дистанционные задания', label: 'Помогать из дома', icon: '💻' }
];

function normalizeCode(value: unknown) {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  return clean.length === 12 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}` : String(value || '').toUpperCase();
}

function statusStep(status: string) {
  const map: Record<string, number> = {
    'Заявка подана': 1,
    'Участие подтверждено': 2,
    'В работе': 3,
    'Отчёт отправлен': 4,
    'На доработке': 4,
    'Часы зачтены': 5,
    'Отменено': 0,
    'Не участвовал': 0
  };
  return map[status] ?? 1;
}

function formatDate(value?: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function mergeApplications(current: JourneyApplication[], incoming: JourneyApplication[]) {
  const map = new Map(current.map(item => [item.id, item]));
  incoming.forEach(item => map.set(item.id, item));
  return Array.from(map.values()).sort((left, right) => {
    return String(right.vacancy?.event_date || '').localeCompare(String(left.vacancy?.event_date || ''));
  });
}

function readPersonalReceipts(): StoredReceipt[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(personalStorageKey) || '[]');
    return Array.isArray(value) ? value.filter(item => item?.access_code) : [];
  } catch {
    return [];
  }
}

function rememberPersonalApplication(application: JourneyApplication) {
  const receipt: StoredReceipt = {
    access_code: normalizeCode(application.access_code),
    vacancy_id: application.vacancy?.id,
    title: application.vacancy?.title,
    volunteer_name: application.volunteer_name,
    saved_at: new Date().toISOString()
  };

  const current = readPersonalReceipts().filter(item => normalizeCode(item.access_code) !== receipt.access_code);
  window.localStorage.setItem(personalStorageKey, JSON.stringify([receipt, ...current].slice(0, 50)));
  window.dispatchEvent(new CustomEvent('blagotvori-access-imported', { detail: receipt }));
}

function readMentorCodes() {
  try {
    const value = JSON.parse(window.localStorage.getItem(mentorStorageKey) || '[]');
    return Array.isArray(value) ? value.map(normalizeCode).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function VolunteerJourneyHub({ vacancies, onOpenVacancy }: Props) {
  const [tab, setTab] = useState<'match' | 'status' | 'mentor'>('match');
  const [category, setCategory] = useState<VacancyCategory | 'Любое'>('Любое');
  const [format, setFormat] = useState<'Любой' | 'Очно' | 'Дистанционно'>('Любой');
  const [applications, setApplications] = useState<JourneyApplication[]>([]);
  const [accessCode, setAccessCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mentorCode, setMentorCode] = useState('');
  const [mentorApplications, setMentorApplications] = useState<JourneyApplication[]>([]);
  const [mentorMessage, setMentorMessage] = useState('');
  const [mentorLoading, setMentorLoading] = useState(false);

  const recommendations = useMemo(() => {
    return vacancies
      .filter(item => item.is_active && item.free_slots > 0)
      .filter(item => category === 'Любое' || item.category === category)
      .filter(item => format === 'Любой' || item.format === format)
      .slice(0, 3);
  }, [vacancies, category, format]);

  async function loadByCode(value: string) {
    const code = normalizeCode(value);
    const response = await fetch('/api/blagotvori/application-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_code: code })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Не удалось проверить заявку.');
    return json.application as JourneyApplication;
  }

  useEffect(() => {
    let cancelled = false;

    async function restorePersonal() {
      const codes = Array.from(new Set(readPersonalReceipts().map(item => normalizeCode(item.access_code)).filter(Boolean)));
      if (!codes.length) return;
      setSearched(true);
      const results = await Promise.allSettled(codes.map(loadByCode));
      if (cancelled) return;
      const restored = results
        .filter((result): result is PromiseFulfilledResult<JourneyApplication> => result.status === 'fulfilled')
        .map(result => result.value);
      setApplications(restored);
    }

    async function restoreMentor() {
      const codes = Array.from(new Set(readMentorCodes()));
      if (!codes.length) return;
      const results = await Promise.allSettled(codes.map(loadByCode));
      if (cancelled) return;
      setMentorApplications(
        results
          .filter((result): result is PromiseFulfilledResult<JourneyApplication> => result.status === 'fulfilled')
          .map(result => result.value)
      );
    }

    function openAccess(event: Event) {
      const receipt = (event as CustomEvent<StoredReceipt>).detail;
      if (!receipt?.access_code) return;
      const code = normalizeCode(receipt.access_code);
      setTab('status');
      setAccessCode(code);
      setLoading(true);
      setSearched(true);
      loadByCode(code)
        .then(application => {
          if (cancelled) return;
          setApplications(current => mergeApplications(current, [application]));
          rememberPersonalApplication(application);
          setStatusMessage('');
        })
        .catch(error => !cancelled && setStatusMessage(error?.message || 'Не удалось проверить заявку.'))
        .finally(() => !cancelled && setLoading(false));
    }

    void restorePersonal();
    void restoreMentor();
    window.addEventListener('blagotvori-open-access', openAccess as EventListener);
    window.addEventListener('blagotvori-access-saved', openAccess as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener('blagotvori-open-access', openAccess as EventListener);
      window.removeEventListener('blagotvori-access-saved', openAccess as EventListener);
    };
  }, []);

  async function findApplicationByCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage('');
    setSearched(true);
    try {
      const application = await loadByCode(accessCode);
      setApplications(current => mergeApplications(current, [application]));
      setAccessCode(normalizeCode(application.access_code));
      rememberPersonalApplication(application);
    } catch (error: any) {
      setStatusMessage(error?.message || 'Не удалось проверить заявку.');
    } finally {
      setLoading(false);
    }
  }

  async function findLegacyApplications(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setStatusMessage('');
    setSearched(true);
    try {
      const response = await fetch('/api/blagotvori/my-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteer_name: data.get('volunteer_name'), contact: data.get('contact') })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Не удалось проверить заявки.');
      const found = Array.isArray(json.applications) ? json.applications as JourneyApplication[] : [];
      found.forEach(rememberPersonalApplication);
      setApplications(found);
      if (found.length) setStatusMessage('Коды старых заявок сохранены на этом устройстве.');
    } catch (error: any) {
      setApplications([]);
      setStatusMessage(error?.message || 'Не удалось проверить заявки.');
    } finally {
      setLoading(false);
    }
  }

  async function addMentorApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMentorLoading(true);
    setMentorMessage('');
    try {
      const application = await loadByCode(mentorCode);
      const code = normalizeCode(application.access_code);
      const codes = Array.from(new Set([code, ...readMentorCodes()]));
      window.localStorage.setItem(mentorStorageKey, JSON.stringify(codes));
      setMentorApplications(current => mergeApplications(current, [application]));
      setMentorCode('');
      setMentorMessage(`${application.volunteer_name} добавлен(а) в группу.`);
    } catch (error: any) {
      setMentorMessage(error?.message || 'Не удалось добавить участника.');
    } finally {
      setMentorLoading(false);
    }
  }

  function removeMentorApplication(application: JourneyApplication) {
    const code = normalizeCode(application.access_code);
    const codes = readMentorCodes().filter(item => item !== code);
    window.localStorage.setItem(mentorStorageKey, JSON.stringify(codes));
    setMentorApplications(current => current.filter(item => item.id !== application.id));
  }

  async function refreshMentorGroup() {
    const codes = Array.from(new Set(readMentorCodes()));
    if (!codes.length) return;
    setMentorLoading(true);
    setMentorMessage('');
    try {
      const results = await Promise.allSettled(codes.map(loadByCode));
      setMentorApplications(
        results
          .filter((result): result is PromiseFulfilledResult<JourneyApplication> => result.status === 'fulfilled')
          .map(result => result.value)
      );
      setMentorMessage('Статусы группы обновлены.');
    } finally {
      setMentorLoading(false);
    }
  }

  function shareVacancy(vacancy: Vacancy) {
    const text = `Пойдём вместе на доброе дело «${vacancy.title}»? ${formatDate(vacancy.event_date)}, ${vacancy.start_time.slice(0, 5)}. БлагоТвори. Кемь`;
    const url = `${window.location.origin}/?vacancy=${vacancy.id}`;
    if (navigator.share) navigator.share({ title: vacancy.title, text, url }).catch(() => undefined);
    else navigator.clipboard?.writeText(`${text}\n${url}`);
  }

  return (
    <section className={styles.section} aria-labelledby="journey-title">
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div><span>ТВОЙ МАРШРУТ</span><h2 id="journey-title">Начни с того, что нужно именно тебе</h2></div>
          <p>Выбери дело, проверь заявку или открой защищённый список группы наставника.</p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button type="button" data-active={tab === 'match'} onClick={() => setTab('match')}>✨ Подобрать дело</button>
          <button type="button" data-active={tab === 'status'} onClick={() => setTab('status')}>◎ Мои заявки и часы</button>
          <button type="button" data-active={tab === 'mentor'} onClick={() => setTab('mentor')}>🤝 Группа наставника</button>
        </div>

        {tab === 'match' && (
          <div className={styles.panel}>
            <div className={styles.matcherIntro}><b>Что тебе ближе?</b><p>Выбор можно менять — результаты обновятся сразу.</p></div>
            <div className={styles.optionGrid}>
              {categoryOptions.map(option => (
                <button type="button" key={option.value} data-active={category === option.value} onClick={() => setCategory(option.value)}>
                  <span>{option.icon}</span><b>{option.label}</b>
                </button>
              ))}
            </div>
            <div className={styles.formatRow}>
              <span>Как удобнее участвовать?</span>
              {(['Любой', 'Очно', 'Дистанционно'] as const).map(item => <button type="button" key={item} data-active={format === item} onClick={() => setFormat(item)}>{item}</button>)}
            </div>
            <div className={styles.results}>
              {recommendations.length ? recommendations.map(vacancy => (
                <article key={vacancy.id}>
                  <div><small>{vacancy.category}</small><h3>{vacancy.title}</h3><p>{formatDate(vacancy.event_date)} · {vacancy.start_time.slice(0, 5)} · {vacancy.format}</p></div>
                  <div className={styles.resultActions}>
                    <button type="button" onClick={() => onOpenVacancy(vacancy)}>Посмотреть</button>
                    <button type="button" onClick={() => shareVacancy(vacancy)}>Позвать друга ↗</button>
                  </div>
                </article>
              )) : <div className={styles.empty}>Подходящих свободных мест пока нет. Попробуй другой вариант.</div>}
            </div>
          </div>
        )}

        {tab === 'status' && (
          <div className={styles.panel}>
            <div className={styles.statusLayout}>
              <div className={styles.statusForm}>
                <span>ЛИЧНЫЙ МАРШРУТ</span><h3>Проверь закреплённую активность</h3>
                <p>Введите персональный код, который появился после записи. Код можно показать наставнику, но не публикуйте его в открытом доступе.</p>
                <form className="access-code-form" onSubmit={findApplicationByCode}>
                  <label>Код заявки<input className="access-code-input" value={accessCode} onChange={event => setAccessCode(event.target.value)} required placeholder="ABCD-EFGH-JKLM" autoComplete="off" /></label>
                  <button type="submit" disabled={loading}>{loading ? 'Проверяем…' : 'Показать заявку'}</button>
                </form>
                <details className="access-code-help">
                  <summary>Заявка была подана раньше и кода нет</summary>
                  <form onSubmit={findLegacyApplications}>
                    <label>Имя и фамилия<input name="volunteer_name" required placeholder="Например: Анна Иванова" /></label>
                    <label>Контакт<input name="contact" required placeholder="Телефон или ссылка на профиль" /></label>
                    <button type="submit" disabled={loading}>Найти старые заявки</button>
                  </form>
                </details>
                {statusMessage && <small>{statusMessage}</small>}
              </div>
              <div className={styles.applicationResults}>
                {!searched && <div className={styles.statusPreview}><b>Здесь появится путь заявки</b><span>Заявка → подтверждение → доброе дело → отчёт → часы</span></div>}
                {searched && !loading && !applications.length && !statusMessage && <div className={styles.empty}>Заявки пока не добавлены. Введите персональный код.</div>}
                {applications.map(application => {
                  const step = statusStep(application.status);
                  return (
                    <article className={styles.applicationCard} key={application.id}>
                      <div className={styles.applicationHead}><div><small>{application.status}</small><h3>{application.vacancy?.title || 'Доброе дело'}</h3><p>{formatDate(application.vacancy?.event_date)} · {application.vacancy?.start_time?.slice(0, 5)} · {application.vacancy?.place}</p><span className="access-code-badge">Код: {application.access_code}</span></div>{application.actual_minutes ? <b>{application.actual_minutes / 60} ч.</b> : null}</div>
                      <div className={styles.progress} aria-label={`Этап ${step} из 5`}>
                        {['Заявка', 'Подтверждение', 'Участие', 'Отчёт', 'Часы'].map((label, index) => <span key={label} data-done={step >= index + 1}><i>{step >= index + 1 ? '✓' : index + 1}</i><small>{label}</small></span>)}
                      </div>
                      {application.admin_comment && <p className={styles.adminComment}><b>Комментарий организатора:</b> {application.admin_comment}</p>}
                      <div className={styles.applicationActions}>
                        {step >= 3 && !application.hours_confirmed && <a href="/report-blagotvori">Отправить отчёт</a>}
                        {application.dobro_hours_entered && <span>✓ Часы внесены на Добро.рф</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'mentor' && (
          <div className={`${styles.panel} ${styles.mentorPanel}`}>
            <div className={styles.mentorLead}><span>ДЛЯ ЗНАЧИМЫХ ВЗРОСЛЫХ</span><h3>Все активности группы на одном экране</h3><p>Попросите ребёнка показать персональный код заявки. Код открывает только эту заявку и не показывает контакт участника.</p><a href="#good-deeds">Выбрать новое дело</a></div>
            <div className={styles.mentorCards}>
              <article><b>1</b><h4>Получите код</h4><p>Ребёнок получает его сразу после записи и может скопировать или показать наставнику.</p></article>
              <article><b>2</b><h4>Добавьте в группу</h4><p>Введите код один раз. Список сохранится только на этом устройстве наставника.</p></article>
              <article><b>3</b><h4>Следите за статусом</h4><p>Видно подтверждение участия, отправку отчёта и зачёт часов.</p></article>
            </div>

            <div className="mentor-access-layout">
              <form className="mentor-access-form" onSubmit={addMentorApplication}>
                <h4>Добавить участника</h4>
                <p>Введите код из подтверждения ребёнка.</p>
                <input className="access-code-input" value={mentorCode} onChange={event => setMentorCode(event.target.value)} required placeholder="ABCD-EFGH-JKLM" autoComplete="off" />
                <button type="submit" disabled={mentorLoading}>{mentorLoading ? 'Проверяем…' : 'Добавить в группу'}</button>
                {mentorMessage && <small>{mentorMessage}</small>}
              </form>

              <div className="mentor-group-list">
                <div className="mentor-toolbar"><h4>Моя группа · {mentorApplications.length}</h4><button type="button" onClick={refreshMentorGroup} disabled={mentorLoading}>Обновить статусы</button></div>
                {!mentorApplications.length && <div className="mentor-empty">Добавьте первый код — здесь появятся имя ребёнка, активность и её статус.</div>}
                {mentorApplications.map(application => (
                  <article className="mentor-child-card" key={application.id}>
                    <div className="mentor-child-head"><div><h5>{application.volunteer_name}</h5><p>{application.vacancy?.title || 'Доброе дело'}</p></div><button type="button" onClick={() => removeMentorApplication(application)}>Убрать</button></div>
                    <div className="mentor-child-meta"><span>{application.status}</span><span>{formatDate(application.vacancy?.event_date)} · {application.vacancy?.start_time?.slice(0, 5)}</span><span>Код {application.access_code}</span></div>
                    {application.admin_comment && <p className={styles.adminComment}><b>Комментарий организатора:</b> {application.admin_comment}</p>}
                  </article>
                ))}
              </div>
            </div>

            <div className={styles.mentorNote}><b>Конфиденциальность</b><p>Код является ключом к заявке. Не размещайте его в открытых чатах и публикациях. Удалите ребёнка из списка, когда сопровождение завершено.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}
