import { createContext, useContext } from 'react';
import type { AppData, DataStore } from './lib/store';

export interface AppCtx {
  data: AppData;
  /** Id del apartamento propio (N°30) */
  ownId: string;
  store: DataStore;
  today: string;
  reload: () => Promise<void>;
  /** Token de sesión para la lectura con IA (null en modo demo). */
  getAccessToken: () => Promise<string | null>;
  aiEnabled: boolean;
  signOut?: () => Promise<void>;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fuera de la app');
  return c;
}
