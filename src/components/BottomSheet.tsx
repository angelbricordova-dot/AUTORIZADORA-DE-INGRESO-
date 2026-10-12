import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Hoja que sube desde abajo, cómoda con el pulgar. Cierra con el fondo o con Escape. */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  // Se monta en <body>: así un formulario dentro de la hoja nunca queda anidado en otro formulario
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="grabber" />
        <div className="bottom-sheet-inner">{children}</div>
      </div>
    </>,
    document.body,
  );
}
