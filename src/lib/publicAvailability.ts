// Disponibilidad pública: solo trabaja con rangos de fechas ocupadas, sin datos de huéspedes.
import type { BusyRange, PublicListing } from './types';
import { formatDayMonth, nightsBetween, weekdayShort } from './dates';
import { formatUSD } from './money';

export function isBusyNight(busy: BusyRange[], propertyId: string, day: string): boolean {
  return busy.some((b) => b.property_id === propertyId && b.check_in <= day && b.check_out > day);
}

export function isRangeFree(busy: BusyRange[], propertyId: string, from: string, to: string): boolean {
  return !busy.some((b) => b.property_id === propertyId && b.check_in < to && from < b.check_out);
}

export function quote(listing: Pick<PublicListing, 'nightly_usd'>, nights: number): number | null {
  return listing.nightly_usd == null || nights < 1 ? null : Math.round(listing.nightly_usd * nights * 100) / 100;
}

/** Apartamentos libres en esas fechas que admiten esa cantidad de personas. */
export function alternatives(listings: PublicListing[], busy: BusyRange[], from: string, to: string, guests: number, exceptId?: string): PublicListing[] {
  return listings.filter((l) => l.id !== exceptId && l.capacity >= guests && isRangeFree(busy, l.id, from, to));
}

export function bookingMessage(l: Pick<PublicListing, 'kind' | 'title' | 'unit' | 'nightly_usd'>, from: string, to: string, guests: number): string {
  const n = nightsBetween(from, to);
  const what = l.kind === 'propio' ? `${l.title}` : `el ${l.title || `apartamento ${l.unit}`} que vi en su página (Pescadores I)`;
  const total = quote(l, n);
  return [
    `Hola, quiero reservar ${what}.`,
    `Entrada: ${weekdayShort(from)} ${formatDayMonth(from)} · Salida: ${weekdayShort(to)} ${formatDayMonth(to)} (${n} ${n === 1 ? 'noche' : 'noches'})`,
    `Personas: ${guests}`,
    total != null ? `Precio publicado: ${formatUSD(total)}` : '',
    '¿Está disponible?',
  ]
    .filter(Boolean)
    .join('\n');
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/** Grupo más grande que la capacidad: se pide una excepción antes de ofrecer otros apartamentos. */
export function exceptionMessage(l: Pick<PublicListing, 'title' | 'capacity'>, from: string | null, to: string | null, guests: number, kids: number): string {
  const n = from && to ? nightsBetween(from, to) : 0;
  const adults = Math.max(0, guests - kids);
  return [
    `Hola, somos ${guests} personas y nos gustaría quedarnos en ${l.title}.`,
    kids > 0 ? `Somos ${adults} ${adults === 1 ? 'adulto' : 'adultos'} y ${kids} ${kids === 1 ? 'niño' : 'niños'}.` : '',
    from && to ? `Entrada: ${weekdayShort(from)} ${formatDayMonth(from)} · Salida: ${weekdayShort(to)} ${formatDayMonth(to)} (${n} ${n === 1 ? 'noche' : 'noches'})` : '',
    `Sé que el apartamento es para ${l.capacity} personas. ¿Es posible hacer una excepción?`,
  ]
    .filter(Boolean)
    .join('\n');
}
