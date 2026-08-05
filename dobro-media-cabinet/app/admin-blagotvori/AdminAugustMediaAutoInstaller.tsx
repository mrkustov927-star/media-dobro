'use client';

import { useEffect, useRef } from 'react';

const storageKey = 'blagotvori-august-activities-installed-v2';
const requiredVacancies = [
  ['Медиа-команда выезда в приют «Уши, лапы, хвост»', '2026-08-14'],
  ['Помощь в установке выставки «В тылу ковалась Победа: Карельский фронт»', '2026-08-16'],
  ['Медиа-команда акции «Символ народа»', '2026-08-22'],
  ['Подготовка видеоматериала или публикации «Памяти Курской дуги»', '2026-08-23'],
  ['Кино снималось здесь: Кемь и Карелия', '2026-08-25']
] as const;

function hasAllVacancies(value: unknown) {
  if (!Array.isArray(value)) return false;
  return requiredVacancies.every(([title, eventDate]) =>
    value.some(item => {
      if (!item || typeof item !== 'object') return false;
      const vacancy = item as { title?: unknown; event_date?: unknown };
      return vacancy.title === title && vacancy.event_date === eventDate;
    })
  );
}

export default function AdminAugustMediaAutoInstaller() {
  const passwordRef = useRef('');

  useEffect(() => {
    let stopped = false;
    let running = false;
    const previousFetch = window.fetch.bind(window);

    function requestUrl(input: RequestInfo | URL) {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return new URL(raw, window.location.origin);
    }

    async function installAugustVacancies(password: string, vacancies: unknown) {
      if (stopped || running || !password) return;

      if (hasAllVacancies(vacancies)) {
        window.localStorage.setItem(storageKey, 'done');
        return;
      }

      if (window.localStorage.getItem(storageKey) === 'done') return;

      running = true;
      try {
        const response = await previousFetch('/api/blagotvori/admin-august-media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': password
          }
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Не удалось добавить августовские активности.');

        window.localStorage.setItem(storageKey, 'done');

        if (Number(json.created) > 0) {
          window.alert(
            `Добавлены новые августовские активности: ${json.created}. Список вакансий будет обновлён.`
          );

          const refreshButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
            button => button.textContent?.trim() === 'Обновить'
          );
          window.setTimeout(() => refreshButton?.click(), 100);
        }
      } catch (error: unknown) {
        window.alert(error instanceof Error ? error.message : 'Не удалось добавить августовские активности.');
      } finally {
        running = false;
      }
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const requestMethod = input instanceof Request ? input.method : undefined;
      const method = String(init?.method || requestMethod || 'GET').toUpperCase();
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const password = headers.get('x-admin-password');
      if (password) passwordRef.current = password;

      const response = await previousFetch(input, init);

      if (url.pathname === '/api/blagotvori/admin' && method === 'GET' && response.ok) {
        void response
          .clone()
          .json()
          .then(json => installAugustVacancies(passwordRef.current, json?.vacancies))
          .catch(() => {
            // Основной кабинет продолжит работать, если автоматическое добавление не выполнилось.
          });
      }

      return response;
    };

    function capturePassword(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'password') {
        passwordRef.current = target.value;
      }
    }

    document.addEventListener('input', capturePassword, true);

    return () => {
      stopped = true;
      window.fetch = previousFetch;
      document.removeEventListener('input', capturePassword, true);
    };
  }, []);

  return null;
}
