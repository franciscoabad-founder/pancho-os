// Logica del modulo Networking Room (tablas os_red_personas/conexiones/planes/objetivos).
//
// Mismo patron que journal.handlers.ts: nada de este archivo conoce Astro,
// TanStack Start, Request ni Response. Cliente de Supabase inyectable para
// tests en memoria.
//
// Este handler es el UNICO archivo del modulo que conoce al resto del OS. La
// logica de dominio real (densidad, banda, entropia, balance, vencidos) vive
// en src/lib/red/ y no importa nada de aca. Eso es lo que permite extraer
// src/lib/red/ a Nerio sin tocar una linea.
//
// El puente a `tareas` (generarTareasSemana) vive en un archivo aparte,
// red.puente-tareas.ts: es la unica funcion de todo el modulo que escribe
// fuera de las tablas os_red_*, y separarla deja clarisimo que es lo unico
// borrable sin romper el modulo.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { resumen, type Diagnostico } from '../lib/red/diagnostico.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseRed(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const TIPOS_LAZO = ['operacional', 'personal', 'estrategico'] as const;
export type TipoLazo = (typeof TIPOS_LAZO)[number];

export interface Persona {
  id: string;
  nombre: string;
  iniciales: string | null;
  area: string;
  cercania: number;
  tipo_lazo: TipoLazo;
  ultima_interaccion: string | null;
  frecuencia_dias: number;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export interface PersonaInput {
  nombre?: unknown;
  iniciales?: unknown;
  area?: unknown;
  cercania?: unknown;
  tipo_lazo?: unknown;
  frecuencia_dias?: unknown;
  notas?: unknown;
}

export interface Conexion {
  id: string;
  persona_a: string;
  persona_b: string;
  created_at: string;
}

export interface Plan {
  id: string;
  meta: string;
  horizonte_fin: string | null;
  frontera: string | null;
  activo: boolean;
  created_at: string;
}

export interface ObjetivoPlan {
  id: string;
  plan_id: string;
  persona_id: string;
  tactica: string | null;
  estado: 'pendiente' | 'en_curso' | 'logrado';
  created_at: string;
}

function textoRequerido(v: unknown, campo: string): string {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) throw new Error(`${campo} requerido`);
  return t;
}

function textoOpcional(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function inicialesDe(nombre: string, iniciales: unknown): string {
  const t = textoOpcional(iniciales);
  if (t) return t.toUpperCase().slice(0, 3);
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// --- Personas -----------------------------------------------------------

const MAX_PERSONAS_RECOMENDADO = 16;

export async function listarPersonas(soloActivas = true): Promise<Persona[]> {
  const sb = clienteActual();
  let query = sb.from('os_red_personas').select('*');
  if (soloActivas) query = query.eq('activo', true);
  const { data, error } = await query.order('created_at');
  if (error) throw error;
  return (data ?? []) as Persona[];
}

export async function crearPersona(input: PersonaInput): Promise<Persona> {
  const nombre = textoRequerido(input.nombre, 'nombre');
  const tipoLazo = String(input.tipo_lazo ?? '').trim();
  if (!TIPOS_LAZO.includes(tipoLazo as TipoLazo)) throw new Error(`tipo_lazo invalido: usa ${TIPOS_LAZO.join('|')}`);

  const cercaniaRaw = Number(input.cercania ?? 2);
  const cercania = Number.isInteger(cercaniaRaw) && cercaniaRaw >= 1 && cercaniaRaw <= 3 ? cercaniaRaw : 2;

  const frecuenciaRaw = Number(input.frecuencia_dias ?? 30);
  const frecuencia_dias = Number.isFinite(frecuenciaRaw) && frecuenciaRaw > 0 ? Math.round(frecuenciaRaw) : 30;

  const fila = {
    nombre,
    iniciales: inicialesDe(nombre, input.iniciales),
    area: textoOpcional(input.area) ?? 'general',
    cercania,
    tipo_lazo: tipoLazo,
    frecuencia_dias,
    notas: textoOpcional(input.notas),
  };

  const sb = clienteActual();
  const { data, error } = await sb.from('os_red_personas').insert([fila]).select().single();
  if (error) throw error;
  return data as Persona;
}

export async function actualizarPersona(id: string | null, input: PersonaInput): Promise<Persona> {
  if (!id) throw new Error('id requerido');
  const patch: Record<string, unknown> = {};

  if ('nombre' in input) patch.nombre = textoRequerido(input.nombre, 'nombre');
  if ('iniciales' in input) patch.iniciales = textoOpcional(input.iniciales);
  if ('area' in input) patch.area = textoOpcional(input.area) ?? 'general';
  if ('notas' in input) patch.notas = textoOpcional(input.notas);
  if ('cercania' in input) {
    const c = Number(input.cercania);
    if (!Number.isInteger(c) || c < 1 || c > 3) throw new Error('cercania invalida: usa 1, 2 o 3');
    patch.cercania = c;
  }
  if ('tipo_lazo' in input) {
    const t = String(input.tipo_lazo ?? '').trim();
    if (!TIPOS_LAZO.includes(t as TipoLazo)) throw new Error(`tipo_lazo invalido: usa ${TIPOS_LAZO.join('|')}`);
    patch.tipo_lazo = t;
  }
  if ('frecuencia_dias' in input) {
    const f = Number(input.frecuencia_dias);
    if (!Number.isFinite(f) || f <= 0) throw new Error('frecuencia_dias invalida');
    patch.frecuencia_dias = Math.round(f);
  }

  if (!Object.keys(patch).length) throw new Error('sin campos para actualizar');

  const sb = clienteActual();
  const { data, error } = await sb.from('os_red_personas').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Persona;
}

/** Marca el contacto de hoy con una persona: actualiza ultima_interaccion.
 *  Es lo que dispara el boton "Listo" al tocar a alguien de la lista de
 *  vencidos. */
export async function registrarContacto(id: string | null, fecha?: string): Promise<Persona> {
  if (!id) throw new Error('id requerido');
  const hoy = fecha ?? new Date().toISOString().slice(0, 10);
  const sb = clienteActual();
  const { data, error } = await sb.from('os_red_personas').update({ ultima_interaccion: hoy }).eq('id', id).select().single();
  if (error) throw error;
  return data as Persona;
}

export async function archivarPersona(id: string | null): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_red_personas').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

// --- Conexiones (grafo no dirigido) -----------------------------------------

export async function listarConexiones(): Promise<Conexion[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('os_red_conexiones').select('*');
  if (error) throw error;
  return (data ?? []) as Conexion[];
}

/** Conecta dos personas (se conocen entre si). Normaliza el orden del par
 *  para que (A,B) y (B,A) nunca queden como filas distintas -- el indice
 *  unico de la migracion depende de esta normalizacion. */
export async function conectarPersonas(idA: string | null, idB: string | null): Promise<Conexion> {
  if (!idA || !idB) throw new Error('persona_a y persona_b requeridos');
  if (idA === idB) throw new Error('una persona no puede conectarse consigo misma');
  const [persona_a, persona_b] = [idA, idB].sort();

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_red_conexiones')
    .upsert([{ persona_a, persona_b }], { onConflict: 'persona_a,persona_b', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Conexion;

  // upsert con ignoreDuplicates no devuelve fila si ya existia; la buscamos.
  const { data: existente, error: errExistente } = await sb
    .from('os_red_conexiones')
    .select('*')
    .eq('persona_a', persona_a)
    .eq('persona_b', persona_b)
    .single();
  if (errExistente) throw errExistente;
  return existente as Conexion;
}

export async function desconectarPersonas(idA: string | null, idB: string | null): Promise<void> {
  if (!idA || !idB) throw new Error('persona_a y persona_b requeridos');
  const [persona_a, persona_b] = [idA, idB].sort();
  const sb = clienteActual();
  const { error } = await sb.from('os_red_conexiones').delete().eq('persona_a', persona_a).eq('persona_b', persona_b);
  if (error) throw error;
}

// --- Diagnostico (scorecard) -------------------------------------------

export async function obtenerDiagnostico(): Promise<Diagnostico & { totalPersonas: number; limiteRecomendado: number }> {
  const [personas, conexiones] = await Promise.all([listarPersonas(true), listarConexiones()]);
  const d = resumen(personas, conexiones.length);
  return { ...d, totalPersonas: personas.length, limiteRecomendado: MAX_PERSONAS_RECOMENDADO };
}

// --- Plan de red -----------------------------------------------------------

export async function obtenerPlanActivo(): Promise<{ plan: Plan | null; objetivos: ObjetivoPlan[] }> {
  const sb = clienteActual();
  const { data: plan, error: errPlan } = await sb.from('os_red_planes').select('*').eq('activo', true).maybeSingle();
  if (errPlan) throw errPlan;
  if (!plan) return { plan: null, objetivos: [] };

  const { data: objetivos, error: errObj } = await sb.from('os_red_objetivos').select('*').eq('plan_id', (plan as Plan).id);
  if (errObj) throw errObj;
  return { plan: plan as Plan, objetivos: (objetivos ?? []) as ObjetivoPlan[] };
}

/** Crea un plan nuevo y desactiva el anterior si existe. Igual que
 *  crearNuevoMapa en ikigai.handlers.ts (mismo bug real detectado ahi:
 *  reemplazar sin copiar se siente como perder el trabajo), los objetivos
 *  del plan anterior se copian al nuevo por defecto -- crear un plan
 *  encima de uno activo es "ajustar", no "empezar de cero". Hoy la UI de
 *  OSRed.tsx solo llama esto cuando no hay plan activo (previo=null,
 *  rama de copia nunca se ejecuta), pero la funcion queda correcta para
 *  cuando exista un flujo de "nuevo plan" con uno ya activo. */
export async function crearPlan(meta: unknown, frontera?: unknown, horizonteFin?: unknown, copiarAnterior = true): Promise<Plan> {
  const m = textoRequerido(meta, 'meta');
  const sb = clienteActual();

  const { data: previo } = await sb.from('os_red_planes').select('id').eq('activo', true).maybeSingle();
  if (previo) {
    const { error: errDesactivar } = await sb.from('os_red_planes').update({ activo: false }).eq('id', (previo as { id: string }).id);
    if (errDesactivar) throw errDesactivar;
  }

  const fecha = typeof horizonteFin === 'string' && horizonteFin.trim() ? horizonteFin.trim() : null;
  const { data, error } = await sb
    .from('os_red_planes')
    .insert([{ meta: m, frontera: textoOpcional(frontera), horizonte_fin: fecha, activo: true }])
    .select()
    .single();
  if (error) throw error;
  const nuevo = data as Plan;

  if (previo && copiarAnterior) {
    const { data: objetivos } = await sb
      .from('os_red_objetivos')
      .select('persona_id, tactica, estado')
      .eq('plan_id', (previo as { id: string }).id);
    if (objetivos?.length) {
      const copia = objetivos.map((o) => ({ ...o, plan_id: nuevo.id }));
      const { error: errObjetivos } = await sb.from('os_red_objetivos').insert(copia);
      if (errObjetivos) throw errObjetivos;
    }
  }

  return nuevo;
}

export async function agregarObjetivo(planId: string | null, personaId: string | null, tactica?: unknown): Promise<ObjetivoPlan> {
  if (!planId) throw new Error('plan_id requerido');
  if (!personaId) throw new Error('persona_id requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_red_objetivos')
    .insert([{ plan_id: planId, persona_id: personaId, tactica: textoOpcional(tactica) }])
    .select()
    .single();
  if (error) throw error;
  return data as ObjetivoPlan;
}

export async function actualizarEstadoObjetivo(id: string | null, estado: unknown): Promise<ObjetivoPlan> {
  if (!id) throw new Error('id requerido');
  const e = String(estado ?? '').trim();
  if (!['pendiente', 'en_curso', 'logrado'].includes(e)) throw new Error('estado invalido');
  const sb = clienteActual();
  const { data, error } = await sb.from('os_red_objetivos').update({ estado: e }).eq('id', id).select().single();
  if (error) throw error;
  return data as ObjetivoPlan;
}
