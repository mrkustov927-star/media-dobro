'use client';

import { usePathname } from 'next/navigation';
import styles from './dobro-hours-notice.module.css';

const DOBRO_EVENT_URL = 'https://dobro.ru/event/11807142';

export default function DobroHoursNotice() {
  const pathname = usePathname();

  if (pathname !== '/') return null;

  return (
    <section className={styles.notice} aria-labelledby="dobro-hours-title">
      <div className={styles.inner}>
        <div className={styles.icon} aria-hidden="true">1</div>
        <div className={styles.copy}>
          <span className={styles.kicker}>Для учёта волонтёрских часов</span>
          <h2 id="dobro-hours-title">Выбирать добрые дела можно уже сейчас</h2>
          <p>
            Сначала посмотрите активности на сайте и найдите подходящую. Заявка на общую вакансию
            «Киоск добрых дел» на Добро.рф нужна до начала участия, если вы хотите, чтобы организатор
            внёс подтверждённые часы в электронную книжку волонтёра.
          </p>
          <div className={styles.steps}>
            <span><b>1</b> Выберите дело на этом сайте</span>
            <span><b>2</b> Подайте общую заявку на Добро.рф</span>
            <span><b>3</b> Выполните дело и отметьте результат</span>
          </div>
        </div>
        <a className={styles.action} href={DOBRO_EVENT_URL} target="_blank" rel="noreferrer">
          Открыть вакансию на Добро.рф
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
