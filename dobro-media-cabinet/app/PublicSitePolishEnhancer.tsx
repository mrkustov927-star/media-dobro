'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PublicSitePolishEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;

    let stopped = false;

    function setText(element: Element | null, value: string) {
      if (element && element.textContent !== value) element.textContent = value;
    }

    function apply() {
      if (stopped) return;

      const brand = document.querySelector<HTMLAnchorElement>('a[aria-label="БлагоТвори. Кемь"]');
      setText(brand?.querySelector('b') || null, 'БлагоТвори. Кемь');
      setText(brand?.querySelector('small') || null, 'Киоск добрых дел Движения Первых');

      const eyebrow = document.querySelector<HTMLElement>('main section:first-child span[class*="eyebrow"]');
      setText(eyebrow, 'Киоск добрых дел Движения Первых');

      const footer = document.querySelector('footer');
      setText(footer?.querySelector('b') || null, 'БлагоТвори. Кемь');
      setText(
        footer?.querySelector('span') || null,
        'Киоск добрых дел Движения Первых в Кемском муниципальном округе'
      );

      document.querySelectorAll<HTMLElement>('article h3').forEach(title => {
        if (title.textContent?.trim() !== 'Получи часы') return;
        const paragraph = title.nextElementSibling;
        if (paragraph instanceof HTMLElement) {
          setText(
            paragraph,
            'После выполнения отметь участие или сдачу материала в разделе «Мои заявки и часы». Организатор проверит отметку и учтёт часы на Добро.рф.'
          );
        }
      });

      document.querySelectorAll<HTMLDetailsElement>('details').forEach(details => {
        const summary = details.querySelector('summary');
        if (summary?.textContent?.trim() !== 'Как подтвердить доброе дело?') return;
        const paragraph = details.querySelector('p');
        setText(
          paragraph,
          'Загружать файлы, фотографии и ссылки на этом сайте не нужно. После выполнения открой раздел «Мои заявки и часы» и выбери: «Я участвовал(а)» или «Я сдал(а) материал». Отметка появится у организатора.'
        );
      });

      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (dialog) {
        const category = dialog.querySelector<HTMLElement>('[class*="modalCategory"]')?.textContent || '';
        dialog.querySelectorAll<HTMLHeadingElement>('h3').forEach(title => {
          if (title.textContent?.trim() !== 'Как подтвердить участие' && title.textContent?.trim() !== 'Как отметить выполнение') return;
          setText(title, 'Как отметить выполнение');
          const paragraph = title.nextElementSibling;
          if (!(paragraph instanceof HTMLElement)) return;
          setText(
            paragraph,
            category.includes('Медиа') || category.includes('Дистанционные')
              ? 'На этом сайте не нужно загружать материалы или ссылки. После выполнения открой раздел «Мои заявки и часы» и нажми «Я сдал(а) материал». Организатор увидит отметку и проверит результат на Добро.рф.'
              : 'После участия открой раздел «Мои заявки и часы» и нажми «Я участвовал(а)». Организатор увидит отметку и проверит участие на Добро.рф.'
          );
        });
      }

      document.querySelectorAll<HTMLElement>('[class*="successBox"]').forEach(box => {
        if (box.querySelector('[data-simple-confirmation-note]')) return;
        const note = document.createElement('p');
        note.setAttribute('data-simple-confirmation-note', 'true');
        note.textContent =
          'После выполнения вернись в раздел «Мои заявки и часы» и отметь участие или сдачу материала. Загружать файлы на сайт не нужно.';
        box.appendChild(note);
      });
    }

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    apply();

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
