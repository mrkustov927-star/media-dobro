'use client';

import type { ReactNode } from 'react';
import AdminVacancyTeamEnhancer from './AdminVacancyTeamEnhancer';
import AdminVacancyDeleteEnhancer from './AdminVacancyDeleteEnhancer';
import AdminAugustMediaAutoInstaller from './AdminAugustMediaAutoInstaller';

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminVacancyTeamEnhancer />
      <AdminVacancyDeleteEnhancer />
      <AdminAugustMediaAutoInstaller />
      {children}
    </>
  );
}
