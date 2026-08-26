// Logica de negocio de tareas, extraida de src/pages/api/tareas.ts.
//
// El archivo de Astro mezclaba tres cosas: validacion + acceso a Supabase (la
// logica real), lectura del APIContext (framework) y construccion del Response
// (transporte). Aca queda SOLO la primera. Nada de este modulo conoce Astro,
// TanStack Start, Request ni Response.
//
// Gracias a eso lo consumen dos frentes a la vez sin duplicar reglas:
//   - src/routes/api/tareas.ts  -> server route delgado, mantiene vivo el
//     contrato HTTP que ya usa OSTareas.tsx con fetch('/api/tareas')
//   - src/utils/tareas.functions.ts -> server function del loader de /tareas
//
// Los errores de negocio viajan como ErrorTareas con su status HTTP, para que
// el server route reproduzca exactamente los mismos codigos que devolvia la
// version Astro (400 / 404, y 502 para cualquier fallo inesperado de Supabase).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { registrarEvento } from '../lib/juego/motor.ts';

export const PRIORIDADES = ['low', 'medium', 'high', 'critical'] as const;
export const ESTADOS = ['pendiente', 'en_progreso', 'hecho'] as const;

export type Prioridad = (typeof PRIORIDADES)[number];

export interface Tarea {
  id: string;
  titulo: string;
  proyecto: string | null;
  categoria: string | null;
  estado: string;
  urgente: boolean;
  deadline: string | null;
  notas: string | null;
  prioridad: Prioridad | null;
  tipo: string | null;
  grupo: string | null;
  parent_id: string | null;
  orden: number | null;
  created_at: string;
}

// Cuerpo crudo de la peticion: no confiamos en su forma, cada campo se
// normaliza abajo igual que lo hacia el endpoint de Astro.
export type CuerpoTarea = Record<string, unknown>;

export class ErrorTareas extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ErrorTareas';
    this.status = status;
  }
}

// `body.campo?.toString().trim() || null` de la version Astro, pero sin
// reventar si el cliente manda un numero en vez de un string.
function textoOpcional(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).trim();
  return limpio || null;
}

function esPrioridad(valor: unknown): valor is Prioridad {
  return typeof valor === 'string' && (PRIORIDADES as readonly string[]).includes(valor);
}

function aOrden(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

// Una subtarea no puede vencer despues que su padre. Devuelve el mensaje de
// error o null si la relacion es valida.
async function validarDeadlineConPadre(
  sb: SupabaseClient,
  parentId: string,
  deadline: string | null,
): Promise<string | null> {
  const { data: padre, error } = await sb
    .from('tareas')
    .select('id, deadline')
    .eq('id', parentId)
    .maybeSingle();
  if (error) throw error;
  if (!padre) return 'parent_id no corresponde a una tarea existente';
  if (deadline && padre.deadline && deadline > padre.deadline) {
    return `el deadline de la subtarea (${deadline}) no puede ser posterior al de la tarea padre (${padre.deadline})`;
  }
  return null;
}

export async function listarTareas(sb: SupabaseClient = getSupabaseServer()): Promise<Tarea[]> {
  const { data, error } = await sb
    .from('tareas')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tarea[];
}

export async function crearTarea(
  body: CuerpoTarea,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Tarea> {
  const titulo = textoOpcional(body.titulo);
  if (!titulo) throw new ErrorTareas('titulo requerido', 400);

  const deadline = textoOpcional(body.deadline);
  const parentId = textoOpcional(body.parent_id);
  if (parentId) {
    const invalido = await validarDeadlineConPadre(sb, parentId, deadline);
    if (invalido) throw new ErrorTareas(invalido, 400);
  }

  const { data, error } = await sb
    .from('tareas')
    .insert([{
      titulo,
      proyecto: textoOpcional(body.proyecto),
      categoria: textoOpcional(body.categoria),
      estado: body.estado ?? 'pendiente',
      urgente: body.urgente === true || body.urgente === 'true',
      deadline,
      notas: body.notas ?? null,
      prioridad: esPrioridad(body.prioridad) ? body.prioridad : 'medium',
      tipo: textoOpcional(body.tipo),
      grupo: textoOpcional(body.grupo) ?? 'general',
      parent_id: parentId,
      orden: aOrden(body.orden),
    }])
    .select()
    .single();
  if (error) throw error;
  return data as Tarea;
}

export async function actualizarTarea(
  id: string | null,
  body: CuerpoTarea,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Tarea> {
  if (!id) throw new ErrorTareas('id requerido', 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.titulo === 'string') {
    const titulo = body.titulo.trim();
    if (!titulo) throw new ErrorTareas('titulo requerido', 400);
    patch.titulo = titulo;
  }
  if ('proyecto' in body) patch.proyecto = textoOpcional(body.proyecto);
  if ('notas' in body) patch.notas = textoOpcional(body.notas);
  if ('urgente' in body) patch.urgente = body.urgente === true || body.urgente === 'true';
  if ('estado' in body) {
    const estado = body.estado === null || body.estado === undefined ? undefined : String(body.estado);
    if (!estado || !(ESTADOS as readonly string[]).includes(estado)) {
      throw new ErrorTareas('estado invalido', 400);
    }
    patch.estado = estado;
  }
  if ('deadline' in body) patch.deadline = textoOpcional(body.deadline);
  if ('prioridad' in body) {
    if (!esPrioridad(body.prioridad)) throw new ErrorTareas('prioridad invalida', 400);
    patch.prioridad = body.prioridad;
  }
  if ('tipo' in body) patch.tipo = textoOpcional(body.tipo);
  if ('grupo' in body) patch.grupo = textoOpcional(body.grupo) ?? 'general';
  if ('parent_id' in body) patch.parent_id = textoOpcional(body.parent_id);
  if ('orden' in body) patch.orden = aOrden(body.orden);
  if (!Object.keys(patch).length) throw new ErrorTareas('sin campos para actualizar', 400);

  // Solo se relee la tarea si el cambio puede romper la relacion padre/hijo.
  if ('parent_id' in patch || 'deadline' in patch) {
    const { data: actual, error: actualError } = await sb
      .from('tareas')
      .select('id, deadline, parent_id')
      .eq('id', id)
      .maybeSingle();
    if (actualError) throw actualError;
    if (!actual) throw new ErrorTareas('tarea no encontrada', 404);

    const parentId = ('parent_id' in patch ? patch.parent_id : actual.parent_id) as string | null;
    const deadline = ('deadline' in patch ? patch.deadline : actual.deadline) as string | null;
    if (parentId) {
      if (parentId === id) throw new ErrorTareas('una tarea no puede ser su propio padre', 400);
      const invalido = await validarDeadlineConPadre(sb, parentId, deadline);
      if (invalido) throw new ErrorTareas(invalido, 400);
    }
  }

  const { data, error } = await sb
    .from('tareas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const tarea = data as Tarea;
  // Gamificacion fire-and-forget: si el motor falla, la tarea ya se guardo.
  if (patch.estado === 'hecho') {
    registrarEvento(sb, {
      tipo: 'tarea_hecha',
      ref_tabla: 'tareas',
      ref_id: id,
      meta: { prioridad: tarea.prioridad ?? undefined },
    }).catch(() => null);
  }
  return tarea;
}

export async function eliminarTarea(
  id: string | null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<void> {
  if (!id) throw new ErrorTareas('id requerido', 400);
  const { error } = await sb.from('tareas').delete().eq('id', id);
  if (error) throw error;
}
