import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Toast = { id: number; text: string; tone: 'ok' | 'bad' };
type Ctx = (text: string, tone?: Toast['tone']) => void;

const ToastCtx = createContext<Ctx>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<Ctx>((text, tone = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), tone === 'bad' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toast ? (
          <div key={toast.id} className={`toast ${toast.tone === 'bad' ? 'toast-bad' : ''}`} onClick={() => setToast(null)}>
            <Icon name={toast.tone === 'bad' ? 'alert' : 'check'} />
            <span>{toast.text}</span>
          </div>
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
