// Tema claro / oscuro. Por defecto sigue al teléfono; si la persona elige uno, se recuerda.
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'tudia-tema';
const EVENT = 'app:theme';
const META: Record<Theme, string> = { light: '#f4f7f6', dark: '#0b1615' };

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[t]);
  window.dispatchEvent(new Event(EVENT));
}

/** Cambia el tema con un círculo que se expande desde el botón (si el navegador lo permite). */
export function setTheme(t: Theme, origin?: { x: number; y: number }) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce || !origin) {
    document.documentElement.classList.add('theme-fade');
    apply(t);
    window.setTimeout(() => document.documentElement.classList.remove('theme-fade'), 400);
    return;
  }
  const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
  const vt = doc.startViewTransition(() => apply(t));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {
      /* la transición se saltó: el tema ya quedó aplicado */
    });
}

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>(() => (typeof document === 'undefined' ? 'light' : currentTheme()));
  useEffect(() => {
    const on = () => setT(currentTheme());
    window.addEventListener(EVENT, on);
    // si la persona no eligió, sigue al teléfono cuando cambia
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(KEY);
      } catch {
        /* nada */
      }
      if (!saved) apply(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener?.('change', onSystem);
    return () => {
      window.removeEventListener(EVENT, on);
      mq.removeEventListener?.('change', onSystem);
    };
  }, []);
  return t;
}
