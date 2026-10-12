// Aparición suave al hacer scroll: los elementos con data-reveal suben y aparecen al entrar en pantalla.
// También vigila los que aparecen después (al cargar datos o cambiar de página).
import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.classList.add('reveal-on');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
    const scan = () => document.querySelectorAll<HTMLElement>('[data-reveal]:not(.revealed)').forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove('reveal-on');
    };
  }, []);
}
