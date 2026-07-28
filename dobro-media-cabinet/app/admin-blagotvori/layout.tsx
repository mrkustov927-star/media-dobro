'use client';

import type { ReactNode } from 'react';
import './admin-mobile-controls.css';
import AdminVacancyTeamEnhancer from './AdminVacancyTeamEnhancer';

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminVacancyTeamEnhancer />
      {children}
    </>
  );
}
