// Avisos al teléfono (Web Push): activar/desactivar en este teléfono y pedir que se envíen.
import { fromBase64Url, toBase64Url } from './lib/pushKeys';
import { getSupabase, supabaseConfigured } from './lib/store/supabase';

export type PushState = 'unsupported' | 'needs-install' | 'off-server' | 'blocked' | 'off' | 'on';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4+). */
function iosBrowserTab(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

let serverInfo: Promise<{ enabled: boolean; publicKey?: string }> | null = null;
function loadServerInfo() {
  serverInfo ??= fetch('/api/avisar', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j) => ({ enabled: j?.enabled === true && typeof j.publicKey === 'string', publicKey: j?.publicKey }))
    .catch(() => ({ enabled: false }));
  return serverInfo;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return iosBrowserTab() ? 'needs-install' : 'unsupported';
  if (!supabaseConfigured || !(await loadServerInfo()).enabled) return 'off-server';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && (await currentSubscription()) ? 'on' : 'off';
}

async function token(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function enablePush(): Promise<void> {
  const info = await loadServerInfo();
  if (!info.enabled || !info.publicKey) throw new Error('Los avisos todavía no están configurados.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Para recibir avisos hay que permitir las notificaciones.');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // si la llave cambió, la suscripción vieja ya no sirve
  const key = sub?.options.applicationServerKey;
  if (sub && key && toBase64Url(key) !== info.publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(info.publicKey) });
  const p256dh = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  if (!p256dh || !auth) throw new Error('Este teléfono no entregó sus llaves de avisos.');
  const sb = getSupabase();
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  const { error } = await sb.from('push_subscriptions').insert({ endpoint: sub.endpoint, p256dh: toBase64Url(p256dh), auth: toBase64Url(auth) });
  if (error) throw new Error('No se pudo guardar este teléfono. ¿Ya corriste la migración de avisos en Supabase?');
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await getSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

async function post(body: unknown): Promise<{ enviados?: number }> {
  const t = await token();
  if (!t) throw new Error('Se requiere sesión');
  const r = await fetch('/api/avisar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('No se pudo enviar el aviso');
  return r.json();
}

export async function sendTestPush(): Promise<number> {
  return (await post({ prueba: true })).enviados ?? 0;
}

/** El panel registró una estadía: avisa a Zuleika. Nunca bloquea ni falla el guardado. */
export function notifyNewStay(reservationId: string): void {
  loadServerInfo()
    .then((info) => (info.enabled ? post({ reservation_id: reservationId }) : null))
    .catch(() => {});
}
