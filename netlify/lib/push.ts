// Envío de avisos con Web Push. Las llaves VAPID viven solo en Netlify.
import webpush from 'web-push';
import type { Aviso } from './avisos';

export interface Destino {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function pushConfig(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(publicKey) || !/^[A-Za-z0-9_-]{40,50}$/.test(privateKey)) return null;
  return { publicKey, privateKey };
}

/** Envía y devuelve las direcciones que ya no existen (el teléfono desinstaló o revocó el permiso). */
export async function enviar(destinos: Destino[], aviso: Aviso): Promise<{ enviados: number; muertos: string[] }> {
  const conf = pushConfig();
  if (!conf) return { enviados: 0, muertos: [] };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@tudiaentucacas.app', conf.publicKey, conf.privateKey);
  const payload = JSON.stringify(aviso);
  let enviados = 0;
  const muertos: string[] = [];
  await Promise.all(
    destinos.map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 60 * 60 * 12, urgency: 'high' });
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) muertos.push(d.endpoint);
      }
    }),
  );
  return { enviados, muertos };
}
