// Limpia lo que se pega en las variables de entorno: espacios, comillas, saltos de línea
// y rutas como "/rest/v1/" que traen las URLs copiadas del panel de Supabase.

export function cleanSupabaseUrl(raw: string | undefined): string | null {
  const v = (raw ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function cleanSupabaseKey(raw: string | undefined): string | null {
  const v = (raw ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');
  return v.length >= 20 ? v : null;
}
