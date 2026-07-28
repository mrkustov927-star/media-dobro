'use client';

import { useEffect } from 'react';

type AdminResponse = {
  vacancy?: Record<string, unknown>;
};

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return new URL(input, window.location.origin);
  if (input instanceof URL) return input;
  return new URL(input.url, window.location.origin);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  const extra = new Headers(init?.headers);
  extra.forEach((value, key) => headers.set(key, value));
  return headers;
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === 'string') {
    try {
      return JSON.parse(init.body);
    } catch {
      return null;
    }
  }

  if (input instanceof Request) {
    try {
      const text = await input.clone().text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  return null;
}

export default function AdminVkNotificationEnhancer() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const enhancedFetch: typeof window.fetch = async (input, init) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      const isAdminAction = url.pathname === '/api/blagotvori/admin' && (method === 'POST' || method === 'PATCH');
      const body = isAdminAction ? await requestBody(input, init) : null;
      const headers = isAdminAction ? requestHeaders(input, init) : null;

      const response = await originalFetch(input, init);

      if (!isAdminAction || !response.ok || !body || !headers) return response;

      try {
        const json = await response.clone().json() as AdminResponse;
        if (!json.vacancy) return response;

        let action = '';
        if (method === 'POST' && !body.vacancy_id) action = 'vacancy_created';
        if (method === 'PATCH' && body.action === 'toggle_active') action = 'vacancy_toggled';
        if (!action) return response;

        await originalFetch('/api/blagotvori/admin-notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': headers.get('x-admin-password') || ''
          },
          body: JSON.stringify({ action, vacancy: json.vacancy }),
          cache: 'no-store'
        });
      } catch (error) {
        console.error('Blagotvori VK notification failed:', error);
      }

      return response;
    };

    window.fetch = enhancedFetch;
    return () => {
      if (window.fetch === enhancedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
