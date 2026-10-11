// Enrutador mínimo por hash (#/ruta). Sin dependencias.
import { useEffect, useState } from 'react';

export function parseHash(hash: string): { path: string[]; query: URLSearchParams } {
  const raw = hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parseHash(hash);
}

export function go(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#${to}`;
}

export function href(to: string) {
  return `#${to}`;
}
