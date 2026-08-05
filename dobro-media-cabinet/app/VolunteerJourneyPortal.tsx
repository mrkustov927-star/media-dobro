'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import type { Vacancy } from '@/lib/blagotvori/types';
import VolunteerJourneyHub from './VolunteerJourneyHub';

export default function VolunteerJourneyPortal() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

  useEffect(() => {
    if (pathname !== '/') return;
    const timer = window.setTimeout(() => {
      const main = document.querySelector('main');
      const nearestSection = document.getElementById('good-deeds');
      if (!main || !nearestSection) return;

      let node = document.getElementById('volunteer-journey-host');
      if (!node) {
        node = document.createElement('div');
        node.id = 'volunteer-journey-host';
        nearestSection.insertAdjacentElement('afterend', node);
      }
      setHost(node);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;
    fetch('/api/blagotvori/vacancies', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => setVacancies(Array.isArray(json.vacancies) ? json.vacancies : []))
      .catch(() => setVacancies([]));
  }, [pathname]);

  function openVacancy(vacancy: Vacancy) {
    const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('main button'));
    const target = candidates.find(button => button.textContent?.includes(vacancy.title));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => target.click(), 350);
      return;
    }
    document.getElementById('good-deeds')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (pathname !== '/' || !host) return null;
  return createPortal(<VolunteerJourneyHub vacancies={vacancies} onOpenVacancy={openVacancy} />, host);
}
