// Alias local de sesiones de Hermes (tabla chat_sesiones_alias).
//
// Problema que resuelve (auditoria del 6 sep 2026, seccion b): los titulos de
// las sesiones los inventa el auto-titulador de Hermes a partir del primer
// mensaje, y su prompt trae "Friendly greeting" como ejemplo literal, asi que
// un "hola" produce ese titulo. Pancho necesita poder renombrar.
//
// Estrategia en dos pisos:
//   1. Se intenta persistir en Hermes con PATCH /api/sessions/{id} {"title"},
//      que es el titulo con mas autoridad (el mismo que pone /title en
//      Telegram) y se ve desde cualquier cliente.
//   2. Pase o no pase eso, el OS guarda el alias en su propia base y lo
//      muestra POR ENCIMA del titulo de Hermes. Asi el nombre sobrevive
//      aunque la build del VPS no soporte el PATCH y aunque el auto-titulador
//      vuelva a correr.
//
// Callers: src/routes/api/taski/sesiones.ts. Proxy a Hermes: taski.handlers.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { renombrarSesionHermes, validarPerfil, type SesionTaski } from './taski.handlers.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

/** Seam para tests. */
export function setClienteSupabaseAlias(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const MAX_LARGO_ALIAS = 120;

export interface SesionAlias {
  session_id: string;
  perfil: string;
  alias: string;
  sincronizado_hermes: boolean;
}

/** Alias guardados para un perfil, indexados por session_id. */
export async function mapaAlias(perfilRaw: string = 'vps-default'): Promise<Map<string, SesionAlias>> {
  const perfil = validarPerfil(perfilRaw);
  try {
    const { data, error } = await clienteActual()
      .from('chat_sesiones_alias')
      .select('session_id, perfil, alias, sincronizado_hermes')
      .eq('perfil', perfil);
    // Sin tabla (migracion no aplicada) el OS sigue funcionando con los
    // titulos de Hermes: renombrar es una mejora, no un requisito.
    if (error) return new Map();
    return new Map((data ?? []).map((f) => [String((f as SesionAlias).session_id), f as SesionAlias]));
  } catch {
    return new Map();
  }
}

export interface SesionConAlias extends SesionTaski {
  /** Titulo original de Hermes, cuando el OS lo esta tapando con un alias. */
  tituloHermes?: string | null;
  /** true = el nombre que se muestra lo puso Pancho, no el auto-titulador. */
  alias?: boolean;
}

/** Superpone los alias locales sobre los titulos que devolvio Hermes. */
export function aplicarAlias(sesiones: SesionTaski[], alias: Map<string, SesionAlias>): SesionConAlias[] {
  if (alias.size === 0) return sesiones;
  return sesiones.map((s) => {
    const propio = alias.get(s.id);
    return propio ? { ...s, title: propio.alias, tituloHermes: s.title, alias: true } : s;
  });
}

export interface ResultadoRenombrar {
  session_id: string;
  perfil: string;
  alias: string;
  /** true = el titulo tambien quedo guardado en Hermes. */
  sincronizado_hermes: boolean;
  /** true = el alias quedo al menos en la base del OS. */
  guardado_local: boolean;
}

/**
 * Renombra una sesion. Nunca falla por culpa de Hermes: si el PATCH no pasa,
 * el alias local igual queda guardado y la UI lo muestra.
 */
export async function renombrarSesion(
  sessionId: string,
  tituloRaw: unknown,
  perfilRaw: string = 'vps-default',
): Promise<ResultadoRenombrar> {
  const perfil = validarPerfil(perfilRaw);
  const alias = String(tituloRaw ?? '').trim();
  if (!alias) throw new Error('El nombre es requerido');
  if (alias.length > MAX_LARGO_ALIAS) throw new Error(`Nombre demasiado largo (max ${MAX_LARGO_ALIAS})`);
  if (!sessionId.trim()) throw new Error('session_id es requerido');

  const sincronizado = await renombrarSesionHermes(sessionId, alias, perfil);

  let guardadoLocal = false;
  try {
    const { error } = await clienteActual()
      .from('chat_sesiones_alias')
      .upsert(
        { session_id: sessionId, perfil, alias, sincronizado_hermes: sincronizado, updated_at: new Date().toISOString() },
        { onConflict: 'perfil,session_id' },
      );
    guardadoLocal = !error;
  } catch {
    guardadoLocal = false;
  }

  if (!sincronizado && !guardadoLocal) {
    throw new Error('No se pudo guardar el nombre ni en Hermes ni en el OS');
  }
  return { session_id: sessionId, perfil, alias, sincronizado_hermes: sincronizado, guardado_local: guardadoLocal };
}
