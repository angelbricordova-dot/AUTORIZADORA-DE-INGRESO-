export type Channel =
  | 'airbnb'
  | 'stay'
  | 'marketplace'
  | 'mercadolibre'
  | 'instagram'
  | 'whatsapp'
  | 'directo'
  | 'otro';

export type StayType = 'Familiar' | 'Alquiler Fijo' | 'Alquiler Vacacional' | 'Mantenimiento' | 'Otros';
export type ReservationStatus = 'tentativa' | 'confirmada' | 'cancelada';
export type AuthStatus = 'pendiente' | 'generada' | 'enviada';

export interface Guest {
  full_name: string;
  /** Formateada, ej. "12.345.678" o "E-84.123.456". Vacía si es menor sin cédula. */
  cedula: string;
  is_minor: boolean;
}

export interface Vehicle {
  /** Marca, modelo y color, ej. "Toyota Corolla vinotinto" */
  description: string;
  plate: string;
}

export interface Reservation {
  id: string;
  property_id: string;
  contact_name: string;
  contact_phone: string;
  channel: Channel;
  /** YYYY-MM-DD */
  check_in: string;
  /** YYYY-MM-DD (día de salida, la noche anterior es la última) */
  check_out: string;
  stay_type: StayType;
  status: ReservationStatus;
  total_usd: number;
  paid_usd: number;
  auth_status: AuthStatus;
  auth_sent_at: string | null;
  notes: string;
  guests: Guest[];
  vehicles: Vehicle[];
}

export type ReservationInput = Omit<Reservation, 'id' | 'guests' | 'vehicles' | 'auth_status' | 'auth_sent_at' | 'property_id'> & {
  id?: string;
  /** Si falta, se usa el apartamento propio. */
  property_id?: string;
};

export interface Settings {
  owner_name: string;
  owner_cedula: string;
  conjunto: string;
  unit: string;
  admin_whatsapp: string;
  /** Quien limpia, entrega llaves y guarda el efectivo (Zuleika) */
  staff_name: string;
  /** Desde cuánto efectivo en manos del equipo conviene ir a retirarlo */
  cash_alert_usd: number;
  /** Garantía que se cobra al llegar */
  deposit_usd: number;
}

export type PropertyKind = 'propio' | 'aliado';

export interface Property {
  id: string;
  kind: PropertyKind;
  /** Nombre interno (ej. "Apto 12 · Sra. Carmen") */
  name: string;
  /** Título público */
  title: string;
  conjunto: string;
  unit: string;
  summary: string;
  description: string;
  capacity: number;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  /** Precio público por noche */
  nightly_usd: number | null;
  /** Lo que cobra el dueño aliado por noche (privado). La diferencia es la comisión. */
  partner_cost_usd: number | null;
  promo: string;
  amenities: string[];
  photos: string[];
  published: boolean;
  sort: number;
  /** Para la planilla de autorización si el dueño no es Oniris */
  owner_name: string;
  owner_cedula: string;
  contact_whatsapp: string;
  airbnb_url: string;
  instagram_url: string;
  tiktok_url: string;
  /** Enlace "Escribir una opinión" del perfil de Google */
  google_review_url: string;
}

export type PropertyInput = Omit<Property, 'id'> & { id?: string };

/** Lo que el sitio público puede ver de un apartamento. */
export type PublicListing = Pick<
  Property,
  | 'id'
  | 'kind'
  | 'title'
  | 'unit'
  | 'conjunto'
  | 'summary'
  | 'description'
  | 'capacity'
  | 'bedrooms'
  | 'beds'
  | 'bathrooms'
  | 'nightly_usd'
  | 'promo'
  | 'amenities'
  | 'photos'
  | 'contact_whatsapp'
  | 'airbnb_url'
  | 'instagram_url'
  | 'tiktok_url'
  | 'google_review_url'
>;

export interface BusyRange {
  property_id: string;
  check_in: string;
  check_out: string;
}

export interface PublicData {
  listings: PublicListing[];
  busy: BusyRange[];
  /** Reseñas aprobadas y con permiso del huésped */
  reviews: PublicReview[];
}

// ---------------------------------------------------------------------
// Encuesta de huéspedes (reemplaza el Google Form) y reseñas públicas
// ---------------------------------------------------------------------
export type ReviewPermission = 'si' | 'no' | 'consultar';
export type ReviewStatus = 'pendiente' | 'publicada' | 'oculta';

export interface ReviewInput {
  author_name: string;
  nights: number | null;
  cleanliness: number | null;
  beds: number | null;
  ac: number | null;
  wifi: number | null;
  communication: number | null;
  kitchen_ok: boolean | null;
  kitchen_missing: string;
  /** 1 a 10 */
  recommend: number | null;
  /** Lo que más le gustó: solo para el panel */
  liked: string;
  /** Lo que mejoraría: privado */
  improve: string;
  /** Comentario general sobre la estadía: es lo que se publica (con permiso) */
  comment: string;
  permission: ReviewPermission;
}

export interface Review extends ReviewInput {
  id: string;
  property_id: string;
  status: ReviewStatus;
  reply: string;
  created_at: string;
}

export interface PublicReview {
  id: string;
  property_id: string;
  author: string;
  nights: number | null;
  /** Promedio de las notas de 1 a 5 */
  rating: number | null;
  cleanliness: number | null;
  beds: number | null;
  ac: number | null;
  wifi: number | null;
  communication: number | null;
  recommend: number | null;
  /** Comentario publicado */
  comment: string;
  reply: string;
  created_at: string;
}

export const REVIEW_ASPECTS: { key: 'cleanliness' | 'beds' | 'ac' | 'wifi' | 'communication'; label: string; question: string }[] = [
  { key: 'cleanliness', label: 'Limpieza', question: '¿Qué tan limpio encontraste el apartamento al llegar?' },
  { key: 'beds', label: 'Camas', question: '¿Qué tan cómodas fueron las camas?' },
  { key: 'ac', label: 'Aire acondicionado', question: '¿Cómo estuvo la temperatura y el funcionamiento de los A/C?' },
  { key: 'wifi', label: 'WiFi', question: '¿Cómo estuvo el WiFi?' },
  { key: 'communication', label: 'Comunicación', question: '¿Qué tan clara fue la comunicación con nosotros antes y durante tu estadía?' },
];

/** Promedio de las notas de 1 a 5 que respondió (null si no respondió ninguna). */
export function reviewScore(r: Pick<ReviewInput, 'cleanliness' | 'beds' | 'ac' | 'wifi' | 'communication'>): number | null {
  const v = [r.cleanliness, r.beds, r.ac, r.wifi, r.communication].filter((x): x is number => typeof x === 'number');
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export const AMENITIES = [
  'Piscina',
  'WiFi',
  'Aire acondicionado',
  'Tanque de agua propio',
  'Cocina equipada',
  'Estacionamiento',
  'Televisión',
  'Seguridad',
  'Áreas recreativas',
  'Cerca de los muelles',
  'A minutos de la playa',
  'Servicio de agua',
  'Parrillera',
];

// ---------------------------------------------------------------------
// Pagos, garantía, tareas y caja del equipo
// ---------------------------------------------------------------------
export type PayMethod = 'efectivo_usd' | 'pago_movil' | 'transferencia' | 'zelle' | 'binance' | 'efectivo_bs' | 'tarjeta' | 'otro';
export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'efectivo_usd', label: 'Efectivo $' },
  { id: 'pago_movil', label: 'Pago móvil' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'zelle', label: 'Zelle' },
  { id: 'binance', label: 'Binance' },
  { id: 'efectivo_bs', label: 'Efectivo Bs' },
  { id: 'tarjeta', label: 'Punto de venta' },
  { id: 'otro', label: 'Otro' },
];
export const payMethodLabel = (m: PayMethod) => PAY_METHODS.find((x) => x.id === m)?.label ?? 'Otro';

/** Quién recibió el dinero: la dueña o alguien del equipo (Zuleika). */
export type Receiver = 'owner' | 'staff';

export interface Payment {
  id: string;
  reservation_id: string;
  amount_usd: number;
  method: PayMethod;
  received_by: Receiver;
  /** YYYY-MM-DD */
  paid_on: string;
  reference: string;
  note: string;
}
export type PaymentInput = Omit<Payment, 'id'>;

export interface StayOps {
  reservation_id: string;
  clean_before_at: string | null;
  keys_at: string | null;
  clean_after_at: string | null;
  linens_at: string | null;
  deposit_usd: number;
  deposit_received_at: string | null;
  deposit_returned_at: string | null;
  deposit_returned_usd: number | null;
  note: string;
}
export type StayOpsPatch = Partial<Omit<StayOps, 'reservation_id'>>;

export type CashKind = 'retiro' | 'gasto' | 'ajuste' | 'ingreso';
export interface CashMovement {
  id: string;
  kind: CashKind;
  /** retiro y gasto son positivos y restan; ingreso (efectivo que le entregaron) suma; ajuste suma o resta según el signo */
  amount_usd: number;
  happened_on: string;
  note: string;
}
export type CashInput = Omit<CashMovement, 'id'>;

/** admin: maneja todo el panel (Oniris, Angélica). staff: solo su panel de trabajo (Zuleika). */
export type TeamRole = 'admin' | 'staff';

export interface TeamMember {
  member_id: string;
  name: string;
  email: string;
  role: TeamRole;
}

/** Lo que el equipo ve de una estadía: sin cédulas, placas ni notas. */
export interface StaffStay {
  id: string;
  unit: string;
  property_name: string;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  contact_name: string;
  contact_phone: string;
  people: number;
  minors: number;
  total_usd: number;
  paid_usd: number;
}

export interface StaffData {
  name: string;
  deposit_usd: number;
  cash_alert_usd: number;
  stays: StaffStay[];
  ops: StayOps[];
  payments: Payment[];
  cash: CashMovement[];
}

export function commission(p: Pick<Property, 'nightly_usd' | 'partner_cost_usd'>): number | null {
  if (p.nightly_usd == null || p.partner_cost_usd == null) return null;
  return Math.round((p.nightly_usd - p.partner_cost_usd) * 100) / 100;
}

export function propertyLabel(p: Pick<Property, 'kind' | 'unit' | 'title' | 'name'>): string {
  return p.kind === 'propio' ? `N°${p.unit}` : p.name || p.title || `Apto ${p.unit}`;
}

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'airbnb', label: 'Airbnb' },
  { id: 'stay', label: 'Stay' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'mercadolibre', label: 'Mercado Libre' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'directo', label: 'Directo' },
  { id: 'otro', label: 'Otro' },
];

export const STAY_TYPES: StayType[] = ['Alquiler Vacacional', 'Familiar', 'Alquiler Fijo', 'Mantenimiento', 'Otros'];

export const MAX_GUESTS = 7;
export const MAX_VEHICLES = 2;

export function channelLabel(c: Channel): string {
  return CHANNELS.find((x) => x.id === c)?.label ?? 'Otro';
}
