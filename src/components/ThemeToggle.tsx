// Botón de modo día / modo noche: el sol se esconde y aparece la luna (y al revés).
import { useId } from 'react';
import { setTheme, useTheme } from '../theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === 'dark';
  const mask = `luna-${useId().replace(/:/g, '')}`;
  return (
    <button
      className={`icon-btn theme-toggle ${dark ? 'is-dark' : ''} ${className}`}
      type="button"
      aria-label={dark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      aria-pressed={dark}
      onClick={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        setTheme(dark ? 'light' : 'dark', { x: b.left + b.width / 2, y: b.top + b.height / 2 });
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <mask id={mask}>
          <rect width="24" height="24" fill="#fff" />
          <circle className="moon-bite" cx="17" cy="7" r="6" fill="#000" />
        </mask>
        <circle className="sun-core" cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${mask})`} />
        <g className="sun-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}
