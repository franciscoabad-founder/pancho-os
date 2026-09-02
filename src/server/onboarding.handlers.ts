// Logica pura del onboarding: estado por modulo y aplicacion de respuestas.
//
// Extraida de src/pages/api/onboarding.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { resumenModos } from '../os/components/onboarding/flujoOs';
import {
  mecanicasDelOnboarding,
  questDelOnboarding,
  recompensasDelOnboarding,
} from '../os/components/onboarding/flujoJuego';
import { hoyLocal, addDias, diaIso } from '../lib/habitos/fechas.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseOnboarding(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface EstadoOnboarding {
  id: string;
  modulo: string;
  paso: number | null;
  respuestas: Record<string, unknown>;
  completado_at: string | null;
  updated_at?: string;
}

const STATE_KEY = 'main';
const FUNCIONES = ['promover', 'vender', 'construir', 'entregar'] as const;

type SB = ReturnType<typeof clienteActual>;

export async function obtenerOnboarding(modulo: string): Promise<EstadoOnboarding | null> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from('onboarding_estado')
    .select('*')
    .eq('modulo', modulo)
    .maybeSingle();
  if (error) throw error;
  return (data as EstadoOnboarding | null) ?? null;
}

// Deriva y escribe la config de Salud a partir de las respuestas del onboarding
// del modulo 'salud'. Escribe defensivamente: si la columna `ayuno_objetivo_h`
// todavia no existe en la base, reintenta sin las columnas de ayuno.
export async function aplicarSalud(sb: SB, respuestas: Record<string, unknown>): Promise<{ config: unknown; nota?: string }> {
  const r = respuestas ?? {};

  const pesoActual = (r.peso_actual ?? {}) as Record<string, unknown>;
  const targets = (r.targets ?? {}) as Record<string, unknown>;
  const unidadRaw = (r.unidad ?? pesoActual.unidad ?? 'kg') as string;
  const unidadFinal = unidadRaw === 'kg' || unidadRaw === 'lb' ? unidadRaw : 'kg';

  const patchBase: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (targets.kcal != null) patchBase.kcal_objetivo = Math.round(Number(targets.kcal));
  if (targets.proteina_g != null) patchBase.proteina_objetivo_g = Math.round(Number(targets.proteina_g));
  if (targets.carbos_g != null) patchBase.carbos_objetivo_g = Math.round(Number(targets.carbos_g));
  if (targets.grasa_g != null) patchBase.grasa_objetivo_g = Math.round(Number(targets.grasa_g));
  if (unidadFinal === 'kg' || unidadFinal === 'lb') patchBase.unidad_peso = unidadFinal;

  const TOKEN_ONBOARDING_A_CONFIG: Record<string, string> = { '16:8': '16_8', '24h': '24h', '36h': '36h' };
  const HORAS_POR_PROTOCOLO: Record<string, number> = { '16_8': 16, '24h': 24, '36h': 36 };
  const protocoloAyuno = TOKEN_ONBOARDING_A_CONFIG[r.protocolo_ayuno as string];
  const patchAyuno: Record<string, unknown> = {};
  if (protocoloAyuno) {
    patchAyuno.protocolo_ayuno_default = protocoloAyuno;
    patchAyuno.ayuno_objetivo_h = HORAS_POR_PROTOCOLO[protocoloAyuno];
  }

  const { data: existente, error: errLeer } = await sb
    .from('salud_config')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);
  if (errLeer) throw errLeer;
  let configId = (existente?.[0] as { id?: string } | undefined)?.id;
  if (!configId) {
    const { data: creado, error: errCrear } = await sb.from('salud_config').insert([{}]).select('id').single();
    if (errCrear) throw errCrear;
    configId = (creado as { id: string }).id;
  }

  try {
    const { data, error } = await sb
      .from('salud_config')
      .update({ ...patchBase, ...patchAyuno })
      .eq('id', configId)
      .select()
      .single();
    if (error) throw error;
    return { config: data };
  } catch (errConAyuno) {
    if (!Object.keys(patchAyuno).length) throw errConAyuno;
    const { data, error } = await sb
      .from('salud_config')
      .update(patchBase)
      .eq('id', configId)
      .select()
      .single();
    if (error) throw error;
    return {
      config: data,
      nota: 'Las columnas de protocolo de ayuno no existian todavia; se aplicaron el resto de los targets. Vuelve a intentar "aplicar" tras la siguiente migracion.',
    };
  }
}

// Deriva y escribe la config del modulo OS a partir de las respuestas del
// onboarding del modulo 'os'.
export async function aplicarOs(sb: SB, respuestas: Record<string, unknown>) {
  const r = respuestas ?? {};

  const { maker, manager, off } = resumenModos(r as Record<string, unknown>);
  const diasSale: number[] = Array.isArray(r.dias_sale) ? r.dias_sale as number[] : [];
  const modoPorDia = new Map<number, 'maker' | 'manager' | 'off'>();
  for (const d of maker) modoPorDia.set(d, 'maker');
  for (const d of manager) modoPorDia.set(d, 'manager');
  for (const d of off) modoPorDia.set(d, 'off');

  const upserts = [];
  const now = new Date().toISOString();
  for (let dia = 1; dia <= 7; dia++) {
    const modo = modoPorDia.get(dia) ?? 'manager';
    const sale = diasSale.includes(dia);
    upserts.push({ dia, modo, sale, updated_at: now });
  }

  const { error: errSemana } = await sb
    .from('os_semana')
    .upsert(upserts, { onConflict: 'dia' });
  if (errSemana) throw errSemana;
  const semanaEscritas = upserts.length;

  const lineasMaker: string[] = Array.isArray(r.lineas_maker) ? r.lineas_maker as string[] : [];
  const { data: todasLineas, error: errLineas } = await sb.from('os_lineas').select('id, nombre');
  if (errLineas) throw errLineas;
  let lineasEscritas = 0;
  for (const l of (todasLineas ?? []) as { id: string; nombre: string }[]) {
    const recibeMaker = lineasMaker.includes(l.nombre);
    const { error } = await sb
      .from('os_lineas')
      .update({ recibe_maker: recibeMaker, updated_at: new Date().toISOString() })
      .eq('id', l.id);
    if (error) throw error;
    lineasEscritas++;
  }

  const presupuesto = (r.presupuesto ?? {}) as Record<string, unknown>;
  let presupuestoEscrito = 0;
  for (const funcion of FUNCIONES) {
    const horas = presupuesto[funcion];
    if (horas == null) continue;
    const { error } = await sb
      .from('os_funcion_presupuesto')
      .upsert(
        { funcion, horas_semana_objetivo: Number(horas), updated_at: new Date().toISOString() },
        { onConflict: 'funcion' },
      );
    if (error) throw error;
    presupuestoEscrito++;
  }

  const puntoPartida = (r.punto_partida ?? {}) as Record<string, unknown>;
  let objetivosEscritos = 0;
  if (puntoPartida.finanzas != null) {
    const { error } = await sb
      .from('os_objetivos')
      .update({ punto_partida: puntoPartida.finanzas, updated_at: new Date().toISOString() })
      .eq('orden', 1)
      .eq('activo', true);
    if (error) throw error;
    objetivosEscritos++;
  }
  if (puntoPartida.ingresos != null) {
    const { error } = await sb
      .from('os_objetivos')
      .update({ punto_partida: puntoPartida.ingresos, updated_at: new Date().toISOString() })
      .eq('orden', 3)
      .eq('activo', true);
    if (error) throw error;
    objetivosEscritos++;
  }

  const identidadTexto = (r.identidad as Record<string, unknown> | undefined)?.texto;
  let identidadEscrita = false;
  if (identidadTexto != null) {
    const { data: existente, error: errLeer } = await sb
      .from('os_system_state')
      .select('state')
      .eq('key', STATE_KEY)
      .maybeSingle();
    if (errLeer) throw errLeer;
    const stateActual = (existente?.state as Record<string, unknown>) ?? {};
    const nuevoState = { ...stateActual, identidad: identidadTexto };
    const { error: errWrite } = await sb
      .from('os_system_state')
      .upsert(
        { key: STATE_KEY, state: nuevoState, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    if (errWrite) throw errWrite;
    identidadEscrita = true;
  }

  return {
    semana: semanaEscritas,
    lineas: lineasEscritas,
    presupuesto: presupuestoEscrito,
    objetivos: objetivosEscritos,
    identidad: identidadEscrita,
  };
}

// Deriva la linea base del modulo Juego a partir de las respuestas del
// onboarding: config de mecanicas sobre el jugador, recompensas iniciales de la
// tienda y (opcional) la quest de la semana en curso. No toca xp_total ni oro:
// el onboarding define el contrato, no regala progreso.
export async function aplicarJuego(sb: SB, respuestas: Record<string, unknown>) {
  const r = respuestas ?? {};

  const { data: jugadorRows, error: errJugador } = await sb
    .from('jugador')
    .select('id, oro, config')
    .limit(1);
  if (errJugador) throw errJugador;
  const jugador = jugadorRows?.[0] as { id: string; oro?: number; config?: Record<string, unknown> } | undefined;
  if (!jugador) throw new Error('jugador no encontrado');

  const mecanicas = mecanicasDelOnboarding(r);
  const { error: errConfig } = await sb
    .from('jugador')
    .update({
      config: { ...(jugador.config ?? {}), ...mecanicas },
      updated_at: new Date().toISOString(),
    })
    .eq('id', jugador.id);
  if (errConfig) throw errConfig;

  // Rehacer el onboarding no debe duplicar la tienda: se saltan los nombres que
  // ya existen.
  const recompensas = recompensasDelOnboarding(r);
  let recompensasCreadas = 0;
  if (recompensas.length) {
    const { data: existentes, error: errExistentes } = await sb.from('recompensas').select('nombre');
    if (errExistentes) throw errExistentes;
    const yaEstan = new Set(
      ((existentes ?? []) as Array<{ nombre?: string }>).map((x) => (x.nombre ?? '').trim().toLowerCase()),
    );
    const nuevas = recompensas.filter((x) => !yaEstan.has(x.nombre.toLowerCase()));
    if (nuevas.length) {
      const { error } = await sb
        .from('recompensas')
        .insert(nuevas.map((x) => ({ nombre: x.nombre, costo_oro: x.costo_oro })));
      if (error) throw error;
      recompensasCreadas = nuevas.length;
    }
  }

  const quest = questDelOnboarding(r);
  let questCreada = false;
  if (quest) {
    const hoy = hoyLocal();
    const semanaInicio = addDias(hoy, -(diaIso(hoy) - 1));
    const { error } = await sb.from('quests').insert([{
      titulo: quest.titulo,
      objetivo: { tipo: 'conteo_eventos', evento: quest.evento, meta: quest.meta },
      // La apuesta solo se registra si el jugador ya tiene ese oro. Arrancando
      // en cero queda en cero: no se apuesta oro que no existe.
      apuesta_oro: Math.min(quest.apuesta_oro, Number(jugador.oro ?? 0)),
      premio_xp: quest.premio_xp,
      premio_oro: 0,
      semana_inicio: semanaInicio,
    }]);
    if (error) throw error;
    questCreada = true;
  }

  return { mecanicas, recompensas: recompensasCreadas, quest: questCreada };
}

export async function guardarOnboarding(
  modulo: string,
  body: Record<string, unknown>,
): Promise<EstadoOnboarding> {
  const sb = clienteActual();

  const { data: actual, error: errActual } = await sb
    .from('onboarding_estado')
    .select('respuestas, paso')
    .eq('modulo', modulo)
    .maybeSingle();
  if (errActual) throw errActual;

  const respuestasMerge = {
    ...(actual?.respuestas ?? {}),
    ...(body.respuestas && typeof body.respuestas === 'object' ? body.respuestas : {}),
  };

  const patch: Record<string, unknown> = {
    modulo,
    respuestas: respuestasMerge,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.paso === 'number') patch.paso = body.paso;
  else if (actual?.paso != null) patch.paso = actual.paso;
  if (body.completado === true) patch.completado_at = new Date().toISOString();

  const { data, error } = await sb
    .from('onboarding_estado')
    .upsert(patch, { onConflict: 'modulo' })
    .select()
    .single();
  if (error) throw error;
  return data as EstadoOnboarding;
}

export async function aplicarOnboarding(tipo: 'salud' | 'os' | 'juego'): Promise<Record<string, unknown>> {
  const sb = clienteActual();

  if (tipo === 'juego') {
    const { data: estado, error } = await sb
      .from('onboarding_estado')
      .select('respuestas')
      .eq('modulo', 'juego')
      .maybeSingle();
    if (error) throw error;
    const aplicado = await aplicarJuego(sb, (estado?.respuestas ?? {}) as Record<string, unknown>);
    return { ok: true, aplicado };
  }

  if (tipo === 'salud') {
    const { data: estado, error } = await sb
      .from('onboarding_estado')
      .select('respuestas')
      .eq('modulo', 'salud')
      .maybeSingle();
    if (error) throw error;
    const resultado = await aplicarSalud(sb, (estado?.respuestas ?? {}) as Record<string, unknown>);
    return { ok: true, ...resultado };
  }

  const { data: estado, error } = await sb
    .from('onboarding_estado')
    .select('respuestas')
    .eq('modulo', 'os')
    .maybeSingle();
  if (error) throw error;
  const aplicado = await aplicarOs(sb, (estado?.respuestas ?? {}) as Record<string, unknown>);
  return { ok: true, aplicado };
}
