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
  vacancy_id: string;
  volunteer_name: string;
  contact: string;
  status: string;
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
      const people = new Map<string, string>();
      applications
        .filter(application => application.vacancy_id === vacancyId && !inactiveStatuses.has(application.status))
        .forEach(application => {
          const key = personKey(application);
          if (!people.has(key)) people.set(key, String(application.volunteer_name || '').trim().replace(/\s+/g, ' '));
        });
      return Array.from(people.values()).filter(Boolean);
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

        const names = participantsFor(vacancy.id);
        const signature = `${vacancy.id}|${names.join('|')}`;
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
        counter.textContent = `${names.length} из ${vacancy.slots}`;
        head.appendChild(counter);
        section.appendChild(head);

        if (names.length) {
          const list = document.createElement('ul');
          list.className = styles.teamList;
          names.forEach(name => {
            const item = document.createElement('li');
            item.textContent = name;
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

    async function loadTeams() {
      const password = passwordRef.current;
      if (!password || stopped) return;

      try {
        const response = await fetch('/api/blagotvori/admin', {
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

      const label = (button.textContent || '').trim();
      if (label === 'Скрыть') {
        const card = button.closest<HTMLElement>('article[class*="vacancyCard"]');
        const title = card?.querySelector('h3')?.textContent?.trim() || 'эту вакансию';
        const confirmed = window.confirm(`Скрыть вакансию «${title}» с сайта? Заявки и отчёты сохранятся.`);
        if (!confirmed) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      scheduleApply();
      if (/Открыть кабинет|Обновить|Сохранить|Опубликовать|Показать|Скрыть/.test(label)) {
        timers.push(setTimeout(() => { void loadTeams(); }, 650));
        timers.push(setTimeout(() => { void loadTeams(); }, 1500));
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
