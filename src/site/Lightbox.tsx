// Fotos a pantalla completa: se deslizan con el dedo, se cierran con la X, el fondo o Escape.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';

export function Lightbox({ photos, start, title, onClose }: { photos: string[]; start: number; title: string; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(start);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const t = track.current;
        t?.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * t.clientWidth, behavior: 'smooth' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [start, onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`}>
      <div className="lightbox-bar">
        <span className="num" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <button ref={closeBtn} className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar las fotos">
          <Icon name="x" />
        </button>
      </div>
      <div
        className="lightbox-track"
        ref={track}
        onScroll={(e) => {
          const t = e.currentTarget;
          setIndex(Math.min(photos.length - 1, Math.max(0, Math.round(t.scrollLeft / t.clientWidth))));
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {photos.map((u, i) => (
          <figure key={u} className="lightbox-slide" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <img src={u} alt={`${title}, foto ${i + 1} de ${photos.length}`} loading={Math.abs(i - start) < 2 ? 'eager' : 'lazy'} />
          </figure>
        ))}
      </div>
    </div>
  );
}
