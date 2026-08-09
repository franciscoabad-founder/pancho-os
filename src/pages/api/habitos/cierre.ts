export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { hoyLocal, addDias, diaIso, timestampGuayaquil } from '../../../lib/habitos/fechas';
import { penalizacionFallo, type Dificultad } from '../../../lib/habitos/scoring';

type SB = ReturnType<typeof getSupabaseServer>;

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

// DÃ­as pendientes de cierre: desde el dÃ­a siguiente al Ãºltimo cierre registrado (o
// desde ayer si no hay ninguno) hasta AYER inclusive. Hoy nunca se cierra (aÃºn corre).
function diasPendientes(ultimoCierre: string | null, hoy: string): string[] {
  const ayer = addDias(hoy, -1);
  const desde = ultimoCierre ? addDias(ultimoCierre, 1) : ayer;
  const dias: string[] = [];
  let cursor = desde;
  let guard = 0;
  while (cursor <= ayer && guard < 3660) {
    dias.push(cursor);
    cursor = addDias(cursor, 1);
    guard += 1;
  }
  return dias;
}

// Cierra un Ãºnico dÃ­a: aplica penalizacionFallo al valor de cada diaria activa
// programada ese dÃ­a (creada antes o ese mismo dÃ­a) que no tenga check 'mas' esa
// fecha, detecta dÃ­a perfecto, e inserta la fila en habito_cierres. Idempotente en dos
// capas: primero verifica si el dÃ­a ya estÃ¡ cerrado (evita re-penalizar en una carrera
// entre el POST de n8n y el fallback lazy de GET habitos), y si aun asÃ­ el insert choca
// contra la pk duplicada, lo trata igual como ya procesado.
async function cerrarDia(sb: SB, dia: string): Promise<{ resumen: Record<string, unknown>; insertado: boolean }> {
  const { data: existente, error: errExiste } = await sb
    .from('habito_cierres')
    .select('fecha')
    .eq('fecha', dia)
    .maybeSingle();
  if (errExiste) throw errExiste;
  if (existente) return { resumen: {}, insertado: false };

  const { data: habitosData, error: errHabitos } = await sb
    .from('habitos')
    .select('id, nombre, dificultad, valor, dias_semana, created_at, es_core')
    .eq('tipo', 'diaria')
    .eq('estado', 'activo');
  if (errHabitos) throw errHabitos;

  const programadas = (habitosData ?? []).filter(
    (h) => (h.dias_semana ?? []).includes(diaIso(dia)) && (h.created_at ?? '').slice(0, 10) <= dia,
  );

  // falladas: nombres (compat con resÃºmenes viejos que solo listaban strings) +
  // falladasDetalle: shape completo ({id, nombre, dificultad, valor, es_core}) que el
  // motor B necesita para calcular daÃ±o HP sin tener que releer la tabla habitos.
  const falladas: string[] = [];
  const falladasDetalle: Array<{
    id: string;
    nombre: string;
    dificultad: Dificultad;
    valor: number;
    es_core: boolean;
  }> = [];
  if (programadas.length) {
    const ids = programadas.map((h) => h.id);
    const { data: checksData, error: errChecks } = await sb
      .from('habito_checks')
      .select('habito_id')
      .in('habito_id', ids)
      .eq('fecha', dia)
      .eq('signo', 'mas');
    if (errChecks) throw errChecks;
    const hechos = new Set((checksData ?? []).map((c) => c.habito_id));

    for (const h of programadas) {
      if (hechos.has(h.id)) continue;
      falladas.push(h.nombre);
      falladasDetalle.push({
        id: h.id,
        nombre: h.nombre,
        dificultad: h.dificultad as Dificultad,
        valor: h.valor ?? 0,
        es_core: !!h.es_core,
      });
      const valorNuevo = penalizacionFallo(h.valor ?? 0, h.dificultad as Dificultad);
      const { error: errUpdate } = await sb
        .from('habitos')
        .update({ valor: valorNuevo, updated_at: new Date().toISOString() })
        .eq('id', h.id);
      if (errUpdate) throw errUpdate;
    }
  }

  // DÃ­a perfecto: hubo al menos una diaria programada y ninguna fallÃ³.
  const diaPerfecto = programadas.length > 0 && falladas.length === 0;
  const resumen = {
    diarias_falladas: falladas,
    diarias_falladas_detalle: falladasDetalle,
    dia_perfecto: diaPerfecto,
    programadas: programadas.length,
  };

  const { error: errInsert } = await sb.from('habito_cierres').insert([{ fecha: dia, resumen }]);
  if (errInsert) {
    // pk duplicada (23505): otro proceso ya insertÃ³ el cierre de este dÃ­a. Saltar.
    if ((errInsert as { code?: string }).code === '23505') return { resumen, insertado: false };
    throw errInsert;
  }

  return { resumen, insertado: true };
}

// Re-agenda el recordatorio one-shot de HOY para hÃ¡bitos activos con hora_recordatorio
// programados hoy (dias_semana), si no existe ya un recordatorio pendiente de ese
// habito_id con recordar_at dentro de hoy.
async function reagendarRecordatoriosHoy(sb: SB, hoy: string): Promise<void> {
  const { data: habitosData, error: errHabitos } = await sb
    .from('habitos')
    .select('id, nombre, intencion, dias_semana, hora_recordatorio')
    .eq('estado', 'activo')
    .not('hora_recordatorio', 'is', null);
  if (errHabitos) throw errHabitos;

  const inicioHoy = `${hoy}T00:00:00-05:00`;
  const inicioManana = `${addDias(hoy, 1)}T00:00:00-05:00`;

  for (const h of habitosData ?? []) {
    if (!(h.dias_semana ?? []).includes(diaIso(hoy))) continue;

    const { data: pendientes, error: errPendientes } = await sb
      .from('recordatorios')
      .select('id')
      .eq('habito_id', h.id)
      .eq('estado', 'pendiente')
      .gte('recordar_at', inicioHoy)
      .lt('recordar_at', inicioManana)
      .limit(1);
    if (errPendientes) throw errPendientes;
    if (pendientes && pendientes.length) continue;

    const recordarAt = timestampGuayaquil(hoy, h.hora_recordatorio as string);
    const { error: errInsertRec } = await sb.from('recordatorios').insert([{
      mensaje: h.intencion?.trim() || h.nombre,
      recordar_at: recordarAt.toISOString(),
      canal: 'telegram',
      habito_id: h.id,
    }]);
    if (errInsertRec) throw errInsertRec;
  }
}

// Procesa todos los dÃ­as pendientes de cierre (desde el Ãºltimo habito_cierres + 1 hasta
// ayer) y luego re-agenda los recordatorios de hoy. Reutilizable desde el POST de este
// endpoint y desde el fallback lazy en GET /api/os/habitos.
export async function cerrarPendientes(
  sb: SB,
): Promise<{ cerrados: string[]; resumenes: Record<string, unknown> }> {
  const hoy = hoyLocal();
  const { data: ultimo, error: errUltimo } = await sb
    .from('habito_cierres')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errUltimo) throw errUltimo;

  const dias = diasPendientes(ultimo?.fecha ?? null, hoy);
  const cerrados: string[] = [];
  const resumenes: Record<string, unknown> = {};

  for (const dia of dias) {
    const { resumen, insertado } = await cerrarDia(sb, dia);
    if (insertado) {
      cerrados.push(dia);
      resumenes[dia] = resumen;
    }
  }

  await reagendarRecordatoriosHoy(sb, hoy);

  return { cerrados, resumenes };
}

// POST: cierre diario. Autorizado por cookie de sesiÃ³n (Pancho, testing manual) o por
// X-OS-Token (n8n, corre a las 00:05 Guayaquil). Idempotente: correr dos veces el mismo
// dÃ­a no duplica penalizaciones (habito_cierres.fecha es pk).
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const sb = getSupabaseServer();
    const { cerrados, resumenes } = await cerrarPendientes(sb);
    return json({ ok: true, cerrados, resumenes });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
