// Instalar el panel como aplicación en el teléfono.
// Android/Chrome avisa con "beforeinstallprompt"; en iPhone se hace desde el menú Compartir.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const PANEL_FLAG = 'tudia-panel';

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canPromptInstall(): boolean {
  return !!deferred;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
  return outcome === 'accepted';
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Recuerda que en esta app instalada se usa el panel. */
export function rememberPanel() {
  try {
    localStorage.setItem(PANEL_FLAG, '1');
  } catch {
    /* sin almacenamiento */
  }
}

/** Si la app instalada abrió en la página pública pero se usa para el panel, va directo al panel. */
export function shouldOpenPanel(pathname: string): boolean {
  if (pathname !== '/' || !isStandalone()) return false;
  try {
    return localStorage.getItem(PANEL_FLAG) === '1';
  } catch {
    return false;
  }
}
