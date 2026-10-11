// Envío de la planilla: en el teléfono abre el menú "Compartir" (WhatsApp incluido) con el archivo.
// En computadora descarga el archivo y abre el chat de la administradora con el mensaje listo.
import { phoneForWhatsApp } from './sanitize';

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array([0])], 'x.xlsx', { type: XLSX_TYPE });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareFile(file: File, text: string): Promise<ShareResult> {
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(file, file.name);
  return 'downloaded';
}

export function whatsappLink(phone: string, text: string): string {
  const p = phoneForWhatsApp(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
