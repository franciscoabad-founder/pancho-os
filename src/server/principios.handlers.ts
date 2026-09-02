import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabasePrincipios(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface PrincipioRow {
  id: string;
  texto: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export async function obtenerPrincipios(): Promise<PrincipioRow[]> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_principios')
    .select('*')
    .order('orden', { ascending: true });

  if (error) throw error;
  return (data as PrincipioRow[]) ?? [];
}
