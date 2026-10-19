// Recordatorio diario a las 7:00 a. m. de Venezuela: quién llega y quién se va hoy (o mañana).
// Usa una clave secreta (AVISOS_SECRET) que la base compara con su huella; nunca la llave service_role.
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { avisoDelDia, hoyEnCaracas } from '../lib/avisos';
import { enviar, pushConfig } from '../lib/push';
import { cleanSupabaseKey, cleanSupabaseUrl } from '../../src/lib/supabaseConfig';

export default async () => {
  const url = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anon = cleanSupabaseKey(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  const secret = process.env.AVISOS_SECRET || '';
  if (!pushConfig() || !url || !anon || secret.length < 24) {
    console.log('recordatorio: avisos sin configurar');
    return;
  }
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const hoy = hoyEnCaracas();
  const { data, error } = await sb.rpc('push_digest', { p_secret: secret, p_day: hoy });
  if (error) {
    console.error('recordatorio: no se pudo leer la agenda', error.code);
    return;
  }
  let total = 0;
  for (const row of (data ?? []) as { endpoint: string; p256dh: string; auth: string; unit: string; arrivals: number; departures: number; arrivals_tomorrow: number; family_arrivals?: number }[]) {
    const aviso = avisoDelDia(row, hoy);
    if (!aviso) continue;
    const { enviados, muertos } = await enviar([row], aviso);
    total += enviados;
    for (const m of muertos) await sb.rpc('push_forget', { p_secret: secret, p_endpoint: m });
  }
  console.log(`recordatorio: ${total} avisos enviados`);
};

// 11:00 UTC = 7:00 a. m. en Venezuela
export const config: Config = { schedule: '0 11 * * *' };
