'use client';

import type { ReactNode } from 'react';
import AdminVacancyTeamEnhancer from './AdminVacancyTeamEnhancer';
import AdminVacancyDeleteEnhancer from './AdminVacancyDeleteEnhancer';

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminVacancyTeamEnhancer />
      <AdminVacancyDeleteEnhancer />
      {children}
    </>
  );
}
