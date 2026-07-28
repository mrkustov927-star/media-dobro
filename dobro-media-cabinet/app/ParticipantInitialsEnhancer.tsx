'use client';

import { useEffect } from 'react';

type PublicVacancy = {
  id: string;
  title: string;
  participant_initials?: string[];
  occupied_slots?: number;
  slots: number;
};

function participantText(vacancy: PublicVacancy) {
  const initials = Array.isArray(vacancy.participant_initials) ? vacancy.participant_initials.filter(Boolean) : [];
  if (!initials.length) return '';

  const visible = initials.slice(0, 3).join(', ');
  const rest = initials.length - 3;
  return rest > 0 ? `Уже участвуют: ${visible} и ещё ${rest}` : `Уже участвуют: ${visible}`;
}

export default function ParticipantInitialsEnhancer() {
  useEffect(() => {
    let stopped = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let latestVacancies: PublicVacancy[] = [];

    function apply() {
      if (stopped) return;

      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button[class*="vacancy"], button[class*="nearestCard"], button[class*="mobileVacancy"], button[class*="heroMiniCard"]'
        )
      );
      const titleMap = new Map(latestVacancies.map(vacancy => [vacancy.title, vacancy]));

      document.querySelectorAll<HTMLElement>('[data-participant-initials]').forEach(badge => {
        const vacancy = titleMap.get(badge.dataset.vacancyTitle || '');
        const label = vacancy ? participantText(vacancy) : '';
        if (!label) badge.remove();
        else if (badge.textContent !== label) badge.textContent = label;
      });

      for (const vacancy of latestVacancies) {
        const label = participantText(vacancy);
        if (!label) continue;

        for (const element of candidates) {
          const text = element.textContent || '';
          if (!text.includes(vacancy.title)) continue;

          const existing = element.querySelector<HTMLElement>(
            `[data-participant-initials][data-vacancy-id="${vacancy.id}"]`
          );
          if (existing) continue;

          const badge = document.createElement('span');
          badge.setAttribute('data-participant-initials', 'true');
          badge.setAttribute('data-vacancy-id', vacancy.id);
          badge.setAttribute('data-vacancy-title', vacancy.title);
          badge.className = 'participant-initials-badge';
          badge.textContent = label;

          const footer = element.querySelector('[class*="nearestBottom"], [class*="vacancyMeta"], em[data-tone]');
          if (footer?.parentElement === element) element.insertBefore(badge, footer);
          else element.appendChild(badge);
        }
      }
    }

    async function refreshOnce() {
      try {
        const response = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const json = await response.json();
        latestVacancies = Array.isArray(json.vacancies) ? json.vacancies : [];

        [0, 500, 1500].forEach(delay => {
          timers.push(setTimeout(apply, delay));
        });
      } catch {
        // Основной календарь продолжает работать без дополнительного индикатора.
      }
    }

    timers.push(setTimeout(() => { void refreshOnce(); }, 250));

    return () => {
      stopped = true;
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return null;
}
