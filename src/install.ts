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

/** Recuerda qué se usa en esta app instalada: el panel o la app de trabajo de Zuleika. */
export function rememberPanel(kind: 'admin' | 'trabajo' = 'admin') {
  try {
    localStorage.setItem(PANEL_FLAG, kind);
  } catch {
    /* sin almacenamiento */
  }
}

/** Si la app instalada abrió en la página pública pero se usa para el panel, devuelve a dónde ir. */
export function shouldOpenPanel(pathname: string): string | null {
  if (pathname !== '/' || !isStandalone()) return null;
  try {
    const v = localStorage.getItem(PANEL_FLAG);
    return v === 'trabajo' ? '/trabajo' : v === '1' || v === 'admin' ? '/admin' : null;
  } catch {
    return null;
  }
}

/** Cambia el manifiesto y el ícono del teléfono según la app (panel o trabajo). */
export function setAppIdentity(kind: 'admin' | 'trabajo') {
  const manifest = kind === 'trabajo' ? '/trabajo.webmanifest' : '/panel.webmanifest';
  const icon = kind === 'trabajo' ? '/icon-trabajo-180.png' : '/apple-touch-icon.png?v=2';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', manifest);
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', icon);
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', kind === 'trabajo' ? 'Trabajo Tu Día' : 'Panel Tu Día');
  rememberPanel(kind);
}
