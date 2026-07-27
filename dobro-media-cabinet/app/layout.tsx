import type { Metadata } from 'next';
import './globals.css';
import './extra.css';
import './vk.css';
import './calendar-status.css';
import './calendar.css';
import './pending.css';
import './calendar-progress.css';
import './admin-blagotvori/admin-polish.css';
import CalendarProgressEnhancer from './CalendarProgressEnhancer';
import DobroHoursNotice from './DobroHoursNotice';

export const metadata: Metadata = {
  title: 'БлагоТвори. Кемь — календарь добрых дел',
  description: 'Понятный календарь волонтёрских вакансий для детей и молодёжи Кемского муниципального округа.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <DobroHoursNotice />
        {children}
        <CalendarProgressEnhancer />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                function fixTemplates(){
                  document.querySelectorAll('.template').forEach(function(el){
                    if(el.getAttribute('data-fixed-template') === '1') return;
                    el.textContent = (el.textContent || '').replace(/\\\\n/g, '\\n');
                    el.setAttribute('data-fixed-template','1');
                  });
                }
                if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixTemplates);
                else fixTemplates();
                setTimeout(fixTemplates, 300);
              })();
            `
          }}
        />
      </body>
    </html>
  );
}