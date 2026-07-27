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
          <span className={styles.kicker}>Важно перед участием</span>
          <h2 id="dobro-hours-title">Сначала подайте заявку на Добро.рф</h2>
          <p>
            Чтобы после выполнения заданий все фактически отработанные часы были собраны,
            проверены организатором и внесены в вашу электронную книжку волонтёра, необходимо
            заранее подать заявку на вакансию «Киоск добрых дел» на платформе Добро.рф.
          </p>
          <div className={styles.steps}>
            <span><b>1</b> Подайте заявку на Добро.рф</span>
            <span><b>2</b> Выберите дело на этом сайте</span>
            <span><b>3</b> Выполните задание и подтвердите результат</span>
          </div>
        </div>
        <a className={styles.action} href={DOBRO_EVENT_URL} target="_blank" rel="noreferrer">
          Подать заявку на Добро.рф
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
