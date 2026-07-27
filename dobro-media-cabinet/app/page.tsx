'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from './blagotvori.module.css';
import { demoVacancies } from '@/lib/blagotvori/demoVacancies';
import type { Vacancy, VacancyCategory } from '@/lib/blagotvori/types';

const categories: Array<'Все добрые дела' | VacancyCategory> = [
  'Все добрые дела',
  'Помощь людям',
  'Природа и животные',
  'Помощь на мероприятиях',
  'Медиа',
  'Дистанционные задания'
];

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function formatTime(value: string | null) {
  if (!value) return '';
  return value.slice(0, 5);
}

function timeRange(vacancy: Vacancy) {
  const start = formatTime(vacancy.start_time);
  const end = formatTime(vacancy.end_time);
  return end ? `${start}–${end}` : start;
}

function ageLabel(vacancy: Vacancy) {
  if (vacancy.min_age && vacancy.max_age) return `${vacancy.min_age}–${vacancy.max_age} лет`;
  if (vacancy.min_age) return `от ${vacancy.min_age} лет`;
  if (vacancy.max_age) return `до ${vacancy.max_age} лет`;
  return 'Возраст не ограничен';
}

function hoursLabel(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1).replace('.', ',');
}

function vacancyStatus(vacancy: Vacancy) {
  if (vacancy.free_slots <= 0) return { label: 'Мест нет', tone: 'full' } as const;
  if (vacancy.free_slots <= 2) return { label: `Осталось ${vacancy.free_slots}`, tone: 'few' } as const;
  return { label: `Свободно ${vacancy.free_slots}`, tone: 'open' } as const;
}

export default function Page() {
  const [vacancies, setVacancies] = useState<Vacancy[]>(demoVacancies);
  const [dataMode, setDataMode] = useState<'demo' | 'live'>('demo');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof categories)[number]>('Все добрые дела');
  const [selected, setSelected] = useState<Vacancy | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadVacancies() {
      try {
        const response = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Не удалось загрузить вакансии.');
        if (!cancelled) {
          setVacancies(Array.isArray(json.vacancies) ? json.vacancies : demoVacancies);
          setDataMode(json.mode === 'live' ? 'live' : 'demo');
        }
      } catch {
        if (!cancelled) {
          setVacancies(demoVacancies);
          setDataMode('demo');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVacancies();
    return () => { cancelled = true; };
  }, []);

  const calendarBase = useMemo(() => {
    const first = vacancies[0]?.event_date || '2026-08-01';
    const { year, month } = dateParts(first);
    return { year, month };
  }, [vacancies]);

  const calendarCells = useMemo(() => {
    const { year, month } = calendarBase;
    const monthIndex = month - 1;
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const firstWeekDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const mondayOffset = firstWeekDay === 0 ? 6 : firstWeekDay - 1;
    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
    ];
  }, [calendarBase]);

  const monthLabel = useMemo(() => {
    const date = new Date(Date.UTC(calendarBase.year, calendarBase.month - 1, 1));
    const label = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [calendarBase]);

  const visibleVacancies = useMemo(
    () => vacancies.filter(item => {
      const sameMonth = dateParts(item.event_date).month === calendarBase.month && dateParts(item.event_date).year === calendarBase.year;
      const sameCategory = filter === 'Все добрые дела' || item.category === filter;
      return sameMonth && sameCategory && item.is_active;
    }),
    [vacancies, filter, calendarBase]
  );

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || sending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const volunteerName = String(formData.get('name') || '').trim();
    const contact = String(formData.get('contact') || '').trim();

    setSending(true);
    setFormMessage('');

    try {
      const response = await fetch('/api/blagotvori/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancy_id: selected.id,
          volunteer_name: volunteerName,
          contact
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Не удалось отправить заявку.');
      setSent(true);
      form.reset();
      const vacanciesResponse = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
      if (vacanciesResponse.ok) {
        const vacanciesJson = await vacanciesResponse.json();
        setVacancies(vacanciesJson.vacancies || vacancies);
      }
    } catch (error: any) {
      setFormMessage(error?.message || 'Не удалось отправить заявку. Попробуй ещё раз.');
    } finally {
      setSending(false);
    }
  }

  function openVacancy(vacancy: Vacancy) {
    setSelected(vacancy);
    setSent(false);
    setFormMessage('');
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#top" aria-label="БлагоТвори. Кемь">
            <span className={styles.brandMark}>Б</span>
            <span><b>БлагоТвори</b><small>Кемский округ</small></span>
          </a>
          <a className={styles.myButton} href="#how">Как участвовать</a>
        </div>
      </header>

      <main id="top">
        <section className={styles.intro}>
          <div className={styles.wrap}>
            <span className={styles.eyebrow}>Волонтёрские вакансии для детей и молодёжи</span>
            <h1>Выбирай доброе дело.<br /><span>Помогай вместе с нами.</span></h1>
            <p>Нажми на вакансию в календаре, прочитай условия и отправь заявку.</p>
          </div>
        </section>

        <section className={styles.calendarSection} aria-labelledby="calendar-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionNumber}>01</span>
                <h2 id="calendar-title">Календарь добрых дел</h2>
              </div>
              <p>{monthLabel}{dataMode === 'demo' ? ' · демонстрационный режим' : ''}</p>
            </div>

            <div className={styles.filters} aria-label="Фильтр вакансий">
              {categories.map(category => (
                <button
                  type="button"
                  key={category}
                  className={filter === category ? styles.filterActive : styles.filterButton}
                  onClick={() => setFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {loading && <div className={styles.emptyState}>Загружаем добрые дела…</div>}

            <div className={styles.calendar}>
              <div className={styles.weekHeader}>
                {weekDays.map(day => <div key={day}>{day}</div>)}
              </div>
              <div className={styles.monthGrid}>
                {calendarCells.map((day, index) => {
                  const items = day ? visibleVacancies.filter(item => dateParts(item.event_date).day === day) : [];
                  return (
                    <div className={day ? styles.day : styles.dayEmpty} key={`${day ?? 'empty'}-${index}`}>
                      {day && <span className={styles.dayNumber}>{day}</span>}
                      {items.map(vacancy => {
                        const status = vacancyStatus(vacancy);
                        return (
                          <button
                            type="button"
                            className={styles.vacancy}
                            key={vacancy.id}
                            onClick={() => openVacancy(vacancy)}
                          >
                            <span className={styles.vacancyCategory}>{vacancy.category}</span>
                            <b>{vacancy.title}</b>
                            <span>{timeRange(vacancy)} · {hoursLabel(vacancy.estimated_minutes)} ч.</span>
                            <em data-tone={status.tone}>{status.label}</em>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.mobileList}>
              {visibleVacancies.map(vacancy => {
                const status = vacancyStatus(vacancy);
                return (
                  <button type="button" className={styles.mobileVacancy} key={vacancy.id} onClick={() => openVacancy(vacancy)}>
                    <span className={styles.mobileDate}>{dateParts(vacancy.event_date).day}<small>{monthLabel.split(' ')[0].toLowerCase()}</small></span>
                    <span className={styles.mobileVacancyCopy}>
                      <small>{vacancy.category}</small>
                      <b>{vacancy.title}</b>
                      <span>{timeRange(vacancy)} · {hoursLabel(vacancy.estimated_minutes)} ч. · {status.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {!loading && !visibleVacancies.length && (
              <div className={styles.emptyState}>В этой категории пока нет вакансий. Попробуй выбрать другой фильтр.</div>
            )}
          </div>
        </section>

        <section className={styles.howSection} id="how" aria-labelledby="how-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionNumber}>02</span>
                <h2 id="how-title">Как всё работает</h2>
              </div>
              <p>Четыре простых шага</p>
            </div>
            <div className={styles.steps}>
              <article><span>1</span><h3>Выбери дело</h3><p>Открой вакансию в календаре и внимательно прочитай условия.</p></article>
              <article><span>2</span><h3>Отправь заявку</h3><p>Укажи имя и контакт. Мы сообщим, когда участие будет подтверждено.</p></article>
              <article><span>3</span><h3>Помоги</h3><p>Приходи вовремя или выполни дистанционное задание по инструкции.</p></article>
              <article><span>4</span><h3>Подтверди результат</h3><p>Отправь ссылку, фотографию или короткий отчёт. Организатор подтвердит часы.</p></article>
            </div>
          </div>
        </section>

        <section className={styles.guidesSection} aria-labelledby="guides-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionNumber}>03</span>
                <h2 id="guides-title">Памятки волонтёру</h2>
              </div>
              <p>Нажми на вопрос, чтобы увидеть ответ</p>
            </div>
            <div className={styles.guides}>
              <details open><summary>Как записаться?</summary><p>Выбери вакансию, нажми «Стать волонтёром», укажи имя и контакт для связи. После отправки дождись подтверждения организатора.</p></details>
              <details><summary>Как подтвердить доброе дело?</summary><p>Способ подтверждения указан в каждой вакансии. Это может быть ссылка на материал, фотография результата или отметка организатора о твоём присутствии.</p></details>
              <details><summary>Как считаются часы?</summary><p>В вакансии указано примерное время. После выполнения организатор подтверждает фактически отработанные часы. Отдельно будет отмечено, внесены ли они на Добро.рф.</p></details>
              <details><summary>Что делать, если не можешь прийти?</summary><p>Сообщи об этом заранее организатору. Тогда освободившееся место сможет занять другой волонтёр.</p></details>
              <details><summary>Главные правила безопасности</summary><p>Выполняй только указанную работу, следуй инструкции взрослого, не уходи с площадки без предупреждения и сразу сообщай о плохом самочувствии.</p></details>
              <details><summary>Можно ли публиковать фотографии?</summary><p>Фотографии людей можно делать и публиковать только с разрешения. Не снимай документы, личные данные и ситуации, которые могут поставить человека в неловкое положение.</p></details>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div><b>БлагоТвори. Кемь</b><span>Календарь волонтёрских вакансий Кемского муниципального округа</span></div>
          <a href="/admin-blagotvori">Вход организатора</a>
        </div>
      </footer>

      {selected && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSelected(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="vacancy-title" onMouseDown={event => event.stopPropagation()}>
            <button className={styles.closeButton} type="button" onClick={() => setSelected(null)} aria-label="Закрыть">×</button>
            <span className={styles.modalCategory}>{selected.category}</span>
            <h2 id="vacancy-title">{selected.title}</h2>
            <div className={styles.modalFacts}>
              <div><span>Когда</span><b>{dateParts(selected.event_date).day} {monthLabel.split(' ')[0].toLowerCase()}, {timeRange(selected)}</b></div>
              <div><span>Где</span><b>{selected.place}</b></div>
              <div><span>Формат</span><b>{selected.format}</b></div>
              <div><span>Возраст</span><b>{ageLabel(selected)}</b></div>
              <div><span>Время</span><b>примерно {hoursLabel(selected.estimated_minutes)} ч.</b></div>
              <div><span>Места</span><b>{selected.free_slots} из {selected.slots} свободно</b></div>
            </div>
            <div className={styles.modalText}>
              <h3>Что предстоит делать</h3>
              <p>{selected.description}</p>
              <ul>{selected.duties.map(item => <li key={item}>{item}</li>)}</ul>
              <h3>Как подтвердить участие</h3>
              <p>{selected.confirmation_text}</p>
              <h3>Что взять с собой</h3>
              <p>{selected.take_with_you}</p>
              {selected.contact_person && <><h3>Кто отвечает за вакансию</h3><p>{selected.contact_person}</p></>}
            </div>

            {sent ? (
              <div className={styles.successBox}>
                <b>Заявка отправлена</b>
                <p>Организатор увидит её в кабинете и свяжется с тобой после проверки.</p>
              </div>
            ) : selected.free_slots <= 0 ? (
              <div className={styles.successBox}><b>Свободных мест нет</b><p>Выбери другое доброе дело в календаре.</p></div>
            ) : (
              <form className={styles.applicationForm} onSubmit={submitApplication}>
                <h3>Стать волонтёром</h3>
                <label>Имя и фамилия<input name="name" required placeholder="Например: Анна Иванова" /></label>
                <label>Контакт для связи<input name="contact" required placeholder="Телефон или ссылка на профиль" /></label>
                <label className={styles.checkbox}><input type="checkbox" required /><span>Я прочитал(а) условия и смогу участвовать в указанное время.</span></label>
                <button type="submit" disabled={sending}>{sending ? 'Отправляем…' : 'Отправить заявку'}</button>
                {formMessage && <small>{formMessage}</small>}
                {!formMessage && <small>{dataMode === 'live' ? 'Заявка появится в кабинете организатора.' : 'Пока работает демонстрационный режим: отдельная база ещё не подключена.'}</small>}
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
