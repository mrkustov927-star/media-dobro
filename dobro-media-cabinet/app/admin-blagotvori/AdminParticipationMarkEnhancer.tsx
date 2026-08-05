'use client';

import { useEffect } from 'react';

const replacements = new Map<string, string>([
  ['Создавайте и редактируйте вакансии, обрабатывайте заявки и отчёты.', 'Создавайте и редактируйте вакансии, обрабатывайте заявки и отметки участников.'],
  ['Отчётов', 'Отметок'],
  ['Заявки и отчёты', 'Заявки и отметки'],
  ['Проверить отчёты', 'Проверить отметки'],
  ['Отчёт участника', 'Отметка участника'],
  ['Отчёт отправлен', 'Отметка отправлена']
]);

export default function AdminParticipationMarkEnhancer() {
  useEffect(() => {
    let stopped = false;

    function replaceTextNodes(root: Node) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let current = walker.nextNode();
      while (current) {
        nodes.push(current as Text);
        current = walker.nextNode();
      }

      nodes.forEach(node => {
        const original = node.nodeValue || '';
        const trimmed = original.trim();
        const replacement = replacements.get(trimmed);
        if (!replacement) return;
        node.nodeValue = original.replace(trimmed, replacement);
      });
    }

    function apply() {
      if (stopped) return;
      replaceTextNodes(document.body);
    }

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    apply();

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
