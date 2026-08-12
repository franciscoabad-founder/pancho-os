export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { hoyLocal, addDias, diaIso } from '../../../lib/habitos/fechas';
import { rachaDiaria, falloAyer } from '../../../lib/habitos/racha';
import { evaluarEtapa, type Criterio } from '../../../lib/habitos/journeys';
import { nivelDesdeXp } from '../../../lib/juego/nivel';

type SB = ReturnType<typeof getSupabaseServer>;

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

// Progreso de la etapa actual de un journey en_curso, en texto simple para el brief.
// Deliberadamente NO lee el contenido MDX (el campo `resumen` del frontmatter no vive
// en DB y este endpoint es de solo lectura de datos): el micro_contenido se arma desde
// journey_etapas.nombre + el criterio evaluado contra habito_checks.
// Busca el hábito por criterio.habito_id si está presente; si no, cae al fallback por
// journey_id + nombre (etapas sembradas antes de que se guardara el habito_id).
async function progresoEtapaActual(
  sb: SB,
  journeyId: string,
  etapa: { nombre: string; criterio: Criterio | null },
  hoy: string,
): Promise<{ hechos: number; meta: number; microContenido: string }> {
  const criterio = etapa.criterio;
  if (!criterio || criterio.tipo !== 'checks') {
    return { hechos: 0, meta: criterio?.meta ?? 0, microContenido: etapa.nombre };
  }

  let habito: { id: string } | null = null;
  if (criterio.habito_id) {
    const { data, error: errHabito } = await sb
      .from('habitos')
      .select('id')
      .eq('id', criterio.habito_id)
      .maybeSingle();
    if (errHabito) throw errHabito;
    habito = data;
  }
  if (!habito && criterio.habito_nombre) {
    const { data, error: errHabito } = await sb
      .from('habitos')
      .select('id')
      .eq('journey_id', journeyId)
      .eq('nombre', criterio.habito_nombre)
      .maybeSingle();
    if (errHabito) throw errHabito;
    habito = data;
  }
  if (!habito) return { hechos: 0, meta: criterio.meta, microContenido: etapa.nombre };

  const ventana = criterio.ventana_dias > 0 ? criterio.ventana_dias : 1;
  const desde = addDias(hoy, -(ventana - 1));
  const { data: checksData, error: errChecks } = await sb
    .from('habito_checks')
    .select('habito_id, fecha')
    .eq('habito_id', habito.id)
    .eq('signo', 'mas')
    .gte('fecha', desde);
  if (errChecks) throw errChecks;

  const resultado = evaluarEtapa(criterio, checksData ?? [], hoy, habito.id);
  return {
    hechos: resultado.hechos,
    meta: criterio.meta,
    microContenido: `${resultado.hechos} de ${criterio.meta} checks esta semana`,
  };
}

// GET: contrato del daily brief para el agente (Cortex/Hermes lo consume para el brief
// de Telegram). Solo lectura, sin escrituras. Autorizado por cookie de sesión o por
// X-OS-Token (integración VPS).
// Respuesta: { fecha, diarias_hoy: [{nombre, intencion, hecho, es_core, racha_actual}],
//   en_riesgo: string[], journey: null | {nombre, etapa_actual, etapa_nombre,
//   progreso:{hechos,meta}, micro_contenido}, alerta_no_fallar_dos: string|null,
//   perfil: {xp_total, nivel} }
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const sb = getSupabaseServer();
    const hoy = hoyLocal();
    const ayer = addDias(hoy, -1);
    const desde120 = addDias(hoy, -120);

    const { data: habitosData, error: errHabitos } = await sb
      .from('habitos')
      .select('id, nombre, intencion, dias_semana, es_core, created_at')
      .eq('tipo', 'diaria')
      .eq('estado', 'activo');
    if (errHabitos) throw errHabitos;
    const diarias = habitosData ?? [];
    const ids = diarias.map((h) => h.id);

    // Una sola query de checks (120 días) para todas las diarias activas; se agrupa en
    // memoria tanto para diarias_hoy (racha, hecho) como para en_riesgo (falloAyer).
    const checksPorHabito = new Map<string, Set<string>>();
    if (ids.length) {
      const { data: checksData, error: errChecks } = await sb
        .from('habito_checks')
        .select('habito_id, fecha')
        .in('habito_id', ids)
        .eq('signo', 'mas')
        .gte('fecha', desde120);
      if (errChecks) throw errChecks;
      for (const c of checksData ?? []) {
        const set = checksPorHabito.get(c.habito_id) ?? new Set<string>();
        set.add(c.fecha);
        checksPorHabito.set(c.habito_id, set);
      }
    }

    const diariasHoy = diarias
      .filter((h) => (h.dias_semana ?? []).includes(diaIso(hoy)))
      .map((h) => {
        const fechasHechas = checksPorHabito.get(h.id) ?? new Set<string>();
        const diasSemana: number[] = h.dias_semana ?? [];
        return {
          nombre: h.nombre,
          intencion: h.intencion,
          hecho: fechasHechas.has(hoy),
          es_core: h.es_core,
          racha_actual: rachaDiaria(fechasHechas, diasSemana, hoy).actual,
        };
      });

    // en_riesgo no se limita a las diarias de hoy: cualquier diaria activa que existía
    // ayer, estaba programada ayer y no tuvo check cuenta para la alerta "no falles dos
    // veces", sin importar si hoy también está programada.
    const enRiesgo = diarias
      .filter((h) => {
        const existiaAyer = (h.created_at ?? '').slice(0, 10) <= ayer;
        if (!existiaAyer) return false;
        const fechasHechas = checksPorHabito.get(h.id) ?? new Set<string>();
        return falloAyer(fechasHechas, h.dias_semana ?? [], hoy);
      })
      .map((h) => h.nombre);

    const { data: journey, error: errJourney } = await sb
      .from('journeys')
      .select('*')
      .eq('estado', 'en_curso')
      .limit(1)
      .maybeSingle();
    if (errJourney) throw errJourney;

    let journeyResumen: Record<string, unknown> | null = null;
    if (journey) {
      const { data: etapa, error: errEtapa } = await sb
        .from('journey_etapas')
        .select('nombre, criterio')
        .eq('journey_id', journey.id)
        .eq('orden', journey.etapa_actual)
        .maybeSingle();
      if (errEtapa) throw errEtapa;

      if (etapa) {
        const { hechos, meta, microContenido } = await progresoEtapaActual(sb, journey.id, etapa, hoy);
        journeyResumen = {
          nombre: journey.nombre,
          etapa_actual: journey.etapa_actual,
          etapa_nombre: etapa.nombre,
          progreso: { hechos, meta },
          micro_contenido: microContenido,
        };
      }
    }

    const { data: perfil, error: errPerfil } = await sb
      .from('habitos_perfil')
      .select('xp_total')
      .limit(1)
      .maybeSingle();
    if (errPerfil) throw errPerfil;
    const xpTotal = perfil?.xp_total ?? 0;

    const alertaNoFallarDos = enRiesgo.length
      ? `Ayer fallaste ${enRiesgo.join(', ')}. Hoy no se falla dos veces.`
      : null;

    return json({
      fecha: hoy,
      diarias_hoy: diariasHoy,
      en_riesgo: enRiesgo,
      journey: journeyResumen,
      alerta_no_fallar_dos: alertaNoFallarDos,
      perfil: { xp_total: xpTotal, nivel: nivelDesdeXp(xpTotal) },
    });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
