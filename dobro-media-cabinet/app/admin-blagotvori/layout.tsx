'use client';

import type { ReactNode } from 'react';
import './admin-mobile-controls.css';
import AdminVacancyTeamEnhancer from './AdminVacancyTeamEnhancer';
import AdminVkNotificationEnhancer from './AdminVkNotificationEnhancer';

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminVacancyTeamEnhancer />
      <AdminVkNotificationEnhancer />
      {children}
    </>
  );
}
