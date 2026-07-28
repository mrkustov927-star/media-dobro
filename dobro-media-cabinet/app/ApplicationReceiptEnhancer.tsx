'use client';

import { useEffect } from 'react';

type StoredReceipt = {
  access_code: string;
  vacancy_id: string;
  title: string;
  volunteer_name: string;
  saved_at: string;
};

const storageKey = 'blagotvori_application_receipts_v1';

function normalizeCode(value: unknown) {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  return clean.length === 12 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}` : String(value || '');
}

function readReceipts(): StoredReceipt[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value) ? value.filter(item => item?.access_code) : [];
  } catch {
    return [];
  }
}

function saveReceipt(receipt: StoredReceipt) {
  const current = readReceipts().filter(item => normalizeCode(item.access_code) !== normalizeCode(receipt.access_code));
  const next = [receipt, ...current].slice(0, 50);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('blagotvori-access-saved', { detail: receipt }));
}

function applyParticipationBadges() {
  const receipts = readReceipts();
  const titles = new Set(receipts.map(item => item.title).filter(Boolean));
  if (!titles.size) return;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button[class*="vacancy"], button[class*="nearestCard"], button[class*="mobileVacancy"], button[class*="heroMiniCard"]'
    )
  );

  candidates.forEach(element => {
    const title = Array.from(titles).find(item => (element.textContent || '').includes(item));
    const existing = element.querySelector<HTMLElement>('[data-my-activity]');
    if (!title) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const badge = document.createElement('span');
    badge.className = 'my-activity-badge';
    badge.setAttribute('data-my-activity', 'true');
    badge.textContent = '✓ Вы участвуете';
    element.appendChild(badge);
  });

  const modalTitle = document.getElementById('vacancy-title');
  const dialog = modalTitle?.closest<HTMLElement>('[role="dialog"]');
  const modalReceipt = receipts.find(item => item.title === modalTitle?.textContent?.trim());
  const modalBadge = dialog?.querySelector<HTMLElement>('[data-my-activity-modal]');

  if (!modalReceipt) modalBadge?.remove();
  else if (dialog && modalTitle && !modalBadge) {
    const badge = document.createElement('div');
    badge.className = 'my-activity-modal-badge';
    badge.setAttribute('data-my-activity-modal', 'true');
    badge.textContent = '✓ Эта активность закреплена за вами';
    modalTitle.insertAdjacentElement('afterend', badge);
  }
}

function injectReceipt(receipt: StoredReceipt) {
  const dialog = document.getElementById('vacancy-title')?.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) return;

  const existing = dialog.querySelector<HTMLElement>('[data-application-receipt]');
  if (existing?.dataset.accessCode === receipt.access_code) return;
  existing?.remove();

  const host = dialog.querySelector<HTMLElement>('[class*="successBox"]') || dialog.querySelector<HTMLElement>('form[class*="applicationForm"]');
  if (!host) return;

  const card = document.createElement('section');
  card.className = 'application-receipt-card';
  card.setAttribute('data-application-receipt', 'true');
  card.dataset.accessCode = receipt.access_code;

  const heading = document.createElement('b');
  heading.textContent = 'Активность закреплена за вами ✓';
  card.appendChild(heading);

  const lead = document.createElement('p');
  lead.textContent = 'Сохраните код. По нему ребёнок и наставник смогут проверить статус заявки без передачи контакта.';
  card.appendChild(lead);

  const code = document.createElement('strong');
  code.className = 'application-receipt-code';
  code.textContent = receipt.access_code;
  card.appendChild(code);

  const actions = document.createElement('div');
  actions.className = 'application-receipt-actions';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Скопировать код';
  copy.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(receipt.access_code);
    copy.textContent = 'Код скопирован ✓';
  });
  actions.appendChild(copy);

  const check = document.createElement('button');
  check.type = 'button';
  check.textContent = 'Проверить заявку';
  check.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('blagotvori-open-access', { detail: receipt }));
    dialog.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]')?.click();
    window.setTimeout(() => document.getElementById('volunteer-journey-host')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  });
  actions.appendChild(check);

  card.appendChild(actions);
  host.insertAdjacentElement('afterend', card);
}

export default function ApplicationReceiptEnhancer() {
  useEffect(() => {
    let stopped = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const originalFetch = window.fetch.bind(window);

    function scheduleApply() {
      [0, 180, 500, 1200].forEach(delay => timers.push(window.setTimeout(applyParticipationBadges, delay)));
    }

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      try {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

        if (url.includes('/api/blagotvori/applications') && method === 'POST') {
          const json = await response.clone().json();
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
          const accessCode = normalizeCode(json.access_code);

          if (accessCode) {
            const receipt: StoredReceipt = {
              access_code: accessCode,
              vacancy_id: String(body.vacancy_id || ''),
              title: document.getElementById('vacancy-title')?.textContent?.trim() || 'Доброе дело',
              volunteer_name: String(body.volunteer_name || '').trim(),
              saved_at: new Date().toISOString()
            };

            saveReceipt(receipt);
            [120, 450, 1000].forEach(delay => timers.push(window.setTimeout(() => injectReceipt(receipt), delay)));
            scheduleApply();
          }
        }
      } catch {
        // Основная форма продолжает работать даже без дополнительной карточки кода.
      }

      return response;
    };

    window.fetch = wrappedFetch;

    function handleClick() {
      scheduleApply();
      const receipts = readReceipts();
      if (receipts.length) {
        [100, 350].forEach(delay => timers.push(window.setTimeout(() => {
          const title = document.getElementById('vacancy-title')?.textContent?.trim();
          const receipt = receipts.find(item => item.title === title);
          if (receipt) injectReceipt(receipt);
        }, delay)));
      }
    }

    function handleSaved(event: Event) {
      const receipt = (event as CustomEvent<StoredReceipt>).detail;
      if (receipt?.access_code) {
        saveReceipt({ ...receipt, access_code: normalizeCode(receipt.access_code) });
        scheduleApply();
      }
    }

    document.addEventListener('click', handleClick, true);
    window.addEventListener('blagotvori-access-imported', handleSaved as EventListener);
    scheduleApply();

    return () => {
      stopped = true;
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('blagotvori-access-imported', handleSaved as EventListener);
      timers.forEach(timer => window.clearTimeout(timer));
      void stopped;
    };
  }, []);

  return null;
}
