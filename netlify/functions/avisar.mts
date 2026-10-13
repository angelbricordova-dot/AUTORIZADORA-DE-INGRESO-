// Avisos al teléfono de Zuleika.
//  GET  → si los avisos están configurados y la llave pública para suscribirse.
//  POST {reservation_id} → el panel registró una estadía: avisa al equipo de trabajo.
//  POST {prueba: true}   → aviso de prueba a los teléfonos de quien lo pide.
// Seguridad: sesión obligatoria; la base solo devuelve teléfonos si quien llama administra esa estadía.
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { bearerToken } from '../lib/imagen';
import { avisoNuevaEstadia, avisoPrueba, hoyEnCaracas } from '../lib/avisos';
import { enviar, pushConfig } from '../lib/push';
import { cleanSupabaseKey, cleanSupabaseUrl } from '../../src/lib/supabaseConfig';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req: Request) => {
  const url = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anon = cleanSupabaseKey(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  const conf = pushConfig();
  if (req.method === 'GET') return json(200, conf && url && anon ? { enabled: true, publicKey: conf.publicKey } : { enabled: false });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  if (!conf || !url || !anon) return json(200, { enviados: 0, motivo: 'Avisos sin configurar' });
  const origin = req.headers.get('origin');
  if (origin && new URL(req.url).origin !== origin) return json(403, { error: 'Origen no permitido' });
  const token = bearerToken(req.headers.get('authorization'));
  if (!token) return json(401, { error: 'Se requiere sesión' });
  let body: { reservation_id?: unknown; prueba?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });

  if (body.prueba === true) {
    // las políticas solo dejan ver los teléfonos propios
    const { data, error } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth').limit(10);
    if (error) return json(error.code === '42501' ? 403 : 500, { error: 'No se pudo preparar el aviso' });
    if (!data?.length) return json(200, { enviados: 0 });
    const { enviados } = await enviar(data, avisoPrueba());
    return json(200, { enviados });
  }

  if (typeof body.reservation_id !== 'string' || !UUID.test(body.reservation_id)) return json(400, { error: 'Estadía inválida' });
  const { data, error } = await sb.rpc('push_new_stay', { p_reservation: body.reservation_id });
  if (error) return json(error.code === '42501' ? 403 : 500, { error: 'No se pudo preparar el aviso' });
  const rows = (data ?? []) as { endpoint: string; p256dh: string; auth: string; unit: string; check_in: string; check_out: string; people: number }[];
  if (!rows.length) return json(200, { enviados: 0 });
  const { enviados } = await enviar(rows, avisoNuevaEstadia(rows[0], hoyEnCaracas()));
  return json(200, { enviados });
};

export const config: Config = {
  path: '/api/avisar',
  method: ['GET', 'POST'],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
