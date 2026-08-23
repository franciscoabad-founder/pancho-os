// Logica pura de os_system_state: el estado Cortex del OS (objetivos de 90 dias,
// priority stack, modulos) mas los flags de onboarding.
//
// Extraida de src/pages/api/system.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.
//
// Dos detalles heredados que se conservan tal cual porque son contrato, no
// accidente:
//   1. El GET NUNCA falla. Si Supabase no responde devuelve sistemaDefault con
//      source 'fallback' y status 200, para que el OS abra igual sin conexion a
//      la base. Por eso obtenerSistema() se traga su propio error.
//   2. El PUT que solo trae flags de onboarding (sin `state`) es una rama
//      aparte: actualiza los flags y, si la fila todavia no existe, siembra
//      sistemaDefault para no dejarla sin estado.
//
// import.meta.env.OS_SYSTEM_WEBHOOK_URL pasa a readEnv(): Vite solo expone las
// variables VITE_*, asi que en el build de Nitro la lectura directa quedaria
// undefined y el webhook a n8n no se dispararia nunca.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { readEnv } from '../lib/env.ts';
import { sistemaDefault } from '../os/data/sistema.ts';
import type { SistemaState } from '../os/data/types.ts';

// Seam para tests: en produccion siempre resuelve a getSupabaseServer.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseSystem(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

const STATE_KEY = 'main';

export class ErrorSystem extends Error {
  status: number;
  /** Claves extra que acompañan al error en el cuerpo de la respuesta. */
  extra: Record<string, unknown>;
  constructor(mensaje: string, status: number, extra: Record<string, unknown> = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
    this.name = 'ErrorSystem';
  }
}

async function notifySystemWebhook(state: SistemaState): Promise<void> {
  const webhook = readEnv('OS_SYSTEM_WEBHOOK_URL');
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'os-system', state, ts: new Date().toISOString() }),
    });
  } catch {
    // El OS no debe fallar si n8n esta temporalmente abajo.
  }
}

/** Nunca lanza: ante cualquier fallo devuelve el estado por defecto (source 'fallback'). */
export async function obtenerSistema(): Promise<Record<string, unknown>> {
  try {
    const sb = clienteActual();
    const { data, error } = await sb
      .from('os_system_state')
      .select('state, updated_at, onboarding_completed, onboarding_answers')
      .eq('key', STATE_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!data?.state) {
      return {
        state: sistemaDefault,
        source: 'default',
        onboarding_completed: data?.onboarding_completed ?? false,
        onboarding_answers: data?.onboarding_answers ?? {},
      };
    }

    return {
      state: data.state,
      source: 'supabase',
      updated_at: data.updated_at,
      onboarding_completed: data.onboarding_completed ?? false,
      onboarding_answers: data.onboarding_answers ?? {},
    };
  } catch (err) {
    return {
      state: sistemaDefault,
      source: 'fallback',
      onboarding_completed: false,
      onboarding_answers: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** PUT sin `state` pero con flags de onboarding: rama aparte, no toca el estado Cortex. */
export function esPutSoloOnboarding(body: Record<string, unknown>): boolean {
  return !body.state && ('onboarding_completed' in body || 'onboarding_answers' in body);
}

export async function guardarOnboarding(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const sb = clienteActual();
    const patch: Record<string, unknown> = { key: STATE_KEY, updated_at: new Date().toISOString() };
    if ('onboarding_completed' in body) patch.onboarding_completed = body.onboarding_completed === true;
    if ('onboarding_answers' in body) patch.onboarding_answers = body.onboarding_answers ?? {};

    const { data: existente, error: exError } = await sb
      .from('os_system_state')
      .select('key, state')
      .eq('key', STATE_KEY)
      .maybeSingle();
    if (exError) throw exError;
    if (!existente) patch.state = sistemaDefault;

    const { data, error } = await sb
      .from('os_system_state')
      .upsert(patch, { onConflict: 'key' })
      .select('onboarding_completed, onboarding_answers, updated_at')
      .single();
    if (error) throw error;
    return {
      ok: true,
      onboarding_completed: data.onboarding_completed,
      onboarding_answers: data.onboarding_answers,
      updated_at: data.updated_at,
    };
  } catch (err) {
    throw new ErrorSystem(err instanceof Error ? err.message : String(err), 502);
  }
}

export async function guardarSistema(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const state = body.state as SistemaState | undefined;

  if (!state || !Array.isArray(state.objetivos_90d) || !Array.isArray(state.priority_stack)) {
    throw new ErrorSystem('estado invalido', 400);
  }

  const nextState = {
    ...state,
    version: 1,
    updated_at: new Date().toISOString(),
  };

  try {
    const sb = clienteActual();
    const { data, error } = await sb
      .from('os_system_state')
      .upsert({
        key: STATE_KEY,
        state: nextState,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select('state, updated_at')
      .single();

    if (error) throw error;
    await notifySystemWebhook(data.state as SistemaState);
    return { ok: true, state: data.state, updated_at: data.updated_at };
  } catch (err) {
    // El 502 devuelve tambien el estado que se intento guardar, igual que Astro:
    // asi el cliente puede reintentar sin volver a armarlo.
    throw new ErrorSystem(err instanceof Error ? err.message : String(err), 502, { state: nextState });
  }
}
