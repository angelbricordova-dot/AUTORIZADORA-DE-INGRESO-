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
}

export type PropertyInput = Omit<Property, 'id'> & { id?: string };

/** Lo que el sitio público puede ver de un apartamento. */
export type PublicListing = Pick<
  Property,
  'id' | 'kind' | 'title' | 'unit' | 'conjunto' | 'summary' | 'description' | 'capacity' | 'bedrooms' | 'nightly_usd' | 'promo' | 'amenities' | 'photos' | 'contact_whatsapp' | 'airbnb_url' | 'instagram_url'
>;

export interface BusyRange {
  property_id: string;
  check_in: string;
  check_out: string;
}

export interface PublicData {
  listings: PublicListing[];
  busy: BusyRange[];
}

export const AMENITIES = ['Piscina', 'Áreas recreativas', 'WiFi', 'Seguridad', 'Servicio de agua', 'Aire acondicionado', 'Estacionamiento', 'Cocina equipada', 'Parrillera', 'A minutos de la playa'];

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
