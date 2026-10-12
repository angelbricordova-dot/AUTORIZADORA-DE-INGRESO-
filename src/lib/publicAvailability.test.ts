import { describe, expect, it } from 'vitest';
import type { BusyRange, PublicListing } from './types';
import { alternatives, bookingMessage, exceptionMessage, isBusyNight, isRangeFree, quote, whatsappUrl } from './publicAvailability';

const L = (id: string, kind: 'propio' | 'aliado', capacity: number, price: number): PublicListing => ({
  id, kind, title: kind === 'propio' ? 'Tu Día en Tucacas · N°30' : `Apartamento ${id}`, unit: id, conjunto: 'JDC Pescadores I', summary: '', description: '',
  capacity, bedrooms: null, beds: null, bathrooms: null, nightly_usd: price, promo: '', amenities: [], photos: [], contact_whatsapp: '', airbnb_url: '', instagram_url: '', tiktok_url: '',
});
const busy: BusyRange[] = [
  { property_id: '30', check_in: '2026-10-17', check_out: '2026-10-19' },
  { property_id: '12', check_in: '2026-10-18', check_out: '2026-10-20' },
];

describe('disponibilidad pública', () => {
  it('noche ocupada y rangos libres', () => {
    expect(isBusyNight(busy, '30', '2026-10-17')).toBe(true);
    expect(isBusyNight(busy, '30', '2026-10-19')).toBe(false);
    expect(isRangeFree(busy, '30', '2026-10-19', '2026-10-21')).toBe(true);
    expect(isRangeFree(busy, '30', '2026-10-18', '2026-10-20')).toBe(false);
  });
  it('ofrece alternativas libres con capacidad suficiente', () => {
    const list = [L('30', 'propio', 7, 90), L('12', 'aliado', 6, 120), L('21', 'aliado', 5, 100)];
    expect(alternatives(list, busy, '2026-10-17', '2026-10-19', 5, '30').map((l) => l.id)).toEqual(['21']);
    expect(alternatives(list, busy, '2026-10-17', '2026-10-19', 6, '30')).toEqual([]);
  });
  it('cotiza y arma el mensaje de WhatsApp', () => {
    expect(quote({ nightly_usd: 90 }, 2)).toBe(180);
    const msg = bookingMessage(L('30', 'propio', 7, 90), '2026-10-17', '2026-10-19', 5);
    expect(msg).toContain('Personas: 5');
    expect(msg).toContain('(2 noches)');
    expect(msg).toContain('$180');
    expect(whatsappUrl('+58 424-270-3482', 'hola mundo')).toBe('https://wa.me/584242703482?text=hola%20mundo');
  });
  it('pide una excepción cuando son más personas que la capacidad', () => {
    const msg = exceptionMessage(L('30', 'propio', 7, 90), '2026-10-17', '2026-10-19', 9, 3);
    expect(msg).toContain('somos 9 personas');
    expect(msg).toContain('6 adultos y 3 niños');
    expect(msg).toContain('para 7 personas');
    expect(exceptionMessage(L('30', 'propio', 7, 90), null, null, 8, 0)).not.toContain('niño');
  });
});
