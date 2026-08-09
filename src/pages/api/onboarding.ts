export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';
import { resumenModos } from '../../os/components/onboarding/flujoOs';

type SB = ReturnType<typeof getSupabaseServer>;

const STATE_KEY = 'main';

// GET ?modulo=X → estado del onboarding de ese modulo (o null si nunca se toco).
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const modulo = context.url.searchParams.get('modulo');
  if (!modulo) return json({ error: 'modulo requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('onboarding_estado')
      .select('*')
      .eq('modulo', modulo)
      .maybeSingle();
    if (error) throw error;
    return json({ estado: data ?? null });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// Deriva y escribe la config de Salud a partir de las respuestas del onboarding
// del modulo 'salud'. Escribe defensivamente: si la columna `ayuno_objetivo_h`
// (agregada por otra migracion en paralelo, ver 20260720000100_ayuno_objetivo_default.sql)
// todavia no existe en la base contra la que corre esto, reintenta sin las columnas
// de ayuno y deja constancia en la respuesta via `nota`.
async function aplicarSalud(sb: SB, respuestas: Record<string, any>): Promise<{ config: unknown; nota?: string }> {
  const r = respuestas ?? {};

  const pesoActual = r.peso_actual ?? {};
  const targets = r.targets ?? {};
  const unidadFinal = r.unidad ?? pesoActual.unidad ?? 'kg';

  const patchBase: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (targets.kcal != null) patchBase.kcal_objetivo = Math.round(targets.kcal);
  if (targets.proteina_g != null) patchBase.proteina_objetivo_g = Math.round(targets.proteina_g);
  if (targets.carbos_g != null) patchBase.carbos_objetivo_g = Math.round(targets.carbos_g);
  if (targets.grasa_g != null) patchBase.grasa_objetivo_g = Math.round(targets.grasa_g);
  if (unidadFinal === 'kg' || unidadFinal === 'lb') patchBase.unidad_peso = unidadFinal;

  // Ayuno: la columna real es salud_config.protocolo_ayuno_default (token legacy
  // '16_8', no '16:8') + salud_config.ayuno_objetivo_h para las horas (ver
  // apps/web/src/pages/api/os/salud/config.ts, fuente de verdad de este mapeo).
  // 'sin_ayuno' es una respuesta valida del onboarding pero no un preset de
  // salud_config: en ese caso no se escribe nada, se deja la config como estaba.
  const TOKEN_ONBOARDING_A_CONFIG: Record<string, string> = { '16:8': '16_8', '24h': '24h', '36h': '36h' };
  const HORAS_POR_PROTOCOLO: Record<string, number> = { '16_8': 16, '24h': 24, '36h': 36 };
  const protocoloAyuno = TOKEN_ONBOARDING_A_CONFIG[r.protocolo_ayuno as string];
  const patchAyuno: Record<string, unknown> = {};
  if (protocoloAyuno) {
    patchAyuno.protocolo_ayuno_default = protocoloAyuno;
    patchAyuno.ayuno_objetivo_h = HORAS_POR_PROTOCOLO[protocoloAyuno];
  }

  // Config es singleton (misma convencion que api/os/salud/config.ts): lee o crea.
  const { data: existente, error: errLeer } = await sb
    .from('salud_config')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);
  if (errLeer) throw errLeer;
  let configId = existente?.[0]?.id as string | undefined;
  if (!configId) {
    const { data: creado, error: errCrear } = await sb.from('salud_config').insert([{}]).select('id').single();
    if (errCrear) throw errCrear;
    configId = creado.id;
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
    // Reintenta sin las columnas de ayuno (todavia no aplicadas en esta base).
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
// onboarding del modulo 'os'. Mirror de aplicarSalud: nunca se salta una
// escritura en silencio, si algo falla se lanza y el caller lo surface.
async function aplicarOs(sb: SB, respuestas: Record<string, any>) {
  const r = respuestas ?? {};

  // 1) os_semana: modo (off gana sobre maker) + sale, sin tocar etiqueta/nota.
  const { maker, manager, off } = resumenModos(r);
  const diasSale: number[] = Array.isArray(r.dias_sale) ? r.dias_sale : [];
  const modoPorDia = new Map<number, 'maker' | 'manager' | 'off'>();
  for (const d of maker) modoPorDia.set(d, 'maker');
  for (const d of manager) modoPorDia.set(d, 'manager');
  for (const d of off) modoPorDia.set(d, 'off');

  let semanaEscritas = 0;
  for (let dia = 1; dia <= 7; dia++) {
    const modo = modoPorDia.get(dia) ?? 'manager';
    const sale = diasSale.includes(dia);
    const { error } = await sb
      .from('os_semana')
      .update({ modo, sale, updated_at: new Date().toISOString() })
      .eq('dia', dia);
    if (error) throw error;
    semanaEscritas++;
  }

  // 2) os_lineas: recibe_maker segun lineas_maker (match por nombre, las 8 filas).
  const lineasMaker: string[] = Array.isArray(r.lineas_maker) ? r.lineas_maker : [];
  const { data: todasLineas, error: errLineas } = await sb.from('os_lineas').select('id, nombre');
  if (errLineas) throw errLineas;
  let lineasEscritas = 0;
  for (const l of todasLineas ?? []) {
    const recibeMaker = lineasMaker.includes(l.nombre);
    const { error } = await sb
      .from('os_lineas')
      .update({ recibe_maker: recibeMaker, updated_at: new Date().toISOString() })
      .eq('id', l.id);
    if (error) throw error;
    lineasEscritas++;
  }

  // 3) os_funcion_presupuesto: upsert de las 4 funciones.
  const presupuesto = r.presupuesto ?? {};
  const FUNCIONES = ['promover', 'vender', 'construir', 'entregar'] as const;
  let presupuestoEscrito = 0;
  for (const funcion of FUNCIONES) {
    const horas = presupuesto[funcion];
    if (horas == null) continue; // explicito gana; si no vino, no se toca.
    const { error } = await sb
      .from('os_funcion_presupuesto')
      .upsert(
        { funcion, horas_semana_objetivo: Number(horas), updated_at: new Date().toISOString() },
        { onConflict: 'funcion' },
      );
    if (error) throw error;
    presupuestoEscrito++;
  }

  // 4) os_objetivos: reemplaza el placeholder "[CONFIRMAR EN ONBOARDING]" en
  // punto_partida de los objetivos activos orden=1 (finanzas) y orden=3 (ingresos).
  const puntoPartida = r.punto_partida ?? {};
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

  // 5) Identidad: no existe tabla os_identidad, se guarda en os_system_state.state.identidad
  // (merge, sin clobbear otras claves de state). Se lee el estado actual primero.
  const identidadTexto = r.identidad?.texto;
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

// POST { modulo, paso?, respuestas? (merge sobre lo existente), completado? }
//   → upsert de onboarding_estado por modulo.
// POST { aplicar: 'salud' }
//   → toma las respuestas guardadas del modulo 'salud' y escribe la config derivada.
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  let body: Record<string, any>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }

  const sb = getSupabaseServer();

  if (body.aplicar === 'salud') {
    try {
      const { data: estado, error } = await sb
        .from('onboarding_estado')
        .select('respuestas')
        .eq('modulo', 'salud')
        .maybeSingle();
      if (error) throw error;
      const resultado = await aplicarSalud(sb, estado?.respuestas ?? {});
      return json({ ok: true, ...resultado });
    } catch (err) {
      return json({ error: errMsg(err) }, 502);
    }
  }

  if (body.aplicar === 'os') {
    try {
      const { data: estado, error } = await sb
        .from('onboarding_estado')
        .select('respuestas')
        .eq('modulo', 'os')
        .maybeSingle();
      if (error) throw error;
      const aplicado = await aplicarOs(sb, estado?.respuestas ?? {});
      return json({ ok: true, aplicado });
    } catch (err) {
      return json({ error: errMsg(err) }, 502);
    }
  }

  const modulo = typeof body.modulo === 'string' ? body.modulo.trim() : '';
  if (!modulo) return json({ error: 'modulo requerido' }, 400);

  try {
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
    return json({ estado: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
