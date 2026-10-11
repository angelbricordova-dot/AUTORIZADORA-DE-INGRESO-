// Validación estricta de la imagen recibida (puntos 14 y 16).

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** ~4 MB de imagen en base64; el teléfono ya la reduce a 1568 px antes de enviarla. */
export const MAX_BASE64_CHARS = 5_600_000;

export type ImageCheck = { ok: true; data: string; media_type: MediaType } | { ok: false; error: string };

function magicMatches(bytes: Uint8Array, type: MediaType): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === 'RIFF' && webp === 'WEBP';
}

export function checkImagePayload(body: unknown): ImageCheck {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo inválido' };
  const { image, media_type } = body as Record<string, unknown>;
  if (typeof media_type !== 'string' || !(MEDIA_TYPES as readonly string[]).includes(media_type)) {
    return { ok: false, error: 'Tipo de imagen no permitido' };
  }
  if (typeof image !== 'string' || image.length < 200) return { ok: false, error: 'Imagen vacía' };
  if (image.length > MAX_BASE64_CHARS) return { ok: false, error: 'Imagen demasiado grande' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return { ok: false, error: 'Imagen mal codificada' };
  const head = Uint8Array.from(atob(image.slice(0, 24)), (c) => c.charCodeAt(0));
  if (!magicMatches(head, media_type as MediaType)) return { ok: false, error: 'El archivo no es la imagen que dice ser' };
  return { ok: true, data: image, media_type: media_type as MediaType };
}

/** Punto 17: solo devolvemos nombre y número, limpios. */
export function cleanPersonas(raw: unknown): { nombre: string; cedula: string }[] {
  const list = (raw as { personas?: unknown })?.personas;
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 7)
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const nombre = typeof o.nombre === 'string' ? o.nombre.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
      const cedula = typeof o.cedula === 'string' ? o.cedula.toUpperCase().replace(/[^VE0-9.-]/g, '').slice(0, 14) : '';
      return { nombre, cedula };
    })
    .filter((p) => p.nombre || p.cedula);
}

export function bearerToken(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+([A-Za-z0-9._-]{20,4096})$/);
  return m ? m[1] : null;
}
