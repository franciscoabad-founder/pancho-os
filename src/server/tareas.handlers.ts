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
import { type Actor, type TareaEvento, listarEventos, registrarCambio } from './tareaEventos.handlers.ts';

export const PRIORIDADES = ['low', 'medium', 'high', 'critical'] as const;
// 5 valores (antes solo 3): 'bloqueada' y 'cancelada' entran con el CHECK de
// la migracion 20260831000100_tareas_baseline.sql. Los dos viajan en el mismo
// despliegue: ampliar aca sin el CHECK en la base, o el CHECK sin ampliar
// aca, da 400 intermitentes o filas ilegales segun que gane.
export const ESTADOS = ['pendiente', 'en_progreso', 'bloqueada', 'hecho', 'cancelada'] as const;

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
  updated_at: string;
  completado_at: string | null;
  visto_hasta: string | null;
  linea_id: string | null;
}

export interface TareaDetalle {
  tarea: Tarea;
  subtareas: Tarea[];
  eventos: TareaEvento[];
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

export interface OpcionesActualizarTarea {
  /** `updated_at` que el cliente vio al abrir el detalle. Si la fila cambio
   * desde entonces, el PATCH se rechaza con 409 en vez de pisar en silencio
   * (Pancho y Hermes pueden editar la misma tarea a la vez). */
  ifMatch?: string | null;
  /** Quien hizo el cambio, para el evento 'cambio' del feed. Sin actor no se
   * registra evento (lo usan callers viejos que no propagan identidad). */
  actor?: Actor;
}

export async function actualizarTarea(
  id: string | null,
  body: CuerpoTarea,
  sb: SupabaseClient = getSupabaseServer(),
  opts: OpcionesActualizarTarea = {},
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

  // Siempre se relee la fila actual: hace falta para el If-Match, para el
  // diff que va al feed, y (si cambia parent_id/deadline) para validar contra
  // el padre. Es una sola lectura extra, aceptable para un OS de un usuario.
  const { data: actual, error: actualError } = await sb
    .from('tareas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (actualError) throw actualError;
  if (!actual) throw new ErrorTareas('tarea no encontrada', 404);

  if (opts.ifMatch && (actual as Tarea).updated_at !== opts.ifMatch) {
    throw new ErrorTareas('la tarea cambio desde que la abriste; recarga y reintenta', 409);
  }

  if ('parent_id' in patch || 'deadline' in patch) {
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

  // Un evento 'cambio' por PATCH con todos los campos modificados, no uno por
  // campo. Sin actor (callers que aun no propagan identidad) no se registra:
  // mejor un feed incompleto que uno con autor inventado.
  if (opts.actor) {
    const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const campo of Object.keys(patch)) {
      const antes = (actual as Record<string, unknown>)[campo] ?? null;
      const despues = patch[campo] ?? null;
      if (antes !== despues) cambios[campo] = { antes, despues };
    }
    registrarCambio(sb, id, cambios, opts.actor).catch(() => null);
  }

  return tarea;
}

/** Tarea + subtareas + feed, para el panel de detalle.
 * `tipoEvento` filtra el feed (p.ej. 'comentario' para solo conversacion).
 * Marca `visto_hasta = now()` en la tarea abierta (regla de avance: abrir el
 * detalle es la señal de "Pancho lo vio"), en background y best-effort: si
 * falla, el detalle igual se muestra. */
export async function obtenerTarea(
  id: string,
  tipoEvento: string | null = null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<TareaDetalle> {
  const { data: tarea, error } = await sb.from('tareas').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!tarea) throw new ErrorTareas('tarea no encontrada', 404);

  const { data: subtareas, error: subError } = await sb
    .from('tareas')
    .select('*')
    .eq('parent_id', id)
    .order('orden', { ascending: true });
  if (subError) throw subError;

  const eventos = await listarEventos(sb, id, tipoEvento);

  void (async () => {
    await sb.from('tareas').update({ visto_hasta: new Date().toISOString() }).eq('id', id);
  })().catch(() => null);

  return { tarea: tarea as Tarea, subtareas: (subtareas ?? []) as Tarea[], eventos };
}

export async function eliminarTarea(
  id: string | null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<void> {
  if (!id) throw new ErrorTareas('id requerido', 400);
  const { error } = await sb.from('tareas').delete().eq('id', id);
  if (error) throw error;
}
