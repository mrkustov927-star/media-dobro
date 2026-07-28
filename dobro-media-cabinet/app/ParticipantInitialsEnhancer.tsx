'use client';

import { useEffect } from 'react';

type PublicVacancy = {
  id: string;
  title: string;
  participant_initials?: string[];
};

function participantText(vacancy: PublicVacancy) {
  const initials = Array.isArray(vacancy.participant_initials)
    ? vacancy.participant_initials.map(value => String(value).trim()).filter(Boolean)
    : [];
  if (!initials.length) return '';

  const visible = initials.slice(0, 3).join(', ');
  const rest = initials.length - 3;
  return rest > 0 ? `Уже участвуют: ${visible} и ещё ${rest}` : `Уже участвуют: ${visible}`;
}

export default function ParticipantInitialsEnhancer() {
  useEffect(() => {
    let stopped = false;
    let vacancies: PublicVacancy[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    function apply() {
      if (stopped) return;

      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button[class*="vacancy"], button[class*="nearestCard"], button[class*="mobileVacancy"], button[class*="heroMiniCard"]'
        )
      );
      const titleMap = new Map(vacancies.map(vacancy => [vacancy.title, vacancy]));

      document.querySelectorAll<HTMLElement>('[data-participant-initials]').forEach(badge => {
        const vacancy = titleMap.get(badge.dataset.vacancyTitle || '');
        const label = vacancy ? participantText(vacancy) : '';
        if (!label) badge.remove();
        else if (badge.textContent !== label) badge.textContent = label;
      });

      vacancies.forEach(vacancy => {
        const label = participantText(vacancy);
        if (!label) return;

        candidates.forEach(element => {
          if (!(element.textContent || '').includes(vacancy.title)) return;

          const existing = element.querySelector<HTMLElement>(
            `[data-participant-initials][data-vacancy-id="${vacancy.id}"]`
          );
          if (existing) return;

          const badge = document.createElement('span');
          badge.setAttribute('data-participant-initials', 'true');
          badge.setAttribute('data-vacancy-id', vacancy.id);
          badge.setAttribute('data-vacancy-title', vacancy.title);
          badge.className = 'participant-initials-badge';
          badge.textContent = label;

          const footer = element.querySelector('[class*="nearestBottom"], [class*="vacancyMeta"], em[data-tone]');
          if (footer?.parentElement === element) element.insertBefore(badge, footer);
          else element.appendChild(badge);
        });
      });
    }

    function scheduleApply(delays = [0, 400, 1100]) {
      delays.forEach(delay => timers.push(setTimeout(apply, delay)));
    }

    async function refresh() {
      try {
        const response = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const json = await response.json();
        vacancies = Array.isArray(json.vacancies) ? json.vacancies : [];
        scheduleApply();
      } catch {
        // Основной календарь продолжает работать без дополнительного индикатора.
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest('button[type="submit"]')) return;
      timers.push(setTimeout(() => { void refresh(); }, 1200));
      timers.push(setTimeout(() => { void refresh(); }, 2800));
    }

    document.addEventListener('click', handleClick, true);
    timers.push(setTimeout(() => { void refresh(); }, 250));

    return () => {
      stopped = true;
      document.removeEventListener('click', handleClick, true);
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return null;
}
