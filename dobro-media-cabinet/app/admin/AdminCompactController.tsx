'use client';

import { useEffect } from 'react';

type ListKind = 'assignments' | 'calendar';

function normalized(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
}

function getListKind(list: Element): ListKind {
  return list.classList.contains('calendar-edit-list') ? 'calendar' : 'assignments';
}

function getAssignmentStatus(card: HTMLElement) {
  return card.querySelector<HTMLSelectElement>('.assignment-fields select')?.value || '';
}

function getCalendarVisibility(card: HTMLElement) {
  return card.querySelector<HTMLInputElement>('.switch-line input[type="checkbox"]')?.checked ? 'visible' : 'hidden';
}

function buildSummary(card: HTMLElement, kind: ListKind) {
  if (kind === 'calendar') {
    const title = card.querySelector<HTMLInputElement>('.admin-edit-head input.input')?.value?.trim() || 'Без названия';
    const visible = getCalendarVisibility(card) === 'visible' ? 'Показывается ребятам' : 'Скрыто';
    return `${title} · ${visible}`;
  }

  const volunteer = card.querySelector<HTMLElement>('.assignment-fields label:first-child b')?.textContent?.trim() || 'Без имени';
  const topic = card.querySelector<HTMLElement>('.admin-topic')?.textContent?.replace(/^Тема:\s*/i, '').trim();
  const status = getAssignmentStatus(card) || 'Без статуса';
  const hours = card.querySelector<HTMLElement>('.assignment-fields label:first-child small:not(.admin-topic)')?.textContent?.trim();
  return [volunteer, topic ? `Тема: ${topic}` : null, status, hours || null].filter(Boolean).join(' · ');
}

function getCardKey(card: HTMLElement, kind: ListKind) {
  const date = card.querySelector<HTMLElement>('.admin-date')?.textContent?.trim() || '';
  const title = kind === 'calendar'
    ? card.querySelector<HTMLInputElement>('.admin-edit-head input.input')?.value?.trim() || ''
    : card.querySelector<HTMLElement>('.admin-edit-head h3')?.textContent?.trim() || '';
  const volunteer = kind === 'assignments'
    ? card.querySelector<HTMLElement>('.assignment-fields label:first-child b')?.textContent?.trim() || ''
    : '';
  const topic = kind === 'assignments'
    ? card.querySelector<HTMLElement>('.admin-topic')?.textContent?.trim() || ''
    : '';
  return `${kind}|${date}|${title}|${volunteer}|${topic}`;
}

function setExpanded(card: HTMLElement, expanded: boolean) {
  const nextValue = expanded ? 'true' : 'false';
  if (card.dataset.expanded !== nextValue) card.dataset.expanded = nextValue;

  const button = card.querySelector<HTMLButtonElement>('.admin-card-toggle');
  if (button) {
    const nextText = expanded ? 'Свернуть' : 'Открыть';
    if (button.textContent !== nextText) button.textContent = nextText;
    if (button.getAttribute('aria-expanded') !== String(expanded)) {
      button.setAttribute('aria-expanded', String(expanded));
    }
  }
}

function prepareCard(card: HTMLElement, kind: ListKind, expandedKeys: Set<string>) {
  card.classList.add('admin-collapsible-card');
  const cardKey = getCardKey(card, kind);
  card.dataset.compactKey = cardKey;

  const head = card.querySelector<HTMLElement>('.admin-edit-head');
  if (!head) return;

  const main = head.querySelector<HTMLElement>(':scope > div:first-child') || head;
  let summary = main.querySelector<HTMLElement>('.admin-compact-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'admin-compact-summary';
    main.append(summary);
  }

  const summaryText = buildSummary(card, kind);
  if (summary.textContent !== summaryText) summary.textContent = summaryText;

  let toggle = head.querySelector<HTMLButtonElement>('.admin-card-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-card-toggle';
    const danger = head.querySelector('.btn.danger');
    head.insertBefore(toggle, danger || null);
  }

  toggle.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = card.dataset.expanded !== 'true';
    if (expanded) expandedKeys.add(cardKey);
    else expandedKeys.delete(cardKey);
    setExpanded(card, expanded);
  };

  setExpanded(card, expandedKeys.has(cardKey));
}

function matchesStatus(card: HTMLElement, kind: ListKind, filter: string) {
  if (filter === 'all') return true;

  if (kind === 'calendar') {
    return getCalendarVisibility(card) === filter;
  }

  const status = getAssignmentStatus(card);
  if (filter === 'attention') return status === 'Материал сдан' || status === 'На доработке';
  if (filter === 'active') return ['Взято в работу', 'Материал сдан', 'На доработке', 'Проверено'].includes(status);
  if (filter === 'complete') return status === 'Зачтено';
  if (filter === 'cancelled') return status === 'Отменено';
  return true;
}

function applyFilter(list: HTMLElement, toolbar: HTMLElement, kind: ListKind) {
  const query = normalized(toolbar.querySelector<HTMLInputElement>('.admin-list-search')?.value || '');
  const filter = toolbar.querySelector<HTMLSelectElement>('.admin-list-filter')?.value || 'all';
  const cards = Array.from(list.querySelectorAll<HTMLElement>(':scope > .admin-edit-card'));
  let shown = 0;

  cards.forEach(card => {
    const haystack = normalized(card.textContent || '');
    const visible = (!query || haystack.includes(query)) && matchesStatus(card, kind, filter);
    card.hidden = !visible;
    if (visible) shown += 1;
  });

  const count = toolbar.querySelector<HTMLElement>('.admin-list-count');
  const countText = `Показано ${shown} из ${cards.length}`;
  if (count && count.textContent !== countText) count.textContent = countText;
}

function createToolbar(list: HTMLElement, kind: ListKind, expandedKeys: Set<string>) {
  const section = list.closest('section');
  const head = section?.querySelector('.head');
  if (!section || !head) return null;

  let toolbar = section.querySelector<HTMLElement>('.admin-compact-toolbar');
  if (toolbar) return toolbar;

  toolbar = document.createElement('div');
  toolbar.className = 'admin-compact-toolbar';
  toolbar.innerHTML = `
    <input class="input admin-list-search" type="search" placeholder="${kind === 'calendar' ? 'Найти дату или задание' : 'Найти участника, тему или задание'}" aria-label="Поиск по списку">
    <select class="admin-list-filter" aria-label="Фильтр списка">
      ${kind === 'calendar'
        ? '<option value="all">Все задания</option><option value="visible">Показываются</option><option value="hidden">Скрытые</option>'
        : '<option value="all">Все статусы</option><option value="attention">Требуют проверки</option><option value="active">В процессе</option><option value="complete">Зачтено</option><option value="cancelled">Отменено</option>'}
    </select>
    <button class="btn ghost admin-expand-visible" type="button">Развернуть найденные</button>
    <button class="btn ghost admin-collapse-all" type="button">Свернуть всё</button>
    <span class="admin-list-count" aria-live="polite"></span>
  `;
  head.insertAdjacentElement('afterend', toolbar);

  toolbar.querySelector('.admin-list-search')?.addEventListener('input', () => applyFilter(list, toolbar!, kind));
  toolbar.querySelector('.admin-list-filter')?.addEventListener('change', () => applyFilter(list, toolbar!, kind));
  toolbar.querySelector('.admin-expand-visible')?.addEventListener('click', () => {
    list.querySelectorAll<HTMLElement>(':scope > .admin-edit-card:not([hidden])').forEach(card => {
      const key = card.dataset.compactKey;
      if (key) expandedKeys.add(key);
      setExpanded(card, true);
    });
  });
  toolbar.querySelector('.admin-collapse-all')?.addEventListener('click', () => {
    list.querySelectorAll<HTMLElement>(':scope > .admin-edit-card').forEach(card => {
      const key = card.dataset.compactKey;
      if (key) expandedKeys.delete(key);
      setExpanded(card, false);
    });
  });

  return toolbar;
}

export default function AdminCompactController() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;
    const expandedKeys = new Set<string>();

    function prepare() {
      observer?.disconnect();

      document.querySelectorAll<HTMLElement>('.admin-card-list').forEach(list => {
        const kind = getListKind(list);
        list.classList.add('admin-compact-list');
        list.querySelectorAll<HTMLElement>(':scope > .admin-edit-card').forEach(card => prepareCard(card, kind, expandedKeys));
        const toolbar = createToolbar(list, kind, expandedKeys);
        if (toolbar) applyFilter(list, toolbar, kind);
      });

      observer?.observe(document.body, { childList: true, subtree: true });
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(prepare, 80);
    }

    observer = new MutationObserver(schedule);
    prepare();

    return () => {
      if (timer) clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  return null;
}
