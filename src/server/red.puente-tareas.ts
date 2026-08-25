// Puente Networking Room -> tareas. UNICO archivo del modulo que escribe
// fuera de las tablas os_red_*. Se puede borrar sin romper el modulo: red
// seguiria funcionando completa (personas, conexiones, diagnostico, plan),
// solo dejaria de aparecer en la lista de tareas de todos los dias.
//
// No inventa deduplicacion propia: usa el RPC `capturar_lote` que ya existe
// en la base (mismo que usa el flujo de captura general del OS). Ese RPC
// inserta en `tareas` con `on conflict (dedupe_key) do nothing`, calculando
// el hash el mismo (fuente, fuente_ref, kind, titulo) -- correr esto dos
// veces en la misma semana no duplica nada, sin logica extra aca.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { vencidos, type PersonaCadencia } from '../lib/red/cadencia.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseRedPuente(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface ResultadoGeneracion {
  captura_id: string;
  items_detectados: number;
  items_creados: number;
  items_duplicados: number;
}

/** Genera una tarea por cada persona vencida esta semana. `semana` es el
 *  identificador ISO ('2026-W35') que entra como fuente_ref: correr esto de
 *  nuevo en la MISMA semana no crea tareas repetidas (el RPC deduplica);
 *  correrlo en una semana distinta si crea tareas nuevas. */
export async function generarTareasSemana(semana: string, hoy?: string): Promise<ResultadoGeneracion> {
  if (!semana || !semana.trim()) throw new Error('semana requerida');
  const fechaHoy = hoy ?? new Date().toISOString().slice(0, 10);

  const sb = clienteActual();
  const { data: personas, error: errPersonas } = await sb
    .from('os_red_personas')
    .select('id, nombre, ultima_interaccion, frecuencia_dias')
    .eq('activo', true);
  if (errPersonas) throw errPersonas;

  const aVencidos = vencidos((personas ?? []) as PersonaCadencia[], fechaHoy);
  if (aVencidos.length === 0) {
    return { captura_id: '', items_detectados: 0, items_creados: 0, items_duplicados: 0 };
  }

  // Buscamos la tactica de cada persona si esta en el plan activo, para que
  // la tarea no sea un titulo pelado sino el "como" que se definio.
  const { data: plan } = await sb.from('os_red_planes').select('id').eq('activo', true).maybeSingle();
  const tacticasPorPersona = new Map<string, string>();
  if (plan) {
    const { data: objetivos } = await sb
      .from('os_red_objetivos')
      .select('persona_id, tactica')
      .eq('plan_id', (plan as { id: string }).id);
    for (const o of (objetivos ?? []) as Array<{ persona_id: string; tactica: string | null }>) {
      if (o.tactica) tacticasPorPersona.set(o.persona_id, o.tactica);
    }
  }

  const items = aVencidos.map((p) => ({
    kind: 'tarea',
    titulo: `Contactar a ${p.nombre}`,
    detalle: tacticasPorPersona.get(p.id) ?? null,
    proyecto: 'Networking Room',
  }));

  const { data, error } = await sb.rpc('capturar_lote', {
    p_fuente: 'red',
    p_fuente_ref: `semana:${semana}`,
    p_fuente_hash: '',
    p_items: items,
  });
  if (error) throw error;

  const resultado = data as { captura_id: string; items_detectados: number; items_creados: number; items_duplicados: number };
  return resultado;
}
