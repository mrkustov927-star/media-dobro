'use client';

import { FormEvent, useMemo, useState } from 'react';
import styles from './blagotvori.module.css';

type Category =
  | 'Помощь людям'
  | 'Природа и животные'
  | 'Помощь на мероприятиях'
  | 'Медиа'
  | 'Дистанционные задания';

type Vacancy = {
  id: string;
  day: number;
  title: string;
  category: Category;
  time: string;
  place: string;
  hours: number;
  slots: number;
  freeSlots: number;
  age: string;
  format: 'Очно' | 'Дистанционно';
  confirmation: string;
  description: string;
  duties: string[];
  takeWithYou: string;
};

const categories: Array<'Все добрые дела' | Category> = [
  'Все добрые дела',
  'Помощь людям',
  'Природа и животные',
  'Помощь на мероприятиях',
  'Медиа',
  'Дистанционные задания'
];

const vacancies: Vacancy[] = [
  {
    id: 'festival-helper',
    day: 15,
    title: 'Помощь на семейном фестивале',
    category: 'Помощь на мероприятиях',
    time: '12:00–16:00',
    place: 'Центр культуры',
    hours: 4,
    slots: 5,
    freeSlots: 2,
    age: 'от 14 лет',
    format: 'Очно',
    confirmation: 'Организатор отметит участие и фактически отработанное время.',
    description: 'Помочь встретить участников, подсказать дорогу к площадкам и поддерживать порядок в рабочей зоне.',
    duties: ['Прийти за 20 минут до начала', 'Пройти короткий инструктаж', 'Помогать участникам и организатору'],
    takeWithYou: 'Удобную одежду, воду и заряженный телефон.'
  },
  {
    id: 'media-photo',
    day: 18,
    title: 'Фотосъёмка доброго дела',
    category: 'Медиа',
    time: '14:00–16:00',
    place: 'Место будет указано после записи',
    hours: 2,
    slots: 2,
    freeSlots: 1,
    age: 'от 12 лет',
    format: 'Очно',
    confirmation: 'Нужно отправить ссылку на папку с фотографиями.',
    description: 'Сделать понятный фотоотчёт: общий план, процесс работы, детали и итоговый результат.',
    duties: ['Снять не менее 15 удачных кадров', 'Не фотографировать людей без разрешения', 'Загрузить материалы в одну папку'],
    takeWithYou: 'Телефон или фотоаппарат с заряженной батареей.'
  },
  {
    id: 'books-help',
    day: 22,
    title: 'Помощь при сборе книг',
    category: 'Помощь людям',
    time: '15:00–18:00',
    place: 'Кемь, точный адрес в подтверждённой заявке',
    hours: 3,
    slots: 6,
    freeSlots: 4,
    age: 'от 12 лет',
    format: 'Очно',
    confirmation: 'Организатор подтвердит присутствие и количество часов.',
    description: 'Принять книги, рассортировать их по возрасту читателей и аккуратно упаковать для передачи.',
    duties: ['Принимать книги', 'Сортировать по категориям', 'Подписывать и собирать коробки'],
    takeWithYou: 'Ничего специального брать не нужно.'
  },
  {
    id: 'remote-text',
    day: 25,
    title: 'Подготовить текст для доброй акции',
    category: 'Дистанционные задания',
    time: 'До 20:00',
    place: 'Можно выполнить из дома',
    hours: 2,
    slots: 3,
    freeSlots: 3,
    age: 'от 13 лет',
    format: 'Дистанционно',
    confirmation: 'Нужно отправить ссылку на документ с готовым текстом.',
    description: 'Подготовить короткий и понятный текст о предстоящей благотворительной акции по выданным фактам.',
    duties: ['Изучить материалы', 'Написать текст без выдуманных фактов', 'Проверить имена, даты и ссылки'],
    takeWithYou: 'Доступ к интернету и документу для работы.'
  }
];

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function vacancyStatus(vacancy: Vacancy) {
  if (vacancy.freeSlots <= 0) return { label: 'Мест нет', tone: 'full' } as const;
  if (vacancy.freeSlots <= 2) return { label: `Осталось ${vacancy.freeSlots}`, tone: 'few' } as const;
  return { label: `Свободно ${vacancy.freeSlots}`, tone: 'open' } as const;
}

export default function Page() {
  const [filter, setFilter] = useState<(typeof categories)[number]>('Все добрые дела');
  const [selected, setSelected] = useState<Vacancy | null>(null);
  const [sent, setSent] = useState(false);

  const calendarCells = useMemo(() => {
    const year = 2026;
    const monthIndex = 7;
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const firstWeekDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const mondayOffset = firstWeekDay === 0 ? 6 : firstWeekDay - 1;
    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
    ];
  }, []);

  const visibleVacancies = useMemo(
    () => vacancies.filter(item => filter === 'Все добрые дела' || item.category === filter),
    [filter]
  );

  function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  function openVacancy(vacancy: Vacancy) {
    setSelected(vacancy);
    setSent(false);
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
              <p>Август 2026 · демонстрационная версия</p>
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

            <div className={styles.calendar}>
              <div className={styles.weekHeader}>
                {weekDays.map(day => <div key={day}>{day}</div>)}
              </div>
              <div className={styles.monthGrid}>
                {calendarCells.map((day, index) => {
                  const items = day ? visibleVacancies.filter(item => item.day === day) : [];
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
                            <span>{vacancy.time} · {vacancy.hours} ч.</span>
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
                    <span className={styles.mobileDate}>{vacancy.day}<small>августа</small></span>
                    <span className={styles.mobileVacancyCopy}>
                      <small>{vacancy.category}</small>
                      <b>{vacancy.title}</b>
                      <span>{vacancy.time} · {vacancy.hours} ч. · {status.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {!visibleVacancies.length && (
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
              <details open>
                <summary>Как записаться?</summary>
                <p>Выбери вакансию, нажми «Стать волонтёром», укажи имя и контакт для связи. После отправки дождись подтверждения организатора.</p>
              </details>
              <details>
                <summary>Как подтвердить доброе дело?</summary>
                <p>Способ подтверждения указан в каждой вакансии. Это может быть ссылка на материал, фотография результата или отметка организатора о твоём присутствии.</p>
              </details>
              <details>
                <summary>Как считаются часы?</summary>
                <p>В вакансии указано примерное время. После выполнения организатор подтверждает фактически отработанные часы. Отдельно будет отмечено, внесены ли они на Добро.рф.</p>
              </details>
              <details>
                <summary>Что делать, если не можешь прийти?</summary>
                <p>Сообщи об этом заранее организатору. Тогда освободившееся место сможет занять другой волонтёр.</p>
              </details>
              <details>
                <summary>Главные правила безопасности</summary>
                <p>Выполняй только указанную работу, следуй инструкции взрослого, не уходи с площадки без предупреждения и сразу сообщай о плохом самочувствии.</p>
              </details>
              <details>
                <summary>Можно ли публиковать фотографии?</summary>
                <p>Фотографии людей можно делать и публиковать только с разрешения. Не снимай документы, личные данные и ситуации, которые могут поставить человека в неловкое положение.</p>
              </details>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div><b>БлагоТвори. Кемь</b><span>Календарь волонтёрских вакансий Кемского муниципального округа</span></div>
          <a href="/admin">Вход организатора</a>
        </div>
      </footer>

      {selected && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSelected(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="vacancy-title" onMouseDown={event => event.stopPropagation()}>
            <button className={styles.closeButton} type="button" onClick={() => setSelected(null)} aria-label="Закрыть">×</button>
            <span className={styles.modalCategory}>{selected.category}</span>
            <h2 id="vacancy-title">{selected.title}</h2>
            <div className={styles.modalFacts}>
              <div><span>Когда</span><b>{selected.day} августа, {selected.time}</b></div>
              <div><span>Где</span><b>{selected.place}</b></div>
              <div><span>Формат</span><b>{selected.format}</b></div>
              <div><span>Возраст</span><b>{selected.age}</b></div>
              <div><span>Время</span><b>примерно {selected.hours} ч.</b></div>
              <div><span>Места</span><b>{selected.freeSlots} из {selected.slots} свободно</b></div>
            </div>
            <div className={styles.modalText}>
              <h3>Что предстоит делать</h3>
              <p>{selected.description}</p>
              <ul>{selected.duties.map(item => <li key={item}>{item}</li>)}</ul>
              <h3>Как подтвердить участие</h3>
              <p>{selected.confirmation}</p>
              <h3>Что взять с собой</h3>
              <p>{selected.takeWithYou}</p>
            </div>

            {sent ? (
              <div className={styles.successBox}>
                <b>Заявка заполнена</b>
                <p>Это демонстрационная версия. После подключения отдельной базы заявка будет сохраняться и появляться в кабинете организатора.</p>
              </div>
            ) : (
              <form className={styles.applicationForm} onSubmit={submitApplication}>
                <h3>Стать волонтёром</h3>
                <label>Имя и фамилия<input name="name" required placeholder="Например: Анна Иванова" /></label>
                <label>Контакт для связи<input name="contact" required placeholder="Телефон или ссылка на профиль" /></label>
                <label className={styles.checkbox}><input type="checkbox" required /><span>Я прочитал(а) условия и смогу участвовать в указанное время.</span></label>
                <button type="submit">Отправить заявку</button>
                <small>Пока форма работает в режиме прототипа и не передаёт личные данные.</small>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
