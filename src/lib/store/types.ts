import type { Guest, Property, PropertyInput, PublicData, Reservation, ReservationInput, Settings, Vehicle } from '../types';

export interface AppData {
  settings: Settings;
  properties: Property[];
  reservations: Reservation[];
}

export interface DataStore {
  mode: 'demo' | 'supabase';
  load(): Promise<AppData>;
  saveSettings(s: Settings): Promise<void>;
  /** Crea o actualiza; devuelve el id. */
  saveReservation(input: ReservationInput): Promise<string>;
  deleteReservation(id: string): Promise<void>;
  saveAuthorization(reservationId: string, guests: Guest[], vehicles: Vehicle[]): Promise<void>;
  markSent(reservationId: string): Promise<void>;
  saveProperty(input: PropertyInput): Promise<string>;
  deleteProperty(id: string): Promise<void>;
  /** Sube una foto ya reducida y devuelve su URL pública. */
  uploadPhoto(propertyId: string, jpeg: Blob): Promise<string>;
  /** Lo que ve el público: apartamentos publicados y noches ocupadas. */
  loadPublic(from: string, to: string): Promise<PublicData>;
}

export const DEFAULT_SETTINGS: Settings = {
  owner_name: 'Oniris Rojas',
  owner_cedula: '17.571.156',
  conjunto: 'JDC Pescadores I',
  unit: '30',
  admin_whatsapp: '',
};

export const OWN_DEFAULTS: Omit<Property, 'id'> = {
  kind: 'propio',
  name: 'Apartamento N°30',
  title: 'Tu Día en Tucacas · Apartamento N°30',
  conjunto: 'JDC Pescadores I',
  unit: '30',
  summary: 'Hospedaje en el Conjunto Residencial Pescadores I, a minutos de la playa.',
  description: '',
  capacity: 7,
  bedrooms: null,
  nightly_usd: 90,
  partner_cost_usd: null,
  promo: '',
  amenities: ['A minutos de la playa', 'Piscina', 'Áreas recreativas', 'WiFi', 'Seguridad', 'Servicio de agua'],
  photos: [],
  published: true,
  sort: 0,
  owner_name: '',
  owner_cedula: '',
  contact_whatsapp: '584242703482',
  airbnb_url: 'https://www.airbnb.co.ve/rooms/1622130249785584357',
  instagram_url: 'https://www.instagram.com/aribnb.tucacas/',
};

export function ownProperty(d: Pick<AppData, 'properties'>): Property | undefined {
  return d.properties.find((p) => p.kind === 'propio') ?? d.properties[0];
}

/** Datos de la planilla para un apartamento: si es de otro dueño, usa sus datos. */
export function settingsFor(settings: Settings, p: Property | undefined): Settings {
  if (!p) return settings;
  return {
    ...settings,
    unit: p.unit || settings.unit,
    conjunto: p.conjunto || settings.conjunto,
    owner_name: p.kind === 'aliado' && p.owner_name ? p.owner_name : settings.owner_name,
    owner_cedula: p.kind === 'aliado' && p.owner_cedula ? p.owner_cedula : settings.owner_cedula,
  };
}

/** Traduce errores de base de datos a algo que Oniris entienda. Nunca muestra detalles internos. */
export function friendlyError(e: unknown): Error {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  if (code === '23P01' || /no_overlap/.test(msg)) return new Error('Esas fechas chocan con otra reserva confirmada. Revisa el calendario o márcala como tentativa.');
  if (code === '23514') return new Error('Algún dato no tiene el formato correcto. Revisa cédulas, placas, montos y enlaces.');
  if (code === '42501' || code === 'PGRST301') return new Error('Tu sesión venció. Vuelve a entrar.');
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  if (e instanceof Error && !code) return e;
  return new Error('No se pudo guardar. Inténtalo de nuevo.');
}
