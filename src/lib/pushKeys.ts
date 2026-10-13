// Utilidades de llaves para los avisos (Web Push). Funciones puras, se prueban sin navegador.

export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface PushSetup {
  publicKey: string;
  privateKey: string;
  secret: string;
  sql: string;
}

/**
 * Genera en este navegador todo lo que hace falta para activar los avisos:
 * las llaves VAPID (pública y privada), la clave del recordatorio diario y la
 * línea de SQL que guarda solo su huella. Nada de esto pasa por ningún servidor.
 */
export async function generatePushSetup(): Promise<PushSetup> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const publicKey = toBase64Url(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await sha256Hex(secret);
  const sql = `insert into public.app_secrets (name, sha256) values ('avisos', '${hash}')\n  on conflict (name) do update set sha256 = excluded.sha256;`;
  return { publicKey, privateKey: jwk.d!, secret, sql };
}
