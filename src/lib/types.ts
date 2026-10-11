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
};

export interface Settings {
  owner_name: string;
  owner_cedula: string;
  conjunto: string;
  unit: string;
  admin_whatsapp: string;
}

export interface Property {
  id: string;
  name: string;
  conjunto: string;
  unit: string;
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
