'use client';

import { useEffect, useRef } from 'react';
import styles from './admin-vacancy-delete.module.css';

type AdminVacancy = {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
};

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function AdminVacancyDeleteEnhancer() {
  const passwordRef = useRef('');

  useEffect(() => {
    let stopped = false;
    let vacancies: AdminVacancy[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const previousFetch = window.fetch.bind(window);

    function requestUrl(input: RequestInfo | URL) {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return new URL(raw, window.location.origin);
    }

    function findVacancy(article: HTMLElement) {
      const title = article.querySelector('h3')?.textContent?.trim() || '';
      const text = article.textContent || '';
      const candidates = vacancies.filter(vacancy => vacancy.title === title);
      return candidates.find(vacancy => {
        return text.includes(formatDate(vacancy.event_date).replace(` ${new Date(vacancy.event_date).getUTCFullYear()} г.`, '')) &&
          text.includes(vacancy.start_time.slice(0, 5));
      }) || candidates[0] || null;
    }

    async function sendDelete(vacancy: AdminVacancy, deleteApplications: boolean) {
      const response = await previousFetch('/api/blagotvori/admin-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': passwordRef.current
        },
        body: JSON.stringify({
          vacancy_id: vacancy.id,
          delete_applications: deleteApplications
        })
      });
      const json = await response.json();
      return { response, json };
    }

    function refreshCabinetWithoutLogout(article: HTMLElement, vacancyId: string) {
      vacancies = vacancies.filter(item => item.id !== vacancyId);
      article.remove();

      const refreshButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        candidate => candidate.textContent?.trim() === 'Обновить'
      );

      if (refreshButton && !refreshButton.disabled) {
        refreshButton.click();
      } else {
        scheduleApply([0, 200]);
      }
    }

    async function removeVacancy(vacancy: AdminVacancy, button: HTMLButtonElement) {
      if (!passwordRef.current) {
        window.alert('Не удалось получить пароль текущей сессии. Обновите страницу и снова войдите в кабинет.');
        return;
      }

      const article = button.closest<HTMLElement>('article[class*="vacancyCard"]');
      if (!article) {
        window.alert('Не удалось определить карточку активности. Обновите список и повторите удаление.');
        return;
      }

      const firstConfirmation = window.confirm(
        `Удалить активность «${vacancy.title}» от ${formatDate(vacancy.event_date)}?\n\nЭто действие нельзя отменить.`
      );
      if (!firstConfirmation) return;

      button.disabled = true;
      const initialText = button.textContent || 'Удалить';
      button.textContent = 'Удаляем…';

      try {
        let { response, json } = await sendDelete(vacancy, false);

        if (response.status === 409 && json.requires_confirmation) {
          const count = Number(json.application_count) || 0;
          const secondConfirmation = window.confirm(
            [
              `У активности «${vacancy.title}» есть ${count} связанных заявок или отчётов.`,
              '',
              'При продолжении они также будут удалены без возможности восстановления.',
              '',
              'Удалить активность вместе со всеми связанными данными?'
            ].join('\n')
          );

          if (!secondConfirmation) return;
          ({ response, json } = await sendDelete(vacancy, true));
        }

        if (!response.ok) throw new Error(json.error || 'Не удалось удалить активность.');

        const removed = Number(json.deleted_applications) || 0;
        refreshCabinetWithoutLogout(article, vacancy.id);
        window.alert(
          removed > 0
            ? `Активность удалена. Вместе с ней удалено связанных записей: ${removed}.`
            : 'Активность удалена.'
        );
      } catch (error: unknown) {
        window.alert(error instanceof Error ? error.message : 'Не удалось удалить активность.');
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = initialText;
        }
      }
    }

    function applyButtons() {
      if (stopped || !vacancies.length) return;

      const cards = Array.from(document.querySelectorAll<HTMLElement>('article[class*="vacancyCard"]'));
      cards.forEach(article => {
        const vacancy = findVacancy(article);
        const actions = article.querySelector<HTMLElement>('.vacancy-edit-actions');
        const existing = article.querySelector<HTMLButtonElement>('[data-vacancy-delete-button]');

        if (!vacancy || !actions) {
          existing?.remove();
          return;
        }
        if (existing?.dataset.vacancyId === vacancy.id) return;
        existing?.remove();

        const button = document.createElement('button');
        button.type = 'button';
        button.className = styles.deleteButton;
        button.textContent = 'Удалить';
        button.setAttribute('data-vacancy-delete-button', 'true');
        button.dataset.vacancyId = vacancy.id;
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          void removeVacancy(vacancy, button);
        });
        actions.appendChild(button);
      });
    }

    function scheduleApply(delays = [0, 150, 450]) {
      delays.forEach(delay => timers.push(setTimeout(applyButtons, delay)));
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const headers = new Headers(init?.headers);
      const password = headers.get('x-admin-password');
      if (password) passwordRef.current = password;

      const response = await previousFetch(input, init);
      const method = String(init?.method || 'GET').toUpperCase();

      if (url.pathname === '/api/blagotvori/admin' && method === 'GET' && response.ok) {
        try {
          const json = await response.clone().json();
          vacancies = Array.isArray(json.vacancies) ? json.vacancies : [];
          scheduleApply([0, 200, 600]);
        } catch {
          // Основной кабинет продолжает работать без кнопок удаления.
        }
      }
      return response;
    };

    function capturePassword(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'password') {
        passwordRef.current = target.value;
      }
    }

    function handleClick() {
      scheduleApply();
    }

    const observer = new MutationObserver(() => scheduleApply([0, 100]));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('input', capturePassword, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      stopped = true;
      window.fetch = previousFetch;
      observer.disconnect();
      document.removeEventListener('input', capturePassword, true);
      document.removeEventListener('click', handleClick, true);
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return null;
}
