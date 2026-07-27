'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

function applyAgeLimit() {
  const fields = document.querySelectorAll<HTMLInputElement>(
    'input[name="min_age"], input[name="max_age"]'
  );

  fields.forEach(field => {
    if (field.max !== '99') field.max = '99';
  });
}

export default function AdminBlagotvoriLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyAgeLimit();

    const observer = new MutationObserver(applyAgeLimit);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return children;
}
