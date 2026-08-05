'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './admin-august-actions.module.css';

const augustVacancies = [
  ['Онлайн-акция «Расскажи о своём друге»', '2026-08-10'],
  ['Сбор карточек для выставки «Носики Первых»', '2026-08-10'],
  ['Помощь в оформлении выставки «Носики Первых»', '2026-08-12'],
  ['Добровольческий выезд в приют «Уши, лапы, хвост»', '2026-08-14']
] as const;

function normalizeTime(value: string) {
  const time = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null;
}

function hasAllAugustVacancies(value: unknown) {
  if (!Array.isArray(value)) return false;

  return augustVacancies.every(([title, eventDate]) =>
    value.some(vacancy => {
      if (!vacancy || typeof vacancy !== 'object') return false;
      const item = vacancy as { title?: unknown; event_date?: unknown };
      return item.title === title && item.event_date === eventDate;
    })
  );
}

export default function AdminAugustActionsEnhancer() {
  const passwordRef = useRef('');
  const [cabinetReady, setCabinetReady] = useState(false);
  const [cardsExist, setCardsExist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const requestMethod = input instanceof Request ? input.method : undefined;
      const method = String(init?.method || requestMethod || 'GET').toUpperCase();
      const parsedUrl = new URL(url, window.location.origin);

      if (parsedUrl.pathname === '/api/blagotvori/admin') {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        const password = headers.get('x-admin-password');
        if (password) passwordRef.current = password;
      }

      const response = await originalFetch(input, init);

      if (parsedUrl.pathname === '/api/blagotvori/admin' && method === 'GET' && response.ok) {
        void response
          .clone()
          .json()
          .then(json => {
            setCardsExist(hasAllAugustVacancies(json?.vacancies));
          })
          .catch(() => {
            // Основной кабинет продолжит работать, даже если проверка карточек не удалась.
          });
      }

      return response;
    };

    function detectCabinet() {
      const buttons = Array.from(document.querySelectorAll('button'));
      setCabinetReady(buttons.some(button => /Создать вакансию|Новая вакансия/.test(button.textContent || '')));
    }

    function capturePassword(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'password') {
        passwordRef.current = target.value;
      }
    }

    const observer = new MutationObserver(detectCabinet);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('input', capturePassword, true);
    detectCabinet();

    return () => {
      window.fetch = originalFetch;
      observer.disconnect();
      document.removeEventListener('input', capturePassword, true);
    };
  }, []);

  async function addAugustActions() {
    if (loading) return;

    const startInput = window.prompt(
      'Во сколько начнётся посещение приюта «Уши, лапы, хвост» 14 августа? Введите время в формате ЧЧ:ММ.'
    );
    if (startInput === null) return;
    const shelterStart = normalizeTime(startInput);
    if (!shelterStart) {
      window.alert('Время начала нужно указать в формате ЧЧ:ММ, например 10:00.');
      return;
    }

    const endInput = window.prompt(
      'Во сколько завершится посещение приюта 14 августа? Введите время в формате ЧЧ:ММ.'
    );
    if (endInput === null) return;
    const shelterEnd = normalizeTime(endInput);
    if (!shelterEnd) {
      window.alert('Время окончания нужно указать в формате ЧЧ:ММ, например 12:00.');
      return;
    }

    const approved = window.confirm(
      [
        'Будут созданы или обновлены 4 карточки:',
        '',
        '• 10–14 августа — «Расскажи о своём друге»;',
        '• 10–11 августа — сбор карточек «Носики Первых»;',
        '• 12 августа, 10:00–11:00 — оформление выставки;',
        `• 14 августа, ${shelterStart}–${shelterEnd} — помощь приюту.`,
        '',
        'Продолжить?'
      ].join('\n')
    );
    if (!approved) return;

    const password = passwordRef.current;
    if (!password) {
      window.alert('Не удалось получить пароль текущей сессии. Обновите страницу и снова войдите в кабинет.');
      return;
    }

    setLoading(true);
    setMessage('Добавляем карточки…');

    try {
      const response = await fetch('/api/blagotvori/admin-august-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
        },
        body: JSON.stringify({
          shelter_start_time: shelterStart,
          shelter_end_time: shelterEnd
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Не удалось добавить карточки.');

      const result = `Готово: создано ${json.created}, обновлено ${json.updated}.`;
      setCardsExist(true);
      setMessage(result);
      window.alert(`${result}\n\nСтраница кабинета будет обновлена.`);
      window.location.reload();
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Не удалось добавить карточки.';
      setMessage(text);
      window.alert(text);
    } finally {
      setLoading(false);
    }
  }

  if (!cabinetReady || cardsExist) return null;

  return (
    <aside className={styles.panel} aria-label="Августовские акции">
      <span className={styles.badge}>10–14 августа</span>
      <b>Неделя заботы о животных</b>
      <p>Четыре готовые карточки без повторного ручного заполнения.</p>
      <button type="button" onClick={addAugustActions} disabled={loading}>
        {loading ? 'Добавляем…' : 'Добавить карточки'}
      </button>
      {message && <small>{message}</small>}
    </aside>
  );
}
