// Modo demo: todo se guarda en este navegador. Los datos de ejemplo son inventados.
import type { CashMovement, Payment, Property, PublicData, Reservation, StayOps } from '../types';
import { addDays, todayISO } from '../dates';
import { conflictsFor } from '../availability';
import type { AppData, DataStore } from './types';
import { DEFAULT_SETTINGS, OWN_DEFAULTS, ownProperty } from './types';
import { sanitizeCash, sanitizeGuests, sanitizeOpsPatch, sanitizePayment, sanitizeProperty, sanitizeReservation, sanitizeVehicles } from './validate';
import { emptyOps, staffStaysFromApp } from '../ops';

const KEY = 'tudia-demo-v3';

function seed(): AppData {
  const t = todayISO();
  const own: Property = { ...OWN_DEFAULTS, id: 'demo-30', promo: 'Entre semana: 3 días y 2 noches por $165 para 7 personas' };
  const at = (days: number, hour = 15) => `${addDays(t, days)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const partner = (id: string, unit: string, cost: number, price: number, capacity: number, sort: number): Property => ({
    ...OWN_DEFAULTS,
    id,
    kind: 'aliado',
    name: `Apto ${unit} (ejemplo)`,
    title: `Apartamento ${unit}`,
    unit,
    summary: 'Otro apartamento del mismo conjunto, con acceso a piscina y áreas comunes.',
    description: '',
    photos: [],
    bedrooms: 2,
    beds: capacity - 2,
    bathrooms: 1,
    amenities: ['Piscina', 'WiFi', 'Aire acondicionado', 'Estacionamiento'],
    capacity,
    nightly_usd: price,
    partner_cost_usd: cost,
    promo: '',
    sort,
    owner_name: '',
    owner_cedula: '',
    contact_whatsapp: '',
    airbnb_url: '',
    instagram_url: '',
    tiktok_url: '',
  });
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
  const pay = (id: string, reservation_id: string, amount_usd: number, method: Payment['method'], received_by: Payment['received_by'], days: number, reference = ''): Payment => ({
    id, reservation_id, amount_usd, method, received_by, paid_on: addDays(t, days), reference, note: '',
  });
  const payments: Payment[] = [
    pay('pay-1', 'demo-1', 130, 'pago_movil', 'owner', -9, '0412 · ref 4471'),
    pay('pay-2', 'demo-1', 200, 'efectivo_usd', 'staff', -6),
    pay('pay-3', 'demo-2', 180, 'zelle', 'owner', -4),
    pay('pay-4', 'demo-2', 60, 'efectivo_usd', 'staff', -1),
    pay('pay-5', 'demo-3', 150, 'transferencia', 'owner', -2, 'Banesco 0098'),
    pay('pay-6', 'demo-5', 360, 'pago_movil', 'owner', -1),
    pay('pay-7', 'demo-6', 100, 'binance', 'owner', -3),
  ];
  const ops: StayOps[] = [
    {
      ...emptyOps('demo-1', 100),
      clean_before_at: at(-7, 12), keys_at: at(-6), deposit_received_at: at(-6), deposit_returned_at: at(-3, 13), deposit_returned_usd: 100,
      clean_after_at: at(-3, 16), linens_at: at(-2, 11),
    },
    { ...emptyOps('demo-2', 100), clean_before_at: at(-2, 12), keys_at: at(-1), deposit_received_at: at(-1) },
  ];
  const cash: CashMovement[] = [{ id: 'cash-1', kind: 'gasto', amount_usd: 12, happened_on: addDays(t, -3), note: 'Detergente y cloro' }];
  return {
    settings: { ...DEFAULT_SETTINGS },
    properties: [own, partner('demo-12', '12', 100, 120, 6, 1), partner('demo-21', '21', 80, 100, 5, 2)],
    payments,
    ops,
    cash,
    team: [],
    reservations: [
      mk({
        id: 'demo-1', contact_name: 'Familia Márquez', contact_phone: '0414 555 0101', channel: 'airbnb',
        check_in: addDays(t, -6), check_out: addDays(t, -3), total_usd: 330, paid_usd: 330, auth_status: 'enviada', auth_sent_at: at(-7),
        guests: [
          { full_name: 'Neyluz Márquez', cedula: '12.816.045', is_minor: false },
          { full_name: 'Carlos Márquez', cedula: '13.402.118', is_minor: false },
        ],
      }),
      mk({
        id: 'demo-2', contact_name: 'Luis Hernández', contact_phone: '0412 555 0144', channel: 'whatsapp',
        check_in: addDays(t, -1), check_out: addDays(t, 1), total_usd: 240, paid_usd: 240, auth_status: 'enviada', auth_sent_at: at(-2),
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
      mk({ id: 'demo-5', contact_name: 'Familia Contreras', channel: 'mercadolibre', check_in: addDays(t, 9), check_out: addDays(t, 12), total_usd: 360, paid_usd: 360 }),
      mk({ id: 'demo-6', contact_name: 'María Fernanda Gil', channel: 'stay', check_in: addDays(t, 15), check_out: addDays(t, 17), total_usd: 250, paid_usd: 100 }),
      mk({ id: 'demo-7', property_id: 'demo-12', contact_name: 'Ocupado por el dueño', channel: 'otro', check_in: addDays(t, 3), check_out: addDays(t, 6), auth_status: 'enviada' }),
      mk({ id: 'demo-8', property_id: 'demo-21', contact_name: 'Reserva propia del dueño', channel: 'otro', check_in: addDays(t, 9), check_out: addDays(t, 11), auth_status: 'enviada' }),
    ],
  };
}

function read(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && Array.isArray(parsed.reservations) && Array.isArray(parsed.properties) && Array.isArray(parsed.payments) && parsed.settings) return parsed;
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
    /* modo privado o sin espacio: los cambios viven solo en esta pestaña */
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que borrar */
  }
  memory = null;
}

let memory: AppData | null = null;
const get = () => (memory ??= read());
const commit = (d: AppData) => {
  memory = d;
  write(d);
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

/** Como en la base real: lo pagado es la suma de los pagos. */
function withPaid(d: AppData): AppData {
  return {
    ...d,
    reservations: d.reservations.map((r) => ({
      ...r,
      paid_usd: Math.round(d.payments.filter((p) => p.reservation_id === r.id).reduce((s, p) => s + p.amount_usd, 0) * 100) / 100,
    })),
  };
}

export const demoStore: DataStore = {
  mode: 'demo',
  async load() {
    const d = structuredClone(get());
    let name = '';
    try {
      name = localStorage.getItem('tudia-demo-nombre') ?? '';
    } catch {
      /* sin almacenamiento */
    }
    return { ...d, me: { name: name || d.settings.owner_name.split(' ')[0], email: '', role: 'owner' as const } };
  },
  async saveMyName(name) {
    try {
      localStorage.setItem('tudia-demo-nombre', name.trim().slice(0, 40));
    } catch {
      /* sin almacenamiento */
    }
  },
  async saveSettings(s) {
    const d = get();
    const own = ownProperty(d);
    commit({
      ...d,
      settings: s,
      properties: d.properties.map((p) => (own && p.id === own.id ? { ...p, conjunto: s.conjunto, unit: s.unit } : p)),
    });
  },
  async saveReservation(input) {
    const clean = sanitizeReservation(input);
    const d = get();
    const existing = clean.id ? d.reservations.find((r) => r.id === clean.id) : undefined;
    const propertyId = clean.property_id ?? existing?.property_id ?? ownProperty(d)?.id ?? 'demo-30';
    const next: Reservation = existing
      ? { ...existing, ...clean, id: existing.id, property_id: propertyId }
      : { ...clean, id: uid(), property_id: propertyId, auth_status: 'pendiente', auth_sent_at: null, guests: [], vehicles: [] };
    const sameProperty = d.reservations.filter((r) => r.property_id === propertyId);
    if (next.status === 'confirmada' && conflictsFor(next, sameProperty).some((o) => o.status === 'confirmada')) {
      throw new Error('Esas fechas chocan con otra reserva confirmada. Revisa el calendario o márcala como tentativa.');
    }
    commit(withPaid({ ...d, reservations: existing ? d.reservations.map((r) => (r.id === next.id ? next : r)) : [...d.reservations, next] }));
    return next.id;
  },
  async deleteReservation(id) {
    const d = get();
    commit({
      ...d,
      reservations: d.reservations.filter((r) => r.id !== id),
      payments: d.payments.filter((p) => p.reservation_id !== id),
      ops: d.ops.filter((o) => o.reservation_id !== id),
    });
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
  async saveProperty(input) {
    const clean = sanitizeProperty(input);
    const d = get();
    const id = clean.id ?? uid();
    const next = { ...clean, id } as Property;
    const exists = d.properties.some((p) => p.id === id);
    commit({ ...d, properties: exists ? d.properties.map((p) => (p.id === id ? next : p)) : [...d.properties, next] });
    return id;
  },
  async deleteProperty(id) {
    const d = get();
    if (d.properties.find((p) => p.id === id)?.kind === 'propio') throw new Error('El apartamento propio no se puede borrar.');
    const gone = new Set(d.reservations.filter((r) => r.property_id === id).map((r) => r.id));
    commit({
      ...d,
      properties: d.properties.filter((p) => p.id !== id),
      reservations: d.reservations.filter((r) => !gone.has(r.id)),
      payments: d.payments.filter((p) => !gone.has(p.reservation_id)),
      ops: d.ops.filter((o) => !gone.has(o.reservation_id)),
    });
  },
  async uploadPhoto(_propertyId, jpeg) {
    // En demo la foto se guarda en el navegador como texto (data URL)
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('No se pudo leer la foto.'));
      fr.readAsDataURL(jpeg);
    });
  },
  async loadPublic(from, to): Promise<PublicData> {
    const d = get();
    const published = d.properties.filter((p) => p.published);
    const ids = new Set(published.map((p) => p.id));
    return {
      listings: published
        .sort((a, b) => Number(b.kind === 'propio') - Number(a.kind === 'propio') || a.sort - b.sort)
        .map((p) => ({
          id: p.id, kind: p.kind, title: p.title || p.name, unit: p.unit, conjunto: p.conjunto, summary: p.summary, description: p.description,
          capacity: p.capacity, bedrooms: p.bedrooms, beds: p.beds, bathrooms: p.bathrooms, nightly_usd: p.nightly_usd, promo: p.promo, amenities: p.amenities, photos: p.photos,
          contact_whatsapp: p.kind === 'propio' ? p.contact_whatsapp : '', airbnb_url: p.kind === 'propio' ? p.airbnb_url : '', instagram_url: p.kind === 'propio' ? p.instagram_url : '', tiktok_url: p.kind === 'propio' ? p.tiktok_url : '',
        })),
      busy: d.reservations
        .filter((r) => ids.has(r.property_id) && r.status === 'confirmada' && r.check_out > from && r.check_in < to)
        .map((r) => ({ property_id: r.property_id, check_in: r.check_in, check_out: r.check_out })),
    };
  },
  async addPayment(input) {
    const p = sanitizePayment(input);
    const d = get();
    if (!d.reservations.some((r) => r.id === p.reservation_id)) throw new Error('No encontré esa estadía.');
    commit(withPaid({ ...d, payments: [...d.payments, { ...p, id: uid() }] }));
  },
  async deletePayment(id) {
    const d = get();
    commit(withPaid({ ...d, payments: d.payments.filter((p) => p.id !== id) }));
  },
  async saveOps(reservationId, patch) {
    const clean = sanitizeOpsPatch(patch);
    const d = get();
    const current = d.ops.find((o) => o.reservation_id === reservationId) ?? emptyOps(reservationId, d.settings.deposit_usd);
    const next = { ...current, ...clean };
    if (next.deposit_returned_usd != null && next.deposit_returned_usd > next.deposit_usd) throw new Error('No se puede devolver más de la garantía.');
    commit({ ...d, ops: [...d.ops.filter((o) => o.reservation_id !== reservationId), next] });
  },
  async addCash(input) {
    const m = sanitizeCash(input);
    const d = get();
    commit({ ...d, cash: [...d.cash, { ...m, id: uid() }] });
  },
  async deleteCash(id) {
    const d = get();
    commit({ ...d, cash: d.cash.filter((m) => m.id !== id) });
  },
  async addTeamMember(email, name, role) {
    const d = get();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Escribe un correo válido.');
    commit({ ...d, team: [...d.team.filter((m) => m.email !== clean), { member_id: uid(), name: name.trim().slice(0, 40) || 'Equipo', email: clean, role: role === 'admin' ? 'admin' : 'staff' }] });
  },
  async removeTeamMember(memberId) {
    const d = get();
    commit({ ...d, team: d.team.filter((m) => m.member_id !== memberId) });
  },
  async staffRole() {
    return null;
  },
  async loadStaff() {
    const d = get();
    return {
      name: d.settings.staff_name,
      deposit_usd: d.settings.deposit_usd,
      cash_alert_usd: d.settings.cash_alert_usd,
      stays: staffStaysFromApp(d.reservations, d.properties),
      ops: structuredClone(d.ops),
      payments: d.payments.filter((p) => p.received_by === 'staff'),
      cash: structuredClone(d.cash),
    };
  },
};
