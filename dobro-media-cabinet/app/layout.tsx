import './globals.css';
import './extra.css';
import './vk.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
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
