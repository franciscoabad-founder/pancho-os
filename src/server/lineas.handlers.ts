// Logica pura de os_lineas: las lineas de negocio/proyecto del OS.
//
// Extraida de src/pages/api/lineas.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseLineas(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

const ESTADOS = ['activo', 'mantenimiento', 'pausado'];

export interface Linea {
  id: string;
  nombre: string;
  descripcion: string | null;
  prioridad_stack: number;
  recibe_maker: boolean;
  objetivo_id: string | null;
  siguiente_accion: string | null;
  estado: string;
  orden: number | null;
  brain_tag: string | null;
  created_at?: string;
  updated_at?: string;
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

export async function listarLineas(soloMaker = false): Promise<Linea[]> {
  const sb = clienteActual();
  let query = sb
    .from('os_lineas')
    .select('*')
    .order('prioridad_stack', { ascending: true })
    .order('orden', { ascending: true });
  if (soloMaker) query = query.eq('recibe_maker', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Linea[] | null) ?? [];
}

export async function crearLinea(body: Record<string, unknown>): Promise<Linea> {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (!nombre) throw new Error('nombre requerido');

  const prioridad = body.prioridad_stack === undefined ? 3 : Number(body.prioridad_stack);
  if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 4) {
    throw new Error('prioridad_stack debe estar entre 0 y 4');
  }
  const estado = body.estado ? String(body.estado) : 'activo';
  if (!ESTADOS.includes(estado)) throw new Error('estado invalido');

  const sb = clienteActual();
  try {
    const { data, error } = await sb
      .from('os_lineas')
      .insert([{
        nombre,
        descripcion: body.descripcion ?? null,
        prioridad_stack: prioridad,
        recibe_maker: body.recibe_maker === true,
        objetivo_id: body.objetivo_id || null,
        siguiente_accion: body.siguiente_accion ?? null,
        estado,
        orden: Number.isFinite(Number(body.orden)) ? Number(body.orden) : null,
      }])
      .select()
      .single();
    if (error) throw error;
    return data as Linea;
  } catch (err) {
    if (pgCode(err) === '23505') {
      throw new Error('Ya existe una linea con ese nombre');
    }
    throw err;
  }
}

export async function actualizarLinea(
  id: string | null | undefined,
  body: Record<string, unknown>,
): Promise<Linea> {
  if (!id) throw new Error('id requerido');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const campos = [
    'nombre', 'descripcion', 'prioridad_stack', 'recibe_maker', 'objetivo_id',
    'siguiente_accion', 'estado', 'orden', 'brain_tag',
  ];
  for (const c of campos) if (c in body) patch[c] = body[c];

  if ('nombre' in patch && !(patch.nombre as string)?.toString().trim()) {
    throw new Error('nombre requerido');
  }
  if ('prioridad_stack' in patch) {
    const prioridad = Number(patch.prioridad_stack);
    if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 4) {
      throw new Error('prioridad_stack debe estar entre 0 y 4');
    }
    patch.prioridad_stack = prioridad;
  }
  if ('estado' in patch && !ESTADOS.includes(patch.estado as string)) {
    throw new Error('estado invalido');
  }

  const sb = clienteActual();
  try {
    const { data, error } = await sb
      .from('os_lineas')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Linea;
  } catch (err) {
    if (pgCode(err) === '23505') {
      throw new Error('Ya existe una linea con ese nombre');
    }
    throw err;
  }
}

export async function eliminarLinea(id: string | null | undefined): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_lineas').delete().eq('id', id);
  if (error) throw error;
}
