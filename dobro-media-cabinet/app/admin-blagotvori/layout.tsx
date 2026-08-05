'use client';

import type { ReactNode } from 'react';
import AdminVacancyTeamEnhancer from './AdminVacancyTeamEnhancer';
import AdminVacancyDeleteEnhancer from './AdminVacancyDeleteEnhancer';
import AdminAugustMediaAutoInstaller from './AdminAugustMediaAutoInstaller';
import AdminParticipationMarkEnhancer from './AdminParticipationMarkEnhancer';

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminVacancyTeamEnhancer />
      <AdminVacancyDeleteEnhancer />
      <AdminAugustMediaAutoInstaller />
      <AdminParticipationMarkEnhancer />
      {children}
    </>
  );
}
