// Logica de /api/juego/reset: vuelve el Juego a foja cero sin borrar definiciones.
//
// Que se toca:
//   - jugador: nivel 1 (xp_total 0), oro 0, hp = hp_max.
//   - xp_events: se borran todos (el historial de XP/oro es lo que da el estado stale).
//   - quests activas: se cancelan (una apuesta viva contra un oro que ya no existe
//     no tiene sentido). El historial de quests se conserva.
// Que NO se toca: recompensas (definiciones de la tienda), gfit_logros_obtenidos
// (son de GFIT, no del Juego) ni la config de mecanicas del jugador.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { json } from './osAuth.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseJuegoReset(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

export interface JugadorReset {
  hp_max?: number | null;
}

/** Patch puro que deja al jugador en foja cero. HP vuelve a su maximo. */
export function patchJugadorReset(
  jugador: JugadorReset,
  ahora: string = new Date().toISOString(),
): { xp_total: number; oro: number; hp: number; updated_at: string } {
  const hpMax = Number(jugador?.hp_max);
  const hp = Number.isFinite(hpMax) && hpMax > 0 ? Math.round(hpMax) : 50;
  return { xp_total: 0, oro: 0, hp, updated_at: ahora };
}

export interface ResultadoReset {
  jugador: Record<string, unknown>;
  eventosBorrados: number;
  questsCanceladas: number;
}

/** Ejecuta el reset. Lanza si Supabase falla; el caller traduce a HTTP. */
export async function ejecutarResetJuego(sb: SupabaseClient = clienteActual()): Promise<ResultadoReset> {
  const { data: jugadorRows, error: errJugador } = await sb
    .from('jugador')
    .select('id, hp_max')
    .limit(1);
  if (errJugador) throw errJugador;
  const jugador = jugadorRows?.[0] as { id: string; hp_max: number } | undefined;
  if (!jugador) throw new Error('jugador no encontrado');

  const { data: eventos, error: errBorrar } = await sb
    .from('xp_events')
    .delete()
    .not('id', 'is', null)
    .select('id');
  if (errBorrar) throw errBorrar;

  const { data: canceladas, error: errQuests } = await sb
    .from('quests')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('estado', 'activa')
    .select('id');
  if (errQuests) throw errQuests;

  const { data: actualizado, error: errUpdate } = await sb
    .from('jugador')
    .update(patchJugadorReset(jugador))
    .eq('id', jugador.id)
    .select()
    .single();
  if (errUpdate) throw errUpdate;

  return {
    jugador: (actualizado ?? {}) as Record<string, unknown>,
    eventosBorrados: eventos?.length ?? 0,
    questsCanceladas: canceladas?.length ?? 0,
  };
}

export async function resetJuego(): Promise<Response> {
  try {
    const resultado = await ejecutarResetJuego(clienteActual());
    return json({ ok: true, ...resultado });
  } catch (err) {
    const msg = errMsg(err);
    if (msg === 'jugador no encontrado') return json({ error: msg }, 404);
    return json({ error: msg }, 502);
  }
}
