'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ActivityRow = {
  id: string;
  day: number;
  title: string;
  type: string;
  sort_order: number;
  is_active: boolean;
};

type AssignmentRow = {
  id: string;
  activity_id: string;
  volunteer_name: string;
  status: string;
  volunteer_comment: string | null;
};

function getTopic(assignment: AssignmentRow) {
  const firstLine = String(assignment.volunteer_comment || '').split('\n')[0]?.trim() || '';
  return firstLine.startsWith('Тема:') ? firstLine.replace(/^Тема:\s*/, '').trim() : '';
}

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

export default function CalendarProgressEnhancer() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function applyCalendarProgress() {
      const [{ data: activities }, { data: assignments }] = await Promise.all([
        supabase.from('activities').select('id,day,title,type,sort_order,is_active').eq('is_active', true).order('sort_order'),
        supabase.from('assignments').select('id,activity_id,volunteer_name,status,volunteer_comment').neq('status', 'Отменено').order('created_at', { ascending: true })
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
        const inProgress = currentAssignments.length - completed;
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
          : state === 'complete'
            ? 'Завершено'
            : state === 'partial'
              ? `${completed} из ${currentAssignments.length}`
              : currentAssignments.length > 1
                ? `В работе · ${currentAssignments.length}`
                : 'В работе';
        setText(stateElement, stateLabel);

        const meta = button.querySelector('.activity-meta');
        const metaText = state === 'free'
          ? 'Можно взять это задание'
          : state === 'complete'
            ? currentAssignments.length > 1
              ? `Все ${currentAssignments.length} работы завершены`
              : 'Работа завершена'
            : state === 'partial'
              ? `${completed} завершено · ${inProgress} в работе`
              : currentAssignments.length > 1
                ? `${currentAssignments.length} работы в процессе`
                : `В работе: ${currentAssignments[0]?.volunteer_name || ''}`;
        setText(meta, metaText);

        button.querySelector('.calendar-topic-list')?.remove();
        if (activity.type === 'd' && currentAssignments.length) {
          const list = document.createElement('span');
          list.className = 'calendar-topic-list';

          currentAssignments.slice(0, 4).forEach(assignment => {
            const isComplete = assignment.status === 'Зачтено';
            const row = document.createElement('span');
            row.className = `calendar-topic-row calendar-topic-row-${isComplete ? 'complete' : 'active'}`;

            const marker = document.createElement('span');
            marker.className = 'calendar-topic-marker';
            marker.textContent = isComplete ? '✓' : '•';

            const copy = document.createElement('span');
            copy.className = 'calendar-topic-copy';

            const topic = document.createElement('span');
            topic.className = 'calendar-topic-name';
            topic.textContent = getTopic(assignment) || 'Без названия темы';

            const person = document.createElement('span');
            person.className = 'calendar-topic-person';
            person.textContent = `${assignment.volunteer_name} · ${isComplete ? 'завершено' : 'в работе'}`;

            copy.append(topic, person);
            row.append(marker, copy);
            list.append(row);
          });

          if (currentAssignments.length > 4) {
            const more = document.createElement('span');
            more.className = 'calendar-topic-more';
            more.textContent = `Ещё ${currentAssignments.length - 4}`;
            list.append(more);
          }

          button.append(list);
        }
      });

      const legend = document.querySelector('#calendar .calendar-legend');
      if (legend && !legend.querySelector('.legend-partial')) {
        const item = document.createElement('span');
        item.className = 'legend-partial';
        const dot = document.createElement('i');
        dot.className = 'legend-dot partial';
        item.append(dot, document.createTextNode('Частично завершено'));
        const complete = legend.querySelector('span:last-child');
        legend.insertBefore(item, complete);
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
