// Íconos propios: 24×24, trazo 1.75, puntas redondeadas.
import type { SVGProps } from 'react';

const paths = {
  home: 'M3.5 10.5 12 4l8.5 6.5M5.5 9v10.5h5v-6h3v6h5V9',
  calendar: 'M4 6.5h16v13H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  idcard: 'M3.5 6h17v12h-17zM7 14.5c.5-1.4 1.6-2 2.75-2s2.25.6 2.75 2M9.75 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M14.5 10h3M14.5 13h3',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  plus: 'M12 5v14M5 12h14',
  camera: 'M4 8.5h3l1.5-2.5h7L17 8.5h3V19H4zM12 16.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5',
  sparkle: 'M12 3.5 13.8 9 19.5 10.5 13.8 12 12 17.5 10.2 12 4.5 10.5 10.2 9zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  send: 'M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  check: 'M5 12.5 10 17.5 19 7',
  alert: 'M12 4 21 19.5H3zM12 10v4.5M12 17h.01',
  chevronRight: 'M9.5 6 15.5 12 9.5 18',
  chevronLeft: 'M14.5 6 8.5 12 14.5 18',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 11v5M13.5 11v5',
  car: 'M5 16.5V12l2-5h10l2 5v4.5M3.5 12h17M5 16.5h14v2.5h-2.5v-2.5M7.5 19v-2.5H5V19zM8 14h.01M16 14h.01',
  user: 'M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5M5 20c.9-3.4 3.6-5 7-5s6.1 1.6 7 5',
  clipboard: 'M9 4.5h6v3H9zM9 6H6v14.5h12V6h-3M9 12h6M9 15.5h4',
  logout: 'M14 4.5H5.5v15H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5',
  shield: 'M12 3.5 19.5 6v6c0 4.2-3.1 7.4-7.5 8.5C7.6 19.4 4.5 16.2 4.5 12V6zM9 12l2.2 2.2L15.5 10',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 7.5V12l3 2',
  money: 'M3.5 7h17v10h-17zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M6.5 10v4M17.5 10v4',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4',
  file: 'M6 3.5h8l4 4v13H6zM14 3.5V8h4M9 13h6M9 16.5h6',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 11v5.5M12 7.75h.01',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, title, ...rest }: { name: IconName; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}
