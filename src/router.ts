// Enrutador mínimo con rutas reales (History API). Sin dependencias.
// Sitio público en "/", panel de administración en "/admin/...".
import { useEffect, useState } from 'react';

export const ADMIN = '/admin';
const EVENT = 'app:navigate';

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = new URL(to, window.location.origin);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next !== current) window.history[opts.replace ? 'replaceState' : 'pushState']({}, '', next);
  window.dispatchEvent(new Event(EVENT));
  if (url.hash) {
    requestAnimationFrame(() => document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } else if (url.pathname !== window.location.pathname || !opts.replace) {
    window.scrollTo({ top: 0 });
  }
}

export function useLocation() {
  const [loc, setLoc] = useState(() => ({ pathname: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const on = () => setLoc({ pathname: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', on);
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener(EVENT, on);
    };
  }, []);
  return loc;
}

/** Ruta dentro del panel: "/admin/reserva/123?x=1" → path ["reserva","123"] */
export function useRoute() {
  const { pathname, search } = useLocation();
  const rest = pathname.startsWith(ADMIN) ? pathname.slice(ADMIN.length) : pathname;
  return { path: rest.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(search) };
}

/** Enlace a una pantalla del panel. */
export function href(to: string) {
  return to === '/' ? ADMIN : `${ADMIN}${to.startsWith('/') ? to : `/${to}`}`;
}

/** Ir a una pantalla del panel. */
export function go(to: string, opts?: { replace?: boolean }) {
  navigate(href(to), opts);
}

/** Intercepta clics en <a href="/..."> internos para navegar sin recargar. */
export function installLinkInterceptor() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const raw = a.getAttribute('href');
    if (!raw) return;
    if (raw.startsWith('#')) {
      // ancla dentro de la misma página (ej. "#disponibilidad")
      e.preventDefault();
      navigate(window.location.pathname + window.location.search + raw, { replace: true });
      return;
    }
    const url = new URL(a.href, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
}

/** Compatibilidad con enlaces viejos del panel (#/reserva/123 → /admin/reserva/123). */
export function migrateHashRoute() {
  const check = () => {
    const h = window.location.hash;
    if (h.startsWith('#/')) navigate(`${ADMIN}${h.slice(1) === '/' ? '' : h.slice(1)}`, { replace: true });
  };
  check();
  window.addEventListener('hashchange', check);
}
