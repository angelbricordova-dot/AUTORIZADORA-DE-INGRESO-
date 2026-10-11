// Lectura con IA (opcional): la foto viaja a nuestra función de Netlify, que la
// reenvía a Claude con la API key guardada en el servidor. No se guarda en ningún lado.
import type { Guest } from './types';
import { canvasToBlob, toCanvas } from './image';
import { cleanPersonName } from './sanitize';
import { formatCedula, isValidCedula } from './cedula';

export interface AiStatus {
  enabled: boolean;
}

export async function aiStatus(): Promise<AiStatus> {
  try {
    const r = await fetch('/api/leer-cedula', { method: 'GET', headers: { Accept: 'application/json' } });
    if (!r.ok) return { enabled: false };
    const j = (await r.json()) as { enabled?: unknown };
    return { enabled: j.enabled === true };
  } catch {
    return { enabled: false };
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function readCedulaAI(file: Blob, accessToken: string): Promise<Guest[]> {
  const canvas = await toCanvas(file, 1568);
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  const res = await fetch('/api/leer-cedula', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ image: await toBase64(jpeg), media_type: 'image/jpeg' }),
  });
  if (res.status === 429) throw new Error('Llegaste al límite de lecturas con IA por esta hora. Usa la lectura local o escribe los datos.');
  if (res.status === 401) throw new Error('Tu sesión venció. Vuelve a entrar.');
  if (!res.ok) throw new Error('La lectura con IA no respondió. Usa la lectura local o escribe los datos.');
  const data = (await res.json()) as { personas?: { nombre?: unknown; cedula?: unknown }[] };
  return (data.personas ?? [])
    .map((p) => {
      const nombre = typeof p.nombre === 'string' ? cleanPersonName(p.nombre) : '';
      const ced = typeof p.cedula === 'string' && isValidCedula(p.cedula) ? formatCedula(p.cedula) : '';
      return { full_name: nombre, cedula: ced, is_minor: false };
    })
    .filter((g) => g.full_name || g.cedula)
    .slice(0, 7);
}
