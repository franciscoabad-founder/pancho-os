export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { hoyLocal, addDias } from '../../../lib/habitos/fechas';
import { evaluarEtapa, type Criterio, type ResultadoEtapa } from '../../../lib/habitos/journeys';

type SB = ReturnType<typeof getSupabaseServer>;

const DIFICULTADES = ['trivial', 'facil', 'media', 'dificil'];

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

function diasSemanaValidos(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 7 &&
    v.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  );
}

// Progreso del criterio (tipo 'checks') de una etapa: busca el hÃ¡bito que el criterio
// referencia (por criterio.habito_id si estÃ¡ presente; si no, por journey_id + nombre
// como fallback para etapas sembradas antes de que se guardara el habito_id) y evalÃºa
// sus checks de la ventana mÃ³vil con la lib pura evaluarEtapa. null si el criterio no
// es de tipo 'checks' o el hÃ¡bito aÃºn no existe (no deberÃ­a pasar en operaciÃ³n normal:
// el hÃ¡bito se crea al entrar a la etapa).
async function evaluarProgresoEtapa(
  sb: SB,
  journeyId: string,
  etapa: { criterio: Criterio | null },
  hoy: string,
): Promise<(ResultadoEtapa & { meta: number }) | null> {
  const criterio = etapa.criterio;
  if (!criterio || criterio.tipo !== 'checks') return null;

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
  if (!habito) return null;

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
  return { ...resultado, meta: criterio.meta };
}

// Crea los hÃ¡bitos que una etapa desbloquea (etapa.habitos_desbloquea, specs sembradas
// en la migraciÃ³n/seed). Idempotente: no crea si ya existe un hÃ¡bito con ese nombre
// dentro del mismo journey. Devuelve solo los hÃ¡bitos reciÃ©n creados.
//
// Si el criterio de la etapa referencia al hÃ¡bito reciÃ©n creado por nombre
// (criterio.habito_nombre), guarda su id en journey_etapas.criterio.habito_id: asÃ­ el
// criterio queda anclado por id y renombrar el hÃ¡bito despuÃ©s no rompe la evaluaciÃ³n
// del progreso (ver evaluarProgresoEtapa / progresoEtapaActual en brief.ts).
async function crearHabitosEtapa(
  sb: SB,
  journeyId: string,
  etapa: { id: string; criterio: Criterio | null; habitos_desbloquea: unknown },
): Promise<unknown[]> {
  const specs = Array.isArray(etapa.habitos_desbloquea) ? etapa.habitos_desbloquea : [];
  const creados: unknown[] = [];

  for (const spec of specs as Array<Record<string, unknown>>) {
    const nombre = spec?.nombre?.toString().trim();
    if (!nombre) continue;

    const { data: existente, error: errExiste } = await sb
      .from('habitos')
      .select('id')
      .eq('journey_id', journeyId)
      .eq('nombre', nombre)
      .maybeSingle();
    if (errExiste) throw errExiste;
    if (existente) continue;

    const insert: Record<string, unknown> = {
      nombre,
      descripcion: spec.descripcion?.toString().trim() || null,
      tipo: spec.tipo === 'habito' ? 'habito' : 'diaria',
      dificultad: DIFICULTADES.includes(spec.dificultad as string) ? spec.dificultad : 'facil',
      intencion: spec.intencion?.toString().trim() || null,
      es_core: typeof spec.es_core === 'boolean' ? spec.es_core : false,
      journey_id: journeyId,
      source: 'manual',
      en_checklist: true,
    };
    if (diasSemanaValidos(spec.dias_semana)) insert.dias_semana = spec.dias_semana;
    if (typeof spec.permite_mas === 'boolean') insert.permite_mas = spec.permite_mas;
    if (typeof spec.permite_menos === 'boolean') insert.permite_menos = spec.permite_menos;

    const { data: nuevo, error: errInsert } = await sb.from('habitos').insert([insert]).select().single();
    if (errInsert) throw errInsert;
    creados.push(nuevo);

    if (etapa.criterio && etapa.criterio.habito_nombre === nombre && !etapa.criterio.habito_id) {
      const { error: errCriterio } = await sb
        .from('journey_etapas')
        .update({ criterio: { ...etapa.criterio, habito_id: nuevo.id }, updated_at: new Date().toISOString() })
        .eq('id', etapa.id);
      if (errCriterio) throw errCriterio;
    }
  }

  return creados;
}

// GET: catÃ¡logo completo de journeys (ordenados por orden) con sus etapas (ordenadas por
// orden). Para el journey en_curso, incluye progresoEtapa de la etapa actual.
// Respuesta: { journeys: [{ ...journey, etapas: [...journey_etapas], progresoEtapa?:
//   { cumplida, progreso, hechos, meta } }] }
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();

    const { data: journeysData, error: errJourneys } = await sb
      .from('journeys')
      .select('*')
      .order('orden', { ascending: true });
    if (errJourneys) throw errJourneys;
    const journeysList = journeysData ?? [];
    const ids = journeysList.map((j) => j.id);

    const etapasPorJourney = new Map<string, any[]>();
    if (ids.length) {
      const { data: etapasData, error: errEtapas } = await sb
        .from('journey_etapas')
        .select('*')
        .in('journey_id', ids)
        .order('orden', { ascending: true });
      if (errEtapas) throw errEtapas;
      for (const e of etapasData ?? []) {
        const lista = etapasPorJourney.get(e.journey_id) ?? [];
        lista.push(e);
        etapasPorJourney.set(e.journey_id, lista);
      }
    }

    const hoy = hoyLocal();
    const resultado = [];
    for (const j of journeysList) {
      const etapas = etapasPorJourney.get(j.id) ?? [];
      const entry: Record<string, unknown> = { ...j, etapas };
      if (j.estado === 'en_curso') {
        const etapaActual = etapas.find((e) => e.orden === j.etapa_actual);
        if (etapaActual) {
          const progreso = await evaluarProgresoEtapa(sb, j.id, etapaActual, hoy);
          if (progreso) entry.progresoEtapa = progreso;
        }
      }
      resultado.push(entry);
    }

    return json({ journeys: resultado });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// POST {accion:'iniciar', slug}: arranca un journey 'disponible' (400 si estÃ¡
//   'bloqueado' o en cualquier otro estado), marca en_curso + etapa_actual=1 +
//   iniciado_at, y crea los hÃ¡bitos de la etapa 1 (idempotente).
// POST {accion:'avanzar', journey_id}: evalÃºa el criterio de la etapa actual; si no se
//   cumple, 409 {error, progreso}. Si se cumple, marca completada_at de la etapa; si hay
//   etapa siguiente, avanza etapa_actual y crea sus hÃ¡bitos; si era la Ãºltima, marca el
//   journey 'completado' y desbloquea el siguiente journey por orden.
// Respuesta: { ok, journey, etapaNueva?, habitosCreados?, completado? }
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    if (body.accion === 'iniciar') {
      const slug = body.slug?.toString().trim();
      if (!slug) return json({ error: 'slug requerido' }, 400);

      const { data: journey, error: errJourney } = await sb
        .from('journeys')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (errJourney) throw errJourney;
      if (!journey) return json({ error: 'journey no encontrado' }, 404);
      if (journey.estado !== 'disponible') {
        return json({ error: `journey en estado '${journey.estado}', no se puede iniciar` }, 400);
      }

      const { data: etapas, error: errEtapas } = await sb
        .from('journey_etapas')
        .select('*')
        .eq('journey_id', journey.id)
        .order('orden', { ascending: true });
      if (errEtapas) throw errEtapas;
      const etapaUno = (etapas ?? []).find((e) => e.orden === 1);
      if (!etapaUno) return json({ error: 'journey sin etapa 1 definida' }, 502);

      const habitosCreados = await crearHabitosEtapa(sb, journey.id, etapaUno);

      const { data: journeyActualizado, error: errUpdate } = await sb
        .from('journeys')
        .update({
          estado: 'en_curso',
          etapa_actual: 1,
          iniciado_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', journey.id)
        .select()
        .single();
      if (errUpdate) throw errUpdate;

      return json({ ok: true, journey: journeyActualizado, habitosCreados });
    }

    if (body.accion === 'avanzar') {
      const journeyId = body.journey_id?.toString().trim();
      if (!journeyId) return json({ error: 'journey_id requerido' }, 400);

      const { data: journey, error: errJourney } = await sb
        .from('journeys')
        .select('*')
        .eq('id', journeyId)
        .maybeSingle();
      if (errJourney) throw errJourney;
      if (!journey) return json({ error: 'journey no encontrado' }, 404);
      if (journey.estado !== 'en_curso') {
        return json({ error: `journey en estado '${journey.estado}', no estÃ¡ en curso` }, 400);
      }

      const { data: etapasData, error: errEtapas } = await sb
        .from('journey_etapas')
        .select('*')
        .eq('journey_id', journey.id)
        .order('orden', { ascending: true });
      if (errEtapas) throw errEtapas;
      const etapas = etapasData ?? [];
      const etapaActual = etapas.find((e) => e.orden === journey.etapa_actual);
      if (!etapaActual) return json({ error: 'etapa actual no encontrada' }, 502);

      const hoy = hoyLocal();
      const progreso = await evaluarProgresoEtapa(sb, journey.id, etapaActual, hoy);
      if (!progreso) {
        return json({ error: 'no se pudo evaluar el criterio de esta etapa (hÃ¡bito no encontrado)' }, 502);
      }
      if (!progreso.cumplida) {
        return json({ error: 'aÃºn no se cumple el criterio de esta etapa', progreso }, 409);
      }

      const { error: errCompletar } = await sb
        .from('journey_etapas')
        .update({ completada_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', etapaActual.id);
      if (errCompletar) throw errCompletar;

      const etapaSiguiente = etapas.find((e) => e.orden === journey.etapa_actual + 1);

      if (etapaSiguiente) {
        const habitosCreados = await crearHabitosEtapa(sb, journey.id, etapaSiguiente);
        const { data: journeyActualizado, error: errUpdate } = await sb
          .from('journeys')
          .update({ etapa_actual: etapaSiguiente.orden, updated_at: new Date().toISOString() })
          .eq('id', journey.id)
          .select()
          .single();
        if (errUpdate) throw errUpdate;
        return json({
          ok: true,
          journey: journeyActualizado,
          etapaNueva: etapaSiguiente,
          habitosCreados,
          completado: false,
        });
      }

      const { data: journeyCompletado, error: errCompletado } = await sb
        .from('journeys')
        .update({
          estado: 'completado',
          completado_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', journey.id)
        .select()
        .single();
      if (errCompletado) throw errCompletado;

      // Desbloquea el siguiente journey del catÃ¡logo (por orden global), si existe y
      // sigue 'bloqueado'.
      const { data: siguienteJourney, error: errSiguiente } = await sb
        .from('journeys')
        .select('*')
        .eq('orden', journey.orden + 1)
        .maybeSingle();
      if (errSiguiente) throw errSiguiente;
      if (siguienteJourney && siguienteJourney.estado === 'bloqueado') {
        const { error: errDesbloquear } = await sb
          .from('journeys')
          .update({ estado: 'disponible', updated_at: new Date().toISOString() })
          .eq('id', siguienteJourney.id);
        if (errDesbloquear) throw errDesbloquear;
      }

      return json({ ok: true, journey: journeyCompletado, completado: true });
    }

    return json({ error: "accion debe ser 'iniciar' o 'avanzar'" }, 400);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
