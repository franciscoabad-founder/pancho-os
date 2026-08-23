// Logica pura de os_objetivos: los 1-3 objetivos activos del OS.
//
// Extraida de src/pages/api/objetivos.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseObjetivos(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface Objetivo {
  id: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  metrica_resultado: string | null;
  punto_partida: string | null;
  medida_avance: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

export async function listarObjetivos(todos = false): Promise<Objetivo[]> {
  const sb = clienteActual();
  let query = sb.from('os_objetivos').select('*').order('orden', { ascending: true });
  if (!todos) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Objetivo[] | null) ?? [];
}

export async function crearObjetivo(body: Record<string, unknown>): Promise<Objetivo> {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) throw new Error('titulo requerido');

  const orden = Number(body.orden);
  if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
    throw new Error('orden debe ser 1, 2 o 3');
  }

  const sb = clienteActual();
  try {
    const { data, error } = await sb
      .from('os_objetivos')
      .insert([{
        orden,
        titulo,
        descripcion: body.descripcion ?? null,
        metrica_resultado: body.metrica_resultado ?? null,
        punto_partida: body.punto_partida ?? null,
        medida_avance: body.medida_avance ?? null,
        fecha_inicio: body.fecha_inicio || null,
        fecha_fin: body.fecha_fin || null,
        activo: body.activo === false ? false : true,
      }])
      .select()
      .single();
    if (error) throw error;
    return data as Objetivo;
  } catch (err) {
    if (pgCode(err) === '23505') {
      throw new Error('Ya existe un objetivo activo en esa posicion');
    }
    throw err;
  }
}

export async function actualizarObjetivo(
  id: string | null | undefined,
  body: Record<string, unknown>,
): Promise<Objetivo> {
  if (!id) throw new Error('id requerido');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const campos = [
    'orden', 'titulo', 'descripcion', 'metrica_resultado', 'punto_partida',
    'medida_avance', 'fecha_inicio', 'fecha_fin', 'activo',
  ];
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

  const sb = clienteActual();
  try {
    const { data, error } = await sb
      .from('os_objetivos')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Objetivo;
  } catch (err) {
    if (pgCode(err) === '23505') {
      throw new Error('Ya existe un objetivo activo en esa posicion');
    }
    throw err;
  }
}

export async function eliminarObjetivo(id: string | null | undefined): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_objetivos').delete().eq('id', id);
  if (error) throw error;
}
