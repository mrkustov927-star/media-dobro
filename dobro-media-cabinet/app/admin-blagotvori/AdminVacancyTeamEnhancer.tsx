'use client';

import { useEffect, useRef } from 'react';
import styles from './admin-vacancy-team.module.css';

type AdminVacancy = {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  slots: number;
};

type AdminApplication = {
  id: string;
  vacancy_id: string;
  volunteer_name: string;
  contact: string;
  status: string;
  access_code: string;
};

const inactiveStatuses = new Set(['Отменено', 'Не участвовал']);

function normalize(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function personKey(application: AdminApplication) {
  return `${normalize(application.volunteer_name)}|${normalize(application.contact).replace(/\s+/g, '')}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export default function AdminVacancyTeamEnhancer() {
  const passwordRef = useRef('');

  useEffect(() => {
    let stopped = false;
    let vacancies: AdminVacancy[] = [];
    let applications: AdminApplication[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    function participantsFor(vacancyId: string) {
      const people = new Map<string, AdminApplication>();
      applications
        .filter(application => application.vacancy_id === vacancyId && !inactiveStatuses.has(application.status))
        .forEach(application => {
          const key = personKey(application);
          const existing = people.get(key);
          if (!existing || existing.status === 'Заявка подана') people.set(key, application);
        });
      return Array.from(people.values());
    }

    function findVacancy(article: HTMLElement) {
      const title = article.querySelector('h3')?.textContent?.trim() || '';
      const text = article.textContent || '';
      const candidates = vacancies.filter(vacancy => vacancy.title === title);
      return candidates.find(vacancy => {
        return text.includes(formatDate(vacancy.event_date)) && text.includes(vacancy.start_time.slice(0, 5));
      }) || candidates[0] || null;
    }

    function applyTeams() {
      if (stopped || !vacancies.length) return;

      const cards = Array.from(document.querySelectorAll<HTMLElement>('article[class*="vacancyCard"]'));
      cards.forEach(article => {
        const vacancy = findVacancy(article);
        const existing = article.querySelector<HTMLElement>('[data-admin-vacancy-team]');

        if (!vacancy) {
          existing?.remove();
          return;
        }

        const participants = participantsFor(vacancy.id);
        const signature = `${vacancy.id}|${participants.map(item => `${item.id}:${item.status}`).join('|')}`;
        if (existing?.dataset.signature === signature) return;
        existing?.remove();

        const section = document.createElement('section');
        section.className = styles.team;
        section.setAttribute('data-admin-vacancy-team', 'true');
        section.dataset.signature = signature;

        const head = document.createElement('div');
        head.className = styles.teamHead;

        const heading = document.createElement('b');
        heading.textContent = 'Кто работает над задачей';
        head.appendChild(heading);

        const counter = document.createElement('span');
        counter.textContent = `${participants.length} из ${vacancy.slots}`;
        head.appendChild(counter);
        section.appendChild(head);

        if (participants.length) {
          const list = document.createElement('ul');
          list.className = styles.teamList;
          participants.forEach(application => {
            const item = document.createElement('li');

            const name = document.createElement('b');
            name.textContent = String(application.volunteer_name || '').trim().replace(/\s+/g, ' ');
            item.appendChild(name);

            const meta = document.createElement('div');
            meta.className = styles.personMeta;

            const status = document.createElement('span');
            status.textContent = application.status;
            meta.appendChild(status);

            const code = document.createElement('code');
            code.textContent = application.access_code;
            code.title = 'Персональный код заявки для ребёнка и наставника';
            meta.appendChild(code);

            item.appendChild(meta);
            list.appendChild(item);
          });
          section.appendChild(list);
        } else {
          const empty = document.createElement('p');
          empty.className = styles.empty;
          empty.textContent = 'Пока никто не записался.';
          section.appendChild(empty);
        }

        const actions = article.querySelector<HTMLElement>('.vacancy-edit-actions');
        if (actions) article.insertBefore(section, actions);
        else article.appendChild(section);
      });
    }

    function scheduleApply(delays = [0, 120, 350]) {
      delays.forEach(delay => timers.push(setTimeout(applyTeams, delay)));
    }

    function readPasswordFromPage() {
      const field = document.querySelector<HTMLInputElement>('input[type="password"]');
      if (field?.value) passwordRef.current = field.value;
      return passwordRef.current;
    }

    async function loadTeams() {
      const password = readPasswordFromPage();
      if (!password || stopped) return;

      try {
        const response = await fetch('/api/blagotvori/admin/application-codes', {
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': password
          },
          cache: 'no-store'
        });
        if (!response.ok || stopped) return;
        const json = await response.json();
        vacancies = Array.isArray(json.vacancies) ? json.vacancies : [];
        applications = Array.isArray(json.applications) ? json.applications : [];
        scheduleApply([0, 200, 600]);
      } catch {
        // Кабинет продолжает работать без дополнительного блока команды.
      }
    }

    function handleInput(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'password') {
        passwordRef.current = target.value;
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const button = target?.closest('button');
      if (!button) return;

      readPasswordFromPage();
      scheduleApply();
      const label = button.textContent || '';
      if (/Открыть кабинет|Обновить|Вакансии|Сохранить|Опубликовать|Показать|Скрыть/.test(label)) {
        timers.push(setTimeout(() => { void loadTeams(); }, 450));
        timers.push(setTimeout(() => { void loadTeams(); }, 1200));
      }
    }

    document.addEventListener('input', handleInput, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      stopped = true;
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('click', handleClick, true);
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return null;
}
