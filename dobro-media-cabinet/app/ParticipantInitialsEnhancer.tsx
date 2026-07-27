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
    let observer: MutationObserver | null = null;

    async function enhance() {
      try {
        const response = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const vacancies: PublicVacancy[] = Array.isArray(json.vacancies) ? json.vacancies : [];
        if (stopped) return;

        const apply = () => {
          const candidates = Array.from(document.querySelectorAll('button, article'));

          for (const vacancy of vacancies) {
            const label = participantText(vacancy);
            if (!label) continue;

            for (const element of candidates) {
              const text = element.textContent || '';
              if (!text.includes(vacancy.title)) continue;
              if (element.querySelector('[data-participant-initials]')) continue;

              const badge = document.createElement('span');
              badge.setAttribute('data-participant-initials', 'true');
              badge.className = 'participant-initials-badge';
              badge.textContent = label;
              element.appendChild(badge);
            }
          }
        };

        apply();
        observer = new MutationObserver(apply);
        observer.observe(document.body, { childList: true, subtree: true });
      } catch {
        // Публичная страница остаётся работоспособной даже без дополнительного индикатора.
      }
    }

    enhance();
    return () => {
      stopped = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
