import type { Guest, Property, Reservation, ReservationInput, Settings, Vehicle } from '../types';

export interface AppData {
  settings: Settings;
  property: Property;
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
}

export const DEFAULT_SETTINGS: Settings = {
  owner_name: 'Oniris Rojas',
  owner_cedula: '17.571.156',
  conjunto: 'JDC Pescadores I',
  unit: '30',
  admin_whatsapp: '',
};

/** Traduce errores de base de datos a algo que Oniris entienda. Nunca muestra detalles internos. */
export function friendlyError(e: unknown): Error {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  if (code === '23P01' || /no_overlap/.test(msg)) return new Error('Esas fechas chocan con otra reserva confirmada. Revisa el calendario o márcala como tentativa.');
  if (code === '23514') return new Error('Algún dato no tiene el formato correcto. Revisa cédulas, placas y montos.');
  if (code === '42501' || code === 'PGRST301') return new Error('Tu sesión venció. Vuelve a entrar.');
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  if (e instanceof Error && !code) return e;
  return new Error('No se pudo guardar. Inténtalo de nuevo.');
}
