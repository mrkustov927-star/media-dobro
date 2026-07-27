'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { Vacancy, VacancyCategory } from '@/lib/blagotvori/types';
import styles from './journey-hub.module.css';

type JourneyApplication = {
  id: string;
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

type Props = {
  vacancies: Vacancy[];
  onOpenVacancy: (vacancy: Vacancy) => void;
};

const categoryOptions: Array<{ value: VacancyCategory | 'Любое'; label: string; icon: string }> = [
  { value: 'Любое', label: 'Хочу попробовать разное', icon: '✨' },
  { value: 'Помощь людям', label: 'Помогать людям', icon: '❤' },
  { value: 'Помощь на мероприятиях', label: 'Быть в центре событий', icon: '🎪' },
  { value: 'Медиа', label: 'Снимать и создавать', icon: '📷' },
  { value: 'Природа и животные', label: 'Заботиться о природе', icon: '🌿' },
  { value: 'Дистанционные задания', label: 'Помогать из дома', icon: '💻' }
];

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

export default function VolunteerJourneyHub({ vacancies, onOpenVacancy }: Props) {
  const [tab, setTab] = useState<'match' | 'status' | 'mentor'>('match');
  const [category, setCategory] = useState<VacancyCategory | 'Любое'>('Любое');
  const [format, setFormat] = useState<'Любой' | 'Очно' | 'Дистанционно'>('Любой');
  const [applications, setApplications] = useState<JourneyApplication[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const recommendations = useMemo(() => {
    return vacancies
      .filter(item => item.is_active && item.free_slots > 0)
      .filter(item => category === 'Любое' || item.category === category)
      .filter(item => format === 'Любой' || item.format === format)
      .slice(0, 3);
  }, [vacancies, category, format]);

  async function findApplications(event: FormEvent<HTMLFormElement>) {
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
      setApplications(Array.isArray(json.applications) ? json.applications : []);
    } catch (error: any) {
      setApplications([]);
      setStatusMessage(error?.message || 'Не удалось проверить заявки.');
    } finally {
      setLoading(false);
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
          <p>Выбери дело, проверь заявку или узнай, как наставнику собрать свою команду.</p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button type="button" data-active={tab === 'match'} onClick={() => setTab('match')}>✨ Подобрать дело</button>
          <button type="button" data-active={tab === 'status'} onClick={() => setTab('status')}>◎ Мои заявки и часы</button>
          <button type="button" data-active={tab === 'mentor'} onClick={() => setTab('mentor')}>🤝 Наставникам</button>
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
              <form className={styles.statusForm} onSubmit={findApplications}>
                <span>ЛИЧНЫЙ МАРШРУТ</span><h3>Узнай, что происходит с заявкой</h3>
                <p>Введи имя и контакт точно так же, как при записи. Эти данные используются только для поиска твоих заявок.</p>
                <label>Имя и фамилия<input name="volunteer_name" required placeholder="Например: Анна Иванова" /></label>
                <label>Контакт<input name="contact" required placeholder="Телефон или ссылка на профиль" /></label>
                <button type="submit" disabled={loading}>{loading ? 'Проверяем…' : 'Показать мои заявки'}</button>
                {statusMessage && <small>{statusMessage}</small>}
              </form>
              <div className={styles.applicationResults}>
                {!searched && <div className={styles.statusPreview}><b>Здесь появится путь заявки</b><span>Заявка → подтверждение → доброе дело → отчёт → часы</span></div>}
                {searched && !loading && !applications.length && !statusMessage && <div className={styles.empty}>Заявок с такими данными не найдено. Проверь написание имени и контакта.</div>}
                {applications.map(application => {
                  const step = statusStep(application.status);
                  return (
                    <article className={styles.applicationCard} key={application.id}>
                      <div className={styles.applicationHead}><div><small>{application.status}</small><h3>{application.vacancy?.title || 'Доброе дело'}</h3><p>{formatDate(application.vacancy?.event_date)} · {application.vacancy?.start_time?.slice(0, 5)} · {application.vacancy?.place}</p></div>{application.actual_minutes ? <b>{application.actual_minutes / 60} ч.</b> : null}</div>
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
            <div className={styles.mentorLead}><span>ДЛЯ ЗНАЧИМЫХ ВЗРОСЛЫХ</span><h3>Помогите ребятам сделать первый шаг</h3><p>Наставник может подобрать безопасное дело для команды, обсудить роли, помочь подготовиться и поддержать после выполнения задания.</p><a href="#good-deeds">Выбрать дело для команды</a></div>
            <div className={styles.mentorCards}>
              <article><b>1</b><h4>Подберите формат</h4><p>Очное событие, медиазадача или помощь из дома — с учётом возраста и интересов ребят.</p></article>
              <article><b>2</b><h4>Запишитесь вместе</h4><p>Каждый участник подаёт свою заявку, а наставник помогает не потерять дату и инструкции.</p></article>
              <article><b>3</b><h4>Обсудите результат</h4><p>После дела важно не только отправить отчёт, но и заметить, что получилось и кому это помогло.</p></article>
            </div>
            <div className={styles.mentorNote}><b>Важно</b><p>Условия конкретной вакансии имеют приоритет. Если участнику требуется сопровождение или особые условия, заранее свяжитесь с организатором.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}
