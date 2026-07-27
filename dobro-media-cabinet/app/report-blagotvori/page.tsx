'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from './report.module.css';

type VacancyOption = { id: string; title: string; event_date: string; is_active: boolean };

export default function ReportBlagotvoriPage() {
  const [vacancies, setVacancies] = useState<VacancyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch('/api/blagotvori/vacancies', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => setVacancies(Array.isArray(json.vacancies) ? json.vacancies : []))
      .catch(() => setVacancies([]));
  }, []);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/blagotvori/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancy_id: data.get('vacancy_id'),
          volunteer_name: data.get('volunteer_name'),
          contact: data.get('contact'),
          evidence_url: data.get('evidence_url'),
          evidence_comment: data.get('evidence_comment')
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Не удалось отправить отчёт.');
      setSent(true);
      form.reset();
    } catch (error: any) {
      setMessage(error?.message || 'Не удалось отправить отчёт.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href="/">← Вернуться к добрым делам</a>
        <section className={styles.hero}>
          <span>БлагоТвори. Кемь</span>
          <h1>Отчёт о добром деле</h1>
          <p>Заполните отчёт после выполнения задания. Организатор проверит результат, подтвердит фактическое время и затем внесёт часы на Добро.рф.</p>
        </section>

        {sent ? (
          <section className={styles.success}>
            <div>✓</div>
            <h2>Отчёт отправлен</h2>
            <p>Он появился в кабинете организатора со статусом «Отчёт отправлен». Сохраните подтверждающие материалы до зачёта часов.</p>
            <a href="/">Выбрать ещё одно доброе дело</a>
          </section>
        ) : (
          <form className={styles.form} onSubmit={submitReport}>
            <div className={styles.note}><b>Важно</b><p>Имя и контакт должны полностью совпадать с данными, которые вы указали при подаче заявки на выбранную активность.</p></div>

            <label>Какое доброе дело выполнено?
              <select name="vacancy_id" required defaultValue="">
                <option value="" disabled>Выберите вакансию</option>
                {vacancies.map(vacancy => <option key={vacancy.id} value={vacancy.id}>{vacancy.title}</option>)}
              </select>
            </label>

            <div className={styles.twoColumns}>
              <label>Имя и фамилия<input name="volunteer_name" required placeholder="Как в заявке" /></label>
              <label>Контакт для связи<input name="contact" required placeholder="Телефон или ссылка, как в заявке" /></label>
            </div>

            <label>Что вы сделали?
              <textarea name="evidence_comment" required minLength={10} maxLength={2000} rows={6} placeholder="Коротко опишите выполненную работу, результат и фактически затраченное время." />
            </label>

            <label>Ссылка на подтверждение <small>необязательно, если достаточно отметки организатора</small>
              <input name="evidence_url" type="url" placeholder="https://vk.com/... или ссылка на фотографии/документ" />
            </label>

            <label className={styles.check}><input type="checkbox" required /><span>Я отправляю достоверный отчёт и понимаю, что часы будут зачтены только после проверки организатором.</span></label>

            <button type="submit" disabled={loading}>{loading ? 'Отправляем…' : 'Отправить отчёт'}</button>
            {message && <div className={styles.error}>{message}</div>}
          </form>
        )}
      </div>
    </main>
  );
}
