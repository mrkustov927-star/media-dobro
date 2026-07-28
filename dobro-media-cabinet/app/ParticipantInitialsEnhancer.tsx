'use client';

import { useEffect } from 'react';

type PublicVacancy = {
  id: string;
  title: string;
  participant_initials?: string[];
  participant_names?: string[];
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

function participantNames(vacancy: PublicVacancy) {
  return Array.isArray(vacancy.participant_names)
    ? vacancy.participant_names.map(name => String(name).trim()).filter(Boolean)
    : [];
}

export default function ParticipantInitialsEnhancer() {
  useEffect(() => {
    let stopped = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let latestVacancies: PublicVacancy[] = [];

    function applyCardBadges() {
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

    function applyModalTeam() {
      const title = document.getElementById('vacancy-title');
      const dialog = title?.closest<HTMLElement>('[role="dialog"]');
      if (!title || !dialog) return;

      const vacancy = latestVacancies.find(item => item.title === (title.textContent || '').trim());
      const names = vacancy ? participantNames(vacancy) : [];
      const existing = dialog.querySelector<HTMLElement>('[data-participant-team]');

      if (!vacancy || !names.length) {
        existing?.remove();
        return;
      }

      if (existing?.dataset.vacancyId === vacancy.id) {
        const currentNames = Array.from(existing.querySelectorAll('li')).map(item => item.textContent || '');
        if (currentNames.join('|') === names.join('|')) return;
        existing.remove();
      } else {
        existing?.remove();
      }

      const section = document.createElement('section');
      section.className = 'participant-team-card';
      section.setAttribute('data-participant-team', 'true');
      section.setAttribute('data-vacancy-id', vacancy.id);

      const heading = document.createElement('h3');
      heading.textContent = 'Кто работает над задачей';
      section.appendChild(heading);

      const lead = document.createElement('p');
      lead.textContent = names.length === 1 ? 'Вакансию взял участник:' : 'Вакансию взяли участники:';
      section.appendChild(lead);

      const list = document.createElement('ul');
      names.forEach(name => {
        const item = document.createElement('li');
        item.textContent = name;
        list.appendChild(item);
      });
      section.appendChild(list);

      const facts = dialog.querySelector<HTMLElement>('[class*="modalFacts"]');
      if (facts?.nextSibling) facts.parentElement?.insertBefore(section, facts.nextSibling);
      else if (facts?.parentElement) facts.parentElement.appendChild(section);
      else title.insertAdjacentElement('afterend', section);
    }

    function apply() {
      if (stopped) return;
      applyCardBadges();
      applyModalTeam();
    }

    function scheduleApply(delays = [0, 80, 220]) {
      delays.forEach(delay => timers.push(setTimeout(apply, delay)));
    }

    async function refreshOnce() {
      try {
        const response = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const json = await response.json();
        latestVacancies = Array.isArray(json.vacancies) ? json.vacancies : [];
        scheduleApply([0, 500, 1500]);
      } catch {
        // Основной календарь продолжает работать без дополнительного индикатора.
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest('button')) return;

      scheduleApply();
      const submitButton = target.closest('button[type="submit"]');
      if (submitButton) {
        timers.push(setTimeout(() => { void refreshOnce(); }, 1200));
        timers.push(setTimeout(() => { void refreshOnce(); }, 2800));
      }
    }

    document.addEventListener('click', handleClick, true);
    timers.push(setTimeout(() => { void refreshOnce(); }, 250));

    return () => {
      stopped = true;
      document.removeEventListener('click', handleClick, true);
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return null;
}
