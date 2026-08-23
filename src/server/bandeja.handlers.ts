// Logica pura de la bandeja de entrada (os_bandeja).
//
// Extraida de src/pages/api/bandeja.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import { getSupabaseServer } from './supabase.ts';

const CAMPOS_EDITABLES = ['titulo', 'url', 'descripcion', 'categoria', 'leido'];

export interface ItemBandejaInput {
  titulo: string;
  url?: string | null;
  descripcion?: string | null;
  categoria?: string | null;
  leido?: boolean;
}

export interface ItemBandeja {
  id: string;
  titulo: string;
  url: string | null;
  descripcion: string | null;
  categoria: string | null;
  leido: boolean;
  fecha_captura?: string;
  created_at?: string;
}

export async function listarBandeja(leido?: string | null): Promise<ItemBandeja[]> {
  const sb = getSupabaseServer();
  let query = sb.from('os_bandeja').select('*').order('fecha_captura', { ascending: false });
  if (leido === '0') query = query.eq('leido', false);
  if (leido === '1') query = query.eq('leido', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ItemBandeja[];
}

export async function crearBandeja(input: ItemBandejaInput): Promise<ItemBandeja> {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error('titulo requerido');
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('os_bandeja')
    .insert([{
      titulo,
      url: input.url ?? null,
      descripcion: input.descripcion ?? null,
      categoria: input.categoria ?? null,
      leido: input.leido === true,
    }])
    .select()
    .single();
  if (error) throw error;
  return data as ItemBandeja;
}

export async function actualizarBandeja(id: string | null, input: Partial<ItemBandejaInput>): Promise<ItemBandeja> {
  if (!id) throw new Error('id requerido');
  const sb = getSupabaseServer();
  const patch: Record<string, unknown> = {};
  for (const c of CAMPOS_EDITABLES) {
    if (c in input) patch[c] = (input as Record<string, unknown>)[c];
  }
  const { data, error } = await sb.from('os_bandeja').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as ItemBandeja;
}

export async function eliminarBandeja(id: string | null): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = getSupabaseServer();
  const { error } = await sb.from('os_bandeja').delete().eq('id', id);
  if (error) throw error;
}
