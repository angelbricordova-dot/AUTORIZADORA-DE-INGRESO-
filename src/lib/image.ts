// Punto 16: restringir archivos. Solo imágenes, tamaño máximo, y se re-codifican
// en el teléfono (eso además borra metadatos como la ubicación GPS de la foto).

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function checkImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `"${file.name}" no es una foto (JPG, PNG o WEBP).`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" pesa más de 15 MB.`;
  if (file.size < 1024) return `"${file.name}" está vacía o dañada.`;
  return null;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* algunos navegadores no soportan la opción; se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Redimensiona y devuelve un canvas limpio (sin metadatos). */
export async function toCanvas(file: Blob, maxSide = 1800): Promise<HTMLCanvasElement> {
  const img = await decode(file);
  const w0 = img.width;
  const h0 = img.height;
  if (!w0 || !h0) throw new Error('No se pudo abrir la foto.');
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w0 * scale);
  canvas.height = Math.round(h0 * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la foto.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if ('close' in img) img.close();
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto.'))), type, quality),
  );
}

/** Miniatura pequeña para mostrar junto a los datos leídos (queda solo en memoria). */
export async function thumbnail(file: Blob): Promise<string> {
  const c = await toCanvas(file, 240);
  return c.toDataURL('image/jpeg', 0.7);
}

/** Binarización adaptativa: separa el texto oscuro del fondo dorado de la cédula. */
export function binarize(src: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(data, 0, 0);

  const blurC = document.createElement('canvas');
  blurC.width = w;
  blurC.height = h;
  const bctx = blurC.getContext('2d', { willReadFrequently: true });
  let blur: Uint8ClampedArray | null = null;
  if (bctx && 'filter' in bctx) {
    bctx.filter = `blur(${Math.max(3, Math.round(w / 22))}px)`;
    bctx.drawImage(out, 0, 0);
    blur = bctx.getImageData(0, 0, w, h).data;
  }
  const res = ctx.createImageData(w, h);
  const o = res.data;
  for (let i = 0; i < o.length; i += 4) {
    const threshold = blur ? blur[i] - 10 : 150;
    const v = px[i] < threshold ? 0 : 255;
    o[i] = o[i + 1] = o[i + 2] = v;
    o[i + 3] = 255;
  }
  ctx.putImageData(res, 0, 0);
  return out;
}
