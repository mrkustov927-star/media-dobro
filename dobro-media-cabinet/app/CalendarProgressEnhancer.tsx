'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ActivityRow = {
  id: string;
  day: number;
  title: string;
  sort_order: number;
  is_active: boolean;
};

type AssignmentRow = {
  id: string;
  activity_id: string;
  status: string;
};

function getState(assignments: AssignmentRow[]) {
  if (!assignments.length) return 'free';
  const completed = assignments.filter(item => item.status === 'Зачтено').length;
  if (completed === assignments.length) return 'complete';
  if (completed > 0) return 'partial';
  return 'active';
}

function setText(element: Element | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function ensureCalendarLegend() {
  const legend = document.querySelector<HTMLElement>('#calendar .calendar-legend');
  if (!legend) return;

  const items = [
    ['free', 'Свободно'],
    ['active', 'В работе'],
    ['partial', 'Частично'],
    ['complete', 'Завершено']
  ] as const;

  const alreadyCorrect =
    legend.children.length === items.length &&
    items.every(([state, label], index) => {
      const item = legend.children[index] as HTMLElement | undefined;
      const dots = item?.querySelectorAll('.legend-dot') || [];
      return item?.textContent?.trim() === label && dots.length === 1 && dots[0]?.classList.contains(state);
    });

  if (alreadyCorrect) return;

  const fragment = document.createDocumentFragment();
  items.forEach(([state, label]) => {
    const item = document.createElement('span');
    if (state === 'partial') item.className = 'legend-partial';

    const dot = document.createElement('i');
    dot.className = `legend-dot ${state}`;

    item.append(dot, document.createTextNode(label));
    fragment.append(item);
  });

  legend.replaceChildren(fragment);
}

export default function CalendarProgressEnhancer() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let applying = false;
    let rerunRequested = false;

    async function applyCalendarProgress() {
      if (applying) {
        rerunRequested = true;
        return;
      }

      applying = true;
      ensureCalendarLegend();

      try {
        const [{ data: activities }, { data: assignments }] = await Promise.all([
          supabase.from('activities').select('id,day,title,sort_order,is_active').eq('is_active', true).order('sort_order'),
          supabase.from('assignments').select('id,activity_id,status').neq('status', 'Отменено').order('created_at', { ascending: true })
        ]);

        if (cancelled || !activities || !assignments) return;

        const activityRows = activities as ActivityRow[];
        const assignmentRows = assignments as AssignmentRow[];
        const byActivity = new Map<string, AssignmentRow[]>();

        assignmentRows.forEach(assignment => {
          const list = byActivity.get(assignment.activity_id) || [];
          list.push(assignment);
          byActivity.set(assignment.activity_id, list);
        });

        const byKey = new Map<string, ActivityRow[]>();
        activityRows.forEach(activity => {
          const key = `${activity.day}|||${activity.title}`;
          const list = byKey.get(key) || [];
          list.push(activity);
          byKey.set(key, list);
        });

        const occurrences = new Map<string, number>();
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('#calendar .activity-pill'));

        buttons.forEach(button => {
          const day = Number(button.closest('.day')?.querySelector('.num')?.textContent || 0);
          const title = button.querySelector(':scope > b')?.textContent?.trim() || '';
          const key = `${day}|||${title}`;
          const index = occurrences.get(key) || 0;
          occurrences.set(key, index + 1);

          const activity = byKey.get(key)?.[index];
          if (!activity) return;

          const currentAssignments = byActivity.get(activity.id) || [];
          const completed = currentAssignments.filter(item => item.status === 'Зачтено').length;
          const total = currentAssignments.length;
          const state = getState(currentAssignments);

          button.classList.remove('activity-pill-free', 'activity-pill-active', 'activity-pill-partial', 'activity-pill-complete');
          button.classList.add(`activity-pill-${state}`);

          const stateElement = button.querySelector('.calendar-state');
          if (stateElement) {
            stateElement.classList.remove('calendar-state-free', 'calendar-state-active', 'calendar-state-partial', 'calendar-state-complete');
            stateElement.classList.add(`calendar-state-${state}`);
          }

          const stateLabel = state === 'free'
            ? 'Свободно'
            : state === 'active'
              ? 'В работе'
              : state === 'partial'
                ? 'Частично'
                : 'Завершено';

          const metaText = state === 'free'
            ? 'Можно взять задание'
            : `Завершено: ${completed} из ${total}`;

          setText(stateElement, stateLabel);
          setText(button.querySelector('.activity-meta'), metaText);
          button.querySelector('.calendar-topic-list')?.remove();
          button.setAttribute('aria-label', `${title}. ${stateLabel}. ${metaText}. Нажмите, чтобы открыть подробности.`);
        });

        setText(
          document.querySelector('#calendar .head .note'),
          'Нажми на карточку: внутри — описание, участники, темы и статус каждой работы.'
        );
        setText(
          document.querySelector('#calendar .calendar-help-copy span'),
          'В сетке показан общий прогресс. Подробности открываются по нажатию.'
        );

        ensureCalendarLegend();
      } finally {
        applying = false;
        if (rerunRequested && !cancelled) {
          rerunRequested = false;
          void applyCalendarProgress();
        }
      }
    }

    function schedule(delay = 120) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void applyCalendarProgress(); }, delay);
    }

    schedule(150);
    setTimeout(() => schedule(0), 700);
    setTimeout(() => schedule(0), 1800);

    const channel = supabase
      .channel('dobro-media-calendar-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => schedule())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => schedule())
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
