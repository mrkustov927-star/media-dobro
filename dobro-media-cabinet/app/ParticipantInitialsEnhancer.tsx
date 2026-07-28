'use client';

import { useEffect } from 'react';

type PublicVacancy = {
  id: string;
  title: string;
  participant_labels?: string[];
  participant_initials?: string[];
};

function participantLabels(vacancy: PublicVacancy) {
  const source = Array.isArray(vacancy.participant_labels)
    ? vacancy.participant_labels
    : Array.isArray(vacancy.participant_initials)
      ? vacancy.participant_initials
      : [];

  return source.map(value => String(value).trim()).filter(Boolean);
}

function participantText(vacancy: PublicVacancy) {
  const labels = participantLabels(vacancy);
  if (!labels.length) return '';

  const visible = labels.slice(0, 3).join(', ');
  const rest = labels.length - 3;
  return rest > 0 ? `Участвуют: ${visible} и ещё ${rest}` : `Участвуют: ${visible}`;
}

export default function ParticipantInitialsEnhancer() {
  useEffect(() => {
    let stopped = false;
    let vacancies: PublicVacancy[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    function applyCardBadges() {
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

    function applyModalTeam() {
      if (stopped) return;

      const title = document.getElementById('vacancy-title');
      const dialog = title?.closest<HTMLElement>('[role="dialog"]');
      if (!title || !dialog) return;

      const vacancy = vacancies.find(item => item.title === (title.textContent || '').trim());
      const labels = vacancy ? participantLabels(vacancy) : [];
      const existing = dialog.querySelector<HTMLElement>('[data-participant-team]');

      if (!vacancy || !labels.length) {
        existing?.remove();
        return;
      }

      const signature = `${vacancy.id}|${labels.join('|')}`;
      if (existing?.dataset.signature === signature) return;
      existing?.remove();

      const section = document.createElement('section');
      section.className = 'participant-team-card';
      section.setAttribute('data-participant-team', 'true');
      section.dataset.signature = signature;

      const heading = document.createElement('h3');
      heading.textContent = 'Кто участвует';
      section.appendChild(heading);

      const lead = document.createElement('p');
      lead.textContent = labels.length === 1 ? 'Активность уже взял волонтёр:' : 'Активность уже взяли волонтёры:';
      section.appendChild(lead);

      const list = document.createElement('ul');
      labels.forEach(label => {
        const item = document.createElement('li');
        item.textContent = label;
        list.appendChild(item);
      });
      section.appendChild(list);

      const facts = dialog.querySelector<HTMLElement>('[class*="modalFacts"]');
      if (facts?.nextSibling) facts.parentElement?.insertBefore(section, facts.nextSibling);
      else if (facts?.parentElement) facts.parentElement.appendChild(section);
      else title.insertAdjacentElement('afterend', section);
    }

    function apply() {
      applyCardBadges();
      applyModalTeam();
    }

    function scheduleApply(delays = [0, 100, 300]) {
      delays.forEach(delay => timers.push(setTimeout(apply, delay)));
    }

    async function refresh() {
      try {
        const response = await fetch('/api/blagotvori/vacancies', { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const json = await response.json();
        vacancies = Array.isArray(json.vacancies) ? json.vacancies : [];
        scheduleApply([0, 350, 900]);
      } catch {
        // Основной календарь продолжает работать без дополнительного списка участников.
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest('button')) return;

      scheduleApply();
      if (target.closest('button[type="submit"]')) {
        timers.push(setTimeout(() => { void refresh(); }, 1200));
        timers.push(setTimeout(() => { void refresh(); }, 2600));
      }
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
