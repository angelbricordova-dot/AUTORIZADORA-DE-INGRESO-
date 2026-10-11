// Modo demo: todo se guarda en este navegador. Los datos de ejemplo son inventados.
import type { Reservation } from '../types';
import { addDays, todayISO } from '../dates';
import { conflictsFor } from '../availability';
import type { AppData, DataStore } from './types';
import { DEFAULT_SETTINGS } from './types';
import { sanitizeGuests, sanitizeReservation, sanitizeVehicles } from './validate';

const KEY = 'pescadores-demo-v1';

function seed(): AppData {
  const t = todayISO();
  const mk = (p: Partial<Reservation> & Pick<Reservation, 'id' | 'check_in' | 'check_out' | 'contact_name' | 'channel'>): Reservation => ({
    property_id: 'demo-30',
    contact_phone: '',
    stay_type: 'Alquiler Vacacional',
    status: 'confirmada',
    total_usd: 0,
    paid_usd: 0,
    auth_status: 'pendiente',
    auth_sent_at: null,
    notes: '',
    guests: [],
    vehicles: [],
    ...p,
  });
  return {
    settings: { ...DEFAULT_SETTINGS },
    property: { id: 'demo-30', name: 'Apartamento N°30', conjunto: DEFAULT_SETTINGS.conjunto, unit: DEFAULT_SETTINGS.unit },
    reservations: [
      mk({
        id: 'demo-1', contact_name: 'Familia Márquez', contact_phone: '0414 555 0101', channel: 'airbnb',
        check_in: addDays(t, -6), check_out: addDays(t, -3), total_usd: 330, paid_usd: 330, auth_status: 'enviada', auth_sent_at: addDays(t, -7),
        guests: [
          { full_name: 'Neyluz Márquez', cedula: '12.816.045', is_minor: false },
          { full_name: 'Carlos Márquez', cedula: '13.402.118', is_minor: false },
        ],
      }),
      mk({
        id: 'demo-2', contact_name: 'Luis Hernández', contact_phone: '0412 555 0144', channel: 'whatsapp',
        check_in: addDays(t, -1), check_out: addDays(t, 1), total_usd: 240, paid_usd: 240, auth_status: 'enviada', auth_sent_at: addDays(t, -2),
        guests: [
          { full_name: 'Luis Hernández', cedula: '18.234.567', is_minor: false },
          { full_name: 'Ana Hernández', cedula: '19.876.543', is_minor: false },
          { full_name: 'Sofía Hernández', cedula: '', is_minor: true },
        ],
        vehicles: [{ description: 'Toyota Corolla vinotinto', plate: 'AA046KT' }],
      }),
      mk({
        id: 'demo-3', contact_name: 'Grupo Rodríguez (7 personas)', contact_phone: '0424 555 0177', channel: 'marketplace',
        check_in: addDays(t, 2), check_out: addDays(t, 5), total_usd: 390, paid_usd: 150,
        notes: 'Llegan después de las 4 pm. Llevan cava.',
      }),
      mk({
        id: 'demo-4', contact_name: 'Pareja Díaz', channel: 'instagram', status: 'tentativa',
        check_in: addDays(t, 4), check_out: addDays(t, 6), total_usd: 220, paid_usd: 0,
        notes: 'Preguntaron por el mismo fin de semana. Ofrecer otro apartamento.',
      }),
      mk({
        id: 'demo-5', contact_name: 'Familia Contreras', channel: 'mercadolibre',
        check_in: addDays(t, 9), check_out: addDays(t, 12), total_usd: 360, paid_usd: 360,
      }),
      mk({
        id: 'demo-6', contact_name: 'María Fernanda Gil', channel: 'stay',
        check_in: addDays(t, 15), check_out: addDays(t, 17), total_usd: 250, paid_usd: 100,
      }),
    ],
  };
}

function read(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && Array.isArray(parsed.reservations) && parsed.settings) return parsed;
    }
  } catch {
    /* almacenamiento bloqueado o dañado: se usan los datos de ejemplo */
  }
  return seed();
}

function write(d: AppData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* modo privado: los cambios viven solo en esta pestaña */
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que borrar */
  }
}

let memory: AppData | null = null;
const get = () => (memory ??= read());
const commit = (d: AppData) => {
  memory = d;
  write(d);
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const demoStore: DataStore = {
  mode: 'demo',
  async load() {
    return structuredClone(get());
  },
  async saveSettings(s) {
    const d = get();
    commit({ ...d, settings: s, property: { ...d.property, conjunto: s.conjunto, unit: s.unit } });
  },
  async saveReservation(input) {
    const clean = sanitizeReservation(input);
    const d = get();
    const existing = clean.id ? d.reservations.find((r) => r.id === clean.id) : undefined;
    const next: Reservation = existing
      ? { ...existing, ...clean, id: existing.id }
      : { ...clean, id: uid(), property_id: d.property.id, auth_status: 'pendiente', auth_sent_at: null, guests: [], vehicles: [] };
    if (next.status === 'confirmada' && conflictsFor(next, d.reservations).some((o) => o.status === 'confirmada')) {
      throw new Error('Esas fechas chocan con otra reserva confirmada. Revisa el calendario o márcala como tentativa.');
    }
    commit({ ...d, reservations: existing ? d.reservations.map((r) => (r.id === next.id ? next : r)) : [...d.reservations, next] });
    return next.id;
  },
  async deleteReservation(id) {
    const d = get();
    commit({ ...d, reservations: d.reservations.filter((r) => r.id !== id) });
  },
  async saveAuthorization(id, guests, vehicles) {
    const g = sanitizeGuests(guests);
    const v = sanitizeVehicles(vehicles);
    const d = get();
    commit({
      ...d,
      reservations: d.reservations.map((r) =>
        r.id === id ? { ...r, guests: g, vehicles: v, auth_status: r.auth_status === 'pendiente' ? 'generada' : r.auth_status } : r,
      ),
    });
  },
  async markSent(id) {
    const d = get();
    commit({ ...d, reservations: d.reservations.map((r) => (r.id === id ? { ...r, auth_status: 'enviada', auth_sent_at: new Date().toISOString() } : r)) });
  },
};
