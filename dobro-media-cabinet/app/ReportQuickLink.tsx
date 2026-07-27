'use client';

import { usePathname } from 'next/navigation';
import styles from './report-quick-link.module.css';

export default function ReportQuickLink() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin-blagotvori') || pathname.startsWith('/report-blagotvori')) return null;

  return (
    <a className={styles.link} href="/report-blagotvori" aria-label="Отправить отчёт о выполненном добром деле">
      <span>✓</span>
      <b>Отправить отчёт</b>
      <small>после выполнения дела</small>
    </a>
  );
}
