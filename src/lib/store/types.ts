import type {
  CashInput,
  CashMovement,
  Guest,
  Payment,
  PaymentInput,
  Property,
  PropertyInput,
  PublicData,
  Reservation,
  ReservationInput,
  Settings,
  StaffData,
  StayOps,
  StayOpsPatch,
  TeamMember,
  Review,
  ReviewInput,
  ReviewStatus,
  TeamRole,
  Vehicle,
} from '../types';

/** Quién entró al panel (para el saludo). Solo informativo: nunca decide permisos. */
export interface Me {
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'staff';
}

/** "alejandro.rojas93@gmail.com" → "Alejandro" */
export function nameFromEmail(email: string): string {
  const first = (email.split('@')[0] || '').split(/[._\-+\d]+/).find((w) => /^[a-záéíóúñ]{2,}$/i.test(w)) ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
}

export interface AppData {
  /** Quien entró (en modo demo, la dueña de ejemplo) */
  me?: Me;
  settings: Settings;
  properties: Property[];
  reservations: Reservation[];
  payments: Payment[];
  ops: StayOps[];
  cash: CashMovement[];
  team: TeamMember[];
  /** Respuestas de la encuesta de huéspedes (todas, también lo privado) */
  reviews: Review[];
  /** La base de datos todavía no tiene la migración de equipo y pagos */
  migrationPending?: boolean;
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

  // Pagos, tareas, garantía y caja (los usan Oniris y Zuleika)
  addPayment(p: PaymentInput): Promise<void>;
  deletePayment(id: string): Promise<void>;
  saveOps(reservationId: string, patch: StayOpsPatch): Promise<void>;
  addCash(m: CashInput): Promise<void>;
  deleteCash(id: string): Promise<void>;

  // Equipo
  addTeamMember(email: string, name: string, role: TeamRole): Promise<void>;
  removeTeamMember(memberId: string): Promise<void>;
  /** Si quien entró es del equipo (Zuleika) devuelve su nombre; si es la dueña, null. */
  staffRole(): Promise<{ name: string } | null>;
  /** Encuesta de un huésped (página pública). */
  submitReview(propertyId: string, input: ReviewInput): Promise<void>;
  /** Publicar, ocultar o responder una reseña. */
  moderateReview(id: string, patch: { status?: ReviewStatus; reply?: string }): Promise<void>;
  deleteReview(id: string): Promise<void>;
  /** Respuesta del Google Form anterior (queda pendiente, con su fecha original). */
  importReview(propertyId: string, input: ReviewInput, createdAt: string | null): Promise<void>;
  /** Guarda el nombre con el que la app saluda a quien entró. */
  saveMyName(name: string): Promise<void>;
  /** Lo que ve el equipo: agenda sin datos personales, sus cobros, tareas y caja. */
  loadStaff(today: string): Promise<StaffData>;
}

export const DEFAULT_SETTINGS: Settings = {
  owner_name: 'Oniris Rojas',
  owner_cedula: '17.571.156',
  conjunto: 'JDC Pescadores I',
  unit: '30',
  admin_whatsapp: '',
  staff_name: 'Zuleika',
  cash_alert_usd: 300,
  deposit_usd: 100,
};

/** Fotos del N°30 que vienen con el sitio (public/fotos). */
export const OWN_PHOTOS = [
  'n30-01-sala-comedor',
  'n30-02-piscina',
  'n30-03-sala',
  'n30-04-cocina',
  'n30-05-habitacion',
  'n30-06-literas',
  'n30-07-sala-sofa',
  'n30-08-tv',
  'n30-09-bano',
  'n30-10-bano-2',
  'n30-11-entrada',
  'n30-12-piscina-noche',
].map((n) => `/fotos/${n}.jpg`);

export const OWN_DEFAULTS: Omit<Property, 'id'> = {
  kind: 'propio',
  name: 'Apartamento N°30',
  title: 'Tu Día en Tucacas · Apartamento N°30',
  conjunto: 'JDC Pescadores I',
  unit: '30',
  summary: 'Piso 1 en Pescadores I: comodidad real para 7 personas, a 5 minutos de los muelles.',
  description: [
    'Ubicados en Res. Pescadores I (piso 1), ofrecemos comodidad real para 7 personas sin romper el presupuesto.',
    '',
    'Cero estrés: tanque de agua interno, no dependemos solo del edificio.',
    'Conectados: WiFi de fibra óptica de alta velocidad.',
    'Clima: aire acondicionado en todos los ambientes.',
    'Ubicación: a 5 minutos de los muelles y a 20 minutos en carro del Parque Nacional Morrocoy.',
    '',
    'Ideal para familias que quieren ahorrar para sus paseos a los cayos.',
  ].join('\n'),
  capacity: 7,
  bedrooms: 2,
  beds: 5,
  bathrooms: 2,
  nightly_usd: 90,
  partner_cost_usd: null,
  promo: '',
  amenities: ['Piscina', 'WiFi', 'Aire acondicionado', 'Tanque de agua propio', 'Cocina equipada', 'Estacionamiento', 'Televisión', 'Seguridad', 'Áreas recreativas', 'Cerca de los muelles'],
  photos: OWN_PHOTOS,
  published: true,
  sort: 0,
  owner_name: '',
  owner_cedula: '',
  contact_whatsapp: '584242703482',
  airbnb_url: 'https://www.airbnb.co.ve/rooms/1622130249785584357',
  instagram_url: 'https://www.instagram.com/aribnb.tucacas/',
  tiktok_url: '',
  google_review_url: '',
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
