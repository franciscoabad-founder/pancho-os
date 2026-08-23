// Logica pura de os_priority_stack + os_no_hacer: las 3 prioridades de la
// semana y la lista de "no hacer".
//
// Extraida de src/pages/api/priority-stack.ts (Astro) para reusarse desde la
// server route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { hoyGuayaquil } from './helpers.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabasePriorityStack(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface Prioridad {
  id: string;
  semana_inicio: string;
  orden: number;
  titulo: string;
  objetivo_id: string | null;
  hecho: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NoHacer {
  id: string;
  semana_inicio: string;
  texto: string;
  created_at: string;
}

export interface PriorityStackResultado {
  semana_inicio: string;
  prioridades: Prioridad[];
  no_hacer: NoHacer[];
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

// Lunes (YYYY-MM-DD) de la semana que contiene `fecha`, calculado en zona horaria de
// Guayaquil (evita drift de UTC al construir el Date a partir del string).
export function lunesDeSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=domingo..6=sabado
  const offset = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export async function listarPriorityStack(semana?: string | null): Promise<PriorityStackResultado> {
  const semanaQuery = semana || lunesDeSemana(hoyGuayaquil());
  const sb = clienteActual();

  const { data: prioridades, error: errP } = await sb
    .from('os_priority_stack')
    .select('*')
    .eq('semana_inicio', semanaQuery)
    .order('orden', { ascending: true });
  if (errP) throw errP;

  const { data: noHacer, error: errN } = await sb
    .from('os_no_hacer')
    .select('*')
    .eq('semana_inicio', semanaQuery)
    .order('created_at', { ascending: true });
  if (errN) throw errN;

  return {
    semana_inicio: semanaQuery,
    prioridades: (prioridades as Prioridad[] | null) ?? [],
    no_hacer: (noHacer as NoHacer[] | null) ?? [],
  };
}

export async function crearNoHacer(body: Record<string, unknown>): Promise<NoHacer> {
  const texto = typeof body.no_hacer === 'string' ? body.no_hacer.trim() : '';
  if (!texto) throw new Error('no_hacer requerido');
  const semana = (body.semana_inicio as string | undefined) || lunesDeSemana(hoyGuayaquil());

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_no_hacer')
    .insert([{ semana_inicio: semana, texto }])
    .select()
    .single();
  if (error) throw error;
  return data as NoHacer;
}

export async function crearPrioridad(body: Record<string, unknown>): Promise<Prioridad> {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) throw new Error('titulo requerido');
  const orden = Number(body.orden);
  if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
    throw new Error('orden debe ser 1, 2 o 3');
  }
  const semana = (body.semana_inicio as string | undefined) || lunesDeSemana(hoyGuayaquil());

  const sb = clienteActual();
  try {
    const { data, error } = await sb
      .from('os_priority_stack')
      .insert([{
        semana_inicio: semana,
        orden,
        titulo,
        objetivo_id: body.objetivo_id || null,
        hecho: body.hecho === true,
      }])
      .select()
      .single();
    if (error) throw error;
    return data as Prioridad;
  } catch (err) {
    if (pgCode(err) === '23505') {
      throw new Error('Ya existe una prioridad en esa posicion');
    }
    throw err;
  }
}

export async function actualizarPrioridad(
  id: string | null | undefined,
  body: Record<string, unknown>,
): Promise<Prioridad> {
  if (!id) throw new Error('id requerido');
  const patch: Record<string, unknown> = {};
  const campos = ['titulo', 'orden', 'objetivo_id', 'hecho'];
  for (const c of campos) if (c in body) patch[c] = body[c];

  if ('titulo' in patch && !(patch.titulo as string)?.toString().trim()) {
    throw new Error('titulo requerido');
  }
  if ('orden' in patch) {
    const orden = Number(patch.orden);
    if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
      throw new Error('orden debe ser 1, 2 o 3');
    }
    patch.orden = orden;
  }
  if (!Object.keys(patch).length) throw new Error('sin campos para actualizar');

  const sb = clienteActual();
  try {
    const { data, error } = await sb
      .from('os_priority_stack')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Prioridad;
  } catch (err) {
    if (pgCode(err) === '23505') {
      throw new Error('Ya existe una prioridad en esa posicion');
    }
    throw err;
  }
}

export async function eliminarPriorityStack(
  id?: string | null,
  noHacerId?: string | null,
): Promise<void> {
  if (!id && !noHacerId) throw new Error('id o no_hacer_id requerido');
  const sb = clienteActual();
  if (noHacerId) {
    const { error } = await sb.from('os_no_hacer').delete().eq('id', noHacerId);
    if (error) throw error;
  } else {
    const { error } = await sb.from('os_priority_stack').delete().eq('id', id as string);
    if (error) throw error;
  }
}
