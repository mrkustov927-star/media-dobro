'use client';

import type { ReactNode } from 'react';
import AdminVacancyTeamEnhancer from './AdminVacancyTeamEnhancer';
import AdminAugustActionsEnhancer from './AdminAugustActionsEnhancer';

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminVacancyTeamEnhancer />
      <AdminAugustActionsEnhancer />
      {children}
    </>
  );
}
