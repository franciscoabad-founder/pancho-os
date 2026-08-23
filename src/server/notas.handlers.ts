// Logica pura de notas (tabla `notas`).
//
// Extraida de src/pages/api/notas.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

// Seam para tests: en produccion siempre resuelve a clienteActual(); los
// tests inyectan un doble en memoria y no tocan Supabase real. Mismo patron que
// devices.handlers.ts.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseNotas(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

const ESTADOS = ['activa', 'convertida', 'archivada'];
const DESTINOS = ['pendiente', 'tarea', 'recordatorio'] as const;
type Destino = (typeof DESTINOS)[number];

export interface Nota {
  id: string;
  contenido: string;
  tags: string[];
  estado: 'activa' | 'convertida' | 'archivada';
  convertida_a: string | null;
  convertida_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotaInput {
  contenido?: string;
  tags?: unknown;
  estado?: string;
}

export interface ConvertirInput {
  id?: string;
  a?: string;
  payload?: Record<string, unknown>;
}

export async function listarNotas(): Promise<Nota[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('notas').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Nota[];
}

export async function crearNota(input: NotaInput): Promise<Nota> {
  const contenido = input.contenido?.trim();
  if (!contenido) throw new Error('contenido requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('notas')
    .insert([{
      contenido,
      tags: Array.isArray(input.tags) ? input.tags : [],
    }])
    .select()
    .single();
  if (error) throw error;
  return data as Nota;
}

export async function actualizarNota(id: string | null, input: NotaInput): Promise<Nota> {
  if (!id) throw new Error('id requerido');
  const patch: Record<string, unknown> = {};
  if (typeof input.contenido === 'string') {
    const contenido = input.contenido.trim();
    if (!contenido) throw new Error('contenido requerido');
    patch.contenido = contenido;
  }
  if ('tags' in input) patch.tags = Array.isArray(input.tags) ? input.tags : [];
  if ('estado' in input) {
    const estado = input.estado?.toString();
    if (!ESTADOS.includes(estado ?? '')) throw new Error('estado invalido');
    patch.estado = estado;
  }
  if (!Object.keys(patch).length) throw new Error('sin campos para actualizar');
  patch.updated_at = new Date().toISOString();

  const sb = clienteActual();
  const { data, error } = await sb.from('notas').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Nota;
}

export async function eliminarNota(id: string | null): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('notas').delete().eq('id', id);
  if (error) throw error;
}

export async function convertirNota(convertir: ConvertirInput): Promise<{ nota: Nota; creado: unknown; destino: Destino }> {
  const { id, a, payload = {} } = convertir;
  if (!id) throw new Error('convertir.id requerido');
  if (!DESTINOS.includes(a as Destino)) {
    throw new Error("convertir.a debe ser 'pendiente', 'tarea' o 'recordatorio'");
  }
  const destino = a as Destino;
  const sb = clienteActual();

  const { data: nota, error: notaError } = await sb.from('notas').select('*').eq('id', id).single();
  if (notaError) throw notaError;
  if (!nota) throw new Error('nota no encontrada');
  if (nota.estado === 'convertida') throw new Error('la nota ya fue convertida');

  let creado: unknown = null;

  if (destino === 'pendiente') {
    const { data, error } = await sb
      .from('pendientes')
      .insert([{
        titulo: (payload.titulo as string | undefined)?.trim() || (nota.contenido as string).slice(0, 200),
        detalle: (payload.detalle as string | undefined)?.trim() || ((payload.titulo ? nota.contenido : null) as string | null),
        proyecto: (payload.proyecto as string | undefined)?.trim() || null,
        origen_nota_id: nota.id,
      }])
      .select()
      .single();
    if (error) throw error;
    creado = data;
  } else if (destino === 'tarea') {
    const { data, error } = await sb
      .from('tareas')
      .insert([{
        titulo: (payload.titulo as string | undefined)?.trim() || (nota.contenido as string).slice(0, 200),
        proyecto: (payload.proyecto as string | undefined)?.trim() || null,
        estado: 'pendiente',
        deadline: (payload.deadline as string | undefined) || null,
        prioridad: ['low', 'medium', 'high', 'critical'].includes(payload.prioridad as string) ? payload.prioridad : 'medium',
        grupo: (payload.grupo as string | undefined)?.trim() || 'general',
        tipo: (payload.tipo as string | undefined)?.trim() || null,
        notas: payload.notas ?? nota.contenido,
      }])
      .select()
      .single();
    if (error) throw error;
    creado = data;
  } else {
    if (!payload.recordar_at) throw new Error('payload.recordar_at requerido para recordatorio');
    const { data, error } = await sb
      .from('recordatorios')
      .insert([{
        mensaje: (payload.mensaje as string | undefined)?.trim() || (nota.contenido as string).slice(0, 300),
        recordar_at: payload.recordar_at,
        canal: (payload.canal as string | undefined)?.trim() || 'telegram',
      }])
      .select()
      .single();
    if (error) throw error;
    creado = data;
  }

  const { data: notaActualizada, error: updateError } = await sb
    .from('notas')
    .update({
      estado: 'convertida',
      convertida_a: destino,
      convertida_id: (creado as { id: string }).id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', nota.id)
    .select()
    .single();
  if (updateError) throw updateError;

  return { nota: notaActualizada as Nota, creado, destino };
}
