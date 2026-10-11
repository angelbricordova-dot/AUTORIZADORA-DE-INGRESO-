import { demoStore } from './demo';
import { supabaseConfigured, supabaseStore } from './supabase';
import type { DataStore } from './types';

export const store: DataStore = supabaseConfigured ? supabaseStore : demoStore;
export { supabaseConfigured };
export type { AppData, DataStore } from './types';
